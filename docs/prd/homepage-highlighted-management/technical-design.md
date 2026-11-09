# 首页精选技能、管理配置与安装统计收口技术方案

## 1. 文档目的

本文档基于 [需求文档](./requirements.md) 和当前仓库代码现状，给出“首页精选技能与热门技能展示恢复、highlighted 管理能力补齐，以及安装统计最小方案收口”的技术实现方案。

本文档重点回答四个问题：

1. 当前代码为什么会出现首页空白、highlighted 无法管理、安装统计失真。
2. 在现有 Go 后端 + 前端结构下，这个需求是否可行，改动点有哪些。
3. 应该如何按最小风险方式落地。
4. 管理后台 skill 列表中的作者字段为什么会退化成 UID，以及如何收口为飞书授权邮箱。
5. 公开用户页为什么也会展示 UID 风格 handle，以及如何收口为邮箱优先展示。

## 2. 现状调研结论

### 2.1 首页数据当前是前端占位

首页技能站点实现位于 [`src/routes/index.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/index.tsx)。

当前 `SkillsHome()` 中：

- `highlighted` 直接写死为空数组
- `popular` 直接写死为空数组

这意味着首页“精选技能”和“热门技能”现在没有接任何真实接口，页面为空不是后端没数据，而是前端没有接入数据源。

### 2.2 前端保留了 highlighted 概念，但 Go 后端未落地

前端技能列表 hook [`src/hooks/useSkills.ts`](/Users/logo/self_repo/claw_case/clawhub/src/hooks/useSkills.ts) 会把 `highlightedOnly` 转成 `highlighted=1` 查询参数。

但后端公开列表接口 [`backend/internal/handler/skills.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/skills.go) 当前只读取：

- `limit`
- `cursor`
- `sort`
- `dir`

并没有解析 `highlighted` 参数。

同时，当前 `skills` 表定义 [`backend/internal/database/migrations/000001_create_skills_table.up.sql`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/database/migrations/000001_create_skills_table.up.sql) 也没有 `highlighted` 或等价字段。

因此：

- 前端“仅看精选”筛选现在不会真正生效
- 首页“精选技能”也没有可依赖的数据字段

### 2.3 管理后台当前只支持删除/恢复

管理页面在 [`src/routes/management.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/management.tsx)。

当前管理页能力只有：

- 加载 `/api/v1/admin/skills`
- 操作 `/api/v1/admin/skills/:slug/delete`
- 操作 `/api/v1/admin/skills/:slug/undelete`

对应后端在 [`backend/internal/handler/skill_management.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/skill_management.go) 中，也只有：

- `ListAdminSkillsHandler`
- `GetAdminSkillDetailHandler`
- `AdminDeleteSkillHandler`
- `AdminUndeleteSkillHandler`

因此 highlighted 当前既没有数据库状态，也没有管理入口。

### 2.3.1 管理后台作者信息当前缺少邮箱优先展示规则

当前管理列表虽然已经返回 `owner` 摘要，但前端展示逻辑并没有把“飞书授权邮箱”作为作者栏的首选标识。

这会导致在 `/management` 页面中：

- 作者栏可能退化为 handle 或内部 UID 风格的回退值
- 后台运营无法快速识别真实组织账号

而从后台使用场景看，邮箱比 UID 更适合作为管理识别字段。

### 2.3.2 公开用户页当前仍使用 handle 作为次级身份展示

公开用户页 [`src/routes/u/$handle.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/u/$handle.tsx) 当前会请求 `GET /api/v1/users/:handle`，然后在页面上固定渲染：

- `displayName`
- `@handle`

但后端 [`backend/internal/handler/user.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/user.go) 当前公开资料接口明确“不返回 email”，所以前端即使想展示邮箱也拿不到。

在飞书 OAuth 场景下，handle 可能是 `ou_xxx` 这种 UID 风格值，因此用户页会直接把 UID 暴露给用户。

### 2.4 安装统计当前只有下载量是真的

下载接口在 [`backend/internal/handler/download.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/download.go)。

当前下载成功后只会执行：

```go
skillService.DB().Model(&skill).Update("stats_downloads", gorm.Expr("stats_downloads + 1"))
```

没有任何地方更新 `stats_installs`。

但详情页 [`src/components/SkillHeader.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/SkillHeader.tsx) 当前却展示：

- `当前安装`
- `累计安装`

并且仍尝试读取：

- `skill.stats.installsCurrent`
- `skill.stats.installsAllTime`

而 Go 后端实际只返回：

- `stats.downloads`
- `stats.installs`
- `stats.versions`
- `stats.stars`

