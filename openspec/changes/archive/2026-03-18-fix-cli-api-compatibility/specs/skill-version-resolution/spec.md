## MODIFIED Requirements

### Requirement: 解析响应格式
系统 SHALL 按照标准 schema 格式返回版本解析结果，并在未命中哈希时返回可被 CLI 继续处理的成功响应。

#### 场景：标准解析响应结构
- **当** 解析请求成功时
- **则** 系统应返回 JSON 响应，包含：
  - match: object | null（匹配的版本，包含 version 字段）
  - latestVersion: object | null（最新版本，包含 version 字段）

#### 场景：哈希匹配响应
- **当** 提供的哈希与某个版本匹配时
- **则** 系统应返回 `{ "match": { "version": "1.0.0" }, "latestVersion": { "version": "1.0.0" } }`

#### 场景：无匹配响应
- **当** 没有版本与提供的哈希匹配时
- **则** 系统应返回 `{ "match": null, "latestVersion": { "version": "<latest>" } }`，而不是因为未匹配直接返回 404

#### 场景：技能不存在
- **当** 请求的 slug 不存在时
- **则** 系统应返回 404 并附带 `{ "error": "skill not found" }`
