## Context

ONI-38 反馈：需要定期统计大家提交的 skill 目录，但当前：

- 数据模型只有 `skills.created_at`、`skills.updated_at`、`skill_versions.created_at`，**没有** `published_at`。
- 公开 `GET /api/v1/skills` 的 `sort=newest` 曾按 `updated_at` 排序；已对齐为 `created_at`。
- 管理接口已支持按 `created_at`/`updated_at` 排序、`createdFrom`/`createdTo` 筛选与 CSV 导出（英文表头）。
- 运营增量反馈（人工确认 2026-08-14）：CSV 需中文列名 +「用户昵称」；时间筛选需「提交时间 / 创建时间」双口径。

干系人：运营/管理员（定期统计）、superuser（管理后台）、开发实现与审核。

## Goals / Non-Goals

**Goals:**

- 定案并贯彻双时间口径：**创建时间** = `created_at`；**提交时间** = `latestVersion.createdAt`。
- 管理列表/导出支持按所选时间口径做时间段筛选；排序支持按创建时间、提交时间、最近更新时间。
- CSV 使用中文表头，并包含「用户昵称」（`owner.displayName`）。
- 管理面与 `/my/skills` 文案、筛选与展示对齐新口径；CLI `explore` 导出同步口径参数。
- 公开 `newest` 继续按 `created_at`（「最新创建」），与「提交时间」口径区分。

**Non-Goals:**

- 不新增 `published_at` 字段或迁移历史数据。
- 不实现 Excel/xlsx、飞书多维表格直写、邮件定时推送。
- 不改变 skill 包 ZIP 下载语义。
- 不把导出能力开放给普通用户或公开匿名接口。
- 不在本变更中重构管理列表游标分页算法。
- 不改 bundle 列表的时间能力。

## Decisions

### 1. 时间字段口径（增量定案）

| 业务说法 | 字段 | 说明 |
| --- | --- | --- |
| **创建时间** | `skills.created_at` → API `createdAt` | skill 首次入库 / 首次创建 |
| **提交时间** | 最新版本 `skill_versions.created_at` → `latestVersion.createdAt` | 最近一次提交版本的时间；运营统计「什么时候提交」的主字段 |
| **最近更新时间** | `skills.updated_at` → API `updatedAt` | skill 行最近变更 |

**不引入 `published_at`。**

**口径变更说明：** 早期草案曾将「提交时间」映射为 `created_at`。经任务分配小队长与干系人确认（2026-08-14），改为上表。产品文案、筛选 `timeField`、CSV 列「创建时间 / 提交时间」均按本表执行。公开列表 `newest` 仍用 `created_at`，UI/文档应表述为「最新创建」，避免与「提交时间」混淆。

### 2. 能力落点

| 能力 | 后端 API | 前端管理面 | CLI |
| --- | --- | --- | --- |
| 查看创建/提交/更新时间 | 列表/详情返回 `createdAt`/`updatedAt`/`latestVersion.createdAt` | Skills 列表分别展示「创建时间」「提交时间」「最近更新」 | `explore` 展示 `createdAt`/`updatedAt`；提交时间取自 API 最新版本字段（若有） |
| 按时间排序 | `sort=created_at\|updated_at\|submitted_at` | 排序控件文案对齐三口径 | `explore --sort newest` → `created_at` |
| 时间范围筛选 | `timeField=created_at\|submitted_at` + `createdFrom`/`createdTo` | 口径选择 + 日期范围 | `explore` 导出增加口径 flag |
| 按时间导出 | `GET /api/v1/admin/skills/export`（中文表头 CSV） | 「导出 CSV」带上当前筛选/排序/口径 | `explore --export csv` |

### 3. 导出格式与边界（增量）

- 格式：**仅 CSV**（UTF-8；**SHALL 带 BOM**，便于 Excel 打开中文表头）。
- **表头语言：中文**（定案）。列顺序与表头：

| 中文表头 | 数据来源 |
| --- | --- |
| Slug | `slug` |
| Skill 名称 | `displayName` |
| 用户 Handle | `owner.handle` |
| 用户昵称 | `owner.displayName`（缺失 → 空串） |
| 用户邮箱 | `owner.email` |
| 状态 | `status` |
| 创建时间 | `createdAt`（RFC3339 / Asia/Shanghai） |
| 最近更新时间 | `updatedAt`（同上） |
| 最新版本 | `latestVersion` 版本号 |
| 提交时间 | `latestVersion.createdAt`（同上；无版本 → 空串） |
| 精选 | `highlighted` |

- 时间列：RFC3339，时区固定 **`Asia/Shanghai`**。
- 空字段：缺失值输出空字符串，MUST NOT 输出 `null` / `undefined`。
- `Content-Disposition`：`attachment; filename="skills-YYYYMMDD-HHmmss.csv"`（`Asia/Shanghai` 墙钟）。
- 筛选/排序：与管理列表相同（含 `timeField` 与稳定次排序键）。
- 上限：单次最多 **5000** 行；超出 400。
- 权限：仅 superuser。

### 4. 公开列表 `newest` 语义

