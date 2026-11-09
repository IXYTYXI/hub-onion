## ADDED Requirements

### Requirement: 认证中间件
系统 SHALL 提供可复用的认证中间件，用于保护需要登录的路由。

#### Scenario: 有效 JWT cookie 认证
- **WHEN** 请求携带有效的 `clawhub_session` cookie
- **THEN** 中间件 SHALL 解析 JWT，将用户信息注入 Gin context（key: `current_user`）

#### Scenario: 有效 Bearer JWT 认证
- **WHEN** 请求携带 `Authorization: Bearer <jwt>`
- **THEN** 中间件 SHALL 解析 JWT，将用户信息注入 context

#### Scenario: 有效 CLI token 认证
- **WHEN** 请求携带 `Authorization: Bearer <cli-token>`（非 JWT 格式）
- **THEN** 中间件 SHALL 查库验证 token 哈希，将 token 所属用户注入 context

#### Scenario: 无凭证请求可选认证路由
- **WHEN** 请求未携带任何凭证，访问可选认证路由（如 `GET /skills/:slug`）
- **THEN** 中间件 SHALL 允许请求通过，context 中 `current_user` 为 nil

#### Scenario: 无凭证请求必须认证路由
- **WHEN** 请求未携带任何凭证，访问必须认证路由（如 `POST /skills`）
- **THEN** 中间件 SHALL 返回 401 Unauthorized，终止请求

### Requirement: OAuth 路由注册
系统 SHALL 注册 GitHub OAuth 相关路由。

#### Scenario: 路由列表
- **WHEN** 系统启动
- **THEN** 系统 SHALL 注册以下路由：
  - `GET /auth/github` — 发起 OAuth 登录
  - `GET /auth/github/callback` — OAuth 回调处理
  - `POST /auth/logout` — 登出

### Requirement: 用户相关路由注册
系统 SHALL 注册用户资料、token 管理、用户审核管理路由，以及 owner/self 与 superuser 场景下的 skill 管理路由。

#### Scenario: 路由列表
- **WHEN** 系统启动
- **THEN** 系统 SHALL 注册以下路由：
  - `GET /api/v1/users/me` — 获取当前用户（需认证）
  - `GET /api/v1/users/:handle` — 获取用户公开资料
  - `GET /api/v1/users/:handle/skills` — 获取用户 skill 列表
  - `GET /api/v1/users/me/stars` — 获取当前用户收藏（需认证）
  - `POST /api/v1/skills/:slug/star` — 收藏 skill（需认证）
  - `DELETE /api/v1/skills/:slug/star` — 取消收藏（需认证）
  - `GET /api/v1/users/me/tokens` — 获取 CLI token 列表（需认证）
  - `POST /api/v1/users/me/tokens` — 创建 CLI token（需认证）
  - `DELETE /api/v1/users/me/tokens/:id` — 撤销 CLI token（需认证）
  - `GET /api/v1/my/skills` — 获取当前用户的 skill 管理列表（需认证）
  - `GET /api/v1/my/skills/:slug` — 获取当前用户单个 skill 的管理详情（需认证）
  - `GET /api/v1/admin/users` — 查询用户审核列表（仅超级用户）
  - `GET /api/v1/admin/users/:id` — 查询单个用户审核详情（仅超级用户）
  - `POST /api/v1/admin/users/:id/approve` — 批准用户（仅超级用户）
  - `POST /api/v1/admin/users/:id/reject` — 拒绝用户（仅超级用户）
  - `POST /api/v1/admin/users/:id/disable` — 停用用户（仅超级用户）
  - `POST /api/v1/admin/users/:id/enable` — 重新启用用户（仅超级用户）
  - `GET /api/v1/admin/skills` — 查询全站 skill 管理列表（仅超级用户）
  - `GET /api/v1/admin/skills/:slug` — 查询单个 skill 管理详情（仅超级用户）
  - `POST /api/v1/admin/skills/:slug/delete` — 删除任意 skill（仅超级用户）
  - `POST /api/v1/admin/skills/:slug/undelete` — 恢复任意 skill（仅超级用户）

### Requirement: 当前用户 skill 管理接口
系统 SHALL 提供面向当前登录用户的 skill 管理接口，以支撑 owner 自助管理页面。

#### Scenario: 获取当前用户 skill 列表
- **WHEN** 已登录用户请求 `GET /api/v1/my/skills`
- **THEN** 系统 SHALL 返回当前用户拥有的 skill 列表，并包含状态、当前版本和更新时间等管理所需字段

#### Scenario: 获取当前用户单个 skill 管理详情
- **WHEN** 已登录用户请求 `GET /api/v1/my/skills/{slug}` 且该 skill 属于当前用户
- **THEN** 系统 SHALL 返回该 skill 的管理详情，包括基本信息、当前版本和历史版本

