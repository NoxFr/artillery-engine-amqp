const amqp = require('amqplib');
const A = require('async');
const debug = require('debug')('engine:amqp');

class AMQPEngine {
  constructor(script, ee, helpers) {
    this.script = script;
    this.ee = ee;
    this.helpers = helpers;
    this.connection = null;
    this.channel = null;
    this.config = script.config.amqp || {};

    return this;
  }

  createScenario(scenarioSpec, ee) {
    const self = this;

    return function scenario(initialContext, callback) {
      ee.emit('started');

      const steps = [];

      // First step: pass context through
      steps.push(function init(next) {
        return next(null, initialContext);
      });

      // Add connection step if needed
      steps.push(function ensureConnection(context, next) {
        if (self.connection) {
          return next(null, context);
        }
        self.connect((err) => {
          if (err) {
            return next(err, context);
          }
          return next(null, context);
        });
      });

      // Add scenario steps
      scenarioSpec.flow.forEach((step) => {
        if (step.publishMessage) {
          steps.push(function publishStep(context, next) {
            self.publishMessage(step.publishMessage, context, ee, (err) => {
              return next(err, context);
            });
          });
        } else if (step.subscribe) {
          steps.push(function subscribeStep(context, next) {
            self.subscribe(step.subscribe, context, ee, (err) => {
              return next(err, context);
            });
          });
        }
      });

      A.waterfall(steps, function done(err, context) {
        if (err) {
          debug('Scenario error:', err);
          ee.emit('error', err.message);
          return callback(err, context);
        }

        ee.emit('done');
        return callback(null, context);
      });
    };
  }

  connect(callback) {
    const connectionString = this.script.config.target || 'amqp://localhost:5672';
    let connectionOptions = this.config.connectionOptions || {};

    // Handle SSL/TLS configuration
    if (this.config.ssl) {
      const fs = require('fs');
      const sslConfig = {};

      // Load certificate files if paths are provided
      if (this.config.ssl.cert) {
        sslConfig.cert = fs.readFileSync(this.config.ssl.cert);
      }
      if (this.config.ssl.key) {
        sslConfig.key = fs.readFileSync(this.config.ssl.key);
      }
      if (this.config.ssl.ca) {
        const caFiles = Array.isArray(this.config.ssl.ca)
          ? this.config.ssl.ca
          : [this.config.ssl.ca];
        sslConfig.ca = caFiles.map((caFile) => fs.readFileSync(caFile));
      }
      if (this.config.ssl.passphrase) {
        sslConfig.passphrase = this.config.ssl.passphrase;
      }
      if (typeof this.config.ssl.rejectUnauthorized !== 'undefined') {
        sslConfig.rejectUnauthorized = this.config.ssl.rejectUnauthorized;
      }

      connectionOptions = { ...connectionOptions, ...sslConfig };
    }

    // Obfuscate password in logs
    const obfuscatedConnectionString = connectionString.replace(
      /(:\/\/)([^:]+):([^@]+)@/,
      '$1$2:****@'
    );

    // Obfuscate sensitive SSL data in logs
    const safeConnectionOptions = { ...connectionOptions };
    if (safeConnectionOptions.cert) safeConnectionOptions.cert = '[REDACTED]';
    if (safeConnectionOptions.key) safeConnectionOptions.key = '[REDACTED]';
    if (safeConnectionOptions.ca) safeConnectionOptions.ca = '[REDACTED]';
    if (safeConnectionOptions.passphrase) safeConnectionOptions.passphrase = '[REDACTED]';

    debug('=== AMQP Connection Details ===');
    debug('Connection string:', obfuscatedConnectionString);
    debug('Connection options:', JSON.stringify(safeConnectionOptions, null, 2));
    debug('SSL enabled:', !!this.config.ssl);
    debug('================================');

    amqp
      .connect(connectionString, connectionOptions)
      .then((connection) => {
        this.connection = connection;

        this.connection.on('error', (err) => {
          debug('Connection error:', err);
          this.ee.emit('error', err.message);
        });

        this.connection.on('close', () => {
          debug('Connection closed');
          this.connection = null;
          this.channel = null;
        });

        return this.connection.createChannel();
      })
      .then((channel) => {
        this.channel = channel;
        debug('Channel created successfully');
        callback(null);
      })
      .catch((err) => {
        debug('Connection failed:', err);
        callback(err);
      });
  }

