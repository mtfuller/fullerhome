package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"html/template"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mtfuller/fullerhome/internal/database"
	"github.com/mtfuller/fullerhome/internal/domain"
)

type ElectricalHandler struct {
	db     *database.DB
	logger *slog.Logger
}

func NewElectricalHandler(db *database.DB, logger *slog.Logger) *ElectricalHandler {
	return &ElectricalHandler{db: db, logger: logger}
}

// ElectricalPage serves GET /electrical — the breaker panel editor UI.
func (h *ElectricalHandler) ElectricalPage(w http.ResponseWriter, r *http.Request) {
	panels, err := h.queryAllPanels(r)
	if err != nil {
		h.internalError(w, "list panels", err)
		return
	}
	markers, err := h.queryConnectableMarkers(r)
	if err != nil {
		h.internalError(w, "list markers", err)
		return
	}
	renderElectrical(w, panels, markers)
}

// ListPanels handles GET /api/v1/breaker-panels.
func (h *ElectricalHandler) ListPanels(w http.ResponseWriter, r *http.Request) {
	panels, err := h.queryAllPanels(r)
	if err != nil {
		h.internalError(w, "list panels", err)
		return
	}
	writeJSON(w, http.StatusOK, panels)
}

// CreatePanel handles POST /api/v1/breaker-panels.
func (h *ElectricalHandler) CreatePanel(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateBreakerPanelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	markerID, err := uuid.Parse(req.MarkerID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid marker_id"})
		return
	}
	if req.TotalSlots <= 0 {
		req.TotalSlots = 20
	}
	id := uuid.New()
	now := time.Now().UTC()
	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO breaker_panels (id, marker_id, total_slots, notes, updated_at)
		 VALUES (?, ?, ?, ?, ?)`,
		id.String(), markerID.String(), req.TotalSlots, req.Notes, now,
	)
	if err != nil {
		h.internalError(w, "create panel", err)
		return
	}
	panel, err := h.queryPanelByID(r, id)
	if err != nil {
		h.internalError(w, "fetch panel", err)
		return
	}
	writeJSON(w, http.StatusCreated, panel)
}

// GetPanel handles GET /api/v1/breaker-panels/:panelID.
func (h *ElectricalHandler) GetPanel(w http.ResponseWriter, r *http.Request) {
	panelID, err := uuid.Parse(chi.URLParam(r, "panelID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid panelID"})
		return
	}
	panel, err := h.queryPanelByID(r, panelID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		} else {
			h.internalError(w, "get panel", err)
		}
		return
	}
	writeJSON(w, http.StatusOK, panel)
}

// UpdatePanel handles PUT /api/v1/breaker-panels/:panelID.
func (h *ElectricalHandler) UpdatePanel(w http.ResponseWriter, r *http.Request) {
	panelID, err := uuid.Parse(chi.URLParam(r, "panelID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid panelID"})
		return
	}
	var req domain.UpdateBreakerPanelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.TotalSlots <= 0 {
		req.TotalSlots = 20
	}
	now := time.Now().UTC()
	res, err := h.db.ExecContext(r.Context(),
		`UPDATE breaker_panels SET total_slots=?, notes=?, updated_at=? WHERE id=?`,
		req.TotalSlots, req.Notes, now, panelID.String(),
	)
	if err != nil {
		h.internalError(w, "update panel", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	panel, err := h.queryPanelByID(r, panelID)
	if err != nil {
		h.internalError(w, "fetch panel", err)
		return
	}
	writeJSON(w, http.StatusOK, panel)
}

// DeletePanel handles DELETE /api/v1/breaker-panels/:panelID.
func (h *ElectricalHandler) DeletePanel(w http.ResponseWriter, r *http.Request) {
	panelID, err := uuid.Parse(chi.URLParam(r, "panelID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid panelID"})
		return
	}
	_, err = h.db.ExecContext(r.Context(), `DELETE FROM breaker_panels WHERE id=?`, panelID.String())
	if err != nil {
		h.internalError(w, "delete panel", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListCircuits handles GET /api/v1/breaker-panels/:panelID/circuits.
func (h *ElectricalHandler) ListCircuits(w http.ResponseWriter, r *http.Request) {
	panelID, err := uuid.Parse(chi.URLParam(r, "panelID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid panelID"})
		return
	}
	circuits, err := h.queryCircuitsByPanel(r, panelID)
	if err != nil {
		h.internalError(w, "list circuits", err)
		return
	}
	writeJSON(w, http.StatusOK, circuits)
}

// CreateCircuit handles POST /api/v1/breaker-panels/:panelID/circuits.
func (h *ElectricalHandler) CreateCircuit(w http.ResponseWriter, r *http.Request) {
	panelID, err := uuid.Parse(chi.URLParam(r, "panelID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid panelID"})
		return
	}
	var req domain.CreateCircuitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Amperage <= 0 {
		req.Amperage = 15
	}
	if req.BreakerType == "" {
		req.BreakerType = domain.BreakerSingle
	}
	id := uuid.New()
	now := time.Now().UTC()
	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO circuits (id, panel_id, slot_number, label, amperage, breaker_type, notes, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id.String(), panelID.String(), req.SlotNumber, req.Label, req.Amperage, string(req.BreakerType), req.Notes, now,
	)
	if err != nil {
		h.internalError(w, "create circuit", err)
		return
	}
	circuit, err := h.queryCircuitByID(r, id)
	if err != nil {
		h.internalError(w, "fetch circuit", err)
		return
	}
	writeJSON(w, http.StatusCreated, circuit)
}

// UpdateCircuit handles PUT /api/v1/circuits/:circuitID.
func (h *ElectricalHandler) UpdateCircuit(w http.ResponseWriter, r *http.Request) {
	circuitID, err := uuid.Parse(chi.URLParam(r, "circuitID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid circuitID"})
		return
	}
	var req domain.UpdateCircuitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Amperage <= 0 {
		req.Amperage = 15
	}
	if req.BreakerType == "" {
		req.BreakerType = domain.BreakerSingle
	}
	now := time.Now().UTC()
	res, err := h.db.ExecContext(r.Context(),
		`UPDATE circuits SET slot_number=?, label=?, amperage=?, breaker_type=?, notes=?, updated_at=? WHERE id=?`,
		req.SlotNumber, req.Label, req.Amperage, string(req.BreakerType), req.Notes, now, circuitID.String(),
	)
	if err != nil {
		h.internalError(w, "update circuit", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	circuit, err := h.queryCircuitByID(r, circuitID)
	if err != nil {
		h.internalError(w, "fetch circuit", err)
		return
	}
	writeJSON(w, http.StatusOK, circuit)
}

// DeleteCircuit handles DELETE /api/v1/circuits/:circuitID.
func (h *ElectricalHandler) DeleteCircuit(w http.ResponseWriter, r *http.Request) {
	circuitID, err := uuid.Parse(chi.URLParam(r, "circuitID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid circuitID"})
		return
	}
	_, err = h.db.ExecContext(r.Context(), `DELETE FROM circuits WHERE id=?`, circuitID.String())
	if err != nil {
		h.internalError(w, "delete circuit", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListConnections handles GET /api/v1/circuits/:circuitID/connections.
func (h *ElectricalHandler) ListConnections(w http.ResponseWriter, r *http.Request) {
	circuitID, err := uuid.Parse(chi.URLParam(r, "circuitID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid circuitID"})
		return
	}
	conns, err := h.queryConnectionsByCircuit(r, circuitID)
	if err != nil {
		h.internalError(w, "list connections", err)
		return
	}
	writeJSON(w, http.StatusOK, conns)
}

// CreateConnection handles POST /api/v1/circuits/:circuitID/connections.
func (h *ElectricalHandler) CreateConnection(w http.ResponseWriter, r *http.Request) {
	circuitID, err := uuid.Parse(chi.URLParam(r, "circuitID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid circuitID"})
		return
	}
	var req domain.CreateCircuitConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	markerID, err := uuid.Parse(req.MarkerID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid marker_id"})
		return
	}
	id := uuid.New()
	now := time.Now().UTC()
	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO circuit_connections (id, circuit_id, marker_id, notes, updated_at)
		 VALUES (?, ?, ?, ?, ?)`,
		id.String(), circuitID.String(), markerID.String(), req.Notes, now,
	)
	if err != nil {
		h.internalError(w, "create connection", err)
		return
	}
	conn, err := h.queryConnectionByID(r, id)
	if err != nil {
		h.internalError(w, "fetch connection", err)
		return
	}
	writeJSON(w, http.StatusCreated, conn)
}

