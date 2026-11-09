## MODIFIED Requirements

### Requirement: 超级用户配置识别
系统 SHALL 支持通过配置文件或环境变量声明基于授权身份信息的超级用户，并以此授予用户审核权限；超级用户与管理权限授予不再依赖邮箱绑定状态校验。

#### Scenario: provider 分层配置
- **WHEN** 系统加载 `auth.superusers`
- **THEN** 系统 SHALL 支持按 provider 分层的结构化配置，例如 `providers.<provider>.emails` 与 `providers.<provider>.subjects`

#### Scenario: 按授权邮箱匹配超级用户
- **WHEN** 系统判断一个已登录用户是否具备审核权限，且其某条授权身份的 provider email 命中配置
- **THEN** 系统 SHALL 将其视为超级用户

#### Scenario: 按授权 subject 匹配超级用户
- **WHEN** 系统判断一个已登录用户是否具备审核权限，且其某条授权身份的 provider subject 命中配置
- **THEN** 系统 SHALL 将其视为超级用户

#### Scenario: 不再使用本地邮箱匹配超级用户
- **WHEN** 系统判断一个已登录用户是否具备审核权限
- **THEN** 系统 SHALL 不再使用本地 `users.email` 作为 superuser 匹配源

#### Scenario: 未绑定邮箱仍可成为超级用户
- **WHEN** 某个用户命中超级用户配置但尚未完成邮箱绑定
- **THEN** 系统 SHALL 仍允许授予其超级用户权限

### Requirement: 统一登录准入控制
系统 SHALL 仅允许审核通过的用户完成平台登录并进入受保护功能；管理权限判定不再要求邮箱绑定状态。

#### Scenario: 待激活用户登录
- **WHEN** `email_pending` 用户尝试通过邮箱密码登录
- **THEN** 系统 SHALL 拒绝登录并提示用户先完成邮箱激活

#### Scenario: 待审核用户登录
- **WHEN** `review_pending` 用户尝试通过邮箱密码或 OAuth 登录
- **THEN** 系统 SHALL 拒绝登录并提示账号等待审核

#### Scenario: 已拒绝用户登录
- **WHEN** `rejected` 用户尝试登录
- **THEN** 系统 SHALL 拒绝登录并提示账号审核未通过

#### Scenario: 已停用用户登录
- **WHEN** `disabled` 用户尝试登录
- **THEN** 系统 SHALL 拒绝登录并提示账号已停用

#### Scenario: 审核通过用户登录
- **WHEN** `active` 用户完成受支持的登录流程
- **THEN** 系统 SHALL 允许建立平台会话并访问受保护功能

#### Scenario: 未绑定邮箱不影响管理能力
- **WHEN** 已登录用户尝试访问管理能力，且其角色或 superuser 身份已满足管理条件，但该用户尚未完成邮箱绑定
- **THEN** 系统 SHALL 允许该访问
