package service

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/openclaw/clawhub/backend/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGitLabImportServicePreviewCandidateAndFiles(t *testing.T) {
	const token = "fixed-import-token"

	service, err := NewGitLabImportService(config.GitLabProviderConfig{
		BaseURL:     "https://gitlab.yc345.tv",
		ImportToken: token,
	})
	require.NoError(t, err)
	service.client = &http.Client{
		Transport: gitlabImportRoundTripFunc(func(r *http.Request) (*http.Response, error) {
			assert.Equal(t, token, r.Header.Get("PRIVATE-TOKEN"))

			switch {
			case r.URL.Path == "/api/v4/projects/backend/cursorkit":
				return jsonHTTPResponse(t, map[string]any{
					"id":             7,
					"default_branch": "master",
					"web_url":        "https://gitlab.yc345.tv/backend/cursorkit",
				}), nil
			case r.URL.Path == "/api/v4/projects/7/repository/commits/master":
				return jsonHTTPResponse(t, map[string]any{
					"id": "commit-sha-123",
				}), nil
			case r.URL.Path == "/api/v4/projects/7/repository/tree":
				assert.Equal(t, "commit-sha-123", r.URL.Query().Get("ref"))
				assert.Equal(t, ".cursor/skills", r.URL.Query().Get("path"))
				return jsonHTTPResponse(t, []map[string]any{
					{"type": "blob", "path": ".cursor/skills/demo/SKILL.md", "size": 10},
					{"type": "blob", "path": ".cursor/skills/demo/notes.md", "size": 5},
				}), nil
			case r.URL.Path == "/api/v4/projects/7/repository/files/.cursor/skills/demo/SKILL.md/raw":
				return textHTTPResponse("# Demo", "text/markdown"), nil
			case r.URL.Path == "/api/v4/projects/7/repository/files/.cursor/skills/demo/notes.md/raw":
				return textHTTPResponse("notes", "text/plain"), nil
			default:
				return &http.Response{StatusCode: http.StatusNotFound, Body: io.NopCloser(strings.NewReader("not found")), Header: make(http.Header)}, nil
			}
		}),
	}

	preview, err := service.Preview(context.Background(), "https://gitlab.yc345.tv/backend/cursorkit/-/tree/master/.cursor/skills")
	require.NoError(t, err)
	require.Len(t, preview.Candidates, 1)
	assert.Equal(t, "backend/cursorkit", preview.Resolved.Repo)
	assert.Equal(t, "commit-sha-123", preview.Resolved.Commit)
	assert.Equal(t, ".cursor/skills/demo", preview.Candidates[0].Path)

	candidate, err := service.PreviewCandidate(context.Background(), "https://gitlab.yc345.tv/backend/cursorkit/-/tree/master/.cursor/skills", ".cursor/skills/demo")
	require.NoError(t, err)
	assert.Equal(t, "demo", candidate.Defaults.Slug)
	assert.Equal(t, []string{"SKILL.md", "notes.md"}, candidate.Defaults.SelectedPaths)

	files, err := service.DownloadFiles(
		context.Background(),
		"https://gitlab.yc345.tv/backend/cursorkit/-/tree/master/.cursor/skills",
		"commit-sha-123",
		".cursor/skills/demo",
		[]string{"SKILL.md", "notes.md"},
	)
	require.NoError(t, err)
	require.Len(t, files.Files, 2)
	assert.Equal(t, "SKILL.md", files.Files[0].Path)
}

func TestGitLabImportServiceRejectsUnexpectedHost(t *testing.T) {
	service, err := NewGitLabImportService(config.GitLabProviderConfig{
		BaseURL:     "https://gitlab.yc345.tv",
		ImportToken: "fixed-import-token",
	})
	require.NoError(t, err)

	_, err = service.Preview(context.Background(), "https://example.com/backend/cursorkit")
	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "host is not allowed"))
}

func TestGitLabImportServiceReturnsGitLabErrorMessageForInvalidTreePath(t *testing.T) {
	const token = "fixed-import-token"

	service, err := NewGitLabImportService(config.GitLabProviderConfig{
		BaseURL:     "https://gitlab.yc345.tv",
		ImportToken: token,
	})
	require.NoError(t, err)
	service.client = &http.Client{
		Transport: gitlabImportRoundTripFunc(func(r *http.Request) (*http.Response, error) {
			switch {
			case r.URL.Path == "/api/v4/projects/backend/cursorkit":
				return jsonHTTPResponse(t, map[string]any{
					"id":             2948,
					"default_branch": "master",
					"web_url":        "https://gitlab.yc345.tv/backend/cursorkit",
				}), nil
			case r.URL.Path == "/api/v4/projects/2948/repository/commits/master":
				return jsonHTTPResponse(t, map[string]any{"id": "commit-sha-123"}), nil
			case r.URL.Path == "/api/v4/projects/2948/repository/tree":
				return &http.Response{
					StatusCode: http.StatusNotFound,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body:       io.NopCloser(strings.NewReader(`{"message":"404 invalid revision or path Not Found"}`)),
				}, nil
			default:
				return &http.Response{
					StatusCode: http.StatusNotFound,
					Header:     make(http.Header),
					Body:       io.NopCloser(strings.NewReader("not found")),
				}, nil
			}
		}),
	}

	_, err = service.Preview(context.Background(), "https://gitlab.yc345.tv/backend/cursorkit/-/tree/master/.cursor/skills?ref_type=heads")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "gitlab tree request failed with status 404")
	assert.Contains(t, err.Error(), "invalid revision or path")
	assert.NotContains(t, err.Error(), "cannot unmarshal object")
}

type gitlabImportRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn gitlabImportRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func jsonHTTPResponse(t *testing.T, body any) *http.Response {
	t.Helper()
	bytes, err := json.Marshal(body)
	require.NoError(t, err)
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(string(bytes))),
	}
}

func textHTTPResponse(body string, contentType string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{contentType}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}
