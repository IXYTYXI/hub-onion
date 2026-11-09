## ADDED Requirements

### Requirement: superuser 配置用户触发缺失简介同步
系统 SHALL 提供一个仅 superuser 配置列表命中用户可调用的后端维护 API，用于批量同步当前缺失简介的 skills。

#### Scenario: superuser 配置用户触发批量同步
- **WHEN** 命中 superuser 配置列表的用户发送 `POST /api/v1/admin/maintenance/skill-descriptions/sync`
- **THEN** 系统 SHALL 启动面向所有候选 active skills 的缺失简介批量同步流程
- **THEN** 系统 SHALL 以 HTTP 200 返回同步完成状态、确定的 `msg` 和同步统计结果

#### Scenario: 同步接口不接受单个 skill
- **WHEN** 调用方触发缺失简介同步
- **THEN** 系统 SHALL 由服务端查询所有符合条件的候选 skills
- **THEN** 系统 MUST NOT 要求或接受单个 skill slug 来限定同步范围

#### Scenario: 非 superuser 被拒绝
- **WHEN** 非 superuser 或未认证请求访问 `POST /api/v1/admin/maintenance/skill-descriptions/sync`
- **THEN** 系统 SHALL 拒绝请求，不执行同步

#### Scenario: 记录触发用户
- **WHEN** 命中 superuser 配置列表的用户触发 `POST /api/v1/admin/maintenance/skill-descriptions/sync`
- **THEN** 系统 SHALL 记录结构化日志，包含触发用户标识和同步执行结果

### Requirement: 管理后台提供同步入口
系统 SHALL 在现有 `/management` 管理后台提供缺失简介同步的显式触发入口。

#### Scenario: 管理后台 tab 使用 URL 状态
- **WHEN** 用户访问 `/management` 或 `/management?tab=skills`
- **THEN** 前端 SHALL 展示技能管理 tab
- **WHEN** 用户访问 `/management?tab=maintenance`
- **THEN** 前端 SHALL 展示维护任务 tab
- **WHEN** 用户访问带非法 `tab` 值的 `/management`
- **THEN** 前端 SHALL 按 `tab=skills` 处理

#### Scenario: superuser 配置用户查看维护入口
- **WHEN** 已登录且命中 superuser 配置列表的用户访问 `/management`
- **THEN** 系统 SHALL 展示维护任务 tab
- **THEN** 系统 SHALL 在维护任务 tab 中展示“同步缺失简介”触发按钮

#### Scenario: 非 superuser 不展示维护入口
- **WHEN** 非 superuser 用户访问 `/management`
- **THEN** 前端 SHALL 基于 `/users/me` 的 `isSuperuser=false` 展示权限错误提示
- **THEN** 系统 MUST 不展示缺失简介同步触发按钮
- **THEN** 前端 MUST NOT 为了判权请求 `/api/v1/admin/skills`

#### Scenario: 非 superuser 直接访问维护 tab
- **WHEN** 非 superuser 用户访问 `/management?tab=maintenance`
- **THEN** 前端 SHALL 展示权限错误提示
- **THEN** 系统 MUST 不展示缺失简介同步触发按钮
- **THEN** 前端 MUST NOT 请求 `/api/v1/admin/skills`

#### Scenario: 维护 tab 不加载技能列表
- **WHEN** 已登录且命中 superuser 配置列表的用户打开 `/management` 的维护任务 tab
- **THEN** 前端 MUST NOT 为维护任务 tab 请求 `/api/v1/admin/skills`
- **THEN** 前端 SHALL 只在技能管理 tab 需要展示列表时请求 `/api/v1/admin/skills`

#### Scenario: 通过管理后台触发同步
- **WHEN** 命中 superuser 配置列表的用户在 `/management` 点击“同步缺失简介”按钮
- **THEN** 前端 SHALL 调用 `POST /api/v1/admin/maintenance/skill-descriptions/sync`
- **THEN** 前端 SHALL 回显接口返回的 `msg`
- **THEN** 前端 SHALL 展示同步完成统计结果，或在接口返回锁占用时展示正在运行状态

#### Scenario: 前端入口不替代后端鉴权
- **WHEN** 任意调用方绕过 `/management` 直接请求 `POST /api/v1/admin/maintenance/skill-descriptions/sync`
- **THEN** 系统 SHALL 仍基于当前认证用户执行 superuser 配置列表命中校验
- **THEN** 非 superuser 或未认证请求 MUST 被拒绝且不得执行同步

