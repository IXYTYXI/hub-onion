## Why

当前 skill 只有自由标签 `tags`，缺少由平台统一维护的分类体系，导致用户无法按稳定分类浏览，管理员也无法对已发布 skill 做统一归类。

新增独立分类能力后，历史 skill、新发布 skill、导入发布、列表筛选和详情展示都可以围绕同一套受管理的分类数据工作，并保留现有 `tags` 的兼容语义。

## What Changes

- 新增独立的 skill 分类体系；`未分类` 不作为实体分类，skill 没有任何分类关联时即视为未分类。
- 为 superuser 的 `/management` 管理后台新增分类管理入口，支持分类创建、查看、更新、删除。
- 删除普通分类时 hard delete 并自动移除关联；若某个 skill 删除后没有任何分类，则自然展示为 `未分类`。
- 上传和导入发布 skill 时支持多选分类；未选择任何分类时不写入分类关联。
- 后端发布 payload 新增可选 `categorySlugs`，保留现有 `tags` 字段与 CLI 兼容性。
- skills 列表页支持按单个分类筛选，并与当前排序、分页、精选筛选逻辑联动。
- skill 列表、搜索结果、详情页、首页卡片、用户页、收藏页和管理列表展示分类信息。
- 管理后台支持 superuser 调整单个已发布 skill 的分类，覆盖历史数据归类场景。

## Capabilities

### New Capabilities

- `skill-categories`: 定义平台受管理的 skill 分类、无分类即未分类语义、分类 CRUD、分类分配和公共分类列表。

### Modified Capabilities

- `skill-publishing`: 发布 payload 支持 `categorySlugs`，并明确缺省和空分类都表示未分类。
- `skill-crud-operations`: skills 列表和详情响应返回分类，并支持列表按单个分类筛选。
- `skill-search`: 搜索接口支持按单个分类筛选，并在搜索结果中返回分类。
- `skill-management-surfaces`: superuser 管理后台增加分类管理和单个 skill 分类调整入口。
- `upload-page-authoring`: 上传页增加分类多选控件，并在未选择分类时不写入分类关联。

## Impact

- 后端：新增分类模型、分类服务、公共分类接口、admin 分类接口、发布事务中的分类分配、列表/详情/搜索查询的分类加载与筛选。
- 数据库：新增分类表和 skill 分类关联表；不插入默认分类、不回填默认分类；数据库变更只使用 `backend/data/sql/<YYYYMMDDHHMM>/` 纯 SQL 备份/升级文件。
- 前端：上传页、导入页、skills 浏览页、详情页、SkillCard、管理后台和相关 API 类型需要扩展分类字段。
- Schema/CLI：`packages/schema` 需要接受新增 `categories` 字段和可选 `categorySlugs`，但旧 CLI 只传 `tags` 时仍应正常发布到 `未分类`。
