package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/Masterminds/semver/v3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openclaw/clawhub/backend/internal/middleware"
	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/openclaw/clawhub/backend/internal/service"
	"github.com/openclaw/clawhub/backend/internal/skillmeta"
	"gorm.io/gorm"
)

var slugRegex = regexp.MustCompile(`^[a-z0-9-]+$`)

type publishConflictError struct {
	status  int
	code    string
	message string
}

func (e *publishConflictError) Error() string {
	return e.message
}

func PublishSkillHandler(skillService *service.SkillService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Parse multipart form
		if err := c.Request.ParseMultipartForm(52428800); err != nil { // 50MB
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse multipart form"})
			return
		}

		var payload model.PublishPayload
		if err := decodePublishPayload(c.Request.MultipartForm, &payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := validatePayload(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		normalizedDocumentationLinks, err := normalizeDocumentationLinks(payload.DocumentationLinks)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
				"code":  "invalid_documentation_link",
			})
			return
		}
		payload.DocumentationLinks = normalizedDocumentationLinks
		if err := skillService.ValidateCategorySlugs(c.Request.Context(), payload.CategorySlugs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_category"})
			return
		}

		// Get files
		filesFormData := c.Request.MultipartForm.File["files"]
		if len(filesFormData) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing files"})
			return
		}

		// Validate total size
		var totalSize int64
		for _, f := range filesFormData {
			totalSize += f.Size
		}
		if totalSize > 52428800 { // 50MB
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "total size exceeds 50MB limit"})
			return
		}

		description, hasDescription := extractPublishDescription(filesFormData)

		// Process files with streaming upload
		uploadedFiles, err := processFiles(c.Request.Context(), filesFormData, skillService, &payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Calculate version hash
		versionHash := skillService.CalculateVersionHash(uploadedFiles)

		// Get current user for ownership
		currentUser := middleware.GetCurrentUser(c)
		var ownerUserID *string
		if currentUser != nil {
			ownerUserID = &currentUser.ID
		}

		// Save to database in transaction
		var skillID, versionID string
		err = skillService.DB().Transaction(func(tx *gorm.DB) error {
			// Check if skill exists
			var skill model.Skill
			err := tx.Where("slug = ?", payload.Slug).First(&skill).Error
			if err == gorm.ErrRecordNotFound {
				documentationLinks := model.DocumentationLinkList{}
				if payload.DocumentationLinks != nil {
					documentationLinks = *payload.DocumentationLinks
				}
				// Create new skill
				skill = model.Skill{
					ID:                 uuid.New().String(),
					Slug:               payload.Slug,
					DisplayName:        payload.DisplayName,
					Description:        description,
					Tags:               payload.Tags,
					DocumentationLinks: documentationLinks,
					ModerationStatus:   "active",
					StatsVersions:      0,
					OwnerUserID:        ownerUserID,
				}
				if err := tx.Create(&skill).Error; err != nil {
					return fmt.Errorf("failed to create skill: %w", err)
				}
			} else if err != nil {
				return fmt.Errorf("failed to check skill: %w", err)
			} else if ownerUserID != nil && skill.OwnerUserID != nil && *skill.OwnerUserID != *ownerUserID {
				return &publishConflictError{
					status:  http.StatusForbidden,
					code:    "skill_owned_by_another_user",
					message: "skill owned by another user",
				}
			}

			skillID = skill.ID

			// Check if version already exists
			var existingVersion model.SkillVersion
			if err := tx.Where("skill_id = ? AND version = ?", skill.ID, payload.Version).
				First(&existingVersion).Error; err == nil {
				return &publishConflictError{
					status:  http.StatusConflict,
					code:    "version_exists",
					message: "version already exists",
				}
			}

			if err := skillService.SetSkillCategoriesTx(c.Request.Context(), tx, skill.ID, payload.CategorySlugs); err != nil {
				return err
			}

			// Create version
			var parsed json.RawMessage
			if payload.Source != nil {
				merged := map[string]interface{}{
					"source": payload.Source,
				}
				bytes, marshalErr := json.Marshal(merged)
				if marshalErr != nil {
					return fmt.Errorf("failed to encode source metadata: %w", marshalErr)
				}
				parsed = bytes
			}
			version := model.SkillVersion{
				ID:          uuid.New().String(),
				SkillID:     skill.ID,
				Version:     payload.Version,
				Changelog:   payload.Changelog,
				Files:       uploadedFiles,
				Parsed:      parsed,
				ContentHash: versionHash,
			}
			if err := tx.Create(&version).Error; err != nil {
				return fmt.Errorf("failed to create version: %w", err)
			}

			versionID = version.ID

			// Update skill
			updates := map[string]interface{}{
				"latest_version_id": version.ID,
				"stats_versions":    gorm.Expr("stats_versions + 1"),
			}
			if hasDescription {
				updates["description"] = description
			}
			if payload.DocumentationLinks != nil {
				updates["documentation_links"] = *payload.DocumentationLinks
			}
			if err := tx.Model(&skill).Updates(updates).Error; err != nil {
				return fmt.Errorf("failed to update skill: %w", err)
			}

			return nil
		})

		if err != nil {
			// Cleanup uploaded files
			cleanupFiles(c.Request.Context(), uploadedFiles, skillService)
			var conflictErr *publishConflictError
			if errors.As(err, &conflictErr) {
				c.JSON(conflictErr.status, gin.H{
					"error": conflictErr.message,
					"code":  conflictErr.code,
				})
				return
			}
			if service.IsCategoryValidationError(err) {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_category"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, model.PublishResponse{
			OK:        "true",
			SkillID:   skillID,
			VersionID: versionID,
		})
	}
}

