## 1. 后端配置加载与语义修正

- [x] 1.1 在 `backend/internal/config/config.go` 中增加 `backend/.env.<GO_ENV>` 自动加载，加载失败仅在文件存在但解析失败时返回错误
- [x] 1.2 调整配置优先级为 `default.yaml` < `${GO_ENV}.yaml` < `backend/.env.<GO_ENV>` < 进程环境变量，并以实际命中的 `backend/config` 父目录定位 env 文件
- [x] 1.3 确保后端不读取根目录 `.env.test`、`.env.online` 等前端 Vite 环境文件
- [x] 1.4 移除 `OSSConfig.UseInternal`、`OSS_USE_INTERNAL` 绑定和相关文档示例
- [x] 1.5 移除 `AuthConfig.GitHubClientID` / `AuthConfig.GitHubClientSecret` 顶层兼容字段，统一使用 `auth.github.client_id` / `auth.github.client_secret`，并同步更新或删除 `NewAuthService` 旧 helper
- [x] 1.6 修正 GitHub provider 启用逻辑，确保 `GITHUB_ENABLED=false` 时不会因 client id/secret 存在而自动启用
- [x] 1.7 移除 GitLab OAuth 登录/授权 provider 的当前运行路径，不再读取 `GITLAB_ENABLED`、`GITLAB_DISCOVERY_URL`、`GITLAB_CLIENT_ID`、`GITLAB_CLIENT_SECRET`、`GITLAB_ALLOWED_GROUPS` 作为认证配置
- [x] 1.8 保留 GitLab 项目读取/导入能力，继续支持 `GITLAB_BASE_URL`、`GITLAB_IMPORT_TOKEN`、`GITLAB_CA_CERT_FILE`

## 2. 敏感配置外置与模板

- [x] 2.1 将 `backend/config/default.yaml`、`local.yaml`、`dev.yaml`、`test.yaml`、`pro.yaml` 中的真实敏感值迁移到本地 `backend/.env.<GO_ENV>`
- [x] 2.2 清理后端 YAML 中的 OSS AK/SK、OAuth/OIDC secret、JWT secret、飞书 app secret 和 SMTP password；数据库连接串、数据库密码、用户邮箱、超级用户邮箱和邮箱域名白名单保留在 YAML 中
- [x] 2.3 新增 `backend/.env.local.example`、`backend/.env.dev.example`、`backend/.env.test.example`、`backend/.env.pro.example`，模板不包含数据库连接串、用户邮箱、超级用户邮箱或邮箱域名白名单
- [x] 2.4 更新 `.gitignore`，忽略真实 `backend/.env.*`，但允许提交 `backend/.env.*.example`
- [x] 2.5 更新 `.dockerignore`，忽略真实 `backend/.env*`，但允许 `backend/.env*.example` 进入 Docker build context
- [x] 2.6 删除未被当前代码引用且含敏感值的旧测试配置文件，如 `backend/test/integration/config.yaml`

## 3. 前端与 server runtime 变量收口

- [x] 3.1 调整 `src/lib/env.ts`，移除 `VITE_BACKEND_BASE`、`VITE_API_BASE_URL`、`VITE_CONVEX_SITE_URL` 回退
- [x] 3.2 保留并验证 `VITE_API_BASE`、`VITE_API_ORIGIN`、`API_ORIGIN`、`BACKEND_URL`、`VITE_AUTH_BASE_URL` 的当前语义
- [x] 3.3 调整 server OG 路由，移除 `VITE_CONVEX_SITE_URL` 回退
- [x] 3.4 更新 `src/lib/site.test.ts`、`src/lib/og.test.ts` 或相关测试，覆盖新的 API 配置解析规则

## 4. 示例、Docker 与文档同步

- [x] 4.1 从 `.env.local.example` 移除 Convex 旧变量 `AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`、`JWT_PRIVATE_KEY`、`JWKS`、`OPENAI_API_KEY`
- [x] 4.2 从 `.env.docker.example` 和 `docker-compose.yml` 移除废弃变量 `VITE_BACKEND_BASE`、`VITE_API_BASE_URL`、`OSS_USE_INTERNAL` 以及不再使用的 GitLab OAuth 授权变量
- [x] 4.3 更新 `README.md` 的后端配置加载顺序、前后端变量表和部署说明
- [x] 4.4 更新 `docs/auth.md`、`docs/deploy.md`、`docs/docker-verify-runbook.md`、`docs/project-rules.md`、`docs/quickstart.md`、`docs/troubleshooting.md` 中的变量、GitLab 登录取舍和 Convex 旧路径说明
- [x] 4.5 更新 `scripts/docker-run-backend.sh` 注释或参数说明，使用 `backend/.env.<GO_ENV>` 或进程环境变量，不再提示挂载 `/app/backend/.env`
- [x] 4.6 明确本次不新增 `docker-compose.yml`、`scripts/deploy-test.sh`、`scripts/package-prd.sh` 的后端运行时注入流程
- [x] 4.7 在交付说明中明确本次不做 git history rewrite，已暴露密钥需要后续轮换

## 5. 验证

- [x] 5.1 运行 `cd backend && go test ./internal/config`，覆盖 repo root、`backend/`、`backend/internal/config`、Docker `/app/backend` 等 cwd 下的 `.env.<GO_ENV>` 定位规则
- [x] 5.2 运行 `cd backend && go test ./...`
- [x] 5.3 运行 `bun run test -- src/lib/site.test.ts src/lib/og.test.ts`
- [x] 5.4 运行 `bun run lint`（已运行；当前仓库存在既有 lint 失败，本次改动相关文件已单独通过 oxlint）
- [x] 5.5 静态确认 `.dockerignore` 已排除真实 `backend/.env*` 且保留 `.example`
- [x] 5.6 使用限定范围的 `rg` 确认当前运行代码、env 示例和当前运行文档中不再出现废弃变量；OpenSpec 变更文档、规划文档、归档文档和 `convex/` 历史目录中的说明性命中不作为失败
