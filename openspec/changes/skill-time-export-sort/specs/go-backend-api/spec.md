## MODIFIED Requirements

### Requirement: superuser 全站 skill 管理接口
系统 SHALL 提供仅 superuser 可访问的全站 skill 管理接口，并支持按时间排序与按所选时间口径闭区间筛选。

#### Scenario: 获取全站 skill 列表
- **WHEN** superuser 请求 `GET /api/v1/admin/skills`
- **THEN** 系统 SHALL 返回全站 skill 列表，并支持按状态、owner、slug 或 display name 过滤
- **THEN** 每条记录 SHALL 包含 `createdAt`、`updatedAt`，以及可用的 `latestVersion`（含 `createdAt`）
- **THEN** 每条记录的 owner SHALL 包含可用于导出的 `handle`、`displayName`、`email`（缺失字段可为省略或空）

#### Scenario: 管理列表按时间排序
- **WHEN** superuser 请求 `GET /api/v1/admin/skills?sort=created_at|updated_at|submitted_at&dir=asc|desc`
- **THEN** 系统 SHALL 按指定字段与方向排序；缺省为 `updated_at desc`
- **THEN** `submitted_at` SHALL 映射为最新版本的 `created_at`；无最新版本的记录排在该方向末尾
- **THEN** 主排序键值相等时 SHALL 按 `id ASC` 稳定次序

#### Scenario: 管理列表非法 sort 或 dir
- **WHEN** `sort` 或 `dir` 取值不在合法集合内
- **THEN** 系统 SHALL 返回 400

#### Scenario: 管理列表按创建时间范围筛选
- **WHEN** superuser 请求携带 `timeField=created_at`（或省略 `timeField`）以及合法的 `createdFrom`/`createdTo`
- **THEN** 系统 SHALL 仅返回 `created_at` 落在闭区间内的 skill

#### Scenario: 管理列表按提交时间范围筛选
- **WHEN** superuser 请求携带 `timeField=submitted_at` 以及合法的 `createdFrom`/`createdTo`
- **THEN** 系统 SHALL 仅返回最新版本 `created_at` 落在闭区间内的 skill，并排除无最新版本的记录

#### Scenario: 管理列表非法 timeField
- **WHEN** `timeField` 存在且不是 `created_at` 或 `submitted_at`
- **THEN** 系统 SHALL 返回 400

#### Scenario: 管理列表时间参数非法或反转
- **WHEN** `createdFrom`/`createdTo` 无法按契约解析，或规范化后 `fromInstant > toInstant`
- **THEN** 系统 SHALL 返回 400

#### Scenario: 管理列表边界包含
- **WHEN** 某 skill 的所选时间列恰好等于规范化后的 `createdFrom` 或 `createdTo`
- **THEN** 该 skill SHALL 出现在结果中

#### Scenario: 获取单个 skill 管理详情
- **WHEN** superuser 请求 `GET /api/v1/admin/skills/{slug}`
- **THEN** 系统 SHALL 返回该 skill 的管理详情，包括 owner、当前版本、历史版本和删除状态
- **THEN** 详情中的版本列表项 SHALL 包含各自的 `createdAt`，以便查看每次版本提交时间

#### Scenario: 非 superuser 访问全站 skill 管理接口
- **WHEN** 非 superuser 用户访问任何 `admin/skills` 接口
- **THEN** 系统 SHALL 返回 403 Forbidden

## ADDED Requirements

### Requirement: 管理侧 skill 目录导出接口
系统 SHALL 提供仅 superuser 可访问的 skill 目录 CSV 导出接口。

#### Scenario: 注册导出路由
- **WHEN** 系统启动
- **THEN** 系统 SHALL 注册 `GET /api/v1/admin/skills/export`

#### Scenario: 导出 CSV（中文表头与昵称）
- **WHEN** superuser 请求 `GET /api/v1/admin/skills/export` 且结果不超过 5000 行
- **THEN** 系统 SHALL 返回 CSV，`Content-Type` 为 `text/csv`，UTF-8 带 BOM，表头为中文
- **THEN** 表头 SHALL 包含「用户昵称」，数据取自 owner `displayName`
- **THEN** 时间列使用 RFC3339，时区固定为 `Asia/Shanghai`；「创建时间」与「提交时间」分别对应 `createdAt` 与 `latestVersion.createdAt`
- **THEN** 系统 SHALL 设置 `Content-Disposition: attachment; filename="skills-YYYYMMDD-HHmmss.csv"`（`Asia/Shanghai` 墙钟）
- **THEN** 缺失的 owner/版本/版本时间/昵称字段 SHALL 编码为空字符串

#### Scenario: 导出复用列表筛选
- **WHEN** 导出请求携带 `q`、`status`、`owner`、`sort`、`dir`、`timeField`、`createdFrom`、`createdTo`
- **THEN** 系统 SHALL 使用与 `GET /api/v1/admin/skills` 相同的筛选、闭区间时间语义、排序缺省/非法校验与 `id ASC` 次排序键

#### Scenario: 导出超限
- **WHEN** 匹配行数超过 5000
- **THEN** 系统 SHALL 返回 400

#### Scenario: 非 superuser 导出
- **WHEN** 非 superuser 请求导出接口
- **THEN** 系统 SHALL 返回 403 Forbidden

### Requirement: 公开 skill 列表 newest 排序语义
系统 SHALL 在公开 skill 列表接口中将 `newest` 排序映射为 `created_at`（最新创建）。

#### Scenario: newest 使用 created_at
- **WHEN** 客户端请求 `GET /api/v1/skills?sort=newest`
- **THEN** 后端 SHALL 按 `created_at` 排序

#### Scenario: created_at 别名
- **WHEN** 客户端请求 `GET /api/v1/skills?sort=created_at`
- **THEN** 后端 SHALL 与 `newest` 使用相同排序列

#### Scenario: updated 保持不变
- **WHEN** 客户端请求 `GET /api/v1/skills?sort=updated`
- **THEN** 后端 SHALL 按 `updated_at` 排序
