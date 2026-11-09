# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Preference

**Important: Prefer Chinese for all conversations and responses.**
**Important: All generated spec documents and task lists must be in Chinese.**

## Project Overview

ClawHub is an open-source Agent Skill Registry for publishing, versioning, searching, and installing text-based agent skills (`SKILL.md` and accompanying files). The platform supports self-hosted deployments with a CLI-first approach.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                      Frontend                         │
│            TanStack Start (React + Vite)             │
│            TanStack Query for data fetching          │
│                      Port 3000                       │
└────────────────────┬─────────────────────────────────┘
                     │ fetch /api/v1/*
┌────────────────────▼─────────────────────────────────┐
│                     Go Backend                        │
│                  Gin HTTP framework                  │
│              PostgreSQL (GORM) + pg_trgm             │
│           Alibaba Cloud OSS (S3-compatible)          │
│                      Port 8080                       │
└──────────────────────────────────────────────────────┘
```

## Common Commands

### Frontend (Bun)
```bash
bun run dev          # Start frontend dev server on port 3000
bun run build        # Production build (Vite + Nitro)
bun run preview      # Preview built application
bun run test         # Run Vitest unit tests
bun run coverage     # Run tests with coverage
bun run lint         # Run oxlint (type-aware)
bun run lint:fix     # Run oxlint with auto-fix + format
bun run test:watch   # Run tests in watch mode
bun run test:e2e     # Run e2e tests with Playwright
```

### Backend (Go)
```bash
cd backend
GO_ENV=local go run cmd/migrate/main.go   # Run database migrations
GO_ENV=local go run cmd/server/main.go    # Start backend server on port 8080
```

### Single Test Execution
```bash
bun run test path/to/test.test.ts                    # Run specific test file
bun run test -- --grep "test name pattern"           # Run tests matching pattern
```

## Project Structure

```
clawhub/
├── backend/                  # Go backend (Gin + PostgreSQL)
│   ├── cmd/server/           # Server entry point
│   ├── cmd/migrate/          # Database migration tool
│   ├── internal/
│   │   ├── config/           # Configuration (database, CDN, env)
│   │   ├── database/         # PostgreSQL connection and migrations
│   │   ├── handler/          # HTTP route handlers
│   │   ├── model/            # Data models (Skill, SkillVersion)
│   │   ├── service/          # Business logic and storage abstraction
│   │   └── middleware/       # CORS, rate limiting
│   └── config/               # YAML config files per environment
├── src/                      # TanStack Start frontend
│   ├── routes/               # Page routes (file-based routing)
│   ├── components/           # React components
│   ├── hooks/                # TanStack Query hooks (useSkills, useSkill, etc.)
│   ├── lib/                  # Utilities (apiClient, badges, uploadFiles)
│   └── types/                # TypeScript type definitions
├── packages/
│   ├── clawhub/              # CLI package (clawhub command)
│   ├── yclawhub/             # Private registry CLI (yclawhub command)
│   └── schema/               # Shared ArkType schemas for API types
├── convex/                   # Legacy Convex backend (being phased out)
├── docs/                     # Documentation
└── public/                   # Static assets
```

## Frontend Architecture

### Data Fetching Pattern
- Uses TanStack Query (React Query) for all API calls
- API client at `src/lib/apiClient.ts` provides `apiRequest()` and `authRequest()` helpers
- Custom hooks in `src/hooks/` wrap TanStack Query (e.g., `useSkills`, `useSkill`, `usePublishSkill`)
- API base URL: `/api/v1` (proxied to backend via Vite dev server)

### Key Hook Patterns
```typescript
// src/hooks/useSkills.ts - Infinite query pattern
export function useSkills(options) {
  return useInfiniteQuery({
    queryKey: ['skills', 'list', { sort, dir, limit }],
    queryFn: ({ pageParam }) => apiRequest<SkillListResponse>(`/skills?${params}`),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

// src/hooks/useSkill.ts - Simple query pattern
export function useSkill(slug: string) {
  return useQuery({
    queryKey: ['skill', slug],
    queryFn: () => apiRequest<SkillDetail>(`/skills/${slug}`),
    enabled: !!slug,
  })
}
```

### Routing
- File-based routing with TanStack Router
- Route files in `src/routes/` directory
- `__root.tsx` defines the root layout with AppProviders

## Backend Configuration

Configuration loads in order:
1. `backend/config/default.yaml`
2. `backend/config/${GO_ENV}.yaml`
3. Environment variables

Supported `GO_ENV` values: `local`, `dev`, `test`, `pro`

Key environment variables: `DATABASE_URL`, `OSS_ENDPOINT`, `OSS_BUCKET`, `JWT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITLAB_*`, `SMTP_*`

## API Endpoints

All endpoints at `/api/v1/`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/skills` | List skills (paginated, sorted) |
| GET | `/skills/:slug` | Get skill details |
| GET | `/skills/:slug/versions` | Version history |
| GET | `/skills/:slug/file` | Get single file content |
| GET | `/search?q=...` | Fuzzy search (pg_trgm) |
| GET | `/resolve` | Version resolution by hash |
| GET | `/download` | Download ZIP |
| POST | `/skills` | Publish skill (multipart) |
| DELETE | `/skills/:slug` | Soft delete |
| POST | `/skills/:slug/undelete` | Restore deleted |
| GET | `/.well-known/clawhub.json` | Registry discovery |

## Coding Conventions

- TypeScript strict mode, ESM
- Indentation: 2 spaces
- Linting: oxlint with type-aware mode
- Formatting: oxfmt
- Convex function naming: verb-first (`getBySlug`, `publishVersion`)
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)

## Testing

- Framework: Vitest 4 + jsdom
- Test files: `**/*.test.ts` alongside source files
- E2E tests: Playwright (`e2e/*.pw.test.ts`)
- Coverage thresholds: 70% (lines/functions/branches/statements)

## Git Notes

If `git branch -d/-D <branch>` is blocked by policy, delete local ref directly:
```bash
git update-ref -d refs/heads/<branch>
```

## Convex Operations (Legacy)

- New functions must be pushed before `convex run`: use `bunx convex dev --once` (dev) or `bunx convex deploy` (production)
- For non-interactive production deployment: `bunx convex deploy --typecheck=disable --yes`
