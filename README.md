# Starterpack Go-Gin

A production-ready Go microservice template built with Gin, GORM, and Logrus. Get started quickly with a clean project structure and best practices built-in.

## Features

- REST API with Gin framework
- PostgreSQL database with GORM
- Structured JSON logging with Logrus
- Environment-based configuration
- Docker and Docker Compose support
- Unit and integration tests
- Task runner for common commands

## Prerequisites

- Go 1.21+
- [Task](https://taskfile.dev/installation/)
- Docker & Docker Compose (optional)

## Quick Start

### 1. Install Dependencies

```bash
git clone https://github.com/mtfuller/starterpack-go-gin.git
cd starterpack-go-gin
go mod download
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Run the Application

**With Docker (Recommended):**
```bash
task docker-up
```

**Locally:**
```bash
task run
```

**Build Binary:**
```bash
task build
./bin/api
```

## Project Structure

```
.
├── cmd/api/              # Application entry point
├── internal/
│   ├── config/           # Configuration management
│   ├── database/         # Database connection
│   ├── handlers/         # HTTP request handlers
│   ├── middleware/       # HTTP middleware
│   └── models/           # Data models
├── pkg/
│   ├── logger/           # Structured logging
│   └── httpclient/       # HTTP client wrapper
└── tests/
    ├── unit/             # Unit tests
    └── integration/      # Integration tests
```

## API Endpoints

**Health Check:**
```bash
curl http://localhost:8080/health
```

**User Management:**
```bash
# Create user
curl -X POST http://localhost:8080/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","name":"John Doe"}'

# List users
curl http://localhost:8080/api/v1/users

# Get user
curl http://localhost:8080/api/v1/users/1

# Delete user
curl -X DELETE http://localhost:8080/api/v1/users/1
```

## Testing

```bash
task test              # All tests
task test-unit         # Unit tests only
task test-integration  # Integration tests only
task coverage          # Coverage report
```

## Configuration

Configure via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `8080` | HTTP server port |
| `SERVER_MODE` | `development` | Server mode (development/production) |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `starterpack` | Database name |
| `LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |

## Available Commands

```bash
task                   # List all commands
task build             # Build binary
task run               # Run application
task test              # Run all tests
task test-unit         # Unit tests
task test-integration  # Integration tests
task coverage          # Coverage report
task clean             # Clean artifacts
task docker-up         # Start Docker services
task docker-down       # Stop Docker services
task docker-logs       # View logs
task lint              # Run linter
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review test examples for usage patterns
