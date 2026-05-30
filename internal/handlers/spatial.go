package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mtfuller/fullerhome/internal/database"
	"github.com/mtfuller/fullerhome/internal/domain"
)

type HomeMapHandler struct {
	db     *database.DB
	logger *slog.Logger
}

func NewHomeMapHandler(db *database.DB, logger *slog.Logger) *HomeMapHandler {
	return &HomeMapHandler{db: db, logger: logger}
}

// Dashboard serves the root page (GET /).
func (h *HomeMapHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	levels, err := h.queryLevels(r)
	if err != nil {
		h.internalError(w, "list levels", err)
		return
	}
	renderDashboard(w, levels)
}

// HomeMap serves the interactive floor-plan editor (GET /home-map).
func (h *HomeMapHandler) HomeMap(w http.ResponseWriter, r *http.Request) {
	levels, err := h.queryLevels(r)
	if err != nil {
		h.internalError(w, "list levels", err)
		return
	}

	markers, err := h.queryAllMarkers(r)
	if err != nil {
		h.internalError(w, "list markers", err)
		return
	}

	rooms, err := h.queryAllRooms(r)
	if err != nil {
		h.internalError(w, "list rooms", err)
		return
	}

	zones, err := h.queryAllZones(r)
	if err != nil {
		h.internalError(w, "list zones", err)
		return
	}

	renderHomeMap(w, levels, markers, rooms, zones)
}

// ListLevels handles GET /api/v1/levels.
func (h *HomeMapHandler) ListLevels(w http.ResponseWriter, r *http.Request) {
	levels, err := h.queryLevels(r)
	if err != nil {
		h.internalError(w, "list levels", err)
		return
	}
	writeJSON(w, http.StatusOK, levels)
}

// CreateLevel handles POST /api/v1/levels.
func (h *HomeMapHandler) CreateLevel(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateLevelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT COALESCE(MAX(order_index), -1) FROM spatial_levels`)
	if err != nil {
		h.internalError(w, "get max order_index", err)
		return
	}
	var maxOrder int
	for rows.Next() {
		rows.Scan(&maxOrder)
	}
	rows.Close()

	level := domain.HomeLevel{
		ID:         uuid.New(),
		Name:       req.Name,
		Type:       req.Type,
		OrderIndex: maxOrder + 1,
		WallsJSON:  "[]",
		CreatedBy:  req.CreatedBy,
		UpdatedAt:  time.Now(),
	}

	_, err = h.db.ExecContext(r.Context(),
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

// UpdateLevel handles PUT /api/v1/levels/{levelID}.
func (h *HomeMapHandler) UpdateLevel(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "levelID")

	var req domain.UpdateLevelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.WallsJSON == "" {
		req.WallsJSON = "[]"
	}

	now := time.Now()
	res, err := h.db.ExecContext(r.Context(),
		`UPDATE spatial_levels SET name=?, type=?, walls_json=?, map_config_json=?, updated_at=? WHERE id=?`,
		req.Name, string(req.Type), req.WallsJSON, req.MapConfigJSON, now, levelID,
	)
	if err != nil {
		h.internalError(w, "update level", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "level not found")
		return
	}

	level, err := h.queryLevel(r, levelID)
	if err != nil {
		h.internalError(w, "fetch updated level", err)
		return
	}
	writeJSON(w, http.StatusOK, level)
}

// DeleteLevel handles DELETE /api/v1/levels/{levelID}.
func (h *HomeMapHandler) DeleteLevel(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "levelID")

	res, err := h.db.ExecContext(r.Context(), `DELETE FROM spatial_levels WHERE id=?`, levelID)
	if err != nil {
		h.internalError(w, "delete level", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "level not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListMarkers handles GET /api/v1/levels/{levelID}/markers.
func (h *HomeMapHandler) ListMarkers(w http.ResponseWriter, r *http.Request) {
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
func (h *HomeMapHandler) CreateMarker(w http.ResponseWriter, r *http.Request) {
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

// UpdateMarker handles PUT /api/v1/levels/{levelID}/markers/{markerID}.
func (h *HomeMapHandler) UpdateMarker(w http.ResponseWriter, r *http.Request) {
	markerID := chi.URLParam(r, "markerID")

	var req domain.UpdateMarkerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	now := time.Now()
	res, err := h.db.ExecContext(r.Context(),
		`UPDATE asset_markers SET label=?, category=?, x_coordinate=?, y_coordinate=?, notes=?, updated_at=? WHERE id=?`,
		req.Label, string(req.Category), req.XCoordinate, req.YCoordinate, req.Notes, now, markerID,
	)
	if err != nil {
		h.internalError(w, "update marker", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "marker not found")
		return
	}

	var m domain.AssetMarker
	var id, levelIDStr string
	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, level_id, label, category, x_coordinate, y_coordinate, notes, updated_at FROM asset_markers WHERE id=?`,
		markerID,
	).Scan(&id, &levelIDStr, &m.Label, &m.Category, &m.XCoordinate, &m.YCoordinate, &m.Notes, &m.UpdatedAt)
	if err != nil {
		h.internalError(w, "fetch updated marker", err)
		return
	}
	m.ID = uuid.MustParse(id)
	m.LevelID = uuid.MustParse(levelIDStr)
	writeJSON(w, http.StatusOK, m)
}

