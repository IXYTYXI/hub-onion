## ADDED Requirements

### Requirement: CLI 按创建时间浏览 skill
系统 SHALL 让 CLI 浏览命令的 `newest` 排序与后端 `created_at`（最新创建）口径一致，并展示可读时间。

#### Scenario: explore newest 对齐 created_at
- **WHEN** 用户执行 `explore --sort newest`（或等价命令）
- **THEN** CLI SHALL 请求公开列表接口时使用与 `created_at`/`newest` 一致的 sort 参数，而不是映射为 `updated`

#### Scenario: 文本输出包含时间
- **WHEN** 用户以非 JSON 模式浏览 skill 列表
- **THEN** CLI SHALL 输出可读的创建时间或最近更新时间（至少其一），不得只依赖含糊的相对更新文案而不说明字段含义

#### Scenario: JSON 输出包含时间字段
- **WHEN** 用户以 JSON 模式浏览 skill 列表
- **THEN** 输出 SHALL 包含 API 返回的 `createdAt` 与 `updatedAt`

### Requirement: CLI 经 explore 导出 CSV
系统 SHALL 将管理侧 CSV 导出能力挂在 `explore` 命令下，调用管理导出接口生成 skill 目录 CSV；MUST NOT 新增独立的 `skills export` 子命令作为本需求交付形态。

#### Scenario: explore 导出成功
- **WHEN** 已登录且具备 superuser 权限的用户执行 `explore` 的导出模式（例如 `explore --export csv --from ... --to ...`，具体 flag 名以实现为准但须挂在 explore）
- **THEN** CLI SHALL 调用 `GET /api/v1/admin/skills/export`，并将 CSV 写到标准输出或指定文件
- **THEN** CLI MUST NOT 将后端返回的中文表头改写为英文

#### Scenario: explore 导出时间参数遵循同一契约
- **WHEN** 用户在 `explore` 导出模式传入 `--from`/`--to`
- **THEN** CLI SHALL 仅接受与 API 相同的 `YYYY-MM-DD` 或带时区 RFC3339，并将其编码为 `createdFrom`/`createdTo`
- **THEN** 若参数非法或形成反转范围，CLI SHALL 在本地失败或以明确错误展示后端 400，不得静默忽略

#### Scenario: explore 导出支持时间口径
- **WHEN** 用户在 `explore` 导出模式指定时间口径（例如 `--time-field created_at|submitted_at`，名以实现为准）
- **THEN** CLI SHALL 将其编码为 API 的 `timeField` 查询参数
- **THEN** 未指定时 SHALL 省略或传 `created_at`，与后端口径缺省一致

#### Scenario: explore 导出权限不足
- **WHEN** 导出接口返回 403
- **THEN** CLI SHALL 以明确错误提示权限不足，不得静默写空文件
