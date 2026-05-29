package integration_test

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/mtfuller/fullerhome/internal/database"
	"github.com/mtfuller/fullerhome/internal/handlers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()

	f, err := os.CreateTemp(t.TempDir(), "test-*.db")
	require.NoError(t, err)
	f.Close()

	db, err := database.Open(f.Name())
	require.NoError(t, err)
	require.NoError(t, database.Migrate(db))

	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	health := handlers.NewHealthHandler(db)
	homeMap := handlers.NewHomeMapHandler(db, logger)

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Get("/health", health.Check)
	r.Get("/", homeMap.Dashboard)
	r.Get("/home-map", homeMap.HomeMap)
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/levels", homeMap.ListLevels)
		r.Post("/levels", homeMap.CreateLevel)
		r.Put("/levels/{levelID}", homeMap.UpdateLevel)
		r.Patch("/levels/{levelID}/reorder", homeMap.ReorderLevel)
		r.Delete("/levels/{levelID}", homeMap.DeleteLevel)
		r.Get("/levels/{levelID}/markers", homeMap.ListMarkers)
		r.Post("/levels/{levelID}/markers", homeMap.CreateMarker)
		r.Put("/levels/{levelID}/markers/{markerID}", homeMap.UpdateMarker)
		r.Delete("/levels/{levelID}/markers/{markerID}", homeMap.DeleteMarker)
		r.Get("/levels/{levelID}/rooms", homeMap.ListRooms)
		r.Post("/levels/{levelID}/rooms", homeMap.CreateRoom)
		r.Put("/levels/{levelID}/rooms/{roomID}", homeMap.UpdateRoom)
		r.Delete("/levels/{levelID}/rooms/{roomID}", homeMap.DeleteRoom)
	})

	srv := httptest.NewServer(r)
	t.Cleanup(func() {
		srv.Close()
		db.Close()
	})
	return srv
}

func TestHealth(t *testing.T) {
	srv := newTestServer(t)

	resp, err := http.Get(srv.URL + "/health")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "ok", body["status"])
	assert.Equal(t, "connected", body["database"])
}

func TestLevels_CreateAndList(t *testing.T) {
	srv := newTestServer(t)

	body := `{"name":"Ground Floor","type":"GROUND","created_by":"test"}`
	resp, err := http.Post(srv.URL+"/api/v1/levels", "application/json", strings.NewReader(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var created map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&created))
	assert.Equal(t, "Ground Floor", created["name"])
	assert.Equal(t, "GROUND", created["type"])

	resp2, err := http.Get(srv.URL + "/api/v1/levels")
	require.NoError(t, err)
	defer resp2.Body.Close()
	assert.Equal(t, http.StatusOK, resp2.StatusCode)

	var levels []map[string]any
	require.NoError(t, json.NewDecoder(resp2.Body).Decode(&levels))
	require.Len(t, levels, 1)
	assert.Equal(t, created["id"], levels[0]["id"])
}

func TestLevels_UpdateAndDelete(t *testing.T) {
	srv := newTestServer(t)

	body := `{"name":"Basement","type":"BASEMENT","created_by":"test"}`
	r1, err := http.Post(srv.URL+"/api/v1/levels", "application/json", strings.NewReader(body))
	require.NoError(t, err)
	var level map[string]any
	require.NoError(t, json.NewDecoder(r1.Body).Decode(&level))
	r1.Body.Close()
	levelID := level["id"].(string)

	// Update
	upd := `{"name":"Basement Updated","type":"BASEMENT","walls_json":"[]"}`
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/levels/"+levelID, strings.NewReader(upd))
	req.Header.Set("Content-Type", "application/json")
	r2, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer r2.Body.Close()
	assert.Equal(t, http.StatusOK, r2.StatusCode)

	// Delete
	req2, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/v1/levels/"+levelID, nil)
	r3, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer r3.Body.Close()
	assert.Equal(t, http.StatusNoContent, r3.StatusCode)
}

func TestMarkers_CreateAndList(t *testing.T) {
	srv := newTestServer(t)

	lvlBody := `{"name":"Basement","type":"BASEMENT","created_by":"test"}`
	r1, err := http.Post(srv.URL+"/api/v1/levels", "application/json", strings.NewReader(lvlBody))
	require.NoError(t, err)
	var level map[string]any
	require.NoError(t, json.NewDecoder(r1.Body).Decode(&level))
	r1.Body.Close()
	levelID := level["id"].(string)

	mBody := `{"label":"Main Breaker","category":"BREAKER","x_coordinate":42.5,"y_coordinate":18.3,"notes":"200A panel"}`
	r2, err := http.Post(srv.URL+"/api/v1/levels/"+levelID+"/markers", "application/json", strings.NewReader(mBody))
	require.NoError(t, err)
	defer r2.Body.Close()
	assert.Equal(t, http.StatusCreated, r2.StatusCode)

	r3, err := http.Get(srv.URL + "/api/v1/levels/" + levelID + "/markers")
	require.NoError(t, err)
	defer r3.Body.Close()

	var markers []map[string]any
	require.NoError(t, json.NewDecoder(r3.Body).Decode(&markers))
	require.Len(t, markers, 1)
	assert.Equal(t, "Main Breaker", markers[0]["label"])
	assert.Equal(t, "BREAKER", markers[0]["category"])
}

