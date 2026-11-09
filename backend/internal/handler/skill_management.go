package handler

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/openclaw/clawhub/backend/internal/middleware"
	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/openclaw/clawhub/backend/internal/service"
	"gorm.io/gorm"
)

const maxSkillExportRows = 5000

func GetMySkillsHandler(skillService *service.SkillService) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := middleware.GetCurrentUser(c)
		statusFilter := strings.TrimSpace(c.Query("status"))
		items, err := listManagedSkills(c.Request.Context(), skillService, managedSkillListOptions{
			OwnerUserID:    &user.ID,
			Status:         statusFilter,
			IncludeDeleted: statusFilter == "" || statusFilter == "deleted",
			IncludeOwner:   false,
			Query:          strings.TrimSpace(c.Query("q")),
			Limit:          queryLimit(c, 100, 200),
			SortColumn:     "updated_at",
			SortDirection:  "DESC",
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list skills"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

func GetMySkillDetailHandler(skillService *service.SkillService) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := middleware.GetCurrentUser(c)
		skill, versions, owner, err := loadManagedSkillDetail(c.Request.Context(), skillService, c.Param("slug"))
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "skill not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load skill"})
			return
		}
		if skill.OwnerUserID == nil || *skill.OwnerUserID != user.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}

		c.JSON(http.StatusOK, managedSkillDetailResponse(skillService, skill, versions, owner))
	}
}

func ListAdminSkillsHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}

		opts, ok := parseAdminManagedSkillListOptions(c)
		if !ok {
			return
		}
		opts.IncludeDeleted = true
		opts.IncludeOwner = true
		opts.Limit = queryLimit(c, 100, 200)

		items, err := listManagedSkills(c.Request.Context(), skillService, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list skills"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

func ExportAdminSkillsHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}

		opts, ok := parseAdminManagedSkillListOptions(c)
		if !ok {
			return
		}
		opts.IncludeDeleted = true
		opts.IncludeOwner = true
		opts.Limit = maxSkillExportRows + 1

		items, err := listManagedSkills(c.Request.Context(), skillService, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to export skills"})
			return
		}
		if len(items) > maxSkillExportRows {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("export exceeds %d row limit; narrow filters", maxSkillExportRows),
			})
			return
		}

		filename := shanghaiExportFilename(time.Now())
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		c.Status(http.StatusOK)

		// UTF-8 BOM so Excel opens Chinese headers correctly.
		_, _ = c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

		writer := csv.NewWriter(c.Writer)
		_ = writer.Write([]string{
			"Slug",
			"Skill 名称",
			"用户 Handle",
			"用户昵称",
			"用户邮箱",
			"状态",
			"创建时间",
			"最近更新时间",
			"最新版本",
			"提交时间",
			"精选",
		})
		for _, item := range items {
			_ = writer.Write(managedSkillCSVRow(item))
		}
		writer.Flush()
		if err := writer.Error(); err != nil {
			return
		}
	}
}

func GetAdminSkillDetailHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}

		skill, versions, owner, err := loadManagedSkillDetail(c.Request.Context(), skillService, c.Param("slug"))
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "skill not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load skill"})
			return
		}

		c.JSON(http.StatusOK, managedSkillDetailResponse(skillService, skill, versions, owner))
	}
}

func AdminDeleteSkillHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}
		if err := skillService.DeleteSkill(c.Request.Context(), c.Param("slug")); err != nil {
			if err.Error() == "skill not found" {
				c.JSON(http.StatusNotFound, gin.H{"error": "skill not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete skill"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": "deleted"})
	}
}

func AdminUndeleteSkillHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}
		if err := skillService.UndeleteSkill(c.Request.Context(), c.Param("slug")); err != nil {
			if err.Error() == "skill not found or not deleted" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "skill not found or not deleted"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to undelete skill"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": "undeleted"})
	}
}

func AdminSetSkillHighlightedHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	type requestBody struct {
		Highlighted bool `json:"highlighted"`
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

		if err := skillService.SetSkillHighlighted(c.Request.Context(), c.Param("slug"), body.Highlighted); err != nil {
			if err.Error() == "skill not found" {
				c.JSON(http.StatusNotFound, gin.H{"error": "skill not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update highlighted status"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok":          "updated",
			"highlighted": body.Highlighted,
		})
	}
}

type managedSkillListOptions struct {
	OwnerUserID    *string
	OwnerHandle    string
	Status         string
	Query          string
	IncludeDeleted bool
	IncludeOwner   bool
	Limit          int
	SortColumn     string
	SortDirection  string
	TimeField      string
	CreatedFrom    *time.Time
	CreatedTo      *time.Time
}

func parseAdminManagedSkillListOptions(c *gin.Context) (managedSkillListOptions, bool) {
	sortColumn, sortDirection, err := parseManagedSkillOrdering(c.Query("sort"), c.Query("dir"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return managedSkillListOptions{}, false
	}
	timeField, err := parseManagedSkillTimeField(c.Query("timeField"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return managedSkillListOptions{}, false
	}
	timeRange, err := parseCreatedTimeRange(c.Query("createdFrom"), c.Query("createdTo"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return managedSkillListOptions{}, false
	}

	return managedSkillListOptions{
		Status:        strings.TrimSpace(c.Query("status")),
		Query:         strings.TrimSpace(c.Query("q")),
		OwnerHandle:   strings.TrimSpace(c.Query("owner")),
		SortColumn:    sortColumn,
		SortDirection: sortDirection,
		TimeField:     timeField,
		CreatedFrom:   timeRange.From,
		CreatedTo:     timeRange.To,
	}, true
}

func listManagedSkills(ctx context.Context, skillService *service.SkillService, opts managedSkillListOptions) ([]gin.H, error) {
	db := skillService.DB().WithContext(ctx).Model(&model.Skill{}).Preload("LatestVersion")
	if opts.OwnerUserID != nil {
		db = db.Where("skills.owner_user_id = ?", *opts.OwnerUserID)
	}
	if opts.OwnerHandle != "" {
		var owner model.User
		if err := skillService.DB().WithContext(ctx).Where("handle = ?", opts.OwnerHandle).First(&owner).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return []gin.H{}, nil
			}
			return nil, err
		}
		db = db.Where("skills.owner_user_id = ?", owner.ID)
	}
	switch opts.Status {
	case "active":
		db = db.Where("skills.is_deleted = ?", false)
	case "deleted":
		db = db.Where("skills.is_deleted = ?", true)
	default:
		if !opts.IncludeDeleted {
			db = db.Where("skills.is_deleted = ?", false)
		}
	}
	if opts.Query != "" {
		like := "%" + opts.Query + "%"
		db = db.Where("skills.slug ILIKE ? OR skills.display_name ILIKE ?", like, like)
	}

	timeField := opts.TimeField
	if timeField == "" {
		timeField = "created_at"
	}
	needsVersionJoin := timeField == "submitted_at" || opts.SortColumn == "submitted_at"
	if needsVersionJoin {
		joinType := "LEFT"
		if timeField == "submitted_at" && (opts.CreatedFrom != nil || opts.CreatedTo != nil) {
			// Filtering by submit time excludes skills without a latest version.
			joinType = "INNER"
		}
		db = db.Joins(fmt.Sprintf(
			"%s JOIN skill_versions ON skill_versions.id = skills.latest_version_id",
			joinType,
		))
	}

	switch timeField {
	case "submitted_at":
		if opts.CreatedFrom != nil {
			db = db.Where("skill_versions.created_at >= ?", *opts.CreatedFrom)
		}
		if opts.CreatedTo != nil {
			db = db.Where("skill_versions.created_at <= ?", *opts.CreatedTo)
		}
	default:
		if opts.CreatedFrom != nil {
			db = db.Where("skills.created_at >= ?", *opts.CreatedFrom)
		}
		if opts.CreatedTo != nil {
			db = db.Where("skills.created_at <= ?", *opts.CreatedTo)
		}
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = 100
	}
	sortColumn := opts.SortColumn
	if sortColumn == "" {
		sortColumn = "updated_at"
	}
	sortDirection := opts.SortDirection
	if sortDirection == "" {
		sortDirection = "DESC"
	}

	var skills []model.Skill
	query := db.Select("skills.*")
	if sortColumn == "submitted_at" {
		query = query.Order(fmt.Sprintf("skill_versions.created_at %s NULLS LAST", sortDirection))
	} else {
		query = query.Order(fmt.Sprintf("skills.%s %s", sortColumn, sortDirection))
	}
	if err := query.Order("skills.id ASC").
		Limit(limit).
		Find(&skills).Error; err != nil {
		return nil, err
	}

	ownersByID, err := loadOwnersByID(skillService, skills)
	if err != nil {
		return nil, err
	}
	skillItems, err := skillService.SkillsToItems(ctx, skills)
	if err != nil {
		return nil, err
	}

	items := make([]gin.H, 0, len(skills))
	for i := range skills {
		item := managedSkillListItem(skillItems[i], &skills[i], ownersByID[ownerID(skills[i].OwnerUserID)], opts.IncludeOwner)
		items = append(items, item)
	}
	return items, nil
}

func managedSkillCSVRow(item gin.H) []string {
	ownerHandle := ""
	ownerDisplayName := ""
	ownerEmail := ""
	if owner, ok := item["owner"].(gin.H); ok && owner != nil {
		if handle, ok := owner["handle"].(string); ok {
			ownerHandle = handle
		}
		if displayName, ok := owner["displayName"].(string); ok {
			ownerDisplayName = displayName
		}
		if email, ok := owner["email"].(string); ok {
			ownerEmail = email
		}
	}

	latestVersion := ""
	latestVersionCreatedAt := ""
	if lv, ok := item["latestVersion"].(*model.VersionInfo); ok && lv != nil {
		latestVersion = lv.Version
		if lv.CreatedAt > 0 {
			latestVersionCreatedAt = formatShanghaiRFC3339(time.Unix(lv.CreatedAt, 0).UTC())
		}
	}

	createdAt := ""
	if v, ok := item["createdAt"].(int64); ok && v > 0 {
		createdAt = formatShanghaiRFC3339(time.Unix(v, 0).UTC())
	}
	updatedAt := ""
	if v, ok := item["updatedAt"].(int64); ok && v > 0 {
		updatedAt = formatShanghaiRFC3339(time.Unix(v, 0).UTC())
	}

	status, _ := item["status"].(string)
	slug, _ := item["slug"].(string)
	displayName, _ := item["displayName"].(string)
	highlighted := "false"
	if v, ok := item["highlighted"].(bool); ok && v {
		highlighted = "true"
	}

	return []string{
		slug,
		displayName,
		ownerHandle,
		ownerDisplayName,
		ownerEmail,
		status,
		createdAt,
		updatedAt,
		latestVersion,
		latestVersionCreatedAt,
		highlighted,
	}
}

func loadManagedSkillDetail(ctx context.Context, skillService *service.SkillService, slug string) (*model.Skill, []model.VersionInfo, *model.User, error) {
	var skill model.Skill
	if err := skillService.DB().WithContext(ctx).Where("slug = ?", slug).Preload("LatestVersion").First(&skill).Error; err != nil {
		return nil, nil, nil, err
	}

	versions, err := skillService.GetSkillVersions(ctx, slug)
	if err != nil {
		return nil, nil, nil, err
	}

	var owner *model.User
	if skill.OwnerUserID != nil {
		var user model.User
		if err := skillService.DB().Where("id = ?", *skill.OwnerUserID).First(&user).Error; err == nil {
			owner = &user
		}
	}

	return &skill, versions, owner, nil
}

func managedSkillDetailResponse(skillService *service.SkillService, skill *model.Skill, versions []model.VersionInfo, owner *model.User) gin.H {
	item, err := skillService.SkillToItemWithCategories(context.Background(), skill)
	if err != nil {
		item = skillService.SkillToItem(skill)
	}
	return gin.H{
		"skill":         managedSkillListItem(item, skill, owner, true),
		"versions":      versions,
		"owner":         ownerSummary(owner),
		"currentStatus": managedSkillStatus(skill),
	}
}

func managedSkillListItem(item model.SkillItem, skill *model.Skill, owner *model.User, includeOwner bool) gin.H {
	resp := gin.H{
		"id":                 skill.ID,
		"slug":               item.Slug,
		"displayName":        item.DisplayName,
		"summary":            item.Summary,
		"tags":               item.Tags,
		"documentationLinks": item.DocumentationLinks,
		"categories":         item.Categories,
		"stats":              item.Stats,
		"highlighted":        item.Highlighted,
		"createdAt":          item.CreatedAt,
		"updatedAt":          item.UpdatedAt,
		"latestVersion":      item.LatestVersion,
		"isDeleted":          skill.IsDeleted,
		"status":             managedSkillStatus(skill),
	}
	if includeOwner {
		resp["owner"] = ownerSummary(owner)
	}
	return resp
}

func managedSkillStatus(skill *model.Skill) string {
	if skill.IsDeleted {
		return "deleted"
	}
	return "active"
}

func ownerSummary(owner *model.User) gin.H {
	if owner == nil {
		return nil
	}
	return gin.H{
		"id":          owner.ID,
		"handle":      owner.Handle,
		"displayName": owner.DisplayName,
		"email":       owner.Email,
		"status":      owner.Status,
	}
}

func loadOwnersByID(skillService *service.SkillService, skills []model.Skill) (map[string]*model.User, error) {
	ownerIDs := make([]string, 0, len(skills))
	seen := make(map[string]struct{}, len(skills))
	for _, skill := range skills {
		id := ownerID(skill.OwnerUserID)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ownerIDs = append(ownerIDs, id)
	}
	if len(ownerIDs) == 0 {
		return map[string]*model.User{}, nil
	}

	var owners []model.User
	if err := skillService.DB().Where("id IN ?", ownerIDs).Find(&owners).Error; err != nil {
		return nil, err
	}
	ownersByID := make(map[string]*model.User, len(owners))
	for i := range owners {
		owner := owners[i]
		ownersByID[owner.ID] = &owner
	}
	return ownersByID, nil
}

func ownerID(id *string) string {
	if id == nil {
		return ""
	}
	return *id
}

func queryLimit(c *gin.Context, fallback, max int) int {
	limit, err := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(fallback)))
	if err != nil || limit <= 0 {
		return fallback
	}
	if limit > max {
		return max
	}
	return limit
}
