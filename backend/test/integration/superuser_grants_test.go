package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/openclaw/clawhub/backend/internal/config"
	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/openclaw/clawhub/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSuperuserGrantsConfiguredReadOnlyAndDynamicCRUD(t *testing.T) {
	ts := newSuperuserGrantTestServer(t)
	defer cleanupSuperuserGrantTestData(t, ts)

	superToken := createCategoryTestSessionUser(t, ts, "grant-config-super", "config-super@example.com", "feishu")
	normalToken := createCategoryTestSessionUser(t, ts, "grant-normal", "normal-grant@example.com", "feishu")

	forbiddenResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/superusers", nil, normalToken)
	assert.Equal(t, http.StatusForbidden, forbiddenResp.Code)

	createResp := ts.DoAuthenticatedRequest(
		http.MethodPost,
		"/api/v1/admin/superusers",
		bytes.NewBufferString(`{"email":" Dynamic-Admin@Example.COM "}`),
		superToken,
	)
	var created struct {
		ID       string `json:"id"`
		Provider string `json:"provider"`
		Email    string `json:"email"`
		Source   string `json:"source"`
	}
	AssertJSONResponse(t, createResp, http.StatusOK, &created)
	require.NotEmpty(t, created.ID)
	assert.Equal(t, "feishu", created.Provider)
	assert.Equal(t, "dynamic-admin@example.com", created.Email)
	assert.Equal(t, "dynamic", created.Source)

	listResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/superusers", nil, superToken)
	var list struct {
		Configured []struct {
			Provider string `json:"provider"`
			Email    string `json:"email"`
			Source   string `json:"source"`
			ReadOnly bool   `json:"readOnly"`
		} `json:"configured"`
		Dynamic []struct {
			ID     string `json:"id"`
			Email  string `json:"email"`
			Source string `json:"source"`
		} `json:"dynamic"`
	}
	AssertJSONResponse(t, listResp, http.StatusOK, &list)
	require.Len(t, list.Configured, 1)
	assert.Equal(t, "config-super@example.com", list.Configured[0].Email)
	assert.Equal(t, "config", list.Configured[0].Source)
	assert.True(t, list.Configured[0].ReadOnly)
	require.Len(t, list.Dynamic, 1)
	assert.Equal(t, created.ID, list.Dynamic[0].ID)
	assert.Equal(t, "dynamic-admin@example.com", list.Dynamic[0].Email)

	duplicateResp := ts.DoAuthenticatedRequest(
		http.MethodPost,
		"/api/v1/admin/superusers",
		bytes.NewBufferString(`{"email":"dynamic-admin@example.com"}`),
		superToken,
	)
	assert.Equal(t, http.StatusConflict, duplicateResp.Code)

	invalidResp := ts.DoAuthenticatedRequest(
		http.MethodPost,
		"/api/v1/admin/superusers",
		bytes.NewBufferString(`{"email":"not-an-email"}`),
		superToken,
	)
	assert.Equal(t, http.StatusBadRequest, invalidResp.Code)

	deleteResp := ts.DoAuthenticatedRequest(http.MethodDelete, "/api/v1/admin/superusers?email=dynamic-admin@example.com", nil, superToken)
	AssertJSONResponse(t, deleteResp, http.StatusOK, &struct {
		OK string `json:"ok"`
	}{})

	addConfiguredResp := ts.DoAuthenticatedRequest(
		http.MethodPost,
		"/api/v1/admin/superusers",
		bytes.NewBufferString(`{"email":"config-super@example.com"}`),
		superToken,
	)
	assert.Equal(t, http.StatusConflict, addConfiguredResp.Code)
	assertJSONContainsErrorCode(t, addConfiguredResp.Body.Bytes(), "config_superuser_readonly")

	deleteConfiguredResp := ts.DoAuthenticatedRequest(
		http.MethodDelete,
		"/api/v1/admin/superusers?email=config-super@example.com",
		nil,
		superToken,
	)
	assert.Equal(t, http.StatusConflict, deleteConfiguredResp.Code)
	assertJSONContainsErrorCode(t, deleteConfiguredResp.Body.Bytes(), "config_superuser_readonly")
}

