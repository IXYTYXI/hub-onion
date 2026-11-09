# 上传页自动解析 SKILL.md 与文件删除交互技术方案

## 1. 文档目的

本文档基于 [需求文档](./requirements.md) 和当前仓库代码现状，给出“上传页自动解析 `SKILL.md` frontmatter `name`、文件列表逐行删除，以及发布冲突引导”的技术实现方案。

本文档重点回答四个问题：

1. 当前上传页的数据流和状态模型是什么。
2. 自动解析 `SKILL.md` 应该落在哪一层，为什么不应继续复用 `convex/` 目录代码。
3. 文件删除交互如何接入现有本地文件状态与校验逻辑。
4. 在不改动后端协议的前提下，如何补齐 `slug` 存在性检查、同用户发布新版本和版本冲突提示。

## 2. 现状调研结论

### 2.1 上传页当前已经是纯前端本地文件状态驱动

上传页实现位于 [`src/routes/upload.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/upload.tsx)。

当前页面已经具备一套完整的本地上传状态模型：

- `files`: 当前待发布文件列表
- `ignoredMacJunkPaths`: 已忽略的 macOS 垃圾文件列表
- `slug` / `displayName` / `version` / `tags` / `changelog`: 表单字段
- `validation`: 基于本地状态实时计算的校验结果

当前页面的关键特点是：

- 文件展开、校验和列表展示都发生在前端
- 后端只接收最终 `payload + files`
- 页面没有依赖服务端进行“上传前预解析”

这意味着本次需求天然适合继续在前端本地完成。

### 2.2 文件展开能力已经足够支撑自动解析

文件展开逻辑位于 [`src/lib/uploadFiles.ts`](/Users/logo/self_repo/claw_case/clawhub/src/lib/uploadFiles.ts)。

当前已经支持：

- 普通文件
- 文件夹拖拽
- zip 展开
- tar.gz / tgz 展开
- gz 单文件解压
- 自动过滤 macOS 垃圾文件
- 自动剥离单层顶级包装目录

展开后的结果统一归一到 `File[]`，其中路径已经被规范化。这意味着：

- 自动解析只需面向展开后的 `File[]`
- 不需要再区分“用户是传文件夹还是传压缩包”

### 2.3 当前页面已经有读取文本内容的基础工具

上传页工具位于 [`src/routes/upload/-utils.ts`](/Users/logo/self_repo/claw_case/clawhub/src/routes/upload/-utils.ts)。

其中已经存在：

- `readText(blob)`
- `isTextFile(file)`
- `formatBytes`
- `formatPublishError`

因此，自动解析 `SKILL.md` 并不需要新增底层文件读取能力，只需要补 frontmatter 解析逻辑。

### 2.4 当前文件列表只有展示，没有编辑

当前上传页文件列表渲染仍然是只读：

- 只展示 `normalizedPaths`
- 每行只有文件路径
- 没有删除按钮

但样式文件 [`src/styles.css`](/Users/logo/self_repo/claw_case/clawhub/src/styles.css) 中已经存在 `.upload-remove` 样式，说明文件删除交互具备很低的接入成本。

### 2.5 旧 Convex 目录里有 frontmatter 解析逻辑，但不应直接复用

旧逻辑位于 [`convex/lib/skills.ts`](/Users/logo/self_repo/claw_case/clawhub/convex/lib/skills.ts)，其中已有：

- `parseFrontmatter`
- `getFrontmatterValue`

它本身是纯函数，理论上可复用，但本次不建议让前端继续从 `convex/` 引用，原因如下：

- 项目已经完成去 Convex 化，继续从 `convex/` 引用会污染新边界
- `convex/` 目录语义上属于历史后端代码，不应再成为前端共享层
- 后续若旧文件被继续修改并加入 Convex 相关依赖，前端构建会承担额外风险

结论是：

- 逻辑可以“迁移”或“轻量重写”
- 不能继续把 `convex/` 当共享模块使用

### 2.6 当前后端会把可恢复冲突退化成 500

当前 Go 后端 publish handler 位于 [`backend/internal/handler/publish.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/publish.go)。

从现状看：

- `slug` 属于其他用户时，会返回 `permission denied: skill owned by another user`
- 版本已存在时，会返回 `version already exists`
- 但这两类业务冲突最终都会走统一的 `500 Internal Server Error`

这意味着当前前端即使想给出更精确的引导，也只能拿到模糊的服务端失败结果，导致用户看到的仍是“发布失败”而不是“请更换 slug”或“请升级版本号”。

