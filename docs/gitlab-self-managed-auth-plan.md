# 私有部署 GitLab 授权接入计划

## 1. 背景与目标

当前仓库的认证链路分成两部分：

- 现有文档与历史实现主线：`Convex Auth + GitHub OAuth + API Token`
- 正在推进的 Go 后端：`Gin + PostgreSQL + JWT Session + API Token`

从代码现状看，Web 登录、CLI 登录和 API Token 的核心协议已经基本成型：

- Web 端通过浏览器登录，服务端签发 `clawhub_session` Cookie。
- CLI 通过浏览器打开 `/cli/auth` 页面，由已登录的 Web 会话创建 API Token，再回传给本地 loopback。
- API 侧通过 `Bearer <token>` 或 `clawhub_session` 完成鉴权。

因此，本次“接入私有部署 GitLab 进行授权”的关键，不是重写 CLI 协议，而是把当前“写死 GitHub 的提供商逻辑”改造成“可插拔身份提供商逻辑”，并在 Go 后端优先接入 GitLab Self-Managed。

本文目标：

- 明确 GitLab 私有部署接入的推荐方案
- 明确 GitLab 管理端需要做的配置
- 评估与当前系统的适配成本与风险
- 输出可执行的实施计划

## 2. 结论摘要

### 2.1 可行性结论

**可行，且建议优先采用 OIDC（OpenID Connect）方式接入 GitLab Self-Managed。**

原因：

- GitLab Self-Managed 原生支持作为 OAuth 2.0 / OIDC 身份提供方。
- GitLab 提供标准发现地址 `/.well-known/openid-configuration`，便于对接标准 OIDC 客户端。
- OIDC 可直接返回标准身份声明：`sub`、`preferred_username`、`name`、`email`、`picture`，比当前 GitHub 的定制逻辑更标准。
- CLI 当前登录协议与上游 OAuth 提供商解耦，改造成本主要集中在 Web 登录与用户映射层。

### 2.2 推荐方案

推荐采用：

1. **Go 后端统一承接认证**
2. **新增 GitLab OIDC Provider**
3. **保留现有 Session Cookie + API Token 机制**
4. **前端和 CLI 尽量不改协议，只改登录入口和文案**

不推荐：

- 在前端直接做 GitLab OAuth/OIDC，再把结果回传后端
- 继续在 `AuthService` 中按 `if provider == github` 的方式堆分支
- 为 GitLab Self-Managed 走非标准、硬编码 API 地址的“伪 OAuth”实现

## 3. 当前系统现状分析

### 3.1 认证链路现状

当前 Go 后端已有这些能力：

- `backend/internal/handler/auth.go`
  - `/auth/github`
  - `/auth/github/callback`
  - `/auth/logout`
- `backend/internal/service/auth_service.go`
  - GitHub OAuth URL 构造
  - code 换 token
  - 拉取 GitHub 用户信息
  - 用户 upsert
  - JWT 签发/解析
- `backend/internal/middleware/auth.go`
  - 同时支持 Session JWT 和 CLI API Token
- `backend/internal/handler/user.go`
  - `/api/v1/users/me/tokens` 创建/列出/吊销 CLI Token
- `src/routes/cli/auth.tsx`
  - 已登录 Web 用户可创建 CLI Token 并回传本地 CLI

### 3.2 当前实现的主要限制

1. **认证提供商耦合严重**
   - `AuthService` 内部字段和方法直接写死 GitHub。
   - 用户模型也直接有 `GithubID`。

2. **用户身份模型不够通用**
   - 当前 `backend/internal/model/user.go` 只有 `GithubID`，没有通用的外部身份表或 provider + subject 模型。

3. **前端登录入口默认邮箱/密码**
   - 当前 `/auth/login` 页面主流程是邮箱登录，不是 OAuth 入口聚合页。
   - Header 的 `Sign in` 只是跳转到 `/auth/login`。

