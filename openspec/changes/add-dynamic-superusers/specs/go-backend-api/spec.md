## MODIFIED Requirements

### Requirement: 用户相关路由注册
系统 SHALL 注册用户资料、token 管理、用户审核管理路由、动态 superuser 名册路由，以及 owner/self 与 superuser 场景下的 skill 管理路由。

#### Scenario: 路由列表
- **WHEN** 系统启动
- **THEN** 系统 SHALL 注册以下路由：
  - `GET /api/v1/users/me` — 获取当前用户（需认证）
  - `GET /api/v1/users/:handle` — 获取用户公开资料
  - `GET /api/v1/users/:handle/skills` — 获取用户 skill 列表
  - `GET /api/v1/users/me/stars` — 获取当前用户收藏（需认证）
  - `POST /api/v1/skills/:slug/star` — 收藏 skill（需认证）
  - `DELETE /api/v1/skills/:slug/star` — 取消收藏（需认证）
  - `GET /api/v1/users/me/tokens` — 获取 CLI token 列表（需认证）
  - `POST /api/v1/users/me/tokens` — 创建 CLI token（需认证）
  - `DELETE /api/v1/users/me/tokens/:id` — 撤销 CLI token（需认证）
  - `GET /api/v1/my/skills` — 获取当前用户的 skill 管理列表（需认证）
  - `GET /api/v1/my/skills/:slug` — 获取当前用户单个 skill 的管理详情（需认证）
  - `GET /api/v1/admin/users` — 查询用户审核列表（仅超级用户）
  - `GET /api/v1/admin/users/:id` — 查询单个用户审核详情（仅超级用户）
  - `POST /api/v1/admin/users/:id/approve` — 批准用户（仅超级用户）
  - `POST /api/v1/admin/users/:id/reject` — 拒绝用户（仅超级用户）
  - `POST /api/v1/admin/users/:id/disable` — 停用用户（仅超级用户）
  - `POST /api/v1/admin/users/:id/enable` — 重新启用用户（仅超级用户）
  - `GET /api/v1/admin/superusers` — 查询配置与动态 superuser 名册（仅超级用户）
  - `POST /api/v1/admin/superusers` — 新增动态 superuser（仅超级用户）
  - `DELETE /api/v1/admin/superusers?email={email}` — 按飞书邮箱删除动态 superuser（仅超级用户）
  - `POST /api/v1/admin/superusers/sync-cache` — 从数据库主动同步 superuser 判定缓存（仅超级用户）
  - `GET /api/v1/admin/skills` — 查询全站 skill 管理列表（仅超级用户）
  - `GET /api/v1/admin/skills/:slug` — 查询单个 skill 管理详情（仅超级用户）
  - `POST /api/v1/admin/skills/:slug/delete` — 删除任意 skill（仅超级用户）
  - `POST /api/v1/admin/skills/:slug/undelete` — 恢复任意 skill（仅超级用户）

## ADDED Requirements

### Requirement: superuser 名册管理接口
系统 SHALL 提供仅 superuser 可访问的动态 superuser 名册管理接口。

#### Scenario: 查询 superuser 名册
- **WHEN** superuser 请求 `GET /api/v1/admin/superusers`
- **THEN** 系统 SHALL 返回配置文件中的只读 superuser 和数据库中的动态 superuser
- **THEN** 系统 MUST NOT 将内存判定集合作为动态列表的数据源

#### Scenario: 创建动态 superuser
- **WHEN** superuser 请求 `POST /api/v1/admin/superusers` 并提交有效邮箱
- **THEN** 系统 SHALL 创建固定 provider 为 `feishu` 的动态授权
- **THEN** 系统 SHALL 在数据库创建成功后同步更新内存判定集合
- **THEN** 系统 SHALL 返回创建后的动态授权

#### Scenario: 创建已配置 superuser 被拒绝
- **WHEN** superuser 请求 `POST /api/v1/admin/superusers` 并提交已存在于配置文件中的邮箱
- **THEN** 系统 SHALL 返回 400 或 409 等稳定错误
- **THEN** 系统 MUST NOT 创建动态授权

#### Scenario: 删除动态 superuser
- **WHEN** superuser 请求 `DELETE /api/v1/admin/superusers?email={email}`
- **THEN** 系统 SHALL 删除对应动态授权
- **THEN** 系统 SHALL 使用规范化飞书邮箱作为删除条件
- **THEN** 系统 MUST NOT 使用用户 ID 作为删除条件
- **THEN** 系统 SHALL 在数据库删除成功后同步更新内存判定集合

#### Scenario: 删除配置 superuser 被拒绝
- **WHEN** superuser 请求 `DELETE /api/v1/admin/superusers?email={email}` 并且该邮箱只来自配置文件
- **THEN** 系统 SHALL 返回 400 或 409 等稳定错误
- **THEN** 系统 MUST NOT 修改配置来源或内存中的配置邮箱

#### Scenario: 同步 superuser 判定缓存
- **WHEN** superuser 请求 `POST /api/v1/admin/superusers/sync-cache`
- **THEN** 系统 SHALL 从配置快照和数据库动态授权重新构建内存判定集合
- **THEN** 系统 SHALL 返回同步结果
- **THEN** 系统 MUST NOT 修改数据库动态授权
- **THEN** 同步请求的授权 SHALL 基于请求开始时的当前 superuser 判定结果

#### Scenario: 非 superuser 被拒绝
- **WHEN** 非 superuser 请求任何 superuser 名册管理接口
- **THEN** 系统 SHALL 返回 403 Forbidden
