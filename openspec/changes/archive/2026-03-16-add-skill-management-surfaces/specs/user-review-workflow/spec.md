## ADDED Requirements

### Requirement: management 双场景导航
系统 SHALL 在 superuser 后台中同时提供 `Users` 和 `Skills` 两个管理场景。

#### Scenario: 默认进入 Users 场景
- **WHEN** superuser 进入 `Management`
- **THEN** 系统 SHALL 默认展示 `Users` 场景，并允许切换到 `Skills` 场景

#### Scenario: 切换到 Skills 场景
- **WHEN** superuser 在 `Management` 中切换到 `Skills`
- **THEN** 系统 SHALL 展示全站 skill 管理列表，而不影响用户审核能力

### Requirement: 用户视角下的 skill 管理
系统 SHALL 允许 superuser 在用户管理场景中查看该用户发布的所有 skill，并对这些 skill 执行生命周期操作。

#### Scenario: 用户详情包含 skill 列表
- **WHEN** superuser 查看某个用户的管理详情
- **THEN** 系统 SHALL 展示该用户发布的所有 skill，并标明各自状态和当前版本

#### Scenario: 在用户视角删除 skill
- **WHEN** superuser 在用户详情视图中删除该用户的某个 skill
- **THEN** 系统 SHALL 对该 skill 执行软删除，并刷新该用户的 skill 列表

#### Scenario: 在用户视角恢复 skill
- **WHEN** superuser 在用户详情视图中恢复该用户的某个已删除 skill
- **THEN** 系统 SHALL 恢复该 skill，并刷新该用户的 skill 列表
