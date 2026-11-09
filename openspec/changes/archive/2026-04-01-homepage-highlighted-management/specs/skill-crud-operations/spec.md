## MODIFIED Requirements

### Requirement: 列出 skills 并支持分页
系统 SHALL 提供一个端点来列出所有活跃的 skills 并支持分页，同时支持按精选状态过滤。

#### 场景：列出第一页 skills
- **当** 客户端请求 GET /api/v1/skills 而不带参数时
- **则** 系统应返回前 25 个 skills，按创建时间降序排序

#### 场景：使用自定义限制列出
- **当** 客户端请求 GET /api/v1/skills?limit=50 时
- **则** 系统应返回最多 50 个 skills

#### 场景：排除已删除的 skills
- **当** 列出 skills 时
- **则** 系统不应包含 is_deleted 为 TRUE 的 skills

#### 场景：排除非活跃审核状态
- **当** 列出 skills 时
- **则** 系统应只包含 moderation_status = 'active' 的 skills

#### 场景：仅列出精选 skills
- **当** 客户端请求 GET /api/v1/skills?highlighted=1 或 GET /api/v1/skills?highlighted=true 时
- **则** 系统应只返回 `highlighted = true` 的活跃 skills

### Requirement: 列表响应格式
系统 SHALL 按照标准 schema 格式返回 skills 列表，并在需要时显式返回精选状态。

#### 场景：标准列表响应结构
- **当** 列表请求成功时
- **则** 系统应返回 JSON 响应，包含：
  - items: Skill 对象数组，每个包含：
    - slug: string
    - displayName: string
    - summary: string | null
    - tags: string[] | object
    - stats: object（包含 downloads、installs、versions 等）
    - createdAt: number（时间戳）
    - updatedAt: number（时间戳）
    - latestVersion: object（可选，包含 version、createdAt、changelog）
    - highlighted: boolean（当接口需要暴露精选状态时）
  - nextCursor: string | null（用于分页）

#### 场景：空列表结果
- **当** 没有 skills 时
- **则** 系统应返回 `{ "items": [], "nextCursor": null }`

### Requirement: 技能详情响应格式
系统 SHALL 按照标准 schema 格式返回单个技能详情，并在可空字段缺失时显式返回 `null` 以满足 CLI 解析。

#### 场景：标准技能响应结构
- **当** 技能详情请求成功时
- **则** 系统应返回 JSON 响应，包含：
  - skill: object（包含 slug、displayName、summary、tags、stats、createdAt、updatedAt，以及在前端需要时可包含 highlighted）
  - latestVersion: object | null（包含 version、createdAt、changelog）
  - owner: object | null（包含 handle、displayName、image）

#### 场景：缺失 owner 或 latestVersion
- **当** skill 没有 owner 或 latestVersion
- **则** 系统应显式返回 `owner: null` 或 `latestVersion: null`，而不是省略这些字段
