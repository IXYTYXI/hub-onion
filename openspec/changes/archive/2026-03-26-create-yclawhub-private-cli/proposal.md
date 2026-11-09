## Why

当前 `clawhub` CLI 默认面向公共站点 `clawhub.ai`，配置模型也是单一 registry/token，会导致私有部署场景下的登录、默认站点选择、本地状态隔离和多环境切换体验都不稳定。团队需要一个长期独立维护的 `yclawhub` CLI 产品线，在完整复刻现有 `clawhub` 能力的前提下，默认服务多个私有环境，并与公共 `clawhub` 安装和运行状态完全隔离。

## What Changes

- 新增独立 CLI 产品线 `yclawhub`，作为与 `clawhub` 分离的 npm 包、可执行命令、帮助文案和品牌入口。
- 完整复刻当前 `clawhub` 的命令能力与默认行为，包括认证、查询、安装、更新、发布、删除、收藏、同步和管理命令。
- 新增多私有环境模型，支持保存、切换和查看多个私有站点的 `site`、`registry`、`authBase` 与 token。
- 新增独立配置空间、环境变量前缀和本地状态命名，确保 `yclawhub` 与 `clawhub` 同机共存且互不污染。
- 约束 `yclawhub` 的默认解析优先级围绕“当前激活环境”展开，而不是回退到 `clawhub.ai`。
- 明确 `yclawhub` 依赖的私有站点发现与认证前提，包括 well-known、browser auth、CLI token 和 whoami 兼容性。

## Capabilities

### New Capabilities
- `yclawhub-cli-product`: 定义 `yclawhub` 的独立分发、品牌化入口、命令对等能力、默认行为和与 `clawhub` 的隔离边界。
- `yclawhub-environment-management`: 定义 `yclawhub` 的多私有环境配置模型、激活环境、解析优先级、环境命令和 token 绑定规则。

### Modified Capabilities
- `registry-discovery`: 扩展私有站点发现约束，使 `yclawhub` 可基于激活环境消费 well-known 的 `apiBase`、`authBase` 和版本门槛信息。

## Impact

- `packages/clawdhub/` 的命令结构、配置模块、registry 解析、认证流和本地状态逻辑需要被抽取或复用，以支撑独立的 `yclawhub` 发行入口。
- npm 分发与安装文档需要支持新的私有包，例如 `@your-org/yclawhub`。
- 私有站点需要继续提供 `/.well-known/clawhub.json`、`/cli/auth`、CLI token 创建接口和 `whoami` 兼容接口，供 `yclawhub` 登录与校验使用。
- 本地配置、环境变量、锁文件/来源元数据策略需要重新定义，避免污染现有 `clawhub` 用户数据。
