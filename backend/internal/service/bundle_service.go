package service

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"path"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/openclaw/clawhub/backend/internal/model"
	"gorm.io/gorm"
)

const maxBundleSkills = 50

var (
	ErrBundleInvalid          = errors.New("invalid bundle")
	ErrBundleNotFound         = errors.New("bundle not found")
	ErrBundleNotDeleted       = errors.New("bundle not found or not deleted")
	ErrBundlePermissionDenied = errors.New("permission denied")

	bundleSlugRegex = regexp.MustCompile(`^[a-z0-9-]+$`)
)

type BundleService struct {
	db           *gorm.DB
	skillService *SkillService
	zipService   *ZipService
}

type BundleListOptions struct {
	Limit          int
	Cursor         *string
	Sort           string
	Dir            string
	CategorySlug   string
	OwnerHandle    string
	OwnerUserID    *string
	Query          string
	Status         string
	IncludeDeleted bool
}

func NewBundleService(db *gorm.DB, skillService *SkillService, zipService *ZipService) *BundleService {
	return &BundleService{
		db:           db,
		skillService: skillService,
		zipService:   zipService,
	}
}

func (s *BundleService) DB() *gorm.DB {
	return s.db
}

func (s *BundleService) ListBundles(ctx context.Context, opts BundleListOptions) (*model.BundleListResponse, error) {
	limit := opts.Limit
	if limit <= 0 || limit > 100 {
		limit = 25
	}

	orderColumn, orderDir := normalizeBundleListOrdering(opts.Sort, opts.Dir)
	query := s.db.WithContext(ctx).Model(&model.SkillBundle{}).
		Order(fmt.Sprintf("%s %s", orderColumn, orderDir)).
		Order(fmt.Sprintf("id %s", orderDir)).
		Limit(limit)

	if opts.OwnerUserID != nil {
		query = query.Where("owner_user_id = ?", *opts.OwnerUserID)
	}
	if ownerHandle := strings.TrimSpace(opts.OwnerHandle); ownerHandle != "" {
		var owner model.User
		if err := s.db.WithContext(ctx).Where("handle = ?", ownerHandle).First(&owner).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return &model.BundleListResponse{Items: []model.BundleItem{}, NextCursor: nil}, nil
			}
			return nil, fmt.Errorf("failed to load owner: %w", err)
		}
		query = query.Where("owner_user_id = ?", owner.ID)
	}

	switch strings.TrimSpace(opts.Status) {
	case "active":
		query = query.Where("is_deleted = ?", false)
	case "deleted":
		query = query.Where("is_deleted = ?", true)
	default:
		if !opts.IncludeDeleted {
			query = query.Where("is_deleted = ?", false)
		}
	}

	if q := strings.TrimSpace(opts.Query); q != "" {
		like := "%" + q + "%"
		query = query.Where("slug ILIKE ? OR display_name ILIKE ? OR description ILIKE ?", like, like, like)
	}

	categorySlug := strings.TrimSpace(opts.CategorySlug)
	if categorySlug != "" {
		if categorySlug == UncategorizedSlug {
			query = query.Where("NOT EXISTS (SELECT 1 FROM bundle_category_assignments bca WHERE bca.bundle_id = skill_bundles.id)")
		} else {
			var category model.SkillCategory
			if err := s.db.WithContext(ctx).Where("slug = ?", categorySlug).First(&category).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return &model.BundleListResponse{Items: []model.BundleItem{}, NextCursor: nil}, nil
				}
				return nil, fmt.Errorf("failed to load category: %w", err)
			}
			query = query.Joins("JOIN bundle_category_assignments bca ON bca.bundle_id = skill_bundles.id").
				Where("bca.category_id = ?", category.ID)
		}
	}

	if opts.Cursor != nil && *opts.Cursor != "" {
		query = query.Where("id < ?", *opts.Cursor)
	}

	var bundles []model.SkillBundle
	if err := query.Find(&bundles).Error; err != nil {
		return nil, fmt.Errorf("failed to list bundles: %w", err)
	}

	items, err := s.bundlesToItems(ctx, bundles, true)
	if err != nil {
		return nil, err
	}

	var nextCursor *string
	if len(bundles) == limit {
		lastID := bundles[len(bundles)-1].ID
		nextCursor = &lastID
	}

	return &model.BundleListResponse{
		Items:      items,
		NextCursor: nextCursor,
	}, nil
}

