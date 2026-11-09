## ADDED Requirements

### Requirement: 外部身份映射模型
系统 SHALL 使用独立的外部身份映射模型管理第三方 provider 与本地用户之间的绑定关系。

#### Scenario: 创建身份映射表
- **WHEN** 系统应用新的认证数据模型
- **THEN** 系统 SHALL 创建 `auth_identities` 表，至少包含 `user_id`、`provider`、`provider_subject`、`provider_username`、`provider_email`、`provider_avatar_url`、`raw_claims`、`last_login_at`、`created_at`、`updated_at`

#### Scenario: 外部身份唯一约束
- **WHEN** 系统写入第三方身份记录
- **THEN** 系统 SHALL 保证 `(provider, provider_subject)` 组合全局唯一

### Requirement: 多 Provider 用户绑定
系统 SHALL 基于外部身份映射而不是 provider 专属字段完成本地用户查找与绑定，并将不同登录方式统一收敛到同一个本地用户主体。

#### Scenario: 已存在身份映射
- **WHEN** 第三方登录返回的 `(provider, provider_subject)` 已存在
- **THEN** 系统 SHALL 复用对应本地用户，并更新该身份映射的登录时间和资料镜像字段

#### Scenario: 首次第三方登录
- **WHEN** 第三方登录返回的 `(provider, provider_subject)` 不存在
- **THEN** 系统 SHALL 创建本地用户并创建对应身份映射记录

#### Scenario: 绑定新增登录身份
- **WHEN** 当前已登录本地用户主动绑定新的第三方身份或邮箱身份
- **THEN** 系统 SHALL 将该身份绑定到当前本地用户，而不是创建新的平行账号主体

## MODIFIED Requirements

### Requirement: 用户账户模型
系统 SHALL 维护平台本地用户账户，并通过独立的外部身份映射模型关联 GitHub、GitLab、飞书等第三方身份，同时把邮箱绑定状态作为本地用户状态的一部分。

#### Scenario: 用户表结构
- **WHEN** 系统初始化或迁移认证数据模型
- **THEN** 系统 SHALL 维护 `users` 表用于保存本地用户基础信息，至少包含 `id`（UUID）、`handle`（唯一）、`display_name`、`email`、`avatar_url`、`bio`、`role`（默认 `user`）、`status`、`created_at`、`updated_at`

#### Scenario: handle 唯一性
- **WHEN** 新建本地用户时生成的基础 handle 与现有用户重复
- **THEN** 系统 SHALL 在 handle 后追加数字后缀确保唯一（如 `foo` → `foo2`）

#### Scenario: 用户状态建模
- **WHEN** 系统创建或更新本地用户
- **THEN** `status` 字段 SHALL 支持区分邮箱待激活、待审核、已激活、已拒绝和已停用等准入状态

#### Scenario: 邮箱绑定状态
- **WHEN** 系统创建或更新本地用户
- **THEN** 系统 SHALL 能够区分该本地用户是否已完成邮箱绑定与邮箱验证

### Requirement: GitHub OAuth 登录
系统 SHALL 通过 GitHub OAuth 2.0 实现用户登录。

#### Scenario: 发起登录
- **WHEN** 用户访问 `GET /auth/github`
- **THEN** 系统 SHALL 重定向到 GitHub OAuth 授权页，携带 `client_id`、`scope=read:user,user:email`、随机 `state` 参数

#### Scenario: OAuth callback 处理
- **WHEN** GitHub 回调 `GET /auth/github/callback?code=xxx&state=yyy`
- **THEN** 系统 SHALL 验证 state、用 code 换取 access token、获取 GitHub 用户信息、完成本地用户/身份映射同步，并仅在用户状态允许登录时颁发 JWT cookie、重定向到前端

#### Scenario: 首次登录创建用户
- **WHEN** GitHub 用户首次登录
- **THEN** 系统 SHALL 创建本地用户并写入对应外部身份映射，role 为 `user`，初始审核状态为 `review_pending`

#### Scenario: 重复登录更新信息
- **WHEN** 已存在的 GitHub 用户再次登录
- **THEN** 系统 SHALL 更新资料镜像字段与登录时间，不修改 `handle` 和 `role`

### Requirement: JWT Session 管理
系统 SHALL 使用 JWT 管理用户会话，并在任一受支持的登录方式成功后签发平台本地会话。

#### Scenario: 颁发 JWT cookie
- **WHEN** `active` 用户通过 GitHub、GitLab、飞书或邮箱登录成功
- **THEN** 系统 SHALL 设置 HttpOnly 的 cookie `clawhub_session`，值为平台 JWT，会话有效期由服务端策略控制

#### Scenario: JWT payload
- **WHEN** 系统颁发 JWT
- **THEN** JWT payload SHALL 包含 `sub`（user_id）、`handle`、`role`、`exp`

#### Scenario: JWT 校验
- **WHEN** 受保护路由收到请求
- **THEN** 系统 SHALL 优先从 `Authorization: Bearer <token>` 读取 JWT，其次从 cookie 读取，验证签名和过期时间

#### Scenario: 登出
- **WHEN** 用户访问 `POST /auth/logout`
- **THEN** 系统 SHALL 清除 `clawhub_session` cookie，返回 200

#### Scenario: 未审核用户不得建立会话
- **WHEN** `email_pending`、`review_pending`、`rejected` 或 `disabled` 用户完成任一登录流程
- **THEN** 系统 SHALL 拒绝颁发平台 JWT 会话，并返回与用户状态对应的错误提示

### Requirement: 获取当前用户
系统 SHALL 提供当前登录用户的信息接口。

#### Scenario: 已登录用户
- **WHEN** 已认证用户请求 `GET /users/me`
- **THEN** 系统 SHALL 返回用户完整信息（id、handle、display_name、email、avatar_url、bio、role）

#### Scenario: 未登录用户
- **WHEN** 未认证请求访问 `GET /users/me`
- **THEN** 系统 SHALL 返回 401 Unauthorized

### Requirement: CLI whoami 兼容接口
系统 SHALL 提供面向现有 CLI 的当前用户信息接口，并返回 CLI schema 要求的包装结构。

#### Scenario: 已认证 CLI 请求 whoami
- **WHEN** 已认证请求访问 `GET /api/v1/whoami`
- **THEN** 系统 SHALL 返回 `{ "user": { "handle": string|null, "displayName": string|null, "image": string|null } }`

#### Scenario: 未认证 CLI 请求 whoami
- **WHEN** 未认证请求访问 `GET /api/v1/whoami`
- **THEN** 系统 SHALL 返回 401 Unauthorized

### Requirement: 当前用户信息包装一致性
系统 SHALL 保证 CLI 使用的当前用户信息接口与浏览器使用的用户资料接口可以并存，但不得要求 CLI 解析扁平化用户对象。

#### Scenario: CLI 与前端接口可并存
- **WHEN** 系统同时提供 `GET /api/v1/whoami` 和 `GET /api/v1/users/me`
- **THEN** 系统 SHALL 允许前端继续使用现有资料接口，同时为 CLI 提供独立的兼容包装结构
