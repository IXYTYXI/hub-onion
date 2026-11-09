## MODIFIED Requirements

### Requirement: 发布请求格式
系统 SHALL 正确解析 multipart/form-data 请求，并允许发布请求携带来自 GitHub 或 GitLab 的导入来源信息。客户端提交的 `files` 集合 MUST 以用户在上传页当前保留的本地文件列表为准，包括客户端自动展开、剥离包装目录和用户显式删除后的结果。

#### Scenario: payload 部分格式
- **当** 解析 payload 部分时
- **则** payload 应为 JSON，包含：
  - slug: string（3-50 字符，匹配 ^[a-z0-9-]+$）
  - displayName: string
  - version: string（semver 格式）
  - changelog: string
  - tags: string[]（可选）
  - source: object（可选，包含 kind、url、repo、ref、commit、path、importedAt；其中 kind MUST 支持 `github` 或 `gitlab`）
  - forkOf: object（可选，包含 slug 和 version）

#### Scenario: files 部分格式
- **当** 解析 files 部分时
- **则** 每个文件应包含：
  - path: string（文件在 skill 中的相对路径）
  - size: number（字节大小）
  - storageId: string（CDN 存储 ID）
  - sha256: string（SHA-256 哈希）
  - contentType: string（可选，MIME 类型）

#### Scenario: 客户端以当前文件列表作为发布来源
- **当** 用户在上传页删除了某个本地文件后继续发起 `POST /api/v1/skills`
- **则** 客户端 MUST 仅提交删除后的当前文件集合
- **则** 已被用户从上传页移除的文件 MUST 不再出现在发布请求的 `files` 部分中