- `newest` / `created_at` → `skills.created_at`（「最新创建」）。
- `updated` → `updated_at`。
- 与管理侧「提交时间 = latestVersion」语义分离；不得把 `newest` 改成按最新版本时间排序。

### 5. 前端时间展示与筛选

- Unix 秒：`new Date(sec * 1000)`。
- `/management` Skills：
  - 展示「创建时间」=`createdAt`，「提交时间」=`latestVersion.createdAt`，「最近更新」=`updatedAt`。
  - 时间筛选：先选口径（创建时间 / 提交时间），再选起止日期；请求携带 `timeField` + `createdFrom`/`createdTo`。
  - 排序：创建时间 / 提交时间 / 最近更新 ↔ `created_at` / `submitted_at` / `updated_at`。
- `/my/skills`：展示「提交时间」=`latestVersion.createdAt`（无版本则空或「—」）；宜同时展示「创建时间」=`createdAt`；不做导出。

### 6. CLI 导出挂在 `explore`

- 形态：`explore --export csv ...`，不新增独立 `skills export`。
- `--from`/`--to` 编码为 `createdFrom`/`createdTo`；增加口径 flag（如 `--time-field created_at|submitted_at`，名以实现为准）映射 `timeField`。
- 消费后端返回的中文表头 CSV，不做二次英文化改写。

### 7. 时间参数契约（区间格式不变；筛选目标字段扩展）

**区间输入形态（不变）：**

1. `YYYY-MM-DD`：按 `Asia/Shanghai` 日界，from=当日 00:00:00.000+08:00，to=当日 23:59:59.999999999+08:00。
2. 带时区 RFC3339 / RFC3339Nano。
3. 拒绝 Unix 时间戳、无时区 datetime、反转范围 → 400。
4. 闭区间；单侧边界允许。

**筛选目标字段（增量）：**

| `timeField` | 比较列 | 无最新版本时 |
| --- | --- | --- |
| `created_at`（**缺省**） | `skills.created_at` | 不适用 |
| `submitted_at` | 最新版本的 `created_at`（与列表 `latestVersion.createdAt` 同源） | **排除**该 skill（不纳入结果） |

- 参数名继续使用 `createdFrom`/`createdTo` 表示区间起止（历史兼容）；其语义为「对 `timeField` 所选列」的闭区间，而非永远指 `created_at`。
- 非法 `timeField` → 400。
- 未传 `timeField` 且传了区间 → 按 `created_at` 筛选（向后兼容既有调用）。

### 8. 管理列表 `sort` / `dir` 与稳定次序（增量）

- 合法 `sort`：`created_at`、`updated_at`、`submitted_at`；缺省 `updated_at`
- 合法 `dir`：`asc`、`desc`；缺省 `desc`
- 非法值 → 400
- `submitted_at`：按最新版本 `created_at` 排序；无最新版本的记录排在该方向的末尾（`ASC` 时视为 +∞，`DESC` 时视为 −∞），次键仍为 `id ASC`
- 平局：主键相等时 `id ASC`（与 `dir` 无关）；列表与导出一致

## Risks / Trade-offs

- [口径文案变更] → 旧实现把「提交时间」标在 `createdAt` 上；本增量需同步改 UI/CSV/文档，避免运营继续按旧理解筛选。
- [`submitted_at` 筛选需关联最新版本] → 用既有 latest-version 子查询/join；无版本记录直接排除，并在 API/帮助中写清。
- [公开 `newest` 与「提交时间」用词易混] → UI/CLI help 用「最新创建」描述 `newest`。
- [CSV 中文 + BOM] → Excel 友好；纯文本工具需注意 BOM。
- [导出上限 5000] → 靠时间范围收窄。

## Migration Plan

1. 先合入 OpenSpec 增量定案并经审核猫通过。
2. 再实现 API `timeField`/`submitted_at`、中文 CSV + 昵称、前端/CLI 对齐。
3. 回滚：可去掉 `timeField`/`submitted_at` 与中文表头改动；区间参数格式保持不变。

## Resolved Decisions

1. **CSV 时区**：`Asia/Shanghai`。（人工确认 2026-08-13）
2. **CLI 导出命令形态**：挂在 `explore` 下。（人工确认 2026-08-13）
3. **`/my/skills`**：展示提交时间；不做导出。（人工确认 2026-08-13）
4. **`createdFrom`/`createdTo` 输入**：仅 `YYYY-MM-DD` 或带时区 RFC3339；闭区间；反转 400。（审核修订定案）
5. **`sort`/`dir`**：缺省 `updated_at`/`desc`；非法 400；平局 `id ASC`。（审核修订定案）
6. **CSV 空字段与文件名**：空串；`skills-YYYYMMDD-HHmmss.csv`。（审核修订定案）
7. **双时间口径**：创建时间=`created_at`；提交时间=`latestVersion.createdAt`。（人工确认 2026-08-14，任务分配小队长转发）
8. **时间筛选**：`timeField=created_at|submitted_at` + 既有区间参数；缺省 `created_at`。（本增量定案）
9. **CSV 中文表头 + 用户昵称列**（`owner.displayName`）。（人工确认 2026-08-14）
10. **排序扩展**：增加 `submitted_at`；无版本记录按 §8 排到末尾。（本增量定案）
