## Context

当前仓库中的 `packages/clawdhub` 已经是一套完整 CLI 产品，而不是单纯的 HTTP 客户端。它包含认证、查询、安装、更新、发布、删除、收藏、同步、管理命令，以及本地锁文件、来源元数据、工作区扫描、默认 `sync` 等隐含行为。现有实现默认围绕 `clawhub.ai`、`CLAWHUB_*` 环境变量和单一 `{ registry, token }` 配置工作，这对公共站点是合理的，但对多私有环境场景会出现几个结构性问题：

- 登录入口和 API 入口分离，用户即使登录私有站点，未显式传参时也可能回退到公共默认值
- 单一 token/registry 配置无法表达多个私有环境，也无法清晰切换“当前环境”
- `clawhub` 与私有版若共用配置和本地状态，会在同机安装时互相污染
- 私有团队需要一个长期独立演进的 CLI 品牌入口，而不是继续把所有体验压在公共 `clawhub` 上

这次设计的目标不是为 `clawhub` 增加一些私有参数，而是定义一个新的独立产品线 `yclawhub`。它需要在复刻现有 `clawhub` 能力面的基础上，为多个私有环境提供默认化体验，并确保与 `clawhub` 并存时互不影响。

## Goals / Non-Goals

**Goals:**

- 完整复刻当前 `clawhub` CLI 的命令能力、隐含行为和用户心智，包括认证、查询、安装、更新、发布、删除、收藏、同步和管理命令
- 将 `yclawhub` 设计为独立 npm 包、独立命令名、独立帮助文案和独立本地配置空间
- 为 `yclawhub` 引入多私有环境模型，支持保存、切换和激活多个私有站点
- 让 `yclawhub` 的默认行为围绕“当前激活环境”解析 `site`、`registry`、`authBase` 和 token，而不是回退到 `clawhub.ai`
- 定义 `yclawhub` 与 `clawhub` 共存时的隔离边界，包括环境变量、配置路径、状态目录和本地元数据
- 复用现有 CLI 核心逻辑的可共享部分，避免无必要地复制两套实现

**Non-Goals:**

- 不把 `clawhub` 改造成多品牌、多 profile 的单一二进制入口
- 不要求现有公共 `clawhub` 用户迁移到 `yclawhub`
- 不在本次设计中改变私有站点已有的业务 API 语义，只定义 `yclawhub` 依赖的消费前提
- 不尝试让 npm 分发 token 直接替代业务站点的 CLI 登录 token

## Decisions

### 决策一：`yclawhub` 作为独立产品线发行，而不是 `clawhub` 的运行模式

`yclawhub` 将使用独立的 npm 包名、命令名、帮助文案和默认配置，而不是在 `clawhub` 中增加“私有模式”。这样做有三个原因：

- 用户执行入口清晰，`yclawhub` 天然代表私有平台，不需要用户理解公共版和私有版共享一个命令
- 可以完全隔离配置空间和品牌文案，避免与公共 `clawhub` 混用
- 后续产品线分叉时，私有版可以独立发布和回滚，不受公共版节奏约束

备选方案：

- 在 `clawhub` 中增加 `--profile` / `--brand`
  - 优点：二进制更少，短期看起来更省事
  - 缺点：公共/私有心智混杂，配置隔离困难，也不符合“长期独立产品线”

### 决策二：能力面以“完整复刻现有 `clawhub`”为基线，而不是只移植少量命令

`yclawhub` 的功能范围以当前 `packages/clawdhub` 为准，包括显式命令和隐式默认行为。首期设计将命令面视为产品契约的一部分，至少覆盖：

- 认证：`login/logout/whoami` 与 `auth` 别名
- 查询与浏览：`search/explore/inspect`
- 本地生命周期：`install/update/uninstall/list`
- 远端生命周期：`publish/delete/undelete/hide/unhide`
- 互动与管理：`star/unstar/ban-user/set-role`
- 同步：`sync`
- 无子命令时已登录默认进入 `sync`

这样做是为了避免只实现“看起来常用”的几个命令，结果在实际迁移用户时遗漏本地锁文件、工作区扫描、版本 bump 和默认行为。

备选方案：

- 只做 `login/whoami/publish/delete/search/inspect`
  - 优点：首期实现更小
  - 缺点：不满足“完全复刻”，也会在后续迁移时不断补洞

### 决策三：多私有环境采用“显式环境实体 + 当前激活环境”模型

`yclawhub` 不再使用单个 `{ registry, token }` 配置，而是存储一组命名环境，例如：

- `name`
- `site`
- `registry`
- `authBase`
- `token`
- `lastUsedAt`
- `isDefault`

CLI 运行时始终解析一个“当前激活环境”，并允许通过命令切换。这样能自然支持：

- 多个私有部署环境并存
- 不同环境的 token 独立存储
- 当前命令默认打到哪个站点可解释、可检查、可切换

备选方案：

- 每次都要求用户传 `--site`/`--registry`
  - 优点：实现更直接
  - 缺点：不能视为“支持多个环境”，也无法提供长期可维护的用户体验

