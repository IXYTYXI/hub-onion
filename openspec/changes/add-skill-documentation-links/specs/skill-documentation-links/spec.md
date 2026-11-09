## ADDED Requirements

### Requirement: skill 以有序结构保存相关文档链接
系统 SHALL 在 skill 级别保存有序的 `documentationLinks` 数组。每项 MUST 包含非空 `url`，并 MAY 包含非空 `title`；数组顺序 MUST 与发布者提交并通过规范化后的顺序一致。

#### Scenario: 保存多个相关文档
- **WHEN** 发布请求携带两个通过校验的 `documentationLinks`
- **THEN** 系统 SHALL 将两个对象保存到当前 skill
- **THEN** 系统 SHALL 保持两个链接的提交顺序

#### Scenario: 保存不带标题的链接
- **WHEN** 某个相关文档对象只包含合法 `url` 而未包含 `title`
- **THEN** 系统 SHALL 接受并保存该链接
- **THEN** 系统 MUST NOT 为其写入虚构标题

#### Scenario: 历史 skill 没有相关文档
- **WHEN** 系统读取迁移前创建且未配置相关文档的 skill
- **THEN** 系统 SHALL 将其相关文档解释为空数组
- **THEN** 系统 MUST NOT 返回 `null`

### Requirement: 相关文档链接 MUST 通过统一 URL 校验
系统 MUST 在持久化前规范化并校验完整的 `documentationLinks` 数组。每个 skill 最多允许 10 个链接；`title` 去除首尾空白后可选且最多 80 个 Unicode 字符；`url` 去除首尾空白后必填且最多 2048 个字符，并且必须是包含 hostname 的绝对 `http` 或 `https` URL。

#### Scenario: 接受飞书、GitHub、GitLab 或其他 HTTP 文档
- **WHEN** 发布者提交的绝对 URL 使用 `http` 或 `https`，包含非空 hostname，且满足长度与数量限制
- **THEN** 系统 SHALL 接受该 URL，无论 hostname 属于飞书、GitHub、GitLab、自建 GitLab 或其他文档平台

#### Scenario: 保留查询参数和锚点
- **WHEN** 合法 URL 包含 query 参数或 fragment
- **THEN** 系统 SHALL 在去除首尾空白后原样保存 query 参数和 fragment

#### Scenario: 拒绝非 HTTP 协议或相对地址
- **WHEN** 任一 URL 使用 `javascript`、`data`、`file` 等非 `http`/`https` scheme，或不是包含 hostname 的绝对地址
- **THEN** 系统 MUST 拒绝整个发布请求
- **THEN** 系统 SHALL 返回 `400 Bad Request` 和错误 code `invalid_documentation_link`

#### Scenario: 拒绝携带用户凭据的 URL
- **WHEN** 任一 URL 包含 username 或 password userinfo
- **THEN** 系统 MUST 拒绝整个发布请求并返回 `invalid_documentation_link`

#### Scenario: 拒绝超限或重复链接
- **WHEN** 链接数量超过 10、标题超过 80 个 Unicode 字符、URL 超过 2048 个字符，或同一数组包含去除首尾空白后完全相同的 URL
- **THEN** 系统 MUST 拒绝整个发布请求并返回 `invalid_documentation_link`

#### Scenario: 校验失败不产生发布副作用
- **WHEN** 任一相关文档链接未通过校验
- **THEN** 系统 MUST NOT 上传 skill 文件
- **THEN** 系统 MUST NOT 创建新版本或修改当前 skill 的已有相关文档

### Requirement: skill 详情页展示相关文档
系统 SHALL 在 skill 详情页主信息之后、安装方式区域之前展示非空 `documentationLinks`，并将每个链接作为安全外链渲染。

#### Scenario: 展示带标题的相关文档
- **WHEN** 当前 skill 的相关文档链接包含非空 `title`
- **THEN** 详情页 SHALL 以 `title` 作为主要可点击文本
- **THEN** 详情页 SHALL 同时展示目标 hostname，帮助用户识别外部站点

#### Scenario: 展示不带标题的相关文档
- **WHEN** 当前 skill 的相关文档链接没有 `title`
- **THEN** 详情页 SHALL 使用 URL hostname 作为可点击文本

#### Scenario: 安全打开外部文档
- **WHEN** 用户点击任一相关文档链接
- **THEN** 链接 SHALL 在新窗口或新标签页打开
- **THEN** 链接 MUST 同时设置 `target="_blank"` 和 `rel="noopener noreferrer"`
- **THEN** 前端 MUST NOT 将 `title` 或 `url` 作为 HTML 注入页面

#### Scenario: 无相关文档时不展示空卡片
- **WHEN** 当前 skill 的 `documentationLinks` 为空数组
- **THEN** 详情页 MUST NOT 渲染“相关文档”卡片或空状态占位
