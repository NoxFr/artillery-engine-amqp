# artillery-engine-amqp

Load testing plugin for Artillery.io that adds support for AMQP (RabbitMQ, etc.).

## Installation

```bash
npm install artillery-engine-amqp
```

## Usage

### Basic Configuration

Create a scenario file (e.g., `scenario.yml`):

```yaml
config:
  target: "amqp://localhost:5672"
  phases:
    - duration: 60
      arrivalRate: 10
  engines:
    amqp:
      url: "amqp://localhost:5672"
      connectionOptions:
        heartbeat: 60

scenarios:
  - name: "Publish messages to queue"
    engine: amqp
    flow:
      - publishMessage:
          queue: "test-queue"
          data: "Hello from Artillery!"
          batch: 10
```

### Publish to Exchange

```yaml
scenarios:
  - name: "Publish to exchange"
    engine: amqp
    flow:
      - publishMessage:
          exchange: "my-exchange"
          exchangeType: "topic"
          routingKey: "test.routing.key"
          data:
            message: "Test message"
            timestamp: "{{ $timestamp }}"
          options:
            persistent: true
```

### Subscribe to Queue

```yaml
scenarios:
  - name: "Subscribe and consume messages"
    engine: amqp
    flow:
      - subscribe:
          queue: "test-queue"
          messageCount: 5
          timeout: 10000
```

### Configuration Options

#### Engine Configuration

- `url`: AMQP connection URL (default: `amqp://localhost:5672`)
- `connectionOptions`: Connection options passed to amqplib

#### publishMessage Options

- `exchange`: Exchange name (optional, default: '' for default exchange)
- `exchangeType`: Exchange type (topic, direct, fanout, headers) (default: 'topic')
- `routingKey`: Routing key for message routing
- `queue`: Queue name (will be created if doesn't exist)
- `data`: Message payload (string or object)
- `size`: Random message size in bytes (default: 300) - used if data is not provided
- `batch`: Number of messages to send (default: 1)
- `options`: Publishing options
  - `persistent`: Make message persistent (default: false)
  - `contentType`: Content type (e.g., 'application/json')
  - `headers`: Custom headers

#### subscribe Options

- `queue`: Queue name to subscribe to (required)
- `messageCount`: Number of messages to consume (default: 1)
- `timeout`: Timeout in milliseconds (default: 5000)

## Run Tests

```bash
artillery run scenario.yml
```

## Metrics

The engine emits the following metrics:

- `amqp.messages.sent`: Counter for sent messages
- `amqp.messages.received`: Counter for received messages
- `amqp.publish.time`: Histogram of publish operation times
- `amqp.subscribe.time`: Histogram of subscribe operation times

## Debug

Enable debug logging:

```bash
DEBUG=engine:amqp artillery run scenario.yml
```

## License

MIT
