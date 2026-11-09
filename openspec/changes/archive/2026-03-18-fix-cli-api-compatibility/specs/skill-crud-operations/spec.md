## MODIFIED Requirements

### Requirement: 获取 skill 版本历史
系统 SHALL 提供一个端点来检索 skill 的所有版本，并以 CLI 兼容的列表包装结构返回。

#### 场景：列出所有版本
- **当** 客户端请求 GET /api/v1/skills/{slug}/versions 时
- **则** 系统应返回该 skill 的所有版本，按创建时间降序排序

#### 场景：包含版本详情
- **当** 检索版本历史时
- **则** 每个版本应包含版本号、变更日志、创建时间戳和文件数量

#### 场景：标准版本列表包装
- **当** 版本历史请求成功时
- **则** 系统应返回 `{ "items": [...], "nextCursor": null|string }`，而不是直接返回裸数组

### Requirement: 技能详情响应格式
系统 SHALL 按照标准 schema 格式返回单个技能详情，并在可空字段缺失时显式返回 `null` 以满足 CLI 解析。

#### 场景：标准技能响应结构
- **当** 技能详情请求成功时
- **则** 系统应返回 JSON 响应，包含：
  - skill: object（包含 slug、displayName、summary、tags、stats、createdAt、updatedAt）
  - latestVersion: object | null（包含 version、createdAt、changelog）
  - owner: object | null（包含 handle、displayName、image）

#### 场景：缺失 owner 或 latestVersion
- **当** skill 没有 owner 或 latestVersion
- **则** 系统应显式返回 `owner: null` 或 `latestVersion: null`，而不是省略这些字段

### Requirement: 软删除 skill
系统 SHALL 提供一个端点来通过设置 is_deleted 标志软删除 skill，并返回 CLI 兼容的成功响应。

#### 场景：删除存在的 skill
- **当** 客户端发送 DELETE /api/v1/skills/{slug} 时
- **则** 系统应将 is_deleted 设置为 TRUE 并返回 `{ "ok": "true" }`

#### 场景：删除已删除的 skill
- **当** 客户端尝试删除已删除的 skill 时
- **则** 系统应返回 404 Not Found

### Requirement: 恢复 skill
系统 SHALL 提供一个端点来恢复已软删除的 skill，并返回 CLI 兼容的成功响应。

#### 场景：恢复已删除的 skill
- **当** 客户端为已删除的 skill 发送 POST /api/v1/skills/{slug}/undelete 时
- **则** 系统应将 is_deleted 设置为 FALSE 并返回 `{ "ok": "true" }`

#### 场景：恢复活跃的 skill
- **当** 客户端尝试恢复未删除的 skill 时
- **则** 系统应返回 400 Bad Request 并附带适当的错误消息
