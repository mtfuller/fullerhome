package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mtfuller/starterpack-go-gin/internal/config"
	"github.com/mtfuller/starterpack-go-gin/internal/database"
	"github.com/mtfuller/starterpack-go-gin/internal/handlers"
	"github.com/mtfuller/starterpack-go-gin/internal/middleware"
	"github.com/mtfuller/starterpack-go-gin/internal/models"
	"github.com/mtfuller/starterpack-go-gin/pkg/logger"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	// Initialize logger
	log := logger.New(cfg.Log.Level)
	log.Info("Starting starterpack-go-gin service")

	// Set Gin mode
	if cfg.Server.Mode == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Connect to database
	db, err := database.New(&cfg.Database, log)
	if err != nil {
		log.WithField("error", err.Error()).Fatal("Failed to connect to database")
	}
	defer db.Close()

	// Auto-migrate database schema
	if err := db.AutoMigrate(&models.User{}); err != nil {
		log.WithField("error", err.Error()).Fatal("Failed to migrate database")
	}
	log.Info("Database migration completed")

	// Initialize handlers
	healthHandler := handlers.NewHealthHandler(db, log)
	userHandler := handlers.NewUserHandler(db, log)

	// Setup router
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.Logger(log))

	// Health check endpoint (not versioned)
	router.GET("/health", healthHandler.Check)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// User endpoints
		users := v1.Group("/users")
		{
			users.POST("", userHandler.Create)
			users.GET("", userHandler.List)
			users.GET("/:id", userHandler.Get)
			users.DELETE("/:id", userHandler.Delete)
		}
	}

	// Create HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.WithField("port", cfg.Server.Port).Info("Server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.WithField("error", err.Error()).Fatal("Server failed to start")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Graceful shutdown with 5 second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.WithField("error", err.Error()).Error("Server forced to shutdown")
	}

	log.Info("Server stopped")
}