### 决策四：解析优先级以“显式覆盖 > 激活环境 > 独立环境变量 > 内置默认值”为准

`yclawhub` 的解析优先级定义为：

1. 命令行显式参数（如 `--site`、`--registry`、未来的 `--env`）
2. 当前激活环境
3. `YCLAWHUB_*` 环境变量
4. 内置默认值或首次初始化引导

与现有 `clawhub` 不同，`yclawhub` 不应在存在激活环境时优先回退到公共默认 site 做 discovery。这样可以保证用户登录某个私有环境后，后续裸命令仍然围绕该环境工作。

备选方案：

- 继续保留“site discovery 优先于已保存环境”
  - 优点：与当前 `clawhub` 接近
  - 缺点：会重现当前私有站点登录后仍回退到默认站点的问题

### 决策五：`yclawhub` 与 `clawhub` 的隔离边界必须覆盖全局配置与项目内状态

若只隔离全局 config path，而继续共用项目内 `.clawhub/lock.json`、`.clawhub/origin.json`，两个 CLI 仍会在同一工作区里交叉影响。因此 `yclawhub` 需要独立的状态命名空间，至少包括：

- 全局配置文件路径
- token 存储
- 环境变量前缀
- 工作区锁文件目录
- skill 来源元数据目录

设计上优先采用 `yclawhub` 自己的目录命名，不复用 `.clawhub`。如需兼容读取旧状态，应视为显式迁移能力，而非默认写回旧路径。

备选方案：

- 只隔离全局 token/config，继续复用 `.clawhub`
  - 优点：实现量较少
  - 缺点：无法满足“安装后不会对现有包有影响”

### 决策六：实现上采用“共享核心 + 品牌壳层”的结构，而不是简单复制整个包

虽然 `yclawhub` 是独立产品线，但当前 `clawhub` 的大部分逻辑是可复用的，例如：

- HTTP 请求与 schema 校验
- 发布打包和文本文件扫描
- ZIP 下载和解压
- inspect/search/sync 的业务逻辑
- browser loopback auth 基础设施

为了降低长期维护成本，设计上应把“命令内核”和“品牌/平台绑定配置”拆开：

- 共享层：纯命令逻辑、HTTP client、schema、文件系统工具
- 品牌层：命令名、默认站点、配置路径、环境变量前缀、帮助文案、默认行为钩子

备选方案：

- 直接 fork 一份 `packages/clawdhub`
  - 优点：短期最直接
  - 缺点：后续难以同步修复和复用共享能力

## Risks / Trade-offs

- [风险] “完全复刻”范围大于表面命令列表，容易遗漏默认 `sync`、lockfile、workspace 扫描等隐含行为
  → Mitigation：将现有 `packages/clawdhub` 的能力矩阵显式纳入任务拆分和验收标准

- [风险] 多私有环境会显著改写当前单一配置模型，若抽象不稳定，后续实现会反复返工
  → Mitigation：先在 spec 中固化环境实体、激活环境和优先级，再进入实现

- [风险] 过度复制 `clawhub` 代码会造成长期维护分叉
  → Mitigation：优先抽离共享核心，再保留 `clawhub` 与 `yclawhub` 的品牌壳层

- [风险] 若项目内状态不隔离，`yclawhub` 仍可能污染现有 `clawhub` 工作区
  → Mitigation：明确锁文件和来源元数据都使用独立命名空间，并将迁移兼容性作为显式决策处理

- [风险] 私有站点的 well-known、authBase、CLI token 或 whoami 契约不完整，会导致 `yclawhub` 登录和校验流程落空
  → Mitigation：在 spec 中明确私有环境的最低发现与认证前提，并在实现阶段加入手工验证

## Migration Plan

1. 先定义 `yclawhub` 的产品和环境模型 spec，冻结命令对等范围、隔离边界和环境解析规则
2. 将现有 `clawhub` 中可共享的命令逻辑、配置解析和文件系统工具识别出来，准备抽离共享层
3. 新建 `yclawhub` 入口包和独立配置空间，实现多环境配置与登录流
4. 逐命令接入共享核心，确保 `yclawhub` 的行为与 `clawhub` 对等，同时改为围绕激活环境运行
5. 补齐与私有站点的发现、token 和 whoami 手工验证，再开放私有 npm 分发

回滚策略：

- 若 `yclawhub` 新产品线实现失败，不影响现有 `clawhub` 的公共使用路径
- 若共享核心抽离引入回归，可临时回退到 `clawhub` 现状，并暂停 `yclawhub` 入口接入

## Open Questions

- `yclawhub` 的项目内元数据目录是否统一使用 `.yclawhub`，还是需要同时支持读取 `.clawhub` 作为迁移兼容
- 首期是否要求私有站点全部支持 `ban-user/set-role/star/unstar`，还是允许 `yclawhub` 先对这些命令返回明确的“不支持”
- `yclawhub` 的私有 npm 分发是仅面向内部团队，还是面向多个客户租户；这会影响包名、scope 和文档策略
