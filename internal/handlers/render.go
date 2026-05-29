package handlers

import (
	"encoding/json"
	"html/template"
	"net/http"

	"github.com/mtfuller/fullerhome/internal/domain"
)

var dashboardTmpl = template.Must(template.New("dashboard").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FullerHome</title>
  <style>
    :root { --bg:#fcfbfa; --sage:#3c6255; --terracotta:#a66c56; --text:#2c2c2c; --border:#ddd8d2; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--text); font-family:'Georgia',serif; }
    header { background:var(--sage); color:#fff; padding:1rem 2rem; display:flex; align-items:center; gap:1rem; }
    header h1 { font-size:1.5rem; font-weight:600; letter-spacing:0.02em; }
    nav { background:#fff; border-bottom:1px solid var(--border); padding:0.5rem 2rem; }
    nav a { color:var(--sage); text-decoration:none; margin-right:1.5rem; font-family:sans-serif; font-size:0.9rem; }
    nav a:hover { color:var(--terracotta); }
    main { padding:2rem; max-width:1200px; margin:0 auto; }
    h2 { color:var(--sage); margin-bottom:1rem; }
    .level-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:1rem; }
    .level-card { background:#fff; border:1px solid var(--border); border-radius:8px; padding:1.25rem; cursor:pointer; transition:box-shadow 0.15s; }
    .level-card:hover { box-shadow:0 2px 12px rgba(60,98,85,0.12); }
    .level-card h3 { color:var(--sage); margin-bottom:0.25rem; }
    .level-card .type { font-family:sans-serif; font-size:0.8rem; color:#888; }
    .badge { display:inline-block; padding:0.2rem 0.6rem; border-radius:4px; font-family:sans-serif; font-size:0.75rem; font-weight:600; background:var(--terracotta); color:#fff; margin-top:0.5rem; }
    .empty { font-family:sans-serif; color:#888; }
    .cta { display:inline-block; margin-top:1.5rem; padding:0.6rem 1.25rem; background:var(--sage); color:#fff; border-radius:6px; text-decoration:none; font-family:sans-serif; font-size:0.9rem; }
    .cta:hover { background:#2f4f43; }
  </style>
</head>
<body>
  <header><h1>FullerHome</h1></header>
  <nav>
    <a href="/">Dashboard</a>
    <a href="/home-map">Home Map</a>
    <a href="/electrical">Electrical</a>
  </nav>
  <main>
    <h2>Home Levels</h2>
    {{if .Levels}}
    <div class="level-grid">
      {{range .Levels}}
      <a href="/home-map" style="text-decoration:none">
        <div class="level-card">
          <h3>{{.Name}}</h3>
          <span class="type">{{.Type}}</span><br>
          <span class="badge">Level {{.OrderIndex}}</span>
        </div>
      </a>
      {{end}}
    </div>
    {{else}}
    <p class="empty">No levels configured yet. Open the Home Map to get started.</p>
    {{end}}
    <a href="/home-map" class="cta">Open Home Map</a>
  </main>
</body>
</html>`))

var homeMapTmpl = template.Must(template.New("homemap").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Home Map — FullerHome</title>
  <style>
    :root { --bg:#fcfbfa; --sage:#3c6255; --terracotta:#a66c56; --text:#2c2c2c; --border:#ddd8d2; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--text); font-family:'Georgia',serif; overflow:hidden; }
    header { background:var(--sage); color:#fff; padding:0.75rem 1.5rem; display:flex; align-items:center; gap:1rem; height:52px; }
    header h1 { font-size:1.2rem; font-weight:600; letter-spacing:0.02em; }
    nav { background:#fff; border-bottom:1px solid var(--border); padding:0.4rem 1.5rem; height:36px; }
    nav a { color:var(--sage); text-decoration:none; margin-right:1.5rem; font-family:sans-serif; font-size:0.85rem; }
    nav a:hover { color:var(--terracotta); }
    #home-map-root { height:calc(100vh - 88px); }
  </style>
</head>
<body>
  <header><h1>FullerHome</h1></header>
  <nav>
    <a href="/">Dashboard</a>
    <a href="/home-map">Home Map</a>
    <a href="/electrical">Electrical</a>
  </nav>
  <div id="home-map-root" data-state="{{.StateJSON}}"></div>
  <script type="module" src="/static/main.js"></script>
</body>
</html>`))

func renderDashboard(w http.ResponseWriter, levels []domain.HomeLevel) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	dashboardTmpl.Execute(w, map[string]any{"Levels": levels})
}

func renderHomeMap(w http.ResponseWriter, levels []domain.HomeLevel, markers []domain.AssetMarker, rooms []domain.Room, zones []domain.Zone) {
	stateJSON, _ := json.Marshal(map[string]any{
		"levels":  levels,
		"markers": markers,
		"rooms":   rooms,
		"zones":   zones,
	})
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	homeMapTmpl.Execute(w, map[string]any{
		"StateJSON": template.JS(stateJSON),
	})
}
