# 授权身份驱动 Superusers 技术方案文档

## 1. 设计目标

本文档给出 ClawHub 当前阶段“基于授权身份信息配置 superusers，并移除 `hasBoundEmail` 权限依赖”的技术方案，目标如下：

1. 用结构化配置表达按 provider 管理的 superusers
2. 用授权身份信息而不是本地邮箱做 superuser 判定
3. 将 management access 从邮箱绑定状态中解耦
4. 保持邮箱绑定业务能力继续存在，但退出权限门槛角色

## 2. 方案原则

本次方案坚持以下原则：

- 权限来源优先依赖授权身份，而不是本地邮箱字段
- 业务状态字段可以保留，但不得继续充当权限门槛
- 尽量在 `AuthService` 内部收敛判断逻辑，避免散落重复规则
- 前后端都要同步移除对 `hasBoundEmail` 的权限依赖

## 3. 当前实现分析

### 3.1 后端当前对 `hasBoundEmail` 的权限依赖

当前后端存在两处核心权限依赖：

#### `IsSuperuser`

位置：

- `backend/internal/service/auth_service.go`

当前行为：

- `user == nil` 返回 false
- `!HasBoundEmail(user)` 返回 false
- 然后才基于 `user.ID`、`user.Email`、`user.Handle` 匹配

问题：

- 即使用户授权身份命中了未来的 provider superuser 配置，也会先被本地邮箱绑定门槛拦住

#### `HasManagementAccess`

位置：

- `backend/internal/service/auth_service.go`

当前行为：

- `user == nil || !HasBoundEmail(user)` 返回 false
- 否则才判断 `role` / `isSuperuser`

问题：

- 即使用户已经是 superuser，也会被本地邮箱绑定状态继续阻挡

### 3.2 前端当前对 `hasBoundEmail` 的权限依赖

位置：

- `src/lib/roles.ts`

当前行为：

- `isAdmin()` 要求 `hasBoundEmail === true`
- `isModerator()` 要求 `hasBoundEmail === true`

问题：

- 即使后端权限逻辑改好了，前端仍可能把合法 superuser 当成无权限

### 3.3 当前可继续保留但不再作为权限门槛的使用

以下位置使用了 `HasBoundEmail` / `has_bound_email`，但它们本身不一定需要删除：

- `backend/internal/service/auth_service.go`
  - `StartEmailBinding`
  - `CompleteEmailBinding`
  - `LoginWithEmail`
- `backend/internal/service/identity_service.go`
  - 根据是否已绑定邮箱决定是否回填 `user.Email`
- `backend/internal/model/user.go`
  - `HasBoundEmail` 字段
- 数据库迁移
  - `000013_add_feishu_and_email_binding_fields.up.sql`

这些属于邮箱绑定业务本身，而不是权限门槛。

## 4. 配置模型设计

### 4.1 目标配置结构

目标结构如下：

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

### 4.2 推荐 Go 结构

建议配置结构设计为：

```go
type ProviderSuperuserConfig struct {
    Emails   []string `mapstructure:"emails"`
    Subjects []string `mapstructure:"subjects"`
}

type SuperusersConfig struct {
    Providers map[string]ProviderSuperuserConfig `mapstructure:"providers"`
}
```

并在 `AuthConfig` 中使用：

```go
Superusers SuperusersConfig `mapstructure:"superusers"`
```

### 4.3 配置解析说明

需要同步支持：

- YAML 配置文件
- `AUTH_SUPERUSERS_JSON`

`AUTH_SUPERUSERS_JSON` 的 JSON 形态应与 YAML 结构一致，例如：

```json
{
  "providers": {
    "feishu": {
      "emails": ["admin@example.com"],
      "subjects": ["ou_xxx"]
    },
    "gitlab": {
      "emails": ["admin@gitlab.example.com"]
    }
  }
}
```

## 5. 权限判断设计

### 5.1 新增 `IsSuperuserByIdentities`

建议在 `AuthService` 中引入：

- `IsSuperuserByIdentities(user, identities)`

职责：

