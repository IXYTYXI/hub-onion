## 1. 数据库与 Go 模型

- [x] 1.1 在 `backend/data/sql/<YYYYMMDDHHMM>/` 按规范先生成 `schema.sql`、`data.sql`，再编写带执行时间的 `upgrade.sql`
- [x] 1.2 在升级 SQL 中为 `skills` 增加 `documentation_links JSONB NOT NULL DEFAULT '[]'::jsonb`、历史数据默认值和 JSON array 约束，且不新增 `backend/internal/database/migrations`
- [x] 1.3 在 Go model 中新增 `DocumentationLink` 集合类型及 JSONB `Value`/`Scan` 支持，并扩展 `Skill`、`SkillItem`
- [x] 1.4 将 `PublishPayload.documentationLinks` 建模为可区分缺省、空数组和非空数组的三态字段

## 2. 后端校验与发布事务

- [x] 2.1 实现共享的相关文档规范化与校验函数，覆盖 10 条上限、标题 80 字符、URL 2048 字符、绝对 `http`/`https`、hostname、userinfo 和重复 URL
- [x] 2.2 在处理文件上传前校验 `documentationLinks`，失败时返回 `400` 与 code `invalid_documentation_link`，且不产生文件或数据库副作用
- [x] 2.3 在新 skill 发布事务中保存规范化链接，并在字段缺省时保存空数组
- [x] 2.4 在已有 skill 新版本事务中实现缺省保留、空数组清空、非空数组完整替换，并保证失败回滚
- [x] 2.5 扩展 `skillToItem` 及所有复用 `SkillItem` 的响应路径，始终返回有序 `documentationLinks`，无数据时返回空数组

## 3. 共享 schema 与前端数据类型

- [x] 3.1 扩展 `src/types/api.ts`、`PublicSkill` 和 `mapSkillItemToPublicSkill`，增加 `DocumentationLink` 与 `documentationLinks`
- [x] 3.2 扩展 `packages/schema` 的发布请求、skill 列表和详情响应 schema，并在滚动发布期间兼容字段缺失
- [x] 3.3 同步 `packages/clawhub` 内置 schema 或通过仓库既有生成流程更新产物，确保旧 CLI 不传字段仍可发布
- [x] 3.4 扩展 `usePublishSkill` payload 类型，支持按需提交 `documentationLinks`

## 4. 上传页交互

- [x] 4.1 在 `/upload` 分类控件后增加“相关文档（可选）”动态表单，支持标题、URL、添加和删除，最多 10 行
- [x] 4.2 实现前端规范化与校验：忽略全空行、拒绝只有标题的行，并把 URL、标题、重复和数量错误接入现有校验结果
- [x] 4.3 构造发布 payload 时去除首尾空白、保留页面顺序，并对 owner 显式清空提交 `documentationLinks: []`
- [x] 4.4 扩展 slug owner 检查，未编辑时从详情响应预填链接；增加 touched 防护，避免晚到响应覆盖用户输入
- [x] 4.5 将 `invalid_documentation_link` 服务端错误映射为明确的中文发布失败提示

## 5. 详情页展示

- [x] 5.1 新增相关文档展示组件，并在 `SkillHeader` 之后、安装方式区域之前按保存顺序渲染
- [x] 5.2 带标题链接使用标题作为主文本，无标题链接回退 hostname，并同时提供可识别的目标 hostname
- [x] 5.3 为所有外链设置 `target="_blank"` 和 `rel="noopener noreferrer"`，无链接时不渲染卡片
- [x] 5.4 补充上传与详情相关中文文案和必要样式，验证窄屏及长 URL 不破坏布局

## 6. 测试与验证

- [x] 6.1 补充 Go 单元/集成测试：合法平台与自建 URL、query/fragment、非法 scheme、相对地址、userinfo、长度、数量和重复校验
- [x] 6.2 补充发布集成测试：新建缺省/非空、已有缺省保留、空数组清空、非空替换、校验失败无副作用和事务回滚
- [x] 6.3 补充 API 响应测试：详情、列表及其他 `SkillItem` 路径返回一致数组，历史 skill 返回 `[]`
- [x] 6.4 补充前端上传测试：动态行增删、空行忽略、校验禁用、payload 顺序、已有链接预填、touched 防覆盖和显式清空
- [x] 6.5 补充详情页测试：卡片位置、标题/hostname 回退、安全外链属性和空数组不渲染
- [x] 6.6 运行 `openspec validate add-skill-documentation-links --strict`、相关 Go 测试、前端 Vitest、schema/CLI 测试和 lint

## 7. 技能包数据库与数据模型

