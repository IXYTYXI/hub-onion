package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/openclaw/clawhub/backend/internal/model"
	"gorm.io/gorm"
)

const UncategorizedSlug = "uncategorized"

var (
	ErrInvalidCategory = errors.New("invalid category")
	ErrCategoryExists  = errors.New("category already exists")

	categorySlugRegex = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
)

func IsCategoryValidationError(err error) bool {
	return errors.Is(err, ErrInvalidCategory) || errors.Is(err, ErrCategoryExists)
}

func (s *SkillService) ListCategories(ctx context.Context) ([]model.CategoryInfo, error) {
	var categories []model.SkillCategory
	if err := s.db.WithContext(ctx).
		Order("sort_order ASC").
		Order("slug ASC").
		Find(&categories).Error; err != nil {
		return nil, fmt.Errorf("failed to list categories: %w", err)
	}
	return categoryInfos(categories), nil
}

type CategoryListOptions struct {
	Query  string
	Limit  int
	Cursor string
}

type CategoryListResult struct {
	Items      []model.CategoryInfo `json:"items"`
	NextCursor *string              `json:"nextCursor"`
}

func (s *SkillService) ListCategoriesPage(ctx context.Context, opts CategoryListOptions) (*CategoryListResult, error) {
	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	query := s.db.WithContext(ctx).Model(&model.SkillCategory{})
	if q := strings.TrimSpace(opts.Query); q != "" {
		like := "%" + q + "%"
		query = query.Where("slug ILIKE ? OR name ILIKE ? OR description ILIKE ?", like, like, like)
	}
	if cursor := strings.TrimSpace(opts.Cursor); cursor != "" {
		sortOrder, slug, err := parseCategoryCursor(cursor)
		if err != nil {
			return nil, err
		}
		query = query.Where("(sort_order > ?) OR (sort_order = ? AND slug > ?)", sortOrder, sortOrder, slug)
	}

	var categories []model.SkillCategory
	if err := query.
		Order("sort_order ASC").
		Order("slug ASC").
		Limit(limit + 1).
		Find(&categories).Error; err != nil {
		return nil, fmt.Errorf("failed to list categories: %w", err)
	}

	var nextCursor *string
	if len(categories) > limit {
		categories = categories[:limit]
		last := categories[len(categories)-1]
		cursor := categoryCursor(last)
		nextCursor = &cursor
	}

	return &CategoryListResult{
		Items:      categoryInfos(categories),
		NextCursor: nextCursor,
	}, nil
}

func (s *SkillService) CreateCategory(ctx context.Context, slug, name, description string, sortOrder int) (*model.CategoryInfo, error) {
	slug = normalizeCategorySlug(slug)
	name = strings.TrimSpace(name)
	description = strings.TrimSpace(description)
	if err := validateWritableCategory(slug, name); err != nil {
		return nil, err
	}

	category := model.SkillCategory{
		Slug:        slug,
		Name:        name,
		Description: description,
		SortOrder:   sortOrder,
	}
	if err := s.db.WithContext(ctx).Create(&category).Error; err != nil {
		if isUniqueViolation(err) {
			return nil, fmt.Errorf("%w: category slug or name already exists", ErrCategoryExists)
		}
		return nil, fmt.Errorf("failed to create category: %w", err)
	}
	info := categoryInfo(category)
	return &info, nil
}

func (s *SkillService) UpdateCategory(ctx context.Context, slug string, name *string, description *string, sortOrder *int) (*model.CategoryInfo, error) {
	slug = normalizeCategorySlug(slug)
	if slug == UncategorizedSlug || !categorySlugRegex.MatchString(slug) {
		return nil, fmt.Errorf("%w: invalid category slug", ErrInvalidCategory)
	}

	updates := map[string]any{}
	if name != nil {
		trimmed := strings.TrimSpace(*name)
		if trimmed == "" {
			return nil, fmt.Errorf("%w: category name is required", ErrInvalidCategory)
		}
		updates["name"] = trimmed
	}
	if description != nil {
		updates["description"] = strings.TrimSpace(*description)
	}
	if sortOrder != nil {
		updates["sort_order"] = *sortOrder
	}

	if len(updates) > 0 {
		result := s.db.WithContext(ctx).Model(&model.SkillCategory{}).Where("slug = ?", slug).Updates(updates)
		if result.Error != nil {
			if isUniqueViolation(result.Error) {
				return nil, fmt.Errorf("%w: category slug or name already exists", ErrCategoryExists)
			}
			return nil, fmt.Errorf("failed to update category: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return nil, fmt.Errorf("%w: category not found", ErrInvalidCategory)
		}
	}

	var category model.SkillCategory
	if err := s.db.WithContext(ctx).Where("slug = ?", slug).First(&category).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("%w: category not found", ErrInvalidCategory)
		}
		return nil, fmt.Errorf("failed to load category: %w", err)
	}
	info := categoryInfo(category)
	return &info, nil
}

