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
系统 SHALL 注册用户资料和 token 管理路由。

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
