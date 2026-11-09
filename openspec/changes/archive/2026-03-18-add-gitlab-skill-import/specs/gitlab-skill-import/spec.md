## ADDED Requirements

### Requirement: 导入页支持 GitHub 与 GitLab 双来源
系统 SHALL 在同一个 `/import` 入口中同时支持 GitHub 和 GitLab 仓库导入，且新增 GitLab 支持后不得破坏现有 GitHub 导入能力。

#### Scenario: 保留现有 GitHub 导入能力
- **WHEN** 用户在 `/import` 中选择或输入 GitHub 仓库 URL
- **THEN** 系统 SHALL 继续按照现有 GitHub 导入流程执行 skill 探测、文件选择和发布，且无需改用其他入口

#### Scenario: 新增 GitLab 导入来源
- **WHEN** 用户在 `/import` 中选择或输入 GitLab 项目 URL
- **THEN** 系统 SHALL 在同一页面内进入 GitLab 导入流程，并通过后端代理完成预览与文件拉取，而不是由浏览器直接访问 GitLab API

### Requirement: 私有 GitLab 导入必须通过后端授权拉取
系统 SHALL 对私有部署 GitLab 仓库使用后端代理拉取，并使用服务端固定 token/PAT 完成访问认证。

#### Scenario: 后端读取固定凭据访问私有 GitLab
- **WHEN** 用户请求预览或导入私有 GitLab skill
- **THEN** 后端 SHALL 从服务端配置中读取固定 token/PAT，并在请求 GitLab API 时附带认证头

#### Scenario: 前端不得接触 GitLab 凭据
- **WHEN** 前端执行 GitLab skill 导入
- **THEN** 系统 SHALL 不向浏览器返回固定 token/PAT，也不得要求用户在页面中输入该凭据

#### Scenario: 限制可访问的 GitLab 实例
- **WHEN** 用户输入 GitLab URL
- **THEN** 系统 SHALL 仅允许访问服务端配置允许的私有 GitLab host，并拒绝不在允许列表中的地址

### Requirement: GitLab URL 解析与范围识别
系统 SHALL 支持解析私有 GitLab 项目根 URL、`/-/tree/<ref>/<path>` URL 和 `/-/blob/<ref>/<path>` URL，并从中识别项目、ref 和导入范围。

#### Scenario: 解析 GitLab 项目根 URL
- **WHEN** 用户输入 `https://gitlab.yc345.tv/<namespace>/<project>` 或等价的允许 host URL
- **THEN** 系统 SHALL 将其识别为项目根范围，并使用项目默认分支或显式 ref 作为后续解析基准

#### Scenario: 解析 GitLab tree URL
- **WHEN** 用户输入 `https://gitlab.yc345.tv/<namespace>/<project>/-/tree/<ref>/<path>`
- **THEN** 系统 SHALL 解析出项目标识、ref 和目录范围 `<path>`，并仅在该范围内探测候选 skill

#### Scenario: 解析 GitLab blob URL
- **WHEN** 用户输入 `https://gitlab.yc345.tv/<namespace>/<project>/-/blob/<ref>/<path>`
- **THEN** 系统 SHALL 将 `<path>` 所在目录作为候选探测范围，而不是把单个文件当作完整 skill 根目录

#### Scenario: 拒绝不受支持的 GitLab URL
- **WHEN** 用户输入的 GitLab URL 不符合受支持格式，或 host 不在允许列表中
- **THEN** 系统 SHALL 阻止导入并返回清晰错误，而不是进入不确定的探测流程

### Requirement: GitLab skill 候选探测
系统 SHALL 在解析出 GitLab 项目与范围后，自动探测该范围内的 `SKILL.md` 或 `skills.md`，并将每个匹配目录作为一个可导入候选 skill。

#### Scenario: 识别单个候选 skill
- **WHEN** 指定 GitLab 项目范围内只存在一个 `SKILL.md` 或 `skills.md`
- **THEN** 系统 SHALL 自动载入该候选 skill 的预览，而无需用户先做候选选择

#### Scenario: 识别多个候选 skill
- **WHEN** 指定 GitLab 项目范围内存在多个 `SKILL.md` 或 `skills.md`
- **THEN** 系统 SHALL 向用户展示候选列表，并允许用户先选定一个 skill 再进入文件预览

#### Scenario: 未找到候选 skill
- **WHEN** 指定 GitLab 项目范围内不存在 `SKILL.md` 或 `skills.md`
- **THEN** 系统 SHALL 拒绝导入并提示当前项目或路径下未发现 skill

### Requirement: GitLab 导入预览必须锁定 commit
系统 SHALL 在 GitLab 导入预览阶段先将 ref 解析为具体 commit，再基于该 commit 生成候选、文件列表和默认选择，确保预览与发布使用同一份仓库内容。

#### Scenario: 基于 commit 生成预览
- **WHEN** 用户对 GitLab URL 执行 detect 或 preview
- **THEN** 后端 SHALL 返回解析后的项目、ref、commit 和候选路径，并使后续文件列表以该 commit 为准

#### Scenario: 预览中展示已锁定的 commit 上下文
- **WHEN** 系统展示 GitLab skill 的导入预览
- **THEN** 页面 SHALL 明确展示项目标识、ref 和已锁定的 commit 语义，提示用户当前导入内容已固定

### Requirement: GitLab 导入复用现有发布流程
系统 SHALL 在用户确认 GitLab skill 候选、文件集合和元信息后，继续通过现有 skill 发布流程完成发布，而不是引入独立的 GitLab 发布通道。

#### Scenario: 从 GitLab 导入并发布
- **WHEN** 用户在 GitLab 导入预览中确认 slug、display name、version、tags 和文件选择
- **THEN** 系统 SHALL 通过后端代理下载所选文本文件、构造与普通发布兼容的 payload，并调用现有发布接口完成 skill 发布

#### Scenario: GitLab 导入写入来源元数据
- **WHEN** GitLab skill 发布成功
- **THEN** 系统 SHALL 在该版本来源信息中记录 `kind=gitlab`、项目 URL、项目标识、ref、commit、路径和导入时间

#### Scenario: GitLab 导入失败不影响 GitHub 导入
- **WHEN** GitLab 导入因 URL、预览、下载或发布失败而中断
- **THEN** 系统 SHALL 保持 GitHub 导入入口与行为继续可用，不得因为 GitLab 失败而整体禁用导入页
