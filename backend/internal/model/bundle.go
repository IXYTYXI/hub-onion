package model

import "time"

type SkillBundle struct {
	ID                 string                `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Slug               string                `gorm:"not null" json:"slug"`
	DisplayName        string                `gorm:"not null" json:"displayName"`
	Description        string                `gorm:"not null;default:''" json:"description"`
	DocumentationLinks DocumentationLinkList `gorm:"type:jsonb;not null;default:'[]'" json:"documentationLinks"`
	OwnerUserID        *string               `gorm:"type:uuid" json:"-"`
	StatsDownloads     int64                 `gorm:"default:0" json:"-"`
	StatsInstalls      int64                 `gorm:"default:0" json:"-"`
	IsDeleted          bool                  `gorm:"default:false" json:"-"`
	CreatedAt          time.Time             `json:"createdAt"`
	UpdatedAt          time.Time             `json:"updatedAt"`
}

type BundleSkill struct {
	BundleID  string    `gorm:"type:uuid;primaryKey" json:"bundleId"`
	SkillSlug string    `gorm:"primaryKey;column:skill_slug" json:"slug"`
	SortOrder int       `gorm:"not null;default:0" json:"sortOrder"`
	CreatedAt time.Time `json:"createdAt"`
}

type BundleCategoryAssignment struct {
	BundleID   string    `gorm:"type:uuid;primaryKey" json:"bundleId"`
	CategoryID string    `gorm:"type:uuid;primaryKey" json:"categoryId"`
	CreatedAt  time.Time `json:"createdAt"`
}

type BundleListResponse struct {
	Items      []BundleItem `json:"items"`
	NextCursor *string      `json:"nextCursor"`
}

type BundleItem struct {
	Slug               string                `json:"slug"`
	DisplayName        string                `json:"displayName"`
	Description        string                `json:"description"`
	DocumentationLinks DocumentationLinkList `json:"documentationLinks"`
	Summary            *string               `json:"summary,omitempty"`
	Owner              *OwnerInfo            `json:"owner,omitempty"`
	Categories         []CategoryInfo        `json:"categories"`
	Stats              BundleStats           `json:"stats"`
	Skills             []string              `json:"skills"`
	CreatedAt          int64                 `json:"createdAt"`
	UpdatedAt          int64                 `json:"updatedAt"`
}

type BundleStats struct {
	Downloads int64 `json:"downloads"`
	Installs  int64 `json:"installs"`
	Skills    int   `json:"skills"`
}

type BundleDetailResponse struct {
	Bundle        BundleItem        `json:"bundle"`
	Skills        []BundleSkillItem `json:"skills"`
	MissingSkills []string          `json:"missingSkills,omitempty"`
}

type BundleSkillItem struct {
	Slug          string         `json:"slug"`
	DisplayName   string         `json:"displayName,omitempty"`
	Summary       *string        `json:"summary,omitempty"`
	Version       *string        `json:"version,omitempty"`
	LatestVersion *VersionInfo   `json:"latestVersion,omitempty"`
	Owner         *OwnerInfo     `json:"owner,omitempty"`
	Categories    []CategoryInfo `json:"categories,omitempty"`
	Tags          interface{}    `json:"tags,omitempty"`
	Deleted       bool           `json:"deleted,omitempty"`
}

type BundleSkillInput struct {
	Slug      string `json:"slug"`
	SortOrder int    `json:"sortOrder"`
}

type PublishBundlePayload struct {
	Slug               string                 `json:"slug"`
	DisplayName        string                 `json:"displayName"`
	Description        string                 `json:"description"`
	DocumentationLinks *DocumentationLinkList `json:"documentationLinks,omitempty"`
	CategorySlugs      []string               `json:"categorySlugs,omitempty"`
	Skills             []BundleSkillInput     `json:"skills"`
}

type PublishBundleResponse struct {
	OK       string `json:"ok"`
	BundleID string `json:"bundleId"`
}
