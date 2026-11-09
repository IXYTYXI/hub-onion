## ADDED Requirements

### Requirement: 公共 skill 响应返回相关文档链接
系统 SHALL 在公共 `SkillItem` 响应中通过 `documentationLinks` 返回 skill 当前保存的相关文档。该字段 MUST 是数组，每项包含 `url`，并仅在已配置时包含 `title`。

#### Scenario: 详情响应包含相关文档
- **WHEN** 客户端请求 `GET /api/v1/skills/{slug}`，且该 skill 已保存相关文档
- **THEN** 响应中的 `skill.documentationLinks` SHALL 按保存顺序返回所有链接

#### Scenario: 列表及复用 SkillItem 的响应保持一致
- **WHEN** 系统通过公共列表、用户公开 skills、当前用户收藏、当前用户 my skills 或 admin skills 返回 `SkillItem`
- **THEN** 每个 item SHALL 包含 `documentationLinks`
- **THEN** 每个 item 的链接顺序和对象结构 SHALL 与详情响应一致

#### Scenario: 无相关文档时返回空数组
- **WHEN** skill 没有保存任何相关文档
- **THEN** 所有 `SkillItem` 响应 SHALL 返回 `documentationLinks: []`
- **THEN** 系统 MUST NOT 返回 `null` 或省略该字段

#### Scenario: 搜索轻量响应保持现状
- **WHEN** 客户端请求使用独立 `SearchResult` 的搜索接口
- **THEN** 系统 MUST NOT 因本变更要求搜索结果返回 `documentationLinks`
