## Context

当前 skill 管理能力处于“后端已有基础动作、前端缺少管理面”的状态。Go 后端已经支持发布、查看、版本历史、软删除、恢复等基础能力，但前端只有：

- `/dashboard`：展示当前用户自己的 skill 概览，并提供 `Upload New Skill`、`New Version`、`View`
- `/$owner/$slug`：skill 详情页，存在部分管理状态和半成品 UI，但不是稳定的管理入口
- `/management`：仅覆盖用户审核，不覆盖 skill 管理

当前约束如下：

- skill 删除语义已经基于 `is_deleted`，属于软删除
- owner 管理和 superuser 管理需要分层，避免一个页面同时承载“我的 skill”和“全局 skill”
- 当前系统的超级用户主要通过配置识别，而不是完全依赖数据库 `role`
- 第一阶段不引入 metadata 编辑、tag 管理、latest 回滚或 hard delete

## Goals / Non-Goals

**Goals:**

- 为 owner 提供单独的 skill 管理入口，覆盖“列表 + 单个 skill 管理”
- 为 superuser 提供统一的 management 后台，并拆分 `Users` / `Skills` 两个管理场景
- 明确 `superuser` 在 skill 管理场景中等价 `admin`
- 统一 skill 删除/恢复的权限判定，确保 owner/self 与 superuser/admin 行为一致
- 保留 `/dashboard`，但将其降级为概览页，不再承担主管理入口职责

**Non-Goals:**

- 不实现 hard delete
- 不实现 skill metadata 编辑
- 不实现 tag 编辑或 latest 回滚
- 不实现 hide / unhide、duplicate / canonical 等更复杂的运营动作
- 不在第一阶段重做公开 skill 详情页的信息结构

## Decisions

### 决策一：保留 `/dashboard`，新增 `/my/skills` 作为 owner 主管理入口

`/dashboard` 已存在，且已经承载“我的 skill 概览”语义，但功能过轻且导航不稳定。继续在其上堆叠删除、恢复、详情管理等操作会让页面职责混乱。

因此选择：

- 保留 `/dashboard` 作为概览页
- 新增 `/my/skills` 作为 owner 管理主列表
- 新增 `/my/skills/:slug` 作为 owner 单个 skill 管理页

备选方案：

- 直接扩展 `/dashboard`
  - 优点：少一个新页面
  - 缺点：概览和管理耦合，后续继续扩展会越来越重

### 决策二：继续使用一个 `Management` 入口，但拆分 `Users` / `Skills` 两个场景

superuser 需要同时管理用户和 skill。若将其拆成多个一级入口，会造成导航过多且心智分散。

因此选择：

- 保留 `/management` 作为统一后台入口
- 在其下拆成两个明确场景：
  - `Users`
  - `Skills`

其中：

- `Users` 场景负责用户审核、禁用/启用、查看某用户发布的所有 skill
- `Skills` 场景负责全站 skill 搜索、筛选、删除、恢复、跳转 owner

备选方案：

- 分裂为 `/management/users` 和 `/management/skills` 两个完全独立入口
  - 优点：实现上更直接
  - 缺点：superuser 使用体验分散，与现有 `/management` 演进方向不一致

### 决策三：在 skill 管理场景中，`superuser` 完全等价 `admin`

当前 skill 权限部分仍依赖数据库 `role`。但系统已经引入配置驱动的 `superuser` 概念，并且用户已经确认在 skill 管理场景下 `superuser` 完全等价 `admin`。

因此选择：

- 后端 skill 管理权限统一收口为：
  - owner：可管理自己的 skill
  - moderator/admin：可管理任意 skill
  - superuser：可管理任意 skill，并与 admin 等价

备选方案：

- 要求 superuser 同时具备数据库 `role=admin`
  - 优点：权限模型单一
  - 缺点：与当前配置型超级用户机制冲突，增加初始化复杂度

### 决策四：第一阶段仅支持软删除，不引入 hard delete

现有 skill 模型已经基于 `is_deleted` 支持软删除，恢复流程和公开列表过滤也与之匹配。继续沿用软删除可以最小化后端与前端改动范围。

因此选择：

- owner 与 superuser 均使用软删除 / 恢复语义
- management 后台展示 `active` / `deleted` 两类状态

备选方案：

- 直接引入 hard delete
  - 优点：清理更彻底
  - 缺点：风险高，恢复困难，还需要处理版本和文件存储清理策略

### 决策五：新增 owner/self 视角 API，而不是复用公开用户资料 API

当前 `/users/:handle/skills` 是公开资料接口，面向 profile 展示。用它驱动 owner 管理页会带来两个问题：

- 语义不清晰：公开展示接口和管理后台接口混用
- 权限与状态扩展困难：管理页需要返回删除状态、owner 专属动作、内部筛选

因此选择：

- 新增 `GET /api/v1/my/skills`
- 新增 `GET /api/v1/my/skills/:slug`

同时保留公开资料接口用于公开 profile。

### 决策六：用户视角下允许 superuser 查看某用户的所有 skill，并在同页管理

用户要求在 management 的用户场景中，可以选中一个用户并看到这个用户的所有 skill，直接执行 skill 管理。

因此选择：

- `Users` 场景不仅展示用户状态，也展示该用户的 skill 列表
- 在用户详情视图中支持对该用户 skill 执行删除 / 恢复
- `Skills` 场景则提供全站列表和按 skill 搜索

这样可以同时满足：

- 从人出发管理内容
- 从内容出发管理内容

## Risks / Trade-offs

- [风险] `superuser` 与 `role` 权限判断分散在多个 handler 中，容易出现新页面能看见但动作接口 403
  → Mitigation：将 skill 管理权限统一收口到后端公共判断函数，并在 spec 中明确 `superuser == admin`

- [风险] `/dashboard`、`/my/skills`、`/$owner/$slug` 三个页面短期内会有功能重叠
  → Mitigation：将 `/dashboard` 定位为概览，管理动作收口到 `/my/skills` 和 `/management`

- [风险] 继续使用软删除会让“删除后仍可恢复”的语义与部分运营预期不一致
  → Mitigation：在 UI 中明确标注 `Delete` 为软删除，并提供 `Restore`

- [风险] `Users` 与 `Skills` 两个管理场景共享同一个 `/management` 入口，状态和筛选可能复杂化
  → Mitigation：第一阶段仅支持最小筛选项，避免一次引入过多后台交互复杂度

- [风险] owner 仍然无法编辑 metadata，用户可能把“管理页”理解为“完整编辑页”
  → Mitigation：在第一阶段明确页面定位为“版本与生命周期管理”，而不是元信息编辑器