4. **仓库旧文档仍以 GitHub/Convex 为主**
   - 需要补齐新的认证架构文档，避免后续接入时认知冲突。

## 4. 目标架构建议

### 4.1 推荐目标形态

```text
Browser / CLI
     |
     v
ClawHub Frontend
     |
     v
ClawHub Go Backend
     |
     +--> GitLab Self-Managed (OIDC)
     |
     +--> PostgreSQL users / auth_identities / api_tokens
```

核心原则：

- GitLab 只负责“身份认证”
- ClawHub 自己负责“本地用户、角色、会话、API Token、权限”
- CLI 继续只认 ClawHub 自己签发的 API Token，不直接持有 GitLab Access Token

### 4.2 建议的用户与身份模型

建议把当前 `users + github_id` 结构改为：

#### `users`

- `id`
- `handle`
- `display_name`
- `email`
- `avatar_url`
- `role`
- `status`
- `last_login_at`

#### `auth_identities`

- `id`
- `user_id`
- `provider`，例如 `gitlab`
- `provider_subject`，对应 OIDC `sub`
- `provider_username`，对应 `preferred_username`
- `provider_email`
- `provider_avatar_url`
- `raw_claims`，可选
- `created_at`
- `updated_at`

这样后续可以同时支持：

- GitLab Self-Managed
- GitHub
- 邮箱登录
- 未来企业 SSO

而不是继续在 `users` 表上叠加 `github_id`、`gitlab_id`、`google_id` 这类字段。

## 5. GitLab Self-Managed 推荐接入方式

### 5.1 方案对比

#### 方案 A：GitLab OAuth 2.0 + 调 `/api/v4/user`

优点：

- 逻辑直观
- 与当前 GitHub 实现最接近

缺点：

- 需要自己维护 provider endpoint
- 用户资料字段依赖 GitLab API，不够标准
- 后续加 PKCE、用户声明、群组 claim 时不如 OIDC 顺滑

#### 方案 B：GitLab OIDC

优点：

- 标准协议，适合长期维护
- 可通过发现文档自动读取授权、token、userinfo、jwks 地址
- 标准 claims 更适合统一多 provider 架构
- 后续如要做群组映射、企业 SSO 扩展，边界更清楚

缺点：

- 需要在后端增加 OIDC 客户端逻辑
- 比当前 GitHub 手写 OAuth 略多一层抽象

### 5.2 推荐结论

**推荐方案 B：GitLab OIDC。**

对于私有部署 GitLab，这条路径最稳妥，且与后续“认证层抽象化”方向一致。

## 6. GitLab 管理端配置说明

以下步骤基于 GitLab 官方文档整理，适用于 GitLab Self-Managed。

### 6.1 前置条件

- GitLab 实例必须可被 ClawHub 后端访问
- 生产环境必须使用 HTTPS
- 需要 GitLab 管理员权限

### 6.2 在 GitLab 中创建 OAuth/OIDC 应用

推荐使用 **Instance-wide application**。

原因：

- 不依赖某个普通用户账号
- 适合企业统一接入
- 可由管理员统一维护

GitLab 管理端操作：

1. 进入 `Admin`
2. 打开 `Applications`
3. 创建 `New application`
4. 配置应用名称，例如 `ClawHub`
5. 配置 Redirect URI
6. 勾选需要的 scopes
7. 保存并记录 `Application ID` 和 `Secret`

### 6.3 Redirect URI 建议

开发环境：

```text
http://localhost:8080/auth/gitlab/callback
```

生产环境：

```text
https://<your-backend-domain>/auth/gitlab/callback
```

如果前后端同域反向代理，也可以是：

```text
https://<your-site-domain>/auth/gitlab/callback
```

### 6.4 推荐 scopes

最小推荐：

- `openid`
- `profile`
- `email`

说明：

- `openid`：启用 OIDC 登录
- `profile`：获取用户名、昵称、头像、资料
- `email`：获取主邮箱

