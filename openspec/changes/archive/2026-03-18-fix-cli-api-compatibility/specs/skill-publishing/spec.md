## MODIFIED Requirements

### Requirement: 发布响应格式
系统 SHALL 按照标准 schema 格式返回发布结果，并对现有 CLI 返回固定成功语义。

#### 场景：成功发布响应
- **当** 发布成功时
- **则** 系统应返回 200 OK，包含：
  - ok: "true"
  - skillId: string
  - versionId: string

#### 场景：CLI 发布兼容
- **当** `packages/clawdhub` CLI 调用 `POST /api/v1/skills`
- **则** 系统应返回与 `ApiV1PublishResponseSchema` 完全兼容的响应，而不是返回 `ok: "published"` 等自定义值