- 接收当前本地用户和该用户的授权身份列表
- 遍历身份列表
- 按 `identity.Provider` 找到对应 provider 配置
- 使用 provider 维度下的 `emails` 与 `subjects` 做匹配

### 5.2 保留 `IsSuperuser` 作为收敛入口

建议保留：

- `IsSuperuser(user)`

但其内部改为：

1. 加载用户对应的 identities
2. 调用 `IsSuperuserByIdentities(user, identities)`

这样做的好处：

- 现有调用方不需要一次性大规模改签名
- provider superuser 判断逻辑可以集中收敛在一个位置

### 5.3 移除 `users.email` 参与 superuser 判断

本次明确不再用：

- `user.Email`

做 superuser 匹配。

原因：

- `users.email` 属于本地账号字段
- 新需求的 superuser 来源已切换为授权身份信息
- 保留 `users.email` 会继续把权限模型耦合回旧邮箱体系

### 5.4 `HasManagementAccess` 的新规则

建议将 `HasManagementAccess(user)` 改为：

- `user == nil` 返回 false
- 否则：
  - `role == admin`
  - 或 `role == moderator`
  - 或 `IsSuperuser(user)`

即：

- 不再检查 `HasBoundEmail(user)`

## 6. 需要移除的 `hasBoundEmail` 权限依赖清单

### 6.1 必须修改

- `backend/internal/service/auth_service.go`
  - `IsSuperuser`
  - `HasManagementAccess`

- `src/lib/roles.ts`
  - `isAdmin`
  - `isModerator`

### 6.2 必须回归验证

- `backend/internal/handler/user.go`
  - 所有依赖 `HasManagementAccess()` / `IsSuperuser()` 的管理用户接口

- `backend/internal/handler/skill_management.go`
  - 所有依赖 `HasManagementAccess()` / `IsSuperuser()` 的管理 skill 接口

### 6.3 可保留但需重新理解语义

- `backend/internal/handler/user.go`
  - `/api/v1/users/me` 继续返回 `hasBoundEmail`

- `src/lib/useAuthStatus.ts`
  - 继续接收 `hasBoundEmail`

- `src/types/api.ts`
  - 继续定义 `hasBoundEmail`

说明：

- 这些字段可以继续存在
- 但不得再被当作权限前提使用

## 7. 测试策略

### 7.1 后端单测

重点文件：

- `backend/internal/service/auth_service_test.go`

需要覆盖：

- 命中 `feishu.emails` 的用户可成为 superuser
- 命中 `feishu.subjects` 的用户可成为 superuser
- 命中 `gitlab.emails` 的用户可成为 superuser
- 未绑定本地邮箱不影响 superuser 判定
- 未绑定本地邮箱不影响 management access 判定

### 7.2 后端集成测试

重点文件：

- `backend/test/integration/user_review_workflow_test.go`
- `backend/test/integration/skill_management_test.go`

需要覆盖：

- superuser 管理接口不再要求 `HasBoundEmail`
- 管理 skill 接口不再要求 `HasBoundEmail`
- 旧测试里仅为满足权限门槛而设置 `HasBoundEmail: true` 的场景需要更新

### 7.3 前端验证

重点文件：

- `src/lib/roles.ts`
- 依赖前端角色判断的页面或组件测试

需要覆盖：

- 未绑定邮箱的 superuser 仍可被识别为管理用户
- 未绑定邮箱的 admin / moderator 仍可通过前端角色判断

## 8. 风险与取舍

- [权限语义改变] → 用文档和测试明确允许 `hasBoundEmail = false` 且 `hasManagementAccess = true`
- [配置迁移成本] → 明确新旧配置兼容策略，避免部署时解析失败
- [调用链过长] → 通过保留 `IsSuperuser(user)` 作为统一入口，减少大范围签名改动
- [字段仍然存在导致误用] → 在代码评审中明确：`hasBoundEmail` 只能表示邮箱绑定状态，不得再作为权限门槛

## 9. 非目标

本次方案不进入以下内容：

- 删除邮箱绑定流程
- 删除 `has_bound_email` 数据字段
- 删除邮箱登录链路
- 完整重构审核状态机
- 完整重构所有用户接口返回结构