func TestRooms_CreateListUpdateDelete(t *testing.T) {
	srv := newTestServer(t)

	lvlBody := `{"name":"Ground Floor","type":"GROUND","created_by":"test"}`
	r1, err := http.Post(srv.URL+"/api/v1/levels", "application/json", strings.NewReader(lvlBody))
	require.NoError(t, err)
	var level map[string]any
	require.NoError(t, json.NewDecoder(r1.Body).Decode(&level))
	r1.Body.Close()
	levelID := level["id"].(string)

	// Create room
	rBody := `{"name":"Kitchen","x_coordinate":30.0,"y_coordinate":40.0}`
	r2, err := http.Post(srv.URL+"/api/v1/levels/"+levelID+"/rooms", "application/json", strings.NewReader(rBody))
	require.NoError(t, err)
	var room map[string]any
	require.NoError(t, json.NewDecoder(r2.Body).Decode(&room))
	r2.Body.Close()
	assert.Equal(t, http.StatusCreated, r2.StatusCode)
	assert.Equal(t, "Kitchen", room["name"])
	roomID := room["id"].(string)

	// List rooms
	r3, err := http.Get(srv.URL + "/api/v1/levels/" + levelID + "/rooms")
	require.NoError(t, err)
	var rooms []map[string]any
	require.NoError(t, json.NewDecoder(r3.Body).Decode(&rooms))
	r3.Body.Close()
	require.Len(t, rooms, 1)

	// Update room
	upd := `{"name":"Living Room","x_coordinate":50.0,"y_coordinate":50.0}`
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/levels/"+levelID+"/rooms/"+roomID, strings.NewReader(upd))
	req.Header.Set("Content-Type", "application/json")
	r4, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer r4.Body.Close()
	assert.Equal(t, http.StatusOK, r4.StatusCode)

	// Delete room
	req2, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/v1/levels/"+levelID+"/rooms/"+roomID, nil)
	r5, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer r5.Body.Close()
	assert.Equal(t, http.StatusNoContent, r5.StatusCode)
}

func TestDashboard_ReturnsHTML(t *testing.T) {
	srv := newTestServer(t)

	resp, err := http.Get(srv.URL + "/")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Header.Get("Content-Type"), "text/html")
}

// TestLevels_Reorder is the regression test for the reorder bug.
//
// Root causes fixed:
//  1. database.Open now calls SetMaxOpenConns(1), so concurrent PATCH requests
//     no longer race for the SQLite write lock (SQLITE_BUSY → 500).
//  2. The frontend api.reorderLevel now checks r.ok and throws; handleMoveLevel
//     now awaits the two calls sequentially so the optimistic state update only
//     fires after both DB writes have succeeded.
func TestLevels_Reorder(t *testing.T) {
	srv := newTestServer(t)

	// Create two levels; CreateLevel assigns order_index 0, then 1.
	var lvl1, lvl2 map[string]any
	r1, err := http.Post(srv.URL+"/api/v1/levels", "application/json",
		strings.NewReader(`{"name":"Ground","type":"GROUND","created_by":"test"}`))
	require.NoError(t, err)
	require.NoError(t, json.NewDecoder(r1.Body).Decode(&lvl1))
	r1.Body.Close()
	require.Equal(t, http.StatusCreated, r1.StatusCode)

	r2, err := http.Post(srv.URL+"/api/v1/levels", "application/json",
		strings.NewReader(`{"name":"Basement","type":"BASEMENT","created_by":"test"}`))
	require.NoError(t, err)
	require.NoError(t, json.NewDecoder(r2.Body).Decode(&lvl2))
	r2.Body.Close()
	require.Equal(t, http.StatusCreated, r2.StatusCode)

	id1 := lvl1["id"].(string) // order_index 0
	id2 := lvl2["id"].(string) // order_index 1

	// Swap: give Basement order_index 0 and Ground order_index 1 (sequential,
	// mirroring the fixed frontend behaviour).
	patch := func(id, body string) int {
		req, _ := http.NewRequest(http.MethodPatch, srv.URL+"/api/v1/levels/"+id+"/reorder", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		resp.Body.Close()
		return resp.StatusCode
	}
	assert.Equal(t, http.StatusNoContent, patch(id2, `{"order_index":0}`))
	assert.Equal(t, http.StatusNoContent, patch(id1, `{"order_index":1}`))

	// Verify DB reflects the swap.
	r3, err := http.Get(srv.URL + "/api/v1/levels")
	require.NoError(t, err)
	var levels []map[string]any
	require.NoError(t, json.NewDecoder(r3.Body).Decode(&levels))
	r3.Body.Close()
	require.Len(t, levels, 2)
	assert.Equal(t, "Basement", levels[0]["name"], "Basement should now be first (order_index 0)")
	assert.Equal(t, "Ground", levels[1]["name"], "Ground should now be second (order_index 1)")
	assert.Equal(t, float64(0), levels[0]["order_index"])
	assert.Equal(t, float64(1), levels[1]["order_index"])
}

// TestLevels_Reorder_NotFound verifies the handler returns 404 for an unknown level.
func TestLevels_Reorder_NotFound(t *testing.T) {
	srv := newTestServer(t)

	req, _ := http.NewRequest(http.MethodPatch,
		srv.URL+"/api/v1/levels/00000000-0000-0000-0000-000000000000/reorder",
		strings.NewReader(`{"order_index":5}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

// TestLevels_Reorder_InvalidBody verifies the handler returns 400 for a bad payload.
func TestLevels_Reorder_InvalidBody(t *testing.T) {
	srv := newTestServer(t)

	// Create a level so the ID resolves.
	r1, err := http.Post(srv.URL+"/api/v1/levels", "application/json",
		strings.NewReader(`{"name":"Ground","type":"GROUND","created_by":"test"}`))
	require.NoError(t, err)
	var lvl map[string]any
	require.NoError(t, json.NewDecoder(r1.Body).Decode(&lvl))
	r1.Body.Close()

	req, _ := http.NewRequest(http.MethodPatch,
		srv.URL+"/api/v1/levels/"+lvl["id"].(string)+"/reorder",
		strings.NewReader(`not-json`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