### 2.7 前端已具备复用现有详情与版本查询的基础

当前前端已经存在：

- [`src/hooks/useSkill.ts`](/Users/logo/self_repo/claw_case/clawhub/src/hooks/useSkill.ts) 用于按 `slug` 获取 skill 详情
- [`src/hooks/useSkillVersions.ts`](/Users/logo/self_repo/claw_case/clawhub/src/hooks/useSkillVersions.ts) 用于按 `slug` 获取版本列表

这说明上传页在不新增协议的前提下，理论上已经能复用现有接口完成：

- `slug` 是否存在
- 当前 skill 是否属于登录用户
- 最新版本是多少

因此本次“发布冲突引导”在技术上适合采用：

- 提交前预检查
- 提交后错误翻译兜底

## 3. 可行性评估

结论：可行性高，但若要把体验做扎实，最终仍建议后端补充稳定的业务冲突语义。

原因如下：

1. 上传页已经掌握全部待发布文件，自动解析没有额外数据依赖。
2. 文件展开后统一为 `File[]`，无论来源是文件夹还是压缩包，都能走同一套逻辑。
3. 自动解析只影响默认表单值，不改变最终发布协议。
4. 删除交互本质是本地状态编辑，现有校验逻辑已经能在 `files` 变化后自动重算。
5. `slug` 检查与版本提示可优先复用现有详情 / 版本查询接口，无需立即新增后端预检查接口。

## 4. 设计目标

本次技术方案采用以下原则：

- 保持后端协议不变
- 保持上传页现有状态驱动模式不变
- 将纯解析逻辑放到新的前端公共位置
- 自动填充只做默认值补全，不覆盖用户明确输入
- 删除交互直接操作当前 `files` 状态，不引入额外中间层
- 将“新建 skill / 发布新版本 / slug 被占用 / 版本已存在”转成清晰页面语义
- 优先通过现有查询接口做提交前引导，再通过发布错误映射做提交后兜底

## 5. 方案概述

### 5.1 总体实现方向

本次建议拆成三个独立但串联的能力：

1. 新增一个前端纯工具模块，负责：
   - 识别 `SKILL.md`
   - 解析 frontmatter
   - 读取 `name`
   - 根据 `name` 生成推荐 slug / displayName

2. 在上传页中扩展状态管理，负责：
   - 在文件展开完成后调用自动解析
   - 记录哪些字段已被用户手工修改
   - 为文件列表增加逐行删除
   - 在删除后重算整个页面状态

3. 在上传页中补充发布意图识别能力，负责：
   - 在用户输入 `slug` 后检查该 `slug` 是否存在
   - 判断当前用户是“新建”还是“发布新版本”
   - 在版本区域显示当前最新版本
   - 对已知业务冲突做字段级提示和提交后兜底翻译

### 5.2 后端不参与本次设计

本次不修改：

- [`src/hooks/usePublishSkill.ts`](/Users/logo/self_repo/claw_case/clawhub/src/hooks/usePublishSkill.ts)
- 发布接口请求体结构
- Go 后端 publish handler

原因很明确：

- 这两个能力都是“上传前的本地交互增强”
- 服务端不需要知道字段是用户手填还是自动填充
- 删除文件后，最终提交的仍只是筛选后的 `files`

但从最终体验看，建议将后端冲突语义作为后续增强项：

- `slug` 被他人占用
- 当前用户重复发布相同版本
- 其他真实服务端异常

否则前端只能依赖错误文本做兜底映射，稳定性有限。

## 6. 前端模块设计

### 6.1 新增 frontmatter 解析工具

建议新增文件：

- [`src/lib/skillFrontmatter.ts`](/Users/logo/self_repo/claw_case/clawhub/src/lib/skillFrontmatter.ts)

职责建议控制在最小范围，只覆盖上传页当前真正需要的能力。

推荐导出函数：

```ts
export function parseFrontmatter(content: string): Record<string, unknown>
export function getFrontmatterString(frontmatter: Record<string, unknown>, key: string): string | undefined
export function deriveSlugFromName(name: string): string
export function deriveDisplayNameFromName(name: string): string
export function findPrimarySkillFile(files: File[], normalizedPaths: string[]): File | null
```

实现建议：

- 使用项目现有 `yaml` 依赖解析 frontmatter
- 只解析 markdown 顶部 `--- ... ---`
- 失败时返回空对象
- `deriveSlugFromName` 直接遵循当前上传页的 slug 格式约束

### 6.2 不建议把上传页逻辑继续堆进 `upload/-utils.ts`

