## 1. 共享核心与入口骨架

- [x] 1.1 盘点 `packages/clawdhub` 的命令、默认行为、配置模块和本地状态读写点，形成 `yclawhub` 复刻能力矩阵
- [x] 1.2 抽离可共享的 CLI 核心模块（HTTP client、schema、文件扫描、publish/install/update/sync 公共逻辑），避免直接复制整包
- [x] 1.3 新建 `yclawhub` 独立包入口，配置新的 npm 包名、bin 命令名、帮助文案和版本信息

## 2. 隔离命名空间与本地状态

- [x] 2.1 为 `yclawhub` 实现独立全局配置路径、token 存储和独立环境变量前缀，确保不读取或覆盖 `clawhub` 默认配置
- [x] 2.2 为 `yclawhub` 定义独立工作区元数据目录与文件格式，替换 `.clawhub` 锁文件和来源元数据写入路径
- [x] 2.3 明确 `yclawhub` 对旧 `.clawhub` 状态的兼容/迁移策略，并落实到读取或迁移实现中

## 3. 多私有环境模型

- [x] 3.1 设计并实现 `yclawhub` 的多环境配置结构，支持保存 `name/site/registry/authBase/token/lastUsedAt/isDefault`
- [x] 3.2 实现激活环境解析优先级：显式参数 > 激活环境 > `YCLAWHUB_*` 环境变量 > 内置默认值
- [x] 3.3 实现环境管理命令，至少覆盖 `env list`、`env add`、`env use`、`env current`、`env remove`
- [x] 3.4 将登录态与具体环境绑定，确保切换环境后 `whoami`、`publish`、`delete` 等命令只使用对应环境的 token

## 4. 命令能力完整复刻

- [x] 4.1 复刻认证命令与别名：`login/logout/whoami`、`auth login/logout/whoami`，并改为围绕激活环境执行
- [x] 4.2 复刻查询命令：`search`、`explore`、`inspect` 及其现有选项、JSON 输出和 tag/version/file 行为
- [x] 4.3 复刻本地生命周期命令：`install`、`update`、`uninstall`、`list`，并接入 `yclawhub` 的独立工作区元数据
- [x] 4.4 复刻远端生命周期命令：`publish`、`delete`、`undelete`、`hide`、`unhide`
- [x] 4.5 复刻互动与管理命令：`star`、`unstar`、`ban-user`、`set-role`，或对暂未支持的私有环境返回明确受控错误
- [x] 4.6 复刻 `sync` 命令及无子命令时的默认 `sync` 行为，确保与当前 `clawhub` 的扫描、选择和发布心智一致

## 5. 私有环境发现、认证与分发

- [x] 5.1 调整 registry discovery 消费逻辑，使 `yclawhub` 优先使用激活环境和 well-known 的 `apiBase/authBase/minCliVersion`
- [ ] 5.2 验证私有站点的 `/cli/auth`、CLI token 创建接口和 `whoami` 兼容接口能支撑 `yclawhub` 登录与校验流程
- [x] 5.3 准备 `yclawhub` 的私有 npm 分发方案与安装文档，明确 `npx` 与全局安装的推荐使用路径

## 6. 测试与回归验证

- [x] 6.1 为多环境配置、激活环境优先级、独立环境变量和 token 绑定补充单元测试
- [x] 6.2 为 `yclawhub` 与 `clawhub` 同机共存场景补充测试，验证配置、token 和工作区状态互不污染
- [ ] 6.3 手工验证 `yclawhub` 在至少两个私有环境之间的登录切换、whoami、publish、delete、search、inspect、install、update 与 sync 链路
