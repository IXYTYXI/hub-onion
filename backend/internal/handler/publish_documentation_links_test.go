package handler

import (
	"reflect"
	"strings"
	"testing"

	"github.com/openclaw/clawhub/backend/internal/model"
)

func TestNormalizeDocumentationLinks(t *testing.T) {
	input := model.DocumentationLinkList{
		{
			Title: "  使用文档  ",
			URL:   "  https://example.feishu.cn/docx/example?from=hub#usage  ",
		},
		{
			URL: "http://gitlab.internal/group/project/-/blob/main/README.md",
		},
	}

	got, err := normalizeDocumentationLinks(&input)
	if err != nil {
		t.Fatalf("normalizeDocumentationLinks() error = %v", err)
	}
	want := model.DocumentationLinkList{
		{
			Title: "使用文档",
			URL:   "https://example.feishu.cn/docx/example?from=hub#usage",
		},
		{
			URL: "http://gitlab.internal/group/project/-/blob/main/README.md",
		},
	}
	if got == nil || !reflect.DeepEqual(*got, want) {
		t.Fatalf("normalizeDocumentationLinks() = %#v, want %#v", got, want)
	}
}

func TestNormalizeDocumentationLinksPreservesOmittedField(t *testing.T) {
	got, err := normalizeDocumentationLinks(nil)
	if err != nil {
		t.Fatalf("normalizeDocumentationLinks(nil) error = %v", err)
	}
	if got != nil {
		t.Fatalf("normalizeDocumentationLinks(nil) = %#v, want nil", got)
	}
}

func TestNormalizeDocumentationLinksRejectsInvalidValues(t *testing.T) {
	elevenLinks := make(model.DocumentationLinkList, 11)
	for index := range elevenLinks {
		elevenLinks[index] = model.DocumentationLink{
			URL: "https://example.com/docs/" + string(rune('a'+index)),
		}
	}

	tests := []struct {
		name  string
		links model.DocumentationLinkList
	}{
		{
			name:  "too many links",
			links: elevenLinks,
		},
		{
			name: "title too long",
			links: model.DocumentationLinkList{
				{Title: strings.Repeat("文", 81), URL: "https://example.com/docs"},
			},
		},
		{
			name: "url too long",
			links: model.DocumentationLinkList{
				{URL: "https://example.com/" + strings.Repeat("a", 2048)},
			},
		},
		{
			name: "missing url",
			links: model.DocumentationLinkList{
				{Title: "使用文档"},
			},
		},
		{
			name: "relative url",
			links: model.DocumentationLinkList{
				{URL: "/docs/usage"},
			},
		},
		{
			name: "non http scheme",
			links: model.DocumentationLinkList{
				{URL: "javascript:alert(1)"},
			},
		},
		{
			name: "missing hostname",
			links: model.DocumentationLinkList{
				{URL: "https:///docs/usage"},
			},
		},
		{
			name: "userinfo",
			links: model.DocumentationLinkList{
				{URL: "https://user:password@example.com/docs"},
			},
		},
		{
			name: "duplicate trimmed url",
			links: model.DocumentationLinkList{
				{URL: "https://example.com/docs"},
				{URL: " https://example.com/docs "},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := normalizeDocumentationLinks(&tt.links); err == nil {
				t.Fatal("normalizeDocumentationLinks() error = nil, want validation error")
			}
		})
	}
}
