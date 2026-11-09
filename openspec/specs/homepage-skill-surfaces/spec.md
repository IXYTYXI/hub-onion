## ADDED Requirements

### Requirement: 首页技能站点应展示真实精选和热门数据
系统 SHALL 在技能站点首页展示基于真实后端数据的“精选技能”和“热门技能”，而不是继续使用前端占位空数组。

#### Scenario: 首页加载精选技能
- **WHEN** 用户访问技能站点首页 `/`
- **THEN** 系统 SHALL 读取真实 skill 数据渲染“精选技能”区块，而不是始终显示空状态

#### Scenario: 首页加载热门技能
- **WHEN** 用户访问技能站点首页 `/`
- **THEN** 系统 SHALL 读取真实 skill 数据渲染“热门技能”区块，而不是始终显示空状态

### Requirement: 首页精选技能应基于 highlighted 状态
系统 SHALL 使用与公开技能列表和管理后台一致的 `highlighted` 状态作为首页精选技能的数据来源。

#### Scenario: 精选技能仅包含 highlighted skill
- **WHEN** 首页请求精选技能数据
- **THEN** 系统 SHALL 仅返回 `highlighted = true` 的活跃且未删除 skill

#### Scenario: 精选技能按更新时间排序
- **WHEN** 首页渲染精选技能区块
- **THEN** 系统 SHALL 按最近更新时间优先展示精选 skill

### Requirement: 首页热门技能应基于下载量排序
系统 SHALL 使用活跃且未删除 skill 的下载量排序结果作为首页热门技能的数据来源。

#### Scenario: 热门技能按下载量降序
- **WHEN** 首页请求热门技能数据
- **THEN** 系统 SHALL 返回按下载量降序排序的 skill 列表

#### Scenario: 热门技能不依赖 highlighted 状态
- **WHEN** 首页请求热门技能数据
- **THEN** 系统 SHALL 不要求 skill 同时具备 `highlighted = true` 才能进入热门列表