### Requirement: 同步范围仅包含缺失简介的 active skill
系统 SHALL 只处理当前数据库简介为空或空白的 active skill。

#### Scenario: 只扫描缺失简介记录
- **WHEN** 系统执行简介同步
- **THEN** 系统 SHALL 只选择 `is_deleted = false`、`moderation_status = 'active'`、存在最新版本且 `description` 为空或空白的 skill

#### Scenario: 已有简介不参与更新
- **WHEN** 某个 skill 的 `skills.description` 已有非空内容
- **THEN** 系统 MUST 不更新该 skill 的简介
- **THEN** 系统 MUST 不使用文件中的空值或新值覆盖已有简介

#### Scenario: 内部分批处理候选记录
- **WHEN** 候选 skills 数量较多
- **THEN** 系统 MAY 在服务内部按批次查询和处理候选记录
- **THEN** 系统 MUST NOT 对外暴露分页参数、任务 ID 或历史任务状态

#### Scenario: 分批处理不得因候选集合变化跳过记录
- **WHEN** 系统在同步过程中分批处理候选 skills
- **THEN** 系统 SHALL 使用 keyset 分批或候选 ID 快照
- **THEN** 系统 MUST NOT 使用基于 `OFFSET` 的候选分页

### Requirement: 从最新版本主说明文件提取简介
系统 SHALL 从 skill 最新版本的根目录主说明文件中提取 frontmatter `description` 作为回填简介。

#### Scenario: 主说明文件匹配规则
- **WHEN** 系统查找用于简介同步的主说明文件
- **THEN** 系统 SHALL 将文件路径规范化为 `/` 分隔并移除开头的 `./` 或 `/`
- **THEN** 系统 SHALL 以大小写不敏感方式只匹配根目录 `SKILL.md` 或 `skills.md`
- **THEN** 系统 SHALL 优先使用 `SKILL.md`，没有可用 `SKILL.md` 时再使用 `skills.md`
- **THEN** 系统 MUST 不使用子目录中的同名文件作为简介来源

#### Scenario: 提取非空 description
- **WHEN** 主说明文件 frontmatter 包含非空字符串 `description`
- **THEN** 系统 SHALL 将该值作为候选简介

#### Scenario: 缺少可用 description
- **WHEN** 主说明文件缺失、frontmatter 无法解析、`description` 缺失或 `description` 为空
- **THEN** 系统 MUST 不写入空简介
- **THEN** 系统 SHALL 跳过该 skill 并继续处理其他 skill

#### Scenario: 主说明文件读取资源释放
- **WHEN** 系统通过 `StorageService.Download()` 读取主说明文件
- **THEN** 系统 SHALL 在读取完成或出错后关闭返回的 reader

#### Scenario: 主说明文件读取大小限制
- **WHEN** 主说明文件内容超过单文件读取上限
- **THEN** 系统 SHALL 停止读取该文件
- **THEN** 系统 SHALL 将该 skill 计入 `failed`
- **THEN** 系统 SHALL 继续处理其他候选 skill

#### Scenario: 发布和同步复用简介解析规则
- **WHEN** 发布链路和同步链路提取主说明文件中的 `description`
- **THEN** 两条链路 SHALL 使用同一套路径匹配和 frontmatter 解析 helper
- **THEN** 同步 service MUST NOT 依赖 handler package 中的 helper

### Requirement: 同步不得覆盖已有简介
系统 SHALL 在写入时再次确认数据库当前简介仍为空或空白，以防止并发更新覆盖已有简介。

#### Scenario: 条件更新成功
- **WHEN** 系统提取到非空简介，且数据库中该 skill 的 `description` 仍为空或空白
- **THEN** 系统 SHALL 将提取到的简介写入 `skills.description`

#### Scenario: 同步期间已有简介被写入
- **WHEN** 系统提取到非空简介，但写入前该 skill 的 `description` 已变为非空
- **THEN** 系统 MUST 不覆盖该 skill 的现有简介
- **THEN** 系统 SHALL 将该 skill 视为未更新

### Requirement: 同步运行全局互斥
系统 SHALL 使用数据库级全局写锁防止多个简介同步任务并发运行。

#### Scenario: 获取锁后执行同步
- **WHEN** 系统触发简介同步且当前没有同步任务运行
- **THEN** 系统 SHALL 获取全局写锁并执行同步
- **THEN** 系统 SHALL 在同步完成或出错返回前释放写锁

