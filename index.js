const amqp = require('amqplib');
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

  async createScenario(scenarioSpec, ee) {
    const self = this;

    return async function scenario(context, callback) {
      ee.emit('started');

      try {
        // Connect to AMQP if not already connected
        if (!self.connection) {
          await self.connect();
        }

        // Execute scenario steps
        for (const step of scenarioSpec.flow) {
          if (step.publishMessage) {
            await self.publishMessage(step.publishMessage, context, ee);
          } else if (step.subscribe) {
            await self.subscribe(step.subscribe, context, ee);
          }
        }

        ee.emit('done');
        return callback(null, context);
      } catch (err) {
        debug('Scenario error:', err);
        ee.emit('error', err.message);
        return callback(err, context);
      }
    };
  }

  async connect() {
    try {
      const connectionString = this.config.url || 'amqp://localhost:5672';
      const connectionOptions = this.config.connectionOptions || {};

      debug('Connecting to AMQP:', connectionString);
      this.connection = await amqp.connect(connectionString, connectionOptions);

      this.connection.on('error', (err) => {
        debug('Connection error:', err);
        this.ee.emit('error', err.message);
      });

      this.connection.on('close', () => {
        debug('Connection closed');
        this.connection = null;
        this.channel = null;
      });

      this.channel = await this.connection.createChannel();
      debug('Channel created successfully');
    } catch (err) {
      debug('Connection failed:', err);
      throw err;
    }
  }

  async publishMessage(requestParams, context, ee) {
    const startedAt = Date.now();

    try {
      const exchange = requestParams.exchange || '';
      const routingKey = requestParams.routingKey || requestParams.queue || '';
      const data = requestParams.data || this.generateMessage(requestParams.size || 300);
      const options = requestParams.options || {};

      // Ensure exchange exists if specified
      if (exchange) {
        const exchangeType = requestParams.exchangeType || 'topic';
        await this.channel.assertExchange(exchange, exchangeType, { durable: true });
      }

      // Ensure queue exists if specified
      if (requestParams.queue) {
        await this.channel.assertQueue(requestParams.queue, { durable: true });

        // Bind queue to exchange if both are specified
        if (exchange) {
          await this.channel.bindQueue(requestParams.queue, exchange, routingKey);
        }
      }

      // Publish message
      const messageContent = typeof data === 'string' ? data : JSON.stringify(data);
      const buffer = Buffer.from(messageContent);

      const batch = requestParams.batch || 1;
      for (let i = 0; i < batch; i++) {
        this.channel.publish(exchange, routingKey, buffer, options);
      }

      const delta = Date.now() - startedAt;
      ee.emit('counter', 'amqp.messages.sent', batch);
      ee.emit('histogram', 'amqp.publish.time', delta);
      ee.emit('response', delta, 0, context._uid);

      debug(`Published ${batch} message(s) to ${exchange || 'default'}/${routingKey}`);
    } catch (err) {
      const delta = Date.now() - startedAt;
      debug('Publish error:', err);
      ee.emit('error', err.message);
      ee.emit('response', delta, err.code || 0, context._uid);
      throw err;
    }
  }

  async subscribe(requestParams, context, ee) {
    const startedAt = Date.now();

    try {
      const queue = requestParams.queue;
      const timeout = requestParams.timeout || 5000;
      const messageCount = requestParams.messageCount || 1;

      if (!queue) {
        throw new Error('Queue name is required for subscribe');
      }

      // Ensure queue exists
      await this.channel.assertQueue(queue, { durable: true });

      let messagesReceived = 0;
      const timeoutId = setTimeout(() => {
        debug(`Subscribe timeout after ${timeout}ms, received ${messagesReceived} messages`);
      }, timeout);

      await this.channel.consume(
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

      debug(`Subscribed to queue: ${queue}`);
    } catch (err) {
      debug('Subscribe error:', err);
      ee.emit('error', err.message);
      throw err;
    }
  }

  generateMessage(size) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < size; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async cleanup() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      debug('Cleanup completed');
    } catch (err) {
      debug('Cleanup error:', err);
    }
  }
}

module.exports = AMQPEngine;
