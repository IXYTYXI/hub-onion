<p align="center">
  <img src="public/clawd-logo.png" alt="ClawHub" width="120">
</p>

<h1 align="center">ClawHub</h1>

<p align="center">
  <a href="https://github.com/openclaw/clawhub/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/openclaw/clawhub/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

ClawHub 是一个开源的 Agent Skill Registry，用于发布、版本管理、搜索和安装文本形式的 agent skills（`SKILL.md` 及其配套文件）。它面向希望拥有可自托管、CLI 友好的技能管理平台的团队与个人。

<p align="center">
  <a href="https://clawhub.ai">ClawHub</a> ·
  <a href="https://onlycrabs.ai">onlycrabs.ai</a> ·
  <a href="VISION.md">Vision</a> ·
  <a href="docs/README.md">Docs</a> ·
  <a href="docs/deploy.md">Deploy</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="https://discord.gg/clawd">Discord</a>
</p>

---

## 亮点

- 一条命令安装：`clawhub install <slug>` 可以直接拉取并安装 skill。
- 智能搜索与推荐：不仅支持关键词，还支持按需求描述查找。
- 支持自托管：基于 Go + PostgreSQL 搭建私有 registry，无厂商锁定。
- GitHub 导入：支持从公开 GitHub 仓库自动识别并导入 skills。
- 版本管理：支持 SemVer、changelog、基于 hash 的更新检查。
- CLI 优先：核心能力均可通过 CLI 和 REST API 使用。

## 架构

ClawHub 已从 Convex 迁移到可自托管的 Go 后端架构：

```text
┌──────────────────────────────────────────────────────┐
│                      前端层                          │
│            TanStack Start (React + Vite)            │
│            TanStack Query 负责数据获取              │
│                      Port 3000                      │
└────────────────────┬─────────────────────────────────┘
                     │ fetch /api/v1/*
┌────────────────────▼─────────────────────────────────┐
│                     Go 后端                          │
│                  Gin HTTP framework                  │
│              PostgreSQL (GORM) + pg_trgm            │
│           Alibaba Cloud OSS (S3-compatible)         │
│                      Port 8080                      │
└──────────────────────────────────────────────────────┘
```

| 层级 | 技术栈 | 用途 |
|-------|-----------|---------|
| Web 框架 | Gin | HTTP 路由、中间件、multipart 处理 |
| 数据库 | PostgreSQL + GORM | skills 与版本存储、搜索 |
| 搜索 | pg_trgm + ILIKE | 名称、描述、标签的模糊匹配与相似度排序 |
| 文件存储 | Alibaba Cloud OSS (S3) | skill 文件上传与 CDN 分发 |
| 前端 | TanStack Start + React | 支持 SSR 的前端应用 |
| CLI | clawhub / yclawhub (npm) | 命令行技能管理 |

## 功能

### 一条命令安装 Skill

通过一条命令从 registry 安装 skill：

```bash
# Install a skill
clawhub install sonoscli

# Install a specific version
clawhub install sonoscli@1.2.0

# Update all installed skills
clawhub update --all

# Explore available skills
clawhub explore
```

CLI 会自动完成版本解析、下载、解压和本地安装。

### 面向私有 Registry 的 YClawHub CLI

如果你在私有环境或多环境部署中使用 ClawHub，建议使用 `yclawhub`。它与 `clawhub` 完全隔离：

- npm 包名：`yclawhub`
- 命令名：`yclawhub`
- 配置目录：`yclawhub`
- 工作区元数据目录：`.yclawhub`

安装与运行方式：

```bash
# One-off execution
npx yclawhub@latest --help

# Global install
npm i -g yclawhub
```

配合自定义 registry 的常见用法：

```bash
# Login against a private registry
npx yclawhub@latest login --registry https://registry.yc345.tv

# Search skills
npx yclawhub@latest search "internal skill" --registry https://registry.yc345.tv

# After global install
yclawhub login --registry https://registry.yc345.tv
yclawhub search "internal skill" --registry https://registry.yc345.tv
```

如果需要管理多个环境，`yclawhub` 还支持命名环境：

