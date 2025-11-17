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

    engine = new AMQPEngine(mockScript, mockEE, {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    test('should connect to AMQP server', async () => {
      await engine.connect();

      expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost:5672', {});
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(engine.connection).toBe(mockConnection);
      expect(engine.channel).toBe(mockChannel);
    });

    test('should use default URL if not provided', async () => {
      engine.config = {};
      await engine.connect();

      expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost:5672', {});
    });

    test('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      amqp.connect.mockRejectedValue(error);

      await expect(engine.connect()).rejects.toThrow('Connection failed');
    });

    test('should handle connection error event', async () => {
      await engine.connect();

      const errorHandler = mockConnection.on.mock.calls.find((call) => call[0] === 'error')[1];
      const error = new Error('Connection error');
      errorHandler(error);

      expect(mockEE.emit).toHaveBeenCalledWith('error', 'Connection error');
    });

    test('should handle connection close event', async () => {
      await engine.connect();

      const closeHandler = mockConnection.on.mock.calls.find((call) => call[0] === 'close')[1];
      closeHandler();

      expect(engine.connection).toBeNull();
      expect(engine.channel).toBeNull();
    });
  });

  describe('publishMessage', () => {
    beforeEach(async () => {
      await engine.connect();
    });

    test('should publish message to queue', async () => {
      const requestParams = {
        queue: 'test-queue',
        data: 'test message',
      };

      await engine.publishMessage(requestParams, {}, mockEE);

      expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-queue', { durable: true });
      expect(mockChannel.publish).toHaveBeenCalled();
      expect(mockEE.emit).toHaveBeenCalledWith('counter', 'amqp.messages.sent', 1);
    });

    test('should publish batch of messages', async () => {
      const requestParams = {
        queue: 'test-queue',
        data: 'test message',
        batch: 5,
      };

      await engine.publishMessage(requestParams, {}, mockEE);

      expect(mockChannel.publish).toHaveBeenCalledTimes(5);
      expect(mockEE.emit).toHaveBeenCalledWith('counter', 'amqp.messages.sent', 5);
    });

    test('should publish to exchange with routing key', async () => {
      const requestParams = {
        exchange: 'test-exchange',
        exchangeType: 'topic',
        routingKey: 'test.key',
        data: { message: 'test' },
      };

      await engine.publishMessage(requestParams, {}, mockEE);

      expect(mockChannel.assertExchange).toHaveBeenCalledWith('test-exchange', 'topic', {
        durable: true,
      });
      expect(mockChannel.publish).toHaveBeenCalledWith(
        'test-exchange',
        'test.key',
        expect.any(Buffer),
        {}
      );
    });

    test('should generate random message if data not provided', async () => {
      const requestParams = {
        queue: 'test-queue',
        size: 100,
      };

      await engine.publishMessage(requestParams, {}, mockEE);

      const publishCall = mockChannel.publish.mock.calls[0];
      const buffer = publishCall[2];
      expect(buffer.length).toBe(100);
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      await engine.connect();
    });

    test('should subscribe to queue', async () => {
      const requestParams = {
        queue: 'test-queue',
        messageCount: 1,
      };

      await engine.subscribe(requestParams, {}, mockEE);

      expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-queue', { durable: true });
      expect(mockChannel.consume).toHaveBeenCalled();
    });

    test('should throw error if queue not specified', async () => {
      const requestParams = {};

      await expect(engine.subscribe(requestParams, {}, mockEE)).rejects.toThrow(
        'Queue name is required for subscribe'
      );
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
    test('should close channel and connection', async () => {
      await engine.connect();
      await engine.cleanup();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      expect(engine.channel).toBeNull();
      expect(engine.connection).toBeNull();
    });

    test('should handle cleanup errors gracefully', async () => {
      await engine.connect();
      mockChannel.close.mockRejectedValue(new Error('Close error'));

      await engine.cleanup();

      expect(mockChannel.close).toHaveBeenCalled();
    });
  });

  describe('createScenario', () => {
    test('should create and execute scenario', async () => {
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

      const scenario = await engine.createScenario(scenarioSpec, mockEE);
      const callback = jest.fn();
      const context = { _uid: '123' };

      await scenario(context, callback);

      expect(mockEE.emit).toHaveBeenCalledWith('started');
      expect(mockEE.emit).toHaveBeenCalledWith('done');
      expect(callback).toHaveBeenCalledWith(null, context);
    });

    test('should create and execute scenario with subscribe', async () => {
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

      const scenario = await engine.createScenario(scenarioSpec, mockEE);
      const callback = jest.fn();
      const context = { _uid: '123' };

      await scenario(context, callback);

      expect(mockEE.emit).toHaveBeenCalledWith('started');
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-queue', { durable: true });
      expect(mockChannel.consume).toHaveBeenCalled();
      expect(mockEE.emit).toHaveBeenCalledWith('done');
      expect(callback).toHaveBeenCalledWith(null, context);
    });

    test('should handle errors in scenario', async () => {
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

      const scenario = await engine.createScenario(scenarioSpec, mockEE);
      const callback = jest.fn();
      const context = { _uid: '123' };

      await scenario(context, callback);

      expect(mockEE.emit).toHaveBeenCalledWith('error', 'Test error');
      expect(callback).toHaveBeenCalledWith(error, context);
    });
  });
});
