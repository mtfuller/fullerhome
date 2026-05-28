---
applyTo: "**/*.go"
---

# Coding Standards — Starterpack Go-Gin (Concise)

## Style & Naming
- Packages: lowercase, single word (config, handlers, models).  
- Files: lowercase with underscores (user_handler.go).  
- Functions: Exported CamelCase, unexported camelCase.  
- Vars: descriptive; common short names ok (db, ctx, req).  
- Constants: CamelCase or UPPER_SNAKE_CASE.

## File layout
Order: package → imports (stdlib, external, internal) → constants → types → constructors → methods → helpers.

Example:
```go
package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/mtfuller/starterpack-go-gin/internal/database"
    "github.com/mtfuller/starterpack-go-gin/pkg/logger"
)
```

## Errors
- Always check errors and add context: fmt.Errorf("...: %w", err).  
- Log errors with context; return appropriate HTTP codes.  
- For client input errors use 4xx; for server failures use 5xx.

## Logging
- Structured JSON logs with contextual fields (use Logrus wrapper).  
- Levels: Debug, Info, Warn, Error.  
- Log entry/exit of important ops and include IDs/trace.

## Database (GORM)
- Always check db errors; handle gorm.ErrRecordNotFound.  
- Use transactions for multi-step ops.  
- Use Preload to avoid N+1 queries.  
- Call AutoMigrate in cmd/api/main.go; configure via env.

## HTTP Handlers (pattern)
1. Parse & validate input (c.ShouldBindJSON).  
2. Execute business logic (use injected services).  
3. Respond with proper status + body.  

Example:
```go
func (h *Handler) Create(c *gin.Context) {
    var req CreateReq
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
    }
    res, err := h.create(req)
    if err != nil {
        h.logger.WithField("error", err.Error()).Error("create failed")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Operation failed"}); return
    }
    c.JSON(http.StatusOK, res)
}
```

## Config & Middleware
- Add config fields in internal/config/config.go and .env.example; use getEnv helpers.  
- Middleware: return gin.HandlerFunc, register globally with router.Use(...) or per-route groups.

## Review Checklist
- [ ] Tests pass  
- [ ] No hardcoded values (use config)  
- [ ] Errors logged with context  
- [ ] Correct HTTP status codes  
- [ ] Input validated  
- [ ] gofmt applied  
- [ ] No sensitive data in logs  
- [ ] Exported functions commented  
- [ ] README and .env.example updated if needed

## Patterns
- Inject dependencies (db, logger) into handlers; avoid globals.  
- Define interfaces in consumer packages (e.g., handlers).  
- Propagate context through call chain (context.Context).

This preserves the project's conventions (Gin, GORM, Logrus) and focuses on clear, testable, and secure code.
