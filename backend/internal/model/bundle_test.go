package model

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestBundleItemSerializesEmptyDocumentationLinksAsArray(t *testing.T) {
	bytes, err := json.Marshal(BundleItem{DocumentationLinks: DocumentationLinkList{}})
	if err != nil {
		t.Fatalf("json.Marshal(BundleItem) error = %v", err)
	}
	if !strings.Contains(string(bytes), `"documentationLinks":[]`) {
		t.Fatalf("BundleItem JSON = %s, want documentationLinks empty array", bytes)
	}
}

func TestPublishBundlePayloadPreservesDocumentationLinksPresence(t *testing.T) {
	var omitted PublishBundlePayload
	if err := json.Unmarshal([]byte(`{"slug":"bundle","displayName":"Bundle","description":"Description","skills":[]}`), &omitted); err != nil {
		t.Fatalf("json.Unmarshal(omitted) error = %v", err)
	}
	if omitted.DocumentationLinks != nil {
		t.Fatalf("omitted documentationLinks = %#v, want nil", omitted.DocumentationLinks)
	}

	var cleared PublishBundlePayload
	if err := json.Unmarshal([]byte(`{"slug":"bundle","displayName":"Bundle","description":"Description","skills":[],"documentationLinks":[]}`), &cleared); err != nil {
		t.Fatalf("json.Unmarshal(cleared) error = %v", err)
	}
	if cleared.DocumentationLinks == nil || len(*cleared.DocumentationLinks) != 0 {
		t.Fatalf("explicit empty documentationLinks = %#v, want non-nil empty list", cleared.DocumentationLinks)
	}
}
