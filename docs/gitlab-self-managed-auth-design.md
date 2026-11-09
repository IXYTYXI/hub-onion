# 私有部署 GitLab 授权接入技术设计方案

## 1. 设计目标

本文档基于当前代码现状，给出“Go 后端统一认证 + GitLab Self-Managed OIDC + 本地 Session/API Token 复用”的详细技术设计。

设计目标：

1. 在不破坏现有 CLI 登录协议的前提下接入 GitLab Self-Managed
2. 基于当前代码重构认证层，而不是推翻重来
3. 为未来并存 GitHub / GitLab / 邮箱登录预留扩展结构

## 2. 当前实现分析

### 2.1 现状一：`AuthService` 是 GitHub 专用服务

当前 `backend/internal/service/auth_service.go` 的关键问题：

- `AuthService` 字段直接声明 `githubClientID` / `githubClientSecret`
- `GitHubOAuthURL()`、`ExchangeCode()`、`FetchGitHubUser()` 直接写死 GitHub endpoint
- `UpsertUser()` 直接依赖 `github_id`

结论：

- 当前服务不是“认证服务”，而是“GitHub 登录服务 + 邮箱服务 + JWT 服务”的混合体
- 如果继续按这个结构堆 GitLab，会迅速失控

### 2.2 现状二：Handler 层路由已具备承接多 Provider 的基本形态

`backend/internal/handler/routes.go` 目前已有独立 `/auth/*` 路由组：

- `/auth/github`
- `/auth/github/callback`
- `/auth/login`
- `/auth/register`
- `/auth/activate`
- `/auth/logout`

结论：

- 路由层具备自然扩展点
- 可以按 provider 新增 `/auth/gitlab` 和 `/auth/gitlab/callback`

### 2.3 现状三：前端登录态依赖本地 Session，而不是依赖 GitHub

`src/lib/useAuthStatus.ts` 通过 `/api/v1/users/me` 判断登录态；  
`src/lib/apiClient.ts` 所有请求默认带 Cookie。

结论：

- 只要后端最终写入 `clawhub_session`，前端主逻辑几乎无需协议改造

### 2.4 现状四：CLI 登录协议已经是“平台 token 协议”

`packages/clawhub/src/browserAuth.ts` 和 `src/routes/cli/auth.tsx` 表明：

- CLI 只需要 Web 用户已登录
- CLI 最终获取的是平台 API Token

结论：

- GitLab 接入不会要求 CLI 感知 OAuth provider

## 3. 总体设计

### 3.1 目标架构

```text
                        +----------------------+
                        | GitLab Self-Managed  |
                        |  OIDC Provider       |
                        +----------+-----------+
                                   ^
                                   |
                     authorize/token/userinfo/jwks
                                   |
+---------+      session cookie    |      +----------------------+
| Browser | <----------------------+----> | ClawHub Go Backend   |
| / CLI   |                         |      | auth providers       |
+----+----+                         |      | session + api token  |
     |                              |      +----------+-----------+
     | /cli/auth                    |                 |
     v                              |                 v
+------------------+                |      +----------------------+
| Frontend Routes   |                |      | PostgreSQL           |
| /auth/login       |                |      | users                |
| /cli/auth         |                |      | auth_identities      |
| app pages         |                |      | api_tokens           |
+------------------+                |      +----------------------+
```

### 3.2 核心设计原则

1. GitLab 只负责认证，不负责平台会话
2. ClawHub 自己签发 Session JWT 和 API Token
3. 认证 Provider 必须可插拔
4. 用户主表与外部身份表必须解耦
5. 不修改 CLI loopback 协议

## 4. 模块设计

## 4.1 配置层设计

### 当前问题

`backend/internal/config/config.go` 当前只有：

- `GitHubClientID`
- `GitHubClientSecret`
- `JWTSecret`
- `FrontendURL`
- `AllowedEmailDomains`

无法承载 GitLab Self-Managed 的基础地址、discovery、scope 等配置。

### 设计方案

重构 `AuthConfig`：

```go
type AuthConfig struct {
  JWTSecret   string
  FrontendURL string
  Session     SessionConfig
  Email       EmailAuthConfig
  Providers   ProviderConfig
}

type ProviderConfig struct {
  GitLab GitLabProviderConfig
  GitHub GitHubProviderConfig
}

type GitLabProviderConfig struct {
  Enabled      bool
  BaseURL      string
  DiscoveryURL string
  ClientID     string
  ClientSecret string
  Scopes       []string
  TrustedProxy bool
  AllowedGroups []string
}
```

建议新增环境变量：

- `GITLAB_ENABLED`
- `GITLAB_BASE_URL`
- `GITLAB_DISCOVERY_URL`
- `GITLAB_CLIENT_ID`
- `GITLAB_CLIENT_SECRET`
- `GITLAB_SCOPES`
- `GITLAB_ALLOWED_GROUPS`

