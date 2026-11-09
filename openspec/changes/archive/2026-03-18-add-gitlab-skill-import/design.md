## Context

当前 `/import` 页面已经具备一条可工作的 GitHub 导入路径：用户粘贴 GitHub URL，前端解析仓库与路径，递归拉取仓库文件，自动探测 `SKILL.md`，允许用户选择候选 skill 与文件集，然后复用现有发布接口完成发布。这个流程可用，但它把仓库来源硬编码为 GitHub，且发布来源 schema 也只接受 `github`。

这次变更的核心不是重做导入系统，而是在不破坏 GitHub 导入体验的前提下，为私有部署 GitLab 项目补齐等价能力。由于目标 GitLab 仓库需要认证访问，浏览器不能直接携带服务端凭据访问 GitLab API，因此 GitLab 导入必须由后端代理完成。约束如下：

- 现有 GitHub 导入必须继续可用，且交互习惯尽量不变
- GitLab 导入目标是私有部署 GitLab，例如 `https://gitlab.yc345.tv/...`
- GitLab 拉取认证使用服务端固定 token/PAT，而不是用户自己的 GitLab token
- 继续复用现有 publish 能力，不新增第二套 skill 发布入口
- 导入结果必须保留来源仓库、ref、commit、路径与导入时间，便于后续追踪

## Goals / Non-Goals

**Goals:**

- 在同一个 `/import` 页面中同时支持 GitHub 和 GitLab skill 导入
- 保持 GitHub 导入能力与现有行为兼容，不因引入 GitLab 而退化
- 为私有 GitLab 补齐 URL 解析、ref 解析、commit 锁定、候选探测、文件预览和导入发布
- 为 GitLab 导入新增后端代理 API，并从 `backend/config.yaml` 读取固定 token/PAT
- 扩展发布来源 schema，使导入后的 skill 能记录 `gitlab` 来源
- 将前端导入流程抽象为“GitHub 前端直连 + GitLab 后端代理”的统一交互模型

**Non-Goals:**

- 不废弃或替换现有 GitHub 导入能力
- 不实现用户级 GitLab OAuth token 透传或按用户权限动态切换 GitLab 凭据
- 不实现 GitLab 写回、自动同步、Webhook 或双向同步
- 不重做 skill 发布接口
- 不在本次变更中处理 GitLab 子模块、LFS 文件或二进制文件导入

## Decisions

### 决策一：保留单一 `/import` 入口，同时支持 GitHub 与 GitLab

不新增第二个独立页面，而是在现有 `/import` 中引入“仓库来源”概念。页面支持两种来源：

- GitHub
- GitLab

其中 GitHub 仍然是完整支持的导入来源，GitLab 作为新增来源并列出现。这样做有两个原因：

- 用户心智保持稳定，导入入口不分裂
- 可以复用现有候选选择、文件选择、表单编辑与发布交互

备选方案：

- 新增 `/import/gitlab`
  - 优点：实现隔离，短期改动更直接
  - 缺点：页面重复，GitHub/GitLab 两套 UI 未来会继续漂移

### 决策二：GitHub 保持前端直连，GitLab 改为后端代理，而不是统一走浏览器直连

当前 GitHub 导入逻辑已经包含几类能力：

- 解析 URL
- 解析 ref/commit
- 递归列出文件
- 探测候选 skill
- 下载选中文件

但私有 GitLab 的核心约束是认证信息只能存在于服务端配置中，因此 GitLab 不能继续沿用“前端直接请求仓库 API”的模式。设计上应拆成两条数据路径：

- GitHub：沿用现有前端直连探测和下载
- GitLab：前端请求后端导入 API，由后端读取固定 token/PAT 去请求 GitLab

共享层保留：

- URL 输入和候选选择交互
- `SKILL.md` / `skills.md` 候选探测语义
- 默认文件选择
- slug / displayName / version 建议值
- 最终调用 publish 的流程

这样做可以在不改变用户心智的情况下，把 GitLab 的鉴权风险隔离在服务端。

备选方案：

- 让前端直接读取构建时注入的 GitLab token
  - 优点：实现表面上更快
  - 缺点：会泄露服务端凭据，不可接受

### 决策三：GitLab 第一阶段基于私有部署实例和服务端固定 token/PAT 工作

第一阶段支持配置中允许的私有部署 GitLab host，例如：

- `https://gitlab.yc345.tv/...`

GitLab URL 至少需要支持：

- 项目根 URL
- `/-/tree/<ref>/<path>`
- `/-/blob/<ref>/<path>`

解析后，系统必须拿到：

- host
- namespace/project
- ref
- path

