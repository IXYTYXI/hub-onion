## ADDED Requirements

### Requirement: 受管理的 skill 分类
系统 SHALL 提供独立于自由标签 `tags` 的 skill 分类体系，用于平台统一归类和筛选。

#### Scenario: 无分类即未分类
- **WHEN** 某个 skill 没有任何分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类
- **THEN** 系统 MUST NOT 为 `未分类` 创建独立的实体分类记录

#### Scenario: 分类独立于 tags
- **WHEN** skill 同时拥有自由标签和分类
- **THEN** 系统 SHALL 分别保存 `tags` 与 `categories`
- **THEN** 系统 MUST NOT 将自由标签自动转换为分类

### Requirement: 公共分类列表
系统 SHALL 提供公共分类列表接口，供上传、导入和浏览页获取可选分类。

#### Scenario: 获取分类列表
- **WHEN** 客户端请求 `GET /api/v1/categories`
- **THEN** 系统 SHALL 返回所有可用分类
- **THEN** 响应项 SHALL 至少包含 `slug`、`name` 和 `sortOrder`
- **THEN** 响应 MUST NOT 将虚拟未分类状态作为实体分类返回

#### Scenario: 分类排序
- **WHEN** 客户端请求公共分类列表
- **THEN** 系统 SHALL 按 `sortOrder` 升序返回分类
- **THEN** 当 `sortOrder` 相同时 SHALL 使用名称或 slug 保持稳定排序

### Requirement: superuser 分类 CRUD
系统 SHALL 允许 superuser 在管理后台维护分类，并拒绝非 superuser 操作。

#### Scenario: superuser 创建分类
- **WHEN** 命中 superuser 配置列表的用户请求 `POST /api/v1/admin/categories`
- **THEN** 系统 SHALL 创建分类并返回创建后的分类对象
- **THEN** 系统 SHALL 校验 slug 唯一且只包含小写字母、数字和短横线
- **THEN** 系统 MUST NOT 允许创建 slug 为 `uncategorized` 的实体分类

#### Scenario: superuser 查询分类列表
- **WHEN** 命中 superuser 配置列表的用户请求 `GET /api/v1/admin/categories?q={query}`
- **THEN** 系统 SHALL 只返回名称、slug 或描述匹配查询词的真实分类
- **THEN** 匹配 SHALL 使用大小写不敏感的模糊包含语义
- **THEN** 响应项 SHALL 至少包含 `slug`、`name`、`description` 和 `sortOrder`

#### Scenario: superuser 分页获取分类列表
- **WHEN** 命中 superuser 配置列表的用户请求 `GET /api/v1/admin/categories?limit={limit}`
- **THEN** 系统 SHALL 按 `sortOrder` 升序、slug 升序返回分类
- **THEN** 系统 SHALL 将 `limit` 约束在安全上限内
- **THEN** 若仍有下一页，响应 SHALL 返回 `nextCursor`
- **WHEN** 客户端携带 `cursor` 请求下一页
- **THEN** 系统 SHALL 在同一 `q` 查询条件和排序条件下返回后续分类

#### Scenario: superuser 更新分类
- **WHEN** 命中 superuser 配置列表的用户请求 `PATCH /api/v1/admin/categories/{slug}`
- **THEN** 系统 SHALL 更新分类名称、描述或排序字段
- **THEN** 系统 MUST NOT 允许把分类 slug 更新为 `uncategorized`

#### Scenario: 非 superuser 被拒绝
- **WHEN** 未认证用户或非 superuser 请求任一 `/api/v1/admin/categories` 接口
- **THEN** 系统 SHALL 返回 401 或 403
- **THEN** 系统 MUST NOT 创建、更新或删除分类

### Requirement: 删除分类后无分类即未分类
系统 SHALL 在 hard delete 普通分类后保留无分类 skill 的未分类状态。

#### Scenario: hard delete 普通分类
- **WHEN** superuser 请求删除一个真实分类
- **THEN** 系统 SHALL hard delete 该分类
- **THEN** 系统 SHALL 移除该分类与 skill 的关联
- **THEN** 分类删除和关联清理 SHALL 在同一个数据库事务内完成

#### Scenario: 删除后自然进入未分类
- **WHEN** 某个 skill 在分类删除后不再关联任何分类
- **THEN** 系统 SHALL 保持该 skill 没有分类关联
- **THEN** 系统 SHALL 在展示和筛选时将该 skill 视为未分类

#### Scenario: 虚拟未分类不可删除
- **WHEN** superuser 请求删除虚拟 slug `uncategorized`
- **THEN** 系统 SHALL 返回稳定错误信息
- **THEN** 系统 MUST NOT 修改任何分类或 skill 分类关联

#### Scenario: 删除事务失败不产生半删状态
- **WHEN** hard delete 分类或关联清理任一步失败
- **THEN** 系统 SHALL 回滚整个删除事务
- **THEN** 系统 MUST NOT 留下分类已删除但关联未清理的状态

### Requirement: 管理 skill 分类分配
系统 SHALL 允许 superuser 为已发布 skill 设置一个或多个分类。

#### Scenario: 设置 skill 分类
- **WHEN** superuser 请求 `PATCH /api/v1/admin/skills/{slug}/categories` 并提交 `categorySlugs`
- **THEN** 系统 SHALL 将该 skill 的分类替换为请求中的分类集合
- **THEN** 响应 SHALL 返回更新后的 skill 分类

#### Scenario: 空分类集合转未分类状态
- **WHEN** superuser 为 skill 提交空的 `categorySlugs`
- **THEN** 系统 SHALL 清空该 skill 的所有分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类

#### Scenario: 无效分类被拒绝
- **WHEN** 请求中的任一分类 slug 不存在或不可用
- **THEN** 系统 SHALL 返回稳定错误信息
- **THEN** 系统 MUST NOT 修改该 skill 现有分类

#### Scenario: 虚拟未分类不能作为写入分类
- **WHEN** 请求中的 `categorySlugs` 包含 `uncategorized`
- **THEN** 系统 SHALL 返回稳定错误信息
- **THEN** 系统 MUST NOT 将 `uncategorized` 写入分类关联表
