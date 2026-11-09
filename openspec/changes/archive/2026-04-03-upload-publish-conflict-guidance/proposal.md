## Why

当前上传页在 `slug` 已存在、同一用户应发布新版本、或版本号重复时，仍可能只向用户展示通用失败提示。这会把可恢复的业务冲突伪装成服务故障，导致用户不知道应该改 `slug`、改 `version`，还是继续按“发布新版本”路径操作。

## What Changes

- 在上传页增加 `slug` 存在性检查，将页面语义区分为“可新建”“发布新版本”“标识被占用”。
- 当 `slug` 属于当前用户时，在上传页展示当前最新版本，并将提交动作解释为“发布新版本”而不是“新建 skill”。
- 当 `slug` 属于其他用户时，上传页明确提示已被占用并阻止继续发布。
- 当当前用户提交了已存在的版本号时，页面应提示升级版本号，而不是展示通用服务端错误。
- 调整发布错误语义，要求已知业务冲突返回稳定的冲突状态，而不是统一为 500。

## Capabilities

### New Capabilities

- `upload-publish-guidance`: 定义上传页在 `slug` 检查、发布新版本识别、版本冲突提示和字段级引导方面的交互行为。

### Modified Capabilities

- `skill-publishing`: 调整发布冲突处理要求，明确 `slug` 归属冲突和重复版本必须暴露为稳定业务错误，而不是通用内部错误。

## Impact

- 上传页与相关 hooks：`src/routes/upload.tsx`、可能新增上传页专用检查 hook
- 上传页文案与状态提示：`src/copy/upload.ts`
- 上传页测试：`src/__tests__/upload.route.test.tsx`
- Go 后端发布接口冲突语义：`backend/internal/handler/publish.go`
- OpenSpec 规格：新增 `upload-publish-guidance`，修改 `skill-publishing`
