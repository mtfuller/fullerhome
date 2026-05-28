package domain

import (
	"time"

	"github.com/google/uuid"
)

type LevelType string

const (
	LevelBasement LevelType = "BASEMENT"
	LevelGround   LevelType = "GROUND"
	LevelFloor1   LevelType = "FLOOR_1"
	LevelFloor2   LevelType = "FLOOR_2"
	LevelFloor3   LevelType = "FLOOR_3"
	LevelAttic    LevelType = "ATTIC"
	LevelGarage   LevelType = "GARAGE"
	LevelYard     LevelType = "YARD"
)

type MarkerCategory string

const (
	CategoryOutlet    MarkerCategory = "OUTLET"
	CategorySwitch    MarkerCategory = "SWITCH"
	CategoryAppliance MarkerCategory = "APPLIANCE"
	CategoryFurniture MarkerCategory = "FURNITURE"
	CategorySensor    MarkerCategory = "SENSOR"
	CategoryHVAC      MarkerCategory = "HVAC"
	CategoryPlumbing  MarkerCategory = "PLUMBING"
	CategoryLighting  MarkerCategory = "LIGHTING"
	CategoryDoor      MarkerCategory = "DOOR"
	CategoryWindow    MarkerCategory = "WINDOW"
	CategoryUtility   MarkerCategory = "UTILITY"
	CategoryStorage   MarkerCategory = "STORAGE"
	CategoryBreaker   MarkerCategory = "BREAKER"
)

// HomeLevel represents a single physical layer of the home.
type HomeLevel struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Type       LevelType `json:"type"`
	OrderIndex int       `json:"order_index"`
	WallsJSON  string    `json:"walls_json"`
	CreatedBy  string    `json:"created_by"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Room represents a named area on a level (e.g. "Kitchen", "Master Bedroom").
type Room struct {
	ID          uuid.UUID `json:"id"`
	LevelID     uuid.UUID `json:"level_id"`
	Name        string    `json:"name"`
	XCoordinate float64   `json:"x_coordinate"`
	YCoordinate float64   `json:"y_coordinate"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// AssetMarker defines a contextual point placed on a level.
type AssetMarker struct {
	ID          uuid.UUID      `json:"id"`
	LevelID     uuid.UUID      `json:"level_id"`
	Label       string         `json:"label"`
	Category    MarkerCategory `json:"category"`
	XCoordinate float64        `json:"x_coordinate"`
	YCoordinate float64        `json:"y_coordinate"`
	Notes       string         `json:"notes"`
	UpdatedAt   time.Time      `json:"updated_at"`
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

type CreateLevelRequest struct {
	Name      string    `json:"name"`
	Type      LevelType `json:"type"`
	CreatedBy string    `json:"created_by"`
}

type UpdateLevelRequest struct {
	Name      string    `json:"name"`
	Type      LevelType `json:"type"`
	WallsJSON string    `json:"walls_json"`
}

type CreateMarkerRequest struct {
	Label       string         `json:"label"`
	Category    MarkerCategory `json:"category"`
	XCoordinate float64        `json:"x_coordinate"`
	YCoordinate float64        `json:"y_coordinate"`
	Notes       string         `json:"notes"`
}

type UpdateMarkerRequest struct {
	Label       string         `json:"label"`
	Category    MarkerCategory `json:"category"`
	XCoordinate float64        `json:"x_coordinate"`
	YCoordinate float64        `json:"y_coordinate"`
	Notes       string         `json:"notes"`
}

type CreateRoomRequest struct {
	Name        string  `json:"name"`
	XCoordinate float64 `json:"x_coordinate"`
	YCoordinate float64 `json:"y_coordinate"`
}

type UpdateRoomRequest struct {
	Name        string  `json:"name"`
	XCoordinate float64 `json:"x_coordinate"`
	YCoordinate float64 `json:"y_coordinate"`
}
