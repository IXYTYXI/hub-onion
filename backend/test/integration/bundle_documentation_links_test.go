package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/openclaw/clawhub/backend/internal/config"
	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBundleDocumentationLinksLifecycleAndResponses(t *testing.T) {
	ts := newBundleDocumentationLinksTestServer(t)
	ownerToken := createCategoryTestSessionUser(t, ts, "bundle-doc-owner", "bundle-doc-owner@example.com", "email")
	superToken := createCategoryTestSessionUser(t, ts, "bundle-doc-super", "bundle-doc-super@example.com", "feishu")

	skill := model.Skill{
		Slug:               "bundle-doc-skill",
		DisplayName:        "Bundle Doc Skill",
		ModerationStatus:   "active",
		DocumentationLinks: model.DocumentationLinkList{{Title: "Skill 文档", URL: "https://skills.example.com/docs"}},
	}
	require.NoError(t, ts.DB.Create(&skill).Error)

	initialLinks := model.DocumentationLinkList{
		{Title: "  技能包文档  ", URL: "  https://docs.example.com/bundle?from=hub#usage  "},
		{URL: "http://gitlab.internal/group/bundle/-/blob/main/README.md"},
	}
	linkedSlug := "bundle-doc-linked"
	createResp := publishBundleJSON(t, ts, ownerToken, model.PublishBundlePayload{
		Slug:               linkedSlug,
		DisplayName:        "Bundle Docs",
		Description:        "bundle documentation links",
		DocumentationLinks: &initialLinks,
		Skills:             []model.BundleSkillInput{{Slug: skill.Slug, SortOrder: 1}},
	})
	assert.Equal(t, http.StatusOK, createResp.Code, createResp.Body.String())

	normalizedInitial := model.DocumentationLinkList{
		{Title: "技能包文档", URL: "https://docs.example.com/bundle?from=hub#usage"},
		{URL: "http://gitlab.internal/group/bundle/-/blob/main/README.md"},
	}
	assertStoredBundleLinks(t, ts, linkedSlug, normalizedInitial)

	legacyUpdateResp := publishBundleJSON(t, ts, ownerToken, map[string]interface{}{
		"slug":        linkedSlug,
		"displayName": "Bundle Docs Legacy Update",
		"description": "updated without documentationLinks",
		"skills":      []map[string]interface{}{{"slug": skill.Slug, "sortOrder": 1}},
	})
	assert.Equal(t, http.StatusOK, legacyUpdateResp.Code, legacyUpdateResp.Body.String())
	assertStoredBundleLinks(t, ts, linkedSlug, normalizedInitial)

	emptyLinks := model.DocumentationLinkList{}
	clearResp := publishBundleJSON(t, ts, ownerToken, model.PublishBundlePayload{
		Slug:               linkedSlug,
		DisplayName:        "Bundle Docs Cleared",
		Description:        "cleared documentation links",
		DocumentationLinks: &emptyLinks,
		Skills:             []model.BundleSkillInput{{Slug: skill.Slug, SortOrder: 1}},
	})
	assert.Equal(t, http.StatusOK, clearResp.Code, clearResp.Body.String())
	assertStoredBundleLinks(t, ts, linkedSlug, model.DocumentationLinkList{})

	replacement := model.DocumentationLinkList{{Title: "源码", URL: "https://github.com/example/bundle"}}
	replaceResp := publishBundleJSON(t, ts, ownerToken, model.PublishBundlePayload{
		Slug:               linkedSlug,
		DisplayName:        "Bundle Docs Replaced",
		Description:        "replaced documentation links",
		DocumentationLinks: &replacement,
		Skills:             []model.BundleSkillInput{{Slug: skill.Slug, SortOrder: 1}},
	})
	assert.Equal(t, http.StatusOK, replaceResp.Code, replaceResp.Body.String())
	assertStoredBundleLinks(t, ts, linkedSlug, replacement)

	rollbackLinks := model.DocumentationLinkList{{URL: "https://rollback.example.com/docs"}}
	rollbackResp := publishBundleJSON(t, ts, ownerToken, model.PublishBundlePayload{
		Slug:               linkedSlug,
		DisplayName:        "Must Roll Back",
		Description:        "invalid category rolls back the transaction",
		DocumentationLinks: &rollbackLinks,
		CategorySlugs:      []string{"missing-category"},
		Skills:             []model.BundleSkillInput{{Slug: skill.Slug, SortOrder: 1}},
	})
	assert.Equal(t, http.StatusBadRequest, rollbackResp.Code, rollbackResp.Body.String())
	assertStoredBundleLinks(t, ts, linkedSlug, replacement)
	var rolledBack model.SkillBundle
	require.NoError(t, ts.DB.Where("slug = ? AND is_deleted = ?", linkedSlug, false).First(&rolledBack).Error)
	assert.Equal(t, "Bundle Docs Replaced", rolledBack.DisplayName)

	emptySlug := "bundle-doc-empty"
	emptyResp := publishBundleJSON(t, ts, ownerToken, map[string]interface{}{
		"slug":        emptySlug,
		"displayName": "Bundle Without Docs",
		"description": "old client payload",
		"skills":      []map[string]interface{}{{"slug": skill.Slug, "sortOrder": 1}},
	})
	assert.Equal(t, http.StatusOK, emptyResp.Code, emptyResp.Body.String())

	publicDetailResp := ts.DoRequest(http.MethodGet, "/api/v1/bundles/"+linkedSlug, nil)
	var publicDetail model.BundleDetailResponse
	AssertJSONResponse(t, publicDetailResp, http.StatusOK, &publicDetail)
	assert.Equal(t, replacement, publicDetail.Bundle.DocumentationLinks)
	assert.NotEqual(t, skill.DocumentationLinks, publicDetail.Bundle.DocumentationLinks)

	publicListResp := ts.DoRequest(http.MethodGet, "/api/v1/bundles?limit=20", nil)
	var publicList model.BundleListResponse
	AssertJSONResponse(t, publicListResp, http.StatusOK, &publicList)
	assertBundleItemLinks(t, publicList.Items, linkedSlug, replacement)
	assertBundleItemLinks(t, publicList.Items, emptySlug, model.DocumentationLinkList{})

	myListResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/my/bundles?limit=20", nil, ownerToken)
	var myList model.BundleListResponse
	AssertJSONResponse(t, myListResp, http.StatusOK, &myList)
	assertBundleItemLinks(t, myList.Items, linkedSlug, replacement)
	assertBundleItemLinks(t, myList.Items, emptySlug, model.DocumentationLinkList{})

	adminListResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/bundles?limit=20", nil, superToken)
	var adminList model.BundleListResponse
	AssertJSONResponse(t, adminListResp, http.StatusOK, &adminList)
	assertBundleItemLinks(t, adminList.Items, linkedSlug, replacement)
	assertBundleItemLinks(t, adminList.Items, emptySlug, model.DocumentationLinkList{})

	adminDetailResp := ts.DoAuthenticatedRequest(http.MethodGet, "/api/v1/admin/bundles/"+linkedSlug, nil, superToken)
	var adminDetail struct {
		Bundle struct {
			DocumentationLinks model.DocumentationLinkList `json:"documentationLinks"`
		} `json:"bundle"`
	}
	AssertJSONResponse(t, adminDetailResp, http.StatusOK, &adminDetail)
	assert.Equal(t, replacement, adminDetail.Bundle.DocumentationLinks)

	emptyAdminDetailResp := ts.DoAuthenticatedRequest(
		http.MethodGet,
		"/api/v1/admin/bundles/"+emptySlug,
		nil,
		superToken,
	)
	var emptyAdminDetail struct {
		Bundle struct {
			DocumentationLinks model.DocumentationLinkList `json:"documentationLinks"`
		} `json:"bundle"`
	}
	AssertJSONResponse(t, emptyAdminDetailResp, http.StatusOK, &emptyAdminDetail)
	assert.NotNil(t, emptyAdminDetail.Bundle.DocumentationLinks)
	assert.Empty(t, emptyAdminDetail.Bundle.DocumentationLinks)

	emptyDetailResp := ts.DoRequest(http.MethodGet, "/api/v1/bundles/"+emptySlug, nil)
	var emptyDetail model.BundleDetailResponse
	AssertJSONResponse(t, emptyDetailResp, http.StatusOK, &emptyDetail)
	assert.NotNil(t, emptyDetail.Bundle.DocumentationLinks)
	assert.Empty(t, emptyDetail.Bundle.DocumentationLinks)
}

