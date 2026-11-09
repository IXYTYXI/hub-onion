## ADDED Requirements

### Requirement: 外部身份映射模型
系统 SHALL 使用独立的外部身份映射模型管理第三方 provider 与本地用户之间的绑定关系。

#### Scenario: 创建身份映射表
- **WHEN** 系统应用新的认证数据模型
- **THEN** 系统 SHALL 创建 `auth_identities` 表，至少包含 `user_id`、`provider`、`provider_subject`、`provider_username`、`provider_email`、`provider_avatar_url`、`raw_claims`、`last_login_at`、`created_at`、`updated_at`

#### Scenario: 外部身份唯一约束
- **WHEN** 系统写入第三方身份记录
- **THEN** 系统 SHALL 保证 `(provider, provider_subject)` 组合全局唯一

### Requirement: 多 Provider 用户绑定
系统 SHALL 基于外部身份映射而不是 provider 专属字段完成本地用户查找与绑定。

#### Scenario: 已存在身份映射
- **WHEN** 第三方登录返回的 `(provider, provider_subject)` 已存在
- **THEN** 系统 SHALL 复用对应本地用户，并更新该身份映射的登录时间和资料镜像字段

#### Scenario: 首次第三方登录
- **WHEN** 第三方登录返回的 `(provider, provider_subject)` 不存在
- **THEN** 系统 SHALL 创建本地用户并创建对应身份映射记录

## MODIFIED Requirements

### Requirement: 用户账户模型
系统 SHALL 维护平台本地用户账户，并通过独立的外部身份映射模型关联 GitHub、GitLab 等第三方身份。

#### Scenario: 用户表结构
- **WHEN** 系统初始化或迁移认证数据模型
- **THEN** 系统 SHALL 维护 `users` 表用于保存本地用户基础信息，至少包含 `id`（UUID）、`handle`（唯一）、`display_name`、`email`、`avatar_url`、`bio`、`role`（默认 `user`）、`status`、`created_at`、`updated_at`

#### Scenario: handle 唯一性
- **WHEN** 新建本地用户时生成的基础 handle 与现有用户重复
- **THEN** 系统 SHALL 在 handle 后追加数字后缀确保唯一（如 `foo` → `foo2`）

### Requirement: JWT Session 管理
系统 SHALL 使用 JWT 管理用户会话，并在任一受支持的登录方式成功后签发平台本地会话。

#### Scenario: 颁发 JWT cookie
- **WHEN** 用户通过 GitHub、GitLab 或邮箱登录成功
- **THEN** 系统 SHALL 设置 HttpOnly 的 cookie `clawhub_session`，值为平台 JWT，会话有效期由服务端策略控制

#### Scenario: JWT payload
- **WHEN** 系统颁发 JWT
- **THEN** JWT payload SHALL 包含 `sub`（user_id）、`handle`、`role`、`exp`

#### Scenario: JWT 校验
- **WHEN** 受保护路由收到请求
- **THEN** 系统 SHALL 优先从 `Authorization: Bearer <token>` 读取 JWT，其次从 cookie 读取，验证签名和过期时间

#### Scenario: 登出
- **WHEN** 用户访问 `POST /auth/logout`
- **THEN** 系统 SHALL 清除 `clawhub_session` cookie，返回 200
