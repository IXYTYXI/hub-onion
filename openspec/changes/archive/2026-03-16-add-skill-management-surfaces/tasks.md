## 1. 后端权限与接口

- [x] 1.1 统一 skill 删除与恢复的权限判断，明确 owner、moderator、admin、superuser 的权限边界
- [x] 1.2 修正现有 skill 恢复接口的权限校验，确保非 owner 且非全局管理者不能恢复他人 skill
- [x] 1.3 新增 `GET /api/v1/my/skills`，返回当前登录用户的 skill 管理列表
- [x] 1.4 新增 `GET /api/v1/my/skills/:slug`，返回当前登录用户单个 skill 的管理详情
- [x] 1.5 新增 `GET /api/v1/admin/skills` 与 `GET /api/v1/admin/skills/:slug`，返回全站 skill 管理数据
- [x] 1.6 新增 superuser 视角的 skill 删除与恢复接口，并复用统一权限判断
- [x] 1.7 扩展用户管理详情接口或等价接口，支持返回指定用户发布的所有 skill

## 2. Owner 管理页面

- [x] 2.1 新增 `/my/skills` 页面并展示当前用户的 skill 管理列表
- [x] 2.2 新增 `/my/skills/$slug` 页面并展示单个 skill 的管理详情
- [x] 2.3 在 owner 管理页面中接入“上传新版本”跳转能力，并预填当前 skill slug
- [x] 2.4 在 owner 管理页面中接入“删除 / 恢复”操作，并处理确认、刷新和错误提示
- [x] 2.5 调整导航，增加 `My Skills` 入口，并保留 `/dashboard` 为概览页

## 3. Superuser Management 页面

- [x] 3.1 扩展 `/management` 页面结构，增加 `Users` / `Skills` 两个管理场景
- [x] 3.2 在 `Skills` 场景实现全站 skill 列表、搜索、状态筛选、删除和恢复
- [x] 3.3 在 `Users` 场景保留现有用户审核能力，并增加用户详情中的 skill 列表
- [x] 3.4 在 `Users` 场景中支持对指定用户的 skill 执行删除和恢复
- [x] 3.5 在 `Management` 页面中保留用户禁用/启用能力，并联动刷新用户与 skill 视图

## 4. 验证与回归

- [x] 4.1 为 skill 权限判断补充后端测试，覆盖 owner、moderator/admin、superuser 和普通用户场景
- [x] 4.2 为 my/admin skill 管理接口补充后端测试，覆盖列表、详情、删除、恢复和越权访问
- [x] 4.3 为 `/my/skills` 和 `/management` 页面补充前端测试，覆盖关键渲染与操作流程
- [x] 4.4 手工验证 `/dashboard`、`/my/skills`、`/management`、公开 skill 详情页之间的导航与状态一致性
