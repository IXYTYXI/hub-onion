## MODIFIED Requirements

### Requirement: 搜索响应格式
系统 SHALL 按照标准 schema 格式返回搜索结果，并在有结果和无结果场景下都保持 CLI 可解析的对象包装结构。

#### 场景：标准响应结构
- **当** 搜索请求成功时
- **则** 系统应返回 JSON 响应，包含 results 数组，每个元素包含：
  - slug: string（技能标识符）
  - displayName: string（显示名称）
  - summary: string | null（简短描述）
  - version: string | null（最新版本号）
  - score: number（相似度分数）
  - updatedAt: number（可选，更新时间戳）

#### 场景：空搜索结果
- **当** 没有找到匹配的技能时
- **则** 系统应返回空数组 `{ "results": [] }`，不得返回 `{ "results": null }` 或裸数组

#### 场景：CLI 搜索兼容
- **当** `packages/clawdhub` CLI 调用 `/api/v1/search`
- **则** 系统应返回与 `ApiV1SearchResponseSchema` 一致的对象结构，使 CLI 在 schema 校验后可直接读取 `result.results`
