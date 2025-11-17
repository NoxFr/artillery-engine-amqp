# Contributing to artillery-engine-amqp

## Development Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Running Tests

```bash
npm test
```

## Code Style

This project uses ESLint and Prettier for code formatting:

```bash
npm run lint
npm run format
```

## Testing Locally

To test the engine locally with Artillery:

1. Link the package:
```bash
npm link
```

2. In your Artillery project:
```bash
npm link artillery-engine-amqp
```

3. Run your scenario:
```bash
artillery run examples/basic-publish.yml
```

## Debugging

Enable debug output:
```bash
DEBUG=engine:amqp artillery run examples/basic-publish.yml
```

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request
