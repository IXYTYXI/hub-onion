package integration

import (
	"encoding/csv"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/openclaw/clawhub/backend/internal/config"
	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminSkillsSortFilterAndExport(t *testing.T) {
	ts := NewTestServerWithAuthConfig(t, config.AuthConfig{
		JWTSecret:   "test-jwt-secret",
		FrontendURL: "http://localhost:5173",
		Superusers: config.SuperusersConfig{
			Providers: map[string]config.ProviderSuperuserConfig{
				"feishu": {
					Emails: []string{"super-export@example.com"},
				},
			},
		},
	})
	ts.EnsureSkillSchema(t)
	ts.EnsureAuthSchema(t)
	ts.CleanupDatabase(t)
	ts.CleanupAuthTables(t)
	defer ts.CleanupDatabase(t)
	defer ts.CleanupAuthTables(t)

	owner := model.User{
		Handle:          "export-owner-" + suffix(),
		DisplayName:     "Export Owner",
		Email:           "export-owner-" + suffix() + "@example.com",
		Status:          model.UserStatusActive,
		AuthProvider:    "email",
		HasBoundEmail:   true,
		EmailVerifiedAt: verifiedAtPtr(),
	}
	require.NoError(t, ts.DB.Create(&owner).Error)
	require.NoError(t, ts.DB.First(&owner, "handle = ?", owner.Handle).Error)

	super := model.User{
		Handle:       "super-export-" + suffix(),
		DisplayName:  "Super Export",
		Email:        "super-export@example.com",
		Status:       model.UserStatusActive,
		AuthProvider: "feishu",
	}
	require.NoError(t, ts.DB.Create(&super).Error)
	require.NoError(t, ts.DB.First(&super, "email = ?", super.Email).Error)
	require.NoError(t, ts.DB.Create(&model.AuthIdentity{
		UserID:           super.ID,
		Provider:         "feishu",
		ProviderSubject:  "ou-super-export",
		ProviderUsername: "superexport",
		ProviderEmail:    "super-export@example.com",
		RawClaims:        "{}",
		LastLoginAt:      verifiedAtPtr(),
	}).Error)
	superToken, err := ts.AuthService.IssueJWT(&super)
	require.NoError(t, err)

	other := model.User{
		Handle:          "export-other-" + suffix(),
		DisplayName:     "Other",
		Email:           "export-other-" + suffix() + "@example.com",
		Status:          model.UserStatusActive,
		AuthProvider:    "email",
		HasBoundEmail:   true,
		EmailVerifiedAt: verifiedAtPtr(),
	}
	require.NoError(t, ts.DB.Create(&other).Error)
	require.NoError(t, ts.DB.First(&other, "handle = ?", other.Handle).Error)
	otherToken, err := ts.AuthService.IssueJWT(&other)
	require.NoError(t, err)

	loc, err := time.LoadLocation("Asia/Shanghai")
	require.NoError(t, err)
	day := time.Date(2026, 8, 10, 0, 0, 0, 0, loc)
	ownerID := owner.ID

	early := model.Skill{
		ID:               uuid.NewString(),
		Slug:             "early-skill-" + suffix(),
		DisplayName:      "Early Skill",
		ModerationStatus: "active",
		OwnerUserID:      &ownerID,
		CreatedAt:        day.Add(1 * time.Hour),
		UpdatedAt:        day.Add(5 * time.Hour),
	}
	mid := model.Skill{
		ID:               uuid.NewString(),
		Slug:             "mid-skill-" + suffix(),
		DisplayName:      "Mid Skill",
		ModerationStatus: "active",
		OwnerUserID:      &ownerID,
		CreatedAt:        day.Add(12 * time.Hour),
		UpdatedAt:        day.Add(2 * time.Hour),
	}
	lateBoundary := model.Skill{
		ID:               uuid.NewString(),
		Slug:             "late-skill-" + suffix(),
		DisplayName:      "Late Skill",
		ModerationStatus: "active",
		OwnerUserID:      &ownerID,
		CreatedAt:        time.Date(2026, 8, 10, 23, 59, 59, 999999999, loc),
		UpdatedAt:        day.Add(3 * time.Hour),
	}
	outside := model.Skill{
		ID:               uuid.NewString(),
		Slug:             "outside-skill-" + suffix(),
		DisplayName:      "Outside Skill",
		ModerationStatus: "active",
		OwnerUserID:      &ownerID,
		CreatedAt:        day.Add(25 * time.Hour),
		UpdatedAt:        day.Add(26 * time.Hour),
	}
	for _, skill := range []model.Skill{early, mid, lateBoundary, outside} {
		require.NoError(t, ts.DB.Create(&skill).Error)
	}

	t.Run("default sort is updated_at desc with id asc tiebreak", func(t *testing.T) {
		resp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills", nil, superToken)
		assert.Equal(t, http.StatusOK, resp.Code)
		body := resp.Body.String()
		earlyIdx := strings.Index(body, early.Slug)
		midIdx := strings.Index(body, mid.Slug)
		require.Greater(t, earlyIdx, -1)
		require.Greater(t, midIdx, -1)
		assert.Less(t, earlyIdx, midIdx)
	})

	t.Run("sort created_at asc", func(t *testing.T) {
		resp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills?sort=created_at&dir=asc", nil, superToken)
		assert.Equal(t, http.StatusOK, resp.Code)
		body := resp.Body.String()
		assert.Less(t, strings.Index(body, early.Slug), strings.Index(body, mid.Slug))
	})

	t.Run("invalid sort and dir", func(t *testing.T) {
		resp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills?sort=downloads", nil, superToken)
		assert.Equal(t, http.StatusBadRequest, resp.Code)

		resp = ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills?dir=up", nil, superToken)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("created range closed interval includes boundaries", func(t *testing.T) {
		resp := ts.DoAuthenticatedRequest(
			http.MethodGet,
			"/api/v1/admin/skills?createdFrom=2026-08-10&createdTo=2026-08-10&sort=created_at&dir=asc",
			nil,
			superToken,
		)
		assert.Equal(t, http.StatusOK, resp.Code)
		body := resp.Body.String()
		assert.Contains(t, body, early.Slug)
		assert.Contains(t, body, mid.Slug)
		assert.Contains(t, body, lateBoundary.Slug)
		assert.NotContains(t, body, outside.Slug)
	})

	t.Run("single sided and reversed/illegal times", func(t *testing.T) {
		resp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills?createdTo=2026-08-10", nil, superToken)
		assert.Equal(t, http.StatusOK, resp.Code)
		assert.NotContains(t, resp.Body.String(), outside.Slug)

		resp = ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills?createdFrom=2026-08-11&createdTo=2026-08-10", nil, superToken)
		assert.Equal(t, http.StatusBadRequest, resp.Code)

		resp = ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills?createdFrom=1722470400", nil, superToken)
		assert.Equal(t, http.StatusBadRequest, resp.Code)

		resp = ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills?createdFrom=2026-08-10T12:00:00", nil, superToken)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("export csv success empty fields and headers", func(t *testing.T) {
		orphan := model.Skill{
			ID:               uuid.NewString(),
			Slug:             "orphan-skill-" + suffix(),
			DisplayName:      "Orphan Skill",
			ModerationStatus: "active",
			CreatedAt:        day.Add(4 * time.Hour),
			UpdatedAt:        day.Add(4 * time.Hour),
		}
		require.NoError(t, ts.DB.Create(&orphan).Error)

		resp := ts.DoAuthenticatedRequest(
			http.MethodGet,
			"/api/v1/admin/skills/export?createdFrom=2026-08-10&createdTo=2026-08-10&sort=created_at&dir=asc",
			nil,
			superToken,
		)
		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Contains(t, resp.Header().Get("Content-Type"), "text/csv")
		disposition := resp.Header().Get("Content-Disposition")
		assert.Contains(t, disposition, `attachment; filename="skills-`)
		assert.Contains(t, disposition, `.csv"`)

		reader := csv.NewReader(strings.NewReader(strings.TrimPrefix(resp.Body.String(), "\ufeff")))
		rows, err := reader.ReadAll()
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(rows), 2)
		assert.Equal(t, []string{
			"Slug", "Skill 名称", "用户 Handle", "用户昵称", "用户邮箱", "状态",
			"创建时间", "最近更新时间", "最新版本", "提交时间", "精选",
		}, rows[0])
		assert.True(t, strings.HasPrefix(resp.Body.String(), "\ufeff") || strings.HasPrefix(resp.Body.String(), "\xef\xbb\xbf"))

		var orphanRow []string
		for _, row := range rows[1:] {
			if row[0] == orphan.Slug {
				orphanRow = row
				break
			}
		}
		require.NotNil(t, orphanRow)
		assert.Equal(t, "", orphanRow[2]) // handle
		assert.Equal(t, "", orphanRow[3]) // nickname
		assert.Equal(t, "", orphanRow[4]) // email
		assert.Equal(t, "", orphanRow[8]) // latest version
		assert.Equal(t, "", orphanRow[9]) // submitted at
		assert.Contains(t, orphanRow[6], "+08:00")

		var ownerRow []string
		for _, row := range rows[1:] {
			if row[0] == early.Slug {
				ownerRow = row
				break
			}
		}
		require.NotNil(t, ownerRow)
		assert.Equal(t, owner.Handle, ownerRow[2])
		assert.Equal(t, owner.DisplayName, ownerRow[3])
	})

	t.Run("export forbidden for non-superuser", func(t *testing.T) {
		resp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills/export", nil, otherToken)
		assert.Equal(t, http.StatusForbidden, resp.Code)
	})

	t.Run("export rejects invalid time", func(t *testing.T) {
		resp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills/export?createdFrom=nope", nil, superToken)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("timeField submitted_at filter and sort", func(t *testing.T) {
		withVersion := model.Skill{
			ID:               uuid.NewString(),
			Slug:             "submitted-skill-" + suffix(),
			DisplayName:      "Submitted Skill",
			ModerationStatus: "active",
			OwnerUserID:      &ownerID,
			CreatedAt:        day.Add(48 * time.Hour), // outside created day filter
			UpdatedAt:        day.Add(48 * time.Hour),
		}
		require.NoError(t, ts.DB.Create(&withVersion).Error)
		versionID := uuid.NewString()
		require.NoError(t, ts.DB.Create(&model.SkillVersion{
			ID:        versionID,
			SkillID:   withVersion.ID,
			Version:   "1.0.0",
			Changelog: "init",
			Files:     model.FileList{},
			CreatedAt: day.Add(6 * time.Hour), // inside Aug 10
		}).Error)
		require.NoError(t, ts.DB.Model(&withVersion).Update("latest_version_id", versionID).Error)

		noVersion := model.Skill{
			ID:               uuid.NewString(),
			Slug:             "no-version-skill-" + suffix(),
			DisplayName:      "No Version",
			ModerationStatus: "active",
			OwnerUserID:      &ownerID,
			CreatedAt:        day.Add(6 * time.Hour),
			UpdatedAt:        day.Add(6 * time.Hour),
		}
		require.NoError(t, ts.DB.Create(&noVersion).Error)

		resp := ts.DoAuthenticatedRequest(
			http.MethodGet,
			"/api/v1/admin/skills?timeField=submitted_at&createdFrom=2026-08-10&createdTo=2026-08-10&sort=submitted_at&dir=asc",
			nil,
			superToken,
		)
		assert.Equal(t, http.StatusOK, resp.Code)
		body := resp.Body.String()
		assert.Contains(t, body, withVersion.Slug)
		assert.NotContains(t, body, noVersion.Slug)
		assert.NotContains(t, body, early.Slug) // early has no version

		resp = ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/skills?timeField=updated_at", nil, superToken)
		assert.Equal(t, http.StatusBadRequest, resp.Code)

		resp = ts.DoAuthenticatedRequest(
			http.MethodGet,
			"/api/v1/admin/skills?sort=submitted_at&dir=asc&owner="+url.QueryEscape(owner.Handle),
			nil,
			superToken,
		)
		assert.Equal(t, http.StatusOK, resp.Code)
		body = resp.Body.String()
		withIdx := strings.Index(body, withVersion.Slug)
		noIdx := strings.Index(body, noVersion.Slug)
		require.Greater(t, withIdx, -1)
		require.Greater(t, noIdx, -1)
		assert.Less(t, withIdx, noIdx) // no version sorts to end on ASC
	})

	t.Run("export rejects over 5000 rows", func(t *testing.T) {
		bulkDay := time.Date(2026, 7, 1, 12, 0, 0, 0, loc)
		bulk := make([]model.Skill, 0, 5001)
		for i := 0; i < 5001; i++ {
			bulk = append(bulk, model.Skill{
				ID:               uuid.NewString(),
				Slug:             "export-limit-" + uuid.NewString(),
				DisplayName:      "Export Limit",
				ModerationStatus: "active",
				CreatedAt:        bulkDay,
				UpdatedAt:        bulkDay,
			})
		}
		require.NoError(t, ts.DB.CreateInBatches(bulk, 500).Error)

		resp := ts.DoAuthenticatedRequest(
			http.MethodGet,
			"/api/v1/admin/skills/export?createdFrom=2026-07-01&createdTo=2026-07-01",
			nil,
			superToken,
		)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
		assert.Contains(t, resp.Body.String(), "5000")
	})
}

