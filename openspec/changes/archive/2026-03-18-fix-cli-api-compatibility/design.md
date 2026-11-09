## Context

当前仓库的 Go 后端已经具备大部分 `packages/clawdhub` CLI 需要的能力，但接口实现与 CLI 契约存在两层漂移：

- 第一层是路径漂移，例如 CLI 请求 `/api/v1/whoami`、`/api/v1/stars/:slug`，而后端实际暴露的是 `/api/v1/users/me`、`/api/v1/skills/:slug/star`
- 第二层是响应漂移，例如空集合返回 `null`、版本列表返回裸数组、成功响应的 `ok` 字段使用 `"published"`/`"deleted"` 而不是 CLI schema 要求的 `"true"`

这类问题对浏览器端影响有限，因为前端通常只依赖项目内自己的 fetch 逻辑；但 CLI 在 `packages/clawdhub` 中对响应使用 arktype 强校验，一旦包装层或字段值不一致，就会直接失败。当前已经暴露出的 `search` 报错，本质上是 `results` 在无结果时返回了 `null`，而 CLI 要求数组。

本次设计需要解决的是“后端如何在尽量小的改动范围内恢复对现有 CLI 的兼容”，而不是重写 CLI 或引入第二套完全独立的 legacy API。

## Goals / Non-Goals

**Goals:**

- 让现有 `packages/clawdhub` CLI 针对本地 Go 后端的核心命令恢复可用
- 在实现前形成“CLI / 前端 / 共用”接口盘点，确保兼容修复有完整输入，而不是只按单个报错点修补
- 对所有共用接口明确前端影响，保证修复 CLI 契约时不破坏现有前端 fetch、hooks 和页面逻辑
- 统一 CLI 使用接口的路径、响应包装层、空结果语义和成功响应格式
- 优先修复已知高风险命令：`search`、`explore`、`inspect`、`publish`、`delete`、`undelete`、`login`、`whoami`、`star`、`unstar`
- 为“集合类响应不能返回 null”“CLI 成功响应必须匹配 schema”补充后端测试
- 对暂未实现的 CLI 功能给出明确兼容策略，避免返回无法解析的结构

**Non-Goals:**

- 不修改 `packages/clawdhub` CLI 现有路由常量和 schema 定义
- 不在本次变更中完成所有管理端 CLI 能力的完整实现
- 不引入新的 API 版本
- 不为浏览器端单独重做一套与 CLI 完全分叉的新 API

## Decisions

### 决策一：以后端向 CLI 契约靠拢为主，而不是修改 CLI

CLI 已经作为发布产物使用，且 schema 校验逻辑已经固化在 `packages/clawdhub` 中。对后端做兼容性调整，风险更可控，也不会影响用户安装的现有 CLI 版本。

备选方案：

- 修改 CLI schema 适配当前后端
  - 优点：短期上看改动集中在一个目录
  - 缺点：会破坏既有 CLI 契约，且无法帮助已发布版本

### 决策二：保留现有后端业务逻辑，增加兼容别名路由与统一响应整形

当前大部分问题不是业务能力缺失，而是 handler 的 HTTP 契约层不一致。因此优先采用两类修复：

- 对已有能力保留 service 层逻辑，调整 handler 返回结构
- 对路径不匹配的命令增加 CLI 兼容路由，必要时复用同一 handler

这样可以避免把 star、whoami 之类逻辑迁移到新路径后影响现有前端调用。

备选方案：

- 彻底替换现有路由为 CLI 风格
  - 优点：统一路径表面上更简洁
  - 缺点：会影响前端既有调用，且需要同步更多页面代码

### 决策二补充：先建立共用接口矩阵，再决定“改原接口”还是“加兼容入口”

本次变更不是纯 CLI 修复。凡是前端和 CLI 都会用到的接口，需要先确认：

- 前端当前调用路径
- CLI 当前调用路径
- 双方是否共享同一响应契约
- 如果后端改成 CLI 契约，前端会不会立刻受影响

判断规则：

