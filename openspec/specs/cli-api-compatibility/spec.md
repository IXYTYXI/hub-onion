## ADDED Requirements

### Requirement: CLI 核心接口兼容性基线
系统 SHALL 保证 `packages/clawdhub` 当前使用的 v1 API 在路径、响应包装层和字段类型上与 CLI schema 保持兼容。

#### Scenario: CLI 使用 schema 校验响应
- **WHEN** CLI 调用 registry 的 v1 接口并使用本仓库中的 arktype schema 校验响应
- **THEN** 系统 SHALL 返回可通过校验的 JSON 结构，而不是依赖 CLI 做宽松兼容

#### Scenario: 核心命令保持可用
- **WHEN** 用户执行 `search`、`explore`、`inspect`、`publish`、`delete`、`undelete`、`login`、`whoami`、`star` 或 `unstar`
- **THEN** 系统 SHALL 为这些命令依赖的 API 提供兼容路径和响应格式

### Requirement: 前端与 CLI 共用接口必须先完成盘点与影响评估
系统 SHALL 在修改 CLI 兼容性之前，先盘点当前前端与 CLI 访问的后端 API，并对共用接口记录兼容风险和处置方式。

#### Scenario: 共用接口盘点
- **WHEN** 实施 `fix-cli-api-compatibility` 变更
- **THEN** 系统 SHALL 形成至少包含“接口路径、调用方、当前后端行为、CLI 契约、前端依赖点、修复策略”的对照清单

#### Scenario: 共用接口需要双兼容
- **WHEN** 某个接口同时被前端和 CLI 使用，且当前返回结构或路径存在不兼容
- **THEN** 系统 SHALL 选择不会破坏现有前端逻辑的修复方式，例如补充兼容字段、保留前端入口或增加 CLI 别名路由

#### Scenario: 仅 CLI 使用的接口
- **WHEN** 某个不兼容接口仅被 CLI 使用
- **THEN** 系统 SHALL 允许直接按 CLI schema 修复，而不要求为前端增加额外兼容成本

### Requirement: 集合响应不得返回 null
系统 SHALL 对 CLI 会消费的集合字段显式返回空数组，而不是将 nil slice 序列化为 `null`。

#### Scenario: 搜索无结果
- **WHEN** `/api/v1/search` 没有匹配结果
- **THEN** 系统 SHALL 返回 `{ "results": [] }`

#### Scenario: 列表接口无结果
- **WHEN** skills 列表、版本列表或其他 CLI 消费的集合型接口没有结果
- **THEN** 系统 SHALL 返回 schema 要求的空数组和包装对象，而不是返回 `null` 或裸数组

### Requirement: 成功响应语义统一
系统 SHALL 对 CLI schema 中带 `ok` 字段的成功响应统一返回 `ok: "true"`，并通过额外字段表达业务状态。

#### Scenario: 发布成功
- **WHEN** CLI 调用发布接口成功
- **THEN** 系统 SHALL 返回 `ok: "true"`，并附带 `skillId` 与 `versionId`

#### Scenario: 幂等成功
- **WHEN** CLI 调用 star 或 unstar 的结果属于幂等成功
- **THEN** 系统 SHALL 仍返回 `ok: "true"`，并通过 `alreadyStarred` 或 `alreadyUnstarred` 等字段表达附加状态
