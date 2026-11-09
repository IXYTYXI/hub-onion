## Why

当前上传页虽然已经支持目录、拖拽和压缩包展开，但仍要求用户手工重复填写 `SKILL.md` 中已有的名称信息，并且在文件列表出现不合法文件时只能回到本地目录删除后重新上传。这两个问题都会显著拉高发布操作成本，已经成为上传体验中的直接阻塞点。

## What Changes

- 在上传页本地解析展开后的 `SKILL.md` 或 `skills.md` frontmatter，读取 `name` 作为默认填充来源。
- 当 `slug` 为空且未被用户手工修改时，基于 frontmatter `name` 自动生成合法 slug。
- 当 `displayName` 为空且未被用户手工修改时，基于 frontmatter `name` 自动填充默认显示名称。
- 在上传页文件列表的每一行增加删除交互，允许用户直接移除单个文件。
- 删除文件后立即重算文件数量、总大小、必需文件校验、非文本文件校验和发布按钮可用状态。
- 将 frontmatter 解析逻辑放到新的前端共享位置，不再从 `convex/` 目录复用旧实现。

## Capabilities

### New Capabilities

- `upload-page-authoring`: 定义上传页本地自动填充与文件列表编辑行为，包括 `SKILL.md` 名称解析、手工输入优先级和单文件删除交互。

### Modified Capabilities

- `skill-publishing`: 调整上传前客户端行为要求，明确发布流程必须支持基于本地文件列表的自动元数据补全和删除后即时校验重算。

## Impact

- 前端上传页：`src/routes/upload.tsx`
- 新的前端共享解析工具：`src/lib/skillFrontmatter.ts`
- 上传页文案与样式：`src/copy/upload.ts`、`src/styles.css`
- 上传页测试：`src/__tests__/upload.route.test.tsx`
- OpenSpec 规格：新增 `upload-page-authoring`，修改 `skill-publishing`
