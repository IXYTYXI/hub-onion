## Why

后端 YAML 当前混合了结构化配置与真实敏感值，导致密钥容易进入仓库和镜像构建上下文；同时前端、后端和示例文件中仍保留旧 Convex 变量、历史别名和无效配置项，增加了部署误配风险。

现在需要把真实敏感配置迁移到环境变量注入路径，并同步收口废弃变量，使本地开发、测试和生产部署使用同一套清晰的配置规则。

## What Changes

- 后端配置加载新增 `backend/.env.<GO_ENV>`，加载顺序明确为 `default.yaml`、环境 YAML、本地 env 文件、进程环境变量。
- 后端 YAML 移除对象存储、OAuth/OIDC、JWT、飞书和 SMTP 等真实敏感值；数据库连接串按环境继续允许保留在 YAML 中。
- 新增后端 env 模板文件，真实 `backend/.env.*` 文件本地保留并从 git 忽略。
- 前端移除旧 API 配置别名和 Convex 旧回退，只保留当前 Go 后端运行面需要的主变量。
- 后端移除无效的 `OSS_USE_INTERNAL` 配置，并修正 `GITHUB_ENABLED=false` 被 client id 自动覆盖的问题。
- GitLab 不再作为登录授权 provider，只保留 GitLab 项目读取/导入所需配置。
- `.dockerignore` 防止真实 `backend/.env.*` 进入 Docker build context。
- 当前运行文档、Docker 示例、compose 配置和本地 Docker 启动脚本同步删除废弃变量。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `go-backend-api`: 调整后端配置加载优先级，增加 `backend/.env.<GO_ENV>` 支持，明确敏感配置必须通过环境变量注入，并修正 OAuth provider 启用语义。
- `frontend-api-client`: 调整前端 API 配置变量规则，移除旧 Convex 和历史别名回退。
- `cdn-file-storage`: 收口对象存储配置项，移除当前实现未使用的 `use_internal` / `OSS_USE_INTERNAL` 语义。

## Impact

- 影响 `backend/internal/config/config.go`、`backend/internal/service/auth_service.go`、后端 YAML 配置文件、后端 env 示例模板、`.gitignore` 和 `.dockerignore`。
- 影响 `src/lib/env.ts`、server OG 路由和前端 API 相关测试。
- 影响 `.env.docker.example`、`docker-compose.yml`、`scripts/docker-run-backend.sh`、`README.md`、`docs/auth.md`、`docs/deploy.md`、`docs/docker-verify-runbook.md`、`docs/project-rules.md`、`docs/quickstart.md` 和 `docs/troubleshooting.md`。
- 不改变 skills/registry 相关 HTTP API、数据库 schema、CLI 协议和业务数据模型；GitLab OAuth 登录不再作为当前运行面能力。
- 不新增 `docker-compose.yml`、`scripts/deploy-test.sh`、`scripts/package-prd.sh` 的后端运行时注入流程。