前端与后端统计字段语义已经脱节。

## 3. 可行性评估

结论：可行性高，且适合按最小方案落地。

原因如下：

1. `skills` 表已经承载主要运营字段，新增一个布尔字段不会破坏现有结构。
2. 首页、技能列表、管理页都已经有明确的承载位置，不需要大规模页面重构。
3. 后端列表、详情、管理接口都集中在少数 handler/service 文件中，改造面较小。
4. 安装统计最小方案可以直接复用下载成功这个既有时机，不需要引入新事件上报协议。

同时，本需求不建议一步做到完整 install telemetry，因为那会引入：

- 去重标识
- 设备/机器维度
- 卸载与更新回传
- 当前安装数定义

这些内容显著超出当前需求范围。

## 4. 设计目标

本次技术方案采用“单字段精选 + 最小安装统计”的实现原则：

- `highlighted` 使用单一布尔字段持久化
- 首页精选、列表筛选、管理配置共享同一字段
- 热门技能基于既有下载量排序
- 安装统计仅维护累计安装次数
- 详情页停止展示无法真实维护的“当前安装”
- 管理后台 skill 列表作者栏优先展示飞书授权邮箱
- 公开用户页身份信息同样采用飞书邮箱优先展示

## 5. 数据模型设计

### 5.1 skills 表新增字段

建议在 `skills` 表中新增：

```sql
ALTER TABLE skills
ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN NOT NULL DEFAULT FALSE;
```

字段语义：

- `TRUE`: skill 处于精选状态
- `FALSE`: skill 非精选

命名选择 `is_highlighted` 的原因：

- 与当前 Go 后端 `is_deleted` 命名风格一致
- 避免与旧 Convex 时代 `batch` / badge 语义混用

### 5.2 Go 模型扩展

在 [`backend/internal/model/skill.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/model/skill.go) 的 `Skill` struct 中增加：

```go
IsHighlighted bool `gorm:"default:false" json:"-"`
```

同时在面向前端的 DTO 中增加可选返回字段：

- 公共 `SkillItem`：增加 `highlighted`
- 管理 `ManagedSkillItem`：增加 `highlighted`

推荐统一对前端暴露为：

- `highlighted: boolean`

数据库内部仍使用 `is_highlighted`。

## 6. 后端接口设计

### 6.1 公共列表接口：支持 highlighted 过滤

当前公开技能列表是：

- `GET /api/v1/skills`

当前 service 签名为：

```go
ListSkills(ctx, limit, cursor, sortKey, dir)
```

建议扩展为：

```go
ListSkills(ctx, limit, cursor, sortKey, dir, highlightedOnly)
```

handler 解析：

- `highlighted=1`
- `highlighted=true`

service 过滤条件增加：

```sql
AND is_highlighted = TRUE
```

仅在 `highlightedOnly` 为真时追加。

### 6.2 首页复用公共列表接口

首页不需要新增专用接口，优先复用现有列表接口，降低接口面复杂度。

建议调用方式：

- 精选技能：
  - `GET /api/v1/skills?highlighted=1&sort=updated&dir=desc&limit=6`
- 热门技能：
  - `GET /api/v1/skills?sort=downloads&dir=desc&limit=6`

这样可以：

- 避免新增 `homepage` 专用聚合接口
- 复用已有 `SkillItem` 返回结构
- 减少后端维护成本

### 6.3 管理接口：新增 highlighted 开关

建议新增统一管理接口：

- `POST /api/v1/admin/skills/:slug/highlighted`

请求体：

```json
{ "highlighted": true }
```

或：

```json
{ "highlighted": false }
```

推荐原因：

- 比拆分 `highlight` / `unhighlight` 两个接口更简洁
- 与前端 toggle 操作更自然匹配

handler 逻辑：

1. 校验当前用户是 superuser
2. 根据 slug 查询 skill
3. 更新 `is_highlighted`
4. 返回 `{ ok: "true", highlighted: true|false }`

对应 service 建议新增：

```go
SetSkillHighlighted(ctx context.Context, slug string, highlighted bool) error
```

### 6.4 管理列表与详情返回 highlighted

当前管理列表返回构造在 [`managedSkillListItem()`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/skill_management.go)。

建议在该返回对象中新增：

```go
"highlighted": skill.IsHighlighted,
```

这样前端管理页无需额外详情请求即可渲染精选状态与按钮。

### 6.4.1 管理列表与详情返回 owner.email 并以前端邮箱优先渲染

当前管理接口已经返回 owner 摘要对象，本次不需要新增 owner 专用接口，但需要明确管理页作者栏展示策略：

- 后端继续保证 `owner.email` 在管理接口中可返回
- 前端 `/management` 的作者展示优先读取 `owner.email`
- 若 `owner.email` 为空，再回退到 `owner.handle`
- 仅在邮箱与 handle 都为空时，才退回“未知”

这样可以最大化复用现有管理接口，同时提升后台运营可读性。

### 6.4.2 公开用户资料接口返回 email，并由用户页按邮箱优先展示

本次需要同步调整公开用户资料接口：

- `GET /api/v1/users/:handle` 返回结构增加 `email`
- `/u/:handle` 页面优先显示 `email`
- 当 `email` 为空时，再回退显示 `@handle`

这里的改动虽然扩大了公开用户接口的返回字段，但这是满足“用户页展示飞书邮箱”的必要条件。实现上仍是最小改动：

- 后端只在现有 JSON 上增加一个 `email`
- 前端只调整次级身份文案渲染，不改动用户页整体结构

### 6.5 下载成功时同步累计 installs

下载接口当前已具备“成功生成 ZIP 并输出响应”的统一时机，适合作为最小方案的统计点。

建议将 [`backend/internal/handler/download.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/download.go) 中的更新逻辑改为同时更新：