func decodePublishPayload(form *multipart.Form, payload *model.PublishPayload) error {
	if form == nil {
		return fmt.Errorf("missing payload")
	}

	if values := form.Value["payload"]; len(values) > 0 {
		if err := json.Unmarshal([]byte(values[0]), payload); err != nil {
			return fmt.Errorf("invalid payload JSON")
		}
		return nil
	}

	payloadFiles := form.File["payload"]
	if len(payloadFiles) == 0 {
		return fmt.Errorf("missing payload")
	}

	payloadFile, err := payloadFiles[0].Open()
	if err != nil {
		return fmt.Errorf("cannot open payload")
	}
	defer payloadFile.Close()

	bytes, err := io.ReadAll(payloadFile)
	if err != nil {
		return fmt.Errorf("cannot open payload")
	}
	if err := json.Unmarshal(bytes, payload); err != nil {
		return fmt.Errorf("invalid payload JSON")
	}
	return nil
}

func validatePayload(payload *model.PublishPayload) error {
	// Validate slug
	if len(payload.Slug) < 3 || len(payload.Slug) > 50 {
		return fmt.Errorf("slug length must be 3-50 characters")
	}
	if !slugRegex.MatchString(payload.Slug) {
		return fmt.Errorf("invalid slug format")
	}

	// Validate version
	if _, err := semver.NewVersion(payload.Version); err != nil {
		return fmt.Errorf("invalid version format")
	}

	return nil
}

func normalizeDocumentationLinks(links *model.DocumentationLinkList) (*model.DocumentationLinkList, error) {
	return service.NormalizeDocumentationLinks(links)
}

func processFiles(ctx context.Context, filesFormData []*multipart.FileHeader, skillService *service.SkillService, payload *model.PublishPayload) ([]model.FileMetadata, error) {
	uploadedFiles := make([]model.FileMetadata, len(filesFormData))
	errors := make([]error, len(filesFormData))

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 5) // Limit concurrency to 5

	for i, fileHeader := range filesFormData {
		wg.Add(1)
		go func(idx int, fh *multipart.FileHeader) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			file, err := fh.Open()
			if err != nil {
				errors[idx] = fmt.Errorf("failed to open file: %w", err)
				return
			}
			defer file.Close()

			filePath := publishFilePath(fh)
			if filePath == "" {
				errors[idx] = fmt.Errorf("empty file path")
				return
			}

			// Validate file type
			if !isTextFile(filePath) {
				errors[idx] = fmt.Errorf("binary files not allowed: %s", fh.Filename)
				return
			}

			// Generate storage key
			skillID := uuid.New().String() // Temporary, will be replaced
			versionID := uuid.New().String()
			storageKey := service.GenerateStorageKey(skillID, versionID, filePath)

			contentType := normalizeUploadContentType(filePath, fh.Header.Get("Content-Type"))

			// Upload with hash calculation
			hash, err := skillService.StorageService().UploadWithHash(ctx, storageKey, file, contentType)
			if err != nil {
				errors[idx] = fmt.Errorf("failed to upload file: %w", err)
				return
			}

			uploadedFiles[idx] = model.FileMetadata{
				Path:        filePath,
				Size:        fh.Size,
				StorageKey:  storageKey,
				SHA256:      hash,
				ContentType: contentType,
			}
		}(i, fileHeader)
	}

	wg.Wait()

	// Check for errors
	for _, err := range errors {
		if err != nil {
			return nil, err
		}
	}

	return uploadedFiles, nil
}

func isTextFile(filename string) bool {
	_, ok := textExtensions[strings.ToLower(filepath.Ext(filename))]
	return ok
}

func extractPublishDescription(filesFormData []*multipart.FileHeader) (string, bool) {
	candidates := make([]*multipart.FileHeader, 0, 2)
	for _, fileHeader := range filesFormData {
		if skillmeta.IsPrimaryReadmePath(publishFilePath(fileHeader)) {
			candidates = append(candidates, fileHeader)
		}
	}
	sortPrimaryReadmeCandidates(candidates)

	for _, fileHeader := range candidates {
		file, err := fileHeader.Open()
		if err != nil {
			continue
		}
		bytes, err := io.ReadAll(file)
		closeErr := file.Close()
		if err != nil || closeErr != nil {
			continue
		}
		if description, ok := skillmeta.ExtractFrontmatterDescription(string(bytes)); ok {
			return description, true
		}
	}
	return "", false
}

func sortPrimaryReadmeCandidates(candidates []*multipart.FileHeader) {
	if len(candidates) < 2 {
		return
	}
	for i := 0; i < len(candidates)-1; i++ {
		for j := i + 1; j < len(candidates); j++ {
			if primaryReadmePriority(publishFilePath(candidates[j])) < primaryReadmePriority(publishFilePath(candidates[i])) {
				candidates[i], candidates[j] = candidates[j], candidates[i]
			}
		}
	}
}

func primaryReadmePriority(path string) int {
	return skillmeta.PrimaryReadmePriority(path)
}

func publishFilePath(fileHeader *multipart.FileHeader) string {
	contentDisposition := fileHeader.Header.Get("Content-Disposition")
	if _, params, err := mime.ParseMediaType(contentDisposition); err == nil {
		if filename := params["filename"]; filename != "" {
			return skillmeta.NormalizePath(filename)
		}
	}
	return skillmeta.NormalizePath(fileHeader.Filename)
}

func cleanupFiles(ctx context.Context, files []model.FileMetadata, skillService *service.SkillService) {
	for _, file := range files {
		skillService.StorageService().Delete(ctx, file.StorageKey)
	}
}
