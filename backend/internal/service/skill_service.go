package service

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/openclaw/clawhub/backend/internal/model"
	"gorm.io/gorm"
)

var errLegacySkillCursor = errors.New("legacy skill cursor")

type SkillService struct {
	db             *gorm.DB
	storageService StorageService
}

type skillPageCursor struct {
	Value string `json:"v"`
	ID    string `json:"i"`
}

func NewSkillService(db *gorm.DB, storageService StorageService) *SkillService {
	return &SkillService{
		db:             db,
		storageService: storageService,
	}
}

func (s *SkillService) DB() *gorm.DB {
	return s.db
}

func (s *SkillService) StorageService() StorageService {
	return s.storageService
}

func (s *SkillService) ListSkills(
	ctx context.Context,
	limit int,
	cursor *string,
	sortKey string,
	dir string,
	highlightedOnly bool,
	categorySlug string,
) (*model.SkillListResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}

	orderColumn, orderDir := normalizeSkillListOrdering(sortKey, dir)
	var skills []model.Skill
	query := s.db.WithContext(ctx).
		Model(&model.Skill{}).
		Where("is_deleted = ? AND moderation_status = ?", false, "active").
		Order(fmt.Sprintf("%s %s", orderColumn, orderDir)).
		Order(fmt.Sprintf("id %s", orderDir)).
		Limit(limit)

	if highlightedOnly {
		query = query.Where("is_highlighted = ?", true)
	}

	categorySlug = strings.TrimSpace(categorySlug)
	if categorySlug != "" {
		if categorySlug == UncategorizedSlug {
			query = query.Where("NOT EXISTS (SELECT 1 FROM skill_category_assignments sca WHERE sca.skill_id = skills.id)")
		} else {
			var category model.SkillCategory
			if err := s.db.WithContext(ctx).Where("slug = ?", categorySlug).First(&category).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return &model.SkillListResponse{Items: []model.SkillItem{}, NextCursor: nil}, nil
				}
				return nil, fmt.Errorf("failed to load category: %w", err)
			}
			query = query.Joins("JOIN skill_category_assignments sca ON sca.skill_id = skills.id").
				Where("sca.category_id = ?", category.ID)
		}
	}

	if cursor != nil && strings.TrimSpace(*cursor) != "" {
		cursorValue, cursorID, err := s.resolveSkillListCursor(ctx, strings.TrimSpace(*cursor), orderColumn)
		if err != nil {
			return nil, fmt.Errorf("invalid cursor: %w", err)
		}
		query = applySkillListCursor(query, orderColumn, orderDir, cursorValue, cursorID)
	}

	if err := query.Preload("LatestVersion").Find(&skills).Error; err != nil {
		return nil, fmt.Errorf("failed to list skills: %w", err)
	}

	ownersByID, err := s.ownersByID(ctx, skills)
	if err != nil {
		return nil, err
	}

	items, err := s.SkillsToItems(ctx, skills)
	if err != nil {
		return nil, err
	}
	for i, skill := range skills {
		if skill.OwnerUserID != nil {
			items[i].Owner = s.ownerInfoFromUser(ownersByID[*skill.OwnerUserID])
		}
	}

	var nextCursor *string
	if len(skills) == limit {
		encoded := encodeSkillListCursor(skills[len(skills)-1], orderColumn)
		nextCursor = &encoded
	}

	return &model.SkillListResponse{
		Items:      items,
		NextCursor: nextCursor,
	}, nil
}

func applySkillListCursor(query *gorm.DB, orderColumn, orderDir string, cursorValue interface{}, cursorID string) *gorm.DB {
	cmp := "<"
	idCmp := "<"
	if strings.EqualFold(orderDir, "ASC") {
		cmp = ">"
		idCmp = ">"
	}
	return query.Where(
		fmt.Sprintf("(%s %s ? OR (%s = ? AND id %s ?))", orderColumn, cmp, orderColumn, idCmp),
		cursorValue,
		cursorValue,
		cursorID,
	)
}

