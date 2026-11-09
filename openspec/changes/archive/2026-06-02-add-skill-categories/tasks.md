## 1. 数据库与模型

- [x] 1.1 在 `backend/data/sql/<YYYYMMDDHHMM>/` 生成本次数据库变更目录，并按仓库规范准备 `schema.sql`、`data.sql`、`upgrade.sql`
- [x] 1.2 仅在 `backend/data/sql/<YYYYMMDDHHMM>/upgrade.sql` 中创建 `skill_categories` 和 `skill_category_assignments` 表及必要索引，不新增 `backend/internal/database/migrations` 文件
- [x] 1.3 不插入默认分类、不回填默认分类；历史无分类关联的 skills 按无分类即未分类处理
- [x] 1.4 在 Go model 中新增分类 DTO、数据库模型和 `SkillItem.categories` / `SearchResult.categories`
- [x] 1.5 扩展 `PublishPayload` 支持可选 `categorySlugs`

## 2. 后端分类服务与 API

- [x] 2.1 新增分类服务方法：列出分类、创建分类、更新分类、删除分类、解析分类 slug、设置 skill 分类
- [x] 2.2 实现公共接口 `GET /api/v1/categories`
- [x] 2.3 实现 admin 分类接口 `GET/POST/PATCH/DELETE /api/v1/admin/categories`
- [x] 2.4 实现 `PATCH /api/v1/admin/skills/:slug/categories`，并复用 superuser 权限校验
- [x] 2.5 实现普通分类 hard delete 后的事务化关联清理：无剩余分类的 skill 保持无分类状态并展示为 `未分类`
- [x] 2.6 将 `uncategorized` 作为虚拟未分类筛选 slug，禁止创建、更新或删除同名真实分类

## 3. 后端发布、列表、详情与搜索

- [x] 3.1 在发布事务中处理 `categorySlugs`：新 skill 缺省或空数组都不创建分类关联，视为未分类
- [x] 3.2 在发布已有 skill 新版本时，`categorySlugs` 缺省或空数组都清空现有分类关联，视为未分类
- [x] 3.3 发布时校验分类 slug 存在且可用；无效分类返回稳定错误信息且不创建版本
- [x] 3.4 扩展 skills 列表查询，支持 `category=<slug>` 单分类筛选、`category=uncategorized` 无分类筛选，并保持排序、精选筛选和 cursor 分页
- [x] 3.5 扩展 skill 详情、用户 skills、收藏 skills、my skills 和 admin skills 响应，返回 `categories`
- [x] 3.6 扩展搜索接口，支持 `category=<slug>` 筛选，并在搜索结果中返回 `categories`
- [x] 3.7 批量加载分类映射，避免列表、搜索和管理页出现按 skill 逐条查询分类的问题

## 4. 前端类型、请求与共享展示

- [x] 4.1 更新 `src/types/api.ts` 和 `packages/schema/src/schemas.ts`，加入 `Category`、`categories` 和 `categorySlugs`
- [x] 4.2 新增或复用前端 query hook 获取 `GET /api/v1/categories`
- [x] 4.3 更新 `mapSkillItemToPublicSkill` 和 `PublicSkill`，保留 `tags` 并新增 `categories`
- [x] 4.4 更新 `SkillCard`、skills 列表行、用户页、首页和详情页展示分类标签
- [x] 4.5 避免将分类与详情页版本 `tagEntries` 或文件接口 `tag` 查询参数混用

## 5. 上传、导入与浏览筛选

- [x] 5.1 在 `/upload` 加载分类列表并展示多选分类控件，未选择时不写入分类关联并展示为未分类
- [x] 5.2 上传提交 payload 时写入 `categorySlugs`，并继续保留现有自由标签 `tags`
- [x] 5.3 在 `/import` 加载分类列表，并在 GitHub/GitLab 导入发布 payload 中写入 `categorySlugs`
- [x] 5.4 在 `/skills` validateSearch、browse model、toolbar 和 query key 中加入 `category`
- [x] 5.5 切换分类筛选时重新请求第一页，并确保加载更多继续携带当前 `category`
- [x] 5.6 搜索状态下同步传递 `category`，确保搜索和浏览使用同一分类筛选

## 6. 管理后台

- [x] 6.1 将 `/management` tab 扩展为 `skills | maintenance | categories`，非法 tab 仍回退到 skills
- [x] 6.2 分类 tab 只在 superuser 可见，并且非 superuser 不请求 admin 分类接口
- [x] 6.3 分类 tab 支持创建、更新、hard delete 分类，并禁止将虚拟 `uncategorized` 作为真实分类管理
- [x] 6.4 skill 管理列表展示当前分类，并提供调整分类的交互
- [x] 6.5 调整单个 skill 分类后刷新 admin skills 列表和分类相关 query
- [x] 6.6 扩展 admin 分类列表接口和前端分类 tab，支持 `q` 查询、分页加载和空/失败状态
- [x] 6.7 分类表单增加必填、slug 格式和虚拟 `uncategorized` 的页面内校验反馈，避免静默失败
- [x] 6.8 分类创建表单增加明确 label、字段说明和按 10 步长自动建议排序值
- [x] 6.9 优化分类管理 tab 的视觉层级、表单布局、列表卡片和空/失败状态呈现
- [x] 6.10 优化维护任务 tab 的视觉层级、执行说明、状态反馈和结果指标呈现
- [x] 6.11 优化管理后台 tab 导航布局，增加分区说明、选中状态和响应式卡片式导航

## 7. 测试与验证

- [x] 7.1 补充后端集成测试：无分类即未分类、历史无关联展示、新 skill 缺省/空数组未分类、多分类发布、已有 skill 缺省/空数组清空分类
- [x] 7.2 补充后端 admin 测试：分类 CRUD、禁止真实 `uncategorized`、hard delete 分类后无关联 skill 显示未分类、非 superuser 403
- [x] 7.3 补充列表和搜索测试：分类筛选、`uncategorized` 无分类筛选、分页保持分类条件、无效分类返回空结果且不返回全量
- [x] 7.4 补充前端上传和导入测试：分类选择进入 `categorySlugs`，自由标签仍进入 `tags`
- [x] 7.5 补充前端 skills 页面测试：分类筛选 URL 状态、query key、分页重置和加载更多参数
- [x] 7.6 补充 management 测试：categories tab 权限、CRUD 调用、禁止管理虚拟 `uncategorized`、skill 分类调整
- [x] 7.7 运行 `openspec validate add-skill-categories --strict`
- [x] 7.8 运行相关后端 Go 测试、前端 Vitest 测试和 schema 测试
- [x] 7.9 补充后端 admin 分类测试：`q` 查询、`limit/cursor` 分页、排序稳定和非 superuser 仍被拒绝
- [x] 7.10 补充前端 management 测试：查询参数、加载更多追加、空/失败状态和表单校验不发请求
- [x] 7.11 重新运行 `openspec validate add-skill-categories --strict`、相关后端 Go 测试、前端 Vitest 测试和 lint
- [x] 7.12 补充前端 management 测试：字段 label/说明、自动排序建议值和视觉结构关键文案
- [x] 7.13 重新运行 `openspec validate add-skill-categories --strict`、management Vitest 和相关 lint
- [x] 7.14 补充前端 management 测试：维护任务 tab 的控制台文案和结果指标
- [x] 7.15 重新运行 `openspec validate add-skill-categories --strict`、management Vitest 和相关 lint
- [x] 7.16 补充前端 management 测试：tab 导航文案、可访问导航区域和当前选中状态
- [x] 7.17 重新运行 `openspec validate add-skill-categories --strict`、management Vitest 和相关 lint