- 仅 CLI 使用的接口，可以直接向 CLI schema 靠拢
- 前端与 CLI 共用但契约一致的接口，直接修复为共同兼容形态
- 前端与 CLI 共用但契约不一致的接口，优先通过补字段、兼容包装或新增别名路由保留前端行为，避免强迫前端同步改动

这样可以把“修复 CLI”与“避免前端回归”统一到同一决策框架里，而不是边改边猜

### 决策三：所有集合响应显式初始化为空数组，禁止用 nil slice 直出

`search` 已经证明 `nil slice -> null` 会直接导致 CLI schema 校验失败。后续所有 CLI 会消费的集合响应都应显式初始化为空数组，并保留对象包装层，例如：

- `search` 返回 `{ "results": [] }`
- `skills/:slug/versions` 返回 `{ "items": [], "nextCursor": null }`

备选方案：

- 在 JSON 序列化层做全局 nil-slice 正规化
  - 优点：理论上一次性解决
  - 缺点：范围过大，容易引入非 CLI 路径的不可见行为变化

### 决策四：成功响应的 `ok` 统一按 CLI schema 返回 `"true"`

当前 `"published"`、`"deleted"`、`"undeleted"`、`"starred"`、`"unstarred"` 这类业务语义字符串不符合 CLI schema。对 CLI 会校验的成功响应，统一返回：

- `ok: "true"`

额外业务状态如 `alreadyStarred`、`alreadyUnstarred`、`starred`、`unstarred` 等应使用独立字段表达，而不是占用 `ok`。

备选方案：

- 扩展 CLI schema 接受更多 `ok` 值
  - 优点：可以少改后端
  - 缺点：会扩大 CLI 契约面，且无法保证旧版本 CLI 可用

### 决策五：对“已实现能力”和“暂未实现能力”采用不同兼容策略

对于已实现但契约漂移的能力，直接修复路径和响应；
对于暂未实现的 CLI 管理能力，优先返回明确的受控错误，或在 spec 中约束为当前阶段不支持，避免出现 404 HTML、裸对象、或无 schema 的错误返回。

这让后续工作能先聚焦用户最常用的 skill 管理链路，再决定是否补齐 moderation CLI。

## Risks / Trade-offs

- [风险] 增加兼容别名路由后，后端会同时维护两组入口
  → Mitigation：只对 CLI 已使用且前端未依赖的路径补别名，并复用同一 handler，避免双实现

- [风险] 调整成功响应格式后，可能影响依赖旧字符串语义的前端代码
  → Mitigation：仅调整 CLI 相关接口，前端已调用的路径保持兼容；必要时增加字段而不是删除字段

- [风险] 版本列表、whoami 等接口的包装层变化可能引入测试缺口
  → Mitigation：为关键 CLI 场景补充 handler/integration 测试，至少覆盖空结果、成功返回、未认证三类场景

- [风险] moderation 相关 CLI 功能与当前后端管理路由设计差距较大
  → Mitigation：在本次 change 中优先标记为次级风险，先修复核心技能链路，再决定是否通过兼容适配或 CLI 侧降级处理

## Migration Plan

1. 盘点 `packages/clawdhub` 与 `src/` 实际使用的后端路由、schema 和响应依赖，输出共用接口矩阵
2. 对每个不兼容点判断是否影响前端；若影响，则优先采用兼容别名、补充字段或保留旧入口
3. 按高优先级修复空数组、成功响应和路径不匹配问题
4. 增加 CLI 兼容测试，先覆盖 `search/publish/delete/whoami/star`
5. 验证前端共用路径在兼容修复后仍可正常消费
6. 本地验证 CLI 核心命令可用

回滚策略：

- 若兼容路由导致异常，可先保留旧路由并临时移除新增别名
- 若单个 handler 的响应改动引发前端问题，可回退该 handler，改为单独添加 CLI 兼容入口

## Open Questions

- moderation 相关 CLI 是否必须在本次一起修复，还是先只修核心 skill 生命周期链路
- `whoami` 最终采用新增 `/api/v1/whoami` 兼容入口，还是让 CLI 改走 `/api/v1/users/me`；当前设计倾向前者
