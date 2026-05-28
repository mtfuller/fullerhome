package domain

import (
	"time"

	"github.com/google/uuid"
)

// LevelType represents the vertical categorization of structural planes.
type LevelType string

const (
	LevelYard     LevelType = "YARD"
	LevelBasement LevelType = "BASEMENT"
	LevelMain     LevelType = "MAIN"
	LevelUpper    LevelType = "UPPER"
)

// AssetCategory classifies the semantic type of a placed marker.
type AssetCategory string

const (
	CategoryUtility  AssetCategory = "UTILITY"
	CategoryStorage  AssetCategory = "STORAGE"
	CategoryPest     AssetCategory = "PEST"
	CategoryWorkshop AssetCategory = "WORKSHOP"
)

// SpatialLevel represents a single physical layer containing structural bounds.
type SpatialLevel struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Type       LevelType `json:"type"`
	OrderIndex int       `json:"order_index"`
	WallsJSON  string    `json:"walls_json"` // raw polyline array for structural vector definitions
	CreatedBy  string    `json:"created_by"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// AssetMarker defines a contextual point placed on the relative vector plane of a level.
type AssetMarker struct {
	ID          uuid.UUID     `json:"id"`
	LevelID     uuid.UUID     `json:"level_id"`
	Label       string        `json:"label"`
	Category    AssetCategory `json:"category"`
	XCoordinate float64       `json:"x_coordinate"` // percentage offset 0.0–100.0
	YCoordinate float64       `json:"y_coordinate"` // percentage offset 0.0–100.0
	Notes       string        `json:"notes"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

// SensorTelemetry encapsulates raw environment streams tied to a spatial position.
type SensorTelemetry struct {
	ID          int64     `json:"id"`
	MarkerID    uuid.UUID `json:"marker_id"`
	Temperature float64   `json:"temperature"`
	Humidity    float64   `json:"humidity"`
	WaterLeaked bool      `json:"water_leaked"`
	Timestamp   time.Time `json:"timestamp"`
}

// CreateLevelRequest is the input payload for POST /api/v1/levels.
type CreateLevelRequest struct {
	Name      string    `json:"name"`
	Type      LevelType `json:"type"`
	WallsJSON string    `json:"walls_json"`
	CreatedBy string    `json:"created_by"`
}

// CreateMarkerRequest is the input payload for POST /api/v1/levels/{levelID}/markers.
type CreateMarkerRequest struct {
	Label       string        `json:"label"`
	Category    AssetCategory `json:"category"`
	XCoordinate float64       `json:"x_coordinate"`
	YCoordinate float64       `json:"y_coordinate"`
	Notes       string        `json:"notes"`
}
