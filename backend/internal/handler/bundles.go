package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/openclaw/clawhub/backend/internal/middleware"
	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/openclaw/clawhub/backend/internal/service"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func ListBundlesHandler(bundleService *service.BundleService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 25
		if l := c.Query("limit"); l != "" {
			if _, err := fmt.Sscanf(l, "%d", &limit); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
				return
			}
		}

		cursor := c.Query("cursor")
		var cursorPtr *string
		if cursor != "" {
			cursorPtr = &cursor
		}

		result, err := bundleService.ListBundles(c.Request.Context(), service.BundleListOptions{
			Limit:        limit,
			Cursor:       cursorPtr,
			Sort:         c.Query("sort"),
			Dir:          c.Query("dir"),
			CategorySlug: strings.TrimSpace(c.Query("category")),
			OwnerHandle:  strings.TrimSpace(c.Query("owner")),
			Query:        strings.TrimSpace(c.Query("q")),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, result)
	}
}

func GetBundleHandler(bundleService *service.BundleService) gin.HandlerFunc {
	return func(c *gin.Context) {
		result, err := bundleService.GetBundle(c.Request.Context(), c.Param("slug"))
		if err != nil {
			if errors.Is(err, service.ErrBundleNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "bundle not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, result)
	}
}

func PublishBundleHandler(bundleService *service.BundleService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload model.PublishBundlePayload
		if err := json.NewDecoder(c.Request.Body).Decode(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		currentUser := middleware.GetCurrentUser(c)
		canManageExisting := authService != nil && authService.IsSuperuser(currentUser)
		result, err := bundleService.UpsertBundle(c.Request.Context(), payload, currentUser.ID, canManageExisting)
		if err != nil {
			switch {
			case errors.Is(err, service.ErrInvalidDocumentationLink):
				c.JSON(http.StatusBadRequest, gin.H{
					"error": err.Error(),
					"code":  "invalid_documentation_link",
				})
			case errors.Is(err, service.ErrBundleInvalid), service.IsCategoryValidationError(err):
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			case errors.Is(err, service.ErrBundlePermissionDenied):
				c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
		}

		c.JSON(http.StatusOK, result)
	}
}

func DeleteBundleHandler(bundleService *service.BundleService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		slug := c.Param("slug")
		currentUser := middleware.GetCurrentUser(c)

		var bundle model.SkillBundle
		if err := bundleService.DB().Where("slug = ? AND is_deleted = ?", slug, false).First(&bundle).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "bundle not found"})
			return
		}
		if !bundleService.CanManageBundle(currentUser, &bundle, authService) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}

		if err := bundleService.DeleteBundle(c.Request.Context(), slug); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": "true"})
	}
}

func UndeleteBundleHandler(bundleService *service.BundleService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		slug := c.Param("slug")
		currentUser := middleware.GetCurrentUser(c)

		var bundle model.SkillBundle
		if err := bundleService.DB().Where("slug = ? AND is_deleted = ?", slug, true).First(&bundle).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"error": "bundle not found or not deleted"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load bundle"})
			return
		}
		if !bundleService.CanManageBundle(currentUser, &bundle, authService) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}

		if err := bundleService.UndeleteBundle(c.Request.Context(), slug); err != nil {
			if errors.Is(err, service.ErrBundleNotDeleted) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "bundle not found or not deleted"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": "true"})
	}
}