func (s *BundleService) GetBundle(ctx context.Context, slug string) (*model.BundleDetailResponse, error) {
	var bundle model.SkillBundle
	if err := s.db.WithContext(ctx).Where("slug = ? AND is_deleted = ?", slug, false).First(&bundle).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrBundleNotFound
		}
		return nil, fmt.Errorf("failed to get bundle: %w", err)
	}

	items, err := s.bundlesToItems(ctx, []model.SkillBundle{bundle}, true)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrBundleNotFound
	}

	skills, missing, err := s.bundleSkillItems(ctx, bundle.ID)
	if err != nil {
		return nil, err
	}

	return &model.BundleDetailResponse{
		Bundle:        items[0],
		Skills:        skills,
		MissingSkills: missing,
	}, nil
}

func (s *BundleService) UpsertBundle(ctx context.Context, payload model.PublishBundlePayload, ownerUserID string, canManageExisting bool) (*model.PublishBundleResponse, error) {
	if err := validateBundlePayload(payload); err != nil {
		return nil, err
	}
	normalizedDocumentationLinks, err := NormalizeDocumentationLinks(payload.DocumentationLinks)
	if err != nil {
		return nil, newDocumentationLinkValidationError(err)
	}
	payload.DocumentationLinks = normalizedDocumentationLinks

	payload.Slug = strings.TrimSpace(payload.Slug)
	payload.DisplayName = strings.TrimSpace(payload.DisplayName)
	payload.Description = strings.TrimSpace(payload.Description)

	var bundleID string
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var bundle model.SkillBundle
		err := tx.Where("slug = ? AND is_deleted = ?", payload.Slug, false).First(&bundle).Error
		if err == gorm.ErrRecordNotFound {
			documentationLinks := model.DocumentationLinkList{}
			if payload.DocumentationLinks != nil {
				documentationLinks = *payload.DocumentationLinks
			}
			bundle = model.SkillBundle{
				ID:                 uuid.New().String(),
				Slug:               payload.Slug,
				DisplayName:        payload.DisplayName,
				Description:        payload.Description,
				DocumentationLinks: documentationLinks,
				OwnerUserID:        &ownerUserID,
				StatsDownloads:     0,
				StatsInstalls:      0,
			}
			if err := tx.Create(&bundle).Error; err != nil {
				return fmt.Errorf("failed to create bundle: %w", err)
			}
		} else if err != nil {
			return fmt.Errorf("failed to check bundle: %w", err)
		} else {
			if !canManageExisting && (bundle.OwnerUserID == nil || *bundle.OwnerUserID != ownerUserID) {
				return ErrBundlePermissionDenied
			}
			updates := map[string]interface{}{
				"display_name": payload.DisplayName,
				"description":  payload.Description,
			}
			if payload.DocumentationLinks != nil {
				updates["documentation_links"] = *payload.DocumentationLinks
			}
			if err := tx.Model(&bundle).Updates(updates).Error; err != nil {
				return fmt.Errorf("failed to update bundle: %w", err)
			}
		}

		bundleID = bundle.ID

		if _, err := s.setBundleCategoriesTx(ctx, tx, bundle.ID, payload.CategorySlugs); err != nil {
			return err
		}
		if err := s.setBundleSkillsTx(ctx, tx, bundle.ID, payload.Skills); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &model.PublishBundleResponse{
		OK:       "true",
		BundleID: bundleID,
	}, nil
}

