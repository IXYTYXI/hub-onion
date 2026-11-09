package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/openclaw/clawhub/backend/internal/middleware"
	"github.com/openclaw/clawhub/backend/internal/service"
)

func ListCategoriesHandler(skillService *service.SkillService) gin.HandlerFunc {
	return func(c *gin.Context) {
		categories, err := skillService.ListCategories(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list categories"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": categories})
	}
}

func ListAdminCategoriesHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireSuperuser(c, authService) {
			return
		}
		result, err := skillService.ListCategoriesPage(c.Request.Context(), service.CategoryListOptions{
			Query:  strings.TrimSpace(c.Query("q")),
			Limit:  queryLimit(c, 20, 100),
			Cursor: strings.TrimSpace(c.Query("cursor")),
		})
		if err != nil {
			if service.IsCategoryValidationError(err) {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_category"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list categories"})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}

func CreateAdminCategoryHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireSuperuser(c, authService) {
			return
		}
		var body struct {
			Slug        string `json:"slug"`
			Name        string `json:"name"`
			Description string `json:"description"`
			SortOrder   int    `json:"sortOrder"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "code": "invalid_request"})
			return
		}
		category, err := skillService.CreateCategory(c.Request.Context(), body.Slug, body.Name, body.Description, body.SortOrder)
		if err != nil {
			writeCategoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, category)
	}
}

func UpdateAdminCategoryHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireSuperuser(c, authService) {
			return
		}
		var body struct {
			Name        *string `json:"name"`
			Description *string `json:"description"`
			SortOrder   *int    `json:"sortOrder"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "code": "invalid_request"})
			return
		}
		category, err := skillService.UpdateCategory(c.Request.Context(), c.Param("slug"), body.Name, body.Description, body.SortOrder)
		if err != nil {
			writeCategoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, category)
	}
}

func DeleteAdminCategoryHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireSuperuser(c, authService) {
			return
		}
		if err := skillService.DeleteCategory(c.Request.Context(), c.Param("slug")); err != nil {
			writeCategoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": "deleted"})
	}
}

func AdminSetSkillCategoriesHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireSuperuser(c, authService) {
			return
		}
		var body struct {
			CategorySlugs []string `json:"categorySlugs"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "code": "invalid_request"})
			return
		}
		categories, err := skillService.SetSkillCategories(c.Request.Context(), c.Param("slug"), body.CategorySlugs)
		if err != nil {
			if strings.Contains(err.Error(), "skill not found") {
				c.JSON(http.StatusNotFound, gin.H{"error": "skill not found", "code": "skill_not_found"})
				return
			}
			writeCategoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"categories": categories})
	}
}

func requireSuperuser(c *gin.Context, authService *service.AuthService) bool {
	actor := middleware.GetCurrentUser(c)
	if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
		c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
		return false
	}
	return true
}

func writeCategoryError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrCategoryExists):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "category_exists"})
	case service.IsCategoryValidationError(err):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_category"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "code": "category_error"})
	}
}
