## ADDED Requirements

### Requirement: 上传页 SHALL 基于 SKILL.md 自动补全默认字段
系统 SHALL 在上传页完成文件展开后，尝试读取当前文件列表中的 `SKILL.md` 或 `skills.md` frontmatter `name`，并将其作为 `slug` 与 `displayName` 的默认值来源。

#### Scenario: 从 SKILL.md 自动填充默认字段
- **WHEN** 用户上传的目录或压缩包在展开后的文件列表中包含有效的 `SKILL.md`，且其 frontmatter `name` 可被解析
- **THEN** 系统 SHALL 基于该 `name` 生成推荐 slug，并在 `slug` 为空时自动填入
- **THEN** 系统 SHALL 在 `displayName` 为空时自动填入默认显示名称

#### Scenario: 无法解析 frontmatter 时保持手工流程
- **WHEN** 当前文件列表中的 `SKILL.md` 不包含可解析的 frontmatter，或 `name` 缺失、为空、格式非法
- **THEN** 系统 SHALL 不阻断上传页交互
- **THEN** 系统 SHALL 保持现有手工填写流程可用

### Requirement: 用户手工输入 MUST 高于自动补全
系统 MUST 将用户手工输入视为高于自动解析结果的最终优先级，不得在后续重新上传或重新解析时覆盖用户已修改字段。

#### Scenario: 已手工编辑 slug 时不再自动覆盖
- **WHEN** 用户已经手工修改过 `slug`，随后重新上传目录、重新拖拽文件或重新选择压缩包
- **THEN** 系统 MUST 不因新的 `SKILL.md` 解析结果覆盖当前 `slug`

#### Scenario: 已手工编辑 displayName 时不再自动覆盖
- **WHEN** 用户已经手工修改过 `displayName`，随后重新上传目录、重新拖拽文件或重新选择压缩包
- **THEN** 系统 MUST 不因新的 `SKILL.md` 解析结果覆盖当前 `displayName`

### Requirement: 上传页 SHALL 支持逐文件删除
系统 SHALL 在上传页的文件列表中为每个文件提供单独删除能力，以便用户在发布前直接修正当前本地文件集合。

#### Scenario: 删除单个文件
- **WHEN** 用户点击文件列表某一行的删除入口
- **THEN** 系统 SHALL 立即从当前待发布文件集合中移除该文件
- **THEN** 系统 SHALL 立即从页面文件列表中移除对应项

### Requirement: 删除后 MUST 立即重算本地校验状态
系统 MUST 在文件删除后，基于剩余文件集合即时重算上传页的所有本地校验和发布可用状态。

#### Scenario: 删除非文本文件后移除对应错误
- **WHEN** 用户删除当前文件列表中的非文本文件
- **THEN** 系统 MUST 立即重算非文本文件校验
- **THEN** 若剩余文件中已无非文本文件，系统 MUST 立即移除相关错误提示

#### Scenario: 删除 SKILL.md 后阻止发布
- **WHEN** 用户删除当前文件列表中的 `SKILL.md` 或 `skills.md`
- **THEN** 系统 MUST 立即显示缺少必需文件的校验提示
- **THEN** 系统 MUST 立即将发布按钮置为不可用

#### Scenario: 删除最后一个文件后回到空状态
- **WHEN** 用户删除当前文件列表中的最后一个文件
- **THEN** 系统 MUST 立即将文件数和总大小重算为空状态
- **THEN** 系统 MUST 立即恢复“请至少添加一个文件”或等价的空状态校验提示
