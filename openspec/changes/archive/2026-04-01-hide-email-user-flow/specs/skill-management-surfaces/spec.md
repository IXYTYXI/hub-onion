## MODIFIED Requirements

### Requirement: superuser management skill 场景
系统 SHALL 在 `Management` 后台中仅提供 `Skills` 场景作为前端可见的全站 skill 管理入口。

#### Scenario: 访问 management skills 场景
- **WHEN** superuser 进入 `Management`
- **THEN** 系统 SHALL 默认展示 `Skills` 场景，并支持查看全站 skill 列表以及按 skill 名称、slug、owner 等字段搜索

#### Scenario: 非 superuser 访问 management skills 场景
- **WHEN** 非 superuser 用户访问 `Management` 的 `Skills` 场景
- **THEN** 系统 SHALL 返回无权限提示

## REMOVED Requirements

### Requirement: superuser management users 场景中的 skill 管理
**Reason**: 本次变更要求从前端主路径中移除用户审核与用户详情视图，不再对管理员显性暴露 `Users` 管理场景。

**Migration**: `Management` 页面收敛为仅保留 `Skills` 管理场景；后端用户审核接口可继续保留，但前端不再请求和展示该场景。
