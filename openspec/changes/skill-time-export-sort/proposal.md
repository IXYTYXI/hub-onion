## Why

运营需要按时间统计 skill 目录：查看提交/创建时间、按时间排序与筛选、导出 CSV。本变更先对齐时间字段口径，再补齐管理面与 CLI 的时间能力。

在既有交付基础上，运营反馈新增两项范围：
1. CSV 列名改为中文，并增加「用户昵称」列（关联作者昵称）。
2. 时间筛选支持「提交时间」「创建时间」两种口径，按时间段筛选。

## What Changes

- **时间口径定案（增量修订）**：
  - **创建时间** = `skills.created_at`（API：`createdAt`）
  - **提交时间** = 最近一次版本提交时间 `latestVersion.createdAt`（`skill_versions.created_at`）
  - **最近更新时间** = `skills.updated_at`（API：`updatedAt`）
  - 仍不引入 `published_at`
  - 注：早期草案曾将「提交时间」映射为 `created_at`；本增量以业务确认口径为准，产品文案与筛选字段同步改正
- **公开列表**：`newest` 仍按 `created_at` 排序（语义为「最新创建」），与「提交时间=latestVersion」区分
- **管理列表/导出**：
  - 增加 `timeField=created_at|submitted_at`，配合既有时间区间参数按所选口径闭区间筛选
  - 排序增加 `submitted_at`（按最新版本 `created_at`）；原 `created_at` 排序文案改为「创建时间」
  - CSV **中文表头**；新增 **用户昵称** 列（`owner.displayName`）
- **管理前端**：时间筛选增加「创建时间 / 提交时间」口径选择；列表文案与口径对齐；导出随当前筛选
- **`/my/skills`**：展示提交时间按 `latestVersion.createdAt`（无版本则空）；可同时展示创建时间 `createdAt`；不做导出
- **CLI**：`explore` 导出支持时间口径 flag，并消费后端中文表头 CSV

## Capabilities

### New Capabilities
- `skill-time-export-sort`: skill 时间口径、管理侧时间排序/双口径筛选/CSV 中文导出、公开 newest 对齐、CLI 导出入口

### Modified Capabilities
- `go-backend-api`: 管理列表/导出增加 `timeField` 与 `submitted_at` 排序；CSV 中文表头与昵称列；newest→created_at
- `skill-management-surfaces`: 管理面双口径筛选与文案；CSV 中文；`/my/skills` 提交时间口径修正
- `yclawhub-cli-product`: explore 导出支持时间口径；newest 对齐

## Impact

- 后端：`skill` 管理 list/export 查询与 CSV 编码；公开 list sort；可能涉及 join 最新版本时间筛选
- 前端：`Management` Skills 时间口径选择与文案；`/my/skills` 时间展示
- CLI：`explore` 导出增加口径参数
- 数据库：无新列、无迁移
- 兼容：既有 `createdFrom`/`createdTo` 保留；缺省 `timeField=created_at`，避免破坏已对接调用