### 设计结论

- 当前配置结构要升级为“认证总配置 + provider 子配置”
- 不建议继续在顶层堆 `GitLabClientID`、`GitHubClientID` 这种平铺字段

## 4.2 Provider 抽象设计

### 当前问题

`AuthService` 同时负责：

- 生成 GitHub 授权地址
- 交换 code
- 拉用户资料
- 用户创建/更新
- JWT 签发
- 邮箱登录

这导致职责严重混杂。

### 目标拆分

建议拆成以下组件：

#### `IdentityProvider`

负责与外部身份提供方通信。

```go
type IdentityProvider interface {
  Name() string
  BuildAuthURL(input AuthRequestInput) (AuthRedirect, error)
  ExchangeCode(ctx context.Context, input ExchangeCodeInput) (*ExternalTokenSet, error)
  FetchIdentity(ctx context.Context, tokenSet *ExternalTokenSet) (*ExternalIdentity, error)
}
```

#### `ProviderRegistry`

按名称获取 provider：

```go
type ProviderRegistry interface {
  Get(name string) (IdentityProvider, bool)
}
```

#### `IdentityService`

负责本地用户绑定逻辑：

- 根据 `provider + subject` 查找 identity
- identity 不存在时创建用户并绑定
- identity 存在时同步用户资料

#### `SessionService`

负责：

- Session JWT 签发/校验
- Session Cookie 策略

#### `EmailAuthService`

邮箱注册/激活/登录仍单独保留，不再与第三方 Provider 混在同一个大类里。

### 设计结论

要做的不是在 `AuthService` 中再新增 `GitLabOAuthURL()`，而是把 `AuthService` 重构为：

- Provider 接入层
- 身份绑定层
- Session 层
- 邮箱登录层

## 4.3 GitLab Provider 设计

### 推荐协议

优先采用 **OIDC Authorization Code Flow**。

### 输入配置

- base URL
- discovery URL
- client ID
- client secret
- scopes：默认 `openid profile email`

### 关键行为

#### 1. 发现配置

服务启动时或首次请求时，通过：

```text
https://<gitlab>/.well-known/openid-configuration
```

获取：

- authorization endpoint
- token endpoint
- userinfo endpoint
- jwks uri

#### 2. 生成授权地址

参数至少包括：

- `client_id`
- `redirect_uri`
- `response_type=code`
- `scope`
- `state`
- `nonce`

#### 3. code 换 token

后端回调后调用 token endpoint 获取：

- access token
- id token（如有）
- token type
- expires in

#### 4. 读取身份

优先从 `userinfo` 获取：

- `sub`
- `preferred_username`
- `name`
- `email`
- `picture`
- `groups`（如后续启用）

#### 5. 归一化输出

统一转换成：

```go
type ExternalIdentity struct {
  Provider        string
  Subject         string
  Username        string
  DisplayName     string
  Email           string
  AvatarURL       string
  EmailVerified   *bool
  Groups          []string
  RawClaims       map[string]any
}
```

## 4.4 数据模型设计

### 当前问题

当前 `users` 表依然承载 provider 特定字段：

- `github_id`
- `auth_provider`

这个模型无法优雅支持多 provider。

### 目标模型

#### `users`

保留本地平台用户语义：

