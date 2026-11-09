## ADDED Requirements

### Requirement: 发布时分配 skill 分类
系统 SHALL 允许发布请求携带可选 `categorySlugs`，并在保存 skill 时写入分类分配。

#### Scenario: 新 skill 未传分类
- **WHEN** 已认证用户发布不存在的新 skill，且 payload 未包含 `categorySlugs`
- **THEN** 系统 SHALL 创建 skill 和版本
- **THEN** 系统 SHALL 不创建任何分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类

#### Scenario: 新 skill 传空分类数组
- **WHEN** 已认证用户发布不存在的新 skill，且 payload 包含空数组 `categorySlugs`
- **THEN** 系统 SHALL 创建 skill 和版本
- **THEN** 系统 SHALL 不创建任何分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类

#### Scenario: 新 skill 传入多个分类
- **WHEN** 已认证用户发布不存在的新 skill，且 payload 包含多个有效 `categorySlugs`
- **THEN** 系统 SHALL 创建 skill 和版本
- **THEN** 系统 SHALL 将该 skill 关联到这些分类
- **THEN** 系统 MUST NOT 因分类分配改变现有 `tags` 字段

#### Scenario: 已有 skill 更新版本时缺省分类
- **WHEN** skill owner 发布已有 skill 的新版本，且 payload 未包含 `categorySlugs`
- **THEN** 系统 SHALL 创建新版本
- **THEN** 系统 SHALL 清空该 skill 当前分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类

#### Scenario: 已有 skill 显式清空分类
- **WHEN** skill owner 发布已有 skill 的新版本，且 payload 包含空数组 `categorySlugs`
- **THEN** 系统 SHALL 清空该 skill 当前分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类

#### Scenario: 缺省和空数组分类语义一致
- **WHEN** 发布 payload 未包含 `categorySlugs` 或包含空数组 `categorySlugs`
- **THEN** 系统 SHALL 将两者都解释为未分类
- **THEN** 系统 MUST NOT 保留已有 skill 的旧分类关联

#### Scenario: 发布时分类无效
- **WHEN** 发布 payload 中任一 `categorySlugs` 不存在或不可用
- **THEN** 系统 SHALL 返回稳定错误信息
- **THEN** 系统 MUST NOT 创建新版本或修改 skill 分类

#### Scenario: 发布时传入虚拟未分类 slug
- **WHEN** 发布 payload 中的 `categorySlugs` 包含 `uncategorized`
- **THEN** 系统 SHALL 返回稳定错误信息
- **THEN** 系统 MUST NOT 创建新版本或将 `uncategorized` 写入分类关联表

#### Scenario: 旧客户端发布兼容
- **WHEN** 旧 CLI 或旧前端只提交 `tags` 而不提交 `categorySlugs`
- **THEN** 系统 SHALL 接受发布请求
- **THEN** 新 skill 和已有 skill SHALL 都不创建或保留分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类
