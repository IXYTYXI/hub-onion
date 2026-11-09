## ADDED Requirements

### Requirement: skill 归属用户
系统 SHALL 在发布 skill 时记录所有者用户 ID。

#### Scenario: 发布时绑定 owner
- **WHEN** 已认证用户发布 skill
- **THEN** 系统 SHALL 将 `skills.owner_user_id` 设置为当前用户的 `id`

#### Scenario: 未认证用户无法发布
- **WHEN** 未携带有效 JWT 的请求访问发布接口
- **THEN** 系统 SHALL 返回 401 Unauthorized

#### Scenario: 历史无主 skill 可读
- **WHEN** 请求 `owner_user_id` 为 NULL 的 skill
- **THEN** 系统 SHALL 正常返回 skill 信息，owner 字段为 null

### Requirement: skill 管理权限
系统 SHALL 限制 skill 的管理操作仅限所有者和具备全局管理权限的用户，并在 skill 管理场景中将 superuser 视为 admin 等价权限。

#### Scenario: 所有者可删除自己的 skill
- **WHEN** skill 的 `owner_user_id` 与当前用户 id 匹配，请求删除
- **THEN** 系统 SHALL 执行删除操作

#### Scenario: 所有者可恢复自己的 skill
- **WHEN** skill 的 `owner_user_id` 与当前用户 id 匹配，请求恢复已删除的 skill
- **THEN** 系统 SHALL 执行恢复操作

#### Scenario: 非所有者无法管理他人 skill
- **WHEN** 当前用户不是 skill 所有者且不是 moderator/admin/superuser，请求删除或恢复他人 skill
- **THEN** 系统 SHALL 返回 403 Forbidden

#### Scenario: moderator 可管理任意 skill
- **WHEN** role 为 `moderator` 或 `admin` 的用户请求删除或恢复任意 skill
- **THEN** 系统 SHALL 执行操作

#### Scenario: superuser 可管理任意 skill
- **WHEN** 命中 superuser 配置的用户请求删除或恢复任意 skill
- **THEN** 系统 SHALL 将其视为具备 admin 等价权限并执行操作