func TestBundleDocumentationLinksValidationHasNoSideEffects(t *testing.T) {
	ts := newBundleDocumentationLinksTestServer(t)
	ownerToken := createCategoryTestSessionUser(t, ts, "bundle-doc-validation", "bundle-doc-validation@example.com", "email")

	elevenLinks := make(model.DocumentationLinkList, 11)
	for index := range elevenLinks {
		elevenLinks[index] = model.DocumentationLink{URL: fmt.Sprintf("https://example.com/docs/%d", index)}
	}
	tests := []struct {
		name  string
		links model.DocumentationLinkList
	}{
		{name: "too many", links: elevenLinks},
		{name: "title too long", links: model.DocumentationLinkList{{Title: strings.Repeat("文", 81), URL: "https://example.com/docs"}}},
		{name: "url too long", links: model.DocumentationLinkList{{URL: "https://example.com/" + strings.Repeat("a", 2048)}}},
		{name: "missing url", links: model.DocumentationLinkList{{Title: "使用文档"}}},
		{name: "relative url", links: model.DocumentationLinkList{{URL: "/docs"}}},
		{name: "invalid scheme", links: model.DocumentationLinkList{{URL: "javascript:alert(1)"}}},
		{name: "userinfo", links: model.DocumentationLinkList{{URL: "https://user:password@example.com/docs"}}},
		{name: "duplicate", links: model.DocumentationLinkList{{URL: "https://example.com/docs"}, {URL: " https://example.com/docs "}}},
	}

	for index, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			slug := fmt.Sprintf("bundle-doc-invalid-%d", index)
			resp := publishBundleJSON(t, ts, ownerToken, model.PublishBundlePayload{
				Slug:               slug,
				DisplayName:        "Invalid Bundle Docs",
				Description:        "must be rejected",
				DocumentationLinks: &tt.links,
				Skills:             []model.BundleSkillInput{{Slug: "missing-skill", SortOrder: 1}},
			})
			assert.Equal(t, http.StatusBadRequest, resp.Code, resp.Body.String())
			var errorBody struct {
				Code string `json:"code"`
			}
			require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &errorBody))
			assert.Equal(t, "invalid_documentation_link", errorBody.Code)

			var count int64
			require.NoError(t, ts.DB.Model(&model.SkillBundle{}).Where("slug = ?", slug).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestSkillBundleDocumentationLinksDatabaseDefaultAndConstraint(t *testing.T) {
	ts := newBundleDocumentationLinksTestServer(t)

	defaultSlug := "bundle-doc-db-default"
	require.NoError(t, ts.DB.Exec(`
		INSERT INTO skill_bundles (slug, display_name, description)
		VALUES (?, ?, ?)
	`, defaultSlug, "Default Bundle Docs", "database default").Error)

	var raw string
	require.NoError(t, ts.DB.Raw(`
		SELECT documentation_links::text
		FROM skill_bundles
		WHERE slug = ?
	`, defaultSlug).Scan(&raw).Error)
	assert.JSONEq(t, `[]`, raw)

	err := ts.DB.Exec(`
		INSERT INTO skill_bundles (slug, display_name, description, documentation_links)
		VALUES (?, ?, ?, '{}'::jsonb)
	`, "bundle-doc-db-invalid", "Invalid Bundle Docs", "constraint").Error
	require.Error(t, err)
}

func newBundleDocumentationLinksTestServer(t *testing.T) *TestServer {
	t.Helper()
	ts := NewTestServerWithAuthConfig(t, config.AuthConfig{
		JWTSecret:   "test-jwt-secret",
		FrontendURL: "http://localhost:5173",
		Superusers: config.SuperusersConfig{
			Providers: map[string]config.ProviderSuperuserConfig{
				"feishu": {Emails: []string{"bundle-doc-super@example.com"}},
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
	return ts
}

func publishBundleJSON(t *testing.T, ts *TestServer, token string, payload interface{}) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	return ts.DoAuthenticatedRequest(http.MethodPost, "/api/v1/bundles", bytes.NewReader(body), token)
}

func assertStoredBundleLinks(t *testing.T, ts *TestServer, slug string, expected model.DocumentationLinkList) {
	t.Helper()
	var bundle model.SkillBundle
	require.NoError(t, ts.DB.Where("slug = ? AND is_deleted = ?", slug, false).First(&bundle).Error)
	if expected == nil {
		expected = model.DocumentationLinkList{}
	}
	assert.Equal(t, expected, bundle.DocumentationLinks)
	assert.NotNil(t, bundle.DocumentationLinks)
}

func assertBundleItemLinks(t *testing.T, items []model.BundleItem, slug string, expected model.DocumentationLinkList) {
	t.Helper()
	for _, item := range items {
		if item.Slug != slug {
			continue
		}
		if expected == nil {
			expected = model.DocumentationLinkList{}
		}
		assert.Equal(t, expected, item.DocumentationLinks)
		assert.NotNil(t, item.DocumentationLinks)
		return
	}
	require.Failf(t, "bundle not found", "slug %q not found in response", slug)
}
