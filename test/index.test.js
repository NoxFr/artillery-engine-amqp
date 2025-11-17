const AMQPEngine = require('../index');
const amqp = require('amqplib');

jest.mock('amqplib');

describe('AMQPEngine', () => {
  let engine;
  let mockEE;
  let mockScript;
  let mockConnection;
  let mockChannel;

  beforeEach(() => {
    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue({}),
      assertQueue: jest.fn().mockResolvedValue({}),
      bindQueue: jest.fn().mockResolvedValue({}),
      publish: jest.fn().mockReturnValue(true),
      consume: jest.fn().mockResolvedValue({}),
      ack: jest.fn(),
      cancel: jest.fn(),
      close: jest.fn().mockResolvedValue({}),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
    };

    amqp.connect = jest.fn().mockResolvedValue(mockConnection);

    mockEE = {
      emit: jest.fn(),
      on: jest.fn(),
    };

    mockScript = {
      config: {
        amqp: {
          url: 'amqp://localhost:5672',
        },
      },
    };

    const mockHelpers = {
      template: jest.fn((value, _context) => {
        // Simple passthrough for tests, just return the value as-is
        return value;
      }),
    };

    engine = new AMQPEngine(mockScript, mockEE, mockHelpers);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    test('should connect to AMQP server', (done) => {
      engine.connect((err) => {
        expect(err).toBeNull();
        expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost:5672', {});
        expect(mockConnection.createChannel).toHaveBeenCalled();
        expect(engine.connection).toBe(mockConnection);
        expect(engine.channel).toBe(mockChannel);
        done();
      });
    });

    test('should use default URL if not provided', (done) => {
      engine.config = {};
      engine.connect((err) => {
        expect(err).toBeNull();
        expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost:5672', {});
        done();
      });
    });

    test('should handle connection errors', (done) => {
      const error = new Error('Connection failed');
      amqp.connect.mockRejectedValue(error);

      engine.connect((err) => {
        expect(err).toBeDefined();
        expect(err.message).toBe('Connection failed');
        done();
      });
    });

    test('should handle connection error event', (done) => {
      engine.connect((err) => {
        expect(err).toBeNull();

        const errorHandler = mockConnection.on.mock.calls.find((call) => call[0] === 'error')[1];
        const error = new Error('Connection error');
        errorHandler(error);

        expect(mockEE.emit).toHaveBeenCalledWith('error', 'Connection error');
        done();
      });
    });

    test('should handle connection close event', (done) => {
      engine.connect((err) => {
        expect(err).toBeNull();

        const closeHandler = mockConnection.on.mock.calls.find((call) => call[0] === 'close')[1];
        closeHandler();

        expect(engine.connection).toBeNull();
        expect(engine.channel).toBeNull();
        done();
      });
    });
  });

  describe('publishMessage', () => {
    beforeEach((done) => {
      engine.connect(done);
    });

    test('should publish message to queue', (done) => {
      const requestParams = {
        queue: 'test-queue',
        data: 'test message',
      };

      engine.publishMessage(requestParams, { _uid: '123' }, mockEE, (err) => {
        expect(err).toBeNull();
        expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-queue', { durable: true });
        expect(mockChannel.publish).toHaveBeenCalled();
        expect(mockEE.emit).toHaveBeenCalledWith('counter', 'amqp.messages.sent', 1);
        done();
      });
    });

    test('should publish batch of messages', (done) => {
      const requestParams = {
        queue: 'test-queue',
        data: 'test message',
        batch: 5,
      };

      engine.publishMessage(requestParams, { _uid: '123' }, mockEE, (err) => {
        expect(err).toBeNull();
        expect(mockChannel.publish).toHaveBeenCalledTimes(5);
        expect(mockEE.emit).toHaveBeenCalledWith('counter', 'amqp.messages.sent', 5);
        done();
      });
    });

    test('should publish to exchange with routing key', (done) => {
      const requestParams = {
        exchange: 'test-exchange',
        exchangeType: 'topic',
        routingKey: 'test.key',
        data: { message: 'test' },
      };

      engine.publishMessage(requestParams, { _uid: '123' }, mockEE, (err) => {
        expect(err).toBeNull();
        expect(mockChannel.assertExchange).toHaveBeenCalledWith('test-exchange', 'topic', {
          durable: true,
        });
        expect(mockChannel.publish).toHaveBeenCalledWith(
          'test-exchange',
          'test.key',
          expect.any(Buffer),
          {}
        );
        done();
      });
    });

    test('should generate random message if data not provided', (done) => {
      const requestParams = {
        queue: 'test-queue',
        size: 100,
      };

      engine.publishMessage(requestParams, { _uid: '123' }, mockEE, (err) => {
        expect(err).toBeNull();
        const publishCall = mockChannel.publish.mock.calls[0];
        const buffer = publishCall[2];
        expect(buffer.length).toBe(100);
        done();
      });
    });

    test('should interpolate template variables', (done) => {
      const requestParams = {
        queue: 'orders-{{ $randomNumber(1, 10) }}',
        exchange: 'events-{{ $timestamp }}',
        routingKey: 'test.{{ $uuid }}',
        data: {
          orderId: '{{ $uuid }}',
          timestamp: '{{ $timestamp }}',
        },
      };

      const context = { _uid: '123', vars: {} };

      engine.publishMessage(requestParams, context, mockEE, (err) => {
        expect(err).toBeNull();

        // Verify template was called for each field
        expect(engine.helpers.template).toHaveBeenCalledWith(requestParams.queue, context);
        expect(engine.helpers.template).toHaveBeenCalledWith(requestParams.exchange, context);
        expect(engine.helpers.template).toHaveBeenCalledWith(requestParams.routingKey, context);

        // Verify data was processed
        expect(engine.helpers.template).toHaveBeenCalledWith(
          expect.stringContaining('orderId'),
          context
        );

        done();
      });
    });
  });

  describe('subscribe', () => {
    beforeEach((done) => {
      engine.connect(done);
    });

    test('should subscribe to queue', (done) => {
      const requestParams = {
        queue: 'test-queue',
        messageCount: 1,
      };

      engine.subscribe(requestParams, { _uid: '123' }, mockEE, (err) => {
        expect(err).toBeNull();
        expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-queue', { durable: true });
        expect(mockChannel.consume).toHaveBeenCalled();
        done();
      });
    });

    test('should throw error if queue not specified', (done) => {
      const requestParams = {};

      engine.subscribe(requestParams, { _uid: '123' }, mockEE, (err) => {
        expect(err).toBeDefined();
        expect(err.message).toBe('Queue name is required for subscribe');
        done();
      });
    });
  });

  describe('generateMessage', () => {
    test('should generate message of specified size', () => {
      const size = 50;
      const message = engine.generateMessage(size);

      expect(message).toHaveLength(size);
      expect(typeof message).toBe('string');
    });
  });

  describe('cleanup', () => {
    test('should close channel and connection', (done) => {
      engine.connect((err) => {
        expect(err).toBeNull();
        engine.cleanup((err) => {
          expect(err).toBeNull();
          expect(mockChannel.close).toHaveBeenCalled();
          expect(mockConnection.close).toHaveBeenCalled();
          expect(engine.channel).toBeNull();
          expect(engine.connection).toBeNull();
          done();
        });
      });
    });

    test('should handle cleanup errors gracefully', (done) => {
      engine.connect((err) => {
        expect(err).toBeNull();
        mockChannel.close.mockRejectedValue(new Error('Close error'));

        engine.cleanup((_err) => {
          // Should complete despite error
          expect(mockChannel.close).toHaveBeenCalled();
          done();
        });
      });
    });
  });

  describe('createScenario', () => {
    test('should create and execute scenario', (done) => {
      const scenarioSpec = {
        flow: [
          {
            publishMessage: {
              queue: 'test-queue',
              data: 'test',
            },
          },
        ],
      };

      const scenario = engine.createScenario(scenarioSpec, mockEE);
      const context = { _uid: '123' };

      scenario(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(mockEE.emit).toHaveBeenCalledWith('started');
        expect(mockEE.emit).toHaveBeenCalledWith('done');
        expect(resultContext).toBe(context);
        done();
      });
    });

    test('should create and execute scenario with subscribe', (done) => {
      const scenarioSpec = {
        flow: [
          {
            subscribe: {
              queue: 'test-queue',
              messageCount: 1,
            },
          },
        ],
      };

      const scenario = engine.createScenario(scenarioSpec, mockEE);
      const context = { _uid: '123' };

      scenario(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(mockEE.emit).toHaveBeenCalledWith('started');
        expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-queue', { durable: true });
        expect(mockChannel.consume).toHaveBeenCalled();
        expect(mockEE.emit).toHaveBeenCalledWith('done');
        expect(resultContext).toBe(context);
        done();
      });
    });

    test('should handle errors in scenario', (done) => {
      const scenarioSpec = {
        flow: [
          {
            publishMessage: {
              queue: 'test-queue',
              data: 'test',
            },
          },
        ],
      };

      const error = new Error('Test error');
      mockChannel.assertQueue.mockRejectedValue(error);

      const scenario = engine.createScenario(scenarioSpec, mockEE);
      const context = { _uid: '123' };

      scenario(context, (err, resultContext) => {
        expect(err).toBeDefined();
        expect(mockEE.emit).toHaveBeenCalledWith('error', 'Test error');
        expect(resultContext).toBe(context);
        done();
      });
    });
  });
});
