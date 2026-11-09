## MODIFIED Requirements

### Requirement: superuser management skill 场景
系统 SHALL 在 `Management` 后台中仅提供 `Skills` 场景作为前端可见的全站 skill 管理入口，并支持对 skill 的精选状态进行运营配置；同时 SHALL 按定案口径展示创建时间、提交时间与最近更新时间，并支持按时间排序、按创建/提交时间双口径范围筛选与 CSV 导出。

#### Scenario: 访问 management skills 场景
- **WHEN** superuser 进入 `Management`
- **THEN** 系统 SHALL 默认展示 `Skills` 场景，并支持查看全站 skill 列表以及按 skill 名称、slug、owner 等字段搜索
- **THEN** 每条 skill SHALL 展示可读的「创建时间」（`createdAt`）、「提交时间」（`latestVersion.createdAt`，无版本则空或「—」）与「最近更新时间」（`updatedAt`）
- **THEN** 若存在最新版本，SHALL 展示版本号

#### Scenario: 非 superuser 访问 management skills 场景
- **WHEN** 非 superuser 用户访问 `Management` 的 `Skills` 场景
- **THEN** 系统 SHALL 返回无权限提示

#### Scenario: superuser 查看精选状态
- **WHEN** superuser 在 `Management` 中查看某个 skill
- **THEN** 系统 SHALL 显示该 skill 当前是否处于 `highlighted` 状态

#### Scenario: superuser 查看作者邮箱
- **WHEN** superuser 在 `Management` 的 skill 列表中查看作者栏
- **THEN** 系统 SHALL 优先展示该 skill 作者已获取的飞书授权邮箱，而不是 UID 风格标识

#### Scenario: 作者邮箱缺失时回退
- **WHEN** `owner.email` 缺失
- **THEN** 系统 SHALL 回退展示 `owner.handle` 或既有可读字段，而不得直接优先显示内部 UID

#### Scenario: superuser 设为精选
- **WHEN** superuser 在 `Management` 中将某个 skill 设为精选
- **THEN** 系统 SHALL 持久化该 skill 的 `highlighted` 状态，并使首页精选区块和精选筛选可见该变化

#### Scenario: superuser 取消精选
- **WHEN** superuser 在 `Management` 中取消某个 skill 的精选状态
- **THEN** 系统 SHALL 清除该 skill 的 `highlighted` 状态，并使首页精选区块和精选筛选不再包含该 skill

#### Scenario: 按时间排序
- **WHEN** superuser 在 Skills 场景选择按创建时间、提交时间或最近更新时间排序
- **THEN** 前端 SHALL 携带对应 `sort`（`created_at`/`submitted_at`/`updated_at`）与 `dir` 重新请求管理列表 API，并按返回顺序渲染

#### Scenario: 按创建或提交时间范围筛选
- **WHEN** superuser 选择时间口径（创建时间或提交时间）并设置起止范围
- **THEN** 前端 SHALL 将口径编码为 `timeField=created_at|submitted_at`，将日期控件编码为 `YYYY-MM-DD`（或带时区 RFC3339），作为 `createdFrom`/`createdTo` 请求管理列表 API，并只展示匹配结果

#### Scenario: 导出 CSV
- **WHEN** superuser 点击导出
- **THEN** 前端 SHALL 使用当前筛选（含 `timeField`）、排序条件请求管理导出接口，并触发 CSV 下载
- **THEN** 前端 MUST NOT 将后端中文表头改写为英文

## ADDED Requirements

### Requirement: 管理面时间展示格式
系统 SHALL 在管理后台以本地可读时间展示 skill 时间字段，并正确处理 Unix 秒时间戳。

#### Scenario: Unix 秒转换
- **WHEN** API 返回的 `createdAt`/`updatedAt`/`latestVersion.createdAt` 为 Unix 秒
- **THEN** 前端 SHALL 转换为毫秒后再格式化为本地可读时间，不得把秒直接当作毫秒传入 `Date`

### Requirement: owner 我的 skill 列表展示提交时间
系统 SHALL 在 `/my/skills` 列表中按定案口径展示每个 skill 的提交时间（及宜展示创建时间）；本需求 MUST NOT 在 `/my/skills` 提供导出能力。

#### Scenario: 我的 skill 列表可见提交时间
- **WHEN** 已登录 owner 访问 `/my/skills`
- **THEN** 前端 SHALL 展示每条 skill 的提交时间（`latestVersion.createdAt`；无版本则空或「—」），时间戳按 Unix 秒正确转换为可读本地时间
- **THEN** 前端宜同时展示创建时间（`createdAt`）

#### Scenario: 我的 skill 列表不做导出
- **WHEN** 已登录 owner 访问 `/my/skills`
- **THEN** 前端 MUST NOT 提供 skill 目录 CSV 导出入口
