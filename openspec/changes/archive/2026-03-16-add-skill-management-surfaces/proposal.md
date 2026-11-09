## Why

当前 skill 管理能力只有一半落地：后端已具备发布、软删除、恢复等基础能力，但前端没有为 owner 和 superuser 提供清晰稳定的管理入口，导致日常运营和自助管理都不完整。现在需要把“我的 skill 管理”和“全局 skill 管理”分开收口，补齐最小可运营闭环。

## What Changes

- 新增 owner 专用的 skill 管理入口，提供“我的 skill 列表”和“单个 skill 管理页”。
- 新增 superuser 专用的 management 管理台分场景能力，在同一个管理入口下提供 `Users` 和 `Skills` 两个管理视角。
- 新增 superuser 全局 skill 管理能力，支持查看全站 skill、查看 owner、删除和恢复任意 skill。
- 扩展用户管理视角，允许 superuser 查看指定用户发布的所有 skill，并在用户维度下执行 skill 管理。
- 统一 owner、admin、superuser 在 skill 删除和恢复场景下的权限判定，明确 superuser 在 skill 管理中等价 admin。
- 保持第一阶段为软删除方案，不引入 hard delete、metadata 编辑、tag 管理或 latest 回滚。
- 将 `/dashboard` 明确保留为概览页，不再作为 skill 管理主入口。

## Capabilities

### New Capabilities
- `skill-management-surfaces`: 定义 owner 与 superuser 的 skill 管理页面、导航入口和管理交互要求。

### Modified Capabilities
- `go-backend-api`: 增加 my/admin 视角的 skill 管理接口，以及 management 页面所需的用户详情与 skill 管理接口要求。
- `skill-ownership`: 扩展 skill 删除/恢复权限模型，要求 superuser 在 skill 管理场景中等价 admin，并统一 owner/self 与全局管理权限。
- `user-review-workflow`: 扩展 management 管理台要求，使其在保留用户审核的基础上支持 `Users` / `Skills` 两个管理场景，并支持从用户视角查看该用户的所有 skill。

## Impact

- 前端路由与导航：`/my/skills`、`/my/skills/:slug`、`/management` 的页面结构和入口。
- Go 后端 API：新增 owner/self 与 admin/superuser 视角的 skill 管理接口，并调整现有删除/恢复权限判定。
- 权限模型：需要统一 `owner`、`admin`、`superuser` 的 skill 管理能力。
- 现有 dashboard：保留为概览，不再承载主管理职责。
