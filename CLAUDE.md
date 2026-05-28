# FullerHome — AI Coding Agent Guide

This file gives coding agents all the context needed to work on FullerHome effectively.
Read this before making any changes.

## What this project is

FullerHome is a household management platform built as a **single deployable Go binary**.
It provides:
- An interactive multi-floor spatial map with asset markers (breakers, shutoffs, storage, sensors)
- IoT telemetry ingestion from ESP32 / Zigbee sensors
- Third-party integrations (Todoist, YNAB) aggregated locally

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Backend | Go 1.22+, Chi v5 router | `cmd/server/main.go` is the entry point |
| Server views | **Templ** | Source: `templates/**/*.templ` — must run `task gen` to compile |
| Interactive canvas | **React 18 + TypeScript + Vite** | Source: `web/src/` — build output: `static/` |
| Database | **SQLite (WAL mode)** via `modernc.org/sqlite` | CGO-free; schema in `internal/database/database.go` |

## Project layout

```
cmd/server/main.go          ← entry point, Chi router, server startup
internal/config/config.go   ← env-based config (Load() returns *Config)
internal/database/database.go ← Open(), Migrate(), *DB wrapper
internal/domain/models.go   ← SpatialLevel, AssetMarker, SensorTelemetry
internal/handlers/
  health.go                 ← GET /health
  spatial.go                ← all /spatial and /api/v1/* handlers
  render.go                 ← html/template shim (pre-templ scaffold)
templates/
  layout.templ              ← base HTML shell, palette CSS vars
  pages/index.templ         ← dashboard page
  pages/spatial.templ       ← spatial map page (embeds data-state JSON)
web/src/
  types.ts                  ← TypeScript mirrors of Go domain models
  SpatialCanvas.tsx         ← Canvas2D renderer for walls + markers
  main.tsx                  ← React entry, mounts into #interactive-canvas-root
static/                     ← Vite build output (committed or generated)
tests/unit/                 ← go test unit tests
tests/integration/          ← go test integration tests
```

## Critical workflow: Templ generation

**Templ `.templ` files must be compiled before `go build` can succeed if you add template imports to handlers.**

```bash
task gen        # runs: templ generate ./templates/...
task build      # depends on gen
```

The current scaffold uses `html/template` in `internal/handlers/render.go` as a working bridge.
When migrating a page to use Templ:
1. Edit the `.templ` file in `templates/`
2. Run `task gen` — this writes `*_templ.go` alongside the source files
3. Import the generated package in the handler and call `component.Render(ctx, w)`
4. Remove the corresponding `html/template` block from `render.go`

## Domain model reference

```go
// internal/domain/models.go
type LevelType    string  // YARD | BASEMENT | MAIN | UPPER
type AssetCategory string // UTILITY | STORAGE | PEST | WORKSHOP

type SpatialLevel struct {
    ID, Name, Type, OrderIndex, WallsJSON, CreatedBy, UpdatedAt
}
type AssetMarker struct {
    ID, LevelID, Label, Category, XCoordinate, YCoordinate, Notes, UpdatedAt
}
type SensorTelemetry struct {
    ID, MarkerID, Temperature, Humidity, WaterLeaked, Timestamp
}
```

XCoordinate / YCoordinate are **percentage offsets (0.0–100.0)** of the canvas dimensions.
WallsJSON is a JSON array of `WallSegment` objects (see `web/src/types.ts`).

## Database conventions

- All queries go through `*database.DB` (wraps `*sql.DB`)
- Use `db.QueryContext(r.Context(), ...)` and `db.ExecContext(r.Context(), ...)` — never bare `db.Query`
- UUIDs stored as `TEXT`; parse with `uuid.MustParse()` after scanning
- Schema lives entirely in `database.Migrate()` — add new `CREATE TABLE IF NOT EXISTS` statements there
- No ORM — write plain SQL

## React canvas conventions

- The canvas component is `SpatialCanvas` (`web/src/SpatialCanvas.tsx`)
- Coordinates are **percentage-based** — `px = (xCoordinate / 100) * canvas.width`
- The canvas resizes via `ResizeObserver` and redraws on every state change
- `data-state` attribute on `#interactive-canvas-root` is the JSON-hydrated `SpatialState`
- TypeScript types in `web/src/types.ts` must stay in sync with Go domain models

## Adding a new route

1. Add handler method to `internal/handlers/spatial.go` (or a new handler file)
2. Register the route in `cmd/server/main.go`
3. If the route serves HTML, write a `.templ` page in `templates/pages/` and run `task gen`
4. Add a test in `tests/unit/` or `tests/integration/`

## Adding a new domain model

1. Add the struct to `internal/domain/models.go`
2. Add the `CREATE TABLE IF NOT EXISTS` to `database.Migrate()` in `internal/database/database.go`
3. Mirror the type in `web/src/types.ts` if the canvas needs to consume it

## Running locally

```bash
go mod download
cd web && npm install && cd ..
task gen          # compile Templ sources
task build-ui     # Vite build → static/
task run          # starts on :8080
```

For frontend-only iteration:
```bash
task dev          # server + Vite HMR concurrently
```

## Testing

```bash
task test-unit        # go test ./tests/unit/... -race -cover
task test-integration # go test ./tests/integration/...
task coverage         # HTML coverage report
```

Integration tests spin up a real in-memory SQLite instance — no mocking required.

## Design system

The UI rejects harsh neon/dark-mode aesthetics. Use only these CSS custom properties:

| Variable | Hex | When |
|---|---|---|
| `--bg` | `#fcfbfa` | Page background |
| `--sage` | `#3c6255` | Headers, nav, borders, primary CTA |
| `--terracotta` | `#a66c56` | Utility markers, badges, highlights |
| `--text` | `#2c2c2c` | Body copy |
| `--border` | `#ddd8d2` | Dividers, card outlines |

Typography: `Georgia` serif for headings/labels; `sans-serif` for metrics and metadata.

## Common pitfalls

- **Do not import `templates/pages` in handlers without first running `task gen`** — the generated `*_templ.go` files don't exist until then
- **Do not use CGO SQLite drivers** — the project uses `modernc.org/sqlite` (pure Go)
- **Never store absolute pixel coordinates** — always use percentage offsets so the canvas scales
- **Keep `web/src/types.ts` in sync** with `internal/domain/models.go` — there is no code generation for this bridge; update both manually
