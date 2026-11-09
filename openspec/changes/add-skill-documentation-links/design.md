## Context

当前 `/upload` 在本地维护发布表单状态，通过 `usePublishSkill` 将 JSON payload 和文件组装为 multipart 请求并调用 `POST /api/v1/skills`。Go 后端在 `PublishSkillHandler` 中校验 payload、上传文件并在事务内创建或更新 `skills` 与 `skill_versions`。公共详情响应把 `model.Skill` 转换为 `SkillItem`，前端再映射为 `PublicSkill` 并交给 `SkillDetailPage` 展示。

最新 `master` 还提供了技能包功能：`BundleFormPage` 通过 `usePublishBundle` 向 `POST /api/v1/bundles` 提交 JSON，`BundleService.UpsertBundle` 在一个事务内创建或更新 `skill_bundles`、分类和关联 Skill；`BundleItem` 被公共列表、详情、当前用户列表和管理接口复用，`BundleDetailPage` 依次展示 `BundleHeader`、缺失 Skill 警告、安装卡片和关联 Skill。

现有 `source` 只记录 GitHub/GitLab 导入来源并保存在版本 `parsed` 元数据中，不能表达发布者希望公开展示的介绍或使用文档。相关文档属于 skill 级元数据，应跨版本保持，并允许 owner 在发布新版本时更新。

本变更跨 `skills`、`skill_bundles`、Go API、共享 schema、两类上传/编辑表单和详情页，同时涉及外部 URL 安全与旧客户端兼容。

## Goals / Non-Goals

**Goals:**

- 用稳定、可扩展的数据结构保存一个 skill 的多个有序相关文档链接。
- 在上传和发布新版本流程中支持新增、修改、清空链接，同时兼容不认识新字段的旧客户端。
- 对所有写入入口执行一致的服务端 URL 校验，并在前端提供即时反馈。
- 在公共 skill 响应中返回链接，并在详情页的固定位置安全展示。
- 历史 skill 无需人工回填即可返回空链接集合。
- 让技能包复用同一文档链接对象结构和校验实现，同时独立保存自身链接。
- 在技能包创建和编辑流程中支持新增、修改、清空链接，并兼容不发送新字段的旧前端或 API 调用方。
- 在所有 `BundleItem` 响应中返回稳定数组，并在技能包详情页固定位置安全展示。

**Non-Goals:**

- 不抓取、代理、解析或检查外部文档内容，不为链接生成预览，因此不引入 SSRF 请求面。
- 不为飞书、GitHub、GitLab 建立独立 OAuth 或权限探测；链接目标是否需要登录由目标站点负责。
- 不在 skills 列表卡片、搜索结果、首页或管理后台展示或编辑相关文档。
- 不在技能包列表卡片或管理后台增加独立的文档链接编辑入口；技能包 owner 和 superuser 继续通过现有创建/编辑表单维护。
- 不从 `SKILL.md` frontmatter 自动提取相关文档。
- 不在本次变更中为 CLI 增加填写相关文档的命令行参数；CLI 仅保持协议兼容。

## Decisions

### 决策一：使用 skill 级有序对象数组

公开字段统一命名为 `documentationLinks`，结构如下：

```json
[
  {
    "title": "使用文档",
    "url": "https://example.feishu.cn/docx/example"
  },
  {
    "url": "https://gitlab.example.com/group/project/-/blob/main/README.md"
  }
]
```

- `url` 必填。
- `title` 可选；保存前去除首尾空白，空白标题按未提供处理。
- 数组顺序即详情页展示顺序。
- 数据保存在 `skills.documentation_links JSONB NOT NULL DEFAULT '[]'::jsonb`，并增加“值必须为 JSON array”的数据库约束。

相关文档描述的是 skill 整体，而不是某个不可变版本，因此不存入 `skill_versions.parsed`。相比单个 URL 字段，对象数组可支持多个介绍、使用和源码文档；相比新建关联表，JSONB 更符合数量少、随 skill 整体替换且不需要独立查询的元数据特征。

### 决策二：发布 payload 使用三态更新语义

