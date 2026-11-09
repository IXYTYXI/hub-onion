## Why

当前仓库已经具备邮箱注册、邮箱激活、OAuth 登录和基础角色字段，但缺少“谁可以注册后真正进入系统”的统一审核闭环。现在本地邮箱用户会在激活后直接变为可登录状态，OAuth 用户也默认可直接使用，无法满足“仅允许白名单邮箱域名注册，并由本地超级用户审核通过后才能使用”的准入要求。

## What Changes

- 新增统一的用户审核流程，覆盖本地邮箱注册用户和 OAuth 登录用户。
- 新增超级用户配置能力，支持通过 `user_id`、`email`、`handle` 任一精确匹配识别审核员。
- 调整用户状态流转，将“邮箱激活”和“管理员审核通过”拆分为两个独立阶段。
- 新增管理员审核接口与待审核用户查询接口，用于批准、拒绝、停用和重新启用用户。
- 调整登录行为，只有 `active` 状态用户才允许完成平台登录。
- 修正邮箱注册依赖 SMTP 的行为，未配置 SMTP 时不得继续创建待激活用户。

## Capabilities

### New Capabilities
- `user-review-workflow`: 定义本地超级用户配置、统一审核状态机和用户审核管理接口。

### Modified Capabilities
- `user-identity`: 修改本地邮箱注册、邮箱激活、OAuth 首次登录与会话颁发规则，使其接入统一审核流。
- `go-backend-api`: 修改 Go 后端认证与用户路由要求，新增管理员审核相关路由与配置加载要求。

## Impact

- 影响 `backend/internal/config`、`backend/internal/service/auth_service.go`、`backend/internal/service/identity_service.go`、`backend/internal/handler/auth.go`、`backend/internal/handler/routes.go` 与用户相关模型/迁移。
- 影响前端登录后的状态提示与管理页实现。
- 影响本地部署配置，新增超级用户配置项并强化 SMTP 配置要求。
- 影响后续 CLI 或后台管理功能对用户状态的读取与展示。