#### Scenario: 访问他人的当前用户 skill 接口
- **WHEN** 已登录用户请求 `GET /api/v1/my/skills/{slug}` 且该 skill 不属于当前用户
- **THEN** 系统 SHALL 返回 403 Forbidden 或等价的无权限响应

### Requirement: superuser 全站 skill 管理接口
系统 SHALL 提供仅 superuser 可访问的全站 skill 管理接口。

#### Scenario: 获取全站 skill 列表
- **WHEN** superuser 请求 `GET /api/v1/admin/skills`
- **THEN** 系统 SHALL 返回全站 skill 列表，并支持按状态、owner、slug 或 display name 过滤

#### Scenario: 获取单个 skill 管理详情
- **WHEN** superuser 请求 `GET /api/v1/admin/skills/{slug}`
- **THEN** 系统 SHALL 返回该 skill 的管理详情，包括 owner、当前版本、历史版本和删除状态

#### Scenario: 非 superuser 访问全站 skill 管理接口
- **WHEN** 非 superuser 用户访问任何 `admin/skills` 接口
- **THEN** 系统 SHALL 返回 403 Forbidden

### Requirement: management 用户视角的 skill 详情接口
系统 SHALL 支持 superuser 在用户管理场景中查看指定用户发布的所有 skill。

#### Scenario: 获取指定用户及其 skill
- **WHEN** superuser 请求用户管理详情接口
- **THEN** 系统 SHALL 在返回用户详情时包含该用户发布的 skill 列表，或提供等价的用户维度 skill 查询接口

### Requirement: Go 后端服务器初始化
系统应使用 Gin 框架初始化 Go HTTP 服务器，并进行适当的配置管理。

#### 场景：服务器成功启动
- **当** 服务器二进制文件执行时
- **则** 服务器应绑定到配置的端口并接受 HTTP 请求

#### 场景：配置加载
- **当** 服务器启动时
- **则** 服务器应从环境变量或配置文件加载配置，包括数据库连接、CDN 凭据和服务器端口

### Requirement: CORS 中间件
系统应实现 CORS 中间件以允许来自前端应用的跨域请求。

#### 场景：预检请求处理
- **当** 浏览器发送 OPTIONS 预检请求时
- **则** 服务器应响应适当的 CORS 响应头，包括允许的源、方法和响应头

#### 场景：实际请求 CORS 响应头
- **当** 客户端发出 API 请求时
- **则** 服务器应在响应中包含 CORS 响应头

### Requirement: PostgreSQL 数据库连接
系统应建立并维护与 PostgreSQL 数据库的连接池。

#### 场景：启动时的数据库连接
- **当** 服务器启动时
- **则** 服务器应使用配置的 ConnectionString 连接到 PostgreSQL 并验证连接性

#### 场景：连接池管理
- **当** 多个并发请求访问数据库时
- **则** 系统应高效地重用连接池中的连接

### Requirement: 数据库迁移
系统应支持数据库 schema 迁移以进行版本控制。

#### 场景：初始 schema 创建
- **当** 在空数据库上运行迁移时
- **则** 系统应创建所有必需的表、索引和扩展

#### 场景：迁移版本控制
- **当** 添加新迁移时
- **则** 系统应跟踪已应用的迁移并只运行新的迁移

### Requirement: 项目结构组织
系统应按照 Go 最佳实践组织代码，清晰地分离关注点。

#### 场景：Handler 层分离
- **当** 实现 API 端点时
- **则** HTTP handlers 应在 handler 包中，并将业务逻辑委托给 service 层

#### 场景：Model 层定义
- **当** 定义数据结构时
- **则** 数据库模型应在 model 包中，带有适当的结构体标签

#### 场景：Service 层业务逻辑
- **当** 实现业务操作时
- **则** 业务逻辑应在 service 包中，独立于 HTTP 关注点

### Requirement: Go 技术栈
系统应使用以下 Go 技术栈构建后端服务。

#### 场景：Web 框架
- **当** 实现 HTTP 服务器时
- **则** 系统应使用 Gin 框架（github.com/gin-gonic/gin）

#### 场景：配置管理
- **当** 管理应用配置时
- **则** 系统应使用 Viper 库（github.com/spf13/viper）进行配置管理

#### 场景：数据库 ORM
- **当** 操作数据库时
- **则** 系统应使用 GORM 库（gorm.io/gorm）进行 ORM 映射

#### 场景：日志记录
- **当** 记录日志时
- **则** 系统应使用 Logrus 库（github.com/sirupsen/logrus）进行结构化日志记录

#### 场景：HTTP 客户端
- **当** 发出外部 HTTP 请求时（如 CDN API 调用）
- **则** 系统应使用 Resty 库（github.com/go-resty/resty/v2）

#### 场景：JSON 处理
- **当** 解析复杂 JSON 时
- **则** 系统应使用 gjson 库（github.com/tidwall/gjson）进行高效 JSON 查询

