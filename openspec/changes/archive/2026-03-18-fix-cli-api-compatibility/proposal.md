## Why

当前 Go 后端已经替换了部分原有接口实现，但 `packages/clawdhub` CLI 仍依赖一套更严格的 v1 API 路径与响应 schema。现状中存在空集合返回 `null`、响应包装层不一致、`ok` 语义不一致以及路径不匹配等问题，导致 `search`、`publish`、`delete`、`whoami`、`star` 等命令在本地后端上失败或存在高风险回归。

## What Changes

- 为 registry 增加明确的 CLI API 兼容性约束，要求 CLI 使用的 v1 端点在路径、字段名、空结果语义和成功响应格式上与 `packages/clawdhub` schema 保持一致。
- 先盘点当前前端与 CLI 共用的后端 API，逐项标注“仅 CLI 使用 / 仅前端使用 / 前端与 CLI 共用”，作为兼容修复的实现输入。
- 对所有需要调整的共用接口增加前端影响评估，要求修复 CLI 契约时不得破坏现有前端页面、hooks 与 fetch 逻辑；必要时通过兼容别名路由或补充字段实现双兼容。
- 修正 `/api/v1/search` 等返回集合的接口，确保无结果时返回空数组而不是 `null`，并统一使用对象包装层。
- 对齐 CLI 已使用接口的路径与响应格式，包括 `whoami`、`publish`、`delete`、`undelete`、`inspect --versions`、`star`、`unstar` 等。
- 对于尚未完全实现的 CLI 能力，明确兼容策略：补充兼容路由、返回符合 schema 的友好错误，或在 spec 中声明暂不支持并避免返回无法解析的结构。
- 增加针对 CLI 契约的后端回归测试，覆盖“有数据”和“无数据”两类场景，防止兼容性再次漂移。

## Capabilities

### New Capabilities
- `cli-api-compatibility`: 定义 registry 面向 `packages/clawdhub` CLI 的路径、响应结构、空结果语义和兼容性约束。

### Modified Capabilities
- `registry-discovery`: 明确 CLI 发现到的 registry API 必须可直接用于现有 CLI v1 路径。
- `skill-search`: 调整搜索结果的返回契约，保证空结果与有结果场景都符合 CLI schema。
- `skill-crud-operations`: 调整 skill 列表、详情、版本列表、删除与恢复接口的 CLI 兼容响应。
- `skill-publishing`: 调整发布成功响应格式，确保与 CLI publish 命令兼容。
- `skill-stars`: 调整 star/unstar 路径与成功响应语义，满足 CLI 调用约定。
- `skill-version-resolution`: 校正 resolve 与 inspect 相关版本查询接口的 CLI 契约一致性。
- `user-identity`: 调整 `whoami` 与相关用户识别接口，满足 CLI 登录和鉴权校验流程。

## Impact

- 后端路由与 handler：`backend/internal/handler/*`
- 后端响应模型与 service：`backend/internal/model/*`、`backend/internal/service/*`
- 前端 API 消费方：`src/hooks/*`、`src/routes/*`、`src/components/*`、`src/lib/*`
- CLI 契约来源：`packages/clawdhub/src/schema/*`、`packages/clawdhub/src/cli/commands/*`
- OpenSpec 能力：`openspec/specs/registry-discovery`、`openspec/specs/skill-search`、`openspec/specs/skill-crud-operations`、`openspec/specs/skill-publishing`、`openspec/specs/skill-stars`、`openspec/specs/skill-version-resolution`、`openspec/specs/user-identity`
