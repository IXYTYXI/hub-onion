## 1. Superusers 配置模型

- [x] 1.1 调整 `backend/internal/config/config.go`，将 `auth.superusers` 改为 provider 分层的结构化配置模型
- [x] 1.2 更新默认配置与 `AUTH_SUPERUSERS_JSON` 解析逻辑，支持 `providers.<provider>.emails` 与 `providers.<provider>.subjects`
- [x] 1.3 补充配置解析相关测试，验证 YAML/JSON 形态都能正确加载 superusers 配置

## 2. 后端权限判断重构

- [x] 2.1 在 `AuthService` 中引入基于 identities 的 superuser 判断逻辑，例如 `IsSuperuserByIdentities(user, identities)`
- [x] 2.2 调整 `IsSuperuser(user)`，移除对 `HasBoundEmail()` 和本地 `users.email` 的依赖
- [x] 2.3 调整 `HasManagementAccess(user)`，移除对 `HasBoundEmail()` 的依赖，仅基于 `role` 与 `isSuperuser` 判定

## 3. 前端角色判断对齐

- [x] 3.1 调整 `src/lib/roles.ts`，移除 `isAdmin()` 与 `isModerator()` 对 `hasBoundEmail` 的依赖
- [x] 3.2 回归验证前端管理相关可见性不会因为未绑定邮箱而误判权限

## 4. 接口与返回语义回归

- [x] 4.1 回归验证 `/api/v1/users/me` 在新模型下允许出现 `hasBoundEmail = false` 且 `hasManagementAccess = true`
- [x] 4.2 回归验证依赖 `HasManagementAccess()` / `IsSuperuser()` 的管理用户接口与管理 skill 接口行为符合新规则

## 5. 测试更新

- [x] 5.1 更新 `backend/internal/service/auth_service_test.go`，覆盖 provider email / subject 命中场景与未绑定邮箱场景
- [x] 5.2 更新 `backend/test/integration/user_review_workflow_test.go`，移除对邮箱绑定作为权限门槛的旧假设
- [x] 5.3 更新 `backend/test/integration/skill_management_test.go`，移除对邮箱绑定作为权限门槛的旧假设
