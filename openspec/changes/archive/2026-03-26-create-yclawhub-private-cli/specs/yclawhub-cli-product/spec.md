## ADDED Requirements

### Requirement: `yclawhub` SHALL 作为独立 CLI 产品线发行
系统 SHALL 提供独立于 `clawhub` 的 `yclawhub` CLI 产品线，具有独立包名、命令名、品牌文案和安装入口。

#### Scenario: 独立 npm 包与命令入口
- **WHEN** 用户通过 npm 或私有 npm registry 安装 `yclawhub`
- **THEN** 系统 SHALL 提供独立于 `clawhub` 的 npm 包标识与可执行命令名，而不是要求用户继续运行 `clawhub`

#### Scenario: 独立帮助文案
- **WHEN** 用户运行 `yclawhub --help` 或命令报错
- **THEN** 系统 SHALL 展示 `yclawhub` 自身的产品名称、帮助文案和错误提示，而不是复用 `clawhub` 品牌文案

### Requirement: `yclawhub` SHALL 完整复刻当前 `clawhub` 的能力面
系统 SHALL 将当前 `clawhub` 的显式命令和隐含默认行为视为 `yclawhub` 的对等能力基线。

#### Scenario: 命令集合对等
- **WHEN** 定义 `yclawhub` 的首期 CLI 能力
- **THEN** 系统 SHALL 覆盖当前 `clawhub` 的认证、查询、安装、更新、发布、删除、收藏、同步和管理命令，而不是只迁移少量私有场景命令

#### Scenario: 默认行为对等
- **WHEN** 用户在无子命令情况下运行 `yclawhub`
- **THEN** 系统 SHALL 复刻当前 `clawhub` 的默认入口行为，例如已登录时进入默认同步流程、未登录时输出帮助

### Requirement: `yclawhub` SHALL 与 `clawhub` 完全隔离本地状态
系统 SHALL 使用独立于 `clawhub` 的本地配置、token 存储、状态目录和工作区元数据命名空间。

#### Scenario: 全局配置隔离
- **WHEN** 用户在同一台机器上同时使用 `clawhub` 与 `yclawhub`
- **THEN** `yclawhub` SHALL 使用独立的全局配置文件路径和 token 存储，而不得覆盖或读取 `clawhub` 的默认全局配置

#### Scenario: 工作区元数据隔离
- **WHEN** `yclawhub` 安装、更新或同步 skill 并写入锁文件或来源元数据
- **THEN** 系统 SHALL 写入独立于 `.clawhub` 的工作区元数据命名空间，避免修改 `clawhub` 已有状态

### Requirement: `yclawhub` SHALL 使用独立环境变量前缀
系统 SHALL 使用完全独立于 `CLAWHUB_*` / `CLAWDHUB_*` 的环境变量前缀解析运行时配置。

#### Scenario: 仅识别独立前缀
- **WHEN** `yclawhub` 解析环境变量中的 site、registry、config path 或其他 CLI 运行参数
- **THEN** 系统 SHALL 优先且默认只识别 `YCLAWHUB_*` 前缀，而不是依赖 `CLAWHUB_*` 变量

#### Scenario: 与 `clawhub` 并存不冲突
- **WHEN** 同一 shell 环境中同时存在 `yclawhub` 与 `clawhub` 的配置变量
- **THEN** `yclawhub` SHALL 只消费自身前缀对应的环境变量，避免误读公共版配置
