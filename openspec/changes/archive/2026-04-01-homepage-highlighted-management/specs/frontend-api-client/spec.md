## MODIFIED Requirements

### Requirement: Skills 查询 hooks
系统 SHALL 提供用于查询 skills 数据的 React hooks，并使其能够消费精选过滤和统一后的安装统计语义。

#### 场景：用于列表的 useSkills hook
- **当** 组件使用 useSkills hook 时
- **则** 系统应从 GET /api/v1/skills 获取并返回类型化的 skill 列表

#### 场景：用于单个技能的 useSkill hook
- **当** 组件使用 useSkill(slug) hook 时
- **则** 系统应从 GET /api/v1/skills/{slug} 获取并返回类型化的技能详情

#### 场景：useSkillVersions hook
- **当** 组件使用 useSkillVersions(slug) hook 时
- **则** 系统应从 GET /api/v1/skills/{slug}/versions 获取并返回版本历史

#### 场景：精选筛选参数透传
- **当** 组件以 `highlightedOnly` 请求 skill 列表时
- **则** 系统应向 GET /api/v1/skills 透传 `highlighted=1` 并消费仅包含精选 skill 的响应

### Requirement: API 响应类型定义
系统 SHALL 定义类型化的 API 响应，并使前端类型与 Go 后端实际返回结构保持一致。

#### 场景：Skill 类型定义
- **当** 定义 TypeScript 类型时
- **则** 应包含：
  - slug: string
  - displayName: string
  - summary: string | null
  - tags: string[] | object
  - stats: { downloads: number; installs: number; versions: number }
  - createdAt: number
  - updatedAt: number
  - latestVersion?: { version: string; createdAt: number; changelog: string }
  - highlighted?: boolean

#### 场景：安装统计语义对齐
- **当** 前端消费技能详情或列表响应时
- **则** 系统 SHALL 将 `stats.installs` 视为累计安装次数，而不得继续假定存在独立的 `installsCurrent` 或 `installsAllTime` 后端字段
