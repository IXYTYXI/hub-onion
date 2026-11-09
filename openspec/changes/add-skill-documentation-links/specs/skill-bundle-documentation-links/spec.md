## ADDED Requirements

### Requirement: 技能包复用文档链接结构并独立保存
系统 SHALL 为技能包提供有序的 `documentationLinks` 数组，每项 MUST 使用与 skill 相同的 `{ title?: string, url: string }` 结构和 JSON 序列化规则。技能包链接 MUST 独立保存在 `skill_bundles`，不得从包内 Skill 聚合或覆盖包内 Skill 的链接。

#### Scenario: 技能包保存多个相关文档
- **WHEN** 发布者创建或更新技能包并提交两个通过校验的 `documentationLinks`
- **THEN** 系统 SHALL 将规范化后的两个对象保存到该技能包
- **THEN** 系统 SHALL 保持发布者提交的链接顺序

#### Scenario: 技能包与包内 Skill 的链接相互独立
- **WHEN** 技能包自身和包内某个 Skill 分别保存了不同的相关文档
- **THEN** 技能包响应 SHALL 只在 `bundle.documentationLinks` 返回技能包自身的链接
- **THEN** 系统 MUST NOT 将包内 Skill 的链接复制、合并或写回技能包

#### Scenario: 历史技能包没有相关文档
- **WHEN** 系统读取字段迁移前创建且未配置相关文档的技能包
- **THEN** 系统 SHALL 将其相关文档解释为 `[]`
- **THEN** 系统 MUST NOT 返回 `null`

### Requirement: 所有 BundleItem 响应返回稳定文档链接数组
系统 SHALL 在 `BundleItem` 中通过 `documentationLinks` 返回技能包当前保存的完整有序数组。公共列表、公共详情、当前用户技能包列表、admin 列表和 admin 详情等复用 `BundleItem` 的响应 MUST 包含该字段。

#### Scenario: 公共技能包详情返回相关文档
- **WHEN** 客户端请求 `GET /api/v1/bundles/{slug}`，且技能包已保存相关文档
- **THEN** 响应中的 `bundle.documentationLinks` SHALL 按保存顺序返回所有链接

#### Scenario: 技能包列表和管理响应保持一致
- **WHEN** 系统通过公共列表、当前用户技能包列表、admin 列表或 admin 详情返回 `BundleItem`
- **THEN** 每个技能包条目 SHALL 包含 `documentationLinks`
- **THEN** 链接顺序和对象结构 SHALL 与公共详情响应一致

#### Scenario: 无相关文档时返回空数组
- **WHEN** 技能包没有保存任何相关文档
- **THEN** 所有 `BundleItem` 响应 SHALL 返回 `documentationLinks: []`
- **THEN** 系统 MUST NOT 省略该字段或返回 `null`

### Requirement: 技能包发布支持文档链接三态更新
系统 SHALL 允许 `POST /api/v1/bundles` JSON payload 携带可选 `documentationLinks`。字段存在时 MUST 是文档链接对象数组；更新已有技能包时，系统 MUST 区分字段缺省、空数组和非空数组。

#### Scenario: 新建技能包时缺省相关文档
- **WHEN** 已认证用户创建新技能包且 payload 未包含 `documentationLinks`
- **THEN** 系统 SHALL 正常创建技能包
- **THEN** 新技能包 SHALL 保存空的相关文档数组

#### Scenario: 新建技能包并提交相关文档
- **WHEN** 已认证用户创建新技能包且 payload 携带通过校验的非空 `documentationLinks`
- **THEN** 系统 SHALL 保存规范化后的完整数组

#### Scenario: 更新技能包时缺省字段保留链接
- **WHEN** owner、superuser 或其他获准管理者更新已有技能包且 payload 未包含 `documentationLinks`
- **THEN** 系统 SHALL 更新 payload 中的其他技能包字段
- **THEN** 系统 MUST 保留该技能包当前的完整 `documentationLinks`

#### Scenario: 更新技能包时显式清空链接
- **WHEN** 获准管理者更新已有技能包且 payload 包含 `documentationLinks: []`
- **THEN** 系统 SHALL 将该技能包的相关文档更新为空数组

#### Scenario: 更新技能包时完整替换链接
- **WHEN** 获准管理者更新已有技能包且 payload 包含通过校验的非空 `documentationLinks`
- **THEN** 系统 SHALL 使用规范化后的完整新数组替换原有链接

#### Scenario: 旧技能包客户端保持兼容
- **WHEN** 不认识 `documentationLinks` 的旧前端或 API 调用方更新已有技能包
- **THEN** 系统 SHALL 继续接受原有 payload
- **THEN** 系统 MUST NOT 清空或改写已有文档链接

### Requirement: 技能包文档更新与 upsert 事务保持原子性
系统 MUST 在 `BundleService.UpsertBundle` 的同一数据库事务中更新技能包元数据、文档链接、分类和关联 Skill，不得产生部分成功状态。

#### Scenario: 技能包事务成功
- **WHEN** 技能包字段、文档链接、分类和关联 Skill 更新全部成功
- **THEN** 系统 SHALL 提交事务并返回标准发布成功响应

#### Scenario: 技能包事务失败
- **WHEN** 文档链接、分类或关联 Skill 更新中的任一步骤失败
- **THEN** 系统 SHALL 回滚本次技能包 upsert 的全部数据库修改
- **THEN** 系统 MUST 保留更新前的相关文档链接

