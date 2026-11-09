## MODIFIED Requirements

### Requirement: 注册表信息
系统 SHALL 在 well-known 响应中提供可被 CLI 直接消费的注册表元数据。

#### Scenario: apiBase 字段（必需）
- **当** 返回 well-known 响应时
- **则** 系统应包含 `apiBase` 字段，带有完整的 API 基础 URL（如 `https://domain.com/api/v1`）

#### Scenario: authBase 字段（私有 CLI 推荐）
- **当** 私有部署希望支持基于浏览器的 CLI 登录流程时
- **则** 系统应包含 `authBase` 字段，用于指向 CLI 登录和认证相关页面所在的站点基础 URL

#### Scenario: minCliVersion 字段（可选）
- **当** 返回 well-known 响应时
- **则** 系统可包含 `minCliVersion` 字段指定最低 CLI 版本要求

### Requirement: CLI 兼容性
系统 SHALL 确保 well-known 响应格式可被公共 `clawhub` 与私有品牌 CLI（如 `yclawhub`）一致解析。

#### Scenario: 响应格式验证
- **当** CLI 获取 well-known 端点时
- **则** 响应应符合 `packages/schema` 中定义的预期 schema，并允许客户端解析 `apiBase`、`authBase` 和最低版本信息

#### Scenario: 私有部署发现信息完整
- **当** 私有站点被 `yclawhub` 作为某个激活环境使用时
- **则** well-known 响应应足以让 CLI 在不依赖公共默认站点的前提下完成 API 发现和登录入口解析
