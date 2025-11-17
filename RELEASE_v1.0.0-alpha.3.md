# Alpha Release 3 - Artillery Engine AMQP v1.0.0-alpha.3

Third alpha release with template variable support for dynamic load testing scenarios.

**Alpha Notice**: This is an early release for testing and feedback. The API may change in future versions. Not recommended for production use yet.

## What's New

### Template Variable Support
- Full support for Artillery's template variables in queue names, exchanges, routing keys, and message data
- Dynamic value interpolation using `{{ $uuid }}`, `{{ $timestamp }}`, `{{ $randomNumber() }}`, etc.
- Seamless integration with Artillery's templating system via `helpers.template()`

## Installation

```bash
npm install artillery-engine-amqp@alpha
```

## Changes from v1.0.0-alpha.2

**New Features:**
- Template variable interpolation in all message fields
- Support for dynamic queue and exchange names
- Example scenario demonstrating template usage

**Technical:**
- Integration with Artillery's `helpers.template()` method
- Proper handling of string and object data interpolation
- 18 tests passing with 86%+ coverage

## Template Variables Example

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

## Available Template Variables

- `{{ $uuid }}` - Generate a random UUID v4
- `{{ $randomNumber(min, max) }}` - Generate random number between min and max
- `{{ $randomString(length) }}` - Generate random alphanumeric string
- `{{ $timestamp }}` - Current Unix timestamp in milliseconds

See [examples/template-variables.yml](examples/template-variables.yml) for complete examples.

## Test Coverage

- Statements: 86.75%
- Branches: 76.81%
- Functions: 88.88%
- Lines: 86.57%
- 18 tests passing

## Quick Start

```bash
npm install artillery-engine-amqp@alpha
artillery run examples/template-variables.yml
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

https://github.com/NoxFr/artillery-engine-amqp/compare/v1.0.0-alpha.2...v1.0.0-alpha.3
