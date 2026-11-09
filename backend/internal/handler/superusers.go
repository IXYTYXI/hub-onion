package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/openclaw/clawhub/backend/internal/middleware"
	"github.com/openclaw/clawhub/backend/internal/service"
)

func ListAdminSuperusersHandler(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireSuperuser(c, authService) {
			return
		}
		dynamic, err := authService.ListDynamicSuperusers(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list superusers", "code": "superuser_list_failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"configured": authService.ListConfiguredSuperusers(),
			"dynamic":    dynamic,
		})
	}
}

func CreateAdminSuperuserHandler(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireSuperuser(c, authService) {
			return
		}
		var body struct {
			Email string `json:"email"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "code": "invalid_request"})
			return
		}
		actor := middleware.GetCurrentUser(c)
		actorID := ""
		if actor != nil {
			actorID = actor.ID
		}
		grant, err := authService.CreateDynamicSuperuser(c.Request.Context(), body.Email, actorID)
		if err != nil {
			writeSuperuserGrantError(c, err)
			return
		}
		c.JSON(http.StatusOK, grant)
	}
}

func DeleteAdminSuperuserHandler(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireSuperuser(c, authService) {
			return
		}
		if err := authService.DeleteDynamicSuperuser(c.Request.Context(), c.Query("email")); err != nil {
			writeSuperuserGrantError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": "deleted"})
	}
}

func SyncAdminSuperuserCacheHandler(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireSuperuser(c, authService) {
			return
		}
		result, err := authService.SyncSuperuserCache(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync superuser cache", "code": "superuser_cache_sync_failed"})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}

func writeSuperuserGrantError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrSuperuserGrantExists):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error(), "code": "superuser_exists"})
	case errors.Is(err, service.ErrConfiguredSuperuserReadOnly):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error(), "code": "config_superuser_readonly"})
	case errors.Is(err, service.ErrInvalidSuperuserGrant):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_superuser"})
	case errors.Is(err, service.ErrSuperuserGrantNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error(), "code": "superuser_not_found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to manage superuser", "code": "superuser_operation_failed"})
	}
}
