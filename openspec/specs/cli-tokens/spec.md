## ADDED Requirements

### Requirement: CLI token 创建
系统 SHALL 允许已登录用户创建长期 API token 供 CLI 使用。

#### Scenario: 创建 token
- **WHEN** 已认证用户请求 `POST /users/me/tokens`，携带 `{"label": "my-laptop"}`
- **THEN** 系统 SHALL 生成 32 字节随机 token，存储其 SHA-256 哈希到 `api_tokens` 表，返回原始 token（仅此一次）：`{"token": "xxx", "id": "uuid", "label": "my-laptop", "created_at": "..."}`

#### Scenario: token 仅返回一次
- **WHEN** token 创建后再次查询
- **THEN** 系统 SHALL 不返回原始 token 值，仅返回 id、label、created_at、last_used_at

#### Scenario: label 必填
- **WHEN** 创建 token 时未提供 label
- **THEN** 系统 SHALL 返回 400 Bad Request

### Requirement: CLI token 列表
系统 SHALL 允许用户查看自己的所有 token。

#### Scenario: 获取 token 列表
- **WHEN** 已认证用户请求 `GET /users/me/tokens`
- **THEN** 系统 SHALL 返回该用户所有 token 的列表，每条包含 `id`、`label`、`created_at`、`last_used_at`，不含 token 值

### Requirement: CLI token 撤销
系统 SHALL 允许用户撤销（删除）指定 token。

#### Scenario: 撤销 token
- **WHEN** 已认证用户请求 `DELETE /users/me/tokens/:id`
- **THEN** 系统 SHALL 删除该 token 记录，返回 `{"ok": "revoked"}`

#### Scenario: 撤销他人 token 被拒绝
- **WHEN** 用户尝试撤销不属于自己的 token
- **THEN** 系统 SHALL 返回 404 Not Found

### Requirement: CLI token 认证
系统 SHALL 支持使用 CLI token 作为 Bearer token 进行 API 认证。

#### Scenario: 使用 CLI token 认证
- **WHEN** 请求携带 `Authorization: Bearer <cli-token>`
- **THEN** 系统 SHALL 查找匹配的 token 哈希，验证通过后以 token 所属用户身份处理请求，并更新 `last_used_at`

#### Scenario: 无效 token
- **WHEN** Bearer token 不匹配任何有效 CLI token 且不是有效 JWT
- **THEN** 系统 SHALL 返回 401 Unauthorized
