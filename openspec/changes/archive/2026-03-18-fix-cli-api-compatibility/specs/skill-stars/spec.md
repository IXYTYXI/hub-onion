## MODIFIED Requirements

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