// DeleteMarker handles DELETE /api/v1/levels/{levelID}/markers/{markerID}.
func (h *HomeMapHandler) DeleteMarker(w http.ResponseWriter, r *http.Request) {
	markerID := chi.URLParam(r, "markerID")

	res, err := h.db.ExecContext(r.Context(), `DELETE FROM asset_markers WHERE id=?`, markerID)
	if err != nil {
		h.internalError(w, "delete marker", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "marker not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListRooms handles GET /api/v1/levels/{levelID}/rooms.
func (h *HomeMapHandler) ListRooms(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "levelID")

	rooms, err := h.queryRoomsForLevel(r, levelID)
	if err != nil {
		h.internalError(w, "list rooms", err)
		return
	}
	writeJSON(w, http.StatusOK, rooms)
}

// CreateRoom handles POST /api/v1/levels/{levelID}/rooms.
func (h *HomeMapHandler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "levelID")

	var req domain.CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	room := domain.Room{
		ID:          uuid.New(),
		LevelID:     uuid.MustParse(levelID),
		Name:        req.Name,
		XCoordinate: req.XCoordinate,
		YCoordinate: req.YCoordinate,
		UpdatedAt:   time.Now(),
	}

	_, err := h.db.ExecContext(r.Context(),
		`INSERT INTO rooms (id, level_id, name, x_coordinate, y_coordinate, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		room.ID.String(), room.LevelID.String(), room.Name,
		room.XCoordinate, room.YCoordinate, room.UpdatedAt,
	)
	if err != nil {
		h.internalError(w, "create room", err)
		return
	}

	h.logger.Info("room created", "id", room.ID, "name", room.Name)
	writeJSON(w, http.StatusCreated, room)
}

// UpdateRoom handles PUT /api/v1/levels/{levelID}/rooms/{roomID}.
func (h *HomeMapHandler) UpdateRoom(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "roomID")

	var req domain.UpdateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	now := time.Now()
	res, err := h.db.ExecContext(r.Context(),
		`UPDATE rooms SET name=?, x_coordinate=?, y_coordinate=?, updated_at=? WHERE id=?`,
		req.Name, req.XCoordinate, req.YCoordinate, now, roomID,
	)
	if err != nil {
		h.internalError(w, "update room", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "room not found")
		return
	}

	var room domain.Room
	var id, levelIDStr string
	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, level_id, name, x_coordinate, y_coordinate, updated_at FROM rooms WHERE id=?`,
		roomID,
	).Scan(&id, &levelIDStr, &room.Name, &room.XCoordinate, &room.YCoordinate, &room.UpdatedAt)
	if err != nil {
		h.internalError(w, "fetch updated room", err)
		return
	}
	room.ID = uuid.MustParse(id)
	room.LevelID = uuid.MustParse(levelIDStr)
	writeJSON(w, http.StatusOK, room)
}

// DeleteRoom handles DELETE /api/v1/levels/{levelID}/rooms/{roomID}.
func (h *HomeMapHandler) DeleteRoom(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "roomID")

	res, err := h.db.ExecContext(r.Context(), `DELETE FROM rooms WHERE id=?`, roomID)
	if err != nil {
		h.internalError(w, "delete room", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "room not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListZones handles GET /api/v1/levels/{levelID}/zones.
func (h *HomeMapHandler) ListZones(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "levelID")
	zones, err := h.queryZonesForLevel(r, levelID)
	if err != nil {
		h.internalError(w, "list zones", err)
		return
	}
	writeJSON(w, http.StatusOK, zones)
}

// CreateZone handles POST /api/v1/levels/{levelID}/zones.
func (h *HomeMapHandler) CreateZone(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "levelID")

	var req domain.CreateZoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.PointsJSON == "" {
		req.PointsJSON = "[]"
	}

	zone := domain.Zone{
		ID:         uuid.New(),
		LevelID:    uuid.MustParse(levelID),
		Name:       req.Name,
		Type:       req.Type,
		PointsJSON: req.PointsJSON,
		UpdatedAt:  time.Now(),
	}

	_, err := h.db.ExecContext(r.Context(),
		`INSERT INTO spatial_zones (id, level_id, name, type, points_json, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		zone.ID.String(), zone.LevelID.String(), zone.Name, string(zone.Type), zone.PointsJSON, zone.UpdatedAt,
	)
	if err != nil {
		h.internalError(w, "create zone", err)
		return
	}

	h.logger.Info("zone created", "id", zone.ID, "type", zone.Type)
	writeJSON(w, http.StatusCreated, zone)
}

// UpdateZone handles PUT /api/v1/levels/{levelID}/zones/{zoneID}.
func (h *HomeMapHandler) UpdateZone(w http.ResponseWriter, r *http.Request) {
	zoneID := chi.URLParam(r, "zoneID")

	var req domain.UpdateZoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.PointsJSON == "" {
		req.PointsJSON = "[]"
	}

	now := time.Now()
	res, err := h.db.ExecContext(r.Context(),
		`UPDATE spatial_zones SET name=?, type=?, points_json=?, updated_at=? WHERE id=?`,
		req.Name, string(req.Type), req.PointsJSON, now, zoneID,
	)
	if err != nil {
		h.internalError(w, "update zone", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "zone not found")
		return
	}

	var z domain.Zone
	var id, levelIDStr string
	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, level_id, name, type, points_json, updated_at FROM spatial_zones WHERE id=?`,
		zoneID,
	).Scan(&id, &levelIDStr, &z.Name, &z.Type, &z.PointsJSON, &z.UpdatedAt)
	if err != nil {
		h.internalError(w, "fetch updated zone", err)
		return
	}
	z.ID = uuid.MustParse(id)
	z.LevelID = uuid.MustParse(levelIDStr)
	writeJSON(w, http.StatusOK, z)
}

// DeleteZone handles DELETE /api/v1/levels/{levelID}/zones/{zoneID}.
func (h *HomeMapHandler) DeleteZone(w http.ResponseWriter, r *http.Request) {
	zoneID := chi.URLParam(r, "zoneID")

	res, err := h.db.ExecContext(r.Context(), `DELETE FROM spatial_zones WHERE id=?`, zoneID)
	if err != nil {
		h.internalError(w, "delete zone", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "zone not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Geocode handles GET /api/v1/geocode?q={address} — proxies Nominatim so the
// browser doesn't need a CORS workaround and we can set a proper User-Agent.
func (h *HomeMapHandler) Geocode(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeError(w, http.StatusBadRequest, "q parameter required")
		return
	}

	nominatimURL := "https://nominatim.openstreetmap.org/search?q=" + url.QueryEscape(q) + "&format=json&limit=1"
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, nominatimURL, nil)
	if err != nil {
		h.internalError(w, "geocode build request", err)
		return
	}
	req.Header.Set("User-Agent", "FullerHome/1.0 (household-management; contact: admin@fullerhome.local)")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		h.internalError(w, "geocode fetch", err)
		return
	}
	defer resp.Body.Close()

	var results []struct {
		Lat         string `json:"lat"`
		Lon         string `json:"lon"`
		DisplayName string `json:"display_name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		h.internalError(w, "geocode parse", err)
		return
	}
	if len(results) == 0 {
		writeError(w, http.StatusNotFound, "address not found")
		return
	}

	lat, _ := strconv.ParseFloat(results[0].Lat, 64)
	lon, _ := strconv.ParseFloat(results[0].Lon, 64)
	writeJSON(w, http.StatusOK, map[string]any{
		"lat":          lat,
		"lon":          lon,
		"display_name": results[0].DisplayName,
	})
}

// --- helpers ---

func (h *HomeMapHandler) queryLevels(r *http.Request) ([]domain.HomeLevel, error) {
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, name, type, order_index, walls_json, map_config_json, created_by, updated_at
		 FROM spatial_levels ORDER BY order_index ASC`)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []domain.HomeLevel{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	levels := []domain.HomeLevel{}
	for rows.Next() {
		var l domain.HomeLevel
		var id string
		if err := rows.Scan(&id, &l.Name, &l.Type, &l.OrderIndex, &l.WallsJSON, &l.MapConfigJSON, &l.CreatedBy, &l.UpdatedAt); err != nil {
			return nil, err
		}
		l.ID = uuid.MustParse(id)
		levels = append(levels, l)
	}
	return levels, nil
}

func (h *HomeMapHandler) queryLevel(r *http.Request, levelID string) (domain.HomeLevel, error) {
	var l domain.HomeLevel
	var id string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, name, type, order_index, walls_json, map_config_json, created_by, updated_at FROM spatial_levels WHERE id=?`,
		levelID,
	).Scan(&id, &l.Name, &l.Type, &l.OrderIndex, &l.WallsJSON, &l.MapConfigJSON, &l.CreatedBy, &l.UpdatedAt)
	if err != nil {
		return l, err
	}
	l.ID = uuid.MustParse(id)
	return l, nil
}

func (h *HomeMapHandler) queryAllMarkers(r *http.Request) ([]domain.AssetMarker, error) {
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, level_id, label, category, x_coordinate, y_coordinate, notes, updated_at FROM asset_markers`)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []domain.AssetMarker{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	markers := []domain.AssetMarker{}
	for rows.Next() {
		var m domain.AssetMarker
		var id, levelIDStr string
		if err := rows.Scan(&id, &levelIDStr, &m.Label, &m.Category,
			&m.XCoordinate, &m.YCoordinate, &m.Notes, &m.UpdatedAt); err != nil {
			return nil, err
		}
		m.ID = uuid.MustParse(id)
		m.LevelID = uuid.MustParse(levelIDStr)
		markers = append(markers, m)
	}
	return markers, nil
}

func (h *HomeMapHandler) queryAllRooms(r *http.Request) ([]domain.Room, error) {
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, level_id, name, x_coordinate, y_coordinate, updated_at FROM rooms`)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []domain.Room{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	rooms := []domain.Room{}
	for rows.Next() {
		var room domain.Room
		var id, levelIDStr string
		if err := rows.Scan(&id, &levelIDStr, &room.Name,
			&room.XCoordinate, &room.YCoordinate, &room.UpdatedAt); err != nil {
			return nil, err
		}
		room.ID = uuid.MustParse(id)
		room.LevelID = uuid.MustParse(levelIDStr)
		rooms = append(rooms, room)
	}
	return rooms, nil
}

func (h *HomeMapHandler) queryRoomsForLevel(r *http.Request, levelID string) ([]domain.Room, error) {
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, level_id, name, x_coordinate, y_coordinate, updated_at FROM rooms WHERE level_id=?`, levelID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []domain.Room{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	rooms := []domain.Room{}
	for rows.Next() {
		var room domain.Room
		var id, levelIDStr string
		if err := rows.Scan(&id, &levelIDStr, &room.Name,
			&room.XCoordinate, &room.YCoordinate, &room.UpdatedAt); err != nil {
			return nil, err
		}
		room.ID = uuid.MustParse(id)
		room.LevelID = uuid.MustParse(levelIDStr)
		rooms = append(rooms, room)
	}
	return rooms, nil
}

func (h *HomeMapHandler) queryAllZones(r *http.Request) ([]domain.Zone, error) {
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, level_id, name, type, points_json, updated_at FROM spatial_zones`)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []domain.Zone{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	zones := []domain.Zone{}
	for rows.Next() {
		var z domain.Zone
		var id, levelIDStr string
		if err := rows.Scan(&id, &levelIDStr, &z.Name, &z.Type, &z.PointsJSON, &z.UpdatedAt); err != nil {
			return nil, err
		}
		z.ID = uuid.MustParse(id)
		z.LevelID = uuid.MustParse(levelIDStr)
		zones = append(zones, z)
	}
	return zones, nil
}

func (h *HomeMapHandler) queryZonesForLevel(r *http.Request, levelID string) ([]domain.Zone, error) {
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, level_id, name, type, points_json, updated_at FROM spatial_zones WHERE level_id=?`, levelID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []domain.Zone{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	zones := []domain.Zone{}
	for rows.Next() {
		var z domain.Zone
		var id, levelIDStr string
		if err := rows.Scan(&id, &levelIDStr, &z.Name, &z.Type, &z.PointsJSON, &z.UpdatedAt); err != nil {
			return nil, err
		}
		z.ID = uuid.MustParse(id)
		z.LevelID = uuid.MustParse(levelIDStr)
		zones = append(zones, z)
	}
	return zones, nil
}

// ListMarkerEvents handles GET /api/v1/levels/:levelID/markers/:markerID/events.
func (h *HomeMapHandler) ListMarkerEvents(w http.ResponseWriter, r *http.Request) {
	markerID, err := uuid.Parse(chi.URLParam(r, "markerID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid markerID")
		return
	}
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, marker_id, event_type, note, created_at
		FROM marker_events WHERE marker_id = ? ORDER BY created_at DESC`, markerID.String())
	if err != nil {
		h.internalError(w, "list events", err)
		return
	}
	defer rows.Close()
	events := []domain.MarkerEvent{}
	for rows.Next() {
		var e domain.MarkerEvent
		var midStr, evtType string
		if err := rows.Scan(&e.ID, &midStr, &evtType, &e.Note, &e.CreatedAt); err != nil {
			h.internalError(w, "scan event", err)
			return
		}
		e.MarkerID = uuid.MustParse(midStr)
		e.EventType = domain.EventType(evtType)
		events = append(events, e)
	}
	writeJSON(w, http.StatusOK, events)
}

// CreateMarkerEvent handles POST /api/v1/levels/:levelID/markers/:markerID/events.
func (h *HomeMapHandler) CreateMarkerEvent(w http.ResponseWriter, r *http.Request) {
	markerID, err := uuid.Parse(chi.URLParam(r, "markerID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid markerID")
		return
	}
	var req domain.CreateMarkerEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.EventType == "" {
		req.EventType = domain.EventNote
	}
	now := time.Now().UTC()
	res, err := h.db.ExecContext(r.Context(),
		`INSERT INTO marker_events (marker_id, event_type, note, created_at) VALUES (?, ?, ?, ?)`,
		markerID.String(), string(req.EventType), req.Note, now)
	if err != nil {
		h.internalError(w, "create event", err)
		return
	}
	id, _ := res.LastInsertId()
	writeJSON(w, http.StatusCreated, domain.MarkerEvent{
		ID:        id,
		MarkerID:  markerID,
		EventType: req.EventType,
		Note:      req.Note,
		CreatedAt: now,
	})
}

func (h *HomeMapHandler) internalError(w http.ResponseWriter, op string, err error) {
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
