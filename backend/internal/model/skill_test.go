package model

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func TestSkillItemIncludesOwnerField(t *testing.T) {
	field, ok := reflect.TypeOf(SkillItem{}).FieldByName("Owner")
	if !ok {
		t.Fatalf("SkillItem should expose owner information for list responses")
	}

	if got := field.Tag.Get("json"); got != "owner,omitempty" {
		t.Fatalf("SkillItem owner json tag = %q, want %q", got, "owner,omitempty")
	}
}

func TestDocumentationLinkListValueAndScan(t *testing.T) {
	links := DocumentationLinkList{
		{Title: " 使用文档 ", URL: "https://example.feishu.cn/docx/example"},
		{URL: "https://gitlab.example.com/group/project/-/blob/main/README.md"},
	}

	value, err := links.Value()
	if err != nil {
		t.Fatalf("DocumentationLinkList.Value() error = %v", err)
	}

	var decoded DocumentationLinkList
	if err := decoded.Scan(value); err != nil {
		t.Fatalf("DocumentationLinkList.Scan() error = %v", err)
	}
	if !reflect.DeepEqual(decoded, links) {
		t.Fatalf("decoded links = %#v, want %#v", decoded, links)
	}

	var empty DocumentationLinkList
	if err := empty.Scan(nil); err != nil {
		t.Fatalf("DocumentationLinkList.Scan(nil) error = %v", err)
	}
	if empty == nil || len(empty) != 0 {
		t.Fatalf("DocumentationLinkList.Scan(nil) = %#v, want non-nil empty list", empty)
	}
}

func TestSkillItemSerializesEmptyDocumentationLinksAsArray(t *testing.T) {
	bytes, err := json.Marshal(SkillItem{DocumentationLinks: DocumentationLinkList{}})
	if err != nil {
		t.Fatalf("json.Marshal(SkillItem) error = %v", err)
	}
	if !strings.Contains(string(bytes), `"documentationLinks":[]`) {
		t.Fatalf("SkillItem JSON = %s, want documentationLinks empty array", bytes)
	}
}
