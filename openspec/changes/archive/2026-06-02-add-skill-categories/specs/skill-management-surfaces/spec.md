## ADDED Requirements

### Requirement: management 分类管理场景
系统 SHALL 在 `/management` 管理后台提供 superuser 分类管理场景。

#### Scenario: 访问分类管理 tab
- **WHEN** superuser 访问 `/management?tab=categories`
- **THEN** 前端 SHALL 展示分类管理场景
- **THEN** 前端 SHALL 请求 `/api/v1/admin/categories` 获取分类列表
- **THEN** 前端 MUST NOT 将虚拟 `uncategorized` 作为真实分类展示在 CRUD 列表中

#### Scenario: 查询分类管理列表
- **WHEN** superuser 在分类管理 tab 输入查询词
- **THEN** 前端 SHALL 使用 `q` 参数重新请求 `/api/v1/admin/categories`
- **THEN** 查询结果 SHALL 只展示名称、slug 或描述匹配的真实分类
- **THEN** 前端 SHALL 在查询词变化时重置分页状态

#### Scenario: 分类管理列表分页
- **WHEN** `/api/v1/admin/categories` 返回 `nextCursor`
- **THEN** 前端 SHALL 展示加载更多或等效分页控件
- **WHEN** superuser 请求下一页
- **THEN** 前端 SHALL 携带当前 `q`、`limit` 和 `cursor` 请求下一页
- **THEN** 前端 SHALL 将下一页分类追加到当前列表

#### Scenario: 分类管理列表空状态与失败状态
- **WHEN** 分类管理列表请求成功但没有返回分类
- **THEN** 前端 SHALL 展示空状态文案
- **WHEN** 分类管理列表请求失败
- **THEN** 前端 SHALL 展示加载失败提示并允许用户重试

#### Scenario: 非 superuser 访问分类管理 tab
- **WHEN** 非 superuser 用户访问 `/management?tab=categories`
- **THEN** 前端 SHALL 展示无权限提示
- **THEN** 前端 MUST NOT 请求 `/api/v1/admin/categories`

#### Scenario: 非法 tab 回退
- **WHEN** 用户访问带非法 `tab` 值的 `/management`
- **THEN** 前端 SHALL 回退到现有默认 skills tab

#### Scenario: 管理后台 tab 导航视觉层级
- **WHEN** superuser 访问 `/management`
- **THEN** 前端 SHALL 以可访问的导航区域展示 skills、maintenance 和 categories 三个管理分区
- **THEN** 每个 tab SHALL 展示标题和用途说明，帮助管理员理解切换后的管理范围
- **THEN** 当前 tab SHALL 有明确的选中状态

#### Scenario: 维护任务 tab 视觉层级
- **WHEN** superuser 访问 `/management?tab=maintenance`
- **THEN** 前端 SHALL 以维护控制台形式展示任务说明、执行入口、执行约束和结果状态
- **THEN** 前端 SHALL 将扫描、更新、跳过和失败数量作为独立指标展示
- **THEN** 前端 SHALL 在任务运行中、部分失败和请求失败时展示醒目的状态反馈

### Requirement: management 分类 CRUD 交互
系统 SHALL 允许 superuser 在管理后台创建、更新和删除分类。

#### Scenario: 创建分类
- **WHEN** superuser 在分类管理 tab 提交新分类
- **THEN** 前端 SHALL 调用 `POST /api/v1/admin/categories`
- **THEN** 成功后 SHALL 刷新分类列表
- **THEN** 前端 SHALL 保持当前查询条件并回到第一页或刷新当前分类列表

#### Scenario: 更新分类
- **WHEN** superuser 编辑分类名称、描述或排序
- **THEN** 前端 SHALL 调用 `PATCH /api/v1/admin/categories/{slug}`
- **THEN** 成功后 SHALL 刷新分类列表
- **THEN** 前端 SHALL 保持当前查询条件并回到第一页或刷新当前分类列表

#### Scenario: 删除分类
- **WHEN** superuser 删除普通分类
- **THEN** 前端 SHALL 调用 `DELETE /api/v1/admin/categories/{slug}`
- **THEN** 成功后 SHALL 提示受影响 skill 将不再有分类并显示为 `未分类`
- **THEN** 前端 SHALL 保持当前查询条件并回到第一页或刷新当前分类列表

#### Scenario: 分类表单校验反馈
- **WHEN** superuser 提交分类表单但 slug 或名称为空
- **THEN** 前端 SHALL 在页面内展示明确校验错误
- **THEN** 前端 MUST NOT 调用创建或更新接口
- **WHEN** superuser 提交不符合格式的 slug
- **THEN** 前端 SHALL 在页面内展示 slug 格式错误
- **THEN** 前端 MUST NOT 调用创建接口

#### Scenario: 分类表单字段语义说明
- **WHEN** superuser 访问分类管理 tab
- **THEN** 创建或编辑分类表单中的 slug、名称、描述和排序字段 SHALL 都有明确 label
- **THEN** 每个字段 SHALL 展示用途说明，解释该值会影响 API 标识、前台展示、补充说明或列表顺序

#### Scenario: 新建分类自动建议排序值
- **WHEN** superuser 在分类管理 tab 新建分类
- **THEN** 前端 SHALL 根据当前已加载分类的最大 `sortOrder` 自动填入下一个 10 的步长排序值
- **THEN** 若当前没有分类，默认排序值 SHALL 为 10
- **THEN** superuser MAY 手动调整排序值，以便在两个已有分类之间插入新分类

#### Scenario: 虚拟未分类不可作为真实分类管理
- **WHEN** 分类 slug 为虚拟值 `uncategorized`
- **THEN** 前端 MUST NOT 将其作为真实分类展示在 CRUD 列表中
- **THEN** 前端 SHALL 禁止创建同名真实分类

### Requirement: management 调整 skill 分类
系统 SHALL 允许 superuser 在 skill 管理场景中调整单个 skill 分类。

#### Scenario: skill 管理列表展示分类
- **WHEN** superuser 访问 `/management?tab=skills`
- **THEN** 每个 skill 条目 SHALL 展示当前分类
- **THEN** 无分类 skill SHALL 展示为 `未分类`

#### Scenario: 更新单个 skill 分类
- **WHEN** superuser 在 skill 管理场景为某个 skill 选择分类并提交
- **THEN** 前端 SHALL 调用 `PATCH /api/v1/admin/skills/{slug}/categories`
- **THEN** 成功后 SHALL 刷新 admin skills 列表

#### Scenario: 清空单个 skill 分类
- **WHEN** superuser 在 skill 管理场景清空某个 skill 的分类并提交
- **THEN** 前端 SHALL 调用 `PATCH /api/v1/admin/skills/{slug}/categories` 并提交空的 `categorySlugs`
- **THEN** 成功后该 skill SHALL 在管理列表中展示为 `未分类`
- **THEN** 前端 SHALL 刷新 admin skills 列表和分类相关 query
