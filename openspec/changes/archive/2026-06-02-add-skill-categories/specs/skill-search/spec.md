## ADDED Requirements

### Requirement: 搜索按分类筛选
系统 SHALL 支持在搜索时按单个分类筛选结果。

#### Scenario: 搜索时带分类
- **WHEN** 客户端请求 `GET /api/v1/search?q={query}&category={slug}`
- **THEN** 系统 SHALL 只返回同时匹配查询词并关联该分类的 active 且未删除 skills
- **THEN** 搜索排序 SHALL 继续按现有相关性规则执行

#### Scenario: 搜索未分类
- **WHEN** 客户端请求 `GET /api/v1/search?q={query}&category=uncategorized`
- **THEN** 系统 SHALL 只返回没有任何分类关联的匹配 skills
- **THEN** 系统 MUST NOT 将 `uncategorized` 当作真实分类 slug 查询 `skill_categories`

#### Scenario: 搜索分类不存在
- **WHEN** 客户端搜索时传入不存在或不可用的分类 slug
- **THEN** 系统 SHALL 返回空结果
- **THEN** 系统 MUST NOT 返回未筛选的搜索结果

### Requirement: 搜索结果返回分类
系统 SHALL 在搜索结果中返回 skill 分类，供前端列表展示。

#### Scenario: 搜索结果包含 categories
- **WHEN** 搜索请求成功并返回结果
- **THEN** 每个结果项 SHALL 包含 `categories`
- **THEN** `categories` 中每个分类 SHALL 至少包含 `slug`、`name` 和 `sortOrder`
- **THEN** 无分类结果 SHALL 返回空的 `categories`

#### Scenario: 搜索分类装配不引入 N+1 查询
- **WHEN** 搜索接口返回多个结果
- **THEN** 系统 SHALL 批量加载结果 skill 的分类映射
- **THEN** 系统 MUST NOT 为每个搜索结果单独查询分类
