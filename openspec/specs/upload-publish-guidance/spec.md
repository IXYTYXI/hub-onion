## ADDED Requirements

### Requirement: 上传页 SHALL 识别 slug 的发布意图
系统 SHALL 在上传页中根据用户输入的 `slug` 区分当前操作是“新建 skill”“为已有 skill 发布新版本”还是“slug 已被他人占用”。

#### Scenario: 未占用 slug 可用于新建
- **WHEN** 用户输入的 `slug` 在系统中不存在
- **THEN** 上传页 SHALL 提示该标识可用于新建 skill
- **THEN** 在其他校验通过的前提下，系统 SHALL 允许继续发布

#### Scenario: 当前用户已有该 slug 时切换为新版本语义
- **WHEN** 用户输入的 `slug` 已存在，且该 skill 属于当前登录用户
- **THEN** 上传页 SHALL 提示本次操作将作为新版本发布
- **THEN** 上传页 SHALL 展示该 skill 的当前最新版本

#### Scenario: 他人占用 slug 时阻止发布
- **WHEN** 用户输入的 `slug` 已存在，且该 skill 不属于当前登录用户
- **THEN** 上传页 SHALL 提示该标识已被占用
- **THEN** 上传页 SHALL 禁用发布动作，直到用户更换 `slug`

### Requirement: 上传页 MUST 对重复版本给出明确升级引导
系统 MUST 在当前用户向已有 skill 发布时，对重复版本号提供明确的字段级或表单级提示，而不是仅显示通用失败文案。

#### Scenario: 重复版本号被映射为升级提示
- **WHEN** 当前用户提交的 `version` 已存在于该 skill
- **THEN** 上传页 MUST 提示用户升级版本号后再发布
- **THEN** 上传页 MUST 将用户引导回版本输入区域或等效的明显版本提示

### Requirement: 提交前检查 SHALL 仅作为引导，不替代最终发布结果
系统 SHALL 将上传页中的 `slug` 检查视为提交前引导，而不是最终裁定。

#### Scenario: 提交时以后端结果为最终真相
- **WHEN** 上传页预检查结果与最终发布时的服务端状态不一致
- **THEN** 系统 SHALL 以后端发布结果为最终真相
- **THEN** 上传页 SHALL 根据最终返回结果刷新提示状态
