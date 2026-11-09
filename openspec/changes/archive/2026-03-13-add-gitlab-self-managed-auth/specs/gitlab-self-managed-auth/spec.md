## ADDED Requirements

### Requirement: GitLab Self-Managed OIDC 登录
系统 SHALL 支持通过私有部署 GitLab 的 OIDC Authorization Code Flow 完成浏览器登录。

#### Scenario: 发起 GitLab 登录
- **WHEN** 用户访问 `GET /auth/gitlab`
- **THEN** 系统 SHALL 基于已配置的 GitLab OIDC provider 生成授权地址，并重定向到 GitLab 授权页

#### Scenario: 授权请求包含安全参数
- **WHEN** 系统重定向到 GitLab 授权页
- **THEN** 请求 SHALL 包含 `client_id`、`redirect_uri`、`response_type=code`、`scope`、随机 `state` 和随机 `nonce`

### Requirement: GitLab OIDC 回调处理
系统 SHALL 在 GitLab 回调后完成 code 交换、身份读取、本地用户绑定和本地 Session 签发。

#### Scenario: 成功处理回调
- **WHEN** GitLab 回调 `GET /auth/gitlab/callback?code=...&state=...`
- **THEN** 系统 SHALL 校验 provider、state 和 nonce，使用 code 换取 token，获取 GitLab 用户身份 claims，绑定或创建本地用户，写入 `clawhub_session` Cookie，并重定向回前端

#### Scenario: state 校验失败
- **WHEN** GitLab 回调携带的 `state` 与服务端保存值不一致
- **THEN** 系统 SHALL 拒绝本次登录并返回 400 错误

#### Scenario: token 交换失败
- **WHEN** 系统无法使用回调 code 从 GitLab token endpoint 获取 token
- **THEN** 系统 SHALL 终止登录流程并返回错误响应，且不得创建本地会话

### Requirement: GitLab 身份 claims 归一化
系统 SHALL 将 GitLab OIDC 返回的身份信息归一化为平台内部的外部身份模型。

#### Scenario: 读取标准 claims
- **WHEN** 系统从 GitLab 获取 userinfo 或等价 claims
- **THEN** 系统 SHALL 提取至少 `sub`、`preferred_username`、`name`、`email`、`picture` 作为外部身份字段

#### Scenario: 原始 claims 保留
- **WHEN** 系统成功获取 GitLab 身份信息
- **THEN** 系统 SHALL 能够保存原始 claims 供后续审计或扩展使用

### Requirement: 本地 Session 与第三方 Token 隔离
系统 SHALL 使用 ClawHub 自己的 Session 作为平台登录态，而不是将 GitLab Access Token 暴露给前端或 CLI。

#### Scenario: 浏览器登录成功
- **WHEN** 用户完成 GitLab 登录
- **THEN** 系统 SHALL 设置 `clawhub_session` Cookie 作为平台会话凭证

#### Scenario: CLI 浏览器登录
- **WHEN** CLI 通过 `/cli/auth` 完成浏览器登录
- **THEN** 系统 SHALL 继续创建并回传 ClawHub API Token，而不是返回 GitLab Access Token

### Requirement: GitLab 登录入口集成
系统 SHALL 在统一登录入口中提供 GitLab 登录能力，并兼容现有 CLI 登录兜底跳转。

#### Scenario: 统一登录页展示 GitLab 入口
- **WHEN** 用户访问 `/auth/login`
- **THEN** 系统 SHALL 提供“使用 GitLab 登录”的入口，并允许跳转到 `/auth/gitlab`

#### Scenario: CLI 未登录跳转
- **WHEN** 用户访问 `/cli/auth` 且当前未登录
- **THEN** 系统 SHALL 将用户引导到统一登录入口页，登录完成后仍可返回并继续创建 CLI Token
