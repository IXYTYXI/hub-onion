## ADDED Requirements

### Requirement: skill 时间字段口径
系统 SHALL 使用既有时间字段表达 skill 创建、提交与更新语义，且 MUST NOT 引入 `published_at`。

#### Scenario: 创建时间映射
- **WHEN** 产品或接口需要表达「创建时间」或「首次创建时间」
- **THEN** 系统 SHALL 使用 `skills.created_at`（API 字段 `createdAt`）

#### Scenario: 提交时间映射
- **WHEN** 产品或接口需要表达「提交时间」或「最近一次提交版本时间」
- **THEN** 系统 SHALL 使用最新版本的 `skill_versions.created_at`（API 字段 `latestVersion.createdAt`）

#### Scenario: 最近更新时间映射
- **WHEN** 产品或接口需要表达「最近更新时间」
- **THEN** 系统 SHALL 使用 `skills.updated_at`（API 字段 `updatedAt`）

#### Scenario: 禁止虚构发布时间字段
- **WHEN** 实现本需求相关的 API、管理面或 CLI
- **THEN** 系统 MUST NOT 新增数据库列或 API 字段 `publishedAt` / `published_at`

### Requirement: createdFrom/createdTo 时间参数契约
系统 SHALL 仅接受约定形态的 `createdFrom`/`createdTo`，并按闭区间筛选**由 `timeField` 指定的**时间列。

#### Scenario: 接受日期粒度 YYYY-MM-DD
- **WHEN** 请求携带 `createdFrom=2026-08-01` 与/或 `createdTo=2026-08-31`
- **THEN** 系统 SHALL 按 `Asia/Shanghai` 将 from 解释为当日 `00:00:00.000+08:00`，将 to 解释为当日 `23:59:59.999999999+08:00`

#### Scenario: 接受带时区的 RFC3339
- **WHEN** 请求携带带显式偏移或 `Z` 的 RFC3339（如 `2026-08-01T12:00:00+08:00`）
- **THEN** 系统 SHALL 解析为瞬时并用于筛选

#### Scenario: 拒绝 Unix 时间戳与无时区 datetime
- **WHEN** `createdFrom` 或 `createdTo` 为纯数字时间戳，或为无时区日期时间（如 `2026-08-01T12:00:00`）
- **THEN** 系统 SHALL 返回 400，并说明合法格式为 `YYYY-MM-DD` 或带时区的 RFC3339

#### Scenario: 闭区间包含上下界
- **WHEN** 规范化后的范围为 `[fromInstant, toInstant]`，且某 skill 的所选时间列恰好等于 `fromInstant` 或恰好等于 `toInstant`
- **THEN** 该 skill SHALL 被包含在列表与导出结果中

#### Scenario: 反转范围返回 400
- **WHEN** `createdFrom` 与 `createdTo` 均存在，且规范化后 `fromInstant > toInstant`
- **THEN** 系统 SHALL 返回 400

#### Scenario: 单侧边界
- **WHEN** 仅提供 `createdFrom` 或仅提供 `createdTo`
- **THEN** 系统 SHALL 只施加对应单侧闭边界，另一侧不限

### Requirement: 管理侧按时间字段筛选
系统 SHALL 允许 superuser 通过 `timeField` 选择按创建时间或提交时间做区间筛选。

#### Scenario: 按创建时间筛选
- **WHEN** superuser 提供 `timeField=created_at`（或省略 `timeField`）以及合法的 `createdFrom`/`createdTo`
- **THEN** 系统 SHALL 只返回 `skills.created_at` 落在闭区间内的 skill

#### Scenario: 按提交时间筛选
- **WHEN** superuser 提供 `timeField=submitted_at` 以及合法的 `createdFrom`/`createdTo`
- **THEN** 系统 SHALL 只返回「最新版本 `created_at`」落在闭区间内的 skill
- **THEN** 无最新版本的 skill SHALL 被排除

#### Scenario: 非法 timeField
- **WHEN** `timeField` 不是 `created_at` 或 `submitted_at`
- **THEN** 系统 SHALL 返回 400

### Requirement: 管理侧按时间排序与筛选
系统 SHALL 允许 superuser 在管理 skill 列表中按创建时间、提交时间或最近更新时间排序；排序参数非法时拒绝请求。

