# 私有部署 GitLab 授权接入需求文档

## 1. 文档目的

本文档基于当前仓库代码现状，定义“在 ClawHub 当前系统中增加基于私有部署 GitLab 的授权/登录能力”的详细需求，用于指导后续技术设计、任务拆解与联调验收。

本文档不是抽象需求描述，而是建立在当前实现基础之上：

- Go 后端当前已有 GitHub OAuth、邮箱登录、JWT Session、CLI API Token 机制
- 前端当前已有登录页、会话感知、CLI 浏览器登录承接页
- CLI 当前登录主链路已经与具体 OAuth 提供商解耦

## 2. 当前代码现状

### 2.1 后端认证现状

当前 Go 后端认证相关能力：

- `backend/internal/service/auth_service.go`
  - `AuthService` 直接持有 `githubClientID/githubClientSecret`，说明当前认证层是 GitHub 定制实现
  - `GitHubOAuthURL()`、`ExchangeCode()`、`FetchGitHubUser()`、`UpsertUser()` 直接耦合 GitHub
  - `IssueJWT()` / `ParseJWT()` 已能签发和校验本地 Session JWT
- `backend/internal/handler/auth.go`
  - 已提供 `/auth/github` 和 `/auth/github/callback`
  - 已提供邮箱登录、注册、激活、登出
- `backend/internal/middleware/auth.go`
  - 已支持从 `Authorization: Bearer` 和 `clawhub_session` 中提取凭证
  - 已支持“先尝试 JWT，再尝试 API Token”的鉴权逻辑
- `backend/internal/handler/user.go`
  - 已支持 `/api/v1/users/me/tokens` 创建/列出/吊销 CLI Token

### 2.2 用户模型现状

当前用户模型定义在 `backend/internal/model/user.go`：

- `users` 上存在 `GithubID`
- `AuthProvider` 仅以字符串标记来源
- 没有独立的外部身份映射表

数据库迁移现状：

- `backend/internal/database/migrations/000005_create_users_table.up.sql`
  - 初始模型要求 `github_id` 非空
- `backend/internal/database/migrations/000009_email_auth.up.sql`
  - 将 `github_id` 变为可空
  - 新增邮箱登录相关字段

这说明当前系统已经从“仅 GitHub 登录”转为“GitHub + 邮箱”的混合模型，但数据结构仍未完成 provider 抽象。

### 2.3 前端现状

当前前端认证相关能力：

- `src/routes/auth/login.tsx`
  - 当前是邮箱登录/注册/激活三态页面
  - 不是 OAuth Provider 选择页
- `src/lib/useAuthStatus.ts`
  - 基于 `/api/v1/users/me` 判断是否已登录
- `src/lib/apiClient.ts`
  - 所有请求默认 `credentials: 'include'`，依赖浏览器 Cookie 会话
- `src/routes/cli/auth.tsx`
  - 当前只要求“用户先在 Web 已登录”，然后即可创建 CLI Token

### 2.4 CLI 现状

当前 CLI 登录协议定义在 `packages/clawhub/src/browserAuth.ts`：

- CLI 启动本地 loopback server
- 浏览器打开 `<site>/cli/auth?redirect_uri=...&state=...`
- Web 页面在已登录状态下创建 API Token
- Web 页面跳回本地 loopback 回传 token

这条链路没有直接依赖 GitHub，因此具备较强兼容性。

## 3. 业务目标

本次需求目标是：

1. 在当前系统中支持用户通过**私有部署 GitLab** 完成登录
2. 登录完成后，继续复用 ClawHub 自己的：
   - 本地用户体系
   - Session Cookie
   - API Token
   - CLI 浏览器登录协议
3. 不要求 CLI 直接持有或使用 GitLab Access Token
4. 不要求前端直接处理 GitLab OIDC/OAuth token

## 4. 范围

### 4.1 本次必须实现

- Web 端支持通过私有部署 GitLab 登录
- Go 后端支持 GitLab Self-Managed OIDC/OAuth 对接
- 登录成功后创建/绑定 ClawHub 本地用户
- 登录成功后签发 `clawhub_session`
- 登录成功后 `/api/v1/users/me` 正常返回用户信息
- CLI 浏览器登录继续可用
- API Token 创建、吊销、使用逻辑保持兼容
- 配置层支持 GitLab Self-Managed 的实例地址与客户端凭据

