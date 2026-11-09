## Context

当前 Go 后端的 `skills.tags` 是自由标签数组，上传页和导入页都会把逗号分隔标签写入 `PublishPayload.tags`。公共列表、详情、搜索、首页、用户页、收藏页和管理列表都复用 `SkillItem` 数据结构，但没有受管理员维护的分类字段。

管理后台 `/management` 已按 tab 组织，并且 admin API 在 handler 内要求当前用户命中 superuser 配置列表。分类功能跨数据库、发布事务、查询响应、前端筛选和管理后台，因此需要独立设计。

## Goals / Non-Goals

**Goals:**

- 新增独立于 `tags` 的受管理分类体系，并保留旧 `tags` 兼容性。
- 支持“无分类即未分类”的展示和筛选语义；无显式分类时不写入任何分类关联。
- 支持 superuser 管理分类和调整已发布 skill 分类。
- 支持上传、导入、列表筛选、详情展示、公共卡片展示和分页联动。
- 为历史数据提供可执行的数据库迁移和回填路径。

**Non-Goals:**

- 不废弃或重命名现有 `tags` 字段。
- 不实现多分类 OR/AND 列表筛选；本次只实现单分类筛选。
- 不改变 CLI 旧发布请求的必填字段；旧 CLI 不传分类时仍可发布。
- 不引入搜索引擎或新的外部依赖。

## Decisions

### 决策一：分类独立于现有 tags，未分类不是实体分类

新增 `skill_categories` 与 `skill_category_assignments` 两张表：

- `skill_categories` 保存分类元数据，包含 `id`、`slug`、`name`、`description`、`sort_order`、`created_at`、`updated_at`。
- `skill_category_assignments` 保存 skill 与分类的多对多关系，建议以 `(skill_id, category_id)` 作为唯一约束。
- `未分类` 不作为 `skill_categories` 中的实体记录；某个 skill 没有任何分类关联时，即视为未分类。
- `uncategorized` 作为公共列表和搜索的虚拟筛选 slug 保留，表示筛选没有任何分类关联的 skill，并禁止创建同名真实分类。

理由：现有 `tags` 已被上传、导入、CLI、搜索和卡片展示使用。把 `tags` 改造成分类会改变既有语义，并和详情页里的版本标签概念混淆。

### 决策二：API 使用 slug 作为分类输入，响应返回轻量对象

发布和管理写入接口使用 `categorySlugs: string[]`，服务端解析为真实分类 ID。公共响应返回真实分类对象；没有分类关联的 skill 返回空数组，由前端展示为 `未分类`：

```json
{
  "categories": []
}
```

理由：slug 适合进入 URL 和 payload，前端无需知道数据库 UUID；响应轻量对象足够展示和筛选。

### 决策三：缺省和空数组都表示未分类

- 新建 skill 且 `categorySlugs` 缺省或为空数组时，不创建任何分类关联，skill 视为未分类。
- 更新已有 skill 且 `categorySlugs` 缺省或为空数组时，清空现有分类关联，skill 视为未分类。
- 如果传入不存在、被删除或重复分类 slug，后端返回稳定错误信息，并不创建版本或修改分类。

理由：用户已确认缺省/空数组本身就是未分类，不再为 `未分类` 维护独立实体分类。代价是旧客户端更新已有 skill 且不传分类时，会把该 skill 重新归为未分类。

### 决策四：删除分类使用 hard delete

删除分类时执行 hard delete，并在同一个事务内移除该分类关联；对删除后没有剩余分类的 skill，不再补写任何默认分类关联，而是自然进入未分类状态。`uncategorized` 是虚拟状态，不可作为真实分类创建或删除。

理由：用户已确认 hard delete 可以避免软删除带来的 slug/name 重复和长期数据歧义。无分类即未分类的语义可以消除默认分类回填逻辑。

### 决策五：分类查询避免 N+1

`SkillService` 在列表、搜索、详情、用户 skills、收藏、管理列表等返回 `SkillItem` 的路径中批量加载分类映射，并由 `skillToItem` 或包装函数写入 `categories`。列表筛选通过 `category=<slug>` join 关联表实现；当 `category=uncategorized` 时筛选没有任何分类关联的 skill；cursor 只在当前筛选条件下生效。

