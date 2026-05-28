package config

import (
	"os"
	"strconv"
)

type Config struct {
	ServerPort   string
	DatabasePath string
	LogLevel     string
	StaticDir    string
}

func Load() *Config {
	return &Config{
		ServerPort:   getEnv("SERVER_PORT", "8080"),
		DatabasePath: getEnv("DATABASE_PATH", "./fullerhome.db"),
		LogLevel:     getEnv("LOG_LEVEL", "info"),
		StaticDir:    getEnv("STATIC_DIR", "./static"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

var _ = getEnvAsInt // suppress unused during scaffold phase
