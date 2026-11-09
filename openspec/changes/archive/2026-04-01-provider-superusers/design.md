## Context

当前 ClawHub 的 superuser 与 management access 仍然依赖本地邮箱绑定状态，这使得权限模型继续耦合在旧邮箱体系上。与此同时，系统已经具备 `auth_identities` 数据模型，并以飞书、GitLab 等授权身份作为主要登录来源，因此权限判断与配置方式需要切换到“授权身份驱动”。

本次变更会影响配置解析、后端权限判断、后端接口返回语义、前端角色判断以及相关单元测试与集成测试。变更是跨模块的，但边界清晰，不要求删除邮箱业务能力或重构完整认证体系。

## Goals / Non-Goals

**Goals:**

- 使用 provider 分层结构表达 `auth.superusers`
- 引入基于 identities 的 superuser 判断能力
- 移除 `HasBoundEmail()` 对 superuser 的限制
- 移除 `HasBoundEmail()` 对 management access 的限制
- 保留 `hasBoundEmail` 作为业务状态字段，而不是权限门槛

**Non-Goals:**

- 不删除 `has_bound_email` 字段
- 不删除邮箱绑定与邮箱登录链路
- 不删除用户审核接口
- 不处理存量用户迁移
- 不对前端做超出角色判断以外的大范围重构

## Decisions

### 决策一：`auth.superusers` 改为 provider 分层配置

选择：

- 使用如下结构：
  - `auth.superusers.providers.<provider>.emails`
  - `auth.superusers.providers.<provider>.subjects`

原因：

- 语义清晰，直接表达“某授权来源上的哪些身份是 superuser”
- YAML 与 JSON 都容易表达
- 便于未来继续扩展更多 provider 或更多身份字段

备选方案：

- 扁平化 key，例如 `feishu.email`

不采用原因：

- 可维护性差
- 后续扩展 provider 维度和字段维度时容易失控

### 决策二：引入 `IsSuperuserByIdentities(user, identities)`

选择：

- 新增 `IsSuperuserByIdentities(user, identities)`
- 保留 `IsSuperuser(user)` 作为收敛入口，由其内部加载 identities 再委托判断

原因：

- 当前调用方广泛依赖 `IsSuperuser(user)`，不适合一次性全量改签名
- 授权身份驱动的匹配规则需要集中在一处，避免散落实现

备选方案：

- 所有调用方都改为显式传入 identities

不采用原因：

- 改动面过大
- 对当前阶段不够经济

### 决策三：不再使用本地 `users.email` 参与 superuser 判断

选择：

- 彻底移除 `users.email` 作为 superuser 匹配源

原因：

- 本地邮箱字段属于旧权限模型的一部分
- 新需求已经明确要按授权身份信息判断 superuser
- 保留 `users.email` 会继续制造权限来源混乱

### 决策四：`HasManagementAccess` 仅依赖角色或 superuser

选择：

- `HasManagementAccess(user)` 改为：
  - `role == admin`
  - 或 `role == moderator`
  - 或 `IsSuperuser(user)`

原因：

- 这是与你确认的新权限模型完全一致的规则
- 可以让 management access 与邮箱绑定彻底解耦

备选方案：

- 继续保留 `HasBoundEmail` 作为附加门槛

不采用原因：

- 会直接违背本次需求
- 会导致 provider superuser 配置命中后仍然无权限

## Risks / Trade-offs

- [权限语义变化] → 用测试明确允许 `hasBoundEmail = false` 且 `hasManagementAccess = true`
- [配置切换风险] → 明确 YAML 与 `AUTH_SUPERUSERS_JSON` 的结构一致性，并补充配置解析测试
- [旧测试假设失效] → 系统性更新依赖 `HasBoundEmail: true` 的权限测试
- [字段仍存在导致误用] → 在设计与代码中明确：`hasBoundEmail` 仅表示业务状态，不再表示权限资格