[`src/routes/upload/-utils.ts`](/Users/logo/self_repo/claw_case/clawhub/src/routes/upload/-utils.ts) 当前已经是上传页专用工具集合，但它的职责更偏：

- 文件读取
- hash
- 文案格式化
- 文本文件判断

frontmatter 解析是可复用领域逻辑，更适合放在 `src/lib/`。

这样做的好处：

- 上传页更薄
- 后续 `/import` 或其他页面若要解析 `SKILL.md`，可直接复用
- 不重新耦合回旧 `convex/` 目录

## 7. 上传页状态模型设计

### 7.1 现有状态保留

以下状态继续保留：

- `files`
- `ignoredMacJunkPaths`
- `slug`
- `displayName`
- `version`
- `tags`
- `changelog`
- `status`
- `error`

### 7.2 新增“用户手工输入标记”

为了满足“自动填充不能覆盖用户输入”，建议新增两类状态：

```ts
const [slugTouched, setSlugTouched] = useState(false)
const [displayNameTouched, setDisplayNameTouched] = useState(false)
```

或等价的 `useRef` 标记。

行为要求：

- 用户在输入框中手动改过，即标记为 `true`
- 自动填充时仅在对应标记为 `false` 且字段为空时才生效

### 7.3 自动解析结果不单独持久化为复杂对象

本次不建议新增复杂的 `parsedSkillMeta` 状态对象。

原因：

- 页面真正需要的只有 `name`
- 自动解析只是字段默认值来源，不是独立业务实体
- 单独维护一份完整解析对象会增加状态同步复杂度

更推荐的方式是：

- 文件变化后立即尝试解析
- 直接在解析结果可用时按规则写入 `slug` / `displayName`
- 可选记录一个轻量提示状态，例如 `autofillSource`

### 7.4 新增发布意图状态

为了支持“新建 / 发布新版本 / 被占用”的页面切换，建议新增一个轻量状态模型，例如：

```ts
type UploadSlugStatus =
  | { kind: 'idle' }
  | { kind: 'available' }
  | { kind: 'owned'; latestVersion?: string | null }
  | { kind: 'taken' }
  | { kind: 'error' }
```

用途如下：

- `available`: 提示可新建
- `owned`: 页面进入“发布新版本”语义，并显示最新版本
- `taken`: 阻止发布并提示更换 slug
- `error`: 不阻断输入，但不显示误导性状态

## 8. 自动解析流程设计

### 8.1 触发链路

建议在 `applyExpandedFiles(selected)` 中完成完整流程：

1. 调用 `expandFilesWithReport(selected)`
2. 得到 `report.files`
3. `setFiles(report.files)`
4. `setIgnoredMacJunkPaths(report.ignoredMacJunkPaths)`
5. 基于 `report.files` 计算规范化路径
6. 查找主 `SKILL.md`
7. 读取内容并尝试解析 `name`
8. 按规则补全 `slug` / `displayName`

这样可以保证：

- 所有入口共用同一条链路
- 拖拽、目录上传、压缩包上传行为一致

### 8.2 主 `SKILL.md` 识别

当前上传页已有 `normalizedPaths` 计算逻辑，可用于判断 `SKILL.md` 是否存在。

本次建议补一层工具函数，根据“规范化路径 + 原始 `files` 下标”找到主文件：

- 候选名：`skill.md`、`skills.md`
- 路径大小写不敏感
- 候选多个时，取排序后第一个或当前列表中第一个稳定匹配项

这样能避免在页面组件里手写重复查找逻辑。

### 8.3 自动填充策略

建议流程如下：

```ts
if (parsedName) {
  if (!slugTouched && !slug.trim()) setSlug(deriveSlugFromName(parsedName))
  if (!displayNameTouched && !displayName.trim()) setDisplayName(deriveDisplayNameFromName(parsedName))
}
```

该策略满足：

- 首次上传可自动补全
- 用户手改后不会被后续文件变化覆盖
- 解析失败不会打断页面主流程

### 8.4 解析错误处理

frontmatter 解析错误属于“可降级异常”，处理策略应为：

- 不抛全局错误
- 不影响文件列表展示
- 不影响现有校验
- 不影响继续手工输入

如需提示，建议只做静默失败，不必新增显眼错误区域。

## 9. 发布冲突引导设计

### 9.1 提交前检查策略

建议在用户输入 `slug` 后进行轻量检查，而不是等到点击发布才判断。

推荐优先复用现有接口：

