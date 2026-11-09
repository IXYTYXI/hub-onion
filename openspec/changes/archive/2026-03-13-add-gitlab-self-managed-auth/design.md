## Context

当前仓库的认证实现处于过渡状态：

- Go 后端已经提供 GitHub OAuth、邮箱登录、JWT Session、API Token 等能力，但认证核心逻辑仍集中在 [`backend/internal/service/auth_service.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/service/auth_service.go) 中，且字段与方法都直接耦合 GitHub。
- 用户模型仍保留 `github_id` 与 `auth_provider` 这样的单 provider 痕迹，定义位于 [`backend/internal/model/user.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/model/user.go)。
- 鉴权中间件已经支持 `clawhub_session` 和 CLI API Token 双通路，见 [`backend/internal/middleware/auth.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/middleware/auth.go)。
- 前端登录页当前是邮箱登录主流程，位于 [`src/routes/auth/login.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/auth/login.tsx)，而 CLI 登录承接页 [`src/routes/cli/auth.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/cli/auth.tsx) 实际只依赖“用户已登录且可创建 API Token”。

这意味着本次变更不是单纯新增 `/auth/gitlab` 路由，而是要在不破坏既有 Session / API Token / CLI 登录协议的前提下，把认证层从 GitHub 定制实现升级为可扩展 provider 架构。

## Goals / Non-Goals

**Goals:**

- 支持私有部署 GitLab 通过 OIDC 完成浏览器登录。
- 登录成功后继续签发 ClawHub 自己的 Session JWT，而不是复用 GitLab Access Token 作为平台会话。
- 继续复用现有 `/api/v1/users/me`、`/api/v1/users/me/tokens` 和 `/cli/auth` 协议。
- 将用户身份模型从 `users.github_id` 演进到独立的外部身份映射模型。
- 为 GitHub、GitLab、邮箱登录并存提供统一的后端抽象。

**Non-Goals:**

- 不让 CLI 直接接入 GitLab OIDC。
- 不实现 GitLab 仓库、项目、Group API 的业务集成。
- 不在本次引入 SAML、LDAP 或多 GitLab 实例管理。
- 不要求前端直接处理 OIDC token 或保存第三方 provider token。

## Decisions

### 决策 1：采用“Provider 抽象 + IdentityService + SessionService”分层结构

现状问题是 `AuthService` 同时承担第三方登录、邮箱登录、用户绑定和 Session 签发，职责过于混杂。继续在同一类中新增 `GitLabOAuthURL()`、`ExchangeGitLabCode()` 只会让认证逻辑进一步膨胀。

设计上将拆分为：

- `IdentityProvider`
  - 对接第三方 provider
  - 负责 `BuildAuthURL`、`ExchangeCode`、`FetchIdentity`
- `ProviderRegistry`
  - 根据 provider 名称返回实例
- `IdentityService`
  - 将 `provider + subject` 绑定到本地用户
- `SessionService`
  - 负责 Session JWT 的签发、校验与 Cookie 策略
- `EmailAuthService`
  - 保留邮箱注册/登录逻辑，不与第三方 provider 混在一起

备选方案是继续在现有 `AuthService` 上叠加 GitLab 分支。该方案改动初期较快，但会让 GitHub、GitLab、邮箱逻辑继续相互缠绕，因此不采用。

### 决策 2：GitLab Self-Managed 优先采用 OIDC，而不是 GitLab OAuth + `/api/v4/user`

当前需求是企业内私有部署 GitLab 登录。OIDC 的优势在于：

- 可通过 discovery 自动读取 endpoint
- 提供标准 claims：`sub`、`preferred_username`、`name`、`email`、`picture`
- 更容易抽象为通用 provider

备选方案是仿照 GitHub 现状手写 OAuth code flow 后调用 `/api/v4/user`。该方案实现接近当前 GitHub 代码，但标准化程度较差，也不利于未来扩展，因此不采用。

### 决策 3：新增 `auth_identities` 表，而不是继续扩展 `users` 主表

当前 [`backend/internal/database/migrations/000005_create_users_table.up.sql`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/database/migrations/000005_create_users_table.up.sql) 和 [`backend/internal/database/migrations/000009_email_auth.up.sql`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/database/migrations/000009_email_auth.up.sql) 已经表明 `users` 既承载 GitHub 字段，又承载邮箱登录字段，主表职责过重。

设计上新增：

- `auth_identities`
  - `user_id`
  - `provider`
  - `provider_subject`
  - `provider_username`
  - `provider_email`
  - `provider_avatar_url`
  - `raw_claims`
  - `last_login_at`

本地用户基础信息仍由 `users` 保存，外部身份由 `auth_identities` 维护。

备选方案是在 `users` 表上继续增加 `gitlab_id`、`gitlab_username` 等字段。该方案会让模型继续恶化，因此不采用。

### 决策 4：保留现有 Session / API Token / CLI 协议

当前 [`backend/internal/middleware/auth.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/middleware/auth.go) 已经实现：

