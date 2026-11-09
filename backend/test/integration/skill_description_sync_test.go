package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/openclaw/clawhub/backend/internal/config"
	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/openclaw/clawhub/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSkillDescriptionSyncEndpoint(t *testing.T) {
	ts, superToken, normalToken := newDescriptionSyncTestServer(t)

	updatable := createSkillVersionForDescriptionSync(t, ts, "sync-updated-"+suffix(), "", model.FileList{
		{Path: "SKILL.md", StorageKey: "sync/updated"},
	})
	ts.StorageService.(*MockStorageService).SetFile("sync/updated", []byte("---\ndescription: Backfilled description\n---\n# Demo\n"))

	createSkillVersionForDescriptionSync(t, ts, "sync-skipped-"+suffix(), "", model.FileList{
		{Path: "SKILL.md", StorageKey: "sync/skipped"},
	})
	ts.StorageService.(*MockStorageService).SetFile("sync/skipped", []byte("# Demo\n"))

	createSkillVersionForDescriptionSync(t, ts, "sync-failed-"+suffix(), "", model.FileList{
		{Path: "SKILL.md", StorageKey: "sync/missing"},
	})

	existing := createSkillVersionForDescriptionSync(t, ts, "sync-existing-"+suffix(), "Already set", model.FileList{
		{Path: "SKILL.md", StorageKey: "sync/existing"},
	})
	ts.StorageService.(*MockStorageService).SetFile("sync/existing", []byte("---\ndescription: Should not overwrite\n---\n# Demo\n"))

	forbiddenResp := ts.DoAuthenticatedRequest(http.MethodPost, "/api/v1/admin/maintenance/skill-descriptions/sync", nil, normalToken)
	assert.Equal(t, http.StatusForbidden, forbiddenResp.Code)

	resp := ts.DoAuthenticatedRequest(http.MethodPost, "/api/v1/admin/maintenance/skill-descriptions/sync", nil, superToken)
	require.Equal(t, http.StatusOK, resp.Code)

	var result service.SkillDescriptionSyncResult
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &result))
	assert.False(t, result.Running)
	assert.False(t, result.Locked)
	assert.Equal(t, "同步完成", result.Msg)
	assert.Equal(t, 3, result.Scanned)
	assert.Equal(t, 1, result.Updated)
	assert.Equal(t, 1, result.Skipped)
	assert.Equal(t, 1, result.Failed)

	var updated model.Skill
	require.NoError(t, ts.DB.First(&updated, "id = ?", updatable.ID).Error)
	assert.Equal(t, "Backfilled description", updated.Description)

	var unchanged model.Skill
	require.NoError(t, ts.DB.First(&unchanged, "id = ?", existing.ID).Error)
	assert.Equal(t, "Already set", unchanged.Description)

	slugResp := ts.DoAuthenticatedRequest(http.MethodPost, "/api/v1/admin/maintenance/skill-descriptions/sync/"+updatable.Slug, nil, superToken)
	assert.Equal(t, http.StatusNotFound, slugResp.Code)
}

func TestSkillDescriptionSyncLockedResponse(t *testing.T) {
	ts, superToken, _ := newDescriptionSyncTestServer(t)
	sqlDB, err := ts.DB.DB()
	require.NoError(t, err)
	conn, err := sqlDB.Conn(context.Background())
	require.NoError(t, err)
	defer conn.Close()
	_, err = conn.ExecContext(context.Background(), "SELECT pg_advisory_lock($1)", service.SkillDescriptionSyncLockKey)
	require.NoError(t, err)
	defer conn.ExecContext(context.Background(), "SELECT pg_advisory_unlock($1)", service.SkillDescriptionSyncLockKey)

	resp := ts.DoAuthenticatedRequest(http.MethodPost, "/api/v1/admin/maintenance/skill-descriptions/sync", nil, superToken)
	require.Equal(t, http.StatusOK, resp.Code)

	var result service.SkillDescriptionSyncResult
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &result))
	assert.True(t, result.Running)
	assert.True(t, result.Locked)
	assert.Equal(t, "同步任务正在运行", result.Msg)
}