除非后续真的要访问 GitLab 项目/仓库 API，否则**不建议一开始申请 `api` 或 `read_api`**，避免权限过大。

### 6.5 是否勾选 Trusted

如果使用 GitLab Self-Managed 的 **instance-wide application**，建议标记为 **trusted**。

影响：

- GitLab 文档说明，trusted 应用可以跳过用户授权确认页
- 企业内部场景体验更好

前提：

- 这是你们自己控制的内部系统
- 已完成安全评审

### 6.6 发现地址与关键端点

GitLab Self-Managed 的 OIDC 发现地址为：

```text
https://<your-gitlab-instance>/.well-known/openid-configuration
```

后端应优先从该发现地址读取：

- authorization endpoint
- token endpoint
- userinfo endpoint
- jwks uri

不建议把这些 endpoint 写死在配置中，除非是离线环境或 GitLab 有特殊代理改写。

### 6.7 GitLab 侧配置检查清单

- GitLab 外网/内网 DNS 可达
- TLS 证书有效
- ClawHub 后端能访问 GitLab 发现地址和 token/userinfo 端点
- OAuth Application 的 redirect URI 与后端实际地址完全一致
- scopes 至少包含 `openid profile email`
- 已保存 client ID / client secret
- 如果走 trusted 模式，已确认该应用由管理员创建并维护

## 7. ClawHub 侧改造建议

### 7.1 后端改造

#### 第一层：配置层

新增配置建议：

- `auth.gitlab.enabled`
- `auth.gitlab.base_url`
- `auth.gitlab.client_id`
- `auth.gitlab.client_secret`
- `auth.gitlab.discovery_url`
- `auth.gitlab.scopes`

建议约定：

- `discovery_url` 可选，默认由 `base_url + '/.well-known/openid-configuration'` 推导

#### 第二层：认证抽象层

建议新增接口：

```text
type IdentityProvider interface {
  Name() string
  BuildAuthURL(state, nonce, redirectURI string) (string, error)
  ExchangeCode(ctx, code, redirectURI string) (TokenSet, error)
  FetchIdentity(ctx, tokenSet TokenSet) (ExternalIdentity, error)
}
```

其中 `ExternalIdentity` 建议统一包含：

- `Provider`
- `Subject`
- `Username`
- `DisplayName`
- `Email`
- `AvatarURL`
- `EmailVerified`
- `RawClaims`

#### 第三层：用户绑定与会话层

建议流程：

1. 用户访问 `/auth/gitlab`
2. 后端生成 `state`、`nonce` 并重定向到 GitLab
3. GitLab 回调 `/auth/gitlab/callback`
4. 后端换取 token，并取回 identity claims
5. 通过 `provider + subject` 查找 `auth_identities`
6. 没找到则创建用户并绑定 identity
7. 签发 ClawHub 自己的 Session JWT
8. 写入 `clawhub_session` Cookie
9. 跳回前端

#### 第四层：数据库层

建议最少做两步迁移：

1. 新建 `auth_identities` 表
2. 为 `users` 补充通用登录字段，并逐步废弃 `github_id`

### 7.2 前端改造

前端不需要理解 GitLab OAuth 细节，只需要提供入口。

建议改造：

- `/auth/login`
  - 调整为“登录方式选择页”
  - 支持“使用 GitLab 登录”
  - 如保留邮箱登录，则放为次级选项
- `Header`
  - `Sign in` 按钮跳转 `/auth/login`
  - 按需显示“使用企业 GitLab 登录”等文案
- `/cli/auth`
  - 基本无需协议改动
  - 当用户未登录时，按钮从“Sign in”跳转到新的登录方式页

### 7.3 CLI 改造

CLI 主协议预计无需变更。

当前 CLI 只依赖：

- 打开浏览器到 `<site>/cli/auth?...`
- Web 端用户已登录
- `/users/me/tokens` 能创建 token

因此只要 Web 登录成功后还能创建 API Token：

- `clawhub login`
- `clawhub whoami`
- `clawhub publish`
- `clawhub delete`

