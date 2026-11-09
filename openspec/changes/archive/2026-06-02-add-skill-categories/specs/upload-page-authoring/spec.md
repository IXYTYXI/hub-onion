## ADDED Requirements

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
