## ADDED Requirements

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
