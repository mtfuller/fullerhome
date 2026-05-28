# Examples

This directory contains example code demonstrating how to use various features of the starterpack-go-gin template.

## HTTP Client Usage

The `httpclient_usage.go` file demonstrates how to use the built-in HTTP client for making external API calls.

To run the example:

```bash
go run examples/httpclient_usage.go
```

This example shows:
- Making GET requests
- Making POST requests with JSON body
- Adding custom headers to requests
- Handling responses and errors

## Adding New API Endpoints

To add new API endpoints to your service:

1. **Create a new model** (if needed) in `internal/models/`
2. **Create a new handler** in `internal/handlers/`
3. **Register the routes** in `cmd/api/main.go`
4. **Add tests** in `tests/integration/`

### Example: Adding a Product API

#### 1. Create Model (`internal/models/product.go`)

```go
package models

import (
    "time"
    "gorm.io/gorm"
)

type Product struct {
    ID          uint           `gorm:"primarykey" json:"id"`
    CreatedAt   time.Time      `json:"created_at"`
    UpdatedAt   time.Time      `json:"updated_at"`
    DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
    Name        string         `gorm:"not null" json:"name"`
    Description string         `json:"description"`
    Price       float64        `gorm:"not null" json:"price"`
    Stock       int            `gorm:"default:0" json:"stock"`
}
```

#### 2. Create Handler (`internal/handlers/product.go`)

```go
package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/mtfuller/starterpack-go-gin/internal/database"
    "github.com/mtfuller/starterpack-go-gin/internal/models"
    "github.com/mtfuller/starterpack-go-gin/pkg/logger"
)

type ProductHandler struct {
    db     *database.DB
    logger *logger.Logger
}

func NewProductHandler(db *database.DB, log *logger.Logger) *ProductHandler {
    return &ProductHandler{db: db, logger: log}
}

func (h *ProductHandler) Create(c *gin.Context) {
    var product models.Product
    if err := c.ShouldBindJSON(&product); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    if err := h.db.Create(&product).Error; err != nil {
        h.logger.WithField("error", err.Error()).Error("Failed to create product")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create product"})
        return
    }
    
    c.JSON(http.StatusCreated, product)
}

func (h *ProductHandler) List(c *gin.Context) {
    var products []models.Product
    if err := h.db.Find(&products).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list products"})
        return
    }
    c.JSON(http.StatusOK, products)
}
```

#### 3. Register Routes in `cmd/api/main.go`

```go
// Add to main.go after userHandler initialization
productHandler := handlers.NewProductHandler(db, log)

// Add to v1 route group
products := v1.Group("/products")
{
    products.POST("", productHandler.Create)
    products.GET("", productHandler.List)
    products.GET("/:id", productHandler.Get)
    products.PUT("/:id", productHandler.Update)
    products.DELETE("/:id", productHandler.Delete)
}
```

#### 4. Add migration

```go
// In cmd/api/main.go, add to AutoMigrate call
if err := db.AutoMigrate(&models.User{}, &models.Product{}); err != nil {
    log.WithField("error", err.Error()).Fatal("Failed to migrate database")
}
```

## Using External APIs

The HTTP client package makes it easy to integrate with external services:

```go
import (
    "context"
    "time"
    "github.com/mtfuller/starterpack-go-gin/pkg/httpclient"
    "github.com/mtfuller/starterpack-go-gin/pkg/logger"
)

func callExternalAPI() {
    log := logger.New("info")
    client := httpclient.New(30*time.Second, log)
    
    ctx := context.Background()
    headers := map[string]string{
        "Authorization": "Bearer your-api-key",
    }
    
    body, status, err := client.Get(ctx, "https://api.example.com/data", headers)
    if err != nil {
        // Handle error
        return
    }
    
    // Process response
}
```

## Configuration Examples

### Environment Variables

Create a `.env` file in the project root:

```bash
SERVER_PORT=8080
SERVER_MODE=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=mydb
LOG_LEVEL=debug
```

### Using Config in Code

```go
import "github.com/mtfuller/starterpack-go-gin/internal/config"

cfg, err := config.Load()
if err != nil {
    // Handle error
}

// Access configuration
port := cfg.Server.Port
dbHost := cfg.Database.Host
logLevel := cfg.Log.Level
```

## Testing Examples

### Unit Test Example

```go
func TestMyFunction(t *testing.T) {
    // Setup
    var buf bytes.Buffer
    log := logger.NewWithWriter("info", &buf)
    
    // Test
    result := MyFunction(log)
    
    // Assert
    assert.NotNil(t, result)
}
```

### Integration Test Example

```go
func TestAPIEndpoint(t *testing.T) {
    router := setupTestRouter()
    
    req, _ := http.NewRequest(http.MethodGet, "/api/v1/users", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)
    
    assert.Equal(t, http.StatusOK, w.Code)
}
```
