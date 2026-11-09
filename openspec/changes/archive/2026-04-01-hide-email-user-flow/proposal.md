## Why

当前系统已经以飞书作为主登录方向，但前端仍显性暴露邮箱辅助登录、邮箱资格说明和用户审核入口，导致用户继续感知一套“邮箱注册 / 激活 / 登录 / 审核”流程。现在需要先收起这些产品可见性，在不删除后端兼容能力的前提下，让登录与管理入口更符合当前产品方向。

## What Changes

- 登录页只保留飞书登录入口，移除邮箱辅助登录入口、邮箱密码表单及相关用户可见文案。
- 管理后台不再展示用户审核能力，前端停止请求用户审核列表、详情和状态变更接口。
- 管理后台权限不足时统一显示无权限提示，不再向用户暴露“邮箱绑定 required”等原因。
- 设置页移除“邮箱绑定决定管理权限资格”的公开表达，但保留飞书绑定状态、基础资料和 API Token 管理能力。
- 飞书授权创建的新用户默认直接进入可登录状态，避免普通用户在主登录链路中感知 `review_pending`。
- 后端邮箱接口、审核接口和数据库字段作为兼容层暂时保留，本次不做删除。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `feishu-auth`: 调整登录入口与飞书主登录行为，要求登录页只暴露飞书登录，并保证飞书新用户不在主链路中进入前端可见的待审核状态。
- `skill-management-surfaces`: 调整 management 前端可见范围，移除 `Users` 审核场景，仅保留 skill 管理相关可见性。
- `user-review-workflow`: 调整审核流的前端暴露边界，允许后端保留审核接口，但不再要求前端提供用户审核入口；同时要求飞书新用户默认可登录。

## Impact

- 前端页面：`src/routes/auth/login.tsx`、`src/routes/management.tsx`、`src/routes/settings.tsx`
- 前端文案：`src/copy/auth.ts`、`src/copy/management.ts`、`src/copy/settings.ts`
- 前端测试：`src/__tests__/auth-login-route.test.tsx`、`src/__tests__/management-route.test.tsx`
- 后端最小行为调整：`backend/internal/service/auth_service.go`
- 受影响接口：前端停止请求 `/api/v1/admin/users*`；后端继续保留 `/auth/register`、`/auth/activate`、`/auth/login` 与用户审核接口