func TestListSkillsNewestUsesCreatedAt(t *testing.T) {
	ts := NewTestServer(t)
	ts.EnsureSkillSchema(t)
	ts.CleanupDatabase(t)
	defer ts.CleanupDatabase(t)

	now := time.Now().UTC()
	olderCreatedNewerUpdated := model.Skill{
		ID:               uuid.NewString(),
		Slug:             "older-created",
		DisplayName:      "Older Created",
		ModerationStatus: "active",
		CreatedAt:        now.Add(-3 * time.Hour),
		UpdatedAt:        now.Add(-30 * time.Minute),
	}
	newerCreatedOlderUpdated := model.Skill{
		ID:               uuid.NewString(),
		Slug:             "newer-created",
		DisplayName:      "Newer Created",
		ModerationStatus: "active",
		CreatedAt:        now.Add(-1 * time.Hour),
		UpdatedAt:        now.Add(-2 * time.Hour),
	}
	require.NoError(t, ts.DB.Create(&olderCreatedNewerUpdated).Error)
	require.NoError(t, ts.DB.Create(&newerCreatedOlderUpdated).Error)

	resp := ts.DoRequest(http.MethodGet, "/api/v1/skills?sort=newest&dir=desc", nil)
	var body model.SkillListResponse
	AssertJSONResponse(t, resp, http.StatusOK, &body)
	require.GreaterOrEqual(t, len(body.Items), 2)
	assert.Equal(t, "newer-created", body.Items[0].Slug)

	resp = ts.DoRequest(http.MethodGet, "/api/v1/skills?sort=created_at&dir=desc", nil)
	AssertJSONResponse(t, resp, http.StatusOK, &body)
	assert.Equal(t, "newer-created", body.Items[0].Slug)

	resp = ts.DoRequest(http.MethodGet, "/api/v1/skills?sort=updated&dir=desc", nil)
	AssertJSONResponse(t, resp, http.StatusOK, &body)
	assert.Equal(t, "older-created", body.Items[0].Slug)
}

