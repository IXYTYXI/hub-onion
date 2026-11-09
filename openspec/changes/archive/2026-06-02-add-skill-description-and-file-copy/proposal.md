## Why

当前上传 skill 后，后端没有从 `SKILL.md` / `skills.md` 中保存说明文字，导致 skills 列表页和详情页只能展示“暂无简介。”。同时，详情页已经能预览单个文件内容，但缺少一键复制当前文件内容的操作，用户需要手工选中复制，效率较低。

## What Changes

- 发布 skill 时，从主说明文件的 YAML frontmatter `description` 中提取简介，并保存到现有 `skills.description` 字段。
- 列表页 `http://localhost:3000/skills?sort=downloads` 和详情页继续消费现有 `summary` 字段，展示已保存的简介。
- 详情页文件预览区域为当前选中的文件增加复制按钮，点击后复制完整文件内容，并显示短暂成功状态。
- 不新增数据库字段，不新增公开 API，不回填历史数据；已有 skill 需要重新发布新版本后才会显示简介。

## Capabilities

### New Capabilities
- `skill-detail-file-preview`: 定义 skill 详情页文件预览区域的前端交互，包括复制当前文件内容。

### Modified Capabilities
- `skill-publishing`: 发布流程需要从主说明文件 frontmatter 提取 `description` 并持久化。
- `skill-crud-operations`: skills 列表和详情响应需要通过 `summary` 返回已保存简介，供列表页和详情页展示。

## Impact

- 后端：`POST /api/v1/skills` multipart 发布处理、frontmatter 解析与 `skills.description` 更新逻辑。
- 前端：详情页文件预览组件、复制按钮文案与状态；列表页和详情页应继续通过 `summary` 展示简介。
- 测试：Go 发布/查询集成测试、文件预览复制行为的前端组件测试。
