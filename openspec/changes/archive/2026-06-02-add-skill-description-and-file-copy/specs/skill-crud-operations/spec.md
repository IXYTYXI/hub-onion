## ADDED Requirements

### Requirement: 查询响应返回已保存简介
系统 SHALL 在 skills 列表、详情和搜索响应中通过现有 `summary` 字段返回已保存的 skill 简介。

#### Scenario: 列表页返回简介
- **WHEN** 客户端请求 `GET /api/v1/skills?sort=downloads`
- **THEN** 响应中每个已保存简介的 skill item SHALL 包含 `summary`，其值来自 `skills.description`
- **THEN** 前端列表 SHALL 使用该 `summary` 展示简介，而不是展示“暂无简介。”

#### Scenario: 详情页返回简介
- **WHEN** 客户端请求 `GET /api/v1/skills/{slug}` 且该 skill 已保存简介
- **THEN** 响应中的 `skill.summary` SHALL 等于已保存的 `skills.description`
- **THEN** 前端详情页 SHALL 使用该 `summary` 展示简介，而不是展示“暂无简介。”

#### Scenario: 搜索结果返回简介
- **WHEN** 客户端请求 `GET /api/v1/search?q={query}` 且返回结果包含已保存简介的 skill
- **THEN** 搜索结果中的 `summary` SHALL 等于已保存的 `skills.description`

#### Scenario: 无简介时保持空摘要
- **WHEN** skill 没有保存简介
- **THEN** 列表、详情和搜索响应 SHALL 返回 `summary: null` 或等价空值
- **THEN** 前端 SHALL 继续展示现有 fallback 文案
