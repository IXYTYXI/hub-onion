## MODIFIED Requirements

### Requirement: 前端配置管理
系统 SHALL 提供前端 API 配置，并只消费当前 Go 后端运行面支持的主环境变量。

#### Scenario: API 路径配置
- **WHEN** 应用启动且设置了 `VITE_API_BASE`
- **THEN** 系统 SHALL 使用 `VITE_API_BASE` 作为浏览器请求 API 的基础路径

#### Scenario: API origin 配置
- **WHEN** 应用启动且未设置 `VITE_API_BASE`，但设置了 `VITE_API_ORIGIN`
- **THEN** 系统 SHALL 使用 `${VITE_API_ORIGIN}/api/v1` 作为 API 基础 URL

#### Scenario: 开发环境配置
- **WHEN** 在开发环境运行且未设置 API 相关环境变量
- **THEN** API 基础 URL SHALL 默认为 `/api/v1`，并通过开发服务器或前端 server proxy 转发到后端

#### Scenario: 前端 server runtime 回退
- **WHEN** 前端 server runtime 需要解析后端 origin
- **THEN** 系统 SHALL 支持从 `API_ORIGIN` 或 `BACKEND_URL` 读取后端 origin

#### Scenario: 认证导航配置
- **WHEN** 浏览器需要发起 OAuth 导航，且设置了 `VITE_AUTH_BASE_URL`
- **THEN** 系统 SHALL 使用 `VITE_AUTH_BASE_URL` 构造认证导航地址

#### Scenario: 移除旧 API 配置别名
- **WHEN** 运行当前前端代码
- **THEN** 系统 SHALL NOT 读取 `VITE_API_BASE_URL`、`VITE_BACKEND_BASE` 或 `VITE_CONVEX_SITE_URL` 作为 API 配置回退
