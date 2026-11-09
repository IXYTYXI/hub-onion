package service

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"

	"github.com/openclaw/clawhub/backend/internal/model"
	"gorm.io/gorm"
)

const SuperuserGrantProviderFeishu = "feishu"

var (
	ErrInvalidSuperuserGrant       = errors.New("invalid superuser grant")
	ErrSuperuserGrantExists        = errors.New("superuser grant already exists")
	ErrSuperuserGrantNotFound      = errors.New("superuser grant not found")
	ErrConfiguredSuperuserReadOnly = errors.New("configured superuser is read-only")
)

type SuperuserGrantService struct {
	db *gorm.DB
}

func NewSuperuserGrantService(db *gorm.DB) *SuperuserGrantService {
	return &SuperuserGrantService{db: db}
}

func (s *SuperuserGrantService) List(ctx context.Context) ([]model.DynamicSuperuserInfo, error) {
	var grants []model.SuperuserGrant
	if err := s.db.WithContext(ctx).
		Order("created_at DESC").
		Order("email ASC").
		Find(&grants).Error; err != nil {
		return nil, fmt.Errorf("failed to list superuser grants: %w", err)
	}
	infos := make([]model.DynamicSuperuserInfo, len(grants))
	for i, grant := range grants {
		infos[i] = dynamicSuperuserInfo(grant)
	}
	return infos, nil
}

func (s *SuperuserGrantService) ListEmails(ctx context.Context) ([]string, error) {
	var emails []string
	if err := s.db.WithContext(ctx).
		Model(&model.SuperuserGrant{}).
		Where("provider = ?", SuperuserGrantProviderFeishu).
		Pluck("email", &emails).Error; err != nil {
		return nil, fmt.Errorf("failed to list superuser grant emails: %w", err)
	}
	return emails, nil
}

func (s *SuperuserGrantService) Create(ctx context.Context, email string, actorID string) (*model.DynamicSuperuserInfo, error) {
	normalized, err := normalizeSuperuserEmail(email)
	if err != nil {
		return nil, err
	}
	var createdBy *string
	if strings.TrimSpace(actorID) != "" {
		createdBy = &actorID
	}
	grant := model.SuperuserGrant{
		Provider:  SuperuserGrantProviderFeishu,
		Email:     normalized,
		CreatedBy: createdBy,
	}
	if err := s.db.WithContext(ctx).Create(&grant).Error; err != nil {
		if isUniqueViolation(err) {
			return nil, fmt.Errorf("%w: email already exists", ErrSuperuserGrantExists)
		}
		return nil, fmt.Errorf("failed to create superuser grant: %w", err)
	}
	info := dynamicSuperuserInfo(grant)
	return &info, nil
}

func (s *SuperuserGrantService) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("%w: id is required", ErrInvalidSuperuserGrant)
	}
	result := s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.SuperuserGrant{})
	if result.Error != nil {
		return fmt.Errorf("failed to delete superuser grant: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrSuperuserGrantNotFound
	}
	return nil
}

func (s *SuperuserGrantService) DeleteByEmail(ctx context.Context, email string) error {
	normalized, err := normalizeSuperuserEmail(email)
	if err != nil {
		return err
	}
	result := s.db.WithContext(ctx).
		Where("provider = ? AND lower(email) = ?", SuperuserGrantProviderFeishu, normalized).
		Delete(&model.SuperuserGrant{})
	if result.Error != nil {
		return fmt.Errorf("failed to delete superuser grant: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrSuperuserGrantNotFound
	}
	return nil
}

func (s *SuperuserGrantService) HasMatchingIdentity(ctx context.Context, identities []model.AuthIdentity) bool {
	emails := make([]string, 0, len(identities))
	seen := map[string]struct{}{}
	for _, identity := range identities {
		if strings.ToLower(strings.TrimSpace(identity.Provider)) != SuperuserGrantProviderFeishu {
			continue
		}
		email, err := normalizeSuperuserEmail(identity.ProviderEmail)
		if err != nil {
			continue
		}
		if _, ok := seen[email]; ok {
			continue
		}
		seen[email] = struct{}{}
		emails = append(emails, email)
	}
	if len(emails) == 0 {
		return false
	}
	var count int64
	err := s.db.WithContext(ctx).
		Model(&model.SuperuserGrant{}).
		Where("provider = ? AND lower(email) IN ?", SuperuserGrantProviderFeishu, emails).
		Count(&count).Error
	return err == nil && count > 0
}

func IsSuperuserGrantValidationError(err error) bool {
	return errors.Is(err, ErrInvalidSuperuserGrant) ||
		errors.Is(err, ErrSuperuserGrantExists) ||
		errors.Is(err, ErrConfiguredSuperuserReadOnly)
}

func normalizeSuperuserEmail(email string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(email))
	if trimmed == "" {
		return "", fmt.Errorf("%w: email is required", ErrInvalidSuperuserGrant)
	}
	address, err := mail.ParseAddress(trimmed)
	if err != nil || address.Address != trimmed {
		return "", fmt.Errorf("%w: invalid email", ErrInvalidSuperuserGrant)
	}
	return trimmed, nil
}

func dynamicSuperuserInfo(grant model.SuperuserGrant) model.DynamicSuperuserInfo {
	createdAt := grant.CreatedAt
	return model.DynamicSuperuserInfo{
		ID:        grant.ID,
		Provider:  grant.Provider,
		Email:     grant.Email,
		Source:    "dynamic",
		CreatedBy: grant.CreatedBy,
		CreatedAt: &createdAt,
	}
}
