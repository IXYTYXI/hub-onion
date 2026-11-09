package integration

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"testing"

	"github.com/openclaw/clawhub/backend/internal/config"
	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSkillCategoriesPublishListSearchAndClear(t *testing.T) {
	ts := NewTestServer(t)
	ts.EnsureSkillSchema(t)
	ts.EnsureAuthSchema(t)
	ts.CleanupDatabase(t)
	ts.CleanupAuthTables(t)
	defer ts.CleanupDatabase(t)
	defer ts.CleanupAuthTables(t)

	require.NoError(t, ts.DB.Create(&model.SkillCategory{
		Slug:      "automation",
		Name:      "自动化",
		SortOrder: 10,
	}).Error)
	require.NoError(t, ts.DB.Create(&model.SkillCategory{
		Slug:      "productivity",
		Name:      "效率",
		SortOrder: 20,
	}).Error)
	rawToken := createCategoryTestPublisher(t, ts)

	files := CreateTestSkillFiles()
	payload := model.PublishPayload{
		Slug:          "category-publish-skill",
		DisplayName:   "Category Publish Skill",
		Version:       "1.0.0",
		Changelog:     "initial",
		Tags:          []string{"latest"},
		CategorySlugs: []string{"automation", "productivity"},
	}
	resp := ts.DoBearerMultipartRequest(http.MethodPost, "/api/v1/skills", payload, files, rawToken, true)
	AssertJSONResponse(t, resp, http.StatusOK, &model.PublishResponse{})

	detailResp := ts.DoRequest(http.MethodGet, "/api/v1/skills/"+payload.Slug, nil)
	var detail model.SkillDetailResponse
	AssertJSONResponse(t, detailResp, http.StatusOK, &detail)
	require.Len(t, detail.Skill.Categories, 2)
	assert.Equal(t, "automation", detail.Skill.Categories[0].Slug)
	assert.Equal(t, "productivity", detail.Skill.Categories[1].Slug)

	listResp := ts.DoRequest(http.MethodGet, "/api/v1/skills?category=automation", nil)
	var list model.SkillListResponse
	AssertJSONResponse(t, listResp, http.StatusOK, &list)
	require.Len(t, list.Items, 1)
	assert.Equal(t, payload.Slug, list.Items[0].Slug)

	searchResp := ts.DoRequest(http.MethodGet, "/api/v1/search?q=Category&category=productivity", nil)
	var search model.SearchResponse
	AssertJSONResponse(t, searchResp, http.StatusOK, &search)
	require.Len(t, search.Results, 1)
	assert.Equal(t, payload.Slug, search.Results[0].Slug)
	require.Len(t, search.Results[0].Categories, 2)

	invalidListResp := ts.DoRequest(http.MethodGet, "/api/v1/skills?category=missing-category", nil)
	var invalidList model.SkillListResponse
	AssertJSONResponse(t, invalidListResp, http.StatusOK, &invalidList)
	assert.Empty(t, invalidList.Items)

	payload.Version = "1.1.0"
	payload.CategorySlugs = nil
	clearResp := ts.DoBearerMultipartRequest(http.MethodPost, "/api/v1/skills", payload, files, rawToken, true)
	AssertJSONResponse(t, clearResp, http.StatusOK, &model.PublishResponse{})

	detailResp = ts.DoRequest(http.MethodGet, "/api/v1/skills/"+payload.Slug, nil)
	AssertJSONResponse(t, detailResp, http.StatusOK, &detail)
	assert.Empty(t, detail.Skill.Categories)

	uncategorizedResp := ts.DoRequest(http.MethodGet, "/api/v1/skills?category=uncategorized", nil)
	var uncategorized model.SkillListResponse
	AssertJSONResponse(t, uncategorizedResp, http.StatusOK, &uncategorized)
	require.Len(t, uncategorized.Items, 1)
	assert.Equal(t, payload.Slug, uncategorized.Items[0].Slug)

	payload.Version = "1.2.0"
	payload.CategorySlugs = []string{"missing-category"}
	invalidPublishResp := ts.DoBearerMultipartRequest(http.MethodPost, "/api/v1/skills", payload, files, rawToken, true)
	assert.Equal(t, http.StatusBadRequest, invalidPublishResp.Code)
	assert.Contains(t, invalidPublishResp.Body.String(), "invalid_category")
}

