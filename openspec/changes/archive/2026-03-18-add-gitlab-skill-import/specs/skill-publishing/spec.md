## MODIFIED Requirements

### Requirement: 发布请求格式
系统 SHALL 正确解析 multipart/form-data 请求，并允许发布请求携带来自 GitHub 或 GitLab 的导入来源信息。

#### Scenario: payload 部分格式
- **WHEN** 解析 payload 部分时
- **THEN** payload 应为 JSON，包含：
  - slug: string（3-50 字符，匹配 ^[a-z0-9-]+$）
  - displayName: string
  - version: string（semver 格式）
  - changelog: string
  - tags: string[]（可选）
  - source: object（可选，包含 kind、url、repo、ref、commit、path、importedAt；其中 kind MUST 支持 `github` 或 `gitlab`）
  - forkOf: object（可选，包含 slug 和 version）

#### Scenario: files 部分格式
- **WHEN** 解析 files 部分时
- **THEN** 每个文件应包含：
  - path: string（文件在 skill 中的相对路径）
  - size: number（字节大小）
  - storageId: string（CDN 存储 ID）
  - sha256: string（SHA-256 哈希）
  - contentType: string（可选，MIME 类型）

## ADDED Requirements

### Requirement: 导入来源兼容性
系统 SHALL 在扩展导入来源时保持 GitHub 来源兼容，并同时接受 GitLab 来源。

#### Scenario: GitHub 来源请求继续有效
- **WHEN** 客户端提交包含 `source.kind = github` 的发布请求
- **THEN** 系统 SHALL 继续按现有语义接受该请求，不得因新增 GitLab 支持而拒绝或改写 GitHub 来源数据

#### Scenario: GitLab 来源请求可被接受
- **WHEN** 客户端提交包含 `source.kind = gitlab` 的发布请求
- **THEN** 系统 SHALL 接受该来源数据，并按与 GitHub 同等级别的导入来源元数据进行校验和存储

#### Scenario: 私有 GitLab 来源保留受控访问上下文
- **WHEN** skill 通过私有 GitLab 导入成功发布
- **THEN** 系统 SHALL 在来源元数据中保留 GitLab 仓库、ref、commit 和路径，以便后续追踪该版本来自受控的私有仓库导入
