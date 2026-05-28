package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/mtfuller/fullerhome/internal/database"
)

type HealthHandler struct {
	db *database.DB
}

func NewHealthHandler(db *database.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

type healthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Version  string `json:"version"`
}

func (h *HealthHandler) Check(w http.ResponseWriter, r *http.Request) {
	resp := healthResponse{
		Status:   "ok",
		Database: "connected",
		Version:  "v1",
	}

	if err := h.db.Ping(); err != nil {
		resp.Status = "degraded"
		resp.Database = "error"
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