### Requirement: 技能包写入复用统一 URL 校验
技能包发布 MUST 与 skill 发布使用同一套文档链接规范化与服务端校验：最多 10 条；去除 `title` 和 `url` 首尾空白；非空标题最多 80 个 Unicode 字符；URL 必填且最多 2048 个字符，必须是带 hostname 的绝对 `http` 或 `https` URL；不得包含 userinfo；同一数组不得包含去除首尾空白后完全相同的 URL。

#### Scenario: 接受合法技能包文档链接
- **WHEN** 技能包 payload 包含满足统一规则的飞书、GitHub、GitLab、自建平台或其他 HTTP 文档 URL
- **THEN** 系统 SHALL 接受链接并保留 query 参数与 fragment

#### Scenario: 拒绝不安全或格式错误的链接
- **WHEN** 任一技能包链接使用非 `http`/`https` scheme、相对地址、空 hostname、userinfo 或缺失 URL
- **THEN** 系统 MUST 拒绝整个请求
- **THEN** 系统 SHALL 返回 `400 Bad Request` 和错误 code `invalid_documentation_link`

#### Scenario: 拒绝数量、长度或重复链接
- **WHEN** 技能包链接超过 10 条、标题超过 80 个 Unicode 字符、URL 超过 2048 个字符或存在重复 URL
- **THEN** 系统 MUST 拒绝整个请求并返回 `invalid_documentation_link`

#### Scenario: 校验失败不产生技能包副作用
- **WHEN** 任一技能包文档链接未通过校验
- **THEN** 系统 MUST NOT 创建新技能包
- **THEN** 系统 MUST NOT 修改已有技能包、分类、关联 Skill 或原有文档链接

### Requirement: 技能包创建和编辑页支持维护相关文档
系统 SHALL 在 `/bundles/new` 的 `BundleFormPage` 基本信息卡中提供“相关文档（可选）”区域，允许创建者或管理者添加、编辑和删除最多 10 个链接，并复用 skill 上传页的动态行与即时校验规则。

#### Scenario: 创建技能包时添加文档链接
- **WHEN** 用户在技能包创建表单添加带标题或不带标题的合法链接
- **THEN** 表单 SHALL 按页面顺序提交规范化后的 `documentationLinks`
- **THEN** 完全空白的新增行 SHALL 被忽略

#### Scenario: 技能包表单阻止无效链接
- **WHEN** 任一行只有标题没有 URL，或违反数量、长度、协议、hostname、userinfo、重复 URL 规则
- **THEN** 表单 SHALL 展示明确的校验问题
- **THEN** 表单 MUST 阻止提交

#### Scenario: 编辑技能包时预填相关文档
- **WHEN** 获准管理者通过 `edit` 参数打开已有技能包，且尚未编辑文档链接区域
- **THEN** 表单 SHALL 按详情响应顺序预填 `bundle.documentationLinks`

#### Scenario: 晚到或刷新的详情响应不得覆盖输入
- **WHEN** 用户已添加、修改或删除文档链接，随后技能包详情请求或后台刷新完成
- **THEN** 表单 MUST 保留用户当前输入
- **THEN** 表单 MUST NOT 用响应数据覆盖 touched 状态下的文档链接

#### Scenario: 编辑技能包时显式清空
- **WHEN** 用户删除全部预填链接并保存技能包
- **THEN** 前端 SHALL 显式提交 `documentationLinks: []`

#### Scenario: 展示服务端校验错误
- **WHEN** 服务端返回错误 code `invalid_documentation_link`
- **THEN** 表单 SHALL 展示明确的中文发布失败提示
- **THEN** 表单 MUST NOT 把请求显示为保存成功

### Requirement: 技能包详情页安全展示相关文档
系统 SHALL 在 `BundleDetailPage` 的 `BundleHeader` 之后、缺失 Skill 警告和 `BundleInstallCard` 之前展示非空 `documentationLinks`，并复用 skill 详情的安全外链展示规则。

#### Scenario: 展示带标题和无标题的技能包文档
- **WHEN** 技能包同时包含带标题和不带标题的链接
- **THEN** 带标题链接 SHALL 使用标题作为主要可点击文本
- **THEN** 不带标题链接 SHALL 使用 URL hostname 作为可点击文本
- **THEN** 页面 SHALL 展示可识别的目标 hostname

#### Scenario: 文档卡片位于技能包安装操作之前
- **WHEN** 技能包存在相关文档
- **THEN** 文档卡片 SHALL 出现在 `BundleHeader` 之后
- **THEN** 文档卡片 SHALL 出现在缺失 Skill 警告和 `BundleInstallCard` 之前

#### Scenario: 安全打开技能包外部文档
- **WHEN** 用户点击任一技能包文档链接
- **THEN** 链接 MUST 使用 `target="_blank"` 和 `rel="noopener noreferrer"`
- **THEN** 前端 MUST NOT 将 `title` 或 `url` 作为 HTML 注入页面

#### Scenario: 无相关文档时不展示空卡片
- **WHEN** 技能包的 `documentationLinks` 为空数组或旧响应未包含该字段
- **THEN** 详情页 MUST NOT 渲染相关文档卡片或空状态占位
