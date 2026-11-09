## MODIFIED Requirements

### Requirement: 超级用户配置识别
系统 SHALL 支持通过配置文件或环境变量声明本地超级用户，并以此授予用户审核权限，但管理权限授予仍必须通过邮箱绑定状态校验。

#### Scenario: 超级用户匹配规则
- **WHEN** 系统判断一个已登录用户是否具备审核权限
- **THEN** 系统 SHALL 按 `user_id`、`email`、`handle` 三种字段做精确相等匹配，任一命中即视为超级用户

#### Scenario: handle 仅作补充匹配键
- **WHEN** 超级用户配置同时包含 `user_id`、`email`、`handle`
- **THEN** 系统 SHALL 将三者视为并列的“或”匹配条件，而不是仅依赖 `handle`

#### Scenario: 未绑定邮箱不得拥有超级用户权限
- **WHEN** 某个用户命中超级用户配置但尚未完成邮箱绑定
- **THEN** 系统 SHALL 拒绝授予其管理权限

### Requirement: 统一审核状态机
系统 SHALL 使用统一的用户审核状态机管理本地邮箱用户和第三方登录用户的准入状态，并保持邮箱绑定作为管理权限的独立前置条件。

#### Scenario: 状态枚举
- **WHEN** 系统创建或更新用户状态
- **THEN** 系统 SHALL 支持至少以下状态：`email_pending`、`review_pending`、`active`、`rejected`、`disabled`

#### Scenario: 本地邮箱注册进入待激活
- **WHEN** 系统使用邮箱绑定流程给当前本地用户发起邮箱验证
- **THEN** 系统 SHALL 要求该邮箱先完成激活或验证流程后才视为已绑定

#### Scenario: 邮箱激活后完成绑定
- **WHEN** 当前本地用户成功提交有效激活码
- **THEN** 系统 SHALL 将该邮箱视为已绑定，并根据原有审核规则决定是否允许该用户进入后续能力

#### Scenario: GitHub 与 GitLab 首次登录进入待审核
- **WHEN** 用户首次通过 GitHub 或 GitLab 登录并创建本地账户
- **THEN** 系统 SHALL 将该用户状态设置为 `review_pending`

#### Scenario: 飞书首次登录直接激活
- **WHEN** 用户首次通过飞书登录并创建本地账户
- **THEN** 系统 SHALL 将该用户状态设置为 `active`

#### Scenario: 审核通过
- **WHEN** 超级用户批准一个 `review_pending` 或 `rejected` 用户
- **THEN** 系统 SHALL 将其状态更新为 `active`

#### Scenario: 审核拒绝
- **WHEN** 超级用户拒绝一个 `review_pending` 用户
- **THEN** 系统 SHALL 将其状态更新为 `rejected`

#### Scenario: 停用与重新启用
- **WHEN** 超级用户停用或重新启用一个已存在用户
- **THEN** 系统 SHALL 分别将用户状态更新为 `disabled` 或 `active`

### Requirement: 统一登录准入控制
系统 SHALL 仅允许审核通过的用户完成平台登录并进入受保护功能，同时将邮箱绑定状态作为管理权限的前置校验。

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

#### Scenario: 未绑定邮箱不得访问管理能力
- **WHEN** 已登录用户尝试访问任何管理能力，但该用户尚未完成邮箱绑定
- **THEN** 系统 SHALL 拒绝该访问，即使其通过了第三方登录