`PublishPayload.documentationLinks` 在 Go 中使用可区分“缺省”和“空数组”的表示，例如 `*[]DocumentationLink`：

- 新建 skill 时字段缺省：保存 `[]`。
- 新建 skill 时字段为数组：校验并按顺序保存。
- 已有 skill 发布新版本时字段缺省：保留数据库中的现有链接，保证旧 CLI 和旧前端不会意外清空数据。
- 已有 skill 发布新版本时字段为 `[]`：显式清空。
- 已有 skill 发布新版本时字段为非空数组：用完整新数组替换。

上传页在确认 slug 属于当前 owner 后，从详情响应预填现有链接；一旦用户编辑过链接，后续 slug 检查结果不得覆盖本地内容。这样 owner 可以显式保留、修改或清空链接，而旧客户端继续采用缺省字段语义。

相比把缺省和空数组统一解释为清空，三态语义避免旧客户端发布版本时破坏新数据。相比增设独立 PATCH 接口，本方案复用现有 owner 发布事务和权限边界，满足“上传时添加”的需求。

### 决策三：前后端采用同一组可测试校验规则

服务端是最终校验边界，前端镜像相同规则以即时提示：

- 每个 skill 最多保存 10 个链接。
- 去除 `title`、`url` 首尾空白后再校验和保存。
- `title` 可选，非空时最多 80 个 Unicode 字符。
- `url` 必填且最多 2048 个字符，必须是可解析的绝对 URL。
- URL scheme 只允许 `http` 或 `https`，且必须包含非空 hostname。
- URL 不得包含用户名或密码等 userinfo。
- 同一 payload 中不允许出现去除首尾空白后完全相同的 URL。
- 查询参数与 fragment 原样保留，以兼容飞书文档、GitHub/GitLab 文件锚点等地址。

任一链接无效时，后端返回 `400 Bad Request`，错误 code 固定为 `invalid_documentation_link`，且不上传文件、不创建版本、不修改现有链接。系统不限制 hostname 白名单，从而兼容自建 GitLab、飞书/Lark 域名及后续文档平台；协议限制和渲染安全属性负责阻止可执行 scheme。

### 决策四：公共 SkillItem 返回稳定空数组

Go `SkillItem`、前端 `SkillItem`/`PublicSkill` 以及共享 schema 增加 `documentationLinks`。所有复用 `SkillItem` 的公共响应都返回该字段，历史或无链接 skill 返回 `[]` 而不是 `null` 或省略；搜索响应保持现状，因为其使用独立的轻量 `SearchResult`。

共享 schema 和 CLI 内置 schema 在滚动发布期间将该字段声明为可选、默认按空数组消费；新后端始终显式返回数组。这样旧后端与新前端、新后端与旧客户端都可以并存。

### 决策五：上传页使用可增删的链接行

`/upload` 的基础信息卡在分类控件之后增加“相关文档（可选）”区域。每行包含可选标题、必填 URL 和删除按钮，区域底部提供“添加文档链接”按钮；达到 10 条后禁用添加。

完全空白的新增行不进入 payload，也不产生错误；只填写标题而未填写 URL 的行视为不完整并阻止发布。URL 不合法、标题或 URL 超长、重复或数量超限时，错误进入现有“校验结果”区域，发布按钮保持禁用。

发布新版本时，slug owner 检查返回的详情数据用于预填链接。预填只在链接尚未被用户编辑时执行，以避免请求竞态覆盖输入。

### 决策六：详情页在主信息之后独立展示

当 `documentationLinks` 非空时，`SkillDetailPage` 在 `SkillHeader` 之后、安装方式区域之前渲染“相关文档”卡片；为空时不渲染占位或空状态。

每项可点击文本优先使用 `title`，缺失时使用 URL hostname，旁边展示目标 hostname 以帮助用户识别外部站点。链接在新窗口打开，并固定使用 `target="_blank"` 与 `rel="noopener noreferrer"`。前端不把标题或 URL 当作 HTML 注入。