func encodeSkillListCursor(skill model.Skill, orderColumn string) string {
	payload, _ := json.Marshal(skillPageCursor{
		Value: encodeSkillSortValue(skill, orderColumn),
		ID:    skill.ID,
	})
	return base64.RawURLEncoding.EncodeToString(payload)
}

func (s *SkillService) resolveSkillListCursor(ctx context.Context, raw, orderColumn string) (interface{}, string, error) {
	value, id, err := parseSkillListCursor(raw, orderColumn)
	if err == nil {
		return value, id, nil
	}
	if !errors.Is(err, errLegacySkillCursor) {
		return nil, "", err
	}

	var skill model.Skill
	if dbErr := s.db.WithContext(ctx).Select("id", "created_at", "updated_at", "display_name", "stats_downloads", "stats_stars", "stats_installs").
		Where("id = ?", raw).First(&skill).Error; dbErr != nil {
		if dbErr == gorm.ErrRecordNotFound {
			return nil, "", fmt.Errorf("cursor skill not found")
		}
		return nil, "", dbErr
	}
	return skillSortComparable(skill, orderColumn), skill.ID, nil
}

func parseSkillListCursor(raw, orderColumn string) (interface{}, string, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return nil, "", errLegacySkillCursor
	}
	var cursor skillPageCursor
	if err := json.Unmarshal(decoded, &cursor); err != nil || cursor.ID == "" || cursor.Value == "" {
		return nil, "", errLegacySkillCursor
	}
	value, err := decodeSkillSortValue(cursor.Value, orderColumn)
	if err != nil {
		return nil, "", err
	}
	return value, cursor.ID, nil
}

func encodeSkillSortValue(skill model.Skill, orderColumn string) string {
	switch orderColumn {
	case "created_at":
		return skill.CreatedAt.UTC().Format(time.RFC3339Nano)
	case "updated_at":
		return skill.UpdatedAt.UTC().Format(time.RFC3339Nano)
	case "display_name":
		return skill.DisplayName
	case "stats_downloads":
		return strconv.FormatInt(skill.StatsDownloads, 10)
	case "stats_stars":
		return strconv.FormatInt(int64(skill.StatsStars), 10)
	case "stats_installs":
		return strconv.FormatInt(skill.StatsInstalls, 10)
	default:
		return skill.UpdatedAt.UTC().Format(time.RFC3339Nano)
	}
}

func decodeSkillSortValue(raw, orderColumn string) (interface{}, error) {
	switch orderColumn {
	case "created_at", "updated_at":
		t, err := time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			t, err = time.Parse(time.RFC3339, raw)
		}
		if err != nil {
			return nil, fmt.Errorf("invalid time cursor value")
		}
		return t, nil
	case "display_name":
		return raw, nil
	case "stats_downloads", "stats_stars", "stats_installs":
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid numeric cursor value")
		}
		return n, nil
	default:
		t, err := time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			return nil, fmt.Errorf("invalid cursor value")
		}
		return t, nil
	}
}

func skillSortComparable(skill model.Skill, orderColumn string) interface{} {
	switch orderColumn {
	case "created_at":
		return skill.CreatedAt
	case "updated_at":
		return skill.UpdatedAt
	case "display_name":
		return skill.DisplayName
	case "stats_downloads":
		return skill.StatsDownloads
	case "stats_stars":
		return int64(skill.StatsStars)
	case "stats_installs":
		return skill.StatsInstalls
	default:
		return skill.UpdatedAt
	}
}

func normalizeSkillListOrdering(sortKey string, dir string) (column string, direction string) {
	switch strings.TrimSpace(sortKey) {
	case "name":
		column = "display_name"
	case "newest", "created_at":
		column = "created_at"
	case "updated", "":
		column = "updated_at"
	case "downloads":
		column = "stats_downloads"
	case "stars", "rating":
		column = "stats_stars"
	case "installs", "installsCurrent", "installsAllTime", "trending":
		column = "stats_installs"
	default:
		column = "updated_at"
	}

	switch strings.ToLower(strings.TrimSpace(dir)) {
	case "asc":
		direction = "ASC"
	case "desc", "":
		direction = "DESC"
	default:
		if column == "display_name" {
			direction = "ASC"
		} else {
			direction = "DESC"
		}
	}

	if dir == "" && column == "display_name" {
		direction = "ASC"
	}

	return column, direction
}

