## ADDED Requirements

### Requirement: 发布请求支持相关文档链接
系统 SHALL 允许 `POST /api/v1/skills` 的 multipart `payload` 携带可选 `documentationLinks`。该字段存在时 MUST 是文档链接对象数组，每项包含必填 `url` 和可选 `title`。

#### Scenario: 新建 skill 并提交相关文档
- **WHEN** 已认证用户发布不存在的新 skill，且 payload 携带通过校验的非空 `documentationLinks`
- **THEN** 系统 SHALL 创建 skill 和版本
- **THEN** 系统 SHALL 将规范化后的完整数组保存到 skill

#### Scenario: 新建 skill 时缺省相关文档
- **WHEN** 已认证用户发布不存在的新 skill，且 payload 未包含 `documentationLinks`
- **THEN** 系统 SHALL 正常创建 skill 和版本
- **THEN** 系统 SHALL 将该 skill 的相关文档保存为空数组

#### Scenario: 已有 skill 缺省字段时保留链接
- **WHEN** skill owner 发布已有 skill 的新版本，且 payload 未包含 `documentationLinks`
- **THEN** 系统 SHALL 创建新版本
- **THEN** 系统 MUST 保留该 skill 当前的完整 `documentationLinks`

#### Scenario: 已有 skill 显式清空链接
- **WHEN** skill owner 发布已有 skill 的新版本，且 payload 包含 `documentationLinks: []`
- **THEN** 系统 SHALL 创建新版本
- **THEN** 系统 SHALL 将该 skill 的相关文档更新为空数组

#### Scenario: 已有 skill 替换链接
- **WHEN** skill owner 发布已有 skill 的新版本，且 payload 包含通过校验的非空 `documentationLinks`
- **THEN** 系统 SHALL 创建新版本
- **THEN** 系统 SHALL 使用规范化后的完整新数组替换原有相关文档

### Requirement: 相关文档更新与版本发布保持原子性
系统 MUST 在现有 skill 发布事务中创建版本并更新 `documentationLinks`，不得出现版本发布成功但链接更新失败，或链接已更新但版本发布失败的中间状态。

#### Scenario: 发布事务成功
- **WHEN** 文件上传、版本创建和相关文档更新全部成功
- **THEN** 系统 SHALL 提交事务并返回标准发布成功响应

#### Scenario: 发布事务失败
- **WHEN** 版本创建或相关文档更新中的任一步骤失败
- **THEN** 系统 SHALL 回滚数据库事务
- **THEN** 系统 SHALL 清理本次已上传的文件
- **THEN** 系统 MUST 保留发布前的相关文档

### Requirement: 旧发布客户端保持兼容
系统 MUST 继续接受不包含 `documentationLinks` 的旧前端或 CLI 发布请求，不得把新增字段变成发布必填项。

#### Scenario: 旧客户端发布新 skill
- **WHEN** 旧客户端使用原有 payload 字段发布新 skill
- **THEN** 系统 SHALL 正常处理请求
- **THEN** 新 skill SHALL 使用空的相关文档数组

#### Scenario: 旧客户端发布已有 skill 新版本
- **WHEN** 旧客户端为已有 skill 发布新版本且未发送 `documentationLinks`
- **THEN** 系统 SHALL 正常处理请求
- **THEN** 系统 MUST NOT 清空或改写该 skill 已有的相关文档
