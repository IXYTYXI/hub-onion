## ADDED Requirements

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

## MODIFIED Requirements

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