func TestDynamicSuperuserGrantEnablesAndRevokesManagementAccess(t *testing.T) {
	ts := newSuperuserGrantTestServer(t)
	defer cleanupSuperuserGrantTestData(t, ts)

	superToken := createCategoryTestSessionUser(t, ts, "grant-bootstrap-super", "config-super@example.com", "feishu")
	dynamicToken := createCategoryTestSessionUser(t, ts, "grant-dynamic-super", "dynamic-super@example.com", "feishu")

	beforeMeResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/users/me", nil, dynamicToken)
	var beforeMe struct {
		IsSuperuser bool `json:"isSuperuser"`
	}
	AssertJSONResponse(t, beforeMeResp, http.StatusOK, &beforeMe)
	assert.False(t, beforeMe.IsSuperuser)

	createResp := ts.DoAuthenticatedRequest(
		http.MethodPost,
		"/api/v1/admin/superusers",
		bytes.NewBufferString(`{"email":"dynamic-super@example.com"}`),
		superToken,
	)
	var created struct {
		ID string `json:"id"`
	}
	AssertJSONResponse(t, createResp, http.StatusOK, &created)
	require.NotEmpty(t, created.ID)

	afterMeResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/users/me", nil, dynamicToken)
	var afterMe struct {
		IsSuperuser bool `json:"isSuperuser"`
	}
	AssertJSONResponse(t, afterMeResp, http.StatusOK, &afterMe)
	assert.True(t, afterMe.IsSuperuser)

	dynamicListResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/superusers", nil, dynamicToken)
	assert.Equal(t, http.StatusOK, dynamicListResp.Code)

	deleteResp := ts.DoAuthenticatedRequest(http.MethodDelete, "/api/v1/admin/superusers?email=dynamic-super@example.com", nil, dynamicToken)
	assert.Equal(t, http.StatusOK, deleteResp.Code)

	revokedResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/superusers", nil, dynamicToken)
	assert.Equal(t, http.StatusForbidden, revokedResp.Code)
}

func TestSuperuserCacheLoadsDynamicGrantOnAuthServiceStartup(t *testing.T) {
	ts := newSuperuserGrantTestServer(t)
	defer cleanupSuperuserGrantTestData(t, ts)
	require.NoError(t, ts.DB.Create(&model.SuperuserGrant{
		Provider: service.SuperuserGrantProviderFeishu,
		Email:    "startup-admin@example.com",
	}).Error)

	authService := service.NewAuthServiceWithConfig(ts.DB, config.AuthConfig{
		JWTSecret:   "test-jwt-secret",
		FrontendURL: "http://localhost:5173",
	})
	user := &model.User{ID: "startup-user"}
	identities := []model.AuthIdentity{{Provider: "feishu", ProviderEmail: "startup-admin@example.com"}}

	assert.True(t, authService.IsSuperuserByIdentities(user, identities))
}

func TestSuperuserCacheInitializedPathDoesNotQueryGrantTable(t *testing.T) {
	ts := newSuperuserGrantTestServer(t)
	defer cleanupSuperuserGrantTestData(t, ts)
	require.NoError(t, ts.DB.Create(&model.SuperuserGrant{
		Provider: service.SuperuserGrantProviderFeishu,
		Email:    "cached-admin@example.com",
	}).Error)
	authService := service.NewAuthServiceWithConfig(ts.DB, config.AuthConfig{
		JWTSecret:   "test-jwt-secret",
		FrontendURL: "http://localhost:5173",
	})

	queries := countSuperuserGrantQueries(t, ts, func() {
		assert.True(t, authService.IsSuperuserByIdentities(
			&model.User{ID: "cached-user"},
			[]model.AuthIdentity{{Provider: "feishu", ProviderEmail: "cached-admin@example.com"}},
		))
	})
	assert.Equal(t, 0, queries)
}

func TestSuperuserCacheRebuildsOnceWhenMarkedStale(t *testing.T) {
	ts := newSuperuserGrantTestServer(t)
	defer cleanupSuperuserGrantTestData(t, ts)
	require.NoError(t, ts.DB.Create(&model.SuperuserGrant{
		Provider: service.SuperuserGrantProviderFeishu,
		Email:    "fallback-admin@example.com",
	}).Error)
	ts.AuthService.MarkSuperuserCacheNeedsRebuild()
	user := &model.User{ID: "fallback-user"}
	identities := []model.AuthIdentity{{Provider: "feishu", ProviderEmail: "fallback-admin@example.com"}}

	firstQueries := countSuperuserGrantQueries(t, ts, func() {
		assert.True(t, ts.AuthService.IsSuperuserByIdentities(user, identities))
	})
	secondQueries := countSuperuserGrantQueries(t, ts, func() {
		assert.True(t, ts.AuthService.IsSuperuserByIdentities(user, identities))
	})

	assert.Equal(t, 1, firstQueries)
	assert.Equal(t, 0, secondQueries)
}

