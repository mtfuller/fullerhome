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
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	Type           LevelType `json:"type"`
	OrderIndex     int       `json:"order_index"`
	WallsJSON      string    `json:"walls_json"`
	MapConfigJSON  string    `json:"map_config_json"`
	CreatedBy      string    `json:"created_by"`
	UpdatedAt      time.Time `json:"updated_at"`
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

type ZoneType string

const (
	ZoneGrass     ZoneType = "GRASS"
	ZoneDriveway  ZoneType = "DRIVEWAY"
	ZoneFlowerBed ZoneType = "FLOWER_BED"
	ZonePatio     ZoneType = "PATIO"
	ZoneDeck      ZoneType = "DECK"
	ZoneGarden    ZoneType = "GARDEN"
	ZonePool      ZoneType = "POOL"
	ZoneSidewalk  ZoneType = "SIDEWALK"
	ZoneParking   ZoneType = "PARKING"
)

// Zone represents a named filled area on a level (grass, driveway, flower bed, etc.).
type Zone struct {
	ID         uuid.UUID `json:"id"`
	LevelID    uuid.UUID `json:"level_id"`
	Name       string    `json:"name"`
	Type       ZoneType  `json:"type"`
	PointsJSON string    `json:"points_json"`
	UpdatedAt  time.Time `json:"updated_at"`
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
	Name          string    `json:"name"`
	Type          LevelType `json:"type"`
	WallsJSON     string    `json:"walls_json"`
	MapConfigJSON string    `json:"map_config_json"`
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

type CreateZoneRequest struct {
	Name       string   `json:"name"`
	Type       ZoneType `json:"type"`
	PointsJSON string   `json:"points_json"`
}

type UpdateZoneRequest struct {
	Name       string   `json:"name"`
	Type       ZoneType `json:"type"`
	PointsJSON string   `json:"points_json"`
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

// BreakerType describes the kind of breaker occupying a panel slot.
type BreakerType string

const (
	BreakerSingle BreakerType = "SINGLE" // 120V, 1 slot
	BreakerDouble BreakerType = "DOUBLE" // 240V, 2 slots (occupies two consecutive slots)
	BreakerGFCI   BreakerType = "GFCI"  // 120V GFCI
	BreakerAFCI   BreakerType = "AFCI"  // 120V AFCI
	BreakerTandem BreakerType = "TANDEM" // 2×120V, 1 physical slot
)

// BreakerPanel represents the configuration of a breaker box linked to a BREAKER asset marker.
type BreakerPanel struct {
	ID          uuid.UUID `json:"id"`
	MarkerID    uuid.UUID `json:"marker_id"`
	TotalSlots  int       `json:"total_slots"`
	Notes       string    `json:"notes"`
	UpdatedAt   time.Time `json:"updated_at"`
	MarkerLabel string    `json:"marker_label"`
	LevelID     uuid.UUID `json:"level_id"`
}

// Circuit represents a single breaker slot in a panel.
type Circuit struct {
	ID          uuid.UUID   `json:"id"`
	PanelID     uuid.UUID   `json:"panel_id"`
	SlotNumber  int         `json:"slot_number"`
	Label       string      `json:"label"`
	Amperage    int         `json:"amperage"`
	BreakerType BreakerType `json:"breaker_type"`
	Notes       string      `json:"notes"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// CircuitConnection links a circuit to an outlet/switch/appliance marker it powers.
type CircuitConnection struct {
	ID             uuid.UUID      `json:"id"`
	CircuitID      uuid.UUID      `json:"circuit_id"`
	MarkerID       uuid.UUID      `json:"marker_id"`
	Notes          string         `json:"notes"`
	UpdatedAt      time.Time      `json:"updated_at"`
	MarkerLabel    string         `json:"marker_label"`
	MarkerCategory MarkerCategory `json:"marker_category"`
	LevelID        uuid.UUID      `json:"level_id"`
}

type CreateBreakerPanelRequest struct {
	MarkerID   string `json:"marker_id"`
	TotalSlots int    `json:"total_slots"`
	Notes      string `json:"notes"`
}

type UpdateBreakerPanelRequest struct {
	TotalSlots int    `json:"total_slots"`
	Notes      string `json:"notes"`
}

type CreateCircuitRequest struct {
	SlotNumber  int         `json:"slot_number"`
	Label       string      `json:"label"`
	Amperage    int         `json:"amperage"`
	BreakerType BreakerType `json:"breaker_type"`
	Notes       string      `json:"notes"`
}

type UpdateCircuitRequest struct {
	SlotNumber  int         `json:"slot_number"`
	Label       string      `json:"label"`
	Amperage    int         `json:"amperage"`
	BreakerType BreakerType `json:"breaker_type"`
	Notes       string      `json:"notes"`
}

type CreateCircuitConnectionRequest struct {
	MarkerID string `json:"marker_id"`
	Notes    string `json:"notes"`
}

type EventType string

const (
	EventInspected EventType = "INSPECTED"
	EventReplaced  EventType = "REPLACED"
	EventServiced  EventType = "SERVICED"
	EventRepaired  EventType = "REPAIRED"
	EventCleaned   EventType = "CLEANED"
	EventNote      EventType = "NOTE"
)

// MarkerEvent is a timestamped log entry attached to an asset marker.
type MarkerEvent struct {
	ID        int64     `json:"id"`
	MarkerID  uuid.UUID `json:"marker_id"`
	EventType EventType `json:"event_type"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateMarkerEventRequest struct {
	EventType EventType `json:"event_type"`
	Note      string    `json:"note"`
}
