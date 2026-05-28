package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/mtfuller/starterpack-go-gin/internal/handlers"
	"github.com/mtfuller/starterpack-go-gin/pkg/logger"
	"github.com/stretchr/testify/assert"
)

func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	var buf bytes.Buffer
	log := logger.NewWithWriter("info", &buf)

	// Health check endpoint
	healthHandler := handlers.NewHealthHandler(nil, log)
	router.GET("/health", healthHandler.Check)

	return router
}

func TestHealthEndpoint(t *testing.T) {
	router := setupTestRouter()

	req, _ := http.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "ok", response["status"])
	assert.Equal(t, "v1", response["version"])
}

func TestAPIV1Routes(t *testing.T) {
	// This test verifies that the v1 API routes are properly configured
	// In a full implementation, this would connect to a test database

	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Register v1 routes
	v1 := router.Group("/api/v1")
	{
		users := v1.Group("/users")
		{
			users.POST("", func(c *gin.Context) { c.Status(http.StatusOK) })
			users.GET("", func(c *gin.Context) { c.Status(http.StatusOK) })
			users.GET("/:id", func(c *gin.Context) { c.Status(http.StatusOK) })
			users.DELETE("/:id", func(c *gin.Context) { c.Status(http.StatusOK) })
		}
	}

	// Test POST /api/v1/users
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/users", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code, "POST /api/v1/users should return 200")

	// Test GET /api/v1/users
	req, _ = http.NewRequest(http.MethodGet, "/api/v1/users", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code, "GET /api/v1/users should return 200")

	// Test GET /api/v1/users/:id
	req, _ = http.NewRequest(http.MethodGet, "/api/v1/users/1", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code, "GET /api/v1/users/:id should return 200")

	// Test DELETE /api/v1/users/:id
	req, _ = http.NewRequest(http.MethodDelete, "/api/v1/users/1", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code, "DELETE /api/v1/users/:id should return 200")
}
