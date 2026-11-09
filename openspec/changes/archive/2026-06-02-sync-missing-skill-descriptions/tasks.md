## 1. 简介同步核心逻辑

- [x] 1.1 将发布链路中的主说明文件路径匹配和 frontmatter `description` 解析逻辑提取到后端可复用 helper（例如 `backend/internal/skillmeta`），并保持现有发布测试通过
- [x] 1.2 新增缺失简介 skill 查询逻辑，仅选择未删除、active、存在 latest version 且 `description` 为空或空白的记录
- [x] 1.3 实现从 latest version 文件元数据中选择根目录 `SKILL.md` 优先、`skills.md` 兜底的主说明文件，并通过 `StorageService.Download` 读取内容
- [x] 1.4 实现同步服务：提取非空简介后使用条件更新写入 `skills.description`，并按固定口径统计 scanned、updated、skipped、failed
- [x] 1.5 支持服务内部按批次查询和处理候选记录，使用 keyset 或候选 ID 快照，禁止使用 offset，不对外暴露分页参数、任务 ID 或历史任务状态
- [x] 1.6 读取 OSS 主说明文件后必须关闭 reader，并限制单文件读取大小（例如 1 MiB），超限计入 failed 后继续处理其他候选记录

## 2. 维护 API 与并发锁

- [x] 2.1 实现 PostgreSQL 会话级 advisory lock 获取与释放逻辑，使用全局固定 int64 lock key，必须在同一条数据库连接上加锁和解锁，锁已占用时不得启动新的同步任务
- [x] 2.2 新增 `POST /api/v1/admin/maintenance/skill-descriptions/sync` handler，沿用认证链路并校验当前用户命中 superuser 配置列表
- [x] 2.3 确认同步 API 是批量维护入口，不接受单个 skill slug，候选范围由服务端查询所有缺失简介且满足条件的 active skills 决定
- [x] 2.4 API 在锁占用时以 HTTP 200 返回 `running: true`、`locked: true`、`msg: "同步任务正在运行"`；正常完成时以 HTTP 200 返回 `running: false`、`locked: false`、`msg: "同步完成"` 和同步统计
- [x] 2.5 明确响应边界：认证/权限失败返回 401/403，服务级 fatal error 返回 5xx，单个 skill 处理失败计入 `failed` 且整体完成时仍返回 HTTP 200
- [x] 2.6 同步使用请求 context；请求取消时尽快停止后续候选处理、释放 advisory lock，不创建后台任务或历史任务状态
- [x] 2.7 在后端路由中注册同步 API，并记录触发用户与同步结果的结构化日志

## 3. 管理后台入口

- [x] 3.1 在 `/management` 新增 `skills` 与 `maintenance` tab，URL 使用 `tab=skills|maintenance`，未提供或非法 `tab` 默认 `skills`
- [x] 3.2 保留现有技能管理能力，并仅在 `tab=skills` 时加载 skills 列表
- [x] 3.3 在维护任务 tab 中新增“同步缺失简介”按钮，仅登录且命中 superuser 配置列表的用户可见
- [x] 3.4 非 superuser 访问 `/management` 或 `/management?tab=maintenance` 时基于 `/users/me` 展示权限错误，不展示按钮，且不为了判权请求 `/api/v1/admin/skills`
- [x] 3.5 点击按钮时调用 `POST /api/v1/admin/maintenance/skill-descriptions/sync`，并处理成功、403、运行中和失败状态
- [x] 3.6 请求 pending 期间禁用“同步缺失简介”按钮，请求完成或失败后恢复可用
- [x] 3.7 回显接口返回的 `msg`，使用 `running`/`locked` 判断状态，展示同步统计结果；锁占用时展示正在运行提示；`failed > 0` 时使用提醒样式提示部分失败

## 4. 测试与验证

- [x] 4.1 补充 helper 单元测试，覆盖根目录匹配、大小写不敏感、子目录同名文件跳过、空简介不返回，并确认发布与同步共用同一 helper
- [x] 4.2 补充同步服务测试，覆盖缺失简介成功回填、已有简介不覆盖、文件简介为空不更新、OSS 下载失败计入 failed 并继续处理、条件更新 0 行计入 skipped、统计口径正确
- [x] 4.3 补充同步服务资源测试或实现验证，覆盖 reader 关闭、单文件读取超限计入 failed、分批处理不使用 offset
- [x] 4.4 补充维护 API 测试，覆盖 superuser 配置用户可触发、非 superuser 被拒绝、接口不接受单个 skill slug、直接绕过前端调用仍需鉴权、锁占用时 HTTP 200 返回运行中状态与确定 `msg`、服务级 fatal error 返回 5xx、请求取消释放锁
- [x] 4.5 补充 advisory lock 测试或实现验证，确认固定 lock key、同一数据库连接加锁/解锁且释放锁前不归还持锁连接
- [x] 4.6 补充管理后台测试，覆盖 `tab=skills|maintenance` URL 状态、非法 tab 默认 skills、superuser 配置用户可见维护 tab 与按钮、非 superuser 展示权限错误、维护 tab 不请求 `/admin/skills`、pending 禁用按钮、点击后回显 `msg` 并展示统计或运行中状态、`failed > 0` 展示部分失败提示
- [x] 4.7 运行 `openspec validate sync-missing-skill-descriptions --strict`
- [x] 4.8 运行相关 Go 与前端测试，确认无新增回归