func (s *SkillService) GetSkill(ctx context.Context, slug string, currentUserID string) (*model.SkillDetailResponse, error) {
	var skill model.Skill
	if err := s.db.Where("slug = ? AND is_deleted = ?", slug, false).
		Preload("LatestVersion").
		First(&skill).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("skill not found")
		}
		return nil, fmt.Errorf("failed to get skill: %w", err)
	}

	resp := &model.SkillDetailResponse{
		IsStarred: false,
	}
	item, err := s.SkillToItemWithCategories(ctx, &skill)
	if err != nil {
		return nil, err
	}
	resp.Skill = item
	if skill.LatestVersion != nil {
		resp.LatestVersion = s.versionToInfo(skill.LatestVersion, true)
	}

	// Populate owner info
	if skill.OwnerUserID != nil {
		var owner model.User
		if err := s.db.First(&owner, "id = ?", *skill.OwnerUserID).Error; err == nil {
			resp.Owner = s.ownerInfoFromUser(&owner)
		}
	}

	// Check if current user has starred this skill
	if currentUserID != "" {
		var count int64
		s.db.Model(&model.UserStar{}).
			Where("user_id = ? AND skill_id = ?", currentUserID, skill.ID).
			Count(&count)
		resp.IsStarred = count > 0
	}

	return resp, nil
}

func (s *SkillService) GetSkillVersions(ctx context.Context, slug string) ([]model.VersionInfo, error) {
	var skill model.Skill
	if err := s.db.Where("slug = ?", slug).First(&skill).Error; err != nil {
		return nil, fmt.Errorf("skill not found")
	}

	var versions []model.SkillVersion
	if err := s.db.Where("skill_id = ?", skill.ID).
		Order("created_at DESC").
		Find(&versions).Error; err != nil {
		return nil, fmt.Errorf("failed to get versions: %w", err)
	}

	result := make([]model.VersionInfo, len(versions))
	for i, v := range versions {
		result[i] = *s.versionToInfo(&v, false)
	}

	return result, nil
}

func (s *SkillService) GetSkillVersion(ctx context.Context, slug, version string) (*model.SkillVersionResponse, error) {
	var skill model.Skill
	if err := s.db.WithContext(ctx).Where("slug = ? AND is_deleted = ?", slug, false).First(&skill).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("skill not found")
		}
		return nil, fmt.Errorf("failed to get skill: %w", err)
	}

	var skillVersion model.SkillVersion
	if err := s.db.WithContext(ctx).Where("skill_id = ? AND version = ?", skill.ID, version).First(&skillVersion).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("version not found")
		}
		return nil, fmt.Errorf("failed to get version: %w", err)
	}

	return &model.SkillVersionResponse{
		Version: s.versionToInfo(&skillVersion, true),
		Skill: &model.SkillVersionMeta{
			Slug:        skill.Slug,
			DisplayName: skill.DisplayName,
		},
	}, nil
}

