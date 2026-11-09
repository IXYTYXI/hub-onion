## Context

当前 Go 后端已经有 `skills.description` 字段，列表、详情和搜索响应会把非空描述映射到 `summary`。新发布流程已经能从上传文件的根目录 `SKILL.md` / `skills.md` frontmatter 中提取 `description`，但历史已发布 skill 不会自动回填，因此仍会在页面上显示“暂无简介。”。

历史版本文件信息保存在 `skill_versions.files` 中，文件内容可通过现有 `StorageService.Download` 从 OSS 读取。维护接口当前位于 `/api/v1/admin/*` 下，并通过 superuser 配置列表命中校验限制访问。

## Goals / Non-Goals

**Goals:**
- 提供一个后端维护 API，用于批量触发历史 skill 缺失简介回填。
- 在现有 `/management` 管理后台提供一个维护 tab 和显式触发按钮，作为登录态与 superuser 配置命中可见性检查后的受控入口。
- 通过 `/management?tab=skills|maintenance` 表达管理后台当前 tab；未提供或非法 `tab` 时默认 `skills`。
- 维护 tab 不加载 skills 列表；只有技能管理 tab 需要请求 `/api/v1/admin/skills`。
- 只填补数据库简介为空或空白的 active skill，不覆盖已有简介。
- 从最新版本根目录主说明文件提取非空 `description`。
- 运行期间使用全局写锁，防止并发同步任务重复执行。
- 并发请求只返回“正在运行”状态，不排队，不保存历史任务状态。

**Non-Goals:**
- 不新增独立前端页面；入口复用现有 `/management` 管理后台。
- 不新增数据库字段或任务表。
- 不回填已删除或非 active skill。
- 不修改公开列表、详情、搜索 API 的响应结构。
- 不扫描历史所有版本；每个候选 skill 只使用 latest version。
- 不提供按单个 skill slug 同步简介的接口。

## Decisions

### 决策 1：使用维护 POST API 触发同步

新增 `POST /api/v1/admin/maintenance/skill-descriptions/sync`，沿用现有 admin group 的认证链路，并在 handler 内继续要求当前用户命中 superuser 配置列表。该接口属于维护动作，使用 POST 比 GET 更符合会写入数据库的语义。

路径放在 `/admin/maintenance/*` 下，避免与现有 `/admin/skills/:slug/*` 动态路由冲突，也避免把批量维护动作表达成某个 skill slug 的子操作。该接口不接受 `slug` 参数，执行范围由服务端查询当前所有缺失简介且满足条件的 active skills 决定。

替代方案是做 CLI 命令或启动时自动回填。CLI 命令会增加运维入口，启动时自动回填会引入不可控启动副作用，因此本次不采用。

### 决策 1.1：在管理后台提供显式触发入口

在现有 `/management` 页面新增 tab，例如“维护任务”，并在该 tab 内提供“同步缺失简介”按钮。该入口只在当前登录用户命中 superuser 配置列表时展示；点击后调用 `POST /api/v1/admin/maintenance/skill-descriptions/sync`，并展示同步完成统计或“正在运行”状态。

管理后台 tab 状态由 URL search 参数表达：

- `/management` 与 `/management?tab=skills` 展示技能管理 tab。
- `/management?tab=maintenance` 展示维护任务 tab。
- 非法 `tab` 值按 `skills` 处理。

维护 tab 不需要展示或筛选 skill 列表，切到该 tab 时不得为了维护功能额外请求 `/api/v1/admin/skills`；只有技能管理 tab 才加载 skills 列表。

非 superuser 用户直接访问 `/management` 或 `/management?tab=maintenance` 时，前端应基于 `/users/me` 的 `isSuperuser=false` 展示权限错误提示，不展示维护按钮，也不为了判权请求 `/api/v1/admin/skills`。前端入口用于降低误触和确认当前操作者登录态，但不能作为安全边界。任何直接调用 API 的请求仍必须由后端基于当前认证用户执行 superuser 配置列表命中校验。后端触发前后应记录结构化日志，包含触发用户 ID、handle、接口名和同步结果，便于排查“由谁触发”。

点击“同步缺失简介”后，前端在请求 pending 期间禁用按钮，避免重复点击。收到响应后回显 `msg`；当 `failed > 0` 时仍按完成态展示统计，但使用提醒样式表达“部分失败”，避免被误读为全量成功。

不新增 `/management` 之外的独立页面，避免扩展管理路由范围。

### 决策 2：同步请求同步执行并返回统计

API 获取锁后在当前请求中完成扫描、下载、解析和更新，完成后返回统计数据。这避免新增任务表，也便于调用方明确知道本次触发是否完成。服务内部可以分批查询和处理候选记录，避免一次性加载过多 skill/version/file 元数据；分批是内部实现细节，不对外暴露分页参数或任务状态。

分批处理必须避免 `OFFSET`。因为同步过程中候选记录会从“简介为空”变为“简介非空”，`OFFSET` 会在候选集合变化时跳过记录。实现应使用 keyset 分批，例如按 `skills.id` 升序保存 `lastID`：

```sql
WHERE id > ? AND is_deleted = false AND moderation_status = 'active' AND TRIM(description) = ''
ORDER BY id
LIMIT ?
```

或者先查询候选 ID 快照，再按 ID 分批处理。

统计口径固定如下：