func (s *BundleService) DeleteBundle(ctx context.Context, slug string) error {
	result := s.db.WithContext(ctx).Model(&model.SkillBundle{}).
		Where("slug = ? AND is_deleted = ?", slug, false).
		Update("is_deleted", true)
	if result.Error != nil {
		return fmt.Errorf("failed to delete bundle: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrBundleNotFound
	}
	return nil
}

func (s *BundleService) UndeleteBundle(ctx context.Context, slug string) error {
	result := s.db.WithContext(ctx).Model(&model.SkillBundle{}).
		Where("slug = ? AND is_deleted = ?", slug, true).
		Update("is_deleted", false)
	if result.Error != nil {
		return fmt.Errorf("failed to undelete bundle: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrBundleNotDeleted
	}
	return nil
}

func (s *BundleService) SetBundleCategories(ctx context.Context, slug string, categorySlugs []string) ([]model.CategoryInfo, error) {
	var infos []model.CategoryInfo
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var bundle model.SkillBundle
		if err := tx.Where("slug = ?", slug).First(&bundle).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return ErrBundleNotFound
			}
			return fmt.Errorf("failed to load bundle: %w", err)
		}
		categories, err := s.setBundleCategoriesTx(ctx, tx, bundle.ID, categorySlugs)
		if err != nil {
			return err
		}
		infos = bundleCategoryInfos(categories)
		return nil
	})
	return infos, err
}

func (s *BundleService) GenerateBundleZip(ctx context.Context, slug string, writer io.Writer) ([]string, error) {
	var bundle model.SkillBundle
	if err := s.db.WithContext(ctx).Where("slug = ? AND is_deleted = ?", slug, false).First(&bundle).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrBundleNotFound
		}
		return nil, fmt.Errorf("failed to load bundle: %w", err)
	}

	var bundleSkills []model.BundleSkill
	if err := s.db.WithContext(ctx).Where("bundle_id = ?", bundle.ID).
		Order("sort_order ASC").
		Order("skill_slug ASC").
		Find(&bundleSkills).Error; err != nil {
		return nil, fmt.Errorf("failed to load bundle skills: %w", err)
	}

	zipWriter := zip.NewWriter(writer)
	missing := make([]string, 0)

	if err := addBundleManifest(zipWriter, &bundle, bundleSkills); err != nil {
		_ = zipWriter.Close()
		return nil, err
	}

	for _, entry := range bundleSkills {
		slug := entry.SkillSlug
		var skill model.Skill
		if err := s.db.WithContext(ctx).Where("slug = ? AND is_deleted = ?", slug, false).
			Preload("LatestVersion").
			First(&skill).Error; err != nil {
			if err != gorm.ErrRecordNotFound {
				_ = zipWriter.Close()
				return nil, fmt.Errorf("failed to load skill %s: %w", slug, err)
			}
			missing = append(missing, slug)
			if err := addMissingSkillMarker(zipWriter, bundle.Slug, slug); err != nil {
				_ = zipWriter.Close()
				return nil, err
			}
			continue
		}
		if skill.LatestVersion == nil {
			missing = append(missing, slug)
			if err := addMissingSkillMarker(zipWriter, bundle.Slug, slug); err != nil {
				_ = zipWriter.Close()
				return nil, err
			}
			continue
		}
		if err := s.addSkillVersionFilesToBundleZip(ctx, zipWriter, bundle.Slug, skill.Slug, skill.LatestVersion); err != nil {
			_ = zipWriter.Close()
			return nil, err
		}
	}

	if err := zipWriter.Close(); err != nil {
		return nil, fmt.Errorf("failed to close bundle zip: %w", err)
	}
	return missing, nil
}

