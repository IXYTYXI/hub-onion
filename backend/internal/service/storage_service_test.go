package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	cfg "github.com/openclaw/clawhub/backend/internal/config"
)

func TestOSSStorageServiceAcceptsHTTPMinIOEndpoint(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		if r.Method != http.MethodPut || r.URL.Path != "/test-bucket/hello.txt" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("ETag", `"test-etag"`)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	storage, err := NewOSSStorageService(cfg.OSSConfig{
		Endpoint:        server.URL,
		Bucket:          "test-bucket",
		Region:          "us-east-1",
		AccessKeyID:     "test-access",
		AccessKeySecret: "test-secret",
		UsePathStyle:    true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := storage.Upload(context.Background(), "hello.txt", strings.NewReader("hello"), "text/plain"); err != nil {
		t.Fatal(err)
	}
	if requests != 1 {
		t.Fatalf("expected one HTTP request, got %d", requests)
	}
}
