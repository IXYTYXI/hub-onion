---
summary: 'Local setup + CLI smoke: login, search, install, publish, sync.'
read_when:
  - First run / local dev setup
  - Verifying end-to-end flows
---

# Quickstart

> 当前仓库同时支持两个 CLI：
>
> - `clawhub`：默认公开 registry CLI
> - `yclawhub`：私有 registry / 多环境 CLI，npm 包名同样是 `yclawhub`

## 0) Prereqs

- Bun
- Go
- PostgreSQL
- Optional GitHub OAuth App or Feishu app for login

## 1) Local dev (web + Go backend)

```bash
bun install
cp .env.local.example .env.local
cp backend/.env.local.example backend/.env.local

# terminal A
cd backend
GO_ENV=local go run cmd/migrate/main.go
GO_ENV=local go run cmd/server/main.go

# terminal B
bun run dev
```

## 2) Backend auth/storage setup

Fill in `backend/.env.local` with the credentials you need:

- `JWT_SECRET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` if GitHub login is enabled
- `GITLAB_IMPORT_TOKEN` if GitLab project import is enabled
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET` if Feishu login is enabled
- `SMTP_USERNAME` / `SMTP_PASSWORD` if email login is enabled

Database connection strings, allowed email domains, and superuser emails remain in `backend/config/*.yaml`.

## 3) CLI: login + basic commands

From this repo:

```bash
bun clawhub --help
bun clawhub login
bun clawhub whoami
bun clawhub search gif --limit 5
```

Private registry flow with `yclawhub`:

```bash
# One-off execution
npx yclawhub@latest login --registry https://registry.yc345.tv
npx yclawhub@latest search gif --registry https://registry.yc345.tv --limit 5

# Or install globally
npm i -g yclawhub
yclawhub login --registry https://registry.yc345.tv
yclawhub search gif --registry https://registry.yc345.tv --limit 5
```

If you want persistent multi-environment usage:

```bash
yclawhub env add --name prod --site https://registry.yc345.tv --use
yclawhub env current
yclawhub search gif
```

Install a skill into `./skills/<slug>` (if Clawdbot is configured, installs into that workspace instead):

```bash
bun clawhub install <slug>
bun clawhub list
bun clawhub uninstall <slug> --yes
```

You can also install into any folder:

```bash
bun clawhub install <slug> --workdir /tmp/clawhub-demo --dir skills
```

For `yclawhub`, workspace state is isolated under `.yclawhub`:

```bash
yclawhub install <slug> --workdir /tmp/yclawhub-demo --dir skills
yclawhub list --workdir /tmp/yclawhub-demo
yclawhub uninstall <slug> --workdir /tmp/yclawhub-demo --yes
```

Update:

```bash
bun clawhub update --all
```

## 4) Publish a skill

Create a folder containing `SKILL.md` (required) plus any supporting text files:

```bash
mkdir -p /tmp/clawhub-skill-demo && cd /tmp/clawhub-skill-demo
cat > SKILL.md <<'EOF'
---
name: Demo Skill
description: Demo skill for local testing
---

# Demo Skill

Hello.
EOF
```

Publish:

```bash
bun clawhub publish . \
  --slug clawhub-demo-$(date +%s) \
  --name "Demo $(date +%s)" \
  --version 1.0.0 \
  --tags latest \
  --changelog "Initial release"
```

## 5) Sync local skills (auto-publish new/changed)

`sync` scans for local skill folders and publishes the ones that aren’t “synced” yet.

```bash
bun clawhub sync
```

Dry run + non-interactive:

```bash
bun clawhub sync --all --dry-run --no-input
```