func DownloadBundleHandler(bundleService *service.BundleService) gin.HandlerFunc {
	return func(c *gin.Context) {
		slug := c.Param("slug")

		var zipBuffer bytes.Buffer
		missingSkills, err := bundleService.GenerateBundleZip(c.Request.Context(), slug, &zipBuffer)
		if err != nil {
			if errors.Is(err, service.ErrBundleNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "bundle not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var bundle model.SkillBundle
		if err := bundleService.DB().Where("slug = ? AND is_deleted = ?", slug, false).First(&bundle).Error; err == nil {
			if err := bundleService.IncrementDownloadAndInstallStats(c.Request.Context(), bundle.ID); err != nil {
				logrus.WithError(err).
					WithField("bundle_id", bundle.ID).
					WithField("slug", bundle.Slug).
					Warn("failed to update bundle download/install stats")
			}
		}

		filename := fmt.Sprintf("%s.zip", slug)
		if len(missingSkills) > 0 {
			c.Header("X-Bundle-Missing-Skills", strings.Join(missingSkills, ","))
		}
		c.Header("Content-Type", "application/zip")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		c.Data(http.StatusOK, "application/zip", zipBuffer.Bytes())
	}
}

func GetMyBundlesHandler(bundleService *service.BundleService) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentUser := middleware.GetCurrentUser(c)
		limit := queryLimit(c, 25, 100)
		cursor := strings.TrimSpace(c.Query("cursor"))
		var cursorPtr *string
		if cursor != "" {
			cursorPtr = &cursor
		}
		result, err := bundleService.ListBundles(c.Request.Context(), service.BundleListOptions{
			Limit:       limit,
			Cursor:      cursorPtr,
			Sort:        c.Query("sort"),
			Dir:         c.Query("dir"),
			OwnerUserID: &currentUser.ID,
			Query:       strings.TrimSpace(c.Query("q")),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list bundles"})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}

func ListAdminBundlesHandler(bundleService *service.BundleService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}

		result, err := bundleService.ListBundles(c.Request.Context(), service.BundleListOptions{
			Limit:          queryLimit(c, 100, 200),
			Sort:           c.Query("sort"),
			Dir:            c.Query("dir"),
			OwnerHandle:    strings.TrimSpace(c.Query("owner")),
			Query:          strings.TrimSpace(c.Query("q")),
			Status:         strings.TrimSpace(c.Query("status")),
			IncludeDeleted: true,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list bundles"})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}

func GetAdminBundleDetailHandler(bundleService *service.BundleService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}

		var bundle model.SkillBundle
		if err := bundleService.DB().Where("slug = ?", c.Param("slug")).First(&bundle).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "bundle not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load bundle"})
			return
		}
		item, err := bundleService.BundleToItem(c.Request.Context(), &bundle)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load bundle"})
			return
		}
		detail, err := bundleService.GetBundle(c.Request.Context(), c.Param("slug"))
		if err != nil && !bundle.IsDeleted {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load bundle detail"})
			return
		}

		resp := gin.H{
			"bundle":    adminBundleListItem(item, &bundle),
			"isDeleted": bundle.IsDeleted,
			"status":    bundleStatus(&bundle),
		}
		if detail != nil {
			resp["skills"] = detail.Skills
			resp["missingSkills"] = detail.MissingSkills
		}
		c.JSON(http.StatusOK, resp)
	}
}

func AdminDeleteBundleHandler(bundleService *service.BundleService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}
		if err := bundleService.DeleteBundle(c.Request.Context(), c.Param("slug")); err != nil {
			if errors.Is(err, service.ErrBundleNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "bundle not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete bundle"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": "deleted"})
	}
}

func AdminUndeleteBundleHandler(bundleService *service.BundleService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}
		if err := bundleService.UndeleteBundle(c.Request.Context(), c.Param("slug")); err != nil {
			if errors.Is(err, service.ErrBundleNotDeleted) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "bundle not found or not deleted"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to undelete bundle"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": "undeleted"})
	}
}

func AdminSetBundleCategoriesHandler(bundleService *service.BundleService, authService *service.AuthService) gin.HandlerFunc {
	type requestBody struct {
		CategorySlugs []string `json:"categorySlugs"`
	}

	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}

		var body requestBody
		if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		categories, err := bundleService.SetBundleCategories(c.Request.Context(), c.Param("slug"), body.CategorySlugs)
		if err != nil {
			switch {
			case errors.Is(err, service.ErrBundleNotFound):
				c.JSON(http.StatusNotFound, gin.H{"error": "bundle not found"})
			case service.IsCategoryValidationError(err):
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_category"})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update bundle categories"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok":         "updated",
			"categories": categories,
		})
	}
}

func adminBundleListItem(item model.BundleItem, bundle *model.SkillBundle) gin.H {
	return gin.H{
		"id":                 bundle.ID,
		"slug":               item.Slug,
		"displayName":        item.DisplayName,
		"description":        item.Description,
		"documentationLinks": item.DocumentationLinks,
		"summary":            item.Summary,
		"owner":              item.Owner,
		"categories":         item.Categories,
		"stats":              item.Stats,
		"skills":             item.Skills,
		"createdAt":          item.CreatedAt,
		"updatedAt":          item.UpdatedAt,
		"isDeleted":          bundle.IsDeleted,
		"status":             bundleStatus(bundle),
	}
}

func bundleStatus(bundle *model.SkillBundle) string {
	if bundle.IsDeleted {
		return "deleted"
	}
	return "active"
}
