## 新增需求

### 需求：列出 skills 并支持分页
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
系统 SHALL 提供一个端点来通过设置 is_deleted 标志软删除 skill，并返回 CLI 兼容的成功响应。

#### 场景：删除存在的 skill
- **当** 客户端发送 DELETE /api/v1/skills/{slug} 时
- **则** 系统应将 is_deleted 设置为 TRUE 并返回 `{ "ok": "true" }`

#### 场景：删除已删除的 skill
- **当** 客户端尝试删除已删除的 skill 时
- **则** 系统应返回 404 Not Found

### 需求：恢复 skill
系统 SHALL 提供一个端点来恢复已软删除的 skill，并返回 CLI 兼容的成功响应。

#### 场景：恢复已删除的 skill
- **当** 客户端为已删除的 skill 发送 POST /api/v1/skills/{slug}/undelete 时
- **则** 系统应将 is_deleted 设置为 FALSE 并返回 `{ "ok": "true" }`

#### 场景：恢复活跃的 skill
- **当** 客户端尝试恢复未删除的 skill 时
- **则** 系统应返回 400 Bad Request 并附带适当的错误消息

### 需求：列表响应格式
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

### 需求：技能详情响应格式
系统 SHALL 按照标准 schema 格式返回单个技能详情，并在可空字段缺失时显式返回 `null` 以满足 CLI 解析。

#### 场景：标准技能响应结构
- **当** 技能详情请求成功时
- **则** 系统应返回 JSON 响应，包含：
  - skill: object（包含 slug、displayName、summary、tags、stats、createdAt、updatedAt）
  - skill: object 可在前端需要时包含 highlighted
  - latestVersion: object | null（包含 version、createdAt、changelog）
  - owner: object | null（包含 handle、displayName、image）

#### 场景：缺失 owner 或 latestVersion
- **当** skill 没有 owner 或 latestVersion
- **则** 系统应显式返回 `owner: null` 或 `latestVersion: null`，而不是省略这些字段

### 需求：查询响应返回已保存简介
系统 SHALL 在 skills 列表、详情和搜索响应中通过现有 `summary` 字段返回已保存的 skill 简介。

#### 场景：列表页返回简介
- **当** 客户端请求 GET /api/v1/skills?sort=downloads 时
- **则** 响应中每个已保存简介的 skill item SHALL 包含 `summary`，其值来自 `skills.description`
- **则** 前端列表 SHALL 使用该 `summary` 展示简介，而不是展示“暂无简介。”

#### 场景：详情页返回简介
- **当** 客户端请求 GET /api/v1/skills/{slug} 且该 skill 已保存简介时
- **则** 响应中的 `skill.summary` SHALL 等于已保存的 `skills.description`
- **则** 前端详情页 SHALL 使用该 `summary` 展示简介，而不是展示“暂无简介。”

#### 场景：搜索结果返回简介
- **当** 客户端请求 GET /api/v1/search?q={query} 且返回结果包含已保存简介的 skill 时
- **则** 搜索结果中的 `summary` SHALL 等于已保存的 `skills.description`

#### 场景：无简介时保持空摘要
- **当** skill 没有保存简介时
- **则** 列表、详情和搜索响应 SHALL 返回 `summary: null` 或等价空值
- **则** 前端 SHALL 继续展示现有 fallback 文案

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

### 需求：skill 响应返回分类
系统 SHALL 在公共 skill 列表、详情以及复用 `SkillItem` 的响应中返回分类信息。

#### 场景：列表响应包含分类
- **当** 客户端请求 `GET /api/v1/skills`
- **则** 每个 skill item SHALL 包含 `categories`
- **则** `categories` 中每个分类 SHALL 至少包含 `slug`、`name` 和 `sortOrder`

#### 场景：详情响应包含分类
- **当** 客户端请求 `GET /api/v1/skills/{slug}`
- **则** 响应中的 `skill.categories` SHALL 返回该 skill 当前分类

#### 场景：复用 SkillItem 的响应路径一致
- **当** 系统返回公共列表、skill 详情、用户公开 skills、当前用户收藏、当前用户 my skills 或 admin skills 中的 skill item
- **则** 每个响应路径 SHALL 使用一致的分类装配逻辑
- **则** 每个 skill item SHALL 包含 `categories`
- **则** 无分类 skill 在所有响应路径中 SHALL 返回空的 `categories`

#### 场景：无历史分类时返回空分类集合
- **当** 某个历史 skill 没有任何分类关联
- **则** 系统 SHALL 在响应中返回空的 `categories`
- **则** 前端 SHALL 将空分类集合展示为 `未分类`

### 需求：按分类列出 skills
系统 SHALL 支持通过单个分类筛选公共 skills 列表，并保持分页语义一致。

#### 场景：按分类筛选列表
- **当** 客户端请求 `GET /api/v1/skills?category={slug}`
- **则** 系统 SHALL 只返回关联该分类的 active 且未删除 skills
- **则** 系统 SHALL 保留现有排序参数语义

#### 场景：分类筛选联动分页
- **当** 客户端请求带 `category` 的第二页列表
- **则** 系统 SHALL 在同一分类筛选条件下应用 cursor
- **则** 系统 MUST NOT 返回其他分类的 skills

#### 场景：未分类筛选
- **当** 客户端请求 `GET /api/v1/skills?category=uncategorized`
- **则** 系统 SHALL 返回没有任何分类关联的 skills
- **则** 系统 MUST NOT 将 `uncategorized` 当作真实分类 slug 查询 `skill_categories`

#### 场景：分类不存在
- **当** 客户端请求不存在或不可用的分类 slug
- **则** 系统 SHALL 返回空列表
- **则** 系统 MUST NOT 返回未筛选的全量列表

#### 场景：分类筛选不引入 N+1 查询
- **当** 系统返回分页列表或其他批量 skill item 响应
- **则** 系统 SHALL 批量加载 skill 与分类映射
- **则** 系统 MUST NOT 为每个 skill 单独查询分类