func (s *SkillService) GetSkillFile(ctx context.Context, slug, path, version string) (*model.SkillVersion, *model.FileMetadata, []byte, error) {
	if path == "" {
		return nil, nil, nil, fmt.Errorf("path is required")
	}

	var skill model.Skill
	query := s.db.WithContext(ctx).Where("slug = ? AND is_deleted = ?", slug, false)
	if version == "" {
		query = query.Preload("LatestVersion")
	}
	if err := query.First(&skill).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil, nil, fmt.Errorf("skill not found")
		}
		return nil, nil, nil, fmt.Errorf("failed to get skill: %w", err)
	}

	var targetVersion model.SkillVersion
	if version != "" {
		if err := s.db.WithContext(ctx).Where("skill_id = ? AND version = ?", skill.ID, version).First(&targetVersion).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, nil, nil, fmt.Errorf("version not found")
			}
			return nil, nil, nil, fmt.Errorf("failed to get version: %w", err)
		}
	} else {
		if skill.LatestVersion == nil {
			return nil, nil, nil, fmt.Errorf("version not found")
		}
		targetVersion = *skill.LatestVersion
	}

	for i := range targetVersion.Files {
		file := targetVersion.Files[i]
		if file.Path != path {
			continue
		}
		reader, err := s.storageService.Download(ctx, file.StorageKey)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to download file: %w", err)
		}
		defer reader.Close()

		bytes, err := io.ReadAll(reader)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to read file: %w", err)
		}
		return &targetVersion, &file, bytes, nil
	}

	return nil, nil, nil, fmt.Errorf("file not found")
}

func (s *SkillService) DeleteSkill(ctx context.Context, slug string) error {
	result := s.db.Model(&model.Skill{}).
		Where("slug = ? AND is_deleted = ?", slug, false).
		Update("is_deleted", true)

	if result.Error != nil {
		return fmt.Errorf("failed to delete skill: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("skill not found")
	}

	return nil
}

func (s *SkillService) UndeleteSkill(ctx context.Context, slug string) error {
	result := s.db.Model(&model.Skill{}).
		Where("slug = ? AND is_deleted = ?", slug, true).
		Update("is_deleted", false)

	if result.Error != nil {
		return fmt.Errorf("failed to undelete skill: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("skill not found or not deleted")
	}

	return nil
}

func (s *SkillService) SetSkillHighlighted(ctx context.Context, slug string, highlighted bool) error {
	result := s.db.WithContext(ctx).
		Model(&model.Skill{}).
		Where("slug = ?", slug).
		Update("is_highlighted", highlighted)

	if result.Error != nil {
		return fmt.Errorf("failed to update highlighted status: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("skill not found")
	}

	return nil
}

func (s *SkillService) Search(ctx context.Context, query string, limit int, categorySlug string) (*model.SearchResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}

	categoryClause := ""
	args := []any{}
	categorySlug = strings.TrimSpace(categorySlug)
	if categorySlug != "" {
		if categorySlug == UncategorizedSlug {
			categoryClause = "AND NOT EXISTS (SELECT 1 FROM skill_category_assignments sca WHERE sca.skill_id = skills.id)"
		} else {
			var category model.SkillCategory
			if err := s.db.WithContext(ctx).Where("slug = ?", categorySlug).First(&category).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return &model.SearchResponse{Results: []model.SearchResult{}}, nil
				}
				return nil, fmt.Errorf("failed to load category: %w", err)
			}
			categoryClause = "AND EXISTS (SELECT 1 FROM skill_category_assignments sca WHERE sca.skill_id = skills.id AND sca.category_id = ?)"
			args = append(args, category.ID)
		}
	}

	results := make([]model.SearchResult, 0)
	sql := strings.Replace(`
		SELECT skills.id, owner_user_id, slug, display_name, description as summary,
		       latest_versions.version as version,
		       EXTRACT(EPOCH FROM latest_versions.created_at)::bigint as latest_version_created_at,
		       latest_versions.changelog as latest_version_changelog,
		       stats_downloads, stats_installs, stats_versions, stats_stars,
		       (
		         GREATEST(
		           similarity(slug, ?),
		           similarity(display_name, ?),
		           similarity(description, ?)
		         )
		         + CASE WHEN slug ILIKE '%' || ? || '%' THEN 1.0 ELSE 0 END
		         + CASE WHEN display_name ILIKE '%' || ? || '%' THEN 1.0 ELSE 0 END
		         + CASE WHEN description ILIKE '%' || ? || '%' THEN 0.7 ELSE 0 END
		         + CASE WHEN ? = ANY(tags) THEN 0.8 ELSE 0 END
		       ) AS score,
		       EXTRACT(EPOCH FROM updated_at)::bigint as updated_at
		FROM skills
		LEFT JOIN skill_versions latest_versions ON latest_versions.id = skills.latest_version_id
		WHERE is_deleted = FALSE
		  AND moderation_status = 'active'
		  AND (
		       slug ILIKE '%' || ? || '%'
		       OR display_name ILIKE '%' || ? || '%'
		       OR description ILIKE '%' || ? || '%'
		       OR ? = ANY(tags)
		       OR similarity(slug, ?) > 0.1
		       OR similarity(display_name, ?) > 0.1
		       OR similarity(description, ?) > 0.1
		  )
		  /*CATEGORY_CLAUSE*/
		ORDER BY score DESC, updated_at DESC
		LIMIT ?
	`, "/*CATEGORY_CLAUSE*/", categoryClause, 1)
	rawArgs := []any{query, query, query, query, query, query, query, query, query, query, query, query, query, query}
	rawArgs = append(rawArgs, args...)
	rawArgs = append(rawArgs, limit)
	err := s.db.Raw(sql, rawArgs...).Scan(&results).Error

	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	if err := s.populateSearchResultMetadata(ctx, results); err != nil {
		return nil, err
	}

	return &model.SearchResponse{Results: results}, nil
}

