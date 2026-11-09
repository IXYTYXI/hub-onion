## 1. 配置与数据模型准备

- [x] 1.1 扩展 `backend/internal/config/config.go` 和 `backend/config.yaml`，增加 GitLab Self-Managed provider 所需配置项
- [x] 1.2 新增数据库迁移，创建 `auth_identities` 表并为 `users` 增加 `last_login_at` 等通用认证字段
- [x] 1.3 编写历史数据回填方案，将已有 `users.github_id` 映射迁移到 `auth_identities`

## 2. 后端认证层重构

- [x] 2.1 将当前 `AuthService` 拆分为 provider 抽象、身份绑定服务和 session 服务
- [x] 2.2 实现 `ProviderRegistry` 与通用第三方登录数据结构（授权请求、token、外部身份 claims）
- [x] 2.3 将现有 GitHub 登录逻辑迁移到新的 provider 抽象下，确保兼容现有流程
- [x] 2.4 调整本地用户绑定逻辑，改为通过 `auth_identities` 完成查找、创建、同步和登录时间更新

## 3. GitLab Self-Managed OIDC 接入

- [x] 3.1 实现 GitLab OIDC provider，支持 discovery、授权地址构造、code 换 token 和 userinfo 读取
- [x] 3.2 新增 `/auth/gitlab` 和 `/auth/gitlab/callback` handler，并加入 provider、state、nonce 校验
- [x] 3.3 在 GitLab 登录成功后签发 `clawhub_session`，并确保不向前端或 CLI 暴露 GitLab Access Token
- [x] 3.4 增加 GitLab 登录失败、token 交换失败和 claims 读取失败的日志与错误处理

## 4. 前端登录入口改造

- [x] 4.1 重构 `src/routes/auth/login.tsx` 为统一登录入口页，增加“使用 GitLab 登录”主入口
- [x] 4.2 保留邮箱登录、注册、激活子流程，避免破坏现有邮箱认证能力
- [x] 4.3 调整 `src/routes/cli/auth.tsx` 和相关入口文案，确保未登录时统一跳转到新的登录页
- [x] 4.4 校验 `src/lib/useAuthStatus.ts`、Header 和相关页面在 GitLab 登录后的登录态展示

## 5. CLI 兼容与验证

- [x] 5.1 验证 `packages/clawdhub/src/browserAuth.ts` 的 loopback 登录协议在 GitLab 登录场景下无需改动即可工作
- [x] 5.2 验证 `/api/v1/users/me/tokens` 在 GitLab 登录用户下可正常创建、列出和吊销 API Token
- [x] 5.3 验证 CLI 的 `login`、`whoami`、`publish`、`delete` 等依赖 token 的命令保持兼容

## 6. 测试与文档收尾

- [x] 6.1 为后端新增 provider 抽象、身份绑定、GitLab callback 和 session 行为的测试
- [x] 6.2 为前端新增统一登录入口与 `/cli/auth` 跳转行为的测试
- [x] 6.3 更新部署与认证文档，补充 GitLab Self-Managed 应用配置、环境变量和联调步骤