后端拉取 GitLab 内容时：

- 从后端配置读取固定 token/PAT
- 对 GitLab API 请求附带认证头
- 仅允许访问配置允许的 GitLab host

这样可以覆盖“整个仓库导入”和“从某个子目录导入”的主流程，同时满足私有仓库访问控制。

备选方案：

- 依赖当前登录用户自己的 GitLab OAuth 身份拉取仓库
  - 优点：权限更细
  - 缺点：需要补完整的用户级 token 生命周期和权限语义，这不在本次范围内

### 决策四：GitLab 导入同样必须锁定 commit，再允许用户发布

GitHub 现有导入已经强调 commit pinned。GitLab 也必须遵循同一原则，否则用户预览时看到的仓库内容和提交发布时拉取到的内容可能不一致。

因此 GitLab 导入流程必须：

1. 前端把用户输入的 GitLab URL 提交给后端预览接口
2. 后端解析项目、ref、path，并带固定 token/PAT 访问 GitLab API
3. 后端将 ref 解析为具体 commit SHA
4. 所有候选探测、文件列表和文件下载都基于该 commit
5. 发布时将该 commit 写入 `source`

备选方案：

- 直接基于 branch 名称导入
  - 优点：实现更简单
  - 缺点：不可重现，也与现有 GitHub 导入的稳定性要求不一致

### 决策五：GitLab 通过后端预览/下载接口为现有发布接口供数，只扩展 source schema

导入的最终目标仍然是产出一次普通 skill 发布，因此不需要新增单独的“GitLab 导入发布”接口。GitLab 导入只需要在现有发布链路上扩展：

- `source.kind` 从仅支持 `github` 扩展为支持 `github | gitlab`
- `source.repo` 允许保存 GitLab 的 `namespace/project`
- `source.url` 保存项目 URL
- `source.ref` / `source.commit` / `source.path` / `source.importedAt` 继续保留

但为了隐藏 GitLab 私有访问凭据，必须新增一组后端 API，例如：

- `POST /api/v1/import/gitlab/preview`
- `POST /api/v1/import/gitlab/candidate`
- `POST /api/v1/import/gitlab/file` 或等价批量下载接口

这些接口只负责“代表服务端去 GitLab 拉取数据”，最终 skill 发布仍走现有发布接口。这样可以最小化发布链路改动范围。

备选方案：

- 新增单一后端 `importGitLabSkill` 一步到位接口
  - 优点：服务端逻辑集中
  - 缺点：会把候选预览、文件选择、发布写入全耦合在一起，不利于复用现有 `/import` 交互

## Risks / Trade-offs

- [风险] 将导入页从单一 GitHub 扩展为双来源后，GitHub 现有流程可能因为 UI 重构而回归
  → Mitigation：将“GitHub 导入继续可用”写成显式 requirement，并优先抽取共享状态而不是重写已工作的 GitHub 行为

- [风险] GitLab 凭据误用到前端会造成固定 token/PAT 泄露
  → Mitigation：明确 GitLab 拉取只能通过后端代理，前端永不接触 token/PAT

- [风险] GitLab URL 结构比 GitHub 更复杂，尤其是多级 group 路径和 `/-/tree` / `/-/blob` 形式
  → Mitigation：在 spec 中限定支持的 URL 形态，并要求对无效或不支持的链接给出清晰错误

- [风险] 服务端固定 token/PAT 的权限过大，可能被用于访问非预期仓库
  → Mitigation：在配置中限制允许的 GitLab host 和可选的项目/组范围，并在 handler 层做 URL 校验

- [风险] 当前已经实现的“前端直连 GitLab”方案与新设计冲突
  → Mitigation：后续实现阶段需要回收这部分代码，改为走后端 API

## Migration Plan

1. 扩展共享 publish source schema，允许 `gitlab`
2. 在 Go 后端增加 GitLab 导入代理 API，并读取 `backend/config.yaml` 中的固定 token/PAT
3. 前端 `/import` 保留 GitHub 直连路径，同时将 GitLab 路径改为调用后端导入 API
4. 手工验证 GitHub 导入不回归，再验证私有 GitLab 项目导入主流程

回滚策略：

- 若 GitLab 导入上线后出现问题，可先隐藏 GitLab 来源入口
- GitHub 既有导入流程应保持独立可用，避免因 GitLab 问题影响现有 GitHub 用户

## Open Questions

- 固定 token/PAT 在配置中最终字段名使用现有 `auth.gitlab` 扩展字段，还是新增专门的 `gitlab_import` 配置块；本次 spec 先约束“来自服务端配置”，实现时再定具体字段。