- [x] 7.1 在新的 `backend/data/sql/<YYYYMMDDHHMM>/` 目录先生成覆盖 `public.skill_bundles` 的 `schema.sql`、`data.sql`，再编写带执行时间的 `upgrade.sql`
- [x] 7.2 在升级 SQL 中为 `skill_bundles` 增加 `documentation_links JSONB NOT NULL DEFAULT '[]'::jsonb`、历史默认值和 JSON array 约束，且不新增或修改旧 migrations
- [x] 7.3 在 `SkillBundle` 和 `BundleItem` 中复用 `DocumentationLinkList`，确保转换后无数据时返回非 nil 空数组
- [x] 7.4 将 `PublishBundlePayload.documentationLinks` 建模为可区分缺省、空数组和非空数组的三态字段
- [x] 7.5 扩展公共列表/详情、my bundles、admin 列表/详情等所有 `BundleItem` 响应路径，始终返回有序 `documentationLinks`

## 8. 技能包后端校验与 upsert 事务

- [x] 8.1 将现有 skill 文档链接规范化与校验抽取为 skill 和技能包发布都可复用的实现，保持 skill 既有行为与错误文本兼容
- [x] 8.2 在技能包事务前校验 `documentationLinks`，失败时返回 `400` 与 code `invalid_documentation_link`，且不产生技能包、分类或关联 Skill 副作用
- [x] 8.3 在新技能包事务中保存规范化链接，并在字段缺省时保存空数组
- [x] 8.4 在已有技能包事务中实现缺省保留、空数组清空、非空数组完整替换，并与名称、描述、分类和关联 Skill 更新保持原子性
- [x] 8.5 验证事务任一步骤失败时回滚技能包字段及文档链接，保留更新前数据

## 9. 技能包前端类型与通用组件

- [x] 9.1 扩展 `BundleItem`、`PublishBundlePayload`、`PublicBundle` 和数据映射，复用 `DocumentationLink` 并将旧响应缺省字段按 `[]` 消费
- [x] 9.2 扩展 `usePublishBundle` payload 支持按三态语义提交 `documentationLinks`
- [x] 9.3 从现有 skill 上传页复用或提取文档链接动态行、规范化和校验逻辑，避免两套规则漂移
- [x] 9.4 将现有文档链接展示组件调整为 skill 与技能包详情可复用，同时保持 skill 详情 DOM 位置和行为不变
- [x] 9.5 补充技能包文档链接中文文案，并将 `invalid_documentation_link` 映射为明确错误提示

## 10. 技能包创建与编辑表单

- [x] 10.1 在 `BundleFormPage` 基本信息卡的分类控件之后、关联 Skill 选择区域之前增加“相关文档（可选）”动态表单
- [x] 10.2 支持标题、URL、添加、删除和最多 10 行，并把统一校验问题接入技能包表单现有校验区域
- [x] 10.3 创建技能包时忽略完全空白行，按页面顺序提交规范化后的链接
- [x] 10.4 编辑技能包时从详情响应预填链接，并增加 touched 防护，避免初次 effect 或后台刷新覆盖用户输入
- [x] 10.5 用户删除全部预填链接时显式提交 `documentationLinks: []`；未编辑且调用方缺省字段时由后端保留原值

## 11. 技能包详情页展示

- [x] 11.1 在 `BundleHeader` 之后、缺失 Skill 警告和 `BundleInstallCard` 之前渲染通用相关文档组件
- [x] 11.2 按保存顺序展示链接，带标题时使用标题，无标题时回退 hostname，并展示可识别的目标 hostname
- [x] 11.3 为所有技能包外链设置 `target="_blank"` 和 `rel="noopener noreferrer"`，不得把标题或 URL 作为 HTML 注入
- [x] 11.4 无链接或旧响应缺省字段时不渲染卡片，并验证窄屏及长 URL 不破坏布局

## 12. 技能包测试与最终验证

- [x] 12.1 补充 Go 模型与迁移测试：JSONB Value/Scan 复用、历史默认 `[]`、array 约束和 `BundleItem` 空数组序列化
- [x] 12.2 补充技能包发布集成测试：新建缺省/非空、已有缺省保留、空数组清空、非空替换及旧客户端回归
- [x] 12.3 补充技能包校验测试：合法 URL、query/fragment、非法 scheme、相对地址、userinfo、长度、数量、重复和失败无副作用
- [x] 12.4 补充技能包事务与响应测试：分类或关联 Skill 更新失败时回滚，并覆盖公共、my、admin 响应的原数组和空数组
- [x] 12.5 补充 `BundleFormPage` 测试：动态行增删、空行忽略、校验阻止、payload 顺序、编辑预填、touched 防覆盖和显式清空
- [x] 12.6 补充 `BundleDetailPage` 测试：卡片位置、标题/hostname 回退、安全属性、HTML 文本渲染和空数组不展示
- [x] 12.7 运行 OpenSpec strict、后端全量 Go 测试、文档链接相关前端/schema/CLI 测试、技能包目标测试、生产构建和变更文件 lint
