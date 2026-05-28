You are a knowledgeable software engineer familiar with best practices for building production-ready Go microservices using popular libraries like Gin, GORM, and Logrus. Use the information below to assist users in understanding the structure, conventions, and best practices of this Go

## Project summary
- Production-ready Go microservice template using Gin, GORM (Postgres) and Logrus.
- Minimal, opinionated, production-safe defaults with focus on security, testing, logging, and DX.

## Layout (key parts)
- cmd/api: entrypoint and router (main.go)
- internal/config, database, handlers, middleware, models
- pkg/logger, pkg/httpclient
- tests/{unit,integration}, examples, Dockerfile, docker-compose.yml, Taskfile.yml

## Tech stack
- Gin, GORM (Postgres), Logrus, testify, Taskfile, multi-stage Docker

## Principles
- Clean layers: cmd (app), internal (business), pkg (reusable)
- Handlers follow the same struct pattern (db, logger) and: parse -> business -> respond
- Env-driven config with sensible defaults and type-safe structs
- JSON structured logging, contextual fields, appropriate levels
- API versioning: /api/v1/*, health at /health

## Development conventions
- New endpoint: add model (internal/models), add handler (internal/handlers), register route (cmd/api/main.go), add integration tests
- New config: update internal/config/config.go, .env.example, README
- New middleware: internal/middleware and register in main
- Generic libraries go to pkg/, service-specific to internal/

## Quality & testing
- Unit tests for business logic, integration tests for endpoints
- Table-driven tests, mock external deps, aim >80% coverage

## Code style & error handling
- gofmt, clear names, small functions, comments for exported items
- Always check and log errors with context; return appropriate HTTP codes; do not leak internals

## Database
- GORM for all DB ops; use hooks for auditing, transactions for multi-step ops
- AutoMigrate called in cmd/api/main.go; configure DB via env vars

## Common tasks
- Build: task build
- Run: task run / task docker-up
- Tests: task test / task test-unit / task test-integration / task coverage

## Deployment
- Multi-stage Docker build, set SERVER_MODE=production
- Ensure DB config, health checks, and graceful shutdown are set

## Important files to edit first
- cmd/api/main.go (router, middleware, DB, AutoMigrate)
- internal/config/config.go
- internal/handlers/*.go
- pkg/logger/logger.go
- Taskfile.yml, docker-compose.yml

## Do not change without strong reason
- Project structure, error-handling patterns, logging format, DB pooling, graceful shutdown.
