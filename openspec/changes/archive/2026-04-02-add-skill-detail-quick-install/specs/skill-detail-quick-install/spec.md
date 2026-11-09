## ADDED Requirements

### Requirement: 技能详情页应展示当前技能的快捷安装命令
系统 SHALL 在技能详情页的下载操作区域中展示面向当前 skill 的快捷安装命令，以补齐从浏览到安装的主路径。

#### Scenario: 在详情页展示快捷安装区域
- **WHEN** 用户访问任意技能详情页且页面已加载当前 skill 数据
- **THEN** 系统 SHALL 在“下载 ZIP”按钮下方展示快捷安装区域

#### Scenario: 命令包含当前 skill slug
- **WHEN** 技能详情页渲染快捷安装命令
- **THEN** 系统 SHALL 使用当前 skill 的 slug 生成安装命令，而不得继续展示首页示例命令或写死示例 slug

### Requirement: 技能详情页应提供快捷安装命令复制能力
系统 SHALL 为技能详情页中的快捷安装命令提供复制能力，并向用户反馈复制结果。

#### Scenario: 成功复制当前命令
- **WHEN** 用户点击详情页快捷安装区域中的复制按钮且浏览器剪贴板写入成功
- **THEN** 系统 SHALL 将当前展示的完整安装命令写入剪贴板，并展示复制成功反馈

#### Scenario: 复制状态回退
- **WHEN** 详情页快捷安装命令完成复制成功反馈后
- **THEN** 系统 SHALL 在短暂成功态后恢复默认复制按钮文案

### Requirement: 技能详情页命令拼接必须复用现有环境变量规则
系统 SHALL 继续复用当前项目已有的安装命令生成规则，以保证不同环境中的 npm registry、CLI 包名和 skill registry 地址保持独立配置，而不得在详情页单独写死命令模板。

#### Scenario: 复用当前 npm registry 配置
- **WHEN** 详情页生成快捷安装命令
- **THEN** 系统 SHALL 复用现有环境变量读取与回退逻辑来解析 CLI npm registry

#### Scenario: 复用当前 CLI 包配置
- **WHEN** 详情页生成快捷安装命令
- **THEN** 系统 SHALL 复用现有环境变量读取与回退逻辑来解析 CLI 包名

#### Scenario: 复用当前 skill registry 配置
- **WHEN** 详情页生成快捷安装命令
- **THEN** 系统 SHALL 复用现有环境变量读取与回退逻辑来解析 skill registry 地址

### Requirement: 首页现有快捷安装区域保持不变
系统 MUST NOT 因为详情页新增快捷安装能力而修改首页现有快捷安装区域的文案、布局或交互。

#### Scenario: 首页行为保持原样
- **WHEN** 本次变更完成后用户访问首页
- **THEN** 系统 SHALL 保持首页现有快捷安装区域的展示与复制行为不变