  publishMessage(requestParams, context, ee, callback) {
    const startedAt = Date.now();

    // Template interpolation for dynamic values
    const exchange = this.helpers.template(requestParams.exchange || '', context);
    const routingKey = this.helpers.template(
      requestParams.routingKey || requestParams.queue || '',
      context
    );
    const queue = requestParams.queue ? this.helpers.template(requestParams.queue, context) : null;

    // Process data with template variables
    let data;
    if (requestParams.data) {
      if (typeof requestParams.data === 'string') {
        data = this.helpers.template(requestParams.data, context);
      } else {
        // For objects, stringify then template, then parse back
        const dataStr = JSON.stringify(requestParams.data);
        const templatedStr = this.helpers.template(dataStr, context);
        data = JSON.parse(templatedStr);
      }
    } else {
      data = this.generateMessage(requestParams.size || 300);
    }

    const options = requestParams.options || {};
    const batch = requestParams.batch || 1;

    const operations = [];

    // Ensure exchange exists if specified
    if (exchange) {
      const exchangeType = requestParams.exchangeType || 'topic';
      operations.push(this.channel.assertExchange(exchange, exchangeType, { durable: true }));
    }

    // Ensure queue exists if specified
    if (queue) {
      operations.push(this.channel.assertQueue(queue, { durable: true }));

      // Bind queue to exchange if both are specified
      if (exchange) {
        operations.push(this.channel.bindQueue(queue, exchange, routingKey));
      }
    }

    Promise.all(operations)
      .then(() => {
        // Publish message
        const messageContent = typeof data === 'string' ? data : JSON.stringify(data);
        const buffer = Buffer.from(messageContent);

        for (let i = 0; i < batch; i++) {
          this.channel.publish(exchange, routingKey, buffer, options);
        }

        const delta = Date.now() - startedAt;
        ee.emit('counter', 'amqp.messages.sent', batch);
        ee.emit('histogram', 'amqp.publish.time', delta);
        ee.emit('response', delta, 0, context._uid);

        debug(`Published ${batch} message(s) to ${exchange || 'default'}/${routingKey}`);
        callback(null);
      })
      .catch((err) => {
        const delta = Date.now() - startedAt;
        debug('Publish error:', err);
        ee.emit('error', err.message);
        ee.emit('response', delta, err.code || 0, context._uid);
        callback(err);
      });
  }

  subscribe(requestParams, context, ee, callback) {
    const startedAt = Date.now();

    // Template interpolation for queue name
    const queue = requestParams.queue ? this.helpers.template(requestParams.queue, context) : null;
    const timeout = requestParams.timeout || 5000;
    const messageCount = requestParams.messageCount || 1;

    if (!queue) {
      return callback(new Error('Queue name is required for subscribe'));
    }

    // Ensure queue exists
    this.channel
      .assertQueue(queue, { durable: true })
      .then(() => {
        let messagesReceived = 0;
        const timeoutId = setTimeout(() => {
          debug(`Subscribe timeout after ${timeout}ms, received ${messagesReceived} messages`);
        }, timeout);

        return this.channel.consume(
          queue,
          (msg) => {
            if (msg) {
              messagesReceived++;
              const delta = Date.now() - startedAt;

              ee.emit('counter', 'amqp.messages.received', 1);
              ee.emit('histogram', 'amqp.subscribe.time', delta);

              this.channel.ack(msg);

              if (messagesReceived >= messageCount) {
                clearTimeout(timeoutId);
                this.channel.cancel(msg.fields.consumerTag);
              }
            }
          },
          { noAck: false }
        );
      })
      .then(() => {
        debug(`Subscribed to queue: ${queue}`);
        callback(null);
      })
      .catch((err) => {
        debug('Subscribe error:', err);
        ee.emit('error', err.message);
        callback(err);
      });
  }

  generateMessage(size) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < size; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  cleanup(callback) {
    const tasks = [];

    if (this.channel) {
      tasks.push((cb) => {
        this.channel
          .close()
          .then(() => {
            this.channel = null;
            cb(null);
          })
          .catch((err) => {
            debug('Channel close error:', err);
            this.channel = null;
            cb(null); // Continue cleanup even on error
          });
      });
    }

    if (this.connection) {
      tasks.push((cb) => {
        this.connection
          .close()
          .then(() => {
            this.connection = null;
            cb(null);
          })
          .catch((err) => {
            debug('Connection close error:', err);
            this.connection = null;
            cb(null); // Continue cleanup even on error
          });
      });
    }

    if (tasks.length === 0) {
      debug('Cleanup completed (nothing to clean)');
      return callback ? callback(null) : null;
    }

    A.series(tasks, (err) => {
      debug('Cleanup completed');
      if (callback) {
        callback(err);
      }
    });
  }
}

module.exports = AMQPEngine;
