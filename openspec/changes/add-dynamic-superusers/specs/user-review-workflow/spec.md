## MODIFIED Requirements

### Requirement: 超级用户配置识别
系统 SHALL 支持通过配置文件或数据库动态名册声明基于授权身份信息的超级用户，并在启动时加载为内存判定集合，以此授予用户审核权限；超级用户与管理权限授予不再依赖邮箱绑定状态校验。

#### Scenario: provider 分层配置
- **WHEN** 系统加载 `auth.superusers`
- **THEN** 系统 SHALL 支持按 provider 分层的结构化配置，例如 `providers.<provider>.emails` 与 `providers.<provider>.subjects`
- **THEN** 当前能力 SHALL 将飞书邮箱列表作为 superuser 配置判定来源，并且仅把 `subjects` 中符合邮箱格式的值并入同一邮箱判定集合

#### Scenario: 按授权邮箱匹配配置超级用户
- **WHEN** 系统判断一个已登录用户是否具备审核权限，且其某条授权身份的 provider email 命中配置
- **THEN** 系统 SHALL 将其视为超级用户

#### Scenario: 按飞书授权邮箱匹配动态超级用户
- **WHEN** 系统判断一个已登录用户是否具备审核权限，且其飞书授权身份 email 命中内存判定集合中的动态 superuser 名册
- **THEN** 系统 SHALL 将其视为超级用户

#### Scenario: 动态超级用户判定不直接查库
- **WHEN** 系统判断一个已登录用户是否具备审核权限，且内存判定集合已经初始化
- **THEN** 系统 SHALL 使用启动加载并随动态名册增删更新的内存判定集合
- **THEN** 系统 MUST NOT 在权限判定路径中为动态超级用户匹配查询数据库

#### Scenario: 判定缓存缺失时降级回填
- **WHEN** 系统判断一个已登录用户是否具备审核权限，但内存判定集合缺失、尚未初始化或被标记为需要重建
- **THEN** 系统 MAY 查询数据库动态 superuser 名册
- **THEN** 系统 SHALL 在写锁保护下回填内存判定集合
- **THEN** 后续权限判定 SHALL 优先使用回填后的内存判定集合

#### Scenario: 不再使用本地邮箱匹配超级用户
- **WHEN** 系统判断一个已登录用户是否具备审核权限
- **THEN** 系统 SHALL 不再使用本地 `users.email` 作为 superuser 匹配源

#### Scenario: 未绑定邮箱仍可成为超级用户
- **WHEN** 某个用户命中超级用户配置或动态名册但尚未完成邮箱绑定
- **THEN** 系统 SHALL 仍允许授予其超级用户权限
