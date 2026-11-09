package model

import "time"

type SuperuserGrant struct {
	ID        string    `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Provider  string    `gorm:"not null;default:'feishu';uniqueIndex:idx_superuser_grants_provider_email,expression:lower(email)" json:"provider"`
	Email     string    `gorm:"not null" json:"email"`
	CreatedBy *string   `gorm:"type:uuid" json:"createdBy,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type ConfiguredSuperuserInfo struct {
	Provider string `json:"provider"`
	Email    string `json:"email"`
	Source   string `json:"source"`
	ReadOnly bool   `json:"readOnly"`
}

type DynamicSuperuserInfo struct {
	ID        string     `json:"id"`
	Provider  string     `json:"provider"`
	Email     string     `json:"email"`
	Source    string     `json:"source"`
	CreatedBy *string    `json:"createdBy,omitempty"`
	CreatedAt *time.Time `json:"createdAt,omitempty"`
}

type SuperuserCacheSyncResult struct {
	OK              bool `json:"ok"`
	ConfiguredCount int  `json:"configuredCount"`
	DynamicCount    int  `json:"dynamicCount"`
}
