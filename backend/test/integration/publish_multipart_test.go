package integration

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/openclaw/clawhub/backend/internal/config"
	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPublishAcceptsPayloadFieldAndFileParts(t *testing.T) {
	ts := NewTestServerWithAuthConfig(t, config.AuthConfig{
		JWTSecret:   "test-jwt-secret",
		FrontendURL: "http://localhost:5173",
	})
	ts.EnsureAuthSchema(t)
	ts.CleanupDatabase(t)
	ts.CleanupAuthTables(t)
	defer ts.CleanupDatabase(t)
	defer ts.CleanupAuthTables(t)

	user := model.User{
		Handle:       "publisher",
		DisplayName:  "Publisher",
		Email:        "publisher@example.com",
		Role:         "user",
		Status:       model.UserStatusActive,
		AuthProvider: "email",
	}
	require.NoError(t, ts.DB.Create(&user).Error)

	rawToken := "publish-cli-token"
	hash := sha256.Sum256([]byte(rawToken))
	apiToken := model.APIToken{
		UserID:    user.ID,
		Label:     "publish-test",
		TokenHash: hex.EncodeToString(hash[:]),
	}
	require.NoError(t, ts.DB.Create(&apiToken).Error)

	files := CreateTestSkillFiles()

	t.Run("accepts payload as form field", func(t *testing.T) {
		payload := model.PublishPayload{
			Slug:        "field-payload-skill",
			DisplayName: "Field Payload Skill",
			Version:     "1.0.0",
			Changelog:   "Initial release",
			Tags:        []string{"latest"},
		}

		resp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, rawToken, true)

		var body model.PublishResponse
		AssertJSONResponse(t, resp, 200, &body)
		assert.Equal(t, "true", body.OK)
		assert.NotEmpty(t, body.SkillID)
		assert.NotEmpty(t, body.VersionID)
	})

	t.Run("still accepts payload as file", func(t *testing.T) {
		payload := model.PublishPayload{
			Slug:        "file-payload-skill",
			DisplayName: "File Payload Skill",
			Version:     "1.0.0",
			Changelog:   "Initial release",
			Tags:        []string{"latest"},
		}

		resp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, rawToken, false)

		var body model.PublishResponse
		AssertJSONResponse(t, resp, 200, &body)
		assert.Equal(t, "true", body.OK)
		assert.NotEmpty(t, body.SkillID)
		assert.NotEmpty(t, body.VersionID)
	})

	t.Run("normalizes markdown content type from generic multipart uploads", func(t *testing.T) {
		payload := model.PublishPayload{
			Slug:        "markdown-content-type-skill",
			DisplayName: "Markdown Content Type Skill",
			Version:     "1.0.0",
			Changelog:   "Initial release",
			Tags:        []string{"latest"},
		}

		resp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, map[string]string{
			"SKILL.md": "# Skill\n",
		}, rawToken, true)

		var body model.PublishResponse
		AssertJSONResponse(t, resp, 200, &body)

		var version model.SkillVersion
		require.NoError(t, ts.DB.Where("id = ?", body.VersionID).First(&version).Error)
		require.Len(t, version.Files, 1)
		assert.Equal(t, "text/markdown", version.Files[0].ContentType)
	})

	t.Run("extracts description from root skill readme into query summaries", func(t *testing.T) {
		payload := model.PublishPayload{
			Slug:        "description-summary-skill",
			DisplayName: "Description Summary Skill",
			Version:     "1.0.0",
			Changelog:   "Initial release",
			Tags:        []string{"latest"},
		}
		filesWithDescription := map[string]string{
			"SKILL.md": `---
name: description-summary-skill
description: "Automates follow-up work from chat promises."
---

# Description Summary Skill
`,
			"scripts/run.sh": "echo ok\n",
		}

		resp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, filesWithDescription, rawToken, true)
		AssertJSONResponse(t, resp, http.StatusOK, &model.PublishResponse{})

		listResp := ts.DoRequest("GET", "/api/v1/skills?sort=downloads", nil)
		var listBody model.SkillListResponse
		AssertJSONResponse(t, listResp, http.StatusOK, &listBody)
		listItem := findSkillItem(t, listBody.Items, payload.Slug)
		require.NotNil(t, listItem.Summary)
		assert.Equal(t, "Automates follow-up work from chat promises.", *listItem.Summary)

		detailResp := ts.DoRequest("GET", "/api/v1/skills/"+payload.Slug, nil)
		var detailBody model.SkillDetailResponse
		AssertJSONResponse(t, detailResp, http.StatusOK, &detailBody)
		require.NotNil(t, detailBody.Skill.Summary)
		assert.Equal(t, "Automates follow-up work from chat promises.", *detailBody.Skill.Summary)

		searchResp := ts.DoRequest("GET", "/api/v1/search?q=follow-up", nil)
		var searchBody model.SearchResponse
		AssertJSONResponse(t, searchResp, http.StatusOK, &searchBody)
		searchItem := findSearchResult(t, searchBody.Results, payload.Slug)
		require.NotNil(t, searchItem.Summary)
		assert.Equal(t, "Automates follow-up work from chat promises.", *searchItem.Summary)

		fileResp := ts.DoRequest("GET", "/api/v1/skills/"+payload.Slug+"/file?path=SKILL.md", nil)
		assert.Equal(t, http.StatusOK, fileResp.Code)
		assert.Contains(t, fileResp.Body.String(), "# Description Summary Skill")
	})

	t.Run("keeps existing description when new version has no description", func(t *testing.T) {
		payload := model.PublishPayload{
			Slug:        "description-preserve-skill",
			DisplayName: "Description Preserve Skill",
			Version:     "1.0.0",
			Changelog:   "Initial release",
			Tags:        []string{"latest"},
		}
		firstFiles := map[string]string{
			"SKILL.md": `---
name: description-preserve-skill
description: Original summary
---
# Skill
`,
		}
		firstResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, firstFiles, rawToken, true)
		AssertJSONResponse(t, firstResp, http.StatusOK, &model.PublishResponse{})

		payload.Version = "1.1.0"
		secondFiles := map[string]string{
			"SKILL.md": `---
name: description-preserve-skill
---
# Skill
`,
		}
		secondResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, secondFiles, rawToken, true)
		AssertJSONResponse(t, secondResp, http.StatusOK, &model.PublishResponse{})

		detailResp := ts.DoRequest("GET", "/api/v1/skills/"+payload.Slug, nil)
		var detailBody model.SkillDetailResponse
		AssertJSONResponse(t, detailResp, http.StatusOK, &detailBody)
		require.NotNil(t, detailBody.Skill.Summary)
		assert.Equal(t, "Original summary", *detailBody.Skill.Summary)
	})

	t.Run("ignores nested skill readme for description extraction", func(t *testing.T) {
		payload := model.PublishPayload{
			Slug:        "nested-readme-description-skill",
			DisplayName: "Nested Readme Description Skill",
			Version:     "1.0.0",
			Changelog:   "Initial release",
			Tags:        []string{"latest"},
		}
		filesWithNestedReadme := map[string]string{
			"docs/SKILL.md": `---
name: nested-readme-description-skill
description: Nested summary must not be used
---
# Nested
`,
			"notes.md": "plain notes\n",
		}

		resp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, filesWithNestedReadme, rawToken, true)
		AssertJSONResponse(t, resp, http.StatusOK, &model.PublishResponse{})

		detailResp := ts.DoRequest("GET", "/api/v1/skills/"+payload.Slug, nil)
		var detailBody model.SkillDetailResponse
		AssertJSONResponse(t, detailResp, http.StatusOK, &detailBody)
		assert.Nil(t, detailBody.Skill.Summary)
	})

	t.Run("accepts uppercase markdown extension for primary skill readme", func(t *testing.T) {
		payload := model.PublishPayload{
			Slug:        "uppercase-readme-skill",
			DisplayName: "Uppercase Readme Skill",
			Version:     "1.0.0",
			Changelog:   "Initial release",
			Tags:        []string{"latest"},
		}
		filesWithUppercaseReadme := map[string]string{
			"SKILL.MD": `---
name: uppercase-readme-skill
description: Uppercase extension summary
---
# Skill
`,
		}

		resp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, filesWithUppercaseReadme, rawToken, true)
		AssertJSONResponse(t, resp, http.StatusOK, &model.PublishResponse{})

		detailResp := ts.DoRequest("GET", "/api/v1/skills/"+payload.Slug, nil)
		var detailBody model.SkillDetailResponse
		AssertJSONResponse(t, detailResp, http.StatusOK, &detailBody)
		require.NotNil(t, detailBody.Skill.Summary)
		assert.Equal(t, "Uppercase extension summary", *detailBody.Skill.Summary)

		fileResp := ts.DoRequest("GET", "/api/v1/skills/"+payload.Slug+"/file?path=SKILL.MD", nil)
		assert.Equal(t, http.StatusOK, fileResp.Code)
		body, err := io.ReadAll(fileResp.Body)
		require.NoError(t, err)
		assert.True(t, strings.Contains(string(body), "Uppercase extension summary"))
	})

	t.Run("returns a stable conflict when the same user republishes the same version", func(t *testing.T) {
		payload := model.PublishPayload{
			Slug:        "duplicate-version-skill",
			DisplayName: "Duplicate Version Skill",
			Version:     "1.0.0",
			Changelog:   "Initial release",
			Tags:        []string{"latest"},
		}

		firstResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, rawToken, true)
		AssertJSONResponse(t, firstResp, http.StatusOK, &model.PublishResponse{})

		secondResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, rawToken, true)
		var conflictBody map[string]any
		AssertJSONResponse(t, secondResp, http.StatusConflict, &conflictBody)
		assert.Equal(t, "version_exists", conflictBody["code"])
		assert.Equal(t, "version already exists", conflictBody["error"])
	})

	t.Run("returns a stable forbidden response when another user owns the slug", func(t *testing.T) {
		otherUser := model.User{
			Handle:       "other-publisher",
			DisplayName:  "Other Publisher",
			Email:        "other-publisher@example.com",
			Role:         "user",
			Status:       model.UserStatusActive,
			AuthProvider: "email",
		}
		require.NoError(t, ts.DB.Create(&otherUser).Error)

		otherRawToken := "publish-cli-token-other"
		otherHash := sha256.Sum256([]byte(otherRawToken))
		otherAPIToken := model.APIToken{
			UserID:    otherUser.ID,
			Label:     "publish-test-other",
			TokenHash: hex.EncodeToString(otherHash[:]),
		}
		require.NoError(t, ts.DB.Create(&otherAPIToken).Error)

		payload := model.PublishPayload{
			Slug:        "owned-slug-skill",
			DisplayName: "Owned Slug Skill",
			Version:     "1.0.0",
			Changelog:   "Initial release",
			Tags:        []string{"latest"},
		}

		firstResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, rawToken, true)
		AssertJSONResponse(t, firstResp, http.StatusOK, &model.PublishResponse{})

		conflictResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, otherRawToken, true)
		var conflictBody map[string]any
		AssertJSONResponse(t, conflictResp, http.StatusForbidden, &conflictBody)
		assert.Equal(t, "skill_owned_by_another_user", conflictBody["code"])
		assert.Equal(t, "skill owned by another user", conflictBody["error"])
	})
}