### Requirement: 依赖管理
系统应使用 Go modules 管理依赖。

#### 场景：go.mod 初始化
- **当** 设置项目时
- **则** 系统应初始化 go.mod 文件，指定 Go 1.22+ 版本

#### 场景：依赖锁定
- **当** 安装依赖时
- **则** 系统应生成 go.sum 文件以锁定依赖版本

### Requirement: 配置管理
系统 SHALL 实现灵活且安全的配置管理机制，并将真实敏感配置通过环境变量或后端专用 `.env` 文件注入，而不是保存在可提交的 YAML 配置中。

#### 场景：环境变量配置
- **当** 系统读取对象存储、JWT、OAuth/OIDC、飞书或 SMTP 等敏感配置
- **则** 系统 SHALL 支持从环境变量读取这些配置

#### 场景：配置文件
- **当** 系统读取配置文件
- **则** 系统 SHALL 从 `backend/config/default.yaml` 和 `backend/config/${GO_ENV}.yaml` 读取安全默认值、结构化配置和非敏感环境差异配置

#### 场景：数据库配置保留在 YAML
- **当** 系统读取数据库连接配置
- **则** 系统 SHALL 允许 `database.url` 和 `database.max_connections` 保留在 `backend/config/*.yaml`
- **并且** 系统 SHALL NOT 要求将数据库连接串或数据库密码迁移到 `backend/.env.${GO_ENV}`
- **并且** 系统 MAY 继续支持 `DATABASE_URL` 和 `DATABASE_MAX_CONNECTIONS` 作为进程环境变量覆盖

#### 场景：后端专用 env 文件
- **当** `backend/.env.${GO_ENV}` 存在
- **则** 系统 SHALL 加载该文件中的变量，并用它们覆盖 YAML 配置

#### 场景：后端专用 env 文件定位
- **当** 后端从 repo root、`backend/`、`backend/internal/config` 或 Docker 工作目录 `/app/backend` 启动
- **则** 系统 SHALL 以实际命中的 `backend/config` 目录父级作为 backend 根目录，并只从该目录读取 `.env.${GO_ENV}`

#### 场景：后端专用 env 文件缺失
- **当** `backend/.env.${GO_ENV}` 不存在
- **则** 系统 SHALL 继续启动配置加载流程，并允许部署平台或 shell 通过进程环境变量提供配置

#### 场景：配置优先级
- **当** 多个配置源存在同一个配置项
- **则** 系统 SHALL 遵循优先级：进程环境变量 > `backend/.env.${GO_ENV}` > `backend/config/${GO_ENV}.yaml` > `backend/config/default.yaml` > 默认值

#### 场景：根目录前端 env 文件隔离
- **当** 后端加载配置
- **则** 系统 SHALL NOT 读取根目录 `.env.test`、`.env.online` 或其他前端 Vite 环境文件作为后端密钥来源

#### 场景：超级用户配置
- **当** 系统加载认证相关配置
- **则** 系统 SHALL 支持加载按 provider 分层的超级用户配置，并允许通过 provider email 或 subject 精确匹配超级用户
- **并且** 用户邮箱、超级用户邮箱和邮箱域名白名单 SHALL 允许保留在 `backend/config/*.yaml` 中
- **并且** 系统 SHALL NOT 要求将这些邮箱配置迁移到 `backend/.env.${GO_ENV}`

#### 场景：GitHub provider 显式关闭
- **当** `GITHUB_ENABLED=false`
- **则** 系统 SHALL NOT 因为存在 `GITHUB_CLIENT_ID` 或 `GITHUB_CLIENT_SECRET` 而自动启用 GitHub OAuth provider

#### 场景：GitLab 不作为登录授权 provider
- **当** 当前系统初始化认证 provider
- **则** 系统 SHALL NOT 注册 GitLab OAuth/OIDC 登录授权 provider
- **并且** 系统 SHALL NOT 要求 `GITLAB_CLIENT_ID`、`GITLAB_CLIENT_SECRET`、`GITLAB_DISCOVERY_URL` 或 `GITLAB_ALLOWED_GROUPS` 用于当前认证流程

#### 场景：GitLab 项目读取配置
- **当** 系统启用 GitLab 项目读取或导入能力
- **则** 系统 SHALL 使用 `GITLAB_BASE_URL`、`GITLAB_IMPORT_TOKEN` 和可选的 `GITLAB_CA_CERT_FILE` 访问 GitLab 项目内容
- **并且** 系统 SHALL NOT 依赖 GitLab OAuth 登录配置完成项目读取

#### 场景：Docker build context 密钥隔离
- **当** 构建后端 Docker 镜像
- **则** 真实 `backend/.env*` 文件 SHALL NOT 进入 Docker build context
- **并且** `backend/.env*.example` 模板 SHALL 允许保留在 build context 或源码树中