func TestListSkillsNewestCursorPagination(t *testing.T) {
	ts := NewTestServer(t)
	ts.EnsureSkillSchema(t)
	ts.CleanupDatabase(t)
	defer ts.CleanupDatabase(t)

	now := time.Now().UTC()
	// IDs intentionally reverse relative to created_at so id-only cursors would skip rows.
	newest := model.Skill{
		ID:               "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
		Slug:             "cursor-newest",
		DisplayName:      "Cursor Newest",
		ModerationStatus: "active",
		CreatedAt:        now.Add(-1 * time.Hour),
		UpdatedAt:        now.Add(-1 * time.Hour),
	}
	middle := model.Skill{
		ID:               "ffffffff-2222-4222-8222-ffffffffffff",
		Slug:             "cursor-middle",
		DisplayName:      "Cursor Middle",
		ModerationStatus: "active",
		CreatedAt:        now.Add(-2 * time.Hour),
		UpdatedAt:        now.Add(-2 * time.Hour),
	}
	oldest := model.Skill{
		ID:               "bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb",
		Slug:             "cursor-oldest",
		DisplayName:      "Cursor Oldest",
		ModerationStatus: "active",
		CreatedAt:        now.Add(-3 * time.Hour),
		UpdatedAt:        now.Add(-3 * time.Hour),
	}
	for _, skill := range []model.Skill{newest, middle, oldest} {
		require.NoError(t, ts.DB.Create(&skill).Error)
	}

	collectPages := func(t *testing.T, dir string) []string {
		t.Helper()
		var slugs []string
		seen := map[string]struct{}{}
		path := "/api/v1/skills?sort=newest&dir=" + dir + "&limit=1"
		for page := 0; page < 5; page++ {
			resp := ts.DoRequest(http.MethodGet, path, nil)
			var body model.SkillListResponse
			AssertJSONResponse(t, resp, http.StatusOK, &body)
			require.LessOrEqual(t, len(body.Items), 1)
			if len(body.Items) == 0 {
				break
			}
			slug := body.Items[0].Slug
			if _, ok := seen[slug]; ok {
				t.Fatalf("duplicate slug across pages: %s", slug)
			}
			seen[slug] = struct{}{}
			slugs = append(slugs, slug)
			if body.NextCursor == nil {
				break
			}
			path = "/api/v1/skills?sort=newest&dir=" + dir + "&limit=1&cursor=" + url.QueryEscape(*body.NextCursor)
		}
		return slugs
	}

	t.Run("desc pages keep newest-to-oldest without gaps", func(t *testing.T) {
		assert.Equal(t, []string{"cursor-newest", "cursor-middle", "cursor-oldest"}, collectPages(t, "desc"))
	})

	t.Run("asc pages keep oldest-to-newest without gaps", func(t *testing.T) {
		assert.Equal(t, []string{"cursor-oldest", "cursor-middle", "cursor-newest"}, collectPages(t, "asc"))
	})
}
