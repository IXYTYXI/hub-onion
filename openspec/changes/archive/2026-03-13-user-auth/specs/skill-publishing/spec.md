## MODIFIED Requirements

### Requirement: 后端中转上传
系统应通过后端中转上传文件到 CDN。

#### Scenario: 上传流程
- **WHEN** 发布 skill 时
- **THEN** 文件上传流程为：
  1. 客户端发送 multipart form 到后端，携带 `Authorization: Bearer <token>` 或 session cookie
  2. 后端验证用户身份（401 如未认证）
  3. 后端验证文件和 payload
  4. 后端上传文件到阿里云 OSS
  5. 后端将 `owner_user_id` 设置为当前用户 id 并保存 skill
  6. 后端返回成功响应

#### Scenario: 不需要预签名 URL
- **WHEN** 上传文件时
- **THEN** 系统不生成预签名 URL（所有上传通过后端）

## ADDED Requirements

### Requirement: 发布需要认证
系统 SHALL 要求发布 skill 的请求携带有效的用户身份。

#### Scenario: 未认证发布被拒绝
- **WHEN** 未携带有效 JWT 或 CLI token 的请求访问 `POST /api/v1/skills`
- **THEN** 系统 SHALL 返回 401 Unauthorized，不执行任何发布操作