func (s *BundleService) IncrementDownloadAndInstallStats(ctx context.Context, bundleID string) error {
	result := s.db.WithContext(ctx).
		Model(&model.SkillBundle{}).
		Where("id = ?", bundleID).
		Updates(map[string]interface{}{
			"stats_downloads": gorm.Expr("stats_downloads + 1"),
			"stats_installs":  gorm.Expr("stats_installs + 1"),
		})
	if result.Error != nil {
		return fmt.Errorf("failed to update bundle stats: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrBundleNotFound
	}
	return nil
}

func (s *BundleService) CanManageBundle(user *model.User, bundle *model.SkillBundle, authService *AuthService) bool {
	if user == nil || bundle == nil {
		return false
	}
	if authService != nil && authService.IsSuperuser(user) {
		return true
	}
	if bundle.OwnerUserID != nil && *bundle.OwnerUserID == user.ID {
		return true
	}
	return false
}

func (s *BundleService) BundleToItem(ctx context.Context, bundle *model.SkillBundle) (model.BundleItem, error) {
	items, err := s.bundlesToItems(ctx, []model.SkillBundle{*bundle}, true)
	if err != nil {
		return model.BundleItem{}, err
	}
	if len(items) == 0 {
		return model.BundleItem{}, nil
	}
	return items[0], nil
}

func normalizeBundleListOrdering(sortKey string, dir string) (column string, direction string) {
	switch strings.TrimSpace(sortKey) {
	case "name":
		column = "display_name"
	case "downloads":
		column = "stats_downloads"
	case "updated", "newest", "":
		column = "updated_at"
	default:
		column = "updated_at"
	}

	switch strings.ToLower(strings.TrimSpace(dir)) {
	case "asc":
		direction = "ASC"
	case "desc":
		direction = "DESC"
	default:
		if column == "display_name" {
			direction = "ASC"
		} else {
			direction = "DESC"
		}
	}

	return column, direction
}

func validateBundlePayload(payload model.PublishBundlePayload) error {
	slug := strings.TrimSpace(payload.Slug)
	if len(slug) < 3 || len(slug) > 50 {
		return fmt.Errorf("%w: slug length must be 3-50 characters", ErrBundleInvalid)
	}
	if !bundleSlugRegex.MatchString(slug) {
		return fmt.Errorf("%w: invalid slug format", ErrBundleInvalid)
	}
	if strings.TrimSpace(payload.DisplayName) == "" {
		return fmt.Errorf("%w: displayName is required", ErrBundleInvalid)
	}
	if strings.TrimSpace(payload.Description) == "" {
		return fmt.Errorf("%w: description is required", ErrBundleInvalid)
	}
	if len(payload.Skills) == 0 {
		return fmt.Errorf("%w: skills are required", ErrBundleInvalid)
	}
	if len(payload.Skills) > maxBundleSkills {
		return fmt.Errorf("%w: skills exceed 50 item limit", ErrBundleInvalid)
	}
	seen := make(map[string]struct{}, len(payload.Skills))
	for _, skill := range payload.Skills {
		skillSlug := strings.TrimSpace(skill.Slug)
		if skillSlug == "" {
			return fmt.Errorf("%w: skill slug is required", ErrBundleInvalid)
		}
		if _, ok := seen[skillSlug]; ok {
			return fmt.Errorf("%w: duplicate skill slug", ErrBundleInvalid)
		}
		seen[skillSlug] = struct{}{}
	}
	return nil
}

func (s *BundleService) setBundleSkillsTx(ctx context.Context, tx *gorm.DB, bundleID string, skills []model.BundleSkillInput) error {
	if err := tx.WithContext(ctx).Where("bundle_id = ?", bundleID).Delete(&model.BundleSkill{}).Error; err != nil {
		return fmt.Errorf("failed to clear bundle skills: %w", err)
	}
	for i, input := range skills {
		sortOrder := input.SortOrder
		if sortOrder == 0 {
			sortOrder = i + 1
		}
		assignment := model.BundleSkill{
			BundleID:  bundleID,
			SkillSlug: strings.TrimSpace(input.Slug),
			SortOrder: sortOrder,
		}
		if err := tx.WithContext(ctx).Create(&assignment).Error; err != nil {
			return fmt.Errorf("failed to assign bundle skill: %w", err)
		}
	}
	return nil
}

func (s *BundleService) setBundleCategoriesTx(ctx context.Context, tx *gorm.DB, bundleID string, categorySlugs []string) ([]model.SkillCategory, error) {
	categories, err := s.skillService.resolveCategorySlugs(ctx, tx, categorySlugs)
	if err != nil {
		return nil, err
	}
	if err := tx.WithContext(ctx).Where("bundle_id = ?", bundleID).Delete(&model.BundleCategoryAssignment{}).Error; err != nil {
		return nil, fmt.Errorf("failed to clear bundle categories: %w", err)
	}
	for _, category := range categories {
		assignment := model.BundleCategoryAssignment{
			BundleID:   bundleID,
			CategoryID: category.ID,
		}
		if err := tx.WithContext(ctx).Create(&assignment).Error; err != nil {
			return nil, fmt.Errorf("failed to assign bundle category: %w", err)
		}
	}
	return categories, nil
}

func (s *BundleService) bundlesToItems(ctx context.Context, bundles []model.SkillBundle, includeOwner bool) ([]model.BundleItem, error) {
	items := make([]model.BundleItem, len(bundles))
	for i := range bundles {
		items[i] = bundleToItem(&bundles[i])
	}
	if len(bundles) == 0 {
		return items, nil
	}

	if includeOwner {
		ownersByID, err := s.bundleOwnersByID(ctx, bundles)
		if err != nil {
			return nil, err
		}
		for i := range bundles {
			if bundles[i].OwnerUserID != nil {
				items[i].Owner = s.skillService.ownerInfoFromUser(ownersByID[*bundles[i].OwnerUserID])
			}
		}
	}

	categoriesByBundleID, err := s.categoriesByBundleID(ctx, bundles)
	if err != nil {
		return nil, err
	}
	skillsByBundleID, err := s.skillSlugsByBundleID(ctx, bundles)
	if err != nil {
		return nil, err
	}
	for i := range bundles {
		categories := categoriesByBundleID[bundles[i].ID]
		if categories == nil {
			categories = []model.CategoryInfo{}
		}
		skills := skillsByBundleID[bundles[i].ID]
		if skills == nil {
			skills = []string{}
		}
		items[i].Categories = categories
		items[i].Skills = skills
		items[i].Stats.Skills = len(skills)
	}
	return items, nil
}

func bundleToItem(bundle *model.SkillBundle) model.BundleItem {
	documentationLinks := bundle.DocumentationLinks
	if documentationLinks == nil {
		documentationLinks = model.DocumentationLinkList{}
	}
	item := model.BundleItem{
		Slug:               bundle.Slug,
		DisplayName:        bundle.DisplayName,
		Description:        bundle.Description,
		DocumentationLinks: documentationLinks,
		Categories:         []model.CategoryInfo{},
		Stats: model.BundleStats{
			Downloads: bundle.StatsDownloads,
			Installs:  bundle.StatsInstalls,
		},
		Skills:    []string{},
		CreatedAt: bundle.CreatedAt.Unix(),
		UpdatedAt: bundle.UpdatedAt.Unix(),
	}
	if bundle.Description != "" {
		summary := bundle.Description
		if len([]rune(summary)) > 120 {
			summary = string([]rune(summary)[:120])
		}
		item.Summary = &summary
	}
	return item
}

func (s *BundleService) bundleOwnersByID(ctx context.Context, bundles []model.SkillBundle) (map[string]*model.User, error) {
	ownerIDs := make([]string, 0, len(bundles))
	seen := make(map[string]struct{}, len(bundles))
	for i := range bundles {
		ownerID := bundles[i].OwnerUserID
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
		return nil, fmt.Errorf("failed to load bundle owners: %w", err)
	}
	ownersByID := make(map[string]*model.User, len(owners))
	for i := range owners {
		owner := owners[i]
		ownersByID[owner.ID] = &owner
	}
	return ownersByID, nil
}

func (s *BundleService) categoriesByBundleID(ctx context.Context, bundles []model.SkillBundle) (map[string][]model.CategoryInfo, error) {
	bundleIDs := bundleIDs(bundles)
	if len(bundleIDs) == 0 {
		return map[string][]model.CategoryInfo{}, nil
	}
	type row struct {
		BundleID    string
		Slug        string
		Name        string
		Description string
		SortOrder   int
	}
	var rows []row
	if err := s.db.WithContext(ctx).
		Table("bundle_category_assignments AS bca").
		Select("bca.bundle_id, c.slug, c.name, c.description, c.sort_order").
		Joins("JOIN skill_categories AS c ON c.id = bca.category_id").
		Where("bca.bundle_id IN ?", bundleIDs).
		Order("c.sort_order ASC").
		Order("c.slug ASC").
		Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("failed to load bundle categories: %w", err)
	}
	result := make(map[string][]model.CategoryInfo, len(bundleIDs))
	for _, row := range rows {
		result[row.BundleID] = append(result[row.BundleID], model.CategoryInfo{
			Slug:        row.Slug,
			Name:        row.Name,
			Description: row.Description,
			SortOrder:   row.SortOrder,
		})
	}
	return result, nil
}