独立卡片比把最多 10 个链接塞入 hero 侧栏更易阅读，也让介绍/使用文档在安装操作前可见；列表卡片不展示可以避免信息密度和额外布局变化。

### 决策七：数据库变更遵循当前纯 SQL 规范

实现阶段在 `backend/data/sql/<YYYYMMDDHHMM>/` 创建 `schema.sql`、`data.sql`、`upgrade.sql`，先备份再执行升级。`upgrade.sql` 为 `skills` 增加 JSONB 列、默认值、非空约束和 array 类型约束；不新增 `backend/internal/database/migrations` 文件。

### 决策八：技能包复用文档链接类型，但独立持久化

技能包公开字段同样命名为 `documentationLinks`，每项继续使用 `{ title?: string, url: string }`。Go 层复用现有 `DocumentationLink` 和 `DocumentationLinkList`，不创建结构相同但命名不同的 Bundle 专用链接类型；前端也复用 `DocumentationLink`、规范化工具和展示组件。

`SkillBundle` 新增 `DocumentationLinks DocumentationLinkList`，持久化到 `skill_bundles.documentation_links JSONB NOT NULL DEFAULT '[]'::jsonb`，并增加顶层必须为 JSON array 的约束。技能包的链接描述技能包整体，不从包内 Skill 聚合，也不写入 `bundle_skills`；包内 Skill 仍保留各自的链接。

`BundleItem`、`PublicBundle` 和相关前端 API 类型增加 `documentationLinks`。公共列表、公共详情、当前用户技能包列表、admin 列表和 admin 详情等复用 `BundleItem` 的响应都必须显式返回数组；历史数据返回 `[]`。前端类型在滚动发布期间允许字段缺失并按 `[]` 消费，新后端始终返回数组。

### 决策九：技能包 upsert 使用缺省、清空、替换三态语义

`PublishBundlePayload.documentationLinks` 在 Go 中使用能区分“字段缺省”和“空数组”的指针集合：

- 新建技能包时字段缺省：保存 `[]`。
- 新建技能包时字段为数组：校验并按顺序保存。
- 更新已有技能包时字段缺省：保留当前链接，避免旧前端或 API 调用方意外清空新数据。
- 更新已有技能包时字段为 `[]`：显式清空。
- 更新已有技能包时字段为非空数组：完整替换为规范化后的新数组。

技能包发布和 skill 发布必须调用同一套服务端规范化与校验实现，规则、数量限制和错误 code 均保持一致。当前位于 skill handler 的校验逻辑在实现阶段抽取为两个发布路径可复用的 helper，skill 既有行为不得改变。技能包校验失败返回 `400 Bad Request` 和 `invalid_documentation_link`，并且不得创建或更新技能包、分类及关联 Skill。

链接更新必须与 `BundleService.UpsertBundle` 中名称、描述、分类和关联 Skill 的更新位于同一数据库事务。任一步骤失败时全部回滚，已有链接保持不变；技能包发布不涉及文件上传，因此无需执行对象存储清理。

### 决策十：技能包创建/编辑表单复用链接编辑体验

`/bundles/new` 使用同一个 `BundleFormPage` 处理创建和编辑。表单在基本信息卡的分类控件之后、关联 Skill 选择区域之前增加“相关文档（可选）”编辑区，交互、10 条上限、标题与 URL 输入、完全空行忽略及即时校验与 skill 上传页保持一致。

创建时没有有效链接可省略字段或提交 `[]`。编辑时从 `GET /api/v1/bundles/{slug}` 的 `bundle.documentationLinks` 按顺序预填；用户删除全部预填项后必须显式提交 `documentationLinks: []`。表单维护文档链接 touched 状态，初次加载或后台刷新响应不得覆盖用户已编辑内容。

为避免两套规则漂移，动态行状态和规范化逻辑应从现有 `documentationLinks` 工具复用；表单只负责技能包查询、预填和 payload 组装。服务端返回 `invalid_documentation_link` 时显示明确中文错误，不把失败请求显示为成功。

### 决策十一：技能包详情在 Header 后展示通用文档卡片

