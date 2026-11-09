## Why

当前 skill 发布流程只能提交名称、版本、标签、分类和文件，技能包创建/编辑流程也只能维护名称、描述、分类和关联 Skill。发布者无法为 skill 或技能包补充飞书文档、GitHub、GitLab 等站外介绍或使用文档，使用者只能从 `SKILL.md` 或技能包描述中自行查找补充信息。

为 skill 和技能包增加结构化的相关文档链接，可以让发布者在上传或编辑时维护外部资料，并让使用者在各自详情页直接访问可信协议的文档入口。

## What Changes

- 为 skill 新增有序的 `documentationLinks` 字段，每项包含必填 `url` 和可选 `title`，支持保存多个相关文档链接。
- 在 `POST /api/v1/skills` 发布 payload 中接受可选 `documentationLinks`，定义新建、更新、保留和清空语义，并保持旧前端与 CLI 不传该字段时的兼容性。
- 在后端统一校验链接数量、标题长度、URL 长度、绝对地址、协议和主机；仅允许 `http`、`https`，拒绝用户凭据和重复链接。
- 在 `/upload` 增加“相关文档（可选）”动态输入区，支持添加、删除和校验多个链接；发布已有 skill 新版本时预填当前链接，且不得覆盖用户已编辑内容。
- 在公共 skill 响应中返回 `documentationLinks`，历史 skill 返回空数组。
- 在 skill 详情页主信息与安装区域之间展示“相关文档”卡片；无链接时不展示，外链使用安全的新窗口打开方式。
- 为技能包复用相同的 `{ title?: string, url: string }` 文档链接结构和校验规则，但在 `skill_bundles` 上独立持久化，避免与包内各 Skill 的文档链接混用。
- 在 `POST /api/v1/bundles` payload 中接受可选 `documentationLinks`，对新建和更新定义缺省、清空、替换三态语义，并在所有 `BundleItem` 响应中稳定返回数组。
- 在技能包创建/编辑页增加可增删、可预填的相关文档输入区，在技能包详情页 `BundleHeader` 之后、缺失 Skill 警告和安装区域之前安全展示链接。

## Capabilities

### New Capabilities

- `skill-documentation-links`: 定义 skill 相关文档的数据结构、持久化与更新语义、URL 安全校验以及详情页展示行为。
- `skill-bundle-documentation-links`: 定义技能包相关文档的数据复用方式、独立持久化、上传三态语义、统一 URL 校验、API 响应和详情页展示行为。

### Modified Capabilities

- `skill-publishing`: 发布 payload 新增可选 `documentationLinks`，并定义服务端校验和兼容行为。
- `skill-crud-operations`: 公共 skill 响应新增 `documentationLinks` 字段。
- `upload-page-authoring`: 上传页支持添加、删除、预填和校验相关文档链接。

## Impact

- 数据库：`skills` 和 `skill_bundles` 分别新增 `documentation_links JSONB NOT NULL DEFAULT '[]'::jsonb`；技能包字段使用新的时间戳目录，按仓库规范生成备份与升级 SQL，不新增旧 migrations。
- Go 后端：复用 `DocumentationLink`/`DocumentationLinkList`，扩展 skill 与技能包模型、响应 DTO、发布 payload 和事务，并让两个写入入口使用同一套规范化和校验。
- 前端：扩展 skill 与技能包 API 类型、发布 hook、`/upload`、技能包创建/编辑表单、详情数据映射、通用展示组件及中文文案。
- Schema/CLI：扩展共享及 CLI 内置响应 schema；发布请求字段保持可选，旧客户端无需修改即可继续发布。
- 测试：分别覆盖 skill 与技能包的数据库默认值、发布更新语义、URL 校验、API 响应、上传/编辑表单和详情页外链安全属性。