```bash
yclawhub env add --name prod --site https://registry.yc345.tv --use
yclawhub env current
yclawhub search "internal skill"
```

### Web 端智能搜索

可以在 `http://localhost:3000/skills`（或你映射出的前端端口）浏览和搜索 skills：

- 模糊搜索：基于 PostgreSQL `pg_trgm`，支持名称、描述、标签的相似度匹配。
- 分类浏览：支持按下载量、最新、名称排序。
- 详情预览：可直接查看 `SKILL.md`、文件树、版本历史和 changelog。

> 规划中：AI 语义搜索。用户可以使用自然语言描述需求，系统返回更智能的技能推荐。（Phase 2）

### 自托管部署

ClawHub 当前按两个服务运行：

- `frontend`：TanStack Start / Nitro，负责 Web 应用，运行在 `3000` 端口
- `backend`：Go / Gin，负责 `/api/v1/*`、`/auth/*`、`/.well-known/clawhub.json`，运行在 `8080` 端口

推荐运行方式：

- Web 用户访问前端域名
- 前端通过 `BACKEND_URL` 代理 Web API 请求到后端
- CLI 直接访问后端域名

如果要启用飞书主登录，请额外参考飞书配置清单：

- [飞书授权配置清单](docs/prd/feishu_auth/configuration.md)
- [独立部署手册](docs/deploy.md)

### Docker Compose 快速启动

```bash
git clone https://github.com/openclaw/clawhub.git
cd clawhub

# 可选：复制一份环境变量模板作为参考
cp .env.docker.example .env.docker

# 启动 backend + frontend
docker compose up --build

# 如果本机 3000/8080 已被占用，可改用其他宿主机端口
BACKEND_HOST_PORT=18080 FRONTEND_HOST_PORT=13000 docker compose up --build
```

默认宿主机端口：

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`

本次实际验证使用的端口示例：

- Frontend: `http://localhost:13000`
- Backend: `http://localhost:18080`

说明：

- `docker-compose.yml` 当前只启动 `frontend` 和 `backend`
- 后端容器默认使用 `GO_ENV=local`
- PostgreSQL 与迁移流程默认由外部环境提前准备

### 手动自托管启动