当技能包的 `documentationLinks` 非空时，`BundleDetailPage` 在 `BundleHeader` 之后、缺失 Skill 警告和 `BundleInstallCard` 之前渲染相关文档卡片；为空时不渲染占位。这样文档位置与 skill 详情“主信息之后、安装之前”的原则一致，同时不会被误解为某个包内 Skill 的资料。

详情展示顺序、标题优先与 hostname 回退、目标 hostname 提示、`target="_blank"`、`rel="noopener noreferrer"` 和禁止 HTML 注入等规则与 skill 详情完全一致。实现可将现有 `SkillDocumentationLinks` 重命名或提取为领域无关组件，但必须保留 skill 详情既有行为和测试。

### 决策十二：技能包字段使用独立的纯 SQL 变更目录

已完成的 skill 数据库变更目录保持不变。技能包字段在新的 `backend/data/sql/<YYYYMMDDHHMM>/` 目录中分别生成 `schema.sql`、`data.sql` 和带执行时间的 `upgrade.sql`，备份范围至少覆盖 `public.skill_bundles`。升级脚本添加 JSONB 列、历史默认 `[]`、`NOT NULL`、默认值和 array 类型约束，不新增或修改 `backend/internal/database/migrations`。

## Risks / Trade-offs

- [Risk] 发布者提交钓鱼或恶意外链 → 仅允许 `http`/`https` 绝对 URL，禁止 userinfo，详情页显示 hostname 并使用安全外链属性；平台不替链接内容背书。
- [Risk] 旧客户端发布新版本时清空新字段 → 服务端用缺省/空数组三态语义，缺省时保留现值。
- [Risk] slug 检查响应较晚覆盖用户正在编辑的链接 → 上传页维护 links touched 状态，只在未编辑时预填。
- [Risk] JSONB 内部结构绕过应用校验后出现脏数据 → 所有正常写入统一走校验函数，数据库约束保证顶层为数组；读取层对无法解码的数据返回错误并记录，而不输出不可信结构。
- [Risk] `SkillItem` 增加字段扩大列表响应 → 每个 skill 最多 10 个轻量对象，不增加查询或关联表加载；当前规模可接受，后续如响应体成为瓶颈可拆分详情 DTO。
- [Risk] 允许 `http` 可能导向明文站点 → 为兼容内网及自建文档系统保留 `http`；页面明确显示 hostname，且不会由服务端请求该地址。
- [Risk] 复用 helper 时改变已上线的 skill 校验或错误语义 → 保留现有 skill 单元/集成测试，并新增跨 skill/技能包的一致性测试。
- [Risk] 旧技能包编辑客户端清空新字段 → `PublishBundlePayload` 使用三态字段，更新时缺省保留，只有显式空数组才清空。
- [Risk] 同名字段让调用方误以为技能包链接来自包内 Skill → `BundleItem.documentationLinks` 只读取 `skill_bundles` 自身字段，详情页在技能包 Header 后独立展示。

## Migration Plan

1. 按仓库规范创建数据库备份与升级目录，给历史记录回填默认 `[]` 后设置 `NOT NULL` 和 JSON array 约束。
2. 先部署兼容新列但仍接受缺省 payload 的后端，并验证新旧发布请求、详情和列表响应。
3. 为 `skill_bundles` 使用新的纯 SQL 目录备份并添加同结构字段，验证历史技能包返回空数组。
4. 更新共享 schema、CLI 内置 schema、skill 与技能包前端类型，再部署两类上传/编辑表单与详情展示。
5. 验证历史 skill 和技能包均返回 `documentationLinks: []`；新对象可新增，owner 更新时可保留、替换和清空链接。
6. 回滚时先下线前端入口，再回滚后端代码；两个数据库列均可保留为无害的向后兼容数据。若必须删除列，应先导出其数据后单独执行回滚 SQL。

## Open Questions

无。当前默认采用：skill 与技能包均最多 10 条、标题可选、允许 `http`/`https`；两者复用对象结构和校验实现但分别使用 JSONB 字段；更新时缺省保留且空数组清空。