func TestSuperuserCacheManualDatabaseWriteRequiresSync(t *testing.T) {
	ts := newSuperuserGrantTestServer(t)
	defer cleanupSuperuserGrantTestData(t, ts)

	superToken := createCategoryTestSessionUser(t, ts, "grant-sync-super", "config-super@example.com", "feishu")
	manualToken := createCategoryTestSessionUser(t, ts, "grant-manual-super", "manual-admin@example.com", "feishu")
	require.NoError(t, ts.DB.Create(&model.SuperuserGrant{
		Provider: service.SuperuserGrantProviderFeishu,
		Email:    "manual-admin@example.com",
	}).Error)

	beforeResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/superusers", nil, manualToken)
	assert.Equal(t, http.StatusForbidden, beforeResp.Code)

	syncResp := ts.DoAuthenticatedRequest(http.MethodPost, "/api/v1/admin/superusers/sync-cache", nil, superToken)
	var syncResult struct {
		OK              bool `json:"ok"`
		ConfiguredCount int  `json:"configuredCount"`
		DynamicCount    int  `json:"dynamicCount"`
	}
	AssertJSONResponse(t, syncResp, http.StatusOK, &syncResult)
	assert.True(t, syncResult.OK)
	assert.Equal(t, 1, syncResult.DynamicCount)

	afterResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/superusers", nil, manualToken)
	assert.Equal(t, http.StatusOK, afterResp.Code)
}

func TestSuperuserCacheConcurrentAccess(t *testing.T) {
	ts := newSuperuserGrantTestServer(t)
	defer cleanupSuperuserGrantTestData(t, ts)

	superToken := createCategoryTestSessionUser(t, ts, "grant-race-super", "config-super@example.com", "feishu")
	user := &model.User{ID: "race-user"}
	identities := []model.AuthIdentity{{Provider: "feishu", ProviderEmail: "race-admin@example.com"}}

	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 20; j++ {
				_ = ts.AuthService.IsSuperuserByIdentities(user, identities)
			}
		}()
	}
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			email := fmt.Sprintf("race-admin-%d@example.com", i)
			_ = ts.DoAuthenticatedRequest(
				http.MethodPost,
				"/api/v1/admin/superusers",
				bytes.NewBufferString(fmt.Sprintf(`{"email":"%s"}`, email)),
				superToken,
			)
			_ = ts.DoAuthenticatedRequest(
				http.MethodDelete,
				"/api/v1/admin/superusers?email="+email,
				nil,
				superToken,
			)
			_ = ts.DoAuthenticatedRequest(http.MethodPost, "/api/v1/admin/superusers/sync-cache", nil, superToken)
		}(i)
	}
	wg.Wait()

	finalResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/superusers", nil, superToken)
	assert.Equal(t, http.StatusOK, finalResp.Code)
}

func newSuperuserGrantTestServer(t *testing.T) *TestServer {
	t.Helper()
	ts := NewTestServerWithAuthConfig(t, config.AuthConfig{
		JWTSecret:   "test-jwt-secret",
		FrontendURL: "http://localhost:5173",
		Superusers: config.SuperusersConfig{
			Providers: map[string]config.ProviderSuperuserConfig{
				"feishu": {Emails: []string{"config-super@example.com"}},
			},
		},
	})
	ts.EnsureAuthSchema(t)
	ensureSuperuserGrantSchema(t, ts)
	cleanupSuperuserGrantTestData(t, ts)
	_, err := ts.AuthService.SyncSuperuserCache(context.Background())
	require.NoError(t, err)
	return ts
}

func ensureSuperuserGrantSchema(t *testing.T, ts *TestServer) {
	t.Helper()
	require.NoError(t, ts.DB.Exec(`
		CREATE TABLE IF NOT EXISTS superuser_grants (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			provider TEXT NOT NULL DEFAULT 'feishu',
			email TEXT NOT NULL,
			created_by UUID REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			CONSTRAINT superuser_grants_email_not_blank CHECK (btrim(email) <> '')
		)
	`).Error)
	require.NoError(t, ts.DB.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_superuser_grants_provider_email
		ON superuser_grants(provider, lower(email))
	`).Error)
}

func cleanupSuperuserGrantTestData(t *testing.T, ts *TestServer) {
	t.Helper()
	require.NoError(t, ts.DB.Exec("DELETE FROM superuser_grants").Error)
	ts.CleanupAuthTables(t)
}

func assertJSONContainsErrorCode(t *testing.T, body []byte, code string) {
	t.Helper()
	var payload struct {
		Code string `json:"code"`
	}
	require.NoError(t, json.Unmarshal(body, &payload))
	assert.Equal(t, code, payload.Code)
}

func countSuperuserGrantQueries(t *testing.T, ts *TestServer, run func()) int {
	t.Helper()
	var count int64
	callbackName := "test:count_superuser_grants:" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	require.NoError(t, ts.DB.Callback().Query().After("gorm:query").Register(callbackName, func(db *gorm.DB) {
		table := ""
		sql := ""
		if db.Statement != nil {
			table = db.Statement.Table
			sql = db.Statement.SQL.String()
		}
		if table == "superuser_grants" || strings.Contains(sql, "superuser_grants") {
			atomic.AddInt64(&count, 1)
		}
	}))
	defer func() {
		_ = ts.DB.Callback().Query().Remove(callbackName)
	}()
	run()
	return int(atomic.LoadInt64(&count))
}
