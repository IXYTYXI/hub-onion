## ADDED Requirements

### Requirement: 审核前端可见性收口
系统 SHALL 允许后端继续保留用户审核接口，但前端主路径不得再显性暴露用户审核入口或邮箱资格原因。

#### Scenario: management 页面不再请求审核接口
- **WHEN** superuser 访问 `Management` 页面
- **THEN** 前端 SHALL 不再请求 `/api/v1/admin/users`、`/api/v1/admin/users/:id` 及其相关状态变更接口

#### Scenario: 权限不足提示不暴露邮箱原因
- **WHEN** 当前用户无权访问管理后台
- **THEN** 前端 SHALL 只显示统一无权限提示，而不再显示“邮箱绑定 required”等原因

#### Scenario: 设置页不公开表达邮箱资格
- **WHEN** 用户访问设置页
- **THEN** 前端 SHALL 不再公开表达“邮箱绑定决定管理权限资格”的产品文案

#### Scenario: 飞书新用户主链路不感知待审核
- **WHEN** 新用户首次通过飞书授权登录并创建本地用户
- **THEN** 系统 SHALL 允许其直接进入可登录状态，而不是在前端主登录链路中暴露待审核提示

## REMOVED Requirements

### Requirement: management 双场景导航
**Reason**: 本次变更移除了前端可见的 `Users` 审核场景，不再要求 management 提供 `Users` 与 `Skills` 双场景切换。

**Migration**: `Management` 页面改为直接收敛到 `Skills` 场景；如需保留审核接口，仅作为后端兼容能力继续存在。

### Requirement: 用户视角下的 skill 管理
**Reason**: 用户详情视图依赖前端 `Users` 管理场景，而该场景本次已从前端主路径移除。

**Migration**: 全站 skill 管理统一通过 `Management` 的 `Skills` 场景完成；不再通过用户详情视图进入该用户的 skill 管理。
