## Why

当前 `/import` 页面只支持从 GitHub 公共仓库导入 skill，而团队内部实际存在托管在私有部署 GitLab 中的 skill 仓库。对这类仓库，用户无法在浏览器里直接拉取内容，必须通过后端带认证代理访问，否则既拿不到仓库内容，也无法满足访问控制要求。

## What Changes

- 保留现有 GitHub 导入能力不变，并为 `/import` 新增“私有 GitLab 导入”路径。
- 新增后端 GitLab 导入代理能力：由后端读取配置中的固定 token/PAT，负责解析私有 GitLab URL、拉取目录树、探测候选 skill、读取文件内容。
- 新增 GitLab skill 候选探测与预览能力，支持多候选选择、默认文件选择和导入前预览。
- 新增 GitLab 仓库解析与提交锁定能力，导入时必须绑定具体 commit，避免预览和发布之间的仓库内容漂移。
- 扩展发布来源元数据，允许 skill 记录 `gitlab` 来源、仓库、ref、commit、路径与导入时间。
- 第一阶段使用服务端固定 token/PAT 访问私有 GitLab，不引入用户级 GitLab token、写回 GitLab、自动同步或 webhook。

## Capabilities

### New Capabilities
- `gitlab-skill-import`: 定义私有 GitLab skill 导入的后端授权拉取、URL 解析、候选探测、文件选择、提交锁定和前端导入交互。

### Modified Capabilities
- `skill-publishing`: 扩展发布来源 schema 与发布语义，使 skill 版本可记录 `gitlab` 导入来源。
- `go-backend-api`: 增加 GitLab 导入预览与文件拉取所需的后端 API，以及服务端固定 token/PAT 配置读取要求。

## Impact

- 前端页面：`src/routes/import.tsx` 需要从单一 GitHub 导入页扩展为支持 GitLab 的通用导入页。
- Go 后端：需要新增私有 GitLab 代理拉取能力，并读取 `backend/config.yaml` 中的 GitLab 认证配置。
- 前后端交互：GitLab 导入不能再由前端直连 GitLab，必须改为调用后端预览/下载接口。
- 发布契约：`packages/schema/src/schemas.ts` 以及依赖该 schema 的发布链路需要接受 `gitlab` 来源。
- 导入元数据：skill 发布后的来源信息需要保留 GitLab 仓库、ref、commit、path 和导入时间，确保后续可追踪。