理由：分类是公共展示字段，不能只在某几个页面补；批量映射可以避免列表页每个 skill 单独查分类。

### 决策六：管理后台复用 `/management` tab

新增 `categories` tab，沿用 `/management?tab=skills|maintenance|categories`。分类 tab 只在 superuser 可见，并调用 `/api/v1/admin/categories` 系列接口；skill 管理列表增加分类展示和“调整分类”动作，调用 `PATCH /api/v1/admin/skills/:slug/categories`。

理由：现有管理后台已经承载 skill 和维护任务，复用它可以保持权限、导航和测试模式一致。

分类管理列表使用服务端分页和查询：`GET /api/v1/admin/categories` 支持 `q`、`limit`、`cursor`，按 `sortOrder ASC, slug ASC` 稳定排序，返回 `items` 和可选 `nextCursor`。`q` 对 slug、名称和描述做大小写不敏感的包含匹配。前端在分类 tab 中维护查询词，查询变化时回到第一页；加载更多时携带当前查询条件和 cursor 并追加结果。创建、更新、删除成功后刷新当前查询条件下的列表，避免用户在管理大量分类时被迫拉取全量数据。

理由：分类数量早期可能不多，但管理后台需要明确支持后续规模增长；服务端分页比前端全量过滤更符合现有 skills 列表的分页方向，也能避免查询结果与真实数据状态脱节。

分类创建表单必须解释每个输入项的含义：slug 是稳定 API 标识，名称是前台展示名，描述用于管理和搜索理解，排序值控制分类列表顺序。新建分类默认使用当前已加载分类最大 `sortOrder` 的下一个 10 步长（无分类时为 10），例如 10、20、30。保留排序输入框允许管理员在两个分类之间插入新项，例如在 20 与 30 之间填 25，避免后续为了插队而批量改动已有分类。

理由：`sortOrder` 是管理概念，裸露数字会让用户困惑；以 10 为步长自动建议可以降低创建成本，同时为未来人工插队留出空间。

### 决策七：前端筛选使用单选 URL 参数

`/skills` 新增 `category` search 参数。切换分类时重置分页查询，TanStack Query key 包含 `category`，列表请求传 `category=<slug>`。搜索状态下也传同一个分类参数。

理由：单选筛选实现稳定，分页语义清晰，满足本次需求。

## Risks / Trade-offs

- [Risk] 新增 `categories` 字段可能影响旧 schema 校验 → `packages/schema` 将字段声明为可选并保留旧 `tags`。
- [Risk] 旧客户端更新版本时分类被清空 → 当前接受该行为，`categorySlugs` 缺省和空数组都表示未分类。
- [Risk] 删除分类导致部分 skill 无分类 → 当前这是预期状态，无分类即未分类；删除分类和关联清理仍必须事务化。
- [Risk] 列表/搜索 join 影响性能 → 关联表建立 `category_id`、`skill_id` 索引，并在无分类筛选时保持现有查询路径。
- [Risk] 分类与现有版本标签/自由标签混淆 → 前后端字段统一命名为 `categories` / `categorySlugs`，不使用 `tag` 查询参数。

## Migration Plan

1. 按仓库数据库要求，先在 `backend/data/sql/<YYYYMMDDHHMM>/` 生成 `schema.sql`、`data.sql`、`upgrade.sql`，`upgrade.sql` 头部记录执行时间。
2. 仅使用 `backend/data/sql/<YYYYMMDDHHMM>/upgrade.sql` 创建分类表和关联表；不新增 `backend/internal/database/migrations` 文件，不插入默认分类，也不将历史 skill 回填到默认分类。
3. 部署后端模型、服务和 API；验证 `GET /api/v1/categories` 返回真实分类列表，未分类由空关联状态表达。
4. 部署前端分类选择、筛选和展示逻辑。
5. 回滚时先停止前端分类入口，再回滚后端迁移；如果保留数据表不影响旧代码，也可只隐藏入口并保留表数据。

## Open Questions

无。当前默认采用：独立分类、列表单选筛选、hard delete 分类、无分类即未分类。
