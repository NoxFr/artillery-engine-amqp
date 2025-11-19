# artillery-engine-amqp

[![npm version](https://img.shields.io/npm/v/artillery-engine-amqp.svg)](https://www.npmjs.com/package/artillery-engine-amqp)
[![npm downloads](https://img.shields.io/npm/dm/artillery-engine-amqp.svg)](https://www.npmjs.com/package/artillery-engine-amqp)
[![license](https://img.shields.io/npm/l/artillery-engine-amqp.svg)](https://github.com/NoxFr/artillery-engine-amqp/blob/main/LICENSE)

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
  amqp:
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

### SSL/TLS Connections

#### Basic SSL Connection

For simple SSL connections using system's trusted CA certificates:

```yaml
config:
  target: "amqps://user:password@rabbitmq.example.com:5671"
  amqp:
    connectionOptions:
      heartbeat: 60
    ssl:
      rejectUnauthorized: true
```

#### SSL with Client Certificates

For mutual TLS authentication:

```yaml
config:
  target: "amqps://user:password@rabbitmq.example.com:5671"
  amqp:
    connectionOptions:
      heartbeat: 60
    ssl:
      cert: "/path/to/client-cert.pem"
      key: "/path/to/client-key.pem"
      ca: "/path/to/ca-cert.pem"
      passphrase: "your-key-passphrase"
      rejectUnauthorized: true
```

#### Self-Signed Certificates (Development)

For development with self-signed certificates:

```yaml
config:
  target: "amqps://user:password@localhost:5671"
  amqp:
    ssl:
      rejectUnauthorized: false
```

**Note:** SSL certificate data and passphrases are automatically redacted from debug logs for security.

See [examples/ssl-connection.yml](examples/ssl-connection.yml) and [examples/ssl-simple.yml](examples/ssl-simple.yml) for complete examples.

### Configuration Options

#### Engine Configuration

- `target`: AMQP connection URL (defined at config level, default: `amqp://localhost:5672`)
  - For SSL/TLS connections, use `amqps://` protocol (e.g., `amqps://user:pass@host:5671`)
- `connectionOptions`: Connection options passed to amqplib (e.g., heartbeat)
- `ssl`: SSL/TLS configuration (optional)
  - `cert`: Path to client certificate file (optional)
  - `key`: Path to client private key file (optional)
  - `ca`: Path to CA certificate file(s) - can be a string or array of strings (optional)
  - `passphrase`: Passphrase for encrypted private key (optional)
  - `rejectUnauthorized`: Whether to reject unauthorized certificates (default: `true`)

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

### Template Variables

The engine supports Artillery's template variables for dynamic values:

```yaml
scenarios:
  - name: "Dynamic messages"
    engine: amqp
    flow:
      - publishMessage:
          queue: "orders-{{ $randomNumber(1, 10) }}"
          data:
            orderId: "{{ $uuid }}"
            timestamp: "{{ $timestamp }}"
            amount: "{{ $randomNumber(10, 1000) }}"
            customerId: "user-{{ $randomNumber(1, 100) }}"
```

**Available template variables:**
- `{{ $uuid }}` - Generate a random UUID v4
- `{{ $randomNumber(min, max) }}` - Generate random number between min and max
- `{{ $randomString(length) }}` - Generate random alphanumeric string
- `{{ $timestamp }}` - Current Unix timestamp in milliseconds

See [examples/template-variables.yml](examples/template-variables.yml) for more examples.

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