#### Scenario: 按创建时间降序排序
- **WHEN** superuser 请求管理 skill 列表且 `sort=created_at`、`dir=desc`
- **THEN** 系统 SHALL 按 `created_at` 降序返回结果，主键值相等时按 `id ASC` 稳定次序

#### Scenario: 按提交时间排序
- **WHEN** superuser 请求管理 skill 列表且 `sort=submitted_at`
- **THEN** 系统 SHALL 按最新版本 `created_at` 及指定方向返回结果
- **THEN** 无最新版本的记录 SHALL 排在该方向的末尾，次排序键仍为 `id ASC`

#### Scenario: 按最近更新时间排序
- **WHEN** superuser 请求管理 skill 列表且 `sort=updated_at`
- **THEN** 系统 SHALL 按 `updated_at` 及指定方向返回结果，主键值相等时按 `id ASC`

#### Scenario: 排序缺省值
- **WHEN** superuser 请求管理 skill 列表且未传 `sort`/`dir`
- **THEN** 系统 SHALL 使用 `sort=updated_at` 且 `dir=desc`

#### Scenario: 非法 sort 或 dir
- **WHEN** `sort` 不是 `created_at`/`updated_at`/`submitted_at`，或 `dir` 不是 `asc`/`desc`
- **THEN** 系统 SHALL 返回 400

### Requirement: 管理侧 skill 目录 CSV 导出
系统 SHALL 允许 superuser 将当前筛选条件下的 skill 目录导出为 CSV，用于定期统计。

#### Scenario: 导出成功（中文表头）
- **WHEN** superuser 请求导出且结果行数不超过上限
- **THEN** 系统 SHALL 返回 `text/csv` 文件，表头为中文，至少包含：Slug、Skill 名称、用户 Handle、用户昵称、用户邮箱、状态、创建时间、最近更新时间、最新版本、提交时间、精选
- **THEN** 「用户昵称」列 SHALL 取自 `owner.displayName`；缺失时为空字符串
- **THEN** 「创建时间」列 SHALL 取自 `createdAt`；「提交时间」列 SHALL 取自 `latestVersion.createdAt`（无版本为空串）
- **THEN** CSV 时间列 SHALL 使用 RFC3339，时区固定为 `Asia/Shanghai`
- **THEN** 文件 SHALL 使用 UTF-8 并带 BOM，便于 Excel 打开中文表头
- **THEN** 响应 SHALL 包含 `Content-Disposition: attachment; filename="skills-YYYYMMDD-HHmmss.csv"`，其中时间戳为导出时刻的 `Asia/Shanghai` 墙钟

#### Scenario: 导出空字段编码
- **WHEN** 某行缺少 owner 邮箱、昵称、最新版本或最新版本时间
- **THEN** 对应 CSV 单元格 SHALL 为空字符串，MUST NOT 写入 `null` 或 `undefined`

#### Scenario: 导出带筛选与排序
- **WHEN** 导出请求携带与管理列表相同的 `q`、`status`、`owner`、`sort`、`dir`、`timeField`、`createdFrom`、`createdTo`
- **THEN** 系统 SHALL 按相同条件筛选，并按相同主排序键与 `id ASC` 次排序键导出

#### Scenario: 超出导出上限
- **WHEN** 匹配行数超过 5000
- **THEN** 系统 SHALL 返回 400，并提示收窄时间范围或筛选条件

#### Scenario: 非 superuser 导出
- **WHEN** 非 superuser 请求导出接口
- **THEN** 系统 SHALL 返回 403 Forbidden

### Requirement: 公开列表 newest 排序对齐创建时间
系统 SHALL 将公开 skill 列表的 `newest` 排序解释为按 `created_at` 排序（语义为最新创建，而非提交时间）。

#### Scenario: newest 按创建时间排序
- **WHEN** 客户端请求 `GET /api/v1/skills?sort=newest`
- **THEN** 系统 SHALL 按 `skills.created_at` 排序

#### Scenario: updated 仍按更新时间排序
- **WHEN** 客户端请求 `GET /api/v1/skills?sort=updated`
- **THEN** 系统 SHALL 按 `skills.updated_at` 排序