理论上都可以保持兼容。

CLI 仅建议补两点：

1. registry discovery 文档中增加登录提供商说明，便于未来展示文案
2. 故障提示从“GitHub 登录失败”改为更中性的“浏览器登录失败”

## 8. 授权与权限边界设计建议

### 8.1 建议区分“认证”和“授权”

这次接入 GitLab 时，需要避免把“谁能登录”和“登录后能做什么”混在一起。

建议拆成两层：

- **认证**：是否能通过 GitLab 证明身份
- **授权**：该身份在 ClawHub 内部拥有什么角色和能力

### 8.2 推荐的授权策略

Phase 1 建议简单可控：

- 能通过指定 GitLab 实例登录的用户，默认都可创建本地账号
- ClawHub 内部角色仍由本地数据库维护：`user` / `moderator` / `admin`

如果你们想限制只有特定 GitLab 组成员能登录，可加一层组校验：

- 从 OIDC `userinfo` 或 claim 中读取 `groups`
- 配置允许组列表，例如 `platform/clawhub-users`
- 非允许组成员拒绝登录

这个能力可作为 Phase 1.5 或 Phase 2。

### 8.3 组授权的可行性

GitLab OIDC 文档说明，`userinfo`/claims 可包含 group 相关信息。  
因此，从协议能力上看，“按 GitLab Group 控制登录”是**可行的**。

但要注意：

- group path 变更需要同步影响配置
- 嵌套组、祖先组、直接成员组的语义要先约定
- 不同 GitLab 版本的 group claims 细节可能存在差异，应在目标实例上先做联调验证

## 9. 可行性评估

### 9.1 技术可行性

**高。**

原因：

- GitLab Self-Managed 原生支持 OAuth 2.0 / OIDC
- 现有系统的 Session / API Token / CLI 协议可复用
- 当前 Go 后端已经具备 OAuth callback、JWT、用户 upsert 的基本骨架

### 9.2 研发成本评估

**中等。**

主要成本不在“接 GitLab”本身，而在“把现有认证层做对”。

粗略拆分：

- 认证抽象重构：中
- 数据模型迁移：中
- GitLab OIDC 接入：中
- 前端登录页改造：低
- CLI 兼容验证：低
- 联调与部署验证：中

### 9.3 风险评估

#### 风险 1：当前用户模型写死 GitHub

影响：

- 若继续在 `users` 表上补 `gitlab_id`，后续会越来越难维护

建议：

- 在接入 GitLab 前先引入 `auth_identities`

#### 风险 2：私有 GitLab 网络与证书问题

影响：

- 本地开发和测试环境可能无法稳定访问 GitLab 实例
- 自签证书、私有 CA 常导致 token/userinfo 交换失败

建议：

- 在正式开发前先完成网络连通性与 TLS 验证

#### 风险 3：把 GitLab token 暴露给前端或 CLI

影响：

- 增加泄漏面和权限风险

建议：

- GitLab Access Token 只在后端短暂使用
- ClawHub 对外统一只发自己的 Session/JWT/API Token

#### 风险 4：将来多提供商接入时协议继续分叉

影响：

- GitHub、GitLab、邮箱登录各自一套 handler/service，后续难维护

建议：

- 本次就把 Provider 抽象一次做完整

### 9.4 业务可行性

**高。**

如果你们的目标是：

- 仅接入企业内部 GitLab
- 用它完成统一登录
- 后续再决定是否做组授权/同步更多 GitLab 信息

那么当前方案完全匹配，且不会破坏 CLI 兼容性。

## 10. 实施计划

### Phase 0：验证与准备

目标：先确认外部依赖条件没问题。

任务：

- 确认目标 GitLab 版本
- 确认 GitLab 实例访问地址、TLS 证书、DNS、网络路由
- 由管理员创建测试 OAuth/OIDC 应用
- 用发现地址和测试 code flow 验证能拿到 `sub/name/email/picture`

交付物：

