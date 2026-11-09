## Context

当前项目已经完成 Go 后端迁移，前端通过 TanStack Query 和 Nitro server proxy 访问 Go API。后端配置由 `backend/config/default.yaml` 与 `backend/config/${GO_ENV}.yaml` 合并，再由进程环境变量覆盖；但这些 YAML 当前承载了 OSS 凭据、OAuth/OIDC secret、JWT secret、飞书 app secret 和 SMTP password 等真实敏感值。

前端配置集中在 `src/lib/env.ts`，仍兼容 `VITE_BACKEND_BASE`、`VITE_API_BASE_URL`、`VITE_CONVEX_SITE_URL` 等历史变量。server OG 路由也仍读取 `VITE_CONVEX_SITE_URL` 作为 API 回退。根目录 `.env.test` 和 `.env.online` 是 Vite 构建用环境文件，不适合承载 Go 后端真实密钥。

## Goals / Non-Goals

**Goals:**

- 将 Go 后端真实敏感配置外置到 `backend/.env.<GO_ENV>` 或部署平台环境变量。
- 让后端 YAML 成为可提交的安全配置骨架，不再保存真实密钥。
- 清理当前运行面中的废弃变量和历史别名。
- 保持 skills/registry HTTP API、CLI API、数据库 schema 和核心业务行为不变。
- 明确本地开发、测试、生产三类环境的配置文件边界。
- 防止真实 `backend/.env.*` 进入 Docker build context 或镜像构建层。
- 明确 GitLab 当前仅作为项目读取/导入来源，不再作为登录授权 provider。

**Non-Goals:**

- 不删除 `convex/` 历史代码目录。
- 不执行 git history rewrite。
- 不轮换已经泄露过的密钥；密钥轮换应由单独安全流程处理。
- 不改数据库 schema 或执行数据迁移。
- 不调整 CLI 自身的 `CLAWHUB_*` / `YCLAWHUB_*` 环境变量体系。
- 不新增 `docker-compose.yml` 后端 `env_file` 或运行时注入流程；本次只清理 compose 中的废弃变量。
- 不改造 `scripts/deploy-test.sh` 的远端环境变量注入流程。
- 不改造 `scripts/package-prd.sh` 的生产后端运行时注入边界。

## Decisions

1. 后端真实 env 文件放在 `backend/` 下。
   - 选择：使用 `backend/.env.<GO_ENV>`，例如 `backend/.env.dev`。
   - 原因：根目录 `.env.test`、`.env.online` 已被前端 Vite 构建使用，混入后端密钥会扩大泄露面并造成语义冲突。
   - 替代方案：根目录 `.env.<env>`。该方案更接近 Vite 习惯，但会把前后端变量混在同一文件，不采用。

2. `.env.<GO_ENV>` 缺失不阻止启动。
   - 选择：后端尝试加载本地 env 文件，文件不存在时继续依赖 YAML 与进程环境变量。
   - 原因：生产环境通常由容器平台、PaaS 或 shell 直接注入变量，不应强制镜像内存在真实 `.env`。
   - 替代方案：强制每个环境存在 `.env.<GO_ENV>`。该方案会让生产密钥文件进入部署流程，不采用。

3. 配置优先级使用“默认 YAML < 环境 YAML < 本地 env 文件 < 进程环境变量”。
   - 原因：YAML 提供结构与非敏感默认值，本地 env 提供开发/测试便利，进程环境变量保留最高优先级以支持部署平台覆盖。
   - 替代方案：让 `.env` 低于 YAML。该方案会导致本地密钥无法覆盖提交配置，不采用。

4. 直接移除当前运行面废弃变量，不做新一轮兼容期。
   - 废弃变量包括 `VITE_CONVEX_SITE_URL`、`VITE_BACKEND_BASE`、`VITE_API_BASE_URL`、`OSS_USE_INTERNAL`、`AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`、`JWT_PRIVATE_KEY`、`JWKS`。
   - 原因：项目当前目标运行面是 Go 后端和 TanStack 前端；继续保留旧回退会让部署配置难以判断哪一个变量真正生效。
   - 替代方案：仅标记 deprecated。该方案短期更保守，但不能解决配置混乱问题，不采用。

5. 修正 GitHub provider 启用语义。
   - 选择：`GITHUB_ENABLED=false` 必须保持关闭；只有显式启用且 client id/secret 完整时才注册 provider。
   - 原因：当前“存在 client id 自动启用”的逻辑会使 env 外置后更容易发生误启用。

