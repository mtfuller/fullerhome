package unit_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/mtfuller/fullerhome/internal/domain"
	"github.com/stretchr/testify/assert"
)

func TestLevelType_Constants(t *testing.T) {
	assert.Equal(t, domain.LevelType("BASEMENT"), domain.LevelBasement)
	assert.Equal(t, domain.LevelType("GROUND"), domain.LevelGround)
	assert.Equal(t, domain.LevelType("FLOOR_1"), domain.LevelFloor1)
	assert.Equal(t, domain.LevelType("FLOOR_2"), domain.LevelFloor2)
	assert.Equal(t, domain.LevelType("ATTIC"), domain.LevelAttic)
	assert.Equal(t, domain.LevelType("GARAGE"), domain.LevelGarage)
	assert.Equal(t, domain.LevelType("YARD"), domain.LevelYard)
}

func TestMarkerCategory_Constants(t *testing.T) {
	assert.Equal(t, domain.MarkerCategory("OUTLET"), domain.CategoryOutlet)
	assert.Equal(t, domain.MarkerCategory("SWITCH"), domain.CategorySwitch)
	assert.Equal(t, domain.MarkerCategory("APPLIANCE"), domain.CategoryAppliance)
	assert.Equal(t, domain.MarkerCategory("SENSOR"), domain.CategorySensor)
	assert.Equal(t, domain.MarkerCategory("UTILITY"), domain.CategoryUtility)
	assert.Equal(t, domain.MarkerCategory("BREAKER"), domain.CategoryBreaker)
}

func TestHomeLevel_Fields(t *testing.T) {
	id := uuid.New()
	level := domain.HomeLevel{
		ID:        id,
		Name:      "Ground Floor",
		Type:      domain.LevelGround,
		WallsJSON: `[{"id":"abc","points":[{"x":0,"y":0},{"x":100,"y":0}],"closed":false}]`,
	}
	assert.Equal(t, id, level.ID)
	assert.Equal(t, "Ground Floor", level.Name)
	assert.Equal(t, domain.LevelGround, level.Type)
}

func TestAssetMarker_CoordinateRange(t *testing.T) {
	marker := domain.AssetMarker{
		ID:          uuid.New(),
		LevelID:     uuid.New(),
		Label:       "Main Breaker",
		Category:    domain.CategoryBreaker,
		XCoordinate: 42.5,
		YCoordinate: 18.3,
	}
	assert.InDelta(t, 42.5, marker.XCoordinate, 0.001)
	assert.InDelta(t, 18.3, marker.YCoordinate, 0.001)
	assert.Equal(t, domain.CategoryBreaker, marker.Category)
}

func TestRoom_Fields(t *testing.T) {
	levelID := uuid.New()
	room := domain.Room{
		ID:          uuid.New(),
		LevelID:     levelID,
		Name:        "Kitchen",
		XCoordinate: 50.0,
		YCoordinate: 50.0,
	}
	assert.Equal(t, levelID, room.LevelID)
	assert.Equal(t, "Kitchen", room.Name)
}