func TestPublishDocumentationLinks(t *testing.T) {
	ts := NewTestServerWithAuthConfig(t, config.AuthConfig{
		JWTSecret:   "test-jwt-secret",
		FrontendURL: "http://localhost:5173",
	})
	ts.EnsureAuthSchema(t)
	ts.CleanupDatabase(t)
	ts.CleanupAuthTables(t)
	defer ts.CleanupDatabase(t)
	defer ts.CleanupAuthTables(t)

	user := model.User{
		Handle:       "documentation-publisher",
		DisplayName:  "Documentation Publisher",
		Email:        "documentation-publisher@example.com",
		Role:         "user",
		Status:       model.UserStatusActive,
		AuthProvider: "email",
	}
	require.NoError(t, ts.DB.Create(&user).Error)

	rawToken := "documentation-publish-cli-token"
	hash := sha256.Sum256([]byte(rawToken))
	require.NoError(t, ts.DB.Create(&model.APIToken{
		UserID:    user.ID,
		Label:     "documentation-publish-test",
		TokenHash: hex.EncodeToString(hash[:]),
	}).Error)

	files := CreateTestSkillFiles()

	t.Run("new skill omission stores and returns an empty array", func(t *testing.T) {
		payload := model.PublishPayload{
			Slug:        "documentation-links-default",
			DisplayName: "Documentation Links Default",
			Version:     "1.0.0",
			Changelog:   "Initial release",
			Tags:        []string{"latest"},
		}

		resp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, rawToken, true)
		AssertJSONResponse(t, resp, http.StatusOK, &model.PublishResponse{})

		var saved model.Skill
		require.NoError(t, ts.DB.Where("slug = ?", payload.Slug).First(&saved).Error)
		assert.NotNil(t, saved.DocumentationLinks)
		assert.Empty(t, saved.DocumentationLinks)

		detailResp := ts.DoRequest("GET", "/api/v1/skills/"+payload.Slug, nil)
		AssertJSONResponse(t, detailResp, http.StatusOK, &model.SkillDetailResponse{})
		assert.Contains(t, detailResp.Body.String(), `"documentationLinks":[]`)
	})

	t.Run("normalizes stores and returns links", func(t *testing.T) {
		links := model.DocumentationLinkList{
			{
				Title: "  使用文档  ",
				URL:   "  https://example.feishu.cn/docx/example?from=hub#usage  ",
			},
			{URL: "http://gitlab.internal/group/project/-/blob/main/README.md"},
		}
		payload := model.PublishPayload{
			Slug:               "documentation-links-skill",
			DisplayName:        "Documentation Links Skill",
			Version:            "1.0.0",
			Changelog:          "Initial release",
			Tags:               []string{"latest"},
			DocumentationLinks: &links,
		}

		resp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, rawToken, true)
		AssertJSONResponse(t, resp, http.StatusOK, &model.PublishResponse{})

		want := model.DocumentationLinkList{
			{
				Title: "使用文档",
				URL:   "https://example.feishu.cn/docx/example?from=hub#usage",
			},
			{URL: "http://gitlab.internal/group/project/-/blob/main/README.md"},
		}
		var saved model.Skill
		require.NoError(t, ts.DB.Where("slug = ?", payload.Slug).First(&saved).Error)
		assert.Equal(t, want, saved.DocumentationLinks)

		listResp := ts.DoRequest("GET", "/api/v1/skills", nil)
		var listBody model.SkillListResponse
		AssertJSONResponse(t, listResp, http.StatusOK, &listBody)
		assert.Equal(t, want, findSkillItem(t, listBody.Items, payload.Slug).DocumentationLinks)

		detailResp := ts.DoRequest("GET", "/api/v1/skills/"+payload.Slug, nil)
		var detailBody model.SkillDetailResponse
		AssertJSONResponse(t, detailResp, http.StatusOK, &detailBody)
		assert.Equal(t, want, detailBody.Skill.DocumentationLinks)
	})

	t.Run("old client omission preserves existing links", func(t *testing.T) {
		original := model.DocumentationLinkList{{Title: "使用文档", URL: "https://docs.example.com/original"}}
		firstPayload := model.PublishPayload{
			Slug:               "documentation-links-preserve",
			DisplayName:        "Documentation Links Preserve",
			Version:            "1.0.0",
			Changelog:          "Initial release",
			Tags:               []string{"latest"},
			DocumentationLinks: &original,
		}
		firstResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", firstPayload, files, rawToken, true)
		AssertJSONResponse(t, firstResp, http.StatusOK, &model.PublishResponse{})

		oldClientPayload := model.PublishPayload{
			Slug:        firstPayload.Slug,
			DisplayName: firstPayload.DisplayName,
			Version:     "1.1.0",
			Changelog:   "Published by an old client",
			Tags:        []string{"latest"},
		}
		secondResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", oldClientPayload, files, rawToken, true)
		AssertJSONResponse(t, secondResp, http.StatusOK, &model.PublishResponse{})

		var saved model.Skill
		require.NoError(t, ts.DB.Where("slug = ?", firstPayload.Slug).First(&saved).Error)
		assert.Equal(t, original, saved.DocumentationLinks)
	})

	t.Run("explicit empty array clears existing links", func(t *testing.T) {
		original := model.DocumentationLinkList{{URL: "https://docs.example.com/to-clear"}}
		firstPayload := model.PublishPayload{
			Slug:               "documentation-links-clear",
			DisplayName:        "Documentation Links Clear",
			Version:            "1.0.0",
			Changelog:          "Initial release",
			Tags:               []string{"latest"},
			DocumentationLinks: &original,
		}
		firstResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", firstPayload, files, rawToken, true)
		AssertJSONResponse(t, firstResp, http.StatusOK, &model.PublishResponse{})

		empty := model.DocumentationLinkList{}
		secondPayload := firstPayload
		secondPayload.Version = "1.1.0"
		secondPayload.DocumentationLinks = &empty
		secondResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", secondPayload, files, rawToken, true)
		AssertJSONResponse(t, secondResp, http.StatusOK, &model.PublishResponse{})

		detailResp := ts.DoRequest("GET", "/api/v1/skills/"+firstPayload.Slug, nil)
		var detailBody model.SkillDetailResponse
		AssertJSONResponse(t, detailResp, http.StatusOK, &detailBody)
		assert.Empty(t, detailBody.Skill.DocumentationLinks)
		assert.Contains(t, detailResp.Body.String(), `"documentationLinks":[]`)
	})

	t.Run("non-empty array replaces existing links", func(t *testing.T) {
		original := model.DocumentationLinkList{{URL: "https://docs.example.com/old"}}
		firstPayload := model.PublishPayload{
			Slug:               "documentation-links-replace",
			DisplayName:        "Documentation Links Replace",
			Version:            "1.0.0",
			Changelog:          "Initial release",
			Tags:               []string{"latest"},
			DocumentationLinks: &original,
		}
		firstResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", firstPayload, files, rawToken, true)
		AssertJSONResponse(t, firstResp, http.StatusOK, &model.PublishResponse{})

		replacement := model.DocumentationLinkList{
			{Title: "新文档", URL: "https://docs.example.com/new"},
			{URL: "https://github.com/example/project"},
		}
		secondPayload := firstPayload
		secondPayload.Version = "1.1.0"
		secondPayload.DocumentationLinks = &replacement
		secondResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", secondPayload, files, rawToken, true)
		AssertJSONResponse(t, secondResp, http.StatusOK, &model.PublishResponse{})

		var saved model.Skill
		require.NoError(t, ts.DB.Where("slug = ?", firstPayload.Slug).First(&saved).Error)
		assert.Equal(t, replacement, saved.DocumentationLinks)
	})

	t.Run("invalid links fail before upload or database changes", func(t *testing.T) {
		invalid := model.DocumentationLinkList{{URL: "javascript:alert(1)"}}
		payload := model.PublishPayload{
			Slug:               "documentation-links-invalid",
			DisplayName:        "Documentation Links Invalid",
			Version:            "1.0.0",
			Changelog:          "Initial release",
			Tags:               []string{"latest"},
			DocumentationLinks: &invalid,
		}
		beforeFiles := mockStorageFileCount(t, ts)

		resp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, rawToken, true)
		var body map[string]any
		AssertJSONResponse(t, resp, http.StatusBadRequest, &body)
		assert.Equal(t, "invalid_documentation_link", body["code"])
		assert.Equal(t, beforeFiles, mockStorageFileCount(t, ts))

		var count int64
		require.NoError(t, ts.DB.Model(&model.Skill{}).Where("slug = ?", payload.Slug).Count(&count).Error)
		assert.Zero(t, count)
	})

	t.Run("transaction failure keeps links and cleans uploaded files", func(t *testing.T) {
		original := model.DocumentationLinkList{{URL: "https://docs.example.com/stable"}}
		payload := model.PublishPayload{
			Slug:               "documentation-links-rollback",
			DisplayName:        "Documentation Links Rollback",
			Version:            "1.0.0",
			Changelog:          "Initial release",
			Tags:               []string{"latest"},
			DocumentationLinks: &original,
		}
		firstResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, rawToken, true)
		AssertJSONResponse(t, firstResp, http.StatusOK, &model.PublishResponse{})
		beforeFiles := mockStorageFileCount(t, ts)

		replacement := model.DocumentationLinkList{{URL: "https://docs.example.com/must-not-persist"}}
		payload.DocumentationLinks = &replacement
		conflictResp := ts.DoBearerMultipartRequest("POST", "/api/v1/skills", payload, files, rawToken, true)
		AssertJSONResponse(t, conflictResp, http.StatusConflict, &map[string]any{})

		var saved model.Skill
		require.NoError(t, ts.DB.Where("slug = ?", payload.Slug).First(&saved).Error)
		assert.Equal(t, original, saved.DocumentationLinks)
		assert.Equal(t, beforeFiles, mockStorageFileCount(t, ts))
	})
}

func mockStorageFileCount(t *testing.T, ts *TestServer) int {
	t.Helper()
	storage, ok := ts.StorageService.(*MockStorageService)
	require.True(t, ok)
	storage.mu.Lock()
	defer storage.mu.Unlock()
	return len(storage.files)
}

func findSkillItem(t *testing.T, items []model.SkillItem, slug string) model.SkillItem {
	t.Helper()
	for _, item := range items {
		if item.Slug == slug {
			return item
		}
	}
	require.Failf(t, "skill not found", "slug %q not found in list response", slug)
	return model.SkillItem{}
}

func findSearchResult(t *testing.T, items []model.SearchResult, slug string) model.SearchResult {
	t.Helper()
	for _, item := range items {
		if item.Slug == slug {
			return item
		}
	}
	require.Failf(t, "search result not found", "slug %q not found in search response", slug)
	return model.SearchResult{}
}
