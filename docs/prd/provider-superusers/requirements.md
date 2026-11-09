# 授权身份驱动 Superusers 需求文档

## 1. 文档目的

本文档用于定义 ClawHub 当前项目中“基于授权身份信息配置 superusers，并移除 `hasBoundEmail` 权限依赖”的需求边界，作为后续技术设计、任务拆解和实施验收的依据。

本文档基于当前仓库代码现状编写，重点关注后端权限模型、配置结构与相关测试，不涉及前端大规模重构。

## 2. 背景

当前系统中的 `superuser` 逻辑仍然建立在本地邮箱绑定前提上：

- `IsSuperuser(user)` 先要求 `HasBoundEmail(user)`
- `HasManagementAccess(user)` 也先要求 `HasBoundEmail(user)`
- `superusers` 配置仍以本地用户字段为主，例如 `user_id`、`email`、`handle`

这与当前产品方向存在冲突：

- 平台已经以飞书等授权身份作为主登录来源
- 管理权限希望基于授权身份而不是本地邮箱绑定
- 使用本地 `users.email` 做超级管理员匹配会把权限模型继续耦合到旧邮箱体系

因此，需要将超级管理员配置和权限判定迁移到“授权身份驱动”的模型。

## 3. 核心目标

本次需求的核心目标如下：

1. 使用 provider 分层配置表达 superusers
2. 基于授权身份信息而不是本地 `users.email` 判定 superuser
3. 移除 `HasBoundEmail()` 对 superuser 的限制
4. 移除 `HasBoundEmail()` 对 management access 的限制
5. 保留邮箱绑定业务能力，但不再让邮箱绑定状态决定权限

## 4. 目标配置结构

本次确认的目标配置结构如下：

```yaml
auth:
  superusers:
    providers:
      feishu:
        emails:
          - "admin@example.com"
        subjects:
          - "ou_xxx"
      gitlab:
        emails:
          - "admin@gitlab.example.com"
```

这里的语义定义如下：

- `providers.<provider>.emails`
  - 使用该授权来源上的邮箱字段做 superuser 匹配
- `providers.<provider>.subjects`
  - 使用该授权来源上的稳定 subject 标识做 superuser 匹配

## 5. 范围

### 5.1 本次必须覆盖

- `auth.superusers` 改为 provider 分层的结构化配置
- superuser 匹配不再使用本地 `users.email`
- superuser 判定基于授权身份信息
- management access 不再要求 `HasBoundEmail()`
- 后端相关测试更新为新权限模型

### 5.2 本次建议覆盖

- 保留 `user_id` / `handle` 作为兼容匹配键时的策略说明
- 明确 `subjects` 对应的 provider 字段来源
- 梳理 `/api/v1/users/me` 返回字段在新模型下的语义变化

### 5.3 本次明确不做

- 不删除 `hasBoundEmail` 数据字段
- 不删除邮箱绑定流程
- 不删除邮箱登录流程
- 不删除用户审核接口
- 不处理存量用户迁移
- 不在本次内完成完整权限系统重构以外的产品调整

## 6. 产品与权限规则

### 6.1 新的 superuser 判定规则

系统应支持基于授权身份信息判断 superuser，至少支持：

- `feishu.emails`
- `feishu.subjects`
- `gitlab.emails`

匹配命中后：

- 该用户可被视为 superuser
- 不再要求该用户先完成本地邮箱绑定

### 6.2 新的 management access 规则

系统的 management access 判定应改为：

- `role == admin`
- 或 `role == moderator`
- 或 `isSuperuser == true`

其中：

- 不再以 `hasBoundEmail` 作为前置条件

### 6.3 `hasBoundEmail` 的新语义

`hasBoundEmail` 在本次变更后仍可继续存在，但语义应收敛为：

- 邮箱绑定业务状态字段

而不是：

- superuser 或 management access 的前置条件

## 7. 当前实现影响范围

### 7.1 后端配置

核心影响位置：

- `backend/internal/config/config.go`
- `backend/config/default.yaml`
- `AUTH_SUPERUSERS_JSON` 的解析逻辑

### 7.2 后端权限判断

核心影响位置：

- `backend/internal/service/auth_service.go`

### 7.3 后端接口返回

核心影响位置：

- `backend/internal/handler/user.go`

### 7.4 前端角色判断

核心影响位置：

- `src/lib/roles.ts`

### 7.5 测试

核心影响位置：

- `backend/internal/service/auth_service_test.go`
- `backend/test/integration/user_review_workflow_test.go`
- `backend/test/integration/skill_management_test.go`

## 8. 主要风险

### 8.1 权限语义变化

变更完成后，系统将允许出现如下组合：

- `hasBoundEmail = false`
- `isSuperuser = true`
- `hasManagementAccess = true`

这在新模型下是正确行为，但需要确保相关代码和测试不再把它当作非法组合。

### 8.2 配置兼容问题

如果当前仍有旧格式的 `superusers` 配置在使用，则需要明确是直接替换还是短期兼容。

### 8.3 授权字段来源差异

不同 provider 的“subject”实际字段来源可能不同，需要在技术方案中明确映射关系。

## 9. 验收标准

本次需求完成后，应满足以下验收结果：

1. `auth.superusers` 支持 provider 分层配置结构。
2. superuser 判定不再使用本地 `users.email`。
3. `IsSuperuser` 不再依赖 `HasBoundEmail()`。
4. `HasManagementAccess` 不再依赖 `HasBoundEmail()`。
5. 命中 provider 配置的用户，即使未绑定本地邮箱，也可拥有 superuser 与 management access。
6. 前端角色判断不再要求 `hasBoundEmail === true` 才认定 admin / moderator / superuser。
7. 相关单元测试和集成测试更新为新权限模型。