```sql
users (
  id uuid pk,
  handle text unique not null,
  display_name text not null default '',
  email text not null default '',
  avatar_url text not null default '',
  bio text not null default '',
  role text not null default 'user',
  status text not null default 'active',
  password_hash text not null default '',
  activation_code text null,
  activation_expires_at timestamptz null,
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

#### `auth_identities`

新增外部身份映射表：

```sql
auth_identities (
  id uuid pk default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  provider_subject text not null,
  provider_username text not null default '',
  provider_email text not null default '',
  provider_avatar_url text not null default '',
  raw_claims jsonb,
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_subject)
)
```

推荐索引：

- `unique(provider, provider_subject)`
- `index(user_id)`
- `index(provider, provider_username)`

### 兼容迁移策略

由于当前数据模型已经存在，推荐分阶段迁移：

#### Migration 1

- 新建 `auth_identities`
- 为 `users` 增加 `last_login_at`

#### Migration 2

- 把 `users.github_id` 中已有历史数据回填进 `auth_identities`
- `provider='github'`
- `provider_subject=github_id::text`

#### Migration 3

- 保留 `github_id` 一段时间用于兼容读取
- 完成代码切换后，再在后续版本移除

### 设计结论

不建议本次直接删除 `github_id`。  
建议先引入 `auth_identities`，完成灰度迁移后再考虑清理旧字段。

## 4.5 本地用户绑定设计

### 核心流程

输入：`ExternalIdentity`

处理顺序：

1. 通过 `provider + subject` 查询 `auth_identities`
2. 如果命中：
   - 加载对应 `users`
   - 同步 displayName / email / avatar
   - 更新 identity 的 username/email/avatar/raw_claims/last_login_at
3. 如果未命中：
   - 生成唯一 handle
   - 创建 `users`
   - 创建 `auth_identities`
4. 更新 `users.last_login_at`
5. 返回本地 user

### Handle 生成策略

继续复用当前 `uniqueHandle()` 逻辑，但输入优先级建议改为：

1. GitLab `preferred_username`
2. GitLab `nickname`
3. GitLab `name` 规范化
4. 默认回退 `user`

### 用户资料同步策略

建议每次第三方登录成功都同步以下字段：

- `display_name`
- `email`
- `avatar_url`

但以下字段不自动同步：

- `role`
- `status`
- `bio`

## 4.6 Session 设计

### 当前现状

当前 `IssueJWT()` / `ParseJWT()` 已可工作。  
`middleware/auth.go` 已先尝试 Session JWT，再尝试 API Token。

### 延续方案

保持现有机制，但建议补充：

- `iat`
- `iss`
- `aud`
- `provider`

Cookie 建议策略：

- 名称仍为 `clawhub_session`
- `HttpOnly=true`
- `SameSite=Lax`
- 生产环境 `Secure=true`

### 登出设计

继续复用 `/auth/logout`：

- 清空 Cookie
- 不必调用 GitLab logout

这样可以避免把平台会话与外部 IdP 会话耦死。

## 4.7 API Token 设计

### 当前结论

`backend/internal/handler/user.go` 和 `backend/internal/middleware/auth.go` 的 API Token 体系已经满足需求。

本次设计要求：

- 不改 token 格式
- 不改 token hash 存储方式
- 不改 Bearer Token 鉴权入口

只需要保证：

- GitLab 登录后的本地用户同样能创建和使用 API Token

## 4.8 Handler 设计

### 目标路由

新增：

- `GET /auth/gitlab`
- `GET /auth/gitlab/callback`

保留：

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/activate`
- `POST /auth/logout`
- `GET /auth/github`
- `GET /auth/github/callback`

### 推荐 Handler 重构

建议把当前 `auth.go` 中的 GitHub 专用 handler 重构为“Provider 通用 handler + provider 包装”：

```go
func OAuthLoginHandler(providerName string, authApp *AuthApplication) gin.HandlerFunc
func OAuthCallbackHandler(providerName string, authApp *AuthApplication) gin.HandlerFunc
```

然后注册：

```go
auth.GET("/gitlab", OAuthLoginHandler("gitlab", authApp))
auth.GET("/gitlab/callback", OAuthCallbackHandler("gitlab", authApp))
auth.GET("/github", OAuthLoginHandler("github", authApp))
auth.GET("/github/callback", OAuthCallbackHandler("github", authApp))
```

### state / nonce 存储

当前只有一个 `clawhub_oauth_state` Cookie。  
建议升级为：

- `clawhub_oauth_state`
- `clawhub_oauth_nonce`
- `clawhub_oauth_provider`
- `clawhub_oauth_redirect`

回调时校验：

- provider 是否匹配
- state 是否匹配
- nonce 是否匹配（如用 id_token）

## 4.9 前端设计

### 当前问题

`src/routes/auth/login.tsx` 当前是邮箱表单页，不适合作为统一企业登录入口。

### 目标设计

把 `/auth/login` 改造成“认证入口页”，包含：

- 主按钮：`使用 GitLab 登录`
- 次按钮：`邮箱登录`
- 如果未来保留 GitHub，可放在次级位置

### 页面状态设计

建议把当前单页三态改成：

- 默认：入口选择
- 邮箱登录子视图
- 邮箱注册子视图
- 激活子视图

### 跳转行为

点击“使用 GitLab 登录”时：

- 直接跳转 `${BACKEND_BASE}/auth/gitlab`
- 如有登录后回跳路径，附带 `redirect` 参数

### 兼容 `/cli/auth`

`src/routes/cli/auth.tsx` 当前未登录时跳 `/auth/login`。  
这一点保持不变，只改 `/auth/login` 的内容即可。

## 4.10 CLI 设计

CLI 不做协议变更，只做文案兼容。

### 当前协议保留

保留：

- `buildCliAuthUrl()`
- loopback server
- `/cli/auth`
- token callback

### 建议修改

- 报错文案不要暗示只有 GitHub
- registry discovery 后续可选返回 provider hints

## 5. 安全设计

## 5.1 必须校验项

- `state`
- `nonce`
- `provider`
- 回调 URI 一致性

## 5.2 Token 安全边界

GitLab Access Token 只能存在于：