1. 用 `GET /api/v1/skills/:slug` 判断该 `slug` 是否存在
2. 若存在且 owner 属于当前登录用户，再用 `GET /api/v1/skills/:slug/versions` 获取最新版本信息

这样可以在不改协议的前提下完成首轮交互优化。

### 9.2 页面语义切换

根据 `slug` 检查结果，上传页应切换为不同语义：

- `available`
  - 提示：`该标识可用于新建 skill`
- `owned`
  - 提示：`你已发布过该 skill，本次将作为新版本发布`
  - 在版本区域提示当前最新版本
  - 发布按钮文案可切换为 `发布新版本`
- `taken`
  - 提示：`该标识已被占用，请更换 slug`
  - 发布按钮禁用

### 9.3 提交后兜底映射

即使存在提交前检查，最终仍以后端返回为准。

前端应增加错误翻译层，优先识别：

- `permission denied: skill owned by another user`
  - 翻译为：`该 slug 已被占用，请更换标识后再发布`
- `version already exists`
  - 翻译为：`你已经发布过该版本，请升级版本号后再发布`

只有无法识别的异常，才继续展示通用失败提示。

### 9.4 后续推荐的后端收口方向

当前前端可以先做文本级兜底，但更稳妥的后续方向应是服务端返回稳定错误码，例如：

- `409 slug_conflict`
- `409 version_exists`
- `403 not_owner`
- `500 internal_error`

这样前端无需依赖错误文本匹配，交互也更可维护。

## 10. 文件删除设计

### 10.1 删除入口

在上传页文件列表每一行中加入一个按钮：

- 左侧展示文件路径
- 右侧展示“删除”按钮

该按钮直接操作当前本地状态，不触发后端请求。

### 10.2 删除实现方式

删除逻辑建议直接基于当前文件数组下标或规范化路径进行过滤：

```ts
setFiles((current) => current.filter((_, index) => index !== targetIndex))
```

若基于路径删除，则需注意同名路径可能重复。

因此更稳妥的做法是：

- 渲染时使用 `normalizedPaths.map((path, index) => ...)`
- 删除时按 index 过滤 `files`

这样能够保证删除行为与当前显示行一一对应。

### 10.3 删除后的重算机制

当前 `validation`、`totalBytes`、`normalizedPaths`、`hasRequiredFile` 都是 `useMemo` 基于 `files` 推导。

因此只要 `setFiles` 更新成功，页面本身就会自动完成：

- 文件数刷新
- 体积刷新
- 校验刷新
- 发布按钮刷新

这说明删除能力不需要额外新增“重算函数”，现有派生状态模型已经足够。

### 10.4 删除 `SKILL.md` 后的行为

删除 `SKILL.md` 后，不建议自动清空已有表单值。

原因：

- `slug` / `displayName` 可能已经被用户修改确认
- 自动清空会造成“我只是删文件，为什么输入也没了”的体验割裂

因此推荐：

- 保留字段值
- 仅通过 `validation` 提示缺失必需文件
- 保持提交按钮禁用

## 11. UI 与交互设计约束

### 10.1 最小 UI 改动

本次不建议重构上传页整体布局，只在现有文件列表区域中增加：

- 删除按钮
- 可选的自动填充提示
- 可选的 `slug` / `version` 状态提示

这样风险最低，也最容易与现有样式体系兼容。

### 10.2 样式复用

优先复用现有样式：

- 文件列表容器继续使用 `.upload-file-list`
- 行继续使用 `.upload-file-row`
- 删除按钮优先复用 `.upload-remove`

若需要，仅做少量补充样式，而不改整个上传页视觉结构。

## 12. 测试设计

### 11.1 推荐测试范围

