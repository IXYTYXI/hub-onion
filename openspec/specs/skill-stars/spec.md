## ADDED Requirements

### Requirement: 用户收藏 skill
系统 SHALL 允许已登录用户收藏（star）和取消收藏 skill，并提供与现有 CLI 路由和响应 schema 兼容的接口。

#### Scenario: CLI 收藏 skill
- **WHEN** 已认证用户请求 `POST /api/v1/stars/{slug}`
- **THEN** 系统 SHALL 创建或复用对应收藏记录，并返回 `{ "ok": "true", "starred": true, "alreadyStarred": false }`

#### Scenario: CLI 重复收藏幂等
- **WHEN** 用户对已收藏的 skill 再次请求 `POST /api/v1/stars/{slug}`
- **THEN** 系统 SHALL 返回 `{ "ok": "true", "starred": true, "alreadyStarred": true }`，不报错，不创建重复记录

#### Scenario: CLI 取消收藏
- **WHEN** 已认证用户请求 `DELETE /api/v1/stars/{slug}`
- **THEN** 系统 SHALL 删除或确认不存在对应 `user_stars` 记录，并返回 `{ "ok": "true", "unstarred": true, "alreadyUnstarred": false }`

#### Scenario: CLI 重复取消收藏幂等
- **WHEN** 用户对未收藏的 skill 请求 `DELETE /api/v1/stars/{slug}`
- **THEN** 系统 SHALL 返回 `{ "ok": "true", "unstarred": true, "alreadyUnstarred": true }`

#### Scenario: 未登录用户无法收藏
- **WHEN** 未认证请求访问 star 接口
- **THEN** 系统 SHALL 返回 401 Unauthorized

### Requirement: 用户收藏列表
系统 SHALL 提供当前用户的收藏列表。

#### Scenario: 获取收藏列表
- **WHEN** 已认证用户请求 `GET /users/me/stars`
- **THEN** 系统 SHALL 返回该用户收藏的所有 skill，格式与 `GET /skills` 一致，按收藏时间降序

#### Scenario: skill 的 star 计数
- **WHEN** 请求 skill 详情或列表
- **THEN** 系统 SHALL 在 `stats.stars` 字段返回该 skill 的总收藏数

### Requirement: star 状态查询
系统 SHALL 在 skill 详情中返回当前用户的收藏状态。

#### Scenario: 已登录用户查看 skill 详情
- **WHEN** 已认证用户请求 `GET /skills/:slug`
- **THEN** 系统 SHALL 在响应中包含 `isStarred: true/false` 字段

#### Scenario: 未登录用户查看 skill 详情
- **WHEN** 未认证请求访问 `GET /skills/:slug`
- **THEN** 系统 SHALL 在响应中包含 `isStarred: false`
