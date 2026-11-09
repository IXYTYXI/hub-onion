## ADDED Requirements

### Requirement: 发布时提取 skill 简介
系统 SHALL 在发布 skill 时，从当前发布文件集合中的主说明文件 frontmatter 提取 `description`，并将其作为 skill 简介保存。

#### Scenario: 主说明文件路径匹配
- **WHEN** 系统查找用于简介提取的主说明文件
- **THEN** 系统 SHALL 先将文件路径规范化为 `/` 分隔并移除开头的 `./` 或 `/`
- **THEN** 系统 SHALL 以大小写不敏感方式只匹配根目录 `SKILL.md` 或 `skills.md`
- **THEN** 系统 MUST 不使用子目录中的 `SKILL.md` 或 `skills.md` 作为 skill 简介来源

#### Scenario: 从 SKILL.md 保存简介
- **WHEN** 已认证用户通过 `POST /api/v1/skills` 发布 skill，且上传文件包含根目录 `SKILL.md`，其 YAML frontmatter 包含非空 `description`
- **THEN** 系统 SHALL 将该 `description` 保存到对应 `skills.description`
- **THEN** 系统 SHALL 正常创建或更新 skill 版本

#### Scenario: 从 skills.md 保存简介
- **WHEN** 发布文件集合不包含可用的 `SKILL.md`，但包含根目录 `skills.md`，其 YAML frontmatter 包含非空 `description`
- **THEN** 系统 SHALL 将该 `description` 保存到对应 `skills.description`
- **THEN** 系统 SHALL 正常创建或更新 skill 版本

#### Scenario: 缺少简介不阻断发布
- **WHEN** 主说明文件缺失 `description`、`description` 为空，或 frontmatter 无法解析
- **THEN** 系统 MUST 不因简介提取失败而拒绝发布
- **THEN** 系统 SHALL 继续按现有发布校验和事务流程处理该版本

#### Scenario: 新版本更新简介
- **WHEN** 用户向已有 skill 发布新版本，且新版本主说明文件包含非空 `description`
- **THEN** 系统 SHALL 使用新版本 `description` 更新该 skill 的 `skills.description`
- **THEN** 后续列表、详情和搜索响应 SHALL 返回更新后的简介

#### Scenario: 新版本缺少简介时保留旧简介
- **WHEN** 用户向已有 skill 发布新版本，且新版本没有可用的非空 `description`
- **THEN** 系统 MUST 保留该 skill 现有的 `skills.description`
- **THEN** 系统 MUST 不把已有简介清空为 `null`、空字符串或空白字符串

#### Scenario: 上传流不被简介解析消耗
- **WHEN** 系统从主说明文件读取 frontmatter 用于简介提取
- **THEN** 系统 SHALL 使用独立读取流程或重新打开 multipart 文件
- **THEN** 系统 MUST 保证后续 CDN 上传仍能读取完整文件内容