### 4.2 本次建议实现

- 认证提供商抽象化，避免 GitHub/GitLab 再继续写死
- 数据模型从 `users.github_id` 演进到独立身份映射模型
- 登录页改造成“登录方式入口页”
- 在 UI 中把 GitLab 作为主登录方式展示

### 4.3 本次明确不要求

- GitLab 仓库读写能力
- GitLab 项目权限同步
- GitLab Issue / Merge Request 集成
- SAML / LDAP 统一登录
- 多实例 GitLab 同时登录
- 细粒度 RBAC 自动同步
- 前端直连 GitLab API

## 5. 核心需求

### 5.1 身份认证需求

系统必须支持通过私有部署 GitLab 完成用户身份认证。

具体要求：

- 支持管理员在配置中指定 GitLab Self-Managed 基础地址
- 支持从 GitLab 进行浏览器重定向登录
- 支持回调处理 code / state
- 推荐基于 OIDC 获取标准用户身份 claims
- 系统只在后端与 GitLab 交互

### 5.2 本地会话需求

系统必须继续使用 ClawHub 本地 Session 机制，而不是把 GitLab token 作为平台会话直接使用。

具体要求：

- GitLab 登录成功后，后端必须签发本地 JWT Session
- Session 仍通过 `clawhub_session` Cookie 传递
- 现有依赖 Cookie 的前端鉴权逻辑无需协议级重写

### 5.3 本地用户需求

系统必须把 GitLab 身份映射到本地用户。

具体要求：

- 若 GitLab 身份首次登录，则创建本地用户
- 若 GitLab 身份已存在，则复用已有本地用户
- 用户名、显示名、头像、邮箱应支持从 GitLab 更新
- 用户角色仍由 ClawHub 本地维护，不由 GitLab 直接决定

### 5.4 CLI 兼容需求

系统必须保证现有 CLI 浏览器登录链路保持兼容。

具体要求：

- `clawhub login` 不需要改主协议
- `/cli/auth` 页仍通过当前逻辑创建 API Token
- CLI 登录成功后得到的仍是 ClawHub API Token，而非 GitLab token
- 现有 `whoami/publish/delete` 等 Bearer Token 请求无需协议变更

### 5.5 登录入口需求

系统必须提供清晰的 Web 登录入口。

具体要求：

- `/auth/login` 页面需要支持 GitLab 登录入口
- 若保留邮箱登录，应作为次级入口或可配置入口
- Header 和 CLI 登录兜底页应统一跳转到新的登录入口

### 5.6 配置需求

系统必须支持 GitLab Self-Managed 配置。

至少包括：

- GitLab 基础 URL
- Client ID
- Client Secret
- Discovery URL 或可推导 Discovery URL
- Scope 配置
- 前端回跳地址

### 5.7 安全需求

系统必须满足基础 OAuth/OIDC 安全要求。

至少包括：

- 校验 `state`
- 若使用 OIDC，校验 `nonce`
- GitLab `client_secret` 只保存在后端
- 不向前端和 CLI 返回 GitLab Access Token
- 生产环境必须跑在 HTTPS 下

## 6. 非功能需求

### 6.1 兼容性

- 不破坏现有 `/api/v1/users/me`、`/api/v1/users/me/tokens`、`/cli/auth` 协议
- 不破坏现有 `Authorization: Bearer` API Token 鉴权
- 不强制 CLI 发版后才能完成后端接入

### 6.2 可维护性

- 不能继续把 GitLab 逻辑硬编码进现有 GitHub 专用方法中
- 必须为未来多 provider 扩展预留结构

### 6.3 可观测性

需要记录以下日志事件：

- 登录发起
- 回调成功/失败
- 用户创建/绑定
- API Token 创建失败
- GitLab 通信失败

日志中不得输出敏感 token 明文。

### 6.4 可配置性

- 应允许在不同环境配置不同 GitLab 实例
- 应允许控制邮箱登录是否继续启用
- 应允许未来增加“仅允许指定 GitLab Group 登录”的扩展能力