- 一份联调记录
- 一组可用测试凭证

### Phase 1：认证层抽象

目标：把当前后端认证从“GitHub 定制实现”升级为“Provider 抽象”。

任务：

- 抽象 `IdentityProvider`
- 重构 `AuthService`
- 引入 `auth_identities` 表
- 调整用户 upsert/绑定逻辑

交付物：

- 后端认证框架支持多 provider

### Phase 2：接入 GitLab OIDC

目标：完成 GitLab Self-Managed 登录闭环。

任务：

- 新增 `/auth/gitlab`
- 新增 `/auth/gitlab/callback`
- 对接 discovery / authorize / token / userinfo
- 写入本地 session

交付物：

- 浏览器端可通过 GitLab 登录

### Phase 3：前端与 CLI 对齐

目标：把登录入口与用户体验补齐。

任务：

- 调整 `/auth/login` 页面
- 更新 Header 文案
- 验证 `/cli/auth` 和 API Token 创建流程
- 更新相关文档

交付物：

- Web/CLI 登录体验一致

### Phase 4：授权增强（可选）

目标：按 GitLab Group 做准入控制。

任务：

- 增加允许组配置
- 登录时校验 group claims
- 输出拒绝原因与后台日志

交付物：

- 只有指定 GitLab 组成员可登录

## 11. 建议的验收标准

### 基础验收

- 用户可通过私有 GitLab 登录 Web
- 登录后可获取 `/api/v1/users/me`
- 可创建和吊销 API Token
- CLI 浏览器登录仍可成功
- 登出后 `clawhub_session` 失效

### 安全验收

- 回调流程校验 `state`
- 如走 OIDC，校验 `nonce`
- 生产环境强制 HTTPS
- GitLab `client_secret` 仅保存在后端配置
- ClawHub 不把 GitLab access token 返回给前端/CLI

### 数据验收

- 同一 GitLab 账号重复登录不会创建重复用户
- GitLab 用户名或头像变化后可同步到本地
- 用户禁用/删除策略与本地 `status` 语义清晰

## 12. 当前阶段建议

如果你们现在要“先定方案再落地”，建议顺序是：

1. **先确认目标 GitLab 实例信息**
   - 域名
   - 版本
   - 是否自签 CA
   - 是否能使用 OIDC discovery

2. **先做认证模型重构设计**
   - 优先确认 `auth_identities` 是否接受

3. **再接 GitLab OIDC**
   - 不建议直接在现有 GitHub 代码上硬改

4. **最后补文档和联调清单**

## 13. 需要你补充确认的信息

进入实现前，建议补齐以下信息：

1. 目标 GitLab 实例地址
2. GitLab 版本号
3. 是否要求“只有特定组成员可登录”
4. 是否保留当前邮箱登录
5. 是否还要继续保留 GitHub 登录并行存在
6. 生产环境证书是否为公共 CA，还是企业内网自签

## 14. 参考资料

以下为本次评估参考的 GitLab 官方文档：

- GitLab OAuth Provider:
  - https://docs.gitlab.com/integration/oauth_provider/
- GitLab OIDC Provider:
  - https://docs.gitlab.com/integration/openid_connect_provider/
- GitLab OAuth 2.0 API:
  - https://docs.gitlab.com/api/oauth2/
- GitLab OIDC/OAuth Test Guide:
  - https://docs.gitlab.com/administration/auth/test_oidc_oauth/

## 15. 最终建议

基于当前仓库状态，**“Go 后端统一认证 + GitLab Self-Managed OIDC + 本地 Session/API Token 复用”** 是最稳妥的方案。

它的优势是：

- 改动集中在后端认证层，不会冲击 CLI 协议
- 能兼容你们正在推进的 Go 后端迁移
- 为后续多 provider、企业组授权、SSO 扩展留出空间

下一步如果你认可这份计划，建议直接进入：

- 认证模型设计
- 数据库迁移设计
- GitLab OIDC 接入详细任务拆分

