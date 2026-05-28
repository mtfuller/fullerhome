# FullerHome

A unified, multi-level spatial household management and observability platform.

FullerHome bridges digital workflows, local IoT data streams, and physical asset mapping into a single
local server — no cloud dependency, single binary deployment, and an approachable UI built on a warm
linen-and-sage palette.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  Server-side HTML    │  │  React (SpatialCanvas)   │ │
│  │  (Go + Templ)        │  │  mounts into data-state  │ │
│  └──────────┬───────────┘  └──────────────────────────┘ │
└─────────────┼───────────────────────────────────────────┘
              │ HTTP
┌─────────────▼───────────────────────────────────────────┐
│  Go Server (Chi router)                                 │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Handlers  │  │  Templates   │  │  Static /static │  │
│  │  (domain)  │  │  (Templ)     │  │  (Vite output)  │  │
│  └─────┬──────┘  └──────────────┘  └─────────────────┘  │
│        │                                                │
│  ┌─────▼──────────────────────────────────────────────┐ │
│  │  SQLite (WAL mode) — fullerhome.db                 │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Hybrid hydration model:** Go + Templ renders the full HTML shell and embeds current spatial data as
a JSON blob in `data-state`. React mounts inside `#interactive-canvas-root` and bootstraps from that
attribute — no separate client fetch required on load.

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Backend | Go 1.22+ + Chi | Fast, simple, single binary |
| Server views | Templ | Type-safe compiled HTML components |
| Interactive canvas | React + TypeScript + Vite | Client-side DOM manipulation for spatial drawing |
| Database | SQLite (WAL) | Zero-network, embedded, single-file backup |

## Prerequisites

- [Go 1.22+](https://go.dev/dl/)
- [Task](https://taskfile.dev/installation/) — `brew install go-task` or `go install github.com/go-task/task/v3/cmd/task@latest`
- [Node.js 20+](https://nodejs.org/) + npm (for the React canvas)
- [Templ CLI](https://templ.guide/quick-start/installation) — `go install github.com/a-h/templ/cmd/templ@latest`

## Quick Start

```bash
# 1. Clone and install deps
git clone https://github.com/mtfuller/fullerhome.git
cd fullerhome
go mod download
cd web && npm install && cd ..

# 2. Generate Templ components
task gen

# 3. Build the React canvas bundle
task build-ui

# 4. Run the server
task run
# → http://localhost:8080
```

## Project Structure

```
.
├── cmd/server/           # Application entry point
├── internal/
│   ├── config/           # Environment-based configuration
│   ├── database/         # SQLite connection + schema migrations
│   ├── domain/           # Core domain models (SpatialLevel, AssetMarker, SensorTelemetry)
│   └── handlers/         # HTTP handlers + html/template shim (pre-templ)
├── templates/            # Templ source files (.templ)
│   └── pages/            # Page-level components
├── web/                  # React + TypeScript (Vite)
│   └── src/
│       ├── types.ts      # TypeScript types mirroring Go domain models
│       ├── SpatialCanvas.tsx
│       └── main.tsx
├── static/               # Vite build output (served at /static/)
├── tests/
│   ├── unit/
│   └── integration/
├── CLAUDE.md             # AI coding agent guidance
├── Taskfile.yml
└── .env.example
```

## Available Commands

```bash
task                  # List all commands
task gen              # Generate Go code from .templ files (run after editing templates/)
task build            # Build server binary → bin/server
task build-ui         # Build React bundle → static/
task run              # Run server locally
task dev              # Run server + Vite dev server concurrently
task test             # Run all tests
task test-unit        # Unit tests with coverage
task test-integration # Integration tests
task coverage         # HTML coverage report
task clean            # Remove build artifacts
task lint             # golangci-lint
task deps             # go mod tidy + npm install
```

## API Endpoints

```bash
# Health
GET  /health

# Spatial levels
GET  /api/v1/levels
POST /api/v1/levels
  {"name":"Main Floor","type":"MAIN","walls_json":"[]","created_by":"admin"}

# Asset markers on a level
GET  /api/v1/levels/{levelID}/markers
POST /api/v1/levels/{levelID}/markers
  {"label":"Main Breaker","category":"UTILITY","x_coordinate":42.5,"y_coordinate":18.3,"notes":"200A panel"}
```

Level types: `YARD` | `BASEMENT` | `MAIN` | `UPPER`

Asset categories: `UTILITY` | `STORAGE` | `PEST` | `WORKSHOP`

## Configuration

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8080` | HTTP listen port |
| `DATABASE_PATH` | `./fullerhome.db` | SQLite database file path |
| `LOG_LEVEL` | `info` | `debug` or `info` |
| `STATIC_DIR` | `./static` | Vite build output directory |

## Design System

The UI uses an approachable, domestic palette — no dark neon dashboards.

| Token | Hex | Usage |
|---|---|---|
| Background | `#fcfbfa` | Page canvas (linen/cream) |
| Sage | `#3c6255` | Headers, borders, primary actions |
| Terracotta | `#a66c56` | Utility markers, highlights, badges |
| Text | `#2c2c2c` | Body copy |
| Border | `#ddd8d2` | Dividers, card outlines |

## Development Roadmap

- **Phase 1 (current):** Core Go server, SQLite schema, Chi routing, domain models, html/template shim
- **Phase 2:** Full Templ rendering, React spatial canvas with polyline wall-drawing and marker placement
- **Phase 3:** IoT telemetry ingestion (MQTT / webhook), Todoist + YNAB integration, live sensor overlay

## License

MIT — see [LICENSE](LICENSE)