## 7. 角色与使用场景

### 7.1 普通用户

场景：

- 打开网站
- 点击“使用 GitLab 登录”
- 完成 GitLab 授权
- 返回 ClawHub 后进入已登录状态

### 7.2 CLI 用户

场景：

- 执行 `clawhub login`
- 浏览器打开 `/cli/auth`
- 若未登录，先在 Web 完成 GitLab 登录
- 登录完成后自动创建 CLI Token 并回传本地 CLI

### 7.3 管理员

场景：

- 在 GitLab 管理端创建应用
- 在 ClawHub 环境变量中配置 GitLab 参数
- 验证登录联调

## 8. 详细用户流程

### 8.1 Web 登录流程

1. 用户访问 `/auth/login`
2. 用户点击“使用 GitLab 登录”
3. 前端跳转到后端 `/auth/gitlab`
4. 后端生成 `state`、`nonce` 并跳转 GitLab
5. GitLab 完成认证并回调 `/auth/gitlab/callback`
6. 后端换取 token，获取用户 claims
7. 后端查找或创建本地用户
8. 后端签发 `clawhub_session`
9. 浏览器回跳前端
10. 前端通过 `/api/v1/users/me` 获取用户信息

### 8.2 CLI 登录流程

1. CLI 启动 loopback server
2. CLI 打开 `/cli/auth?redirect_uri=...&state=...`
3. 若用户未登录，则跳转 `/auth/login`
4. 用户通过 GitLab 登录
5. 回到 `/cli/auth`
6. `/cli/auth` 调用 `/api/v1/users/me/tokens`
7. 后端创建 ClawHub API Token
8. 浏览器把 token 回传本地 loopback
9. CLI 保存 token

## 9. 数据需求

### 9.1 用户数据

系统需要保存：

- 本地用户 ID
- handle
- displayName
- email
- avatarUrl
- role
- status

### 9.2 外部身份数据

系统需要保存：

- provider
- provider subject
- provider username
- provider email
- provider avatar
- 原始 claims（可选）

### 9.3 Token 数据

继续沿用现有 API Token 机制：

- token 只返回一次
- DB 中只保存 hash
- Bearer Token 鉴权逻辑不变

## 10. 验收标准

### 10.1 功能验收

- 用户能通过私有部署 GitLab 成功登录
- 登录后页面刷新仍保持登录态
- `/api/v1/users/me` 返回当前用户
- `/api/v1/users/me/tokens` 可创建 token
- CLI 浏览器登录成功
- CLI `whoami` 成功

### 10.2 数据验收

- 同一个 GitLab 用户重复登录不会创建重复账号
- 用户资料更新后可同步到本地
- API Token 行为不变

### 10.3 安全验收

- 回调不接受错误 `state`
- 未登录不能创建 API Token
- GitLab token 不会出现在前端响应体和 CLI 回调数据中

## 11. 风险与约束

### 11.1 当前代码结构约束

当前 `AuthService` 是 GitHub 专用结构，若直接堆 GitLab 分支，会导致：

- 服务对象膨胀
- 认证流程分叉
- 后续维护成本上升

因此本需求默认要求在实现 GitLab 前，先完成 provider 抽象。

### 11.2 当前数据库结构约束

当前 `users` 表仍保留 `github_id` 历史包袱。  
如果继续把 GitLab 信息塞入 `users` 主表，会使模型继续恶化。

因此本需求默认要求引入独立身份映射模型。

### 11.3 网络与证书约束

GitLab 为私有部署时，可能存在：

- 内网 DNS
- 私有 CA
- 反向代理改写
- 非标准端口

因此联调前必须先验证 GitLab 发现地址、token endpoint、userinfo endpoint 的可达性。

## 12. 需求结论

从当前代码现状出发，本需求的本质不是“加一个新的登录按钮”，而是：

- 把现有 GitHub 专用认证实现升级为可扩展认证架构
- 让 GitLab Self-Managed 成为新的身份提供方
- 继续复用当前本地 Session、API Token 和 CLI 浏览器登录协议

后续技术设计必须围绕这个现实展开，而不能脱离当前 `backend/`、`src/`、`packages/clawhub/` 的实际结构另起一套体系。
