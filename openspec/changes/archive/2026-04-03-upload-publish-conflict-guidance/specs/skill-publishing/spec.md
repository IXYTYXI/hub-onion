## MODIFIED Requirements

### Requirement: 发布错误处理
系统应正确处理发布相关的错误情况，并将可恢复的业务冲突与真实内部错误区分开。对于 `slug` 归属冲突和重复版本，系统 MUST 返回稳定的冲突语义，而不是统一返回 500 Internal Server Error。

#### Scenario: CDN 上传失败
- **WHEN** CDN 上传失败时
- **THEN** 系统应返回 500 并附带 `{ "error": "storage upload failed" }`

#### Scenario: 数据库事务失败
- **WHEN** 数据库操作失败时
- **THEN** 系统应回滚并返回 500 并附带 `{ "error": "database error" }`

#### Scenario: 版本冲突
- **WHEN** 当前用户发布的版本已存在时
- **THEN** 系统 MUST 返回稳定的版本冲突语义
- **THEN** 系统 MUST 不将该场景伪装为通用内部错误

#### Scenario: slug 归属冲突
- **WHEN** 用户尝试发布到一个已存在且归属于其他用户的 `slug`
- **THEN** 系统 MUST 返回稳定的归属冲突语义
- **THEN** 系统 MUST 不将该场景伪装为通用内部错误
