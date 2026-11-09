# 环境变量外置与废弃变量收口规划

## 背景

当前后端配置文件 `backend/config/*.yaml` 中混有运行配置和敏感信息，包含对象存储凭据、OAuth/OIDC 密钥、JWT 密钥、飞书应用密钥和 SMTP 密码等。与此同时，根目录和 Docker 示例中还保留了部分旧 Convex 变量、前端历史别名和当前代码没有实际读取的变量，容易造成配置误用和密钥泄露风险。

本规划用于指导后续 OpenSpec 变更：将敏感配置外置到环境变量文件，清理废弃变量，并统一前后端运行时配置口径。

## 目标

- 后端 YAML 只保留安全默认值、结构化非敏感配置和环境差异配置。
- 真实敏感值迁移到本地忽略的 `backend/.env.<GO_ENV>`，例如 `backend/.env.dev`。
- 提交 `backend/.env.<GO_ENV>.example` 模板，不提交真实密钥。
- 后端启动时自动加载 `backend/.env.<GO_ENV>`，并允许进程环境变量继续覆盖。
- 移除当前运行面中已经废弃或无效的环境变量，减少部署和本地开发歧义。
- 防止真实 `backend/.env.*` 进入 Docker build context。
- 当前不再保留 GitLab 登录/授权配置，只保留 GitLab 项目读取/导入能力。

## 后端配置加载规则

目标加载优先级如下，后者覆盖前者：

1. `backend/config/default.yaml`
2. `backend/config/${GO_ENV}.yaml`
3. `backend/.env.${GO_ENV}`
4. 进程环境变量

约定：

- 未设置 `GO_ENV` 时继续默认使用 `local`。
- `backend/.env.<GO_ENV>` 缺失不应导致启动失败，便于生产环境完全由部署平台注入变量。
- 根目录 `.env.test`、`.env.online` 继续作为前端 Vite 构建环境文件，不承载后端密钥。
- 真实 `backend/.env.*` 必须被 `.gitignore` 忽略，`.example` 模板必须可提交。
- 真实 `backend/.env*` 也必须被 `.dockerignore` 忽略，避免进入 Docker build context；`backend/.env*.example` 可以保留。
- `.env.<GO_ENV>` 的定位以实际命中的 `backend/config` 目录父级为 backend 根目录，需覆盖从 repo root、`backend/`、`backend/internal/config`、Docker `/app/backend` 启动的场景。

## 变量审计结论

### 废弃并移除

以下变量不再属于当前运行面，应从当前代码兼容回退、env 示例和当前运行文档中移除：

- Convex 旧变量：`AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`、`JWT_PRIVATE_KEY`、`JWKS`、`OPENAI_API_KEY`、`VITE_CONVEX_SITE_URL`
- 前端旧别名：`VITE_BACKEND_BASE`、`VITE_API_BASE_URL`
- 后端无效变量：`OSS_USE_INTERNAL`
- 后端重复 YAML 字段：`auth.github_client_id`、`auth.github_client_secret`
- GitLab 登录/授权旧变量：`GITLAB_ENABLED`、`GITLAB_DISCOVERY_URL`、`GITLAB_CLIENT_ID`、`GITLAB_CLIENT_SECRET`、`GITLAB_ALLOWED_GROUPS`

说明：

- 不删除 `convex/` 历史代码本身，只清理当前运行配置体系。
- `OPENAI_API_KEY` 当前只属于 Convex 旧路径，不进入 Go 后端 Phase 1 配置。
- `OSS_USE_INTERNAL` 已绑定进配置，但对象存储实现没有读取该字段，应移除避免误导。
- GitLab 当前只作为项目读取/导入来源，不再作为登录授权 provider；历史 GitLab OIDC 文档可保留为归档上下文，但不作为当前运行配置依据。
- 用户邮箱、超级用户邮箱和邮箱域名白名单不作为密钥外置到环境变量，继续保留在后端 YAML 配置中。
- 数据库连接串和数据库密码不作为本轮密钥外置对象，继续允许按环境保留在后端 YAML 配置中；不同环境数据库无法互相登录，降低跨环境复用风险。

### 保留

前端构建和浏览器侧变量：

- `VITE_SITE_URL`
- `VITE_API_ORIGIN`
- `VITE_API_BASE`
- `VITE_AUTH_BASE_URL`
- `VITE_FEISHU_APP_ID`
- `VITE_SKILLS_BRAND_NAME`
- `VITE_SITE_MODE`
- `VITE_CLI_NPM_REGISTRY`
- `VITE_CLI_PACKAGE_NAME`
- `VITE_CLI_SKILL_REGISTRY`
- `VITE_GITLAB_IMPORT_HOSTS`
- `VITE_SOULHUB_SITE_URL`
- `VITE_SOULHUB_HOST`
- `VITE_SOULS_BRAND_NAME`

