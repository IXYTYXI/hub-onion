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
系统 SHALL 在 `Management` 后台中提供 `Skills` 场景，用于全站 skill 管理。

#### Scenario: 访问 management skills 场景
- **WHEN** superuser 进入 `Management` 的 `Skills` 场景
- **THEN** 系统 SHALL 展示全站 skill 列表，并支持按 skill 名称、slug、owner 等字段搜索

#### Scenario: 非 superuser 访问 management skills 场景
- **WHEN** 非 superuser 用户访问 `Management` 的 `Skills` 场景
- **THEN** 系统 SHALL 返回无权限提示

### Requirement: superuser management users 场景中的 skill 管理
系统 SHALL 在 `Management` 后台的 `Users` 场景中支持查看指定用户的所有 skill 并进行管理。

#### Scenario: 查看用户及其 skill
- **WHEN** superuser 在 `Users` 场景中选中某个用户
- **THEN** 系统 SHALL 展示该用户的状态信息以及该用户发布的所有 skill

#### Scenario: 从用户视角管理 skill
- **WHEN** superuser 在用户详情视图中对该用户的某个 skill 执行删除或恢复
- **THEN** 系统 SHALL 完成对应的 skill 生命周期操作并刷新用户视图

### Requirement: dashboard 作为概览页保留
系统 SHALL 保留 `/dashboard`，但仅将其作为当前用户的 skill 概览页，而不是主管理入口。

#### Scenario: dashboard 继续展示概览
- **WHEN** 已登录用户访问 `/dashboard`
- **THEN** 系统 SHALL 展示当前用户的 skill 概览和快捷入口，但不要求承载完整 skill 管理功能
