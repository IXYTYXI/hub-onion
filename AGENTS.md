# 仓库指南

## 语言偏好设置
**重要：所有对话和响应请优先使用中文。**
**重要：所有生成的 spec 文档和任务列表必须使用中文。**

## 项目概述

ClawHub 是一个开源的 Agent Skill 注册中心，支持发布、版本管理、搜索和安装基于文本的 agent skills（`SKILL.md` 及附属文件）。平台支持自托管部署，采用 CLI 优先的设计理念。

## 项目结构

```
clawhub/
├── backend/                  # Go 后端（Gin + PostgreSQL）
│   ├── cmd/
│   │   ├── server/           # 服务启动入口
│   │   ├── migrate/          # 数据库迁移工具
│   │   ├── check-db/         # 数据库检查工具
│   │   └── fix-migration/    # 迁移修复工具
│   ├── internal/
│   │   ├── config/           # 配置管理（Viper，多环境 YAML + 环境变量）
│   │   ├── database/         # PostgreSQL 连接 + GORM + 迁移文件
│   │   ├── handler/          # HTTP 路由处理器（skills、auth、user、search、publish、download、comments、gitlab-import）
│   │   ├── model/            # 数据模型（Skill、SkillVersion、User）
│   │   ├── service/          # 业务逻辑（auth、skill、storage、zip、email、session、identity、gitlab-import）
│   │   └── middleware/       # 中间件（auth、CORS）
│   ├── config/               # 多环境 YAML 配置（default、local、dev、test、pro）
│   └── data/sql/             # 数据库变更 SQL 文件（按时间戳目录组织）
├── src/                      # TanStack Start 前端（React + Vite）
│   ├── routes/               # 页面路由（文件路由）
│   ├── components/           # React 组件
│   ├── hooks/                # TanStack Query hooks（useSkills、useSkill、usePublishSkill 等）
│   ├── lib/                  # 工具函数（apiClient、badges、uploadFiles）
│   └── types/                # TypeScript 类型定义
├── packages/
│   ├── clawhub/              # CLI 包（clawhub 命令，@guanghe-pub/clawhub-pak）
│   ├── yclawhub/             # 私有注册中心 CLI（yclawhub 命令）
│   └── schema/               # 共享 ArkType schemas（clawhub-schema）
├── convex/                   # 旧 Convex 后端（逐步淘汰中，参见待办任务）
├── e2e/                      # Playwright E2E 测试
├── docs/                     # 文档
└── public/                   # 静态资源
```

## 构建、测试和开发命令

### 前端（Bun）
```bash
bun run dev            # 本地开发服务器 http://localhost:3000
bun run build          # 生产构建（Vite + Nitro）
bun run preview        # 预览构建后的应用
bun run test           # Vitest 单元测试
bun run coverage       # 覆盖率报告（阈值 70%）
bun run lint           # oxlint（类型感知）
bun run lint:fix       # oxlint 自动修复 + oxfmt 格式化
bun run test:watch     # Vitest 监听模式
bun run test:e2e       # Playwright E2E 测试
```

### 后端（Go）
```bash
cd backend
GO_ENV=local go run cmd/migrate/main.go   # 运行数据库迁移
GO_ENV=local go run cmd/server/main.go    # 启动后端服务（端口 8080）
```

## 编码风格与命名约定
- TypeScript strict 模式；ESM
- 缩进：2 空格
- Lint：oxlint（类型感知模式）
- 格式化：oxfmt
- Go 后端：遵循 Go 标准项目布局
- Convex 函数命名：动词优先（`getBySlug`、`publishVersion`）
- 提交信息：Conventional Commits（`feat:`、`fix:`、`chore:`、`docs:`）

## 测试指南
- 框架：Vitest 4 + jsdom
- E2E：Playwright
- 测试文件：`**/*.test.ts` 与源文件同目录
- 覆盖率阈值：70%（行/函数/分支/语句）
- 示例：`src/__tests__/`、`e2e/*.pw.test.ts`

## 提交与 Pull Request 指南
- 提交信息：遵循 Conventional Commits（`feat:`、`fix:`、`chore:`、`docs:` 等）
- 保持变更范围明确；避免全仓库搜索/替换
- PR：包含摘要 + 运行的测试命令。UI 变更需附截图
- 拒绝直接将 skills 添加到源代码/仓库内容中的 PR（例如在 `skills/` 下或仅用于发布的种子添加）。Skills 必须通过 CLI 上传/发布

## Git 注意事项
- 如果 `git branch -d/-D <branch>` 被策略阻止，直接删除本地引用：`git update-ref -d refs/heads/<branch>`

## 后端架构

### 技术栈

| 用途 | 库 |
|------|-----|
| Web 框架 | Gin |
| 配置管理 | Viper |
| 数据库 ORM | GORM + pgx |
| 认证 | JWT + OAuth（GitHub、飞书） |
| 对象存储 | AWS SDK v2（S3 协议，阿里云 OSS） |
| 日志 | Logrus |

### API 端点