// DeleteConnection handles DELETE /api/v1/circuit-connections/:connectionID.
func (h *ElectricalHandler) DeleteConnection(w http.ResponseWriter, r *http.Request) {
	connID, err := uuid.Parse(chi.URLParam(r, "connectionID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid connectionID"})
		return
	}
	_, err = h.db.ExecContext(r.Context(), `DELETE FROM circuit_connections WHERE id=?`, connID.String())
	if err != nil {
		h.internalError(w, "delete connection", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- query helpers ---

func (h *ElectricalHandler) queryAllPanels(r *http.Request) ([]domain.BreakerPanel, error) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT bp.id, bp.marker_id, bp.total_slots, bp.notes, bp.updated_at,
		       am.label, am.level_id
		FROM breaker_panels bp
		JOIN asset_markers am ON am.id = bp.marker_id
		ORDER BY am.label`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var panels []domain.BreakerPanel
	for rows.Next() {
		var p domain.BreakerPanel
		var idStr, markerIDStr, levelIDStr string
		if err := rows.Scan(&idStr, &markerIDStr, &p.TotalSlots, &p.Notes, &p.UpdatedAt,
			&p.MarkerLabel, &levelIDStr); err != nil {
			return nil, err
		}
		p.ID = uuid.MustParse(idStr)
		p.MarkerID = uuid.MustParse(markerIDStr)
		p.LevelID = uuid.MustParse(levelIDStr)
		panels = append(panels, p)
	}
	if panels == nil {
		panels = []domain.BreakerPanel{}
	}
	return panels, rows.Err()
}

func (h *ElectricalHandler) queryPanelByID(r *http.Request, id uuid.UUID) (domain.BreakerPanel, error) {
	var p domain.BreakerPanel
	var idStr, markerIDStr, levelIDStr string
	err := h.db.QueryRowContext(r.Context(), `
		SELECT bp.id, bp.marker_id, bp.total_slots, bp.notes, bp.updated_at,
		       am.label, am.level_id
		FROM breaker_panels bp
		JOIN asset_markers am ON am.id = bp.marker_id
		WHERE bp.id = ?`, id.String()).
		Scan(&idStr, &markerIDStr, &p.TotalSlots, &p.Notes, &p.UpdatedAt,
			&p.MarkerLabel, &levelIDStr)
	if err != nil {
		return p, err
	}
	p.ID = uuid.MustParse(idStr)
	p.MarkerID = uuid.MustParse(markerIDStr)
	p.LevelID = uuid.MustParse(levelIDStr)
	return p, nil
}

func (h *ElectricalHandler) queryCircuitsByPanel(r *http.Request, panelID uuid.UUID) ([]domain.Circuit, error) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, panel_id, slot_number, label, amperage, breaker_type, notes, updated_at
		FROM circuits WHERE panel_id = ? ORDER BY slot_number`, panelID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var circuits []domain.Circuit
	for rows.Next() {
		var c domain.Circuit
		var idStr, panelIDStr, breakerType string
		if err := rows.Scan(&idStr, &panelIDStr, &c.SlotNumber, &c.Label, &c.Amperage,
			&breakerType, &c.Notes, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.ID = uuid.MustParse(idStr)
		c.PanelID = uuid.MustParse(panelIDStr)
		c.BreakerType = domain.BreakerType(breakerType)
		circuits = append(circuits, c)
	}
	if circuits == nil {
		circuits = []domain.Circuit{}
	}
	return circuits, rows.Err()
}

func (h *ElectricalHandler) queryCircuitByID(r *http.Request, id uuid.UUID) (domain.Circuit, error) {
	var c domain.Circuit
	var idStr, panelIDStr, breakerType string
	err := h.db.QueryRowContext(r.Context(), `
		SELECT id, panel_id, slot_number, label, amperage, breaker_type, notes, updated_at
		FROM circuits WHERE id = ?`, id.String()).
		Scan(&idStr, &panelIDStr, &c.SlotNumber, &c.Label, &c.Amperage,
			&breakerType, &c.Notes, &c.UpdatedAt)
	if err != nil {
		return c, err
	}
	c.ID = uuid.MustParse(idStr)
	c.PanelID = uuid.MustParse(panelIDStr)
	c.BreakerType = domain.BreakerType(breakerType)
	return c, nil
}

func (h *ElectricalHandler) queryConnectionsByCircuit(r *http.Request, circuitID uuid.UUID) ([]domain.CircuitConnection, error) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT cc.id, cc.circuit_id, cc.marker_id, cc.notes, cc.updated_at,
		       am.label, am.category, am.level_id
		FROM circuit_connections cc
		JOIN asset_markers am ON am.id = cc.marker_id
		WHERE cc.circuit_id = ?
		ORDER BY am.label`, circuitID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var conns []domain.CircuitConnection
	for rows.Next() {
		var conn domain.CircuitConnection
		var idStr, circuitIDStr, markerIDStr, category, levelIDStr string
		if err := rows.Scan(&idStr, &circuitIDStr, &markerIDStr, &conn.Notes, &conn.UpdatedAt,
			&conn.MarkerLabel, &category, &levelIDStr); err != nil {
			return nil, err
		}
		conn.ID = uuid.MustParse(idStr)
		conn.CircuitID = uuid.MustParse(circuitIDStr)
		conn.MarkerID = uuid.MustParse(markerIDStr)
		conn.MarkerCategory = domain.MarkerCategory(category)
		conn.LevelID = uuid.MustParse(levelIDStr)
		conns = append(conns, conn)
	}
	if conns == nil {
		conns = []domain.CircuitConnection{}
	}
	return conns, rows.Err()
}

func (h *ElectricalHandler) queryConnectionByID(r *http.Request, id uuid.UUID) (domain.CircuitConnection, error) {
	var conn domain.CircuitConnection
	var idStr, circuitIDStr, markerIDStr, category, levelIDStr string
	err := h.db.QueryRowContext(r.Context(), `
		SELECT cc.id, cc.circuit_id, cc.marker_id, cc.notes, cc.updated_at,
		       am.label, am.category, am.level_id
		FROM circuit_connections cc
		JOIN asset_markers am ON am.id = cc.marker_id
		WHERE cc.id = ?`, id.String()).
		Scan(&idStr, &circuitIDStr, &markerIDStr, &conn.Notes, &conn.UpdatedAt,
			&conn.MarkerLabel, &category, &levelIDStr)
	if err != nil {
		return conn, err
	}
	conn.ID = uuid.MustParse(idStr)
	conn.CircuitID = uuid.MustParse(circuitIDStr)
	conn.MarkerID = uuid.MustParse(markerIDStr)
	conn.MarkerCategory = domain.MarkerCategory(category)
	conn.LevelID = uuid.MustParse(levelIDStr)
	return conn, nil
}

// queryConnectableMarkers returns all non-BREAKER markers for the connection picker.
func (h *ElectricalHandler) queryConnectableMarkers(r *http.Request) ([]domain.AssetMarker, error) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, level_id, label, category, x_coordinate, y_coordinate, notes, updated_at
		FROM asset_markers
		WHERE category != 'BREAKER'
		ORDER BY label`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var markers []domain.AssetMarker
	for rows.Next() {
		var m domain.AssetMarker
		var idStr, levelIDStr, cat string
		if err := rows.Scan(&idStr, &levelIDStr, &m.Label, &cat,
			&m.XCoordinate, &m.YCoordinate, &m.Notes, &m.UpdatedAt); err != nil {
			return nil, err
		}
		m.ID = uuid.MustParse(idStr)
		m.LevelID = uuid.MustParse(levelIDStr)
		m.Category = domain.MarkerCategory(cat)
		markers = append(markers, m)
	}
	if markers == nil {
		markers = []domain.AssetMarker{}
	}
	return markers, rows.Err()
}

func (h *ElectricalHandler) internalError(w http.ResponseWriter, op string, err error) {
	h.logger.Error(op, "error", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
}

// --- page rendering ---

var electricalTmpl = template.Must(template.New("electrical").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Electrical — FullerHome</title>
  <style>
    :root { --bg:#fcfbfa; --sage:#3c6255; --terracotta:#a66c56; --text:#2c2c2c; --border:#ddd8d2; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--text); font-family:'Georgia',serif; overflow:hidden; }
    header { background:var(--sage); color:#fff; padding:0.75rem 1.5rem; display:flex; align-items:center; gap:1rem; height:52px; }
    header h1 { font-size:1.2rem; font-weight:600; letter-spacing:0.02em; }
    nav { background:#fff; border-bottom:1px solid var(--border); padding:0.4rem 1.5rem; height:36px; }
    nav a { color:var(--sage); text-decoration:none; margin-right:1.5rem; font-family:sans-serif; font-size:0.85rem; }
    nav a:hover { color:var(--terracotta); }
    #electrical-root { height:calc(100vh - 88px); }
  </style>
</head>
<body>
  <header><h1>FullerHome</h1></header>
  <nav>
    <a href="/">Dashboard</a>
    <a href="/home-map">Home Map</a>
    <a href="/electrical">Electrical</a>
  </nav>
  <div id="electrical-root" data-state="{{.StateJSON}}"></div>
  <script type="module" src="/static/breaker.js"></script>
</body>
</html>`))

func renderElectrical(w http.ResponseWriter, panels []domain.BreakerPanel, markers []domain.AssetMarker) {
	stateJSON, _ := json.Marshal(map[string]any{
		"panels":  panels,
		"markers": markers,
	})
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	electricalTmpl.Execute(w, map[string]any{
		"StateJSON": template.JS(stateJSON),
	})
}