func TestSkillCategoryAdminCRUDAndAssignments(t *testing.T) {
	ts := NewTestServerWithAuthConfig(t, config.AuthConfig{
		JWTSecret:   "test-jwt-secret",
		FrontendURL: "http://localhost:5173",
		Superusers: config.SuperusersConfig{
			Providers: map[string]config.ProviderSuperuserConfig{
				"feishu": {Emails: []string{"super-category@example.com"}},
			},
		},
	})
	ts.EnsureSkillSchema(t)
	ts.EnsureAuthSchema(t)
	ts.CleanupDatabase(t)
	ts.CleanupAuthTables(t)
	defer ts.CleanupDatabase(t)
	defer ts.CleanupAuthTables(t)

	superToken := createCategoryTestSessionUser(t, ts, "super-category", "super-category@example.com", "feishu")
	normalToken := createCategoryTestSessionUser(t, ts, "normal-category", "normal-category@example.com", "email")

	forbiddenResp := ts.DoAuthenticatedRequest(
		http.MethodPost,
		"/api/v1/admin/categories",
		bytes.NewBufferString(`{"slug":"blocked","name":"Blocked"}`),
		normalToken,
	)
	assert.Equal(t, http.StatusForbidden, forbiddenResp.Code)

	createResp := ts.DoAuthenticatedRequest(
		http.MethodPost,
		"/api/v1/admin/categories",
		bytes.NewBufferString(`{"slug":"automation","name":"自动化","description":"自动化工具","sortOrder":10}`),
		superToken,
	)
	var created model.CategoryInfo
	AssertJSONResponse(t, createResp, http.StatusOK, &created)
	assert.Equal(t, "automation", created.Slug)

	virtualResp := ts.DoAuthenticatedRequest(
		http.MethodPost,
		"/api/v1/admin/categories",
		bytes.NewBufferString(`{"slug":"uncategorized","name":"未分类"}`),
		superToken,
	)
	assert.Equal(t, http.StatusBadRequest, virtualResp.Code)
	assert.Contains(t, virtualResp.Body.String(), "invalid_category")

	publicResp := ts.DoRequest(http.MethodGet, "/api/v1/categories", nil)
	var publicCategories struct {
		Items []model.CategoryInfo `json:"items"`
	}
	AssertJSONResponse(t, publicResp, http.StatusOK, &publicCategories)
	require.Len(t, publicCategories.Items, 1)
	assert.Equal(t, "automation", publicCategories.Items[0].Slug)

	require.NoError(t, ts.DB.Create(&model.SkillCategory{
		Slug:        "productivity",
		Name:        "效率",
		Description: "productivity tools",
		SortOrder:   20,
	}).Error)
	require.NoError(t, ts.DB.Create(&model.SkillCategory{
		Slug:        "security",
		Name:        "安全",
		Description: "scanner and review",
		SortOrder:   30,
	}).Error)

	adminPageResp := ts.DoAuthenticatedRequest(
		http.MethodGet,
		"/api/v1/admin/categories?limit=2",
		nil,
		superToken,
	)
	var adminPage struct {
		Items      []model.CategoryInfo `json:"items"`
		NextCursor *string              `json:"nextCursor"`
	}
	AssertJSONResponse(t, adminPageResp, http.StatusOK, &adminPage)
	require.Len(t, adminPage.Items, 2)
	assert.Equal(t, "automation", adminPage.Items[0].Slug)
	assert.Equal(t, "productivity", adminPage.Items[1].Slug)
	require.NotNil(t, adminPage.NextCursor)

	adminNextPageResp := ts.DoAuthenticatedRequest(
		http.MethodGet,
		"/api/v1/admin/categories?limit=2&cursor="+*adminPage.NextCursor,
		nil,
		superToken,
	)
	var adminNextPage struct {
		Items      []model.CategoryInfo `json:"items"`
		NextCursor *string              `json:"nextCursor"`
	}
	AssertJSONResponse(t, adminNextPageResp, http.StatusOK, &adminNextPage)
	require.Len(t, adminNextPage.Items, 1)
	assert.Equal(t, "security", adminNextPage.Items[0].Slug)
	assert.Nil(t, adminNextPage.NextCursor)

	adminSearchResp := ts.DoAuthenticatedRequest(
		http.MethodGet,
		"/api/v1/admin/categories?q=scan&limit=10",
		nil,
		superToken,
	)
	var adminSearch struct {
		Items      []model.CategoryInfo `json:"items"`
		NextCursor *string              `json:"nextCursor"`
	}
	AssertJSONResponse(t, adminSearchResp, http.StatusOK, &adminSearch)
	require.Len(t, adminSearch.Items, 1)
	assert.Equal(t, "security", adminSearch.Items[0].Slug)
	assert.Nil(t, adminSearch.NextCursor)

	skill := model.Skill{
		Slug:             "admin-category-skill",
		DisplayName:      "Admin Category Skill",
		Description:      "category admin test",
		ModerationStatus: "active",
		StatsVersions:    1,
	}
	require.NoError(t, ts.DB.Create(&skill).Error)
	version := model.SkillVersion{
		SkillID:   skill.ID,
		Version:   "1.0.0",
		Changelog: "initial",
		Files:     model.FileList{},
	}
	require.NoError(t, ts.DB.Create(&version).Error)
	require.NoError(t, ts.DB.Model(&skill).Update("latest_version_id", version.ID).Error)

	assignResp := ts.DoAuthenticatedRequest(
		http.MethodPatch,
		"/api/v1/admin/skills/"+skill.Slug+"/categories",
		bytes.NewBufferString(`{"categorySlugs":["automation"]}`),
		superToken,
	)
	var assigned struct {
		Categories []model.CategoryInfo `json:"categories"`
	}
	AssertJSONResponse(t, assignResp, http.StatusOK, &assigned)
	require.Len(t, assigned.Categories, 1)
	assert.Equal(t, "automation", assigned.Categories[0].Slug)

	deleteResp := ts.DoAuthenticatedRequest(
		http.MethodDelete,
		"/api/v1/admin/categories/automation",
		nil,
		superToken,
	)
	assert.Equal(t, http.StatusOK, deleteResp.Code)

	var assignmentCount int64
	require.NoError(t, ts.DB.Model(&model.SkillCategoryAssignment{}).Where("skill_id = ?", skill.ID).Count(&assignmentCount).Error)
	assert.Equal(t, int64(0), assignmentCount)

	uncategorizedResp := ts.DoRequest(http.MethodGet, "/api/v1/skills?category=uncategorized", nil)
	var uncategorized model.SkillListResponse
	AssertJSONResponse(t, uncategorizedResp, http.StatusOK, &uncategorized)
	require.Len(t, uncategorized.Items, 1)
	assert.Equal(t, skill.Slug, uncategorized.Items[0].Slug)
}