func (s *BundleService) skillSlugsByBundleID(ctx context.Context, bundles []model.SkillBundle) (map[string][]string, error) {
	bundleIDs := bundleIDs(bundles)
	if len(bundleIDs) == 0 {
		return map[string][]string{}, nil
	}
	var rows []model.BundleSkill
	if err := s.db.WithContext(ctx).Where("bundle_id IN ?", bundleIDs).
		Order("bundle_id ASC").
		Order("sort_order ASC").
		Order("skill_slug ASC").
		Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("failed to load bundle skills: %w", err)
	}
	result := make(map[string][]string, len(bundleIDs))
	for _, row := range rows {
		result[row.BundleID] = append(result[row.BundleID], row.SkillSlug)
	}
	return result, nil
}

func (s *BundleService) bundleSkillItems(ctx context.Context, bundleID string) ([]model.BundleSkillItem, []string, error) {
	var bundleSkills []model.BundleSkill
	if err := s.db.WithContext(ctx).Where("bundle_id = ?", bundleID).
		Order("sort_order ASC").
		Order("skill_slug ASC").
		Find(&bundleSkills).Error; err != nil {
		return nil, nil, fmt.Errorf("failed to load bundle skills: %w", err)
	}

	items := make([]model.BundleSkillItem, 0, len(bundleSkills))
	missing := make([]string, 0)
	for _, entry := range bundleSkills {
		var skill model.Skill
		if err := s.db.WithContext(ctx).Where("slug = ? AND is_deleted = ?", entry.SkillSlug, false).
			Preload("LatestVersion").
			First(&skill).Error; err != nil {
			if err != gorm.ErrRecordNotFound {
				return nil, nil, fmt.Errorf("failed to load skill %s: %w", entry.SkillSlug, err)
			}
			items = append(items, model.BundleSkillItem{Slug: entry.SkillSlug, Deleted: true})
			missing = append(missing, entry.SkillSlug)
			continue
		}

		skillItem, err := s.skillService.SkillToItemWithCategories(ctx, &skill)
		if err != nil {
			return nil, nil, err
		}
		bundleSkillItem := model.BundleSkillItem{
			Slug:          skillItem.Slug,
			DisplayName:   skillItem.DisplayName,
			Summary:       skillItem.Summary,
			LatestVersion: skillItem.LatestVersion,
			Owner:         skillItem.Owner,
			Categories:    skillItem.Categories,
			Tags:          skillItem.Tags,
		}
		if skillItem.LatestVersion != nil {
			version := skillItem.LatestVersion.Version
			bundleSkillItem.Version = &version
		}
		if skill.OwnerUserID != nil {
			var owner model.User
			if err := s.db.WithContext(ctx).Where("id = ?", *skill.OwnerUserID).First(&owner).Error; err == nil {
				bundleSkillItem.Owner = s.skillService.ownerInfoFromUser(&owner)
			}
		}
		items = append(items, bundleSkillItem)
	}
	return items, missing, nil
}

