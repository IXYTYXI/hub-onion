## Context

当前上传页已经会读取 `SKILL.md` / `skills.md` frontmatter 的 `name`，用于自动补全 `slug` 和 `displayName`。后端 Go 发布接口接收 multipart 表单并保存 `skills`、`skill_versions`，但创建或更新 skill 时没有写入 `skills.description`，因此 `SkillService.skillToItem` 虽然会把非空 `Description` 映射为响应 `summary`，列表页和详情页仍然展示“暂无简介。”。

详情页文件预览由 `SkillFilesPanel` 管理选中文件、文件内容加载和本地缓存。页面已经有安装命令复制交互可参考，但文件预览区域缺少针对当前文件内容的复制入口。

## Goals / Non-Goals

**Goals:**
- 新发布或发布新版本时，从主说明文件 frontmatter `description` 提取简介并保存到现有 `skills.description`。
- 继续通过现有 `summary` 响应字段让列表页和详情页展示简介，不新增公开 API。
- 在详情页文件预览区域增加复制当前文件内容的按钮和成功状态。
- 覆盖前端与后端关键行为测试。

**Non-Goals:**
- 不回填历史 skill 的简介。
- 不新增上传页简介输入框。
- 不新增数据库字段或迁移目录。
- 不改变 CLI 发布 payload 格式。

## Decisions

### 决策 1：在后端发布链路解析简介

后端 `POST /api/v1/skills` 已经接收完整文件集合，且 CLI 和前端都走同一接口。简介提取放在后端可以保证前端上传、CLI 发布和未来导入链路语义一致，不需要要求每个客户端新增 payload 字段。

替代方案是前端解析 `description` 并加入 payload。该方案实现局部简单，但 CLI 发布仍然无法自动保存简介，且会扩大 payload schema 面。

### 决策 2：复用 `skills.description` 和 `summary`

数据层已有 `skills.description`，响应层已有 `summary`，前端列表和详情也已经消费 `summary` 并在为空时展示 fallback。因此本次只补齐写入链路，不新增数据库字段或响应字段。

发布新版本时，如果主说明文件中存在非空 `description`，则更新 `skills.description`；如果缺失、为空或 frontmatter 无法解析，则不阻断发布，并且不得清空已有的有效简介。新 skill 首次发布且没有可用 `description` 时，`skills.description` 保持空值。

### 决策 3：主说明文件选择规则保持上传页一致

主说明文件优先选择根目录 `SKILL.md`，其次 `skills.md`。匹配前应将路径统一为 `/` 分隔、去掉开头的 `./` 和 `/`，并做大小写不敏感比较；只有规范化后位于根目录的 `skill.md` / `skills.md` 才能作为主说明文件，子目录中的同名文件不得用于 skill 简介。

文件夹上传、拖拽目录和压缩包展开后的 multipart filename 必须携带规范化后的相对路径；否则后端无法区分根目录文件和子目录同名文件。发布 hook 需要复用上传页的路径规范化与单顶层目录剥离语义，确保后端收到的 `FileHeader.Filename` 就是发布包内路径。

### 决策 4：后端在上传前读取主说明文件

后端不能在 OSS 上传流被消费后再尝试解析 `description`。实现时应在调用文件上传处理前，从候选主说明文件的 `multipart.FileHeader` 单独 `Open()` 一次并读取文本；读取或解析失败只影响简介提取，不影响后续同一个文件被重新 `Open()` 并流式上传。

### 决策 5：复制按钮只复制已加载的当前文件内容

文件复制按钮放在文件预览 header 中，和当前选中文件路径、大小、hash 一起展示。按钮只在 `fileContent` 已加载且没有错误时启用，点击后调用 `navigator.clipboard.writeText(fileContent)`，成功后短暂显示“已复制”状态。

替代方案是复制列表中任意文件时先触发加载再复制。该方案会让按钮语义变复杂，也更容易出现加载失败和复制失败混在一起的状态。

## Risks / Trade-offs

- [Risk] YAML frontmatter 解析失败导致发布失败 → 解析失败 MUST 不阻断发布，只跳过简介写入。
- [Risk] 新版本缺少 `description` 时覆盖掉已有简介 → 实现时应按规格明确处理为空的行为，避免意外清空已有有效简介。
- [Risk] 前端 multipart filename 丢失目录信息导致后端误判根目录主说明文件 → 发布请求必须传递规范化后的相对路径，后端只信任规范化后位于根目录的主说明文件。
- [Risk] 剪贴板 API 在非安全上下文或测试环境不可用 → 复制失败时保持按钮可用并显示原状态，测试中通过 mock `navigator.clipboard` 验证成功路径。
- [Risk] 历史 skill 仍显示“暂无简介。” → 本次明确不做回填，后续如需要可单独设计数据修复 change。
