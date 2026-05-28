package unit

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/mtfuller/starterpack-go-gin/pkg/logger"
	"github.com/stretchr/testify/assert"
)

func TestNewLogger(t *testing.T) {
	log := logger.New("info")
	assert.NotNil(t, log)
}

func TestLoggerWithWriter(t *testing.T) {
	var buf bytes.Buffer
	log := logger.NewWithWriter("info", &buf)

	log.Info("test message")

	// Parse the JSON log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	assert.NoError(t, err)
	assert.Equal(t, "test message", logEntry["msg"])
	assert.Equal(t, "info", logEntry["level"])
}

func TestLoggerWithFields(t *testing.T) {
	var buf bytes.Buffer
	log := logger.NewWithWriter("debug", &buf)

	log.WithFields(map[string]interface{}{
		"user_id": 123,
		"action":  "login",
	}).Info("user action")

	// Parse the JSON log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	assert.NoError(t, err)
	assert.Equal(t, "user action", logEntry["msg"])
	assert.Equal(t, float64(123), logEntry["user_id"])
	assert.Equal(t, "login", logEntry["action"])
}

func TestLoggerLevels(t *testing.T) {
	tests := []struct {
		level         string
		shouldLogInfo bool
	}{
		{"debug", true},
		{"info", true},
		{"warn", false},
		{"error", false},
	}

	for _, tt := range tests {
		t.Run(tt.level, func(t *testing.T) {
			var buf bytes.Buffer
			log := logger.NewWithWriter(tt.level, &buf)

			log.Info("info message")

			if tt.shouldLogInfo {
				assert.Greater(t, buf.Len(), 0, "Expected log output for level %s", tt.level)
			} else {
				assert.Equal(t, 0, buf.Len(), "Expected no log output for level %s", tt.level)
			}
		})
	}
}
