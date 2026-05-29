package database

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

// DB wraps the sql.DB connection for SQLite.
type DB struct {
	*sql.DB
}

// Open opens (or creates) the SQLite database at path and enables WAL mode.
func Open(path string) (*DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	// SQLite only supports one writer at a time; serialise through a single
	// connection so concurrent requests never race for the write lock.
	db.SetMaxOpenConns(1)

	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("enable WAL: %w", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return nil, fmt.Errorf("enable foreign keys: %w", err)
	}

	return &DB{db}, nil
}

// Migrate runs schema migrations idempotently.
func Migrate(db *DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS spatial_levels (
			id          TEXT PRIMARY KEY,
			name        TEXT NOT NULL,
			type        TEXT NOT NULL,
			order_index INTEGER NOT NULL DEFAULT 0,
			walls_json  TEXT NOT NULL DEFAULT '[]',
			created_by  TEXT NOT NULL DEFAULT '',
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS asset_markers (
			id           TEXT PRIMARY KEY,
			level_id     TEXT NOT NULL REFERENCES spatial_levels(id) ON DELETE CASCADE,
			label        TEXT NOT NULL,
			category     TEXT NOT NULL,
			x_coordinate REAL NOT NULL DEFAULT 0,
			y_coordinate REAL NOT NULL DEFAULT 0,
			notes        TEXT NOT NULL DEFAULT '',
			updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS rooms (
			id           TEXT PRIMARY KEY,
			level_id     TEXT NOT NULL REFERENCES spatial_levels(id) ON DELETE CASCADE,
			name         TEXT NOT NULL,
			x_coordinate REAL NOT NULL DEFAULT 0,
			y_coordinate REAL NOT NULL DEFAULT 0,
			updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS spatial_zones (
			id          TEXT PRIMARY KEY,
			level_id    TEXT NOT NULL REFERENCES spatial_levels(id) ON DELETE CASCADE,
			name        TEXT NOT NULL DEFAULT '',
			type        TEXT NOT NULL,
			points_json TEXT NOT NULL DEFAULT '[]',
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS sensor_telemetry (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			marker_id    TEXT NOT NULL REFERENCES asset_markers(id) ON DELETE CASCADE,
			temperature  REAL NOT NULL DEFAULT 0,
			humidity     REAL NOT NULL DEFAULT 0,
			water_leaked INTEGER NOT NULL DEFAULT 0,
			timestamp    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}

	// Additive column migrations — tolerate "duplicate column" errors on re-run
	_, _ = db.Exec(`ALTER TABLE spatial_levels ADD COLUMN map_config_json TEXT NOT NULL DEFAULT ''`)

	return nil
}

// Ping checks database reachability.
func (db *DB) Ping() error {
	return db.DB.Ping()
}
