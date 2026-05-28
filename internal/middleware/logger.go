package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mtfuller/starterpack-go-gin/pkg/logger"
)

// Logger returns a gin middleware for logging requests
func Logger(log *logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Calculate latency
		latency := time.Since(start)

		// Get status code
		statusCode := c.Writer.Status()

		// Build full path
		if raw != "" {
			path = path + "?" + raw
		}

		// Log request
		fields := map[string]interface{}{
			"status_code": statusCode,
			"latency_ms":  latency.Milliseconds(),
			"method":      c.Request.Method,
			"path":        path,
			"client_ip":   c.ClientIP(),
		}

		if len(c.Errors) > 0 {
			fields["errors"] = c.Errors.String()
			log.WithFields(fields).Error("Request completed with errors")
		} else if statusCode >= 500 {
			log.WithFields(fields).Error("Request completed with server error")
		} else if statusCode >= 400 {
			log.WithFields(fields).Warn("Request completed with client error")
		} else {
			log.WithFields(fields).Info("Request completed")
		}
	}
}
