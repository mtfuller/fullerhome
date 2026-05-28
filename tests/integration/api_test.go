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
	spatial := handlers.NewSpatialHandler(db, logger)

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Get("/health", health.Check)
	r.Get("/", spatial.Dashboard)
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/levels", spatial.ListLevels)
		r.Post("/levels", spatial.CreateLevel)
		r.Get("/levels/{levelID}/markers", spatial.ListMarkers)
		r.Post("/levels/{levelID}/markers", spatial.CreateMarker)
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

	body := `{"name":"Main Floor","type":"MAIN","walls_json":"[]","created_by":"test"}`
	resp, err := http.Post(srv.URL+"/api/v1/levels", "application/json", strings.NewReader(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var created map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&created))
	assert.Equal(t, "Main Floor", created["name"])
	assert.Equal(t, "MAIN", created["type"])

	resp2, err := http.Get(srv.URL + "/api/v1/levels")
	require.NoError(t, err)
	defer resp2.Body.Close()
	assert.Equal(t, http.StatusOK, resp2.StatusCode)

	var levels []map[string]any
	require.NoError(t, json.NewDecoder(resp2.Body).Decode(&levels))
	require.Len(t, levels, 1)
	assert.Equal(t, created["id"], levels[0]["id"])
}

func TestMarkers_CreateAndList(t *testing.T) {
	srv := newTestServer(t)

	// Create a level
	lvlBody := `{"name":"Basement","type":"BASEMENT","walls_json":"[]","created_by":"test"}`
	r1, err := http.Post(srv.URL+"/api/v1/levels", "application/json", strings.NewReader(lvlBody))
	require.NoError(t, err)
	var level map[string]any
	require.NoError(t, json.NewDecoder(r1.Body).Decode(&level))
	r1.Body.Close()
	levelID := level["id"].(string)

	// Create a marker
	mBody := `{"label":"Main Breaker","category":"UTILITY","x_coordinate":42.5,"y_coordinate":18.3,"notes":"200A panel"}`
	r2, err := http.Post(srv.URL+"/api/v1/levels/"+levelID+"/markers", "application/json", strings.NewReader(mBody))
	require.NoError(t, err)
	defer r2.Body.Close()
	assert.Equal(t, http.StatusCreated, r2.StatusCode)

	// List markers
	r3, err := http.Get(srv.URL + "/api/v1/levels/" + levelID + "/markers")
	require.NoError(t, err)
	defer r3.Body.Close()

	var markers []map[string]any
	require.NoError(t, json.NewDecoder(r3.Body).Decode(&markers))
	require.Len(t, markers, 1)
	assert.Equal(t, "Main Breaker", markers[0]["label"])
	assert.Equal(t, "UTILITY", markers[0]["category"])
}

func TestDashboard_ReturnsHTML(t *testing.T) {
	srv := newTestServer(t)

	resp, err := http.Get(srv.URL + "/")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Header.Get("Content-Type"), "text/html")
}