func bundleIDs(bundles []model.SkillBundle) []string {
	ids := make([]string, 0, len(bundles))
	for _, bundle := range bundles {
		if bundle.ID != "" {
			ids = append(ids, bundle.ID)
		}
	}
	return ids
}

func bundleCategoryInfos(categories []model.SkillCategory) []model.CategoryInfo {
	infos := make([]model.CategoryInfo, len(categories))
	for i, category := range categories {
		infos[i] = model.CategoryInfo{
			Slug:        category.Slug,
			Name:        category.Name,
			Description: category.Description,
			SortOrder:   category.SortOrder,
		}
	}
	return infos
}

func addBundleManifest(zipWriter *zip.Writer, bundle *model.SkillBundle, skills []model.BundleSkill) error {
	var builder strings.Builder
	builder.WriteString("slug: ")
	builder.WriteString(yamlQuote(bundle.Slug))
	builder.WriteString("\n")
	builder.WriteString("display_name: ")
	builder.WriteString(yamlQuote(bundle.DisplayName))
	builder.WriteString("\n")
	builder.WriteString("description: ")
	builder.WriteString(yamlQuote(bundle.Description))
	builder.WriteString("\n")
	builder.WriteString("skills:\n")
	for _, skill := range skills {
		builder.WriteString("  - slug: ")
		builder.WriteString(yamlQuote(skill.SkillSlug))
		builder.WriteString("\n")
	}
	return addBytesToZip(zipWriter, path.Join(bundle.Slug, "BUNDLE.yaml"), []byte(builder.String()))
}