前端 server runtime 变量：

- `BACKEND_URL`
- `API_ORIGIN`
- `SITE_URL`

Go 后端变量：

- `GO_ENV`
- `PORT`
- `JWT_SECRET`
- `FRONTEND_URL`
- `OAUTH_PUBLIC_BASE_URL`
- `OSS_ENDPOINT`
- `OSS_BUCKET`
- `OSS_REGION`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `GITHUB_ENABLED`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITLAB_BASE_URL`
- `GITLAB_IMPORT_TOKEN`
- `GITLAB_CA_CERT_FILE`
- `FEISHU_ENABLED`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_DEBUG_LOG_FULL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `SMTP_USE_TLS`

CLI 和测试工具变量继续保留在对应工具上下文中，不纳入本轮后端/前端运行配置收口。

后端 YAML 保留配置：

- `database.url`
- `database.max_connections`
- `auth.allowed_email_domains`
- `auth.superusers`

说明：代码可以继续支持 `DATABASE_URL` / `DATABASE_MAX_CONNECTIONS` 作为进程环境变量覆盖，但这两个变量不进入本轮 `backend/.env.<GO_ENV>` 模板和密钥迁移目标。

## 关键实现要求

- 后端配置加载需使用 `.env.<GO_ENV>`，但不能读取根目录 `.env.test`、`.env.online`。
- Go 配置结构中移除无效 `OSS.UseInternal`。
- `database.url` 和 `database.max_connections` 继续保留在 YAML 中，不迁移到 `backend/.env.<GO_ENV>`。
- `auth.allowed_email_domains` 和 `auth.superusers` 继续保留在 YAML 中，不迁移到 `backend/.env.<GO_ENV>`。
- GitHub Provider 启用语义需修正：`GITHUB_ENABLED=false` 应真正关闭 GitHub 登录，不能因为存在 client id 自动启用。
- AuthService 旧 helper 需同步更新或删除，不能继续依赖顶层 GitHub client 字段。
- GitLab OAuth/OIDC 登录 provider 和相关路由不再属于当前运行面；GitLab 导入服务需继续基于 `GITLAB_BASE_URL`、`GITLAB_IMPORT_TOKEN`、`GITLAB_CA_CERT_FILE` 读取项目内容。
- 前端 `src/lib/env.ts` 只保留主变量读取逻辑：
  - API origin 读取 `VITE_API_ORIGIN`、`API_ORIGIN`、`BACKEND_URL`
  - API base 读取 `VITE_API_BASE`
  - Auth base 读取 `VITE_AUTH_BASE_URL`
- server OG 路由只保留 `API_ORIGIN` / `VITE_API_ORIGIN` / 当前请求 host 作为 API base 来源。
- `.env.docker.example`、`docker-compose.yml`、`scripts/docker-run-backend.sh`、README、部署文档、认证文档、Docker 验证文档和项目规则必须同步更新。
- 本次不新增 `docker-compose.yml` 后端 `env_file`，不改造 `scripts/deploy-test.sh` 的远端环境变量注入，也不改造 `scripts/package-prd.sh` 的生产后端运行时注入边界。

## 验收方式

推荐执行：

```bash
cd backend && go test ./internal/config
cd backend && go test ./...
bun run test -- src/lib/site.test.ts src/lib/og.test.ts
bun run lint
```

废弃变量静态校验：

```bash
rg 'VITE_CONVEX_SITE_URL|VITE_BACKEND_BASE|VITE_API_BASE_URL|OSS_USE_INTERNAL|AUTH_GITHUB_ID|AUTH_GITHUB_SECRET|JWT_PRIVATE_KEY|JWKS|GITLAB_ENABLED|GITLAB_DISCOVERY_URL|GITLAB_CLIENT_ID|GITLAB_CLIENT_SECRET|GITLAB_ALLOWED_GROUPS' \
  README.md .env.local.example .env.docker.example docker-compose.yml scripts/docker-run-backend.sh \
  src/lib backend/internal \
  docs/auth.md docs/deploy.md docs/docker-verify-runbook.md docs/project-rules.md docs/quickstart.md docs/troubleshooting.md
```

当前运行代码、env 示例和当前运行文档中不应再出现这些废弃变量。归档文档或历史 `convex/` 目录如仍保留旧变量引用，应视为历史上下文，不作为当前运行配置依据。

Docker build context 校验：

```bash
rg -n '^backend/\.env\*|^!backend/\.env\*\.example' .dockerignore
```

需要确认 `.dockerignore` 已忽略真实后端 env 文件，并保留示例模板。

## 非目标

- 不做数据库 schema 或数据变更。
- 不删除 `convex/` 历史代码目录。
- 不提交真实密钥。
- 不执行 git history rewrite；已泄露过的旧密钥应由后续密钥轮换流程单独处理。
