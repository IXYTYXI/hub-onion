## ADDED Requirements

### Requirement: skill 响应返回分类
系统 SHALL 在公共 skill 列表、详情以及复用 `SkillItem` 的响应中返回分类信息。

#### Scenario: 列表响应包含分类
- **WHEN** 客户端请求 `GET /api/v1/skills`
- **THEN** 每个 skill item SHALL 包含 `categories`
- **THEN** `categories` 中每个分类 SHALL 至少包含 `slug`、`name` 和 `sortOrder`

#### Scenario: 详情响应包含分类
- **WHEN** 客户端请求 `GET /api/v1/skills/{slug}`
- **THEN** 响应中的 `skill.categories` SHALL 返回该 skill 当前分类

#### Scenario: 复用 SkillItem 的响应路径一致
- **WHEN** 系统返回公共列表、skill 详情、用户公开 skills、当前用户收藏、当前用户 my skills 或 admin skills 中的 skill item
- **THEN** 每个响应路径 SHALL 使用一致的分类装配逻辑
- **THEN** 每个 skill item SHALL 包含 `categories`
- **THEN** 无分类 skill 在所有响应路径中 SHALL 返回空的 `categories`

#### Scenario: 无历史分类时返回空分类集合
- **WHEN** 某个历史 skill 没有任何分类关联
- **THEN** 系统 SHALL 在响应中返回空的 `categories`
- **THEN** 前端 SHALL 将空分类集合展示为 `未分类`

### Requirement: 按分类列出 skills
系统 SHALL 支持通过单个分类筛选公共 skills 列表，并保持分页语义一致。

#### Scenario: 按分类筛选列表
- **WHEN** 客户端请求 `GET /api/v1/skills?category={slug}`
- **THEN** 系统 SHALL 只返回关联该分类的 active 且未删除 skills
- **THEN** 系统 SHALL 保留现有排序参数语义

#### Scenario: 分类筛选联动分页
- **WHEN** 客户端请求带 `category` 的第二页列表
- **THEN** 系统 SHALL 在同一分类筛选条件下应用 cursor
- **THEN** 系统 MUST NOT 返回其他分类的 skills

#### Scenario: 未分类筛选
- **WHEN** 客户端请求 `GET /api/v1/skills?category=uncategorized`
- **THEN** 系统 SHALL 返回没有任何分类关联的 skills
- **THEN** 系统 MUST NOT 将 `uncategorized` 当作真实分类 slug 查询 `skill_categories`

#### Scenario: 分类不存在
- **WHEN** 客户端请求不存在或不可用的分类 slug
- **THEN** 系统 SHALL 返回空列表
- **THEN** 系统 MUST NOT 返回未筛选的全量列表

#### Scenario: 分类筛选不引入 N+1 查询
- **WHEN** 系统返回分页列表或其他批量 skill item 响应
- **THEN** 系统 SHALL 批量加载 skill 与分类映射
- **THEN** 系统 MUST NOT 为每个 skill 单独查询分类