#### Scenario: 使用同一数据库连接加锁和解锁
- **WHEN** 系统使用 PostgreSQL advisory lock 控制同步互斥
- **THEN** 系统 SHALL 使用会话级 advisory lock，而不是行锁
- **THEN** 系统 SHALL 在同一条数据库连接上执行加锁和解锁
- **THEN** 系统 MUST NOT 在释放锁之前释放或归还持锁连接

#### Scenario: 使用固定 advisory lock key
- **WHEN** 系统获取同步互斥锁
- **THEN** 系统 SHALL 使用全局固定的 int64 advisory lock key
- **THEN** 系统 MUST NOT 按用户、请求或实例动态生成 lock key

#### Scenario: 请求取消时释放锁
- **WHEN** 同步请求的 context 被取消
- **THEN** 系统 SHALL 尽快停止后续候选处理
- **THEN** 系统 SHALL 释放已获取的 advisory lock
- **THEN** 系统 SHALL 不创建后台任务或历史任务状态

#### Scenario: 锁已被占用
- **WHEN** 系统触发简介同步但已有同步任务正在运行
- **THEN** 系统 SHALL 不启动新的同步任务
- **THEN** 系统 SHALL 以 HTTP 200 返回运行中状态、确定的 `msg`，例如 `running: true` 和 `locked: true`

### Requirement: 同步响应表达执行状态
系统 SHALL 返回调用方可判断的同步执行状态。

#### Scenario: 同步完成响应
- **WHEN** 简介同步正常完成
- **THEN** 系统 SHALL 返回 HTTP 200
- **THEN** 系统 SHALL 返回 `running: false`
- **THEN** 系统 SHALL 返回 `locked: false`
- **THEN** 系统 SHALL 返回 `msg: "同步完成"`
- **THEN** 系统 SHALL 返回至少包含 `scanned`、`updated`、`skipped` 和 `failed` 的统计信息

#### Scenario: 统计口径
- **WHEN** 系统返回同步统计
- **THEN** `scanned` SHALL 表示本次查询出的候选 skill 数
- **THEN** `updated` SHALL 表示成功写入非空 `description` 的 skill 数
- **THEN** `skipped` SHALL 表示可继续处理但未更新的 skill 数，包括主说明文件缺失、无可用 `description`、空 `description`、写入前条件更新影响 0 行
- **THEN** `failed` SHALL 表示单个 skill 处理失败但同步流程继续的数量，包括 OSS 下载失败、单个文件读取异常或单条数据库更新错误

#### Scenario: 部分失败仍返回完成状态
- **WHEN** 同步流程完成且存在单个 skill 处理失败
- **THEN** 系统 SHALL 返回 HTTP 200
- **THEN** 系统 SHALL 返回 `msg: "同步完成"`
- **THEN** 系统 SHALL 通过 `failed > 0` 表达部分失败

#### Scenario: 同步运行中响应
- **WHEN** 因锁占用无法启动新的同步任务
- **THEN** 系统 SHALL 返回 HTTP 200
- **THEN** 系统 SHALL 返回 `running: true`
- **THEN** 系统 SHALL 返回 `locked: true`
- **THEN** 系统 SHALL 返回 `msg: "同步任务正在运行"`
- **THEN** 系统 MUST 不要求调用方等待当前请求直到锁释放

#### Scenario: 服务级 fatal error
- **WHEN** 系统获取数据库连接失败、候选查询失败或同步服务初始化失败
- **THEN** 系统 SHALL 返回 5xx 错误
- **THEN** 系统 MUST NOT 将服务级 fatal error 包装为 HTTP 200 的 `failed` 统计

#### Scenario: 前端使用结构化字段判断状态
- **WHEN** 前端收到同步响应
- **THEN** 前端 SHALL 回显 `msg`
- **THEN** 前端 MUST 使用 `running` 和 `locked` 判断执行状态，而不是依赖 `msg` 文案判断逻辑

#### Scenario: 前端防止重复触发
- **WHEN** superuser 配置用户点击“同步缺失简介”按钮后请求仍在进行中
- **THEN** 前端 SHALL 禁用该按钮
- **THEN** 前端 SHALL 在请求完成或失败后恢复按钮可用状态

#### Scenario: 前端展示部分失败
- **WHEN** 同步响应中 `failed > 0`
- **THEN** 前端 SHALL 展示同步统计
- **THEN** 前端 SHALL 使用提醒样式提示存在部分失败
