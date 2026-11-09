# 技能详情页快捷安装命令技术方案

## 1. 文档目的

本文档基于 [需求文档](./requirements.md) 和当前仓库代码现状，给出“在技能详情页下载按钮下方增加快捷安装命令与复制能力”的技术实现方案。

本文档重点回答三个问题：

1. 当前首页的快捷安装能力是如何实现的。
2. 技能详情页应如何复用这套能力，而不是重新拼一套命令。
3. 为什么本次不应改动首页，只应在详情页补齐缺失能力。

## 2. 现状调研结论

### 2.1 首页已经具备快捷安装与复制能力

首页技能模式实现位于 [`src/routes/index.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/index.tsx)。

当前首页 `SkillsHome()` 已直接使用 [`src/components/InstallSwitcher.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/InstallSwitcher.tsx)：

- `InstallSwitcher` 接收 `exampleSlug`
- 默认展示 npm 安装命令
- 内置复制按钮与“已复制”反馈

因此，首页这部分能力已经存在，不需要本次再做设计调整。

### 2.2 当前命令拼接已经有统一规则

命令拼接逻辑位于 [`src/lib/install-command.ts`](/Users/logo/self_repo/claw_case/clawhub/src/lib/install-command.ts)。

当前已经抽出以下能力：

- `getCliNpmRegistry()`
- `getCliPackageName()`
- `getSkillRegistryForInstall()`
- `buildNpmInstallCommand(exampleSlug)`

该文件会从 env 中读取并回退：

- `VITE_CLI_NPM_REGISTRY`
- `VITE_CLI_PACKAGE_NAME`
- `VITE_CLI_SKILL_REGISTRY`
- `VITE_BACKEND_BASE`
- `VITE_SITE_URL`
- `window.location.origin`

这意味着当前系统已经具备“按环境动态拼接命令”的基础能力。

### 2.3 技能详情页当前只有下载按钮，没有快捷安装区

技能详情页头部区域位于 [`src/components/SkillHeader.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/SkillHeader.tsx)。

当前 `skill-hero-cta` 区域包含：

- 当前版本展示
- “下载 ZIP”按钮

但尚未包含：

- 面向当前 skill 的安装命令展示
- 复制安装命令能力

## 3. 设计目标

本次设计采用“复用已有能力，避免规则漂移”的原则：

- 首页不改
- 详情页补齐
- 命令拼接统一复用已有工具函数
- 复制交互尽量复用首页现有模式

## 4. 方案概述

### 4.1 页面结构

在技能详情页的下载按钮下方新增一个快捷安装区域。

推荐结构如下：

1. 当前版本信息
2. 下载 ZIP 按钮
3. 快捷安装标题与说明
4. 命令展示框
5. 复制按钮

这样可以保证用户在“我要下载”与“我要安装”两个动作之间快速选择。

### 4.2 命令生成

详情页命令应直接基于当前 skill 的 `slug` 生成：

```ts
buildNpmInstallCommand(skill.slug)
```

不允许在详情页重新写一份如下逻辑：

- 手动读取 env
- 手动拼接 registry
- 手动写死 CLI 包名

因为这样会导致首页和详情页的行为在后续迭代中失去一致性。

### 4.3 复制能力

复制能力应沿用首页现有行为：

- 点击按钮时复制当前命令
- 复制成功后显示短暂成功态
- 定时回退到默认按钮文案

如果当前首页逻辑已经足够通用，推荐抽成共享组件或在现有组件基础上支持更通用的传参。

## 5. 推荐实现方向

## 5.1 方向 A：复用现有 `InstallSwitcher`

若 [`src/components/InstallSwitcher.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/InstallSwitcher.tsx) 当前结构足够适配详情页，优先考虑：

- 保留其复制逻辑
- 允许传入当前 skill slug
- 允许传入不同的标题/说明文案
- 在详情页直接复用该组件

优点：

- 改动最小
- 首页与详情页交互天然一致
- 复制逻辑只维护一处

注意点：

- 首页当前文案是面向首页 Hero 的，不适合直接原样复用到详情页
- 组件可能需要支持“是否显示标题行”或“自定义说明文案”

### 5.2 方向 B：抽取共享命令条组件

如果 `InstallSwitcher` 首页耦合较重，则推荐新建更底层的共享组件，例如：

- `InstallCommandBox`
- 或 `QuickInstallCommand`

职责建议拆分为：

- 上层负责提供 `slug` 与文案
- 底层负责展示命令与复制按钮
- 命令构造继续调用 `buildNpmInstallCommand`

优点：

- 首页与详情页共享底层能力，但各自保留不同文案布局
- 更利于后续在其他页面继续复用

### 5.3 方向选择建议

优先建议采用“共享底层能力”的思路，但不应为此做过度抽象。

判断标准如下：

- 如果只需少量参数扩展即可兼容详情页，则继续使用 `InstallSwitcher`
- 如果首页结构对详情页样式约束太强，则抽取底层命令条组件

无论采用哪种方向，都必须满足一个前提：

- 命令生成必须继续走 [`src/lib/install-command.ts`](/Users/logo/self_repo/claw_case/clawhub/src/lib/install-command.ts)

## 6. UI 与交互约束

### 6.1 首页不改

本次不修改首页 [`src/routes/index.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/index.tsx) 中的快捷安装区域：

- 不改文案
- 不改布局
- 不改交互

原因很明确：

- 首页现有能力已可用
- 本次问题只存在于详情页缺少对应能力
- 没必要把一个局部补齐需求扩散成首页重构

### 6.2 详情页视觉要求

详情页新增区域需要与下载按钮形成自然上下关系，但不应压过下载按钮本身。

建议：

- 标题比按钮弱一层
- 命令框保持代码样式
- 复制按钮放在命令框右上或右侧

### 6.3 响应式要求

命令较长，需考虑以下情况：

- 窄屏下换行后仍可阅读
- 或允许横向滚动
- 复制按钮始终可点击，不被长字符串挤出可视区域

## 7. 影响范围

预期主要影响以下前端文件：

- [`src/components/SkillHeader.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/SkillHeader.tsx)
- [`src/components/InstallSwitcher.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/InstallSwitcher.tsx)
- [`src/lib/install-command.ts`](/Users/logo/self_repo/claw_case/clawhub/src/lib/install-command.ts)
- 可能新增一个共享组件文件
- 可能新增或调整详情页文案来源文件

本次原则上不影响：

- 后端接口
- 下载接口
- 首页数据逻辑

## 8. 验收映射

技术验收需要覆盖以下点：

1. 详情页展示的命令确实使用当前 skill slug。
2. 详情页展示的 registry / package 内容与首页在同一环境下保持一致。
3. 复制按钮复制的是完整命令，而不是示例命令。
4. 首页行为保持不变，没有被本次改坏。

## 9. 风险

### 9.1 复制实现重复

如果详情页单独再写一套复制状态机，短期可行，但长期容易与首页行为分叉。

### 9.2 命令生成重复

如果详情页手写命令模板，未来 env 变量或回退策略变化时，首页和详情页会出现不一致。

### 9.3 样式耦合过强

如果直接把首页 Hero 的完整组件硬塞进详情页，可能造成详情页视觉层级失衡，因此需要控制复用粒度。

## 10. 结论

本需求技术上非常直接，关键不在“能不能加一个复制按钮”，而在“是否继续坚持统一的命令生成规则”。

因此本次技术方案的核心约束只有两条：

1. 首页现有快捷安装区保持不动
2. 详情页新增能力必须复用现有 env 变量拼接逻辑

只要这两条不被破坏，这个需求就能以较低风险落地。
