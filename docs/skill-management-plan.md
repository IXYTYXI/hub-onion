# Skill 管理改造计划

## 背景

当前系统已经具备基础的 skill 发布、查看、下载、版本查看、软删除、恢复等后端能力，但前端入口不完整，导致以下问题：

- `owner` 只能通过 `Dashboard -> New Version` 间接继续发布，缺少完整的 skill 管理入口。
- skill 详情页没有稳定可见的 `删除 / 恢复 / 管理` 操作。
- `/management` 当前只覆盖用户审核，不覆盖 skill 管理。
- `superuser` 的能力主要集中在用户审核，尚未形成“全局 skill 管理台”。
- owner 和 superuser 的 skill 管理场景混在一起，没有清晰分层。

本计划的目标是把 skill 管理拆成两条明确链路：

1. `owner` 管自己的 skill
2. `superuser` 管全站所有 skill 和相关用户

## 目标

### 目标一：为 superuser 提供独立的全局 Skill 管理页面

superuser 可以：

- 查看全站 skill 列表
- 搜索 skill
- 查看 skill 的上传者
- 查看 skill 当前状态
- 删除 skill
- 恢复 skill
- 跳转到上传者信息
- 对上传者执行禁用等管理动作

### 目标二：为 owner 提供独立的个人 Skill 管理页面

owner 可以：

- 查看自己上传的所有 skill
- 查看每个 skill 的当前版本、上传时间、状态
- 上传新版本
- 删除自己的 skill
- 恢复自己删除的 skill
- 跳转到 skill 详情页
- 跳转到“管理当前 skill”的详情管理页

### 目标三：统一 skill 管理权限

- `owner` 只能管理自己的 skill
- `superuser` 可以管理所有 skill
- `superuser` 可以继续管理用户状态（禁用用户、审核用户）
- skill 删除/恢复权限统一收口，避免部分接口存在越权或能力缺失

## 页面拆分方案

### 一、Superuser Skill 管理台

新增页面：

- `/management/skills`

页面定位：

- 面向 `superuser`
- 用于全局 skill 管理

页面内容建议：

- 搜索框
- 状态筛选
  - `active`
  - `deleted`
  - 后续可扩展 `hidden`
- 列表字段
  - skill 名称
  - slug
  - owner handle / display name
  - 当前版本
  - 版本数
  - 创建时间
  - 更新时间
  - 当前状态
- 行内操作
  - `查看`
  - `删除`
  - `恢复`
  - `查看上传者`
  - `禁用上传者`

建议交互：

- 支持按 `slug / displayName / owner handle / owner email` 搜索
- 删除和恢复都需要二次确认
- 删除后列表即时刷新
- 禁用用户后列表即时反映其状态

### 二、Owner Skill 管理页

新增页面：

- `/my/skills`

页面定位：

- 面向当前登录 owner
- 只管理自己的 skill

页面内容建议：

- 自己的 skill 列表
- 状态过滤
  - 全部
  - 正常
  - 已删除
- 列表字段
  - skill 名称
  - slug
  - 当前版本
  - 更新时间
  - 状态
- 行内操作
  - `查看`
  - `上传新版本`
  - `删除`
  - `恢复`
  - `管理`

说明：

- 当前 `/dashboard` 可以继续保留，但建议逐步弱化成概览页。
- 真正的 skill 管理入口统一收口到 `/my/skills`。
- 当前 `/dashboard` 已存在，但它现在只承担“我的技能概览”职责：
  - 展示自己的 skill 列表
  - 提供 `Upload New Skill`
  - 提供 `New Version`
  - 提供 `View`
- 当前 `/dashboard` 没有：
  - 删除
  - 恢复
  - skill 管理详情入口
  - metadata 编辑入口
- 当前 Header 中也没有明确的 `/dashboard` 入口，因此它更适合继续保留为概览页，而不是主管理入口。

### 三、单个 Skill 管理详情页

新增页面：

- `/my/skills/$slug`

用途：

- 查看和管理单个 skill

页面内容建议：

- 基本信息
  - skill 名称
  - slug
  - owner
  - 当前状态
  - 创建时间
  - 更新时间
- 当前版本信息
  - version
  - changelog
  - files
- 历史版本列表
  - 版本号
  - 发布时间
  - changelog
  - 下载 ZIP
- 操作区
  - `上传新版本`
  - `删除 skill`
  - `恢复 skill`
  - `查看详情页`

后续可扩展：

- tag 管理
- latest 回滚
- 版本比较
- owner 元信息编辑

## 权限模型

### Owner 权限

owner 可以：

- 查看自己的 skill 管理列表
- 管理自己的 skill
- 上传新版本
- 删除自己的 skill
- 恢复自己的 skill

owner 不可以：

- 管理其他人的 skill
- 禁用其他用户
- 查看全站管理台

### Superuser 权限

superuser 可以：

- 查看全站所有 skill
- 删除任意 skill
- 恢复任意 skill
- 查看 skill 上传者
- 禁用 skill 上传者
- 继续执行用户审核

建议明确：

- `superuser` 在 skill 管理场景下，完全等价拥有 `admin` 级别权限
- 后端权限判断必须显式识别 `superuser`
- 不能只依赖数据库 `role = admin`

## 后端接口规划

### 一、owner/self 视角接口

建议新增：

- `GET /api/v1/my/skills`
- `GET /api/v1/my/skills/:slug`

用途：

- 返回当前登录用户自己的 skill 列表
- 返回当前登录用户自己的 skill 管理详情

这两条接口的价值：

- 避免前端通过 `/users/:handle/skills` 做脆弱推断
- 直接面向“当前用户的管理后台”语义

### 二、superuser/admin 视角接口

