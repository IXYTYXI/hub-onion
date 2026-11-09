package service

import (
	"reflect"
	"testing"

	"github.com/openclaw/clawhub/backend/internal/model"
)

func TestSkillToItemIncludesStableDocumentationLinks(t *testing.T) {
	service := &SkillService{}
	links := model.DocumentationLinkList{
		{Title: "使用文档", URL: "https://docs.example.com/usage"},
		{URL: "https://github.com/example/demo"},
	}

	item := service.skillToItem(&model.Skill{
		Slug:               "demo",
		DisplayName:        "Demo",
		DocumentationLinks: links,
	})
	if !reflect.DeepEqual(item.DocumentationLinks, links) {
		t.Fatalf("documentation links = %#v, want %#v", item.DocumentationLinks, links)
	}

	historicalItem := service.skillToItem(&model.Skill{
		Slug:        "historical",
		DisplayName: "Historical",
	})
	if historicalItem.DocumentationLinks == nil || len(historicalItem.DocumentationLinks) != 0 {
		t.Fatalf(
			"historical documentation links = %#v, want non-nil empty list",
			historicalItem.DocumentationLinks,
		)
	}
}
