---
applyTo: "cmd/api/main.go,pkg/handlers/**/*.go"
---

# API Development Guide

## Principles
- RESTful verbs: GET (safe), POST (create), PUT (replace), PATCH (partial), DELETE (remove).
- Base path: /api/v1; health at /health.
- Keep handlers: parse → business → respond. Use env-driven config, JSON structured logs, and GORM for DB ops.

## URLs
- /api/v1/resources
- /api/v1/resources/:id
- /api/v1/resources/:id/sub

## Common status codes
- 2xx: 200 OK, 201 Created, 204 No Content  
- 4xx: 400, 401, 403, 404, 409, 422  
- 5xx: 500, 503

## Add a new endpoint — quick steps

1. Define model (internal/models)
```go
type Product struct {
    ID uint `gorm:"primarykey" json:"id"`
    CreatedAt time.Time `json:"created_at"`
    Name string `gorm:"not null" json:"name"`
    Price float64 `gorm:"not null" json:"price"`
    SKU string `gorm:"uniqueIndex" json:"sku"`
}
```

2. Create DTOs (handler file or types.go)
```go
type CreateProductRequest struct {
    Name string `json:"name" binding:"required"`
    Price float64 `json:"price" binding:"required,gt=0"`
    SKU string `json:"sku" binding:"required"`
}
type ProductResponse struct { ID uint `json:"id"`; Name string `json:"name"`; Price float64 `json:"price"` }
```

3. Implement handler (internal/handlers)
- Handler struct: holds db and logger.
- Follow pattern: bind → validate → DB → log → respond.
```go
func (h *ProductHandler) Create(c *gin.Context) {
    var req CreateProductRequest
    if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
    p := models.Product{ Name: req.Name, Price: req.Price, SKU: req.SKU }
    if err := h.db.Create(&p).Error; err != nil { h.logger.WithError(err).Error("create"); c.JSON(500, gin.H{"error":"failed"}); return }
    c.JSON(201, p)
}
```

4. Register routes (cmd/api/main.go)
```go
v1 := router.Group("/api/v1")
products := v1.Group("/products")
products.POST("", productHandler.Create)
products.GET("", productHandler.List)
products.GET("/:id", productHandler.Get)
products.PUT("/:id", productHandler.Update)
products.DELETE("/:id", productHandler.Delete)
```

5. Migration (cmd/api/main.go)
```go
if err := db.AutoMigrate(&models.Product{}, &models.User{}); err != nil { log.WithError(err).Fatal("migrate") }
```

6. Tests
- Unit test business logic; integration tests for handlers (tests/integration).
- Example: create request against router in gin.TestMode and assert HTTP status and DB state.

## Features (patterns)

Pagination
```go
type Pagination struct { Page int `form:"page"`; PerPage int `form:"per_page"` }
offset := (page-1)*perPage
db.Offset(offset).Limit(perPage).Find(&items)
```

Filtering
```go
if s := c.Query("status"); s!="" { query = query.Where("status = ?", s) }
if min := c.Query("min_price"); min!="" { query = query.Where("price >= ?", min) }
```

Sorting
```go
sortBy := c.DefaultQuery("sort_by","created_at"); order := c.DefaultQuery("order","desc")
db.Order(fmt.Sprintf("%s %s", sortBy, order)).Find(&items)
```

## Docs
- Update README.md (endpoint path, request/response, query params).
- Keep DTOs separate from models and map models → responses in handlers.

## Conventions to follow
- Structure: cmd/ (app), internal/ (service), pkg/ (reusable).
- Logging: JSON, contextual fields, appropriate levels.
- Error handling: log with context, return appropriate HTTP codes, avoid leaking internals.
- Tests: table-driven, mock externals, aim >80% coverage.

Use these concise patterns when adding endpoints to keep code consistent and production-ready.
