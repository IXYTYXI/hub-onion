package service

import (
	"context"
	"database/sql"
	"fmt"
	"io"

	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/openclaw/clawhub/backend/internal/skillmeta"
)

const (
	SkillDescriptionSyncLockKey    int64 = 2026060201
	skillDescriptionSyncBatchSize        = 100
	maxSkillDescriptionReadmeBytes       = 1 << 20
)

type SkillDescriptionSyncResult struct {
	Running bool   `json:"running"`
	Locked  bool   `json:"locked"`
	Msg     string `json:"msg"`
	Scanned int    `json:"scanned"`
	Updated int    `json:"updated"`
	Skipped int    `json:"skipped"`
	Failed  int    `json:"failed"`
}

func (s *SkillService) SyncMissingSkillDescriptions(ctx context.Context) (*SkillDescriptionSyncResult, error) {
	conn, locked, err := s.trySkillDescriptionSyncLock(ctx)
	if err != nil {
		return nil, err
	}
	if !locked {
		return &SkillDescriptionSyncResult{
			Running: true,
			Locked:  true,
			Msg:     "同步任务正在运行",
		}, nil
	}
	defer releaseSkillDescriptionSyncLock(conn)

	result := &SkillDescriptionSyncResult{
		Running: false,
		Locked:  false,
		Msg:     "同步完成",
	}
	if err := s.syncMissingSkillDescriptions(ctx, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *SkillService) trySkillDescriptionSyncLock(ctx context.Context) (*sql.Conn, bool, error) {
	sqlDB, err := s.db.DB()
	if err != nil {
		return nil, false, fmt.Errorf("failed to get database connection: %w", err)
	}
	conn, err := sqlDB.Conn(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("failed to reserve database connection: %w", err)
	}

	var locked bool
	if err := conn.QueryRowContext(ctx, "SELECT pg_try_advisory_lock($1)", SkillDescriptionSyncLockKey).Scan(&locked); err != nil {
		_ = conn.Close()
		return nil, false, fmt.Errorf("failed to acquire description sync lock: %w", err)
	}
	if !locked {
		_ = conn.Close()
		return nil, false, nil
	}
	return conn, true, nil
}

func releaseSkillDescriptionSyncLock(conn *sql.Conn) {
	if conn == nil {
		return
	}
	_, _ = conn.ExecContext(context.Background(), "SELECT pg_advisory_unlock($1)", SkillDescriptionSyncLockKey)
	_ = conn.Close()
}

func (s *SkillService) syncMissingSkillDescriptions(ctx context.Context, result *SkillDescriptionSyncResult) error {
	lastID := ""
	for {
		if err := ctx.Err(); err != nil {
			return err
		}

		candidates, err := s.listMissingDescriptionCandidates(ctx, lastID, skillDescriptionSyncBatchSize)
		if err != nil {
			return err
		}
		if len(candidates) == 0 {
			return nil
		}

		for i := range candidates {
			if err := ctx.Err(); err != nil {
				return err
			}
			result.Scanned++
			s.syncSingleSkillDescription(ctx, &candidates[i], result)
		}
		lastID = candidates[len(candidates)-1].ID
	}
}

func (s *SkillService) listMissingDescriptionCandidates(ctx context.Context, lastID string, limit int) ([]model.Skill, error) {
	query := s.db.WithContext(ctx).
		Where("is_deleted = ? AND moderation_status = ? AND latest_version_id IS NOT NULL", false, "active").
		Where("TRIM(COALESCE(description, '')) = ''").
		Order("id ASC").
		Limit(limit).
		Preload("LatestVersion")
	if lastID != "" {
		query = query.Where("id > ?", lastID)
	}

	var skills []model.Skill
	if err := query.Find(&skills).Error; err != nil {
		return nil, fmt.Errorf("failed to list missing description skills: %w", err)
	}
	return skills, nil
}

func (s *SkillService) syncSingleSkillDescription(ctx context.Context, skill *model.Skill, result *SkillDescriptionSyncResult) {
	if skill.LatestVersion == nil {
		result.Skipped++
		return
	}

	file, ok := primaryReadmeFile(skill.LatestVersion.Files)
	if !ok {
		result.Skipped++
		return
	}

	reader, err := s.storageService.Download(ctx, file.StorageKey)
	if err != nil {
		result.Failed++
		return
	}
	bytes, readErr := readAndCloseLimited(reader, maxSkillDescriptionReadmeBytes)
	if readErr != nil {
		result.Failed++
		return
	}

	description, ok := skillmeta.ExtractFrontmatterDescription(string(bytes))
	if !ok {
		result.Skipped++
		return
	}

	update := s.db.WithContext(ctx).
		Model(&model.Skill{}).
		Where("id = ? AND TRIM(COALESCE(description, '')) = ''", skill.ID).
		Update("description", description)
	if update.Error != nil {
		result.Failed++
		return
	}
	if update.RowsAffected == 0 {
		result.Skipped++
		return
	}
	result.Updated++
}

func primaryReadmeFile(files model.FileList) (model.FileMetadata, bool) {
	var selected model.FileMetadata
	selectedPriority := 3
	for _, file := range files {
		if !skillmeta.IsPrimaryReadmePath(file.Path) {
			continue
		}
		priority := skillmeta.PrimaryReadmePriority(file.Path)
		if priority < selectedPriority {
			selected = file
			selectedPriority = priority
		}
	}
	return selected, selectedPriority < 3
}

func readAndCloseLimited(reader io.ReadCloser, limit int64) ([]byte, error) {
	defer reader.Close()
	bytes, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(bytes)) > limit {
		return nil, fmt.Errorf("readme exceeds %d bytes", limit)
	}
	return bytes, nil
}
