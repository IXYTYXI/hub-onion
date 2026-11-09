## `clawdhub` 能力矩阵盘点

### 命令与默认行为

| 区域 | 当前 `clawdhub` 能力 |
| --- | --- |
| 认证 | `login/logout/whoami` 与 `auth` 别名 |
| 查询 | `search`、`explore`、`inspect` |
| 本地生命周期 | `install`、`update`、`uninstall`、`list` |
| 远端生命周期 | `publish`、`delete`、`undelete`、`hide`、`unhide` |
| 互动/管理 | `star`、`unstar`、`ban-user`、`set-role` |
| 同步 | `sync` |
| 默认入口 | 无子命令且存在 token 时自动执行 `sync`，否则输出帮助 |

### 全局配置与环境变量

| 类别 | 当前实现 |
| --- | --- |
| 默认 site | `https://clawhub.ai` |
| 默认 registry | `https://clawhub.ai`，优先走 well-known discovery |
| 全局配置 | `config.ts` 读取单一 `{ registry, token }` |
| 环境变量 | `CLAWHUB_*`，兼容 `CLAWDHUB_*` |
| token 读取 | `src/cli/authToken.ts` |
| registry 缓存 | `src/cli/registry.ts` |

### 本地状态读写点

| 状态 | 位置 | 读写入口 |
| --- | --- | --- |
| lockfile | `.clawhub/lock.json`（兼容 `.clawdhub`） | `src/skills.ts` |
| skill 来源元数据 | `<skill>/.clawhub/origin.json` | `src/skills.ts` |
| ignore 规则 | `.clawhubignore`（兼容 `.clawdhubignore`） | `src/skills.ts` |
| 工作区探测 | `.clawhub` / `.clawdhub` marker | `src/cli.ts` |

### 共享核心切分结论

- 共享核心适合放在 `clawhub` 包内部导出：CLI 入口组装、命令实现、HTTP client、schema、文件扫描、安装/更新/发布/同步逻辑。
- 品牌壳层需要独立注入：命令名、帮助文案、默认 site/registry、环境变量前缀、全局配置路径、工作区元数据目录。
- `yclawhub` 需要扩展多环境配置，但不能回写 `clawhub` 的配置和 `.clawhub` 工作区状态。
