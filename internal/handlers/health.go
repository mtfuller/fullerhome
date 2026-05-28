package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mtfuller/starterpack-go-gin/internal/database"
	"github.com/mtfuller/starterpack-go-gin/pkg/logger"
)

// HealthHandler handles health check requests
type HealthHandler struct {
	db     *database.DB
	logger *logger.Logger
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(db *database.DB, log *logger.Logger) *HealthHandler {
	return &HealthHandler{
		db:     db,
		logger: log,
	}
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Version  string `json:"version"`
}

// Check handles the health check endpoint
func (h *HealthHandler) Check(c *gin.Context) {
	response := HealthResponse{
		Status:   "ok",
		Database: "disconnected",
		Version:  "v1",
	}

	// Check database connection
	if h.db != nil {
		if err := h.db.Ping(); err != nil {
			h.logger.WithField("error", err.Error()).Error("Database health check failed")
			response.Database = "error"
		} else {
			response.Database = "connected"
		}
	}

	statusCode := http.StatusOK
	if response.Database == "error" {
		statusCode = http.StatusServiceUnavailable
		response.Status = "degraded"
	}

	c.JSON(statusCode, response)
}
