## MODIFIED Requirements

### Requirement: CLI 兼容性
系统 SHALL 确保 well-known 响应格式符合 CLI 期望，并且通过该发现结果得到的 API 基础地址可直接用于当前 CLI 的 v1 路径调用。

#### 场景：响应格式验证
- **当** CLI 获取 well-known 端点时
- **则** 响应应符合 packages/schema 中定义的预期 schema

#### 场景：存在必填字段
- **当** 返回 well-known 响应时
- **则** 必填字段 apiBase 应存在，authBase 和 minCliVersion 为可选字段

#### 场景：发现后的 API 可直接访问
- **当** CLI 使用 well-known 返回的 `apiBase` 组装 `/search`、`/skills`、`/resolve`、`/whoami` 等 v1 路径时
- **则** 系统应保证这些路径对当前 CLI 可用，而不是要求 CLI 再做额外路径转换