```go
updates := map[string]any{
  "stats_downloads": gorm.Expr("stats_downloads + 1"),
  "stats_installs":  gorm.Expr("stats_installs + 1"),
}
```

或者拆成 service 方法：

```go
IncrementDownloadAndInstallStats(ctx context.Context, skillID string) error
```

更推荐后者，原因是：

- 统计写入从 handler 抽离
- 更容易补测试
- 便于未来演进为 download / install 分离策略

### 6.6 错误处理要求

当前下载 handler 的统计更新没有错误处理。

本次建议至少做以下改进：

- 使用 `WithContext`
- 检查 `Update` / `Updates` 返回错误
- 记录日志或至少在代码上显式忽略

推荐策略：

- 下载 ZIP 成功仍返回 200
- 统计写入失败时记录 warning，不阻断下载响应

原因：

- 统计属于非核心副作用
- 不能因为计数失败让用户安装失败

## 7. 前端设计

### 7.1 首页接入真实数据

当前首页是静态占位，不使用数据 hook。

建议在 [`src/routes/index.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/index.tsx) 中引入两个 `useQuery`：

- `['home', 'highlighted-skills']`
- `['home', 'popular-skills']`

分别请求：

- `/skills?highlighted=1&sort=updated&dir=desc&limit=6`
- `/skills?sort=downloads&dir=desc&limit=6`

然后将返回的 `SkillItem[]` 转换为首页 `SkillCard` 所需结构。

由于首页当前对 owner 展示有依赖，但公开列表接口并不包含 owner，存在两个选择：

1. 首页首版不展示 owner，只展示技能卡与统计
2. 扩展公共列表接口，增加 owner 摘要

建议本轮采用方案 1，原因是：

- 改动更小
- 不扩大公开列表 DTO 变化范围
- 先恢复首页可用性

如果必须保留 owner 展示，则需要同步扩展公开列表接口返回 owner 信息。

### 7.2 管理页增加精选开关

管理页当前只有一个 `skillAction` mutation，处理 delete/undelete。

建议新增单独 mutation：

```ts
mutationFn: ({ slug, highlighted }) =>
  apiRequest(`/admin/skills/${slug}/highlighted`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ highlighted }),
  })
```

UI 上每个 skill 增加：

- 状态标签：`精选` / `非精选`
- 按钮：`设为精选` / `取消精选`

该操作与 delete/undelete 并列，不复用同一个 `type` 字段，避免动作语义混乱。

### 7.3 技能列表页真正支持 highlightedOnly

`useSkills()` 已经会发 `highlighted=1`，只需后端接上即可生效。

因此列表页前端改动很小，重点在：

- 更新类型，支持 `highlighted`
- 确认筛选按钮行为与后端语义一致

### 7.4 详情页安装统计收口

当前 [`SkillHeader.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/SkillHeader.tsx) 还在渲染：

- `skill.stats.installsCurrent`
- `skill.stats.installsAllTime`

但现有 Go 后端没有这两个字段。

本次建议直接改成：

- 不再展示 `当前安装`
- 只展示 `累计安装`
- 值来自 `skill.stats.installs`

也就是说这一行收口为类似：

```tsx
⭐ {stars} · 下载 {downloads} · 安装 {installs}
```

文案可保留为“累计安装”，避免误解。

### 7.5 前端类型收口

