## Why

历史已发布的 skill 中有一部分没有写入 `skills.description`，导致列表、详情和搜索响应里的 `summary` 为空，前端继续展示“暂无简介。”。当前发布链路已经能从新版本主说明文件提取简介，但历史数据仍需要一个可控的后端回填入口。

## What Changes

- 新增一个仅 superuser 配置列表命中的用户可调用的后端维护 API `POST /api/v1/admin/maintenance/skill-descriptions/sync`，用于批量扫描当前缺失简介的 active skills。
- API 从每个 skill 的最新版本文件中读取根目录 `SKILL.md` 或 `skills.md`，提取 frontmatter 中的非空 `description` 并写入 `skills.description`。
- 该 API 是面向全量候选 skills 的批量维护入口，不接受单个 skill slug，也不基于单个 skill 执行同步。
- 回填只填补数据库简介为空的 skill；如果数据库已有简介，即使文件内容为空或有其他值，也不得覆盖。
- 回填运行期间使用 PostgreSQL 会话级 advisory lock 防止并发执行；并发请求以 HTTP 200 返回确定的 `msg` 和“正在运行”状态，不排队、不重复执行。
- 不新增独立前端页面；在现有 `/management` 管理后台新增维护 tab 和触发按钮，通过 `/management?tab=skills|maintenance` 表达当前 tab，作为登录态与 superuser 配置命中可见性检查后的显式操作入口；维护 tab 不加载 skills 列表。
- 同步统计口径固定为 `scanned`、`updated`、`skipped`、`failed`；锁占用和正常完成使用 HTTP 200，认证/权限失败和服务级 fatal error 使用对应错误状态。
- 同步服务使用 keyset 分批处理候选记录，不使用 offset；主说明文件读取必须关闭 reader，并限制单文件读取大小，避免批量任务放大资源风险。
- 发布链路与同步链路共用同一套主说明文件路径匹配和 frontmatter `description` 解析 helper，避免规则分叉。
- 前端触发按钮在请求期间禁用；同步完成但 `failed > 0` 时展示部分失败提示。
- 不新增数据库字段，不改变列表、详情、搜索 API 的响应结构。

## Capabilities

### New Capabilities

- `skill-description-sync`: 定义 skill 简介缺失时的后端回填 API、提取规则、非覆盖语义和并发锁行为。

### Modified Capabilities

- 无。

## Impact

- 后端：新增维护 API handler、简介同步服务逻辑、frontmatter/path 解析 helper 复用、PostgreSQL 会话级 advisory lock 并发控制、请求取消处理、触发用户结构化日志。
- 前端：在 `/management` 管理后台新增 `skills` 与 `maintenance` tab，默认 `skills`，维护 tab 中展示“同步缺失简介”按钮，仅登录且命中 superuser 配置列表的用户可见，不加载 skills 列表，调用维护 API 并展示执行状态与统计结果。
- 数据库：不新增字段；只对 `skills.description` 为空的记录执行条件更新。
- 存储：通过现有 OSS `StorageService.Download` 读取最新版本中的主说明文件。
- 测试：补充 service/helper 单元测试、维护 API 权限测试、锁占用返回状态测试、管理后台触发入口测试。
