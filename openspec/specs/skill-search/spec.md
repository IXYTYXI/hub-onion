## 新增需求

### 需求：使用 ILIKE 进行全文本搜索
系统应使用 PostgreSQL ILIKE 模式匹配实现全文本搜索。

#### 场景：按 display_name 搜索
- **当** 客户端请求 GET /api/v1/search?q=authentication 时
- **则** 系统应返回 display_name 包含"authentication"的 skills（不区分大小写）

#### 场景：按 description 搜索
- **当** 客户端请求 GET /api/v1/search?q=oauth 时
- **则** 系统应返回 description 包含"oauth"的 skills（不区分大小写）

#### 场景：按标签精确匹配
- **当** 客户端请求 GET /api/v1/search?q=security 时
- **则** 系统应返回 tags 数组中包含"security"的 skills

#### 场景：空搜索查询
- **当** 客户端请求 GET /api/v1/search 而不带 q 参数时
- **则** 系统应返回 400 Bad Request

### 需求：三元组相似度排名
系统应使用 PostgreSQL pg_trgm 扩展进行基于相似度的搜索结果排名。

#### 场景：按相关性排序结果
- **当** 搜索返回多个结果时
- **则** 系统应按相似度分数排序结果（先 display_name 相似度，然后 description 相似度）

#### 场景：最低相似度阈值
- **当** 计算相似度分数时
- **则** 系统应只包含相似度分数高于 0.1 的结果

### 需求：搜索结果限制
系统应限制搜索结果数量以防止性能问题。

#### 场景：默认结果限制
- **当** 客户端搜索时不指定限制
- **则** 系统应返回最多 25 个结果

#### 场景：自定义结果限制
- **当** 客户端请求 GET /api/v1/search?q=test&limit=50 时
- **则** 系统应返回最多 50 个结果

#### 场景：强制执行最大限制
- **当** 客户端请求大于 100 的限制时
- **则** 系统应将限制上限设为 100

### 需求：搜索仅过滤活跃 skills
系统应仅搜索活跃的、未删除的 skills。

#### 场景：从搜索中排除已删除的 skills
- **当** 执行搜索时
- **则** 系统应过滤 WHERE is_deleted = FALSE

#### 场景：排除非活跃审核状态
- **当** 执行搜索时
- **则** 系统应过滤 WHERE moderation_status = 'active'

### 需求：pg_trgm 扩展要求
系统应要求启用 pg_trgm PostgreSQL 扩展。

#### 场景：启动时扩展检查
- **当** 服务器启动时
- **则** 系统应验证 pg_trgm 扩展已启用，否则失败并返回清晰的错误消息

#### 场景：用于性能的 GIN 索引
- **当** 数据库迁移运行时
- **则** 系统应使用 gin_trgm_ops 在 display_name 和 description 上创建 GIN 索引

### 需求：搜索响应格式
系统 SHALL 按照标准 schema 格式返回搜索结果，并在有结果和无结果场景下都保持 CLI 可解析的对象包装结构。

#### 场景：标准响应结构
- **当** 搜索请求成功时
- **则** 系统应返回 JSON 响应，包含 results 数组，每个元素包含：
  - slug: string（技能标识符）
  - displayName: string（显示名称）
  - summary: string | null（简短描述）
  - version: string | null（最新版本号）
  - score: number（相似度分数）
  - updatedAt: number（可选，更新时间戳）

#### 场景：空搜索结果
- **当** 没有找到匹配的技能时
- **则** 系统应返回空数组 `{ "results": [] }`

#### 场景：CLI 搜索兼容
- **当** `packages/clawdhub` CLI 调用 `/api/v1/search`
- **则** 系统应返回与 `ApiV1SearchResponseSchema` 一致的对象结构，使 CLI 在 schema 校验后可直接读取 `result.results`

### 需求：搜索错误处理
系统应正确处理搜索相关的错误情况。

#### 场景：特殊字符转义
- **当** 查询包含 SQL 通配符（如 %、_）时
- **则** 系统应正确转义这些字符以防止意外匹配

#### 场景：查询长度限制
- **当** 查询字符串超过 200 字符时
- **则** 系统应截断查询或返回 400 Bad Request

### 需求：搜索按分类筛选
系统 SHALL 支持在搜索时按单个分类筛选结果。

#### 场景：搜索时带分类
- **WHEN** 客户端请求 `GET /api/v1/search?q={query}&category={slug}`
- **THEN** 系统 SHALL 只返回同时匹配查询词并关联该分类的 active 且未删除 skills
- **THEN** 搜索排序 SHALL 继续按现有相关性规则执行

#### 场景：搜索未分类
- **WHEN** 客户端请求 `GET /api/v1/search?q={query}&category=uncategorized`
- **THEN** 系统 SHALL 只返回没有任何分类关联的匹配 skills
- **THEN** 系统 MUST NOT 将 `uncategorized` 当作真实分类 slug 查询 `skill_categories`

#### 场景：搜索分类不存在
- **WHEN** 客户端搜索时传入不存在或不可用的分类 slug
- **THEN** 系统 SHALL 返回空结果
- **THEN** 系统 MUST NOT 返回未筛选的搜索结果

### 需求：搜索结果返回分类
系统 SHALL 在搜索结果中返回 skill 分类，供前端列表展示。

#### 场景：搜索结果包含 categories
- **WHEN** 搜索请求成功并返回结果
- **THEN** 每个结果项 SHALL 包含 `categories`
- **THEN** `categories` 中每个分类 SHALL 至少包含 `slug`、`name` 和 `sortOrder`
- **THEN** 无分类结果 SHALL 返回空的 `categories`

#### 场景：搜索分类装配不引入 N+1 查询
- **WHEN** 搜索接口返回多个结果
- **THEN** 系统 SHALL 批量加载结果 skill 的分类映射
- **THEN** 系统 MUST NOT 为每个搜索结果单独查询分类
