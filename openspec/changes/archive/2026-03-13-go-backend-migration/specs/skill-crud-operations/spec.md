## 新增需求

### 需求：列出 skills 并支持分页
系统应提供一个端点来列出所有活跃的 skills 并支持分页。

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

### 需求：通过 slug 获取 skill
系统应提供一个端点来通过 slug 标识符检索单个技能的详情。

#### 场景：获取存在的 skill
- **当** 客户端为存在的活跃 skill 请求 GET /api/v1/skills/{slug} 时
- **则** 系统应返回 skill 详情，包括 display_name、description、tags、stats 和最新版本信息

#### 场景：获取已删除的 skill
- **当** 客户端为已删除的 skill 请求 GET /api/v1/skills/{slug} 时
- **则** 系统应返回 404 Not Found

#### 场景：获取不存在的 skill
- **当** 客户端为不存在的 slug 请求 GET /api/v1/skills/{slug} 时
- **则** 系统应返回 404 Not Found

### 需求：获取 skill 版本历史
系统应提供一个端点来检索 skill 的所有版本。

#### 场景：列出所有版本
- **当** 客户端请求 GET /api/v1/skills/{slug}/versions 时
- **则** 系统应返回该 skill 的所有版本，按创建时间降序排序

#### 场景：包含版本详情
- **当** 检索版本历史时
- **则** 每个版本应包含版本号、变更日志、创建时间戳和文件数量

### 需求：获取单个文件内容
系统应提供一个端点来检索 skill 版本中单个文件的内容。

#### 场景：从最新版本获取文件
- **当** 客户端请求 GET /api/v1/skills/{slug}/file?path={filepath} 时
- **则** 系统应从最新版本返回文件内容

#### 场景：从指定版本获取文件
- **当** 客户端请求 GET /api/v1/skills/{slug}/file?path={filepath}&version={version} 时
- **则** 系统应从指定版本返回文件内容

#### 场景：文件未找到
- **当** 客户端请求 skill 中不存在的路径时
- **则** 系统应返回 404 Not Found

### 需求：软删除 skill
系统应提供一个端点来通过设置 is_deleted 标志软删除 skill。

#### 场景：删除存在的 skill
- **当** 客户端发送 DELETE /api/v1/skills/{slug} 时
- **则** 系统应将 is_deleted 设置为 TRUE 并返回成功

#### 场景：删除已删除的 skill
- **当** 客户端尝试删除已删除的 skill 时
- **则** 系统应返回 404 Not Found

### 需求：恢复 skill
系统应提供一个端点来恢复已软删除的 skill。

#### 场景：恢复已删除的 skill
- **当** 客户端为已删除的 skill 发送 POST /api/v1/skills/{slug}/undelete 时
- **则** 系统应将 is_deleted 设置为 FALSE 并返回成功

#### 场景：恢复活跃的 skill
- **当** 客户端尝试恢复未删除的 skill 时
- **则** 系统应返回 400 Bad Request 并附带适当的错误消息

### 需求：列表响应格式
系统应按照标准 schema 格式返回 skills 列表。

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
  - nextCursor: string | null（用于分页）

#### 场景：空列表结果
- **当** 没有 skills 时
- **则** 系统应返回 `{ "items": [], "nextCursor": null }`

### 需求：技能详情响应格式
系统应按照标准 schema 格式返回单个技能详情。

#### 场景：标准技能响应结构
- **当** 技能详情请求成功时
- **则** 系统应返回 JSON 响应，包含：
  - skill: object（包含 slug、displayName、summary、tags、stats、createdAt、updatedAt）
  - latestVersion: object（包含 version、createdAt、changelog）
  - owner: object（包含 handle、displayName、image）

### 需求：分页参数
系统应支持基于游标的分页。

#### 场景：默认分页
- **当** 客户端请求不带 limit 参数时
- **则** 系统应使用默认 limit（25）

#### 场景：最大分页限制
- **当** 客户端请求 limit 超过 100 时
- **则** 系统应将 limit 上限设为 100

#### 场景：游标分页
- **当** 客户端提供 cursor 参数时
- **则** 系统应返回游标之后的结果

### 需求：错误响应格式
系统应使用统一的错误响应格式。

#### 场景：404 错误
- **当** 资源未找到时
- **则** 系统应返回 404 并附带 `{ "error": "not found" }`

#### 场景：400 错误
- **当** 请求参数无效时
- **则** 系统应返回 400 并附带 `{ "error": "invalid request", "details": "..." }`