func (s *SkillService) DeleteCategory(ctx context.Context, slug string) error {
	slug = normalizeCategorySlug(slug)
	if slug == UncategorizedSlug || !categorySlugRegex.MatchString(slug) {
		return fmt.Errorf("%w: invalid category slug", ErrInvalidCategory)
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var category model.SkillCategory
		if err := tx.Where("slug = ?", slug).First(&category).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("%w: category not found", ErrInvalidCategory)
			}
			return fmt.Errorf("failed to load category: %w", err)
		}
		if err := tx.Where("category_id = ?", category.ID).Delete(&model.SkillCategoryAssignment{}).Error; err != nil {
			return fmt.Errorf("failed to delete category assignments: %w", err)
		}
		if err := tx.Delete(&category).Error; err != nil {
			return fmt.Errorf("failed to delete category: %w", err)
		}
		return nil
	})
}

func (s *SkillService) SetSkillCategories(ctx context.Context, skillSlug string, categorySlugs []string) ([]model.CategoryInfo, error) {
	var infos []model.CategoryInfo
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var skill model.Skill
		if err := tx.Where("slug = ?", skillSlug).First(&skill).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("skill not found")
			}
			return fmt.Errorf("failed to load skill: %w", err)
		}
		categories, err := s.setSkillCategoriesTx(ctx, tx, skill.ID, categorySlugs)
		if err != nil {
			return err
		}
		infos = categoryInfos(categories)
		return nil
	})
	return infos, err
}

func (s *SkillService) SetSkillCategoriesTx(ctx context.Context, tx *gorm.DB, skillID string, categorySlugs []string) error {
	_, err := s.setSkillCategoriesTx(ctx, tx, skillID, categorySlugs)
	return err
}

func (s *SkillService) setSkillCategoriesTx(ctx context.Context, tx *gorm.DB, skillID string, categorySlugs []string) ([]model.SkillCategory, error) {
	categories, err := s.resolveCategorySlugs(ctx, tx, categorySlugs)
	if err != nil {
		return nil, err
	}
	if err := tx.WithContext(ctx).Where("skill_id = ?", skillID).Delete(&model.SkillCategoryAssignment{}).Error; err != nil {
		return nil, fmt.Errorf("failed to clear skill categories: %w", err)
	}
	for _, category := range categories {
		assignment := model.SkillCategoryAssignment{
			SkillID:    skillID,
			CategoryID: category.ID,
		}
		if err := tx.WithContext(ctx).Create(&assignment).Error; err != nil {
			return nil, fmt.Errorf("failed to assign skill category: %w", err)
		}
	}
	return categories, nil
}

func (s *SkillService) ValidateCategorySlugs(ctx context.Context, categorySlugs []string) error {
	_, err := s.resolveCategorySlugs(ctx, s.db, categorySlugs)
	return err
}

func (s *SkillService) resolveCategorySlugs(ctx context.Context, db *gorm.DB, categorySlugs []string) ([]model.SkillCategory, error) {
	if len(categorySlugs) == 0 {
		return []model.SkillCategory{}, nil
	}

	normalized := make([]string, 0, len(categorySlugs))
	seen := make(map[string]struct{}, len(categorySlugs))
	for _, rawSlug := range categorySlugs {
		slug := normalizeCategorySlug(rawSlug)
		if slug == "" || slug == UncategorizedSlug || !categorySlugRegex.MatchString(slug) {
			return nil, fmt.Errorf("%w: invalid category slug", ErrInvalidCategory)
		}
		if _, ok := seen[slug]; ok {
			return nil, fmt.Errorf("%w: duplicate category slug", ErrInvalidCategory)
		}
		seen[slug] = struct{}{}
		normalized = append(normalized, slug)
	}

	var categories []model.SkillCategory
	if err := db.WithContext(ctx).Where("slug IN ?", normalized).Find(&categories).Error; err != nil {
		return nil, fmt.Errorf("failed to load categories: %w", err)
	}
	if len(categories) != len(normalized) {
		return nil, fmt.Errorf("%w: category not found", ErrInvalidCategory)
	}

	bySlug := make(map[string]model.SkillCategory, len(categories))
	for _, category := range categories {
		bySlug[category.Slug] = category
	}
	ordered := make([]model.SkillCategory, 0, len(normalized))
	for _, slug := range normalized {
		category, ok := bySlug[slug]
		if !ok {
			return nil, fmt.Errorf("%w: category not found", ErrInvalidCategory)
		}
		ordered = append(ordered, category)
	}
	return ordered, nil
}