本地开发更推荐使用 [`./scripts/dev-local.sh`](#一键启动推荐) 一键启动；以下为分步手动流程：

```bash
# 1. 克隆仓库
git clone https://github.com/openclaw/clawhub.git
cd clawhub

# 2. 准备 PostgreSQL
createdb clawhub_local

# 3. 安装前端依赖
bun install

# 4. 执行后端迁移
cd backend
GO_ENV=local go run cmd/migrate/main.go

# 5. 启动后端
GO_ENV=local go run cmd/server/main.go

# 6. 在另一个终端启动前端
cd ..
bun run dev
```

自托管后你将获得：

- 对 skill registry 数据的完全控制
- 可面向内部团队发布私有 skills
- 可自定义 CDN / 对象存储后端（任何 S3 兼容服务）
- 不依赖外部 SaaS，可部署在单机或 Kubernetes 中
- CLI 可以指向你自己的 registry

```bash
# 让 CLI 指向你的私有 registry
export CLAWHUB_REGISTRY=https://your-registry.example.com
clawhub search my-internal-skill
```

### GitHub 导入

支持直接从公开 GitHub 仓库导入 skills：

1. 打开 Web 页面 `/import`
2. 粘贴 GitHub URL（仓库、tree 路径或 blob 链接）
3. ClawHub 自动识别 `SKILL.md`
4. 选择文件、填写元数据并发布

### 通过 Web 或 CLI 发布

Web 上传（`/upload`）：

- 拖拽一个包含 `SKILL.md` 的目录
- 设置 slug、display name、version、tags、changelog
- 发布前执行校验

CLI 发布：

```bash
clawhub publish ./my-skill/
```

## API 端点

所有接口均位于 `/api/v1/`：

| 方法 | 路径 | 说明 |
|--------|------|-------------|
| `GET` | `/api/v1/skills` | 获取 skill 列表（分页、排序） |
| `GET` | `/api/v1/skills/:slug` | 获取 skill 详情 |
| `GET` | `/api/v1/skills/:slug/versions` | 获取版本历史 |
| `GET` | `/api/v1/skills/:slug/file` | 获取单个文件内容 |
| `GET` | `/api/v1/search?q=...` | 模糊搜索 |
| `GET` | `/api/v1/resolve` | 基于 hash 的版本解析 |
| `GET` | `/api/v1/download` | 下载 ZIP |
| `POST` | `/api/v1/skills` | 发布 skill（multipart） |
| `DELETE` | `/api/v1/skills/:slug` | 软删除 skill |
| `POST` | `/api/v1/skills/:slug/undelete` | 恢复已删除 skill |
| `GET` | `/.well-known/clawhub.json` | Registry 发现接口 |
| `GET` | `/api/v1/health` | 健康检查 |

## CLI

常见 CLI 操作：

```bash
# Discover
clawhub search <query>       # 搜索 skills
clawhub explore               # 浏览所有 skills

# Install & manage
clawhub install <slug>        # 安装 skill
clawhub uninstall <slug>      # 删除本地安装
clawhub list                  # 查看已安装 skills
clawhub update --all          # 更新所有 skills

# Inspect
clawhub inspect <slug>        # 查看 skill 详情
clawhub inspect <slug> --versions  # 查看版本历史

# Publish
clawhub publish <path>        # 发布 skill
clawhub delete <slug>         # 软删除 skill
clawhub undelete <slug>       # 恢复 skill
```

使用 `yclawhub` 访问私有 registry 的示例：

```bash
# 不全局安装，直接一次性运行
npx yclawhub@latest login --registry https://registry.yc345.tv
npx yclawhub@latest search "internal skill" --registry https://registry.yc345.tv

# 全局安装后的使用方式
yclawhub env add --name prod --site https://registry.yc345.tv --use
yclawhub login
yclawhub search "internal skill"
yclawhub inspect my-private-skill
yclawhub install my-private-skill
```

文档入口：[`docs/quickstart.md`](docs/quickstart.md)、[`docs/cli.md`](docs/cli.md)。

## 仓库结构

```text
clawhub/
├── backend/                  # Go backend（Gin + PostgreSQL）
│   ├── cmd/server/           # 服务入口
│   ├── cmd/migrate/          # 数据库迁移工具
│   ├── internal/
│   │   ├── config/           # 配置（数据库、CDN、服务参数）
│   │   ├── database/         # PostgreSQL 连接与迁移
│   │   ├── handler/          # HTTP 路由处理器
│   │   ├── model/            # 数据模型（Skill、SkillVersion）
│   │   ├── service/          # 业务逻辑与存储抽象
│   │   └── middleware/       # CORS、限流等中间件
│   └── test/                 # 集成测试
├── src/                      # TanStack Start 前端
│   ├── routes/               # 页面路由（skills、upload、import）
│   ├── components/           # React 组件
│   ├── hooks/                # TanStack Query hooks
│   ├── lib/                  # 工具库、API client
│   └── types/                # TypeScript 类型定义
├── packages/schema/          # CLI 与前端共享的 API 类型
├── docs/                     # 文档
└── public/                   # 静态资源
```

## 本地开发

前置要求：[Go 1.22+](https://go.dev/)、[Bun](https://bun.sh/)（或 [Node.js 18+](https://nodejs.org/)）、PostgreSQL 14+、`curl`、`lsof`。

### 一键启动（推荐）

项目提供 `scripts/dev-local.sh`，可在单终端同时启动后端、前端，并自动跑数据库迁移与健康检查：

```bash
# 安装前端依赖（首次）
bun install

# 准备后端环境变量（首次）
cp backend/.env.local.example backend/.env.local
# 编辑 backend/.env.local，填写 JWT、OSS、OAuth 等凭据

# 启动前后端（默认先跑迁移）
./scripts/dev-local.sh
```

默认访问地址：

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:10091 |
| 后端 | http://localhost:8080 |
| 健康检查 | http://localhost:10091/api/v1/health |

常用选项：

```bash
./scripts/dev-local.sh --no-migrate   # 跳过数据库迁移
./scripts/dev-local.sh --stop         # 停止由脚本启动的进程
./scripts/dev-local.sh --help         # 查看帮助
```

可选环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `GO_ENV` | 后端配置环境 | `local` |
| `BACKEND_PORT` | 后端端口；若被占用则自动尝试 8080–8090 | `8080` |
| `FRONTEND_PORT` | 前端端口 | `10091` |
| `SKIP_MIGRATE=1` | 等同 `--no-migrate` | — |

示例：指定后端端口并跳过迁移：

```bash
GO_ENV=local BACKEND_PORT=8083 ./scripts/dev-local.sh --no-migrate
```

说明：

- 脚本会强制使用 `localhost` 作为前端与 OAuth 回调地址，避免 shell 或 `.env.test` 中的测试域名覆盖本地配置导致登录后跳走。
- 后端配置见 `backend/config/local.yaml`；敏感凭据放在 `backend/.env.local`（不提交仓库）。
- 按 `Ctrl+C` 或执行 `./scripts/dev-local.sh --stop` 停止服务。

### 分终端手动启动

如需分别调试前后端，可开两个终端：

```bash
# 终端 1：后端
cd backend
GO_ENV=local go run cmd/migrate/main.go
GO_ENV=local go run cmd/server/main.go

# 终端 2：前端（仓库根目录）
bun run dev
```

手动启动时前端默认端口为 `3000`（见 `package.json` 的 `dev` 脚本），后端默认端口为 `8080`。

### 后端配置加载规则

后端配置按以下顺序加载：

1. `backend/config/default.yaml`
2. `backend/config/${GO_ENV}.yaml`
3. `backend/.env.${GO_ENV}`（如果存在）
4. 进程环境变量

当前支持的 `GO_ENV`：

- `local`
- `dev`
- `test`
- `pro`

如果未设置 `GO_ENV`，默认使用 `local`。

数据库连接串、邮箱域名白名单和超级用户邮箱保留在 `backend/config/*.yaml` 中；第三方凭据、JWT、对象存储、飞书和 SMTP 密码放在 `backend/.env.${GO_ENV}` 或进程环境变量中。真实 `backend/.env.*` 不应提交，示例模板见 `backend/.env.*.example`。

### 后端环境变量

| 变量 | 说明 |
|-----|-------------|
| `GO_ENV` | 配置环境选择器 |
| `PORT` | HTTP 端口覆盖（默认 `8080`） |
| `FRONTEND_URL` | 前端公网 URL |
| `JWT_SECRET` | JWT 签名密钥 |
| `OSS_ENDPOINT` | S3 兼容存储端点 |
| `OSS_BUCKET` | 存储桶名称 |
| `OSS_REGION` | 存储区域 |
| `OSS_ACCESS_KEY_ID` | 存储 Access Key |
| `OSS_ACCESS_KEY_SECRET` | 存储 Secret Key |
| `GITHUB_ENABLED` | 是否启用 GitHub 登录 |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `GITLAB_BASE_URL` | GitLab 项目读取基础地址 |
| `GITLAB_IMPORT_TOKEN` | GitLab 导入令牌 |
| `GITLAB_CA_CERT_FILE` | 自定义 CA 证书路径（可选） |
| `SMTP_HOST` | SMTP 主机 |
| `SMTP_PORT` | SMTP 端口 |
| `SMTP_USERNAME` | SMTP 用户名 |
| `SMTP_PASSWORD` | SMTP 密码 |
| `SMTP_FROM` | 发件人地址 |
| `SMTP_USE_TLS` | 是否启用 SMTP TLS |

### 前端环境变量

| 变量 | 说明 |
|-----|-------------|
| `BACKEND_URL` | 前端服务端代理使用的后端地址 |
| `PORT` | 前端端口（默认 `3000`） |
| `VITE_SITE_URL` | 前端公网 URL |
| `VITE_API_BASE` | 浏览器请求 API 的基础路径，通常为 `/api/v1` |
| `VITE_AUTH_BASE_URL` | 浏览器 OAuth 导航使用的后端基础地址，用于 `/auth/feishu*` 这类跳转链路 |
| `API_ORIGIN` | 服务端 OG 数据抓取使用的显式 API 地址（可选） |

### 部署说明

- Web 流量应继续通过前端代理访问后端，而不是让浏览器直接跨域调用后端。
- 浏览器飞书 OAuth 跳转可通过 `VITE_AUTH_BASE_URL` 单独指向后端，避免与 API 代理链路混用。
- CLI 应直接指向后端域名，以访问 `/.well-known/clawhub.json` 和 `/api/v1/*`。
- Docker 环境变量示例见：[.env.docker.example](/Users/logo/self_repo/claw_case/clawhub/.env.docker.example)
- 本地 compose 示例见：[docker-compose.yml](/Users/logo/self_repo/claw_case/clawhub/docker-compose.yml)
- 若本机端口冲突，可设置 `BACKEND_HOST_PORT` 和 `FRONTEND_HOST_PORT`
- 部署参考见：[docs/deploy.md](/Users/logo/self_repo/claw_case/clawhub/docs/deploy.md)

## 迁移状态

ClawHub 已从 Convex（托管式 BaaS）迁移到可自托管的 Go 后端。

### 已完成（Phase 1）

- [x] 基于 Gin + PostgreSQL + GORM 的 Go 后端
- [x] Skills 的完整 CRUD API（列表、详情、版本、文件、删除、恢复）
- [x] 基于 `pg_trgm` 的模糊搜索与相似度排序
- [x] 基于 multipart 的 skill 发布与流式上传 CDN
- [x] 带 `_meta.json` 的确定性 ZIP 下载
- [x] 基于 SHA-256 的版本解析
- [x] Registry 发现端点（`/.well-known/clawhub.json`）
- [x] 前端迁移到 TanStack Query（移除 Convex 依赖）
- [x] GitHub 导入（前端侧，使用 GitHub API）
- [x] 集成测试套件
- [x] CLI 兼容性验证

### 计划中（Phase 2）

- [ ] 认证体系：GitHub OAuth + JWT
- [ ] AI 搜索：基于 embedding 的语义推荐
- [ ] Stars 与评论：社区互动能力
- [ ] 用户主页：skill ownership 与用户页
- [ ] 审核工具：管理面板、内容审核
- [ ] 实时更新：WebSocket 推送
- [x] Docker 部署：frontend + backend + postgres compose 方案
- [ ] 遥测面板：安装量 / 下载量分析

### 计划中（Phase 3）

- [ ] 多 Registry 联邦：跨 registry 发现 skills
- [ ] 插件市场：Nix 集成插件包
- [ ] 团队工作区：组织级私有 registry
- [ ] Webhook 集成：Discord、Slack 发布通知
- [ ] 自动安全分析：skill 内容安全扫描

## Skill 元数据

Skills 可以在 `SKILL.md` 的 frontmatter 中声明运行依赖：

```yaml
---
name: my-skill
description: Does a thing with an API.
metadata:
  openclaw:
    requires:
      env:
        - MY_API_KEY
      bins:
        - curl
    primaryEnv: MY_API_KEY
    os:
      - darwin
      - linux
---
```

完整说明见：[`docs/skill-format.md`](docs/skill-format.md#frontmatter-metadata)

### Nix 插件支持

ClawHub 支持带有 Nix 集成信息的插件包：

```yaml
---
name: peekaboo
description: Capture and automate macOS UI with the Peekaboo CLI.
metadata:
  clawdbot:
    nix:
      plugin: "github:clawdbot/nix-steipete-tools?dir=tools/peekaboo"
      systems: ["aarch64-darwin"]
---
```

## 常用脚本

```bash
bun run dev        # 启动前端开发服务器
bun run build      # 生产构建
bun run test       # 运行测试（Vitest）
bun run coverage   # 生成覆盖率报告
bun run lint       # 运行 Biome + oxlint
```

## 许可证

[MIT](LICENSE)

## Public source snapshot

This repository contains a source snapshot without deployment credentials, environment-specific YAML files, private npm authentication, historical database backups, or local development transcripts. Before running the backend, supply database, object storage, and authentication settings through your own private environment variables. The checked-in YAML files contain only public defaults. See `backend/internal/config/config.go` for the supported settings and environment-variable bindings. Do not commit populated credentials or database backups.