- 优先解析 Session JWT
- 失败后再解析 API Token

当前 [`packages/clawdhub/src/browserAuth.ts`](/Users/logo/self_repo/claw_case/clawhub/packages/clawdhub/src/browserAuth.ts) 和 [`src/routes/cli/auth.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/cli/auth.tsx) 已经形成稳定协议：

- 浏览器已登录
- 创建平台 API Token
- 回传 loopback

因此设计上保持：

- GitLab 登录成功后仍由 ClawHub 签发 `clawhub_session`
- CLI 继续只拿 ClawHub API Token
- `/api/v1/users/me/tokens` 行为不变

备选方案是让 CLI 直接获取 GitLab Access Token。该方案会把第三方 token 暴露给本地环境，也会破坏现有命令实现，因此不采用。

### 决策 5：前端登录入口改为“统一入口页”，但保留邮箱流程作为兼容入口

[`src/routes/auth/login.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/auth/login.tsx) 当前是邮箱登录页。为了接入 GitLab Self-Managed 且兼容企业场景，需要改成统一入口页：

- 主入口：GitLab 登录
- 次入口：邮箱登录/注册/激活

这样不会破坏 Header 和 `/cli/auth` 当前都跳 `/auth/login` 的行为，只需调整页面内容和跳转方式。

备选方案是新增单独 `/auth/gitlab-login` 页面。该方案会导致入口分散，CLI 未登录兜底也需要改协议，因此不采用。

## Risks / Trade-offs

- [数据迁移复杂度] `users.github_id` 已存在历史语义，直接切换风险高
  → 先新增 `auth_identities`，回填 GitHub 历史数据，代码切换后再考虑删除旧字段

- [私有 GitLab 网络与证书问题] Self-Managed 环境常见私有 CA、反向代理和非标准域名
  → 配置层预留 discovery URL / CA 配置，联调前先验证网络与 TLS

- [认证层重构范围较广] 后端配置、服务、handler、模型和迁移都会被触及
  → 优先维持现有 Session / API Token 接口不变，把影响集中在认证内部实现

- [GitHub/邮箱兼容风险] 引入 provider 抽象后，现有 GitHub 与邮箱流程也会受影响
  → GitHub Provider 也统一接入新抽象，邮箱逻辑单独拆分，并保留回归测试

- [前端体验切换风险] 当前登录页以邮箱为主，改成统一入口页后交互会变化
  → 在统一入口页保留邮箱子流程，避免已有使用方式彻底消失

## Migration Plan

1. 新增 `auth_identities` 表和 `users.last_login_at` 等字段。
2. 回填已有 GitHub 用户到 `auth_identities`，`provider='github'`，`provider_subject=github_id::text`。
3. 引入 provider 抽象和 `IdentityService`，先让 GitHub 登录也走新流程。
4. 接入 GitLab OIDC Provider，新增 `/auth/gitlab` 和 `/auth/gitlab/callback`。
5. 调整 `/auth/login` 为统一登录入口页，保留邮箱登录子流程。
6. 验证 `/api/v1/users/me`、`/api/v1/users/me/tokens`、`/cli/auth`、CLI 登录与常用命令兼容。
7. GitLab provider 以配置开关控制启用；若联调异常，可禁用 GitLab provider 并回退到现有 GitHub/邮箱登录。

## Open Questions

- 是否需要在首版就按 GitLab Group 限制登录用户，还是仅保留配置位，后续再启用？
- 生产环境目标 GitLab 是否使用私有 CA；如果是，证书加载策略需要在实现前确认。
- 是否要在本次同步保留 GitHub 登录作为正式可用 provider，还是仅保留兼容代码路径？
