package handlers

// render.go provides html/template-based rendering as a scaffold shim.
// After running `task gen`, migrate these to the compiled Templ components
// in the templates/ package.

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
    :root {
      --bg: #fcfbfa;
      --sage: #3c6255;
      --terracotta: #a66c56;
      --text: #2c2c2c;
      --border: #ddd8d2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: 'Georgia', serif; }
    header {
      background: var(--sage); color: #fff;
      padding: 1rem 2rem; display: flex; align-items: center; gap: 1rem;
    }
    header h1 { font-size: 1.5rem; font-weight: 600; letter-spacing: 0.02em; }
    nav { background: #fff; border-bottom: 1px solid var(--border); padding: 0.5rem 2rem; }
    nav a { color: var(--sage); text-decoration: none; margin-right: 1.5rem; font-family: sans-serif; font-size: 0.9rem; }
    nav a:hover { color: var(--terracotta); }
    main { padding: 2rem; max-width: 1200px; margin: 0 auto; }
    h2 { color: var(--sage); margin-bottom: 1rem; }
    .level-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
    .level-card {
      background: #fff; border: 1px solid var(--border); border-radius: 8px;
      padding: 1.25rem; cursor: pointer; transition: box-shadow 0.15s;
    }
    .level-card:hover { box-shadow: 0 2px 12px rgba(60,98,85,0.12); }
    .level-card h3 { color: var(--sage); margin-bottom: 0.25rem; }
    .level-card .type { font-family: sans-serif; font-size: 0.8rem; color: #888; }
    .badge {
      display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px;
      font-family: sans-serif; font-size: 0.75rem; font-weight: 600;
      background: var(--terracotta); color: #fff; margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <header><h1>FullerHome</h1></header>
  <nav>
    <a href="/">Dashboard</a>
    <a href="/spatial">Spatial Map</a>
  </nav>
  <main>
    <h2>Spatial Levels</h2>
    {{if .Levels}}
    <div class="level-grid">
      {{range .Levels}}
      <a href="/spatial?level={{.ID}}" style="text-decoration:none">
        <div class="level-card">
          <h3>{{.Name}}</h3>
          <span class="type">{{.Type}}</span><br>
          <span class="badge">Floor {{.OrderIndex}}</span>
        </div>
      </a>
      {{end}}
    </div>
    {{else}}
    <p style="font-family:sans-serif;color:#888">No levels configured yet. Use the API to add spatial levels.</p>
    {{end}}
  </main>
</body>
</html>`))

var spatialTmpl = template.Must(template.New("spatial").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spatial Map — FullerHome</title>
  <style>
    :root {
      --bg: #fcfbfa; --sage: #3c6255; --terracotta: #a66c56;
      --text: #2c2c2c; --border: #ddd8d2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: 'Georgia', serif; }
    header { background: var(--sage); color: #fff; padding: 1rem 2rem; }
    header h1 { font-size: 1.5rem; font-weight: 600; }
    nav { background: #fff; border-bottom: 1px solid var(--border); padding: 0.5rem 2rem; }
    nav a { color: var(--sage); text-decoration: none; margin-right: 1.5rem; font-family: sans-serif; font-size: 0.9rem; }
    nav a:hover { color: var(--terracotta); }
    .layout { display: flex; height: calc(100vh - 104px); }
    .sidebar {
      width: 220px; background: #fff; border-right: 1px solid var(--border);
      padding: 1rem; overflow-y: auto; flex-shrink: 0;
    }
    .sidebar h3 { color: var(--sage); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem; }
    .level-btn {
      display: block; width: 100%; text-align: left; padding: 0.6rem 0.75rem;
      margin-bottom: 0.4rem; border: 1px solid var(--border); border-radius: 6px;
      background: #fff; cursor: pointer; font-family: sans-serif; font-size: 0.85rem; color: var(--text);
    }
    .level-btn:hover, .level-btn.active { background: var(--sage); color: #fff; border-color: var(--sage); }
    .canvas-area { flex: 1; position: relative; overflow: hidden; }
    #interactive-canvas-root {
      width: 100%; height: 100%;
      background: repeating-linear-gradient(0deg, transparent, transparent 39px, var(--border) 40px),
                  repeating-linear-gradient(90deg, transparent, transparent 39px, var(--border) 40px);
    }
  </style>
</head>
<body>
  <header><h1>Spatial Map</h1></header>
  <nav>
    <a href="/">Dashboard</a>
    <a href="/spatial">Spatial Map</a>
  </nav>
  <div class="layout">
    <aside class="sidebar">
      <h3>Levels</h3>
      {{range .Levels}}
      <button class="level-btn" data-level-id="{{.ID}}">{{.Name}}</button>
      {{end}}
    </aside>
    <div class="canvas-area">
      <div id="interactive-canvas-root" data-state="{{.StateJSON}}"></div>
    </div>
  </div>
  <script src="/static/main.js" defer></script>
</body>
</html>`))

func renderDashboard(w http.ResponseWriter, levels []domain.SpatialLevel) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	dashboardTmpl.Execute(w, map[string]any{"Levels": levels})
}

func renderSpatialMap(w http.ResponseWriter, levels []domain.SpatialLevel) {
	stateJSON, _ := json.Marshal(map[string]any{
		"levels":  levels,
		"markers": []any{},
	})
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	spatialTmpl.Execute(w, map[string]any{
		"Levels":    levels,
		"StateJSON": template.JS(stateJSON),
	})
}
