.PHONY: all frontend backend

GO_CACHE ?= /tmp/yclawhub-gocache

all: frontend backend

frontend:
	bun run build

backend:
	cd backend && GOCACHE=$(GO_CACHE) go test ./internal/... ./cmd/...
