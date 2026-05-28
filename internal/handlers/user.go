package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mtfuller/starterpack-go-gin/internal/database"
	"github.com/mtfuller/starterpack-go-gin/internal/models"
	"github.com/mtfuller/starterpack-go-gin/pkg/logger"
)

// UserHandler handles user-related requests
type UserHandler struct {
	db     *database.DB
	logger *logger.Logger
}

// NewUserHandler creates a new user handler
func NewUserHandler(db *database.DB, log *logger.Logger) *UserHandler {
	return &UserHandler{
		db:     db,
		logger: log,
	}
}

// CreateUserRequest represents the request body for creating a user
type CreateUserRequest struct {
	Email string `json:"email" binding:"required,email"`
	Name  string `json:"name" binding:"required"`
}

// Create handles POST /users
func (h *UserHandler) Create(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user := models.User{
		Email:  req.Email,
		Name:   req.Name,
		Active: true,
	}

	if err := h.db.Create(&user).Error; err != nil {
		h.logger.WithField("error", err.Error()).Error("Failed to create user")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	h.logger.WithField("user_id", user.ID).Info("User created successfully")
	c.JSON(http.StatusCreated, user)
}

// List handles GET /users
func (h *UserHandler) List(c *gin.Context) {
	var users []models.User

	if err := h.db.Find(&users).Error; err != nil {
		h.logger.WithField("error", err.Error()).Error("Failed to list users")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// Get handles GET /users/:id
func (h *UserHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var user models.User

	if err := h.db.First(&user, id).Error; err != nil {
		h.logger.WithFields(map[string]interface{}{
			"user_id": id,
			"error":   err.Error(),
		}).Warn("User not found")
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// Delete handles DELETE /users/:id
func (h *UserHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	var user models.User

	if err := h.db.First(&user, id).Error; err != nil {
		h.logger.WithFields(map[string]interface{}{
			"user_id": id,
			"error":   err.Error(),
		}).Warn("User not found for deletion")
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if err := h.db.Delete(&user).Error; err != nil {
		h.logger.WithField("error", err.Error()).Error("Failed to delete user")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	h.logger.WithField("user_id", id).Info("User deleted successfully")
	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}