所有端点前缀 `/api/v1/`：

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/skills` | 列出 skills（分页、排序） |
| GET | `/skills/:slug` | 获取 skill 详情 |
| GET | `/skills/:slug/versions` | 版本历史 |
| GET | `/skills/:slug/file` | 获取单个文件内容 |
| GET | `/search?q=...` | 模糊搜索（pg_trgm） |
| GET | `/resolve` | 根据 hash 解析版本 |
| GET | `/download` | 下载 ZIP |
| POST | `/skills` | 发布 skill（multipart） |
| DELETE | `/skills/:slug` | 软删除 |
| POST | `/skills/:slug/undelete` | 恢复删除 |
| GET | `/.well-known/clawhub.json` | Registry 发现 |

### 配置加载顺序

1. `backend/config/default.yaml`
2. `backend/config/${GO_ENV}.yaml`
3. `backend/.env.${GO_ENV}` 环境变量覆盖

关键环境变量：`DATABASE_URL`、`OSS_ENDPOINT`、`OSS_BUCKET`、`JWT_SECRET`、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`GITLAB_*`、`FEISHU_*`、`SMTP_*`

## 前端架构

### 数据获取模式
- 使用 TanStack Query（React Query）进行所有 API 调用
- API 客户端：`src/lib/apiClient.ts`（`apiRequest()` 和 `authRequest()`）
- 自定义 hooks 在 `src/hooks/` 中封装 TanStack Query

### 路由
- 基于 TanStack Router 的文件路由
- 路由文件在 `src/routes/` 目录

## 配置与安全
- 后端敏感配置外置到 `backend/.env.*` 文件（不提交密钥，只提交 `.example` 模板）
- OAuth：已实现 GitHub OAuth 和飞书 OAuth
- JWT 认证：后端已完整实现（注册、登录、会话管理）

## Docker 镜像打包与推送规范
- 所有需要部署到测试环境或正式环境的 Docker 镜像，目标平台默认固定为 `linux/amd64`。
- 本地如果是 `arm64` 机器，必须显式使用 `docker buildx build --platform linux/amd64 ...`；禁止省略平台参数后直接构建并推送。
- 镜像重新打包时必须使用新的唯一 tag，禁止复用刚出过问题的旧 tag。
- 镜像构建完成后、推送前，必须执行 `docker image inspect <image>:<tag> --format '{{.Os}}/{{.Architecture}}'`，确认输出为 `linux/amd64`。
- 镜像推送完成后，必须执行 `docker buildx imagetools inspect <image>:<tag>` 或等效命令，确认远端 tag 的平台信息包含 `linux/amd64`。
- 如果是前端 `.output` 热修镜像，除镜像平台校验外，还必须在本地导出或运行镜像，确认目标字符串、配置或编译产物已经实际生效。
- 如果是基于历史镜像做热修，必须在交付说明里记录"基于哪个原始 tag 或 digest 产生了哪个新 tag"。
- Docker 打包流程如有变化，必须先同步更新 `docs/deploy.md`，再执行新的打包与推送。

## 数据库变更要求
- 所有数据库结构或数据变更，必须先在 `backend/data/sql/<YYYYMMDDHHMM>/` 目录下输出文件，再执行到目标数据库。
- 新的数据库结构或数据变更只使用 `backend/data/sql/<YYYYMMDDHHMM>/` 下的纯 SQL 文件推进，不再新增或维护 `backend/internal/database/migrations` 下的迁移文件。
- 目录名必须使用时间格式 `YYYYMMDDHHMM`，例如：`backend/data/sql/202604021720/`。
- 每次数据库变更目录下固定放 3 个文件：
  - `schema.sql`：执行前导出的数据库结构备份
  - `data.sql`：执行前导出的数据库数据备份
  - `upgrade.sql`：本次实际执行的升级 SQL
- `upgrade.sql` 文件头部必须记录执行时间，格式为 `YYYY-MM-DD HH:MM:SS`。
- 在执行任何数据库变更前，必须先生成当次目录，并先备份结构和数据，再编写和执行 `upgrade.sql`。
- 如需回滚 SQL，可额外放 `rollback.sql`，但 `schema.sql`、`data.sql`、`upgrade.sql` 是必选文件。

---

## 待办：前端 Convex 迁移

Convex 后端已由 Go 后端完全替代，但前端仍有 Convex 残留代码需要清理：

### 待完成任务

1. **清理 convex/ 目录** — 移除不再使用的 Convex 函数和 schema（保留仍被前端引用的部分直到完全解耦）
2. **前端 Convex 引用替换** — 将剩余的 `useQuery(api.xxx)` / `useMutation(api.xxx)` 调用替换为 TanStack Query + `apiRequest()`
3. **移除 Convex 依赖** — 从 `package.json` 中移除 `convex` 相关依赖，清理 `vitest.config.ts` 中对 `convex/` 的覆盖率配置
4. **清理 AppProviders** — 移除 `ConvexProvider` / `ConvexAuthProvider`，只保留 `QueryClientProvider`
5. **Convex 环境变量清理** — 移除 `VITE_CONVEX_URL` 等 Convex 相关环境变量

### 注意事项
- 后端 API 响应格式必须与现有前端 hooks 兼容
- 迁移过程中保持所有现有功能正常工作
- 优先替换最常用的 hooks，逐步推进
