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

### Requirement: 上传页选择 skill 分类
系统 SHALL 在上传 skill 时允许用户从平台分类列表中多选分类。

#### Scenario: 加载分类选项
- **WHEN** 已登录用户访问 `/upload`
- **THEN** 前端 SHALL 请求 `GET /api/v1/categories`
- **THEN** 前端 SHALL 将返回分类作为多选选项展示
- **THEN** 前端 MUST NOT 将虚拟 `uncategorized` 作为可写入分类选项提交

#### Scenario: 多选分类发布
- **WHEN** 用户在上传页选择一个或多个分类并提交发布
- **THEN** 前端 SHALL 在发布 payload 中提交 `categorySlugs`
- **THEN** `categorySlugs` SHALL 包含用户选择的分类 slug

#### Scenario: 未选择分类发布
- **WHEN** 用户在上传页未选择任何分类并提交发布
- **THEN** 前端 SHALL 提交空分类集合或不提交 `categorySlugs`
- **THEN** 后端 SHALL 不创建任何分类关联
- **THEN** 系统 SHALL 将新 skill 视为未分类

#### Scenario: 分类控件不替代自由标签
- **WHEN** 上传页展示分类选择控件
- **THEN** 前端 SHALL 保留现有自由标签输入
- **THEN** 前端 MUST NOT 将分类选项写入 `tags`

### Requirement: 导入页选择 skill 分类
系统 SHALL 在从 GitHub 或 GitLab 导入并发布 skill 时允许用户选择分类。

#### Scenario: 导入页加载分类选项
- **WHEN** 已登录用户访问 `/import`
- **THEN** 前端 SHALL 请求 `GET /api/v1/categories`
- **THEN** 前端 SHALL 在导入预览后的发布表单中展示分类多选
- **THEN** 前端 MUST NOT 将虚拟 `uncategorized` 作为可写入分类选项提交

#### Scenario: 导入发布提交分类
- **WHEN** 用户在导入页选择分类并点击导入发布
- **THEN** 前端 SHALL 在发布 payload 中提交 `categorySlugs`

#### Scenario: 导入未选择分类
- **WHEN** 用户在导入页未选择任何分类并发布新 skill
- **THEN** 后端 SHALL 不创建任何分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类

### Requirement: skills 浏览页按分类筛选
系统 SHALL 在 skills 浏览页提供分类筛选，并与分页状态联动。

#### Scenario: 分类筛选选项
- **WHEN** 用户访问 `/skills`
- **THEN** 前端 SHALL 请求 `GET /api/v1/categories`
- **THEN** 前端 SHALL 将分类作为筛选选项展示
- **THEN** 前端 SHALL 额外提供 `未分类` 筛选项，并使用虚拟 slug `uncategorized`
- **THEN** 前端 MUST NOT 将虚拟 `uncategorized` 混入可写入的分类多选数据

#### Scenario: 选择分类筛选
- **WHEN** 用户选择某个分类
- **THEN** 前端 SHALL 将 URL search 参数设置为 `category=<slug>`
- **THEN** 前端 SHALL 使用该分类重新请求第一页 skills

#### Scenario: 选择未分类筛选
- **WHEN** 用户选择 `未分类` 筛选项
- **THEN** 前端 SHALL 将 URL search 参数设置为 `category=uncategorized`
- **THEN** 前端 SHALL 使用虚拟未分类筛选重新请求第一页 skills

#### Scenario: 分类切换重置分页
- **WHEN** 用户从一个分类切换到另一个分类
- **THEN** 前端 SHALL 重置当前无限分页数据
- **THEN** 后续加载更多 MUST 继续携带新的 `category` 参数

#### Scenario: 详情和卡片展示分类
- **WHEN** skill item 或详情响应包含 `categories`
- **THEN** 前端 SHALL 在 SkillCard、skills 列表行和 skill 详情页展示分类标签
- **THEN** 当前端收到空的 `categories` 时 SHALL 展示为 `未分类`
