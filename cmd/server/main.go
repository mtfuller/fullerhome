package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/mtfuller/fullerhome/internal/config"
	"github.com/mtfuller/fullerhome/internal/database"
	"github.com/mtfuller/fullerhome/internal/handlers"
)

func main() {
	cfg := config.Load()

	logLevel := slog.LevelInfo
	if cfg.LogLevel == "debug" {
		logLevel = slog.LevelDebug
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel}))
	slog.SetDefault(logger)

	db, err := database.Open(cfg.DatabasePath)
	if err != nil {
		logger.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := database.Migrate(db); err != nil {
		logger.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir(cfg.StaticDir))))

	health := handlers.NewHealthHandler(db)
	homeMap := handlers.NewHomeMapHandler(db, logger)
	electrical := handlers.NewElectricalHandler(db, logger)

	r.Get("/health", health.Check)
	r.Get("/", homeMap.Dashboard)
	r.Get("/home-map", homeMap.HomeMap)
	r.Get("/electrical", electrical.ElectricalPage)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/geocode", homeMap.Geocode)

		r.Get("/levels", homeMap.ListLevels)
		r.Post("/levels", homeMap.CreateLevel)
		r.Put("/levels/{levelID}", homeMap.UpdateLevel)
		r.Delete("/levels/{levelID}", homeMap.DeleteLevel)

		r.Get("/levels/{levelID}/markers", homeMap.ListMarkers)
		r.Post("/levels/{levelID}/markers", homeMap.CreateMarker)
		r.Put("/levels/{levelID}/markers/{markerID}", homeMap.UpdateMarker)
		r.Delete("/levels/{levelID}/markers/{markerID}", homeMap.DeleteMarker)
		r.Get("/levels/{levelID}/markers/{markerID}/events", homeMap.ListMarkerEvents)
		r.Post("/levels/{levelID}/markers/{markerID}/events", homeMap.CreateMarkerEvent)

		r.Get("/levels/{levelID}/rooms", homeMap.ListRooms)
		r.Post("/levels/{levelID}/rooms", homeMap.CreateRoom)
		r.Put("/levels/{levelID}/rooms/{roomID}", homeMap.UpdateRoom)
		r.Delete("/levels/{levelID}/rooms/{roomID}", homeMap.DeleteRoom)

		r.Get("/levels/{levelID}/zones", homeMap.ListZones)
		r.Post("/levels/{levelID}/zones", homeMap.CreateZone)
		r.Put("/levels/{levelID}/zones/{zoneID}", homeMap.UpdateZone)
		r.Delete("/levels/{levelID}/zones/{zoneID}", homeMap.DeleteZone)

		r.Get("/breaker-panels", electrical.ListPanels)
		r.Post("/breaker-panels", electrical.CreatePanel)
		r.Get("/breaker-panels/{panelID}", electrical.GetPanel)
		r.Put("/breaker-panels/{panelID}", electrical.UpdatePanel)
		r.Delete("/breaker-panels/{panelID}", electrical.DeletePanel)

		r.Get("/breaker-panels/{panelID}/circuits", electrical.ListCircuits)
		r.Post("/breaker-panels/{panelID}/circuits", electrical.CreateCircuit)
		r.Put("/circuits/{circuitID}", electrical.UpdateCircuit)
		r.Delete("/circuits/{circuitID}", electrical.DeleteCircuit)

		r.Get("/circuits/{circuitID}/connections", electrical.ListConnections)
		r.Post("/circuits/{circuitID}/connections", electrical.CreateConnection)
		r.Delete("/circuit-connections/{connectionID}", electrical.DeleteConnection)
	})

	srv := &http.Server{
		Addr:         ":" + cfg.ServerPort,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("starting server", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	logger.Info("shutting down server")
	srv.Shutdown(ctx)
}