- 后端内存中的回调处理过程

不能：

- 写入前端响应
- 写入 CLI 回调参数
- 写入普通日志

## 5.3 Session 安全

建议增强：

- JWT 过期时间保持 30 天或根据产品策略缩短
- 增加 `iss` / `aud`
- 生产环境开启 `Secure Cookie`

## 5.4 私有 GitLab 证书处理

如果企业 GitLab 使用私有 CA：

- Go HTTP Client 需要支持自定义 CA
- 不允许通过“关闭 TLS 校验”作为常规方案

建议配置：

- `GITLAB_CA_CERT_FILE`

## 6. 错误处理设计

### 用户可见错误

- 登录初始化失败
- GitLab 回调 state 校验失败
- GitLab token 交换失败
- GitLab 用户信息读取失败
- 本地用户创建失败
- 未登录无法创建 CLI Token

### 后端日志错误

应结构化记录：

- provider
- request id
- error category
- upstream status code

不得记录：

- access token
- client secret

## 7. 迁移设计

## 7.1 数据迁移

顺序建议：

1. 新建 `auth_identities`
2. 为 `users` 增加 `last_login_at`
3. 回填 GitHub 历史身份
4. 代码读路径切到 `auth_identities`
5. 保留 `github_id` 过渡

## 7.2 代码迁移

顺序建议：

1. 抽象 Provider 接口
2. 实现 GitLab Provider
3. 引入 IdentityService
4. 改造 GitHub Provider 也走同一抽象
5. 改造 handler 注册
6. 改造前端登录页
7. 联调 CLI

## 7.3 回滚策略

如果 GitLab 联调失败，可回滚到：

- 仅保留旧 GitHub / 邮箱逻辑
- 不启用 GitLab provider 路由

因此建议：

- GitLab provider 必须支持 `enabled` 开关

## 8. 测试设计

### 8.1 后端单元测试

建议覆盖：

- provider registry 获取
- GitLab claims 归一化
- identity 绑定逻辑
- 同一 provider+subject 重复登录幂等
- Session JWT 签发/解析

### 8.2 Handler 测试

建议覆盖：

- `/auth/gitlab` 重定向
- `/auth/gitlab/callback` state 失败
- `/auth/gitlab/callback` token 交换失败
- `/auth/gitlab/callback` 首次登录建号
- `/auth/gitlab/callback` 再次登录复用账号

### 8.3 前端测试

建议覆盖：

- `/auth/login` 显示 GitLab 登录入口
- `/cli/auth` 未登录时跳转登录入口
- 登录后 `/users/me` 更新 UI

### 8.4 CLI 测试

建议覆盖：

- browser auth 成功
- callback state 匹配
- token 保存成功

## 9. 分阶段实施建议

### 阶段 1：基础重构

- 配置重构
- Provider 抽象
- IdentityService
- auth_identities 迁移

### 阶段 2：GitLab 接入

- GitLab OIDC Provider
- `/auth/gitlab`
- `/auth/gitlab/callback`
- 登录成功后写 Session

### 阶段 3：前端接入

- `/auth/login` 改版
- Header 登录入口适配
- `/cli/auth` 文案确认

### 阶段 4：联调与收尾

- 测试环境 GitLab 联调
- CLI 验证
- 文档更新

## 10. 关键设计决策总结

### 决策 1

**不让 CLI 直接接 GitLab，而是继续接 ClawHub API Token。**

原因：

- 当前协议已经稳定
- 降低敏感 token 暴露面
- 兼容现有命令实现

### 决策 2

**不在 `users` 主表继续追加 provider 字段，而是引入 `auth_identities`。**

原因：

- 当前 `github_id` 已经说明旧模型不可持续
- 后续多 provider 必须解耦

### 决策 3

**不在前端直接做 GitLab OIDC。**

原因：

- 当前前端已经围绕 Cookie Session 组织
- 后端统一处理更安全
- 能复用 CLI token 创建流程

### 决策 4

**优先采用 OIDC，而不是手写 GitLab OAuth + `/api/v4/user`。**

原因：

- 更标准
- 更适合多 provider 统一抽象
- 更适合企业私有部署

## 11. 结论

基于当前代码现状，最合理的技术路径不是“在现有 GitHub 逻辑上补几个 GitLab 方法”，而是：

1. 把认证层从 GitHub 定制实现抽象为 Provider 体系
2. 引入 `auth_identities` 作为外部身份映射层
3. 使用 GitLab Self-Managed OIDC 完成身份认证
4. 继续复用本地 Session Cookie 与 API Token
5. 保持 CLI 浏览器登录协议不变

这个方案改动范围明确、风险可控，而且能最大限度复用现有 `backend/`、`src/`、`packages/clawhub/` 已经存在的能力。