建议新增：

- `GET /api/v1/admin/skills`
- `GET /api/v1/admin/skills/:slug`
- `POST /api/v1/admin/skills/:slug/delete`
- `POST /api/v1/admin/skills/:slug/undelete`

筛选参数建议：

- `query`
- `status`
- `owner`
- `limit`
- `cursor`

为什么建议使用 `/admin/skills/*`：

- 与 owner 的 skill 管理接口分层清晰
- 便于后续加入更多管理动作
- 审计语义明确

### 三、Management 页面拆分

`/management` 建议作为 superuser 的统一后台入口，并拆成两个场景：

- `Users`
- `Skills`

具体建议：

- `/management`
  - 默认进入 `Users`
  - 用于查看和管理用户
- `/management?tab=skills`
  - 或单独路由 `/management/skills`
  - 用于查看和管理全站 skill

`Users` 场景建议支持：

- 用户列表
- 用户搜索
- 用户状态筛选
- 审核通过 / 拒绝 / 禁用 / 启用
- 查看该用户发布的所有 skill
- 在用户详情视角下直接管理该用户的 skill

`Skills` 场景建议支持：

- 全站 skill 列表
- 搜索和筛选
- 删除 / 恢复
- 跳转到 owner 用户管理详情

这样可以满足：

- 用户维度管理
- skill 维度管理
- 从用户进入 skill
- 从 skill 回到用户

### 三、现有接口保留策略

保留现有：

- `DELETE /api/v1/skills/:slug`
- `POST /api/v1/skills/:slug/undelete`

建议用途：

- 面向 owner 自助管理
- 页面和 CLI 都可继续使用

但需要补强：

- 删除权限校验统一
- 恢复权限校验统一
- `superuser` 应当天然通过

## 推荐的前端导航方案

建议 Header 中增加：

- `My Skills`

对 superuser 额外显示：

- `Management`

对应跳转：

- `My Skills` -> `/my/skills`
- `Management` -> `/management`

这样可以把“我的资源管理”和“全局管理”完全分开，同时不把 Header 入口做得过多。

## 建议补充的管理动作

本次第一阶段建议纳入：

- owner 上传新版本
- owner 删除 skill
- owner 恢复 skill
- owner 查看自己的 skill 列表
- owner 查看单个 skill 管理页
- superuser 查看全站 skill
- superuser 删除任意 skill
- superuser 恢复任意 skill
- superuser 在 `Users` 场景查看某个用户的所有 skill
- superuser 在 `Users` 场景禁用用户
- superuser 在 `Skills` 场景查看 owner 并跳转到用户管理页

本次第一阶段不建议纳入：

- hard delete
- change owner
- tag 编辑
- latest 回滚
- hide / unhide
- duplicate / canonical 管理

原因：

- 这些能力需要更完整的状态模型和审计设计
- 当前先把“可运营的基础管理能力”补齐更重要

## 风险与注意事项

### 一、superuser 与 admin 权限不一致风险

当前系统有 `superuser` 配置，但部分 skill 权限逻辑仍偏向 `role` 判断。

需要统一结论：

- 在 skill 管理场景下，`superuser` 必须有全局 skill 管理能力

### 二、恢复接口权限风险

当前恢复 skill 的权限需要重点复核，避免出现：

- 任意登录用户可以恢复他人 skill
- owner 可以恢复不属于自己的 skill

### 三、Dashboard 与 My Skills 职责重叠

建议保留 `/dashboard` 作为概览页，但把 skill 管理主入口迁移到 `/my/skills`，避免后续堆功能导致页面职责混乱。

### 四、删除语义先保持软删除

建议本阶段继续使用软删除：

- 风险低
- 易恢复
- 与现有后端模型一致
- 实现最简单
- 对 owner 和 superuser 的操作心智也最统一

结论：

- 第一阶段使用软删除
- 不做 hard delete

## 实施顺序建议

### Phase 1：权限与接口收口

- 统一 owner / superuser skill 管理权限判断
- 修正 skill 删除 / 恢复权限
- 新增 `/api/v1/my/skills`
- 新增 `/api/v1/my/skills/:slug`
- 新增 `/api/v1/admin/skills`
- 新增 `/api/v1/admin/skills/:slug`

### Phase 2：Owner 管理页面

- 新增 `/my/skills`
- 新增 `/my/skills/$slug`
- 从页面支持：
  - 上传新版本
  - 删除
  - 恢复

### Phase 3：Superuser Skill 管理台

- 扩展 `/management`
- 增加 `Users` / `Skills` 两个场景
- `Users` 支持查看用户及其 skill，并执行用户禁用等动作
- `Skills` 支持全站 skill 搜索、筛选、删除、恢复

### Phase 4：导航与体验收口

- Header 增加入口
- 详情页补“进入管理页”按钮
- Dashboard 简化为概览

## 最小可行版本

如果希望先快速落地，建议最小闭环是：

- 新增 `/my/skills`
- 新增 `/management` 下的 `Users` / `Skills` 两个场景
- owner 可删除 / 恢复自己的 skill
- superuser 可删除 / 恢复所有 skill
- superuser 可在用户详情里看到这个用户的所有 skill 并进行管理

这版就已经能覆盖你现在最关心的核心运营需求。

## 待确认事项

1. `superuser` 是否在 skill 管理场景中完全等价 `admin`
2. `/dashboard` 是否保留为概览页，而不是继续承载 skill 管理主入口
3. 本次是否只做软删除，不做 hard delete
4. `Management` 是否拆成 `Users` / `Skills` 两个场景
5. owner 是否需要在第一期就支持“编辑 displayName / tags / changelog”，还是先只保留“上传新版本 + 删除/恢复”