func yamlQuote(value string) string {
	escaped := strings.ReplaceAll(value, `\`, `\\`)
	escaped = strings.ReplaceAll(escaped, `"`, `\"`)
	escaped = strings.ReplaceAll(escaped, "\n", `\n`)
	return `"` + escaped + `"`
}

func addMissingSkillMarker(zipWriter *zip.Writer, bundleSlug, skillSlug string) error {
	content := []byte("skill missing or deleted\n")
	return addBytesToZip(zipWriter, path.Join(bundleSlug, "skills", skillSlug, ".missing"), content)
}

func (s *BundleService) addSkillVersionFilesToBundleZip(ctx context.Context, zipWriter *zip.Writer, bundleSlug, skillSlug string, version *model.SkillVersion) error {
	files := make([]model.FileMetadata, len(version.Files))
	copy(files, version.Files)
	sort.Slice(files, func(i, j int) bool {
		return files[i].Path < files[j].Path
	})
	for _, file := range files {
		reader, err := s.zipService.storageService.Download(ctx, file.StorageKey)
		if err != nil {
			return fmt.Errorf("failed to download file %s: %w", file.Path, err)
		}
		targetPath := path.Join(bundleSlug, "skills", skillSlug, file.Path)
		if err := addReaderToZip(zipWriter, targetPath, reader); err != nil {
			_ = reader.Close()
			return err
		}
		if err := reader.Close(); err != nil {
			return fmt.Errorf("failed to close file %s: %w", file.Path, err)
		}
	}
	return nil
}

func addBytesToZip(zipWriter *zip.Writer, name string, content []byte) error {
	return addReaderToZip(zipWriter, name, strings.NewReader(string(content)))
}

func addReaderToZip(zipWriter *zip.Writer, name string, reader io.Reader) error {
	header := &zip.FileHeader{
		Name:     name,
		Method:   zip.Deflate,
		Modified: time.Unix(0, 0),
	}
	writer, err := zipWriter.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("failed to create zip entry: %w", err)
	}
	if _, err := io.Copy(writer, reader); err != nil {
		return fmt.Errorf("failed to write zip entry: %w", err)
	}
	return nil
}
