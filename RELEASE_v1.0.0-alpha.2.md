# Alpha Release 2 - Artillery Engine AMQP v1.0.0-alpha.2

Second alpha release with important architectural improvements following Artillery's recommended patterns.

**Alpha Notice**: This is an early release for testing and feedback. The API may change in future versions. Not recommended for production use yet.

## What's Changed

### Major Refactoring
- **Async Library Integration**: Now uses the `async` library with waterfall pattern for step orchestration, following Artillery's official engine example
- **Callback-Based Flow**: Converted all methods from async/await to callback-based for better Artillery compatibility
- **Improved Test Coverage**: Maintained 85%+ code coverage with callback-based tests

### Technical Changes
- Use `A.waterfall` pattern for scenario execution
- All engine methods now use callbacks: `connect()`, `publishMessage()`, `subscribe()`, `cleanup()`
- Better error handling in waterfall flow
- Follows Artillery engine best practices

## Installation

```bash
npm install artillery-engine-amqp@alpha
```

## Changes from v1.0.0-alpha.1

**Breaking Changes:**
- Engine now follows Artillery's callback-based pattern (internal change, no API changes for YAML scenarios)

**Improvements:**
- Better compatibility with Artillery's execution flow
- More reliable step orchestration
- Improved error propagation

## Test Coverage

- Statements: 85.41%
- Branches: 71.42%
- Functions: 88.88%
- Lines: 85.21%

## Quick Start

Create a scenario file:

```yaml
config:
  target: "amqp://localhost:5672"
  phases:
    - duration: 60
      arrivalRate: 10
  engines:
    amqp:
      url: "amqp://localhost:5672"

scenarios:
  - name: "Publish messages"
    engine: amqp
    flow:
      - publishMessage:
          queue: "test-queue"
          data: "Hello from Artillery!"
          batch: 10
```

Run your load test:

```bash
artillery run scenario.yml
```

## Documentation

Check out the [README](https://github.com/NoxFr/artillery-engine-amqp#readme) for complete documentation.

## Requirements

- Node.js >= 14.0.0
- Artillery >= 2.0.0
- RabbitMQ or any AMQP 0.9.1 compatible broker

## Feedback

Please report any issues on the [issue tracker](https://github.com/NoxFr/artillery-engine-amqp/issues).

## Full Changelog

https://github.com/NoxFr/artillery-engine-amqp/compare/v1.0.0-alpha.1...v1.0.0-alpha.2