[`src/types/api.ts`](/Users/logo/self_repo/claw_case/clawhub/src/types/api.ts) 需要补充：

- `SkillItem.highlighted?: boolean`
- `ManagedSkillItem.highlighted: boolean`

同时需要清理前端对以下旧字段的依赖：

- `installsCurrent`
- `installsAllTime`

至少在详情页链路中要彻底移除，避免继续展示伪字段。

## 8. 影响范围

### 8.1 后端文件

- [`backend/internal/database/migrations/000001_create_skills_table.up.sql`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/database/migrations/000001_create_skills_table.up.sql)
  - 需新增后续迁移文件，而不是修改已有迁移
- [`backend/internal/model/skill.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/model/skill.go)
- [`backend/internal/service/skill_service.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/service/skill_service.go)
- [`backend/internal/handler/skills.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/skills.go)
- [`backend/internal/handler/skill_management.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/skill_management.go)
- [`backend/internal/handler/download.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/download.go)
- [`backend/internal/handler/routes.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/routes.go)

### 8.2 前端文件

- [`src/routes/index.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/index.tsx)
- [`src/routes/management.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/management.tsx)
- [`src/hooks/useSkills.ts`](/Users/logo/self_repo/claw_case/clawhub/src/hooks/useSkills.ts)
- [`src/routes/skills/-useSkillsBrowseModel.ts`](/Users/logo/self_repo/claw_case/clawhub/src/routes/skills/-useSkillsBrowseModel.ts)
- [`src/components/SkillHeader.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/SkillHeader.tsx)
- [`src/types/api.ts`](/Users/logo/self_repo/claw_case/clawhub/src/types/api.ts)
- [`src/copy/management.ts`](/Users/logo/self_repo/claw_case/clawhub/src/copy/management.ts)
- [`src/copy/skills.ts`](/Users/logo/self_repo/claw_case/clawhub/src/copy/skills.ts)

## 9. 测试方案

### 9.1 后端测试

建议补充以下集成测试：

1. `GET /api/v1/skills?highlighted=1` 只返回精选 skill
2. `POST /api/v1/admin/skills/:slug/highlighted` 可以切换精选状态
3. 下载接口成功后同时递增：
   - `stats_downloads`
   - `stats_installs`

### 9.2 前端测试

建议补充或更新：

1. 首页在有精选和热门数据时能够正常渲染
2. 管理页能够展示 `highlighted` 状态并触发开关请求
3. 详情页不再出现“当前安装”文案
4. 详情页“累计安装”展示使用 `stats.installs`

## 10. 实施顺序建议

建议按以下顺序实施：

1. 后端迁移：新增 `is_highlighted`
2. 后端模型与 service：补字段与过滤逻辑
3. 后端管理接口：补 highlighted 开关
4. 后端下载统计：同步累计 `stats_installs`
5. 前端类型更新：统一 `highlighted` 与 `stats.installs`
6. 管理页接入精选开关
7. 首页接入精选/热门真实数据
8. 详情页隐藏“当前安装”，只保留“累计安装”
9. 补测试并手工验收

## 11. 风险与取舍

### 11.1 首页 owner 信息缺失

当前公开列表接口不返回 owner 信息，而首页卡片目前支持展示 owner。

取舍建议：

- 首轮先不在首页展示 owner
- 优先恢复精选与热门列表可用

这样可以避免为首页需求扩大公开 DTO 改动范围。

### 11.2 installs 语义仍然是近似值

本次 `stats_installs` 采用“下载成功即记为安装”的最小方案，因此它本质上是：

- 与 CLI install 高度近似
- 但不等于严格意义的设备级累计安装数

这是本次需求允许的折中，必须在产品和研发认知上保持一致。

### 11.3 当前安装数明确不做

如果保留“当前安装”展示，会让用户误以为系统已有在线设备/机器层级统计能力。

本次必须收口，不应保留这个伪能力入口。

## 12. 结论

本需求在当前代码结构下具备高可行性，且适合按“最小改造、统一语义、快速恢复产品可用性”的原则推进。

推荐采用以下最终实现策略：

- 数据库新增 `is_highlighted`
- 公共列表支持 `highlighted` 过滤
- 管理后台新增精选切换接口与按钮
- 首页复用公共列表接口获取精选/热门数据
- 下载成功时同步累计 `stats_installs`
- 详情页隐藏“当前安装”，只展示基于 `stats.installs` 的累计安装

该方案能在不引入复杂推荐系统、不重做安装事件体系的前提下，较低成本恢复首页与运营能力，并收口当前统计展示失真问题。