func createCategoryTestPublisher(t *testing.T, ts *TestServer) string {
	t.Helper()
	user := model.User{
		Handle:       "category-publisher",
		DisplayName:  "Category Publisher",
		Email:        "category-publisher@example.com",
		Role:         "user",
		Status:       model.UserStatusActive,
		AuthProvider: "email",
	}
	require.NoError(t, ts.DB.Create(&user).Error)
	rawToken := "category-publish-cli-token"
	hash := sha256.Sum256([]byte(rawToken))
	require.NoError(t, ts.DB.Create(&model.APIToken{
		UserID:    user.ID,
		Label:     "category-publish-test",
		TokenHash: hex.EncodeToString(hash[:]),
	}).Error)
	return rawToken
}

func createCategoryTestSessionUser(t *testing.T, ts *TestServer, handle, email, provider string) string {
	t.Helper()
	user := model.User{
		Handle:       handle,
		DisplayName:  handle,
		Email:        email,
		Status:       model.UserStatusActive,
		AuthProvider: provider,
	}
	require.NoError(t, ts.DB.Create(&user).Error)
	if provider == "feishu" {
		require.NoError(t, ts.DB.Create(&model.AuthIdentity{
			UserID:           user.ID,
			Provider:         "feishu",
			ProviderSubject:  "ou-" + handle,
			ProviderUsername: handle,
			ProviderEmail:    email,
			RawClaims:        "{}",
			LastLoginAt:      verifiedAtPtr(),
		}).Error)
	}
	token, err := ts.AuthService.IssueJWT(&user)
	require.NoError(t, err)
	return token
}
