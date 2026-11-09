## ADDED Requirements

### Requirement: 用户公开资料查询
系统 SHALL 提供用户公开资料的只读接口，并在可用时返回用于公开展示的邮箱信息。

#### Scenario: 查询存在的用户
- **WHEN** 请求 `GET /users/:handle`
- **THEN** 系统 SHALL 返回用户公开信息：`id`、`handle`、`display_name`、`avatar_url`、`bio`、`created_at`
- **AND** 当系统已持有该用户的飞书授权邮箱时，响应 SHALL 包含 `email`

#### Scenario: 查询不存在的用户
- **WHEN** 请求的 handle 不存在
- **THEN** 系统 SHALL 返回 404 Not Found

### Requirement: 用户页身份信息展示
系统 SHALL 在 `/u/:handle` 页面中优先展示邮箱，而不是继续固定展示 UID 风格 handle。

#### Scenario: 用户页优先展示邮箱
- **WHEN** 用户资料响应包含 `email`
- **THEN** `/u/:handle` 页面 SHALL 优先展示该邮箱作为用户身份信息

#### Scenario: 邮箱缺失时回退 handle
- **WHEN** 用户资料响应不包含 `email`
- **THEN** `/u/:handle` 页面 SHALL 回退展示 `@handle`

### Requirement: 用户发布的 skill 列表
系统 SHALL 提供用户发布的所有 skill 列表。

#### Scenario: 获取用户 skill 列表
- **WHEN** 请求 `GET /users/:handle/skills`
- **THEN** 系统 SHALL 返回该用户作为 owner 的所有 skill，按 `updated_at` 降序排列，格式与 `GET /skills` 一致

#### Scenario: 用户无 skill
- **WHEN** 用户尚未发布任何 skill
- **THEN** 系统 SHALL 返回空数组 `{"items": [], "nextCursor": null}`

#### Scenario: 分页支持
- **WHEN** 请求携带 `cursor` 参数
- **THEN** 系统 SHALL 返回该 cursor 之后的结果，每页最多 20 条
