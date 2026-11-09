## ADDED Requirements

### Requirement: 用户公开资料查询
系统 SHALL 提供用户公开资料的只读接口。

#### Scenario: 查询存在的用户
- **WHEN** 请求 `GET /users/:handle`
- **THEN** 系统 SHALL 返回用户公开信息：`id`、`handle`、`display_name`、`avatar_url`、`bio`、`created_at`，不包含 `email` 和 `role`

#### Scenario: 查询不存在的用户
- **WHEN** 请求的 handle 不存在
- **THEN** 系统 SHALL 返回 404 Not Found

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
