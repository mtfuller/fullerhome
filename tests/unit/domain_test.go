package unit_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/mtfuller/fullerhome/internal/domain"
	"github.com/stretchr/testify/assert"
)

func TestLevelType_Constants(t *testing.T) {
	assert.Equal(t, domain.LevelType("YARD"), domain.LevelYard)
	assert.Equal(t, domain.LevelType("BASEMENT"), domain.LevelBasement)
	assert.Equal(t, domain.LevelType("MAIN"), domain.LevelMain)
	assert.Equal(t, domain.LevelType("UPPER"), domain.LevelUpper)
}

func TestAssetCategory_Constants(t *testing.T) {
	assert.Equal(t, domain.AssetCategory("UTILITY"), domain.CategoryUtility)
	assert.Equal(t, domain.AssetCategory("STORAGE"), domain.CategoryStorage)
	assert.Equal(t, domain.AssetCategory("PEST"), domain.CategoryPest)
	assert.Equal(t, domain.AssetCategory("WORKSHOP"), domain.CategoryWorkshop)
}

func TestSpatialLevel_Fields(t *testing.T) {
	id := uuid.New()
	level := domain.SpatialLevel{
		ID:        id,
		Name:      "Main Floor",
		Type:      domain.LevelMain,
		WallsJSON: `[{"points":[{"x":0,"y":0},{"x":100,"y":0}],"closed":false}]`,
	}
	assert.Equal(t, id, level.ID)
	assert.Equal(t, "Main Floor", level.Name)
	assert.Equal(t, domain.LevelMain, level.Type)
}

func TestAssetMarker_CoordinateRange(t *testing.T) {
	marker := domain.AssetMarker{
		ID:          uuid.New(),
		LevelID:     uuid.New(),
		Label:       "Main Breaker",
		Category:    domain.CategoryUtility,
		XCoordinate: 42.5,
		YCoordinate: 18.3,
	}
	assert.InDelta(t, 42.5, marker.XCoordinate, 0.001)
	assert.InDelta(t, 18.3, marker.YCoordinate, 0.001)
	assert.Equal(t, domain.CategoryUtility, marker.Category)
}