func (s *SkillService) SkillsToItems(ctx context.Context, skills []model.Skill) ([]model.SkillItem, error) {
	items := make([]model.SkillItem, len(skills))
	for i := range skills {
		items[i] = s.skillToItem(&skills[i])
	}
	if err := s.PopulateSkillItemCategories(ctx, skills, items); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *SkillService) SkillToItemWithCategories(ctx context.Context, skill *model.Skill) (model.SkillItem, error) {
	items, err := s.SkillsToItems(ctx, []model.Skill{*skill})
	if err != nil {
		return model.SkillItem{}, err
	}
	if len(items) == 0 {
		return model.SkillItem{}, nil
	}
	return items[0], nil
}

func (s *SkillService) PopulateSkillItemCategories(ctx context.Context, skills []model.Skill, items []model.SkillItem) error {
	if len(skills) == 0 {
		return nil
	}
	categoriesBySkillID, err := s.CategoriesBySkillID(ctx, skills)
	if err != nil {
		return err
	}
	for i := range skills {
		categories := categoriesBySkillID[skills[i].ID]
		if categories == nil {
			categories = []model.CategoryInfo{}
		}
		items[i].Categories = categories
	}
	return nil
}

func (s *SkillService) CategoriesBySkillID(ctx context.Context, skills []model.Skill) (map[string][]model.CategoryInfo, error) {
	skillIDs := make([]string, 0, len(skills))
	seen := make(map[string]struct{}, len(skills))
	for _, skill := range skills {
		if skill.ID == "" {
			continue
		}
		if _, ok := seen[skill.ID]; ok {
			continue
		}
		seen[skill.ID] = struct{}{}
		skillIDs = append(skillIDs, skill.ID)
	}
	if len(skillIDs) == 0 {
		return map[string][]model.CategoryInfo{}, nil
	}

	type row struct {
		SkillID     string
		Slug        string
		Name        string
		Description string
		SortOrder   int
	}
	var rows []row
	if err := s.db.WithContext(ctx).
		Table("skill_category_assignments AS sca").
		Select("sca.skill_id, c.slug, c.name, c.description, c.sort_order").
		Joins("JOIN skill_categories AS c ON c.id = sca.category_id").
		Where("sca.skill_id IN ?", skillIDs).
		Order("c.sort_order ASC").
		Order("c.slug ASC").
		Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("failed to load skill categories: %w", err)
	}

	result := make(map[string][]model.CategoryInfo, len(skillIDs))
	for _, row := range rows {
		result[row.SkillID] = append(result[row.SkillID], model.CategoryInfo{
			Slug:        row.Slug,
			Name:        row.Name,
			Description: row.Description,
			SortOrder:   row.SortOrder,
		})
	}
	return result, nil
}

func normalizeCategorySlug(slug string) string {
	return strings.ToLower(strings.TrimSpace(slug))
}

func validateWritableCategory(slug, name string) error {
	if slug == "" || slug == UncategorizedSlug || !categorySlugRegex.MatchString(slug) {
		return fmt.Errorf("%w: invalid category slug", ErrInvalidCategory)
	}
	if name == "" {
		return fmt.Errorf("%w: category name is required", ErrInvalidCategory)
	}
	return nil
}

func categoryInfo(category model.SkillCategory) model.CategoryInfo {
	return model.CategoryInfo{
		Slug:        category.Slug,
		Name:        category.Name,
		Description: category.Description,
		SortOrder:   category.SortOrder,
	}
}

func categoryInfos(categories []model.SkillCategory) []model.CategoryInfo {
	infos := make([]model.CategoryInfo, len(categories))
	for i, category := range categories {
		infos[i] = categoryInfo(category)
	}
	return infos
}

func categoryCursor(category model.SkillCategory) string {
	return fmt.Sprintf("%d:%s", category.SortOrder, category.Slug)
}

func parseCategoryCursor(cursor string) (int, string, error) {
	sortOrderValue, slug, ok := strings.Cut(cursor, ":")
	if !ok || slug == "" {
		return 0, "", fmt.Errorf("%w: invalid category cursor", ErrInvalidCategory)
	}
	sortOrder, err := strconv.Atoi(sortOrderValue)
	if err != nil {
		return 0, "", fmt.Errorf("%w: invalid category cursor", ErrInvalidCategory)
	}
	return sortOrder, slug, nil
}

func isUniqueViolation(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "duplicate key") ||
		strings.Contains(message, "unique") ||
		strings.Contains(message, "23505")
}
