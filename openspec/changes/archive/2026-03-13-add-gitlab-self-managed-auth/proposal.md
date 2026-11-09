## Why

当前系统的 Go 后端认证实现仍以 GitHub 为中心，用户模型也保留了 `github_id` 这一单一 provider 结构，无法直接支撑私有部署 GitLab 的企业登录场景。现在需要在不破坏现有 Session、API Token 和 CLI 浏览器登录协议的前提下，引入 GitLab Self-Managed 认证能力，并把认证层从 GitHub 定制实现演进为可扩展架构。

## What Changes

- 为 Go 后端增加私有部署 GitLab 的 OIDC 登录能力，支持浏览器登录、回调处理、本地会话签发和登出。
- 将当前 GitHub 专用认证逻辑重构为可插拔的 provider 架构，支持 GitLab、GitHub 和邮箱登录并存。
- 引入独立的外部身份映射模型，替代继续在 `users` 主表上叠加 provider 专属字段。
- 调整前端 `/auth/login` 为统一登录入口页，支持 GitLab 作为主登录方式，并保留现有邮箱登录作为兼容入口。
- 保持现有 `/cli/auth` 与 API Token 协议不变，确保 CLI 登录、`whoami`、`publish`、`delete` 等命令继续兼容。
- 为 GitLab Self-Managed 增加配置项、错误处理、日志与安全校验要求。

## Capabilities

### New Capabilities
- `gitlab-self-managed-auth`: 定义私有部署 GitLab OIDC 登录、回调、安全校验和本地 Session 绑定行为

### Modified Capabilities
- `user-identity`: 将用户身份模型从 GitHub 单 provider 结构扩展为多 provider 身份映射结构，并支持 GitLab 登录后的本地用户绑定与同步

## Impact

- 后端：
  - `backend/internal/service/auth_service.go`
  - `backend/internal/handler/auth.go`
  - `backend/internal/handler/routes.go`
  - `backend/internal/middleware/auth.go`
  - `backend/internal/config/config.go`
  - `backend/internal/model/user.go`
  - `backend/internal/database/migrations/*`
- 前端：
  - `src/routes/auth/login.tsx`
  - `src/routes/cli/auth.tsx`
  - `src/components/Header.tsx`
  - `src/lib/useAuthStatus.ts`
- CLI：
  - `packages/clawdhub/src/browserAuth.ts`
  - 登录文案与兼容验证
- 配置与部署：
  - `backend/config.yaml`
  - GitLab Self-Managed OAuth/OIDC 应用配置
