## MODIFIED Requirements

### Requirement: 用户相关路由注册
系统 SHALL 注册用户资料、token 管理和用户审核管理路由。

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
  - `GET /api/v1/admin/users` — 查询用户审核列表（仅超级用户）
  - `GET /api/v1/admin/users/:id` — 查询单个用户审核详情（仅超级用户）
  - `POST /api/v1/admin/users/:id/approve` — 批准用户（仅超级用户）
  - `POST /api/v1/admin/users/:id/reject` — 拒绝用户（仅超级用户）
  - `POST /api/v1/admin/users/:id/disable` — 停用用户（仅超级用户）
  - `POST /api/v1/admin/users/:id/enable` — 重新启用用户（仅超级用户）

### Requirement: 配置管理
系统应实现灵活的配置管理机制。

#### 场景：环境变量配置
- **当** 读取配置时
- **则** 系统应支持从环境变量读取（如 DATABASE_URL、CDN_API_KEY、SERVER_PORT）

#### 场景：配置文件
- **当** 读取配置时
- **则** 系统应支持从配置文件读取（如 config.yaml、config.json）

#### 场景：配置优先级
- **当** 多个配置源存在时
- **则** 系统应遵循优先级：环境变量 > 配置文件 > 默认值

#### 场景：超级用户配置
- **当** 系统加载认证相关配置
- **则** 系统 SHALL 支持加载超级用户列表配置，并允许通过 `user_id`、`email`、`handle` 任一字段精确匹配超级用户