主要测试仍放在 [`src/__tests__/upload.route.test.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/__tests__/upload.route.test.tsx)。

原因：

- 当前上传页核心交互已经在该文件中覆盖
- 新需求本质上仍是路由级交互扩展

### 11.2 建议新增测试用例

建议增加以下测试：

1. 上传包含 frontmatter `name` 的 `SKILL.md` 后，自动补全 `slug`
2. 上传包含 frontmatter `name` 的 `SKILL.md` 后，自动补全 `displayName`
3. 用户手动编辑过 `slug` 后，重新上传新文件不会覆盖
4. 用户手动编辑过 `displayName` 后，重新上传新文件不会覆盖
5. 删除非文本文件后，错误提示立即消失
6. 删除 `SKILL.md` 后，页面立即提示缺少必需文件且禁止发布
7. 删除最后一个文件后，页面回到空状态
8. 输入未占用 slug 后，页面显示“可新建”
9. 输入属于当前用户的 slug 后，页面显示“发布新版本”提示与最新版本
10. 输入被占用 slug 后，页面禁用发布按钮
11. 提交时遇到 `version already exists` 时，页面显示升级版本号提示

### 11.3 工具级测试

若 `src/lib/skillFrontmatter.ts` 逻辑稍多，建议补一个独立测试文件，例如：

- `src/lib/skillFrontmatter.test.ts`

重点覆盖：

- 正常 frontmatter 解析
- 无 frontmatter
- frontmatter 非法 YAML
- `name` 缺失
- slug 派生规则

## 13. 影响范围

预期主要影响以下文件：

- [`src/routes/upload.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/upload.tsx)
- 新增 [`src/lib/skillFrontmatter.ts`](/Users/logo/self_repo/claw_case/clawhub/src/lib/skillFrontmatter.ts)
- 可能新增上传页专用的 `slug` 检查 hook 或状态工具
- 可能少量调整 [`src/routes/upload/-utils.ts`](/Users/logo/self_repo/claw_case/clawhub/src/routes/upload/-utils.ts)
- 可能少量调整 [`src/copy/upload.ts`](/Users/logo/self_repo/claw_case/clawhub/src/copy/upload.ts)
- 可能少量调整 [`src/styles.css`](/Users/logo/self_repo/claw_case/clawhub/src/styles.css)
- [`src/__tests__/upload.route.test.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/__tests__/upload.route.test.tsx)

本次原则上不影响：

- 现有发布请求体结构
- API schema
- 详情页、列表页、管理页等其他页面

但若要从根上修复冲突语义，后续会影响：

- [`backend/internal/handler/publish.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/publish.go)

## 14. 风险与规避

### 13.1 重新耦合旧 Convex 代码

风险：

- 前端继续从 `convex/` 引用纯工具，导致迁移边界再次混乱

规避：

- 本次将所需解析逻辑迁移到新的 `src/lib/` 公共文件

### 13.2 自动填充覆盖用户输入

风险：

- 用户重新上传或删除文件后，系统意外重写已确认字段

规避：

- 明确引入 `slugTouched` / `displayNameTouched` 之类的手工编辑标记

### 13.3 删除按路径匹配不稳定

风险：

- 若路径重复或路径归一化变化，可能删错文件

规避：

- 删除行为按当前渲染行 index 进行

### 13.4 解析异常影响主流程

风险：

- frontmatter 格式异常导致上传页进入错误态

规避：

- 解析失败静默降级，不影响文件展示与手工填写

### 14.5 提交前检查与提交时真实状态不一致

风险：

- 用户在页面预检查通过后，服务端状态发生变化，导致提交时结果与页面预期不一致

规避：

- 明确提交前检查只负责建立心智，不负责最终裁定
- 仍以后端发布结果作为最终真相

### 14.6 前端错误翻译依赖错误文本

风险：

- 若后端错误文案调整，前端基于文本的映射可能失效

规避：

- 当前仅将文本匹配视为过渡方案
- 后续推动后端补充稳定错误码或稳定错误类型

## 15. 实施顺序建议

建议按以下顺序落地：

1. 新增 `src/lib/skillFrontmatter.ts`
2. 在上传页接入 `name` 自动解析与默认填充
3. 为 `slug` / `displayName` 增加手工编辑标记
4. 在文件列表中增加逐行删除按钮
5. 在上传页接入 `slug` 检查与页面语义切换
6. 为发布失败补业务错误翻译兜底
7. 补文案与少量样式
8. 补测试

这样可以保证：

- 每一步都有明确边界
- 自动解析和删除能力可以分别验证
- 风险主要控制在前端局部

## 16. 结论

本次需求的技术实现非常适合保持在上传页前端本地完成：

- 自动解析依赖的输入已经在前端手里
- 删除交互本身就是本地状态编辑
- 现有校验模型已经能自然承接删除后的重算
- 现有详情 / 版本查询接口已经能支撑首轮 `slug` / 版本引导

关键设计点只有两个：

1. frontmatter 解析逻辑迁移到新的共享位置，而不是继续依赖 `convex/`
2. 自动填充必须建立在“用户手工输入优先”的状态模型之上
3. 提交前检查只负责建立正确心智，提交后仍必须以后端结果做最终兜底

只要守住这三个边界，本次需求可以以较小改动完成，并且不会影响当前 Go 后端接口与前后端交互协议。
