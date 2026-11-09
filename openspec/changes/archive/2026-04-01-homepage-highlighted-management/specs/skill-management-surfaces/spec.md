## MODIFIED Requirements

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