func (s *SkillService) ResolveVersion(ctx context.Context, slug string, hash *string) (*model.ResolveResponse, error) {
	var skill model.Skill
	if err := s.db.Where("slug = ? AND is_deleted = ?", slug, false).
		Preload("LatestVersion").
		First(&skill).Error; err != nil {
		return nil, fmt.Errorf("skill not found")
	}

	response := &model.ResolveResponse{}

	if hash != nil && *hash != "" {
		var version model.SkillVersion
		if err := s.db.Where("skill_id = ? AND content_hash = ?", skill.ID, *hash).
			First(&version).Error; err == nil {
			response.Match = &model.VersionMatch{Version: version.Version}
		}
	}

	if skill.LatestVersion != nil {
		response.LatestVersion = &model.VersionMatch{Version: skill.LatestVersion.Version}
	}

	return response, nil
}

func (s *SkillService) CalculateVersionHash(files []model.FileMetadata) string {
	hashes := make([]string, len(files))
	for i, f := range files {
		hashes[i] = f.SHA256
	}
	sort.Strings(hashes)

	combined := ""
	for _, h := range hashes {
		combined += h
	}

	hash := sha256.Sum256([]byte(combined))
	return hex.EncodeToString(hash[:])
}

func (s *SkillService) IncrementDownloadAndInstallStats(ctx context.Context, skillID string) error {
	result := s.db.WithContext(ctx).
		Model(&model.Skill{}).
		Where("id = ?", skillID).
		Updates(map[string]interface{}{
			"stats_downloads": gorm.Expr("stats_downloads + 1"),
			"stats_installs":  gorm.Expr("stats_installs + 1"),
		})

	if result.Error != nil {
		return fmt.Errorf("failed to update skill stats: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("skill not found")
	}

	return nil
}

func (s *SkillService) SkillToItem(skill *model.Skill) model.SkillItem {
	return s.skillToItem(skill)
}

func (s *SkillService) skillToItem(skill *model.Skill) model.SkillItem {
	documentationLinks := skill.DocumentationLinks
	if documentationLinks == nil {
		documentationLinks = model.DocumentationLinkList{}
	}
	item := model.SkillItem{
		Slug:               skill.Slug,
		DisplayName:        skill.DisplayName,
		Tags:               skill.Tags,
		DocumentationLinks: documentationLinks,
		Categories:         []model.CategoryInfo{},
		Stats: model.SkillStats{
			Downloads: skill.StatsDownloads,
			Installs:  skill.StatsInstalls,
			Versions:  skill.StatsVersions,
			Stars:     skill.StatsStars,
		},
		Highlighted: skill.IsHighlighted,
		CreatedAt:   skill.CreatedAt.Unix(),
		UpdatedAt:   skill.UpdatedAt.Unix(),
	}

	if skill.Description != "" {
		item.Summary = &skill.Description
	}

	if skill.LatestVersion != nil {
		item.LatestVersion = s.versionToInfo(skill.LatestVersion, false)
	}

	return item
}

func (s *SkillService) populateSearchResultMetadata(ctx context.Context, results []model.SearchResult) error {
	if len(results) == 0 {
		return nil
	}
	skills := make([]model.Skill, 0, len(results))
	for _, result := range results {
		if result.SkillID == "" {
			continue
		}
		skills = append(skills, model.Skill{ID: result.SkillID, OwnerUserID: result.OwnerUserID})
	}
	categoriesBySkillID, err := s.CategoriesBySkillID(ctx, skills)
	if err != nil {
		return err
	}
	ownersByID, err := s.ownersByID(ctx, skills)
	if err != nil {
		return err
	}
	for i := range results {
		categories := categoriesBySkillID[results[i].SkillID]
		if categories == nil {
			categories = []model.CategoryInfo{}
		}
		results[i].Stats = model.SkillStats{
			Downloads: results[i].StatsDownloads,
			Installs:  results[i].StatsInstalls,
			Versions:  results[i].StatsVersions,
			Stars:     results[i].StatsStars,
		}
		if results[i].OwnerUserID != nil {
			results[i].Owner = s.ownerInfoFromUser(ownersByID[*results[i].OwnerUserID])
		}
		if results[i].Version != nil {
			latestVersion := &model.VersionInfo{
				Version:   *results[i].Version,
				Changelog: "",
			}
			if results[i].LatestVersionCreatedAt != nil {
				latestVersion.CreatedAt = *results[i].LatestVersionCreatedAt
			}
			if results[i].LatestVersionChangelog != nil {
				latestVersion.Changelog = *results[i].LatestVersionChangelog
			}
			results[i].LatestVersion = latestVersion
		}
		results[i].Categories = categories
	}
	return nil
}

func (s *SkillService) ownersByID(ctx context.Context, skills []model.Skill) (map[string]*model.User, error) {
	ownerIDs := make([]string, 0, len(skills))
	seen := make(map[string]struct{}, len(skills))
	for i := range skills {
		ownerID := skills[i].OwnerUserID
		if ownerID == nil || *ownerID == "" {
			continue
		}
		if _, ok := seen[*ownerID]; ok {
			continue
		}
		seen[*ownerID] = struct{}{}
		ownerIDs = append(ownerIDs, *ownerID)
	}

	if len(ownerIDs) == 0 {
		return map[string]*model.User{}, nil
	}

	var owners []model.User
	if err := s.db.WithContext(ctx).Where("id IN ?", ownerIDs).Find(&owners).Error; err != nil {
		return nil, fmt.Errorf("failed to load skill owners: %w", err)
	}

	ownersByID := make(map[string]*model.User, len(owners))
	for i := range owners {
		owner := owners[i]
		ownersByID[owner.ID] = &owner
	}
	return ownersByID, nil
}

func (s *SkillService) ownerInfoFromUser(owner *model.User) *model.OwnerInfo {
	if owner == nil {
		return nil
	}

	info := &model.OwnerInfo{}
	if trimmed := strings.TrimSpace(owner.Handle); trimmed != "" {
		info.Handle = &trimmed
	}
	if trimmed := strings.TrimSpace(owner.DisplayName); trimmed != "" {
		info.DisplayName = &trimmed
	}
	if trimmed := strings.TrimSpace(owner.AvatarURL); trimmed != "" {
		info.Image = &trimmed
	}
	return info
}

func (s *SkillService) versionToInfo(version *model.SkillVersion, includeFiles bool) *model.VersionInfo {
	if version == nil {
		return nil
	}

	info := &model.VersionInfo{
		Version:   version.Version,
		CreatedAt: version.CreatedAt.Unix(),
		Changelog: version.Changelog,
	}
	if includeFiles {
		info.Files = version.Files
		info.Parsed = version.Parsed
	}
	return info
}
