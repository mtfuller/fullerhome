package unit_test

import (
	"os"
	"testing"

	"github.com/mtfuller/fullerhome/internal/config"
	"github.com/stretchr/testify/assert"
)

func TestConfig_Defaults(t *testing.T) {
	cfg := config.Load()
	assert.Equal(t, "8080", cfg.ServerPort)
	assert.Equal(t, "./fullerhome.db", cfg.DatabasePath)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.Equal(t, "./static", cfg.StaticDir)
}

func TestConfig_EnvOverrides(t *testing.T) {
	t.Setenv("SERVER_PORT", "9090")
	t.Setenv("DATABASE_PATH", "/tmp/test.db")
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("STATIC_DIR", "/tmp/static")

	cfg := config.Load()
	assert.Equal(t, "9090", cfg.ServerPort)
	assert.Equal(t, "/tmp/test.db", cfg.DatabasePath)
	assert.Equal(t, "debug", cfg.LogLevel)
	assert.Equal(t, "/tmp/static", cfg.StaticDir)
}

func TestConfig_PartialOverride(t *testing.T) {
	os.Unsetenv("SERVER_PORT")
	t.Setenv("LOG_LEVEL", "debug")

	cfg := config.Load()
	assert.Equal(t, "8080", cfg.ServerPort)
	assert.Equal(t, "debug", cfg.LogLevel)
}
