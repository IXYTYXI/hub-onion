## ADDED Requirements

### Requirement: owner skill 管理入口
系统 SHALL 为已登录 owner 提供独立的 skill 管理入口，并将其与公开 skill 详情页分离。

#### Scenario: 访问我的 skill 列表
- **WHEN** 已登录用户访问 `/my/skills`
- **THEN** 系统 SHALL 返回该用户拥有的 skill 管理列表，并支持查看状态、当前版本和最近更新时间

#### Scenario: 未登录访问我的 skill 列表
- **WHEN** 未登录用户访问 `/my/skills`
- **THEN** 系统 SHALL 拒绝访问并提示用户先登录

### Requirement: owner 单个 skill 管理页
系统 SHALL 为 owner 提供单个 skill 的管理详情页，用于版本与生命周期管理。

#### Scenario: 访问自己的 skill 管理页
- **WHEN** owner 访问 `/my/skills/{slug}` 且该 skill 属于当前用户
- **THEN** 系统 SHALL 展示该 skill 的基本信息、当前版本、历史版本，以及上传新版本、删除和恢复操作

#### Scenario: 访问他人的 skill 管理页
- **WHEN** 普通 owner 访问不属于自己的 `/my/skills/{slug}`
- **THEN** 系统 SHALL 返回拒绝访问或重定向到无权限提示

### Requirement: owner skill 生命周期操作
系统 SHALL 允许 owner 在管理页中对自己的 skill 执行最小生命周期操作。

#### Scenario: owner 上传新版本
- **WHEN** owner 在 `/my/skills` 或 `/my/skills/{slug}` 选择“上传新版本”
- **THEN** 系统 SHALL 跳转到发布流程，并预填当前 skill 的 `slug`

#### Scenario: owner 删除自己的 skill
- **WHEN** owner 在管理页中删除自己的 skill
- **THEN** 系统 SHALL 执行软删除，并在后续列表与详情中体现为已删除状态

#### Scenario: owner 恢复自己的 skill
- **WHEN** owner 在管理页中恢复自己已删除的 skill
- **THEN** 系统 SHALL 恢复该 skill，并在管理列表中重新显示为可用状态

### Requirement: superuser management skill 场景
系统 SHALL 在 `Management` 后台中仅提供 `Skills` 场景作为前端可见的全站 skill 管理入口，并支持对 skill 的精选状态进行运营配置。

#### Scenario: 访问 management skills 场景
- **WHEN** superuser 进入 `Management`
- **THEN** 系统 SHALL 默认展示 `Skills` 场景，并支持查看全站 skill 列表以及按 skill 名称、slug、owner 等字段搜索

#### Scenario: 非 superuser 访问 management skills 场景
- **WHEN** 非 superuser 用户访问 `Management` 的 `Skills` 场景
- **THEN** 系统 SHALL 返回无权限提示

#### Scenario: superuser 查看精选状态
- **WHEN** superuser 在 `Management` 中查看某个 skill
- **THEN** 系统 SHALL 显示该 skill 当前是否处于 `highlighted` 状态

#### Scenario: superuser 查看作者邮箱
- **WHEN** superuser 在 `Management` 的 skill 列表中查看作者栏
- **THEN** 系统 SHALL 优先展示该 skill 作者已获取的飞书授权邮箱，而不是 UID 风格标识

#### Scenario: 作者邮箱缺失时回退
- **WHEN** `owner.email` 缺失
- **THEN** 系统 SHALL 回退展示 `owner.handle` 或既有可读字段，而不得直接优先显示内部 UID

#### Scenario: superuser 设为精选
- **WHEN** superuser 在 `Management` 中将某个 skill 设为精选
- **THEN** 系统 SHALL 持久化该 skill 的 `highlighted` 状态，并使首页精选区块和精选筛选可见该变化

#### Scenario: superuser 取消精选
- **WHEN** superuser 在 `Management` 中取消某个 skill 的精选状态
- **THEN** 系统 SHALL 清除该 skill 的 `highlighted` 状态，并使首页精选区块和精选筛选不再包含该 skill

### Requirement: dashboard 作为概览页保留
系统 SHALL 保留 `/dashboard`，但仅将其作为当前用户的 skill 概览页，而不是主管理入口。

#### Scenario: dashboard 继续展示概览
- **WHEN** 已登录用户访问 `/dashboard`
- **THEN** 系统 SHALL 展示当前用户的 skill 概览和快捷入口，但不要求承载完整 skill 管理功能

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