6. GitLab 不再作为登录授权 provider。
   - 选择：移除当前运行面中的 GitLab OAuth 登录/授权配置，只保留 GitLab 项目读取/导入所需的 `GITLAB_BASE_URL`、`GITLAB_IMPORT_TOKEN` 和 `GITLAB_CA_CERT_FILE`。
   - 原因：当前需求只要求读取 GitLab 项目，不需要基于 GitLab 完成用户授权或登录。
   - 替代方案：继续保留 GitLab OIDC provider。该方案会保留不再需要的 client id/secret/discovery/allowed groups 配置，不采用。

7. Docker build context 必须排除后端真实 env 文件。
   - 选择：在 `.dockerignore` 中忽略 `backend/.env*`，并允许 `backend/.env*.example` 继续进入上下文。
   - 原因：`backend/Dockerfile` 会复制 `backend/`，如果真实 env 文件进入 build context，即使最终镜像不复制，也可能出现在构建上下文或 builder layer 中。
   - 替代方案：仅依赖 `.gitignore`。该方案无法约束 Docker build context，不采用。

8. `backend/.env.<GO_ENV>` 定位以 backend 根目录为准。
   - 选择：先定位实际使用的 `backend/config` 目录，再从其父目录读取 `.env.<GO_ENV>`；覆盖 repo root、`backend/`、`backend/internal/config`、Docker `/app/backend` 等常见 cwd。
   - 原因：直接按当前工作目录拼接 `.env.<GO_ENV>` 容易误读根目录前端 env 或在测试目录失效。

9. 用户邮箱和邮箱白名单保留在 YAML 配置中。
   - 选择：`auth.allowed_email_domains` 与 `auth.superusers` 继续写在 `backend/config/*.yaml`，不迁移到 `backend/.env.<GO_ENV>`。
   - 原因：这些是业务授权配置，不是第三方凭据或签名密钥；保留在 YAML 中更便于审阅环境差异。
   - 替代方案：使用 `AUTH_SUPERUSERS_JSON` / `ALLOWED_EMAIL_DOMAINS` 外置。该方案会把可审阅的用户配置混入密钥文件，不采用。

10. 数据库连接串和数据库密码保留在 YAML 配置中。
   - 选择：`database.url` 与 `database.max_connections` 继续写在 `backend/config/*.yaml`，不迁移到 `backend/.env.<GO_ENV>`；`DATABASE_URL` / `DATABASE_MAX_CONNECTIONS` 仅作为进程环境变量覆盖能力保留。
   - 原因：不同环境数据库无法互相登录，数据库连接信息按环境保留在 YAML 中可以满足当前风险边界和审阅需求。
   - 替代方案：强制迁移数据库连接串到 `.env.<GO_ENV>`。该方案会增加本地配置文件数量，但当前收益有限，不采用。

## Risks / Trade-offs

- [旧部署仍依赖 `VITE_API_BASE_URL` 或 `VITE_BACKEND_BASE`] -> 更新 env 示例和部署文档，并在测试中覆盖 `VITE_API_ORIGIN` / `VITE_API_BASE` 的新语义。
- [本地开发者缺少真实 `backend/.env.<GO_ENV>` 导致后端无法连接 OSS、OAuth、飞书或 SMTP 等外部服务] -> 提供 `.example` 模板，并让错误来自具体依赖初始化而非配置文件缺失。
- [误删 Convex 历史路径仍使用的变量] -> 本次只清理当前运行文档、env 示例和 Go/TanStack 运行逻辑，不删除 `convex/` 目录代码。
- [移除 GitLab OAuth 后误伤 GitLab 项目导入] -> 保留 GitLab import service 读取项目所需变量和 API，测试覆盖导入配置仍可用。
- [真实 env 文件进入 Docker build context] -> `.dockerignore` 和静态校验同时约束，真实 `backend/.env.*` 不得进入构建上下文。
- [明文密钥仍存在 git 历史] -> 在交付说明中明确本次不做 history rewrite，建议后续轮换已暴露密钥。

## Migration Plan

1. 新增 `backend/.env.<GO_ENV>` 加载逻辑和后端 config 测试，测试覆盖 repo root、`backend/`、`backend/internal/config` 与 Docker 工作目录等定位场景。
2. 生成本地真实 `backend/.env.local/dev/test/pro`，同时提交对应 `.example` 模板。
3. 清理 `backend/config/*.yaml` 中的真实敏感值和废弃字段。
4. 清理前端、server OG、Docker 示例、本地 Docker 启动脚本和文档中的废弃变量。
5. 移除 GitLab OAuth 登录/授权配置路径，保留 GitLab 项目读取/导入能力。
6. 更新 `.dockerignore`，防止真实后端 env 文件进入 Docker build context。
7. 运行后端配置测试、前端 env/OG 测试、lint、`.dockerignore` 静态检查和限定范围的 `rg` 校验。

## Open Questions

无。当前假设 Convex 已退出当前运行配置体系；如后续仍需维护 Convex 部署，应单独恢复对应配置文档，而不是混入 Go 后端运行面。
