## ADDED Requirements

### Requirement: 超级用户配置识别
系统 SHALL 支持通过配置文件或环境变量声明本地超级用户，并以此授予用户审核权限。

#### Scenario: 超级用户匹配规则
- **WHEN** 系统判断一个已登录用户是否具备审核权限
- **THEN** 系统 SHALL 按 `user_id`、`email`、`handle` 三种字段做精确相等匹配，任一命中即视为超级用户

#### Scenario: handle 仅作补充匹配键
- **WHEN** 超级用户配置同时包含 `user_id`、`email`、`handle`
- **THEN** 系统 SHALL 将三者视为并列的“或”匹配条件，而不是仅依赖 `handle`

### Requirement: 统一审核状态机
系统 SHALL 使用统一的用户审核状态机管理本地邮箱注册用户和 OAuth 用户的准入状态。

#### Scenario: 状态枚举
- **WHEN** 系统创建或更新用户状态
- **THEN** 系统 SHALL 支持至少以下状态：`email_pending`、`review_pending`、`active`、`rejected`、`disabled`

#### Scenario: 本地邮箱注册进入待激活
- **WHEN** 白名单邮箱域名用户完成本地注册且系统成功发送激活邮件
- **THEN** 系统 SHALL 将该用户创建为 `email_pending`

#### Scenario: 邮箱激活后进入待审核
- **WHEN** 本地邮箱注册用户成功提交有效激活码
- **THEN** 系统 SHALL 将该用户状态更新为 `review_pending`

#### Scenario: OAuth 首次登录进入待审核
- **WHEN** 用户首次通过 GitHub 或 GitLab 登录并创建本地账户
- **THEN** 系统 SHALL 将该用户状态设置为 `review_pending`

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
系统 SHALL 仅允许审核通过的用户完成平台登录并进入受保护功能。

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

### Requirement: 审核管理接口
系统 SHALL 提供仅超级用户可访问的用户审核管理接口。

#### Scenario: 待审核用户列表
- **WHEN** 超级用户请求待审核用户列表
- **THEN** 系统 SHALL 返回符合过滤条件的用户列表，至少包含用户标识、邮箱、handle、display_name、注册时间和当前状态

#### Scenario: 超级用户批准用户
- **WHEN** 超级用户请求批准指定用户
- **THEN** 系统 SHALL 更新该用户状态为 `active` 并记录审核时间与审核人

#### Scenario: 超级用户拒绝用户
- **WHEN** 超级用户请求拒绝指定用户
- **THEN** 系统 SHALL 更新该用户状态为 `rejected` 并记录审核时间与审核人

#### Scenario: 非超级用户访问审核接口
- **WHEN** 非超级用户访问任何审核管理接口
- **THEN** 系统 SHALL 返回 403 Forbidden

### Requirement: SMTP 注册前置校验
系统 SHALL 在启用本地邮箱注册前验证邮件发送能力已配置完成。

#### Scenario: SMTP 未配置时禁止注册
- **WHEN** 系统未配置 SMTP 且客户端请求本地邮箱注册
- **THEN** 系统 SHALL 返回错误并且不得创建新的 `email_pending` 用户
