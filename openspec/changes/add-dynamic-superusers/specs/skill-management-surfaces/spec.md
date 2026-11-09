## MODIFIED Requirements

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
- **THEN** 前端 SHALL 以可访问的导航区域展示 skills、maintenance、categories 和 superusers 四个管理分区
- **THEN** 每个 tab SHALL 展示标题和用途说明，帮助管理员理解切换后的管理范围
- **THEN** 当前 tab SHALL 有明确的选中状态

#### Scenario: 维护任务 tab 视觉层级
- **WHEN** superuser 访问 `/management?tab=maintenance`
- **THEN** 前端 SHALL 以维护控制台形式展示任务说明、执行入口、执行约束和结果状态
- **THEN** 前端 SHALL 将扫描、更新、跳过和失败数量作为独立指标展示
- **THEN** 前端 SHALL 在任务运行中、部分失败和请求失败时展示醒目的状态反馈

## ADDED Requirements

### Requirement: management superuser 管理场景
系统 SHALL 在 `/management` 管理后台提供 superuser 名册管理场景。

#### Scenario: 访问 superuser 管理 tab
- **WHEN** superuser 访问 `/management?tab=superusers`
- **THEN** 前端 SHALL 展示 superuser 名册管理场景
- **THEN** 前端 SHALL 请求 `/api/v1/admin/superusers` 获取配置项和动态项

#### Scenario: 配置 superuser 只读展示
- **WHEN** superuser 查看 superuser 管理 tab
- **THEN** 前端 SHALL 展示配置文件中的飞书 superuser 邮箱
- **THEN** 前端 MUST NOT 为配置项展示删除或编辑操作

#### Scenario: 添加动态 superuser
- **WHEN** superuser 在 superuser 管理 tab 提交有效邮箱
- **THEN** 前端 SHALL 调用 `POST /api/v1/admin/superusers`
- **THEN** 成功后 SHALL 刷新 superuser 名册

#### Scenario: 删除动态 superuser
- **WHEN** superuser 删除动态名册中的邮箱
- **THEN** 前端 SHALL 调用 `DELETE /api/v1/admin/superusers?email={email}`
- **THEN** 前端 MUST NOT 使用用户 ID 作为删除参数
- **THEN** 成功后 SHALL 刷新 superuser 名册

#### Scenario: 主动同步 superuser 判定缓存
- **WHEN** superuser 在 superuser 管理 tab 点击同步缓存
- **THEN** 前端 SHALL 调用 `POST /api/v1/admin/superusers/sync-cache`
- **THEN** 前端 SHALL 展示同步结果或失败提示
- **THEN** 成功后 SHALL 刷新 superuser 名册

#### Scenario: 非 superuser 访问 superuser 管理 tab
- **WHEN** 非 superuser 用户访问 `/management?tab=superusers`
- **THEN** 前端 SHALL 展示无权限提示
- **THEN** 前端 MUST NOT 请求 `/api/v1/admin/superusers`
