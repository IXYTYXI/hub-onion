## MODIFIED Requirements

### Requirement: 配置管理
系统 SHALL 实现灵活且安全的配置管理机制，并将真实敏感配置通过环境变量或后端专用 `.env` 文件注入，而不是保存在可提交的 YAML 配置中。

#### Scenario: 环境变量配置
- **WHEN** 系统读取对象存储、JWT、OAuth/OIDC、飞书或 SMTP 等敏感配置
- **THEN** 系统 SHALL 支持从环境变量读取这些配置

#### Scenario: 配置文件
- **WHEN** 系统读取配置文件
- **THEN** 系统 SHALL 从 `backend/config/default.yaml` 和 `backend/config/${GO_ENV}.yaml` 读取安全默认值、结构化配置和非敏感环境差异配置

#### Scenario: 数据库配置保留在 YAML
- **WHEN** 系统读取数据库连接配置
- **THEN** 系统 SHALL 允许 `database.url` 和 `database.max_connections` 保留在 `backend/config/*.yaml`
- **AND** 系统 SHALL NOT 要求将数据库连接串或数据库密码迁移到 `backend/.env.${GO_ENV}`
- **AND** 系统 MAY 继续支持 `DATABASE_URL` 和 `DATABASE_MAX_CONNECTIONS` 作为进程环境变量覆盖

#### Scenario: 后端专用 env 文件
- **WHEN** `backend/.env.${GO_ENV}` 存在
- **THEN** 系统 SHALL 加载该文件中的变量，并用它们覆盖 YAML 配置

#### Scenario: 后端专用 env 文件定位
- **WHEN** 后端从 repo root、`backend/`、`backend/internal/config` 或 Docker 工作目录 `/app/backend` 启动
- **THEN** 系统 SHALL 以实际命中的 `backend/config` 目录父级作为 backend 根目录，并只从该目录读取 `.env.${GO_ENV}`

#### Scenario: 后端专用 env 文件缺失
- **WHEN** `backend/.env.${GO_ENV}` 不存在
- **THEN** 系统 SHALL 继续启动配置加载流程，并允许部署平台或 shell 通过进程环境变量提供配置

#### Scenario: 配置优先级
- **WHEN** 多个配置源存在同一个配置项
- **THEN** 系统 SHALL 遵循优先级：进程环境变量 > `backend/.env.${GO_ENV}` > `backend/config/${GO_ENV}.yaml` > `backend/config/default.yaml` > 默认值

#### Scenario: 根目录前端 env 文件隔离
- **WHEN** 后端加载配置
- **THEN** 系统 SHALL NOT 读取根目录 `.env.test`、`.env.online` 或其他前端 Vite 环境文件作为后端密钥来源

#### Scenario: 超级用户配置
- **WHEN** 系统加载认证相关配置
- **THEN** 系统 SHALL 支持加载按 provider 分层的超级用户配置，并允许通过 provider email 或 subject 精确匹配超级用户
- **AND** 用户邮箱、超级用户邮箱和邮箱域名白名单 SHALL 允许保留在 `backend/config/*.yaml` 中
- **AND** 系统 SHALL NOT 要求将这些邮箱配置迁移到 `backend/.env.${GO_ENV}`

#### Scenario: GitHub provider 显式关闭
- **WHEN** `GITHUB_ENABLED=false`
- **THEN** 系统 SHALL NOT 因为存在 `GITHUB_CLIENT_ID` 或 `GITHUB_CLIENT_SECRET` 而自动启用 GitHub OAuth provider

#### Scenario: GitLab 不作为登录授权 provider
- **WHEN** 当前系统初始化认证 provider
- **THEN** 系统 SHALL NOT 注册 GitLab OAuth/OIDC 登录授权 provider
- **AND** 系统 SHALL NOT 要求 `GITLAB_CLIENT_ID`、`GITLAB_CLIENT_SECRET`、`GITLAB_DISCOVERY_URL` 或 `GITLAB_ALLOWED_GROUPS` 用于当前认证流程

#### Scenario: GitLab 项目读取配置
- **WHEN** 系统启用 GitLab 项目读取或导入能力
- **THEN** 系统 SHALL 使用 `GITLAB_BASE_URL`、`GITLAB_IMPORT_TOKEN` 和可选的 `GITLAB_CA_CERT_FILE` 访问 GitLab 项目内容
- **AND** 系统 SHALL NOT 依赖 GitLab OAuth 登录配置完成项目读取

#### Scenario: Docker build context 密钥隔离
- **WHEN** 构建后端 Docker 镜像
- **THEN** 真实 `backend/.env*` 文件 SHALL NOT 进入 Docker build context
- **AND** `backend/.env*.example` 模板 SHALL 允许保留在 build context 或源码树中