- `scanned`：本次查询出的候选 skill 数，即未删除、active、存在 latest version 且 `description` 为空或空白的 skill 数。
- `updated`：成功写入非空 `description` 的 skill 数。
- `skipped`：可继续处理但未更新的 skill 数，包括主说明文件缺失、frontmatter 无可用 `description`、`description` 为空、写入前条件更新影响 0 行。
- `failed`：单个 skill 处理失败但同步流程继续的数量，例如 OSS 下载失败、单个文件读取异常、单条数据库更新错误。

同步完成与锁占用都使用 HTTP 200 返回，前端直接回显 `msg`，但前端逻辑判断必须基于 `running` / `locked` 等结构化字段，不依赖 `msg`。认证失败或权限不足仍按现有认证链路返回 401/403。拿数据库连接失败、候选查询失败、锁释放前的服务初始化失败等服务级 fatal error 返回 5xx，不伪装成 `failed > 0` 的 HTTP 200。

同步使用请求 context。若浏览器关闭页面或请求被取消，后端应尽快停止后续处理并释放 advisory lock；不新增后台任务，也不保存历史状态。已完成的单条条件更新保持已提交状态，后续未处理候选记录可由下一次同步继续处理。

同步完成响应：

```json
{
  "running": false,
  "locked": false,
  "msg": "同步完成",
  "scanned": 10,
  "updated": 6,
  "skipped": 3,
  "failed": 1
}
```

并发请求如果拿不到锁，直接返回运行中状态，不返回进度和历史结果：

```json
{
  "running": true,
  "locked": true,
  "msg": "同步任务正在运行"
}
```

同步完成但 `failed > 0` 仍返回 HTTP 200 和 `msg: "同步完成"`，由统计结果表达部分失败。

### 决策 3：使用 PostgreSQL advisory lock 作为全局写锁

同步任务开始前调用 `pg_try_advisory_lock(<固定 key>)`。获取失败表示已有同步任务运行中；获取成功后使用 `defer pg_advisory_unlock(<固定 key>)` 解锁。锁 key 必须是全局固定的 int64 常量，例如 `skillDescriptionSyncLockKey`；所有实例、所有请求都必须使用同一个 key，不得按用户、请求或环境动态生成。

该锁是 PostgreSQL 会话级 advisory lock，不是行锁。实现时必须从连接池中获取一条专用数据库连接，并在同一条连接上执行 `pg_try_advisory_lock` 与 `pg_advisory_unlock`。锁持有期间不得释放该连接；释放锁后再关闭或归还连接。同步中的查询、下载和条件更新不需要包在长事务里，避免 OSS 下载拖长事务生命周期。

不使用 Go 进程内 mutex，因为多实例部署时无法跨进程互斥。不用长事务包住 OSS 下载，因为下载可能较慢，会放大数据库事务占用。

### 决策 4：只填空，不覆盖已有简介

候选 skill 查询条件应限定简介为空或空白，且更新时仍使用条件更新，例如 `WHERE id = ? AND TRIM(description) = ''`。这样即使同步期间有发布流程写入了简介，同步也不会覆盖新值。

如果最新版本主说明文件没有非空 `description`、frontmatter 解析失败或文件下载失败，系统只记录跳过或失败计数，不写入空值。

### 决策 5：复用发布链路的主说明文件规则

主说明文件选择规则与发布时保持一致：路径规范化为 `/` 分隔、去掉开头 `./` 或 `/`，大小写不敏感匹配根目录 `SKILL.md` 优先、`skills.md` 兜底；子目录同名文件不得作为简介来源。

实现时应把当前 `publish.go` 中的路径匹配与 frontmatter 解析 helper 移到可复用位置，例如 `backend/internal/skillmeta`。发布 handler 和同步 service 都依赖该 helper，避免 service 反向依赖 handler，也避免发布与同步逻辑分叉。

批量同步读取 OSS 主说明文件时必须关闭 `StorageService.Download()` 返回的 `io.ReadCloser`。读取内容应设置单文件上限，例如 1 MiB；超过上限的单个 skill 计入 `failed` 并继续处理其他候选记录，避免异常大文件放大内存风险。

## Risks / Trade-offs

- [Risk] OSS 下载失败导致回填不完整 → 对单个 skill 计入失败并继续处理其他 skill。
- [Risk] 同步过程较慢导致请求耗时较长 → 本期接受同步执行；不新增任务表。调用方可在低峰期触发。
- [Risk] 同步期间发布新版本写入简介 → 使用条件更新保证同步不覆盖已有简介。
- [Risk] 多实例并发触发 → 使用 PostgreSQL 会话级 advisory lock 跨进程互斥，并要求同一数据库连接加锁/解锁。
- [Risk] 历史文件路径不规范 → 仅按规范化后的根目录主说明文件匹配，无法匹配时跳过。
- [Risk] 前端按钮被误认为安全边界 → 后端 handler 保留 superuser 配置列表命中校验，并补充非 superuser 直接调用 API 的拒绝测试。
- [Risk] 维护 tab 误触发技能列表加载 → tab 状态驱动查询启用条件，维护 tab 下不请求 `/api/v1/admin/skills`，并补充前端测试。
- [Risk] 分批同步时跳过候选记录 → 使用 keyset 或候选 ID 快照，禁止 offset 分批。
- [Risk] 批量 OSS 读取泄露连接或占用过多内存 → 每个 reader 必须关闭，并限制单文件读取大小。
