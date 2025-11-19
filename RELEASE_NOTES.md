# Release Notes

## v1.0.0-alpha.7 (2025-01-19)

### Features
- **Debug Logging**: Add debug logs for SSL certificate paths to improve troubleshooting
  - Certificate path logging before file loading
  - CA certificate path(s) logging
  - Private key path logging

### Bug Fixes
- **YAML Formatting**: Correct indentation in SSL example files
  - Fixed `ssl-connection.yml` indentation
  - Fixed `ssl-simple.yml` indentation

### Documentation
- **Configuration Structure**: Update all documentation and examples to use correct config structure
  - Changed from `config.engines.amqp` to `config.amqp` throughout
  - Updated README.md with correct configuration format
  - Updated all example files (7 files) to match actual implementation
  - All examples now properly reference `config.amqp` instead of deprecated `config.engines.amqp`

### Files Changed
- `index.js`: Added SSL path debug logging
- `README.md`: Fixed configuration structure in all examples
- `examples/basic-publish.yml`: Updated config structure
- `examples/complete-scenario.yml`: Updated config structure
- `examples/exchange-publish.yml`: Updated config structure
- `examples/ssl-connection.yml`: Updated config structure and fixed indentation
- `examples/ssl-simple.yml`: Updated config structure and fixed indentation
- `examples/subscribe.yml`: Updated config structure
- `examples/template-variables.yml`: Updated config structure

---

## v1.0.0-alpha.6 (2025-01-18)

### Features
- **SSL/TLS Support**: Complete SSL/TLS connection support for AMQP
  - Client certificate authentication (mutual TLS)
  - CA certificate validation
  - Support for encrypted private keys with passphrase
  - Configurable certificate validation (`rejectUnauthorized`)
  - Multiple CA certificates support (array)
  - Automatic password and certificate data redaction in logs

### Tests
- **SSL Configuration Tests**: Add comprehensive test suite for SSL configuration
  - SSL connection options validation
  - Certificate path handling
  - Passphrase handling
  - Multiple CA certificates support

### Security
- **Credential Obfuscation**: Sensitive data is now automatically redacted from debug logs
  - Passwords in connection strings are masked as `****`
  - Certificate data shown as `[REDACTED]`
  - Private keys shown as `[REDACTED]`
  - CA certificates shown as `[REDACTED]`
  - Passphrases shown as `[REDACTED]`

---

## v1.0.0-alpha.5 (2025-01-17)

### Features
- **Password Obfuscation**: Obfuscate passwords in debug logs for security

### Refactoring
- **Configuration**: Use `config.target` instead of `engines.amqp.url` for connection string
  - Aligns with Artillery conventions
  - Simplifies configuration structure

---

## Migration Guide

### Upgrading from alpha.6 to alpha.7
No breaking changes. This release only includes:
- Improved debug logging for SSL troubleshooting
- Documentation fixes

### Upgrading from alpha.5 to alpha.6
Update your configuration files to use the new SSL options if needed:

```yaml
config:
  target: "amqps://user:password@host:5671"
  engines:
    amqp:
      ssl:
        cert: "/path/to/cert.pem"
        key: "/path/to/key.pem"
        ca: "/path/to/ca.pem"
        passphrase: "your-passphrase"
        rejectUnauthorized: true
```

### Upgrading to alpha.5+
**IMPORTANT**: Configuration structure has changed. Update your YAML files:

**Old (deprecated):**
```yaml
config:
  engines:
    amqp:
      url: "amqp://localhost:5672"
```

**New (correct):**
```yaml
config:
  target: "amqp://localhost:5672"
  amqp:
    connectionOptions:
      heartbeat: 60
```

---

## Known Issues
- None

## Contributors
- Mathieu Durand

## Links
- [GitHub Repository](https://github.com/NoxFr/artillery-engine-amqp)
- [NPM Package](https://www.npmjs.com/package/artillery-engine-amqp)
- [Issues](https://github.com/NoxFr/artillery-engine-amqp/issues)
