## ADDED Requirements

### Requirement: 用户账户模型
系统 SHALL 维护用户账户，包含 GitHub 身份信息和平台角色。

#### Scenario: 用户表结构
- **WHEN** 系统初始化数据库
- **THEN** 系统 SHALL 创建 `users` 表，包含字段：`id`（UUID）、`github_id`（唯一）、`handle`（唯一，来自 GitHub login）、`display_name`、`email`、`avatar_url`、`bio`、`role`（默认 `user`）、`created_at`、`updated_at`

#### Scenario: handle 唯一性
- **WHEN** 两个用户拥有相同 GitHub handle
- **THEN** 系统 SHALL 在 handle 后追加数字后缀确保唯一（如 `foo` → `foo2`）

### Requirement: GitHub OAuth 登录
系统 SHALL 通过 GitHub OAuth 2.0 实现用户登录。

#### Scenario: 发起登录
- **WHEN** 用户访问 `GET /auth/github`
- **THEN** 系统 SHALL 重定向到 GitHub OAuth 授权页，携带 `client_id`、`scope=read:user,user:email`、随机 `state` 参数

#### Scenario: OAuth callback 处理
- **WHEN** GitHub 回调 `GET /auth/github/callback?code=xxx&state=yyy`
- **THEN** 系统 SHALL 验证 state、用 code 换取 access token、获取 GitHub 用户信息、upsert users 表、颁发 JWT cookie、重定向到前端

#### Scenario: 首次登录创建用户
- **WHEN** GitHub 用户首次登录
- **THEN** 系统 SHALL 在 `users` 表创建新记录，role 为 `user`

#### Scenario: 重复登录更新信息
- **WHEN** 已存在的 GitHub 用户再次登录
- **THEN** 系统 SHALL 更新 `display_name`、`avatar_url`、`email`，不修改 `handle` 和 `role`

### Requirement: JWT Session 管理
系统 SHALL 使用 JWT 管理用户会话。

#### Scenario: 颁发 JWT cookie
- **WHEN** 用户登录成功
- **THEN** 系统 SHALL 设置 HttpOnly、Secure、SameSite=Lax 的 cookie `clawhub_session`，值为 JWT，有效期 30 天

#### Scenario: JWT payload
- **WHEN** 系统颁发 JWT
- **THEN** JWT payload SHALL 包含 `sub`（user_id）、`handle`、`role`、`exp`

#### Scenario: JWT 校验
- **WHEN** 受保护路由收到请求
- **THEN** 系统 SHALL 优先从 `Authorization: Bearer <token>` 读取 JWT，其次从 cookie 读取，验证签名和过期时间

#### Scenario: 登出
- **WHEN** 用户访问 `POST /auth/logout`
- **THEN** 系统 SHALL 清除 `clawhub_session` cookie，返回 200

### Requirement: 获取当前用户
系统 SHALL 提供当前登录用户的信息接口。

#### Scenario: 已登录用户
- **WHEN** 已认证用户请求 `GET /users/me`
- **THEN** 系统 SHALL 返回用户完整信息（id、handle、display_name、email、avatar_url、bio、role）

#### Scenario: 未登录用户
- **WHEN** 未认证请求访问 `GET /users/me`
- **THEN** 系统 SHALL 返回 401 Unauthorized
