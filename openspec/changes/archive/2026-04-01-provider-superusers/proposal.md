## Why

当前系统中的 superuser 与 management access 仍然依赖本地邮箱绑定状态和本地 `users.email`，这与飞书等授权身份作为主登录来源的方向冲突。现在需要把超级管理员配置与权限判定迁移到“授权身份驱动”模型，避免继续把权限耦合在旧邮箱体系上。

## What Changes

- 将 `auth.superusers` 改为按 provider 分层的结构化配置，支持 `providers.<provider>.emails` 和 `providers.<provider>.subjects`。
- superuser 判定改为基于授权身份信息匹配，不再使用本地 `users.email`。
- 引入基于 identities 的 superuser 判断入口，例如 `IsSuperuserByIdentities(user, identities)`。
- `IsSuperuser` 不再依赖 `HasBoundEmail()`。
- `HasManagementAccess` 不再依赖 `HasBoundEmail()`。
- 前端角色判断不再把 `hasBoundEmail` 作为 admin / moderator / superuser 的前置条件。
- 保留 `hasBoundEmail` 字段和邮箱绑定业务能力，但其语义收敛为业务状态字段，不再承担权限门槛职责。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `user-review-workflow`: 修改 superuser 配置识别、管理权限前置条件和相关审核权限规则，使其从邮箱绑定驱动切换到授权身份驱动。

## Impact

- 后端配置：`backend/internal/config/config.go`、`backend/config/default.yaml`、`AUTH_SUPERUSERS_JSON`
- 后端权限逻辑：`backend/internal/service/auth_service.go`
- 后端接口返回：`backend/internal/handler/user.go`
- 前端角色判断：`src/lib/roles.ts`
- 测试：`backend/internal/service/auth_service_test.go`、`backend/test/integration/user_review_workflow_test.go`、`backend/test/integration/skill_management_test.go`
