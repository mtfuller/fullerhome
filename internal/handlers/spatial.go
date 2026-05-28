package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mtfuller/fullerhome/internal/database"
	"github.com/mtfuller/fullerhome/internal/domain"
)

type SpatialHandler struct {
	db     *database.DB
	logger *slog.Logger
}

func NewSpatialHandler(db *database.DB, logger *slog.Logger) *SpatialHandler {
	return &SpatialHandler{db: db, logger: logger}
}

// Dashboard serves the root page (GET /).
func (h *SpatialHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	levels, err := h.queryLevels(r)
	if err != nil {
		h.internalError(w, "list levels", err)
		return
	}
	// TODO: replace with templ component after running `task gen`
	renderDashboard(w, levels)
}

// SpatialMap serves the interactive floor-plan view (GET /spatial).
func (h *SpatialHandler) SpatialMap(w http.ResponseWriter, r *http.Request) {
	levels, err := h.queryLevels(r)
	if err != nil {
		h.internalError(w, "list levels", err)
		return
	}
	// TODO: replace with templ component after running `task gen`
	renderSpatialMap(w, levels)
}

// ListLevels handles GET /api/v1/levels.
func (h *SpatialHandler) ListLevels(w http.ResponseWriter, r *http.Request) {
	levels, err := h.queryLevels(r)
	if err != nil {
		h.internalError(w, "list levels", err)
		return
	}
	writeJSON(w, http.StatusOK, levels)
}

// CreateLevel handles POST /api/v1/levels.
func (h *SpatialHandler) CreateLevel(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateLevelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	level := domain.SpatialLevel{
		ID:        uuid.New(),
		Name:      req.Name,
		Type:      req.Type,
		WallsJSON: req.WallsJSON,
		CreatedBy: req.CreatedBy,
		UpdatedAt: time.Now(),
	}
	if level.WallsJSON == "" {
		level.WallsJSON = "[]"
	}

	_, err := h.db.ExecContext(r.Context(),
		`INSERT INTO spatial_levels (id, name, type, order_index, walls_json, created_by, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		level.ID.String(), level.Name, string(level.Type), level.OrderIndex,
		level.WallsJSON, level.CreatedBy, level.UpdatedAt,
	)
	if err != nil {
		h.internalError(w, "create level", err)
		return
	}

	h.logger.Info("level created", "id", level.ID, "name", level.Name)
	writeJSON(w, http.StatusCreated, level)
}

// ListMarkers handles GET /api/v1/levels/{levelID}/markers.
func (h *SpatialHandler) ListMarkers(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "levelID")

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, level_id, label, category, x_coordinate, y_coordinate, notes, updated_at
		 FROM asset_markers WHERE level_id = ?`, levelID)
	if err != nil {
		h.internalError(w, "list markers", err)
		return
	}
	defer rows.Close()

	markers := []domain.AssetMarker{}
	for rows.Next() {
		var m domain.AssetMarker
		var id, levelIDStr string
		if err := rows.Scan(&id, &levelIDStr, &m.Label, &m.Category,
			&m.XCoordinate, &m.YCoordinate, &m.Notes, &m.UpdatedAt); err != nil {
			h.internalError(w, "scan marker", err)
			return
		}
		m.ID = uuid.MustParse(id)
		m.LevelID = uuid.MustParse(levelIDStr)
		markers = append(markers, m)
	}

	writeJSON(w, http.StatusOK, markers)
}

// CreateMarker handles POST /api/v1/levels/{levelID}/markers.
func (h *SpatialHandler) CreateMarker(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "levelID")

	var req domain.CreateMarkerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	marker := domain.AssetMarker{
		ID:          uuid.New(),
		LevelID:     uuid.MustParse(levelID),
		Label:       req.Label,
		Category:    req.Category,
		XCoordinate: req.XCoordinate,
		YCoordinate: req.YCoordinate,
		Notes:       req.Notes,
		UpdatedAt:   time.Now(),
	}

	_, err := h.db.ExecContext(r.Context(),
		`INSERT INTO asset_markers (id, level_id, label, category, x_coordinate, y_coordinate, notes, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		marker.ID.String(), marker.LevelID.String(), marker.Label, string(marker.Category),
		marker.XCoordinate, marker.YCoordinate, marker.Notes, marker.UpdatedAt,
	)
	if err != nil {
		h.internalError(w, "create marker", err)
		return
	}

	h.logger.Info("marker created", "id", marker.ID, "label", marker.Label)
	writeJSON(w, http.StatusCreated, marker)
}

// --- helpers ---

func (h *SpatialHandler) queryLevels(r *http.Request) ([]domain.SpatialLevel, error) {
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, name, type, order_index, walls_json, created_by, updated_at
		 FROM spatial_levels ORDER BY order_index ASC`)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []domain.SpatialLevel{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	levels := []domain.SpatialLevel{}
	for rows.Next() {
		var l domain.SpatialLevel
		var id string
		if err := rows.Scan(&id, &l.Name, &l.Type, &l.OrderIndex, &l.WallsJSON, &l.CreatedBy, &l.UpdatedAt); err != nil {
			return nil, err
		}
		l.ID = uuid.MustParse(id)
		levels = append(levels, l)
	}
	return levels, nil
}

func (h *SpatialHandler) internalError(w http.ResponseWriter, op string, err error) {
	h.logger.Error("handler error", "op", op, "error", err)
	writeError(w, http.StatusInternalServerError, "internal server error")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