func TestSkillDescriptionSyncCancelReleasesLock(t *testing.T) {
	ts, _, _ := newDescriptionSyncTestServer(t)
	blockingStorage := &blockingDownloadStorage{started: make(chan struct{})}
	syncService := service.NewSkillService(ts.DB, blockingStorage)
	createSkillVersionForDescriptionSync(t, ts, "sync-cancel-"+suffix(), "", model.FileList{
		{Path: "SKILL.md", StorageKey: "sync/cancel"},
	})

	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() {
		_, err := syncService.SyncMissingSkillDescriptions(ctx)
		errCh <- err
	}()

	<-blockingStorage.started
	cancel()
	require.Error(t, <-errCh)

	sqlDB, err := ts.DB.DB()
	require.NoError(t, err)
	conn, err := sqlDB.Conn(context.Background())
	require.NoError(t, err)
	defer conn.Close()

	var locked bool
	require.NoError(t, conn.QueryRowContext(context.Background(), "SELECT pg_try_advisory_lock($1)", service.SkillDescriptionSyncLockKey).Scan(&locked))
	assert.True(t, locked)
	if locked {
		_, _ = conn.ExecContext(context.Background(), "SELECT pg_advisory_unlock($1)", service.SkillDescriptionSyncLockKey)
	}
}

func newDescriptionSyncTestServer(t *testing.T) (*TestServer, string, string) {
	t.Helper()
	ts := NewTestServerWithAuthConfig(t, config.AuthConfig{
		JWTSecret:   "test-jwt-secret",
		FrontendURL: "http://localhost:5173",
		Superusers: config.SuperusersConfig{
			Providers: map[string]config.ProviderSuperuserConfig{
				"feishu": {
					Emails: []string{"sync-super@example.com"},
				},
			},
		},
	})
	ts.EnsureSkillSchema(t)
	ts.EnsureAuthSchema(t)
	ts.CleanupDatabase(t)
	ts.CleanupAuthTables(t)
	t.Cleanup(func() {
		ts.CleanupDatabase(t)
		ts.CleanupAuthTables(t)
	})

	super := model.User{
		Handle:       "sync-super-" + suffix(),
		DisplayName:  "Sync Super",
		Email:        "sync-super@example.com",
		Status:       model.UserStatusActive,
		AuthProvider: "feishu",
	}
	require.NoError(t, ts.DB.Create(&super).Error)
	require.NoError(t, ts.DB.Create(&model.AuthIdentity{
		UserID:           super.ID,
		Provider:         "feishu",
		ProviderSubject:  "ou-sync-super",
		ProviderUsername: "sync-super",
		ProviderEmail:    "sync-super@example.com",
		RawClaims:        "{}",
		LastLoginAt:      verifiedAtPtr(),
	}).Error)
	superToken, err := ts.AuthService.IssueJWT(&super)
	require.NoError(t, err)

	normal := model.User{
		Handle:          "sync-normal-" + suffix(),
		DisplayName:     "Sync Normal",
		Email:           "sync-normal-" + suffix() + "@example.com",
		Status:          model.UserStatusActive,
		AuthProvider:    "email",
		HasBoundEmail:   true,
		EmailVerifiedAt: verifiedAtPtr(),
	}
	require.NoError(t, ts.DB.Create(&normal).Error)
	normalToken, err := ts.AuthService.IssueJWT(&normal)
	require.NoError(t, err)

	return ts, superToken, normalToken
}

func createSkillVersionForDescriptionSync(t *testing.T, ts *TestServer, slug string, description string, files model.FileList) model.Skill {
	t.Helper()
	skill := model.Skill{
		ID:               uuid.New().String(),
		Slug:             slug,
		DisplayName:      slug,
		Description:      description,
		ModerationStatus: "active",
		StatsVersions:    1,
	}
	require.NoError(t, ts.DB.Create(&skill).Error)

	version := model.SkillVersion{
		ID:        uuid.New().String(),
		SkillID:   skill.ID,
		Version:   "1.0.0",
		Changelog: "initial",
		Files:     files,
	}
	require.NoError(t, ts.DB.Create(&version).Error)
	require.NoError(t, ts.DB.Model(&skill).Update("latest_version_id", version.ID).Error)
	require.NoError(t, ts.DB.First(&skill, "id = ?", skill.ID).Error)
	return skill
}

type blockingDownloadStorage struct {
	started chan struct{}
}

func (s *blockingDownloadStorage) Upload(context.Context, string, io.Reader, string) error {
	return nil
}

func (s *blockingDownloadStorage) UploadWithHash(context.Context, string, io.Reader, string) (string, error) {
	return "", nil
}

func (s *blockingDownloadStorage) Download(ctx context.Context, _ string) (io.ReadCloser, error) {
	close(s.started)
	<-ctx.Done()
	return nil, fmt.Errorf("download canceled: %w", ctx.Err())
}

func (s *blockingDownloadStorage) Delete(context.Context, string) error {
	return nil
}
