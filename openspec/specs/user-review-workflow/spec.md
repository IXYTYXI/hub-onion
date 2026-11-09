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
