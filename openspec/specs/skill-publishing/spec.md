## MODIFIED Requirements

### Requirement: 后端中转上传
系统应通过后端中转上传文件到 CDN。

#### Scenario: 上传流程
- **WHEN** 发布 skill 时
- **THEN** 文件上传流程为：
  1. 客户端发送 multipart form 到后端，携带 `Authorization: Bearer <token>` 或 session cookie
  2. 后端验证用户身份（401 如未认证）
  3. 后端验证文件和 payload
  4. 后端上传文件到阿里云 OSS
  5. 后端将 `owner_user_id` 设置为当前用户 id 并保存 skill
  6. 后端返回成功响应

#### Scenario: 不需要预签名 URL
- **WHEN** 上传文件时
- **THEN** 系统不生成预签名 URL（所有上传通过后端）

## ADDED Requirements

### Requirement: 发布需要认证
系统 SHALL 要求发布 skill 的请求携带有效的用户身份。

#### Scenario: 未认证发布被拒绝
- **WHEN** 未携带有效 JWT 或 CLI token 的请求访问 `POST /api/v1/skills`
- **THEN** 系统 SHALL 返回 401 Unauthorized，不执行任何发布操作

### Requirement: 多部分表单上传
系统应通过 multipart/form-data 接受 skill 发布，包含 payload JSON 和文件二进制。

#### 场景：有效的多部分上传
- **当** 客户端发送 POST /api/v1/skills，包含"payload"（JSON）和"files"（二进制）的多部分表单时
- **则** 系统应解析两部分并处理 skill 发布

#### 场景：缺少 payload 部分
- **当** 多部分表单缺少"payload"部分时
- **则** 系统应返回 400 Bad Request 并附带错误"missing payload"

#### 场景：缺少 files 部分
- **当** 多部分表单缺少"files"部分时
- **则** 系统应返回 400 Bad Request 并附带错误"missing files"

### Requirement: slug 验证
系统应根据命名规则验证 skill slug 格式。

#### 场景：有效的 slug 格式
- **当** payload 包含匹配模式 ^[a-z0-9-]+$ 的 slug 时
- **则** 系统应接受该 slug

#### 场景：无效的 slug 字符
- **当** payload 包含大写字母、下划线或特殊字符的 slug 时
- **则** 系统应返回 400 Bad Request 并附带错误"invalid slug format"

#### 场景：slug 长度限制
- **当** payload 包含短于 3 个字符或长于 50 个字符的 slug 时
- **则** 系统应返回 400 Bad Request 并附带错误"slug length must be 3-50 characters"

### Requirement: 版本验证
系统应验证版本号遵循语义版本控制。

#### 场景：有效的 semver 版本
- **当** payload 包含匹配 semver 模式的版本时（如"1.0.0"、"2.1.3-beta"）
- **则** 系统应接受该版本

#### 场景：无效的版本格式
- **当** payload 包含非 semver 版本时（如"v1"、"1.0"、"latest"）
- **则** 系统应返回 400 Bad Request 并附带错误"invalid version format"

#### 场景：重复版本
- **当** 发布已存在于 skill 的版本时
- **则** 系统应返回 409 Conflict 并附带错误"version already exists"

### Requirement: 文件类型验证
系统应只接受基于文本的文件作为 skill 内容。

#### 场景：允许的文本文件类型
- **当** 上传的文件扩展名为.md、.txt、.json、.yaml、.yml、.js、.ts、.py、.sh 时
- **则** 系统应接受这些文件

#### 场景：拒绝二进制文件
- **当** 上传的文件扩展名为.exe、.bin、.zip、.tar、.jpg、.png 时
- **则** 系统应返回 400 Bad Request 并附带错误"binary files not allowed"

#### 场景：内容类型验证
- **当** 文件内容类型不是 text/* 时
- **则** 系统应返回 400 Bad Request

### Requirement: 总大小限制
系统应对 skill 版本中的所有文件执行最大总大小限制。

#### 场景：大小在限制内
- **当** 所有文件的总大小为 50MB 或更小时
- **则** 系统应接受上传

#### 场景：大小超出限制
- **当** 所有文件的总大小超过 50MB 时
- **则** 系统应返回 413 Payload Too Large 并附带错误"total size exceeds 50MB limit"

### Requirement: SHA-256 哈希计算
系统应为每个上传的文件计算 SHA-256 哈希。

#### 场景：哈希与文件元数据一起存储
- **当** 处理上传的文件时
- **则** 系统应计算 SHA-256 哈希并将其存储在 files JSONB 数组中

#### 场景：哈希用于完整性验证
- **当** 文件稍后下载时
- **则** 系统应使用存储的哈希进行完整性验证

### Requirement: CDN 文件上传
系统应将验证后的文件流式上传到 CDN 存储。

#### 场景：存储键生成
- **当** 上传文件到 CDN 时
- **则** 系统应使用键格式：skills/{skill_id}/{version_id}/{file_path}

#### 场景：流式上传处理
- **当** 上传文件到 CDN 时
- **则** 系统应使用流式处理，边读取 multipart 文件边上传到 OSS，无需缓冲整个文件

#### 场景：同时计算哈希
- **当** 流式上传文件时
- **则** 系统应使用 io.TeeReader 同时计算 SHA-256 哈希并上传

#### 场景：上传失败处理
- **当** CDN 上传任何文件失败时
- **则** 系统应回滚整个发布并返回 500 Internal Server Error

### Requirement: 数据库事务
系统应使用数据库事务确保 skill 发布的原子性。

#### 场景：成功发布事务
- **当** 所有验证通过且文件上传完成时
- **则** 系统应在单个事务中创建 skill_versions 记录并更新 skills.latest_version_id

#### 场景：失败时回滚
- **当** 发布过程中的任何步骤失败时
- **则** 系统应回滚数据库更改并删除已上传的 CDN 文件

### Requirement: 首次发布创建 skill
系统应在发布到新 slug 时创建新的 skill 记录。

#### 场景：创建新 skill
- **当** 发布到不存在的 slug 时
- **则** 系统应创建新的 skills 记录，包含 payload 中的 display_name

#### 场景：更新现有 skill
- **当** 发布到现有的 slug 时
- **则** 系统应创建新版本并更新 latest_version_id

### 需求：发布时提取 skill 简介
系统 SHALL 在发布 skill 时，从当前发布文件集合中的主说明文件 frontmatter 提取 `description`，并将其作为 skill 简介保存。

#### 场景：主说明文件路径匹配
- **当** 系统查找用于简介提取的主说明文件时
- **则** 系统 SHALL 先将文件路径规范化为 `/` 分隔并移除开头的 `./` 或 `/`
- **则** 系统 SHALL 以大小写不敏感方式只匹配根目录 `SKILL.md` 或 `skills.md`
- **则** 系统 MUST 不使用子目录中的 `SKILL.md` 或 `skills.md` 作为 skill 简介来源

#### 场景：从 SKILL.md 保存简介
- **当** 已认证用户通过 POST /api/v1/skills 发布 skill，且上传文件包含根目录 `SKILL.md`，其 YAML frontmatter 包含非空 `description`
- **则** 系统 SHALL 将该 `description` 保存到对应 `skills.description`
- **则** 系统 SHALL 正常创建或更新 skill 版本

#### 场景：从 skills.md 保存简介
- **当** 发布文件集合不包含可用的 `SKILL.md`，但包含根目录 `skills.md`，其 YAML frontmatter 包含非空 `description`
- **则** 系统 SHALL 将该 `description` 保存到对应 `skills.description`
- **则** 系统 SHALL 正常创建或更新 skill 版本

#### 场景：缺少简介不阻断发布
- **当** 主说明文件缺失 `description`、`description` 为空，或 frontmatter 无法解析时
- **则** 系统 MUST 不因简介提取失败而拒绝发布
- **则** 系统 SHALL 继续按现有发布校验和事务流程处理该版本

#### 场景：新版本更新简介
- **当** 用户向已有 skill 发布新版本，且新版本主说明文件包含非空 `description` 时
- **则** 系统 SHALL 使用新版本 `description` 更新该 skill 的 `skills.description`
- **则** 后续列表、详情和搜索响应 SHALL 返回更新后的简介

#### 场景：新版本缺少简介时保留旧简介
- **当** 用户向已有 skill 发布新版本，且新版本没有可用的非空 `description` 时
- **则** 系统 MUST 保留该 skill 现有的 `skills.description`
- **则** 系统 MUST 不把已有简介清空为 `null`、空字符串或空白字符串

#### 场景：上传流不被简介解析消耗
- **当** 系统从主说明文件读取 frontmatter 用于简介提取时
- **则** 系统 SHALL 使用独立读取流程或重新打开 multipart 文件
- **则** 系统 MUST 保证后续 CDN 上传仍能读取完整文件内容

### Requirement: 发布请求格式
系统 SHALL 正确解析 multipart/form-data 请求，并允许发布请求携带来自 GitHub 或 GitLab 的导入来源信息。

#### 场景：payload 部分格式
- **当** 解析 payload 部分时
- **则** payload 应为 JSON，包含：
  - slug: string（3-50 字符，匹配 ^[a-z0-9-]+$）
  - displayName: string
  - version: string（semver 格式）
  - changelog: string
  - tags: string[]（可选）
  - source: object（可选，包含 kind、url、repo、ref、commit、path、importedAt；其中 kind MUST 支持 `github` 或 `gitlab`）
  - forkOf: object（可选，包含 slug 和 version）

#### 场景：files 部分格式
- **当** 解析 files 部分时
- **则** 每个文件应包含：
  - path: string（文件在 skill 中的相对路径）
  - size: number（字节大小）
  - storageId: string（CDN 存储 ID）
  - sha256: string（SHA-256 哈希）
  - contentType: string（可选，MIME 类型）

#### 场景：客户端以当前文件列表作为发布来源
- **当** 用户在上传页删除了某个本地文件后继续发起 `POST /api/v1/skills`
- **则** 客户端 MUST 仅提交删除后的当前文件集合
- **则** 已被用户从上传页移除的文件 MUST 不再出现在发布请求的 `files` 部分中

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

### Requirement: 发布响应格式
系统 SHALL 按照标准 schema 格式返回发布结果，并对现有 CLI 返回固定成功语义。

#### 场景：成功发布响应
- **当** 发布成功时
- **则** 系统应返回 200 OK，包含：
  - ok: "true"
  - skillId: string
  - versionId: string

#### 场景：CLI 发布兼容
- **当** `packages/clawdhub` CLI 调用 `POST /api/v1/skills`
- **则** 系统应返回与 `ApiV1PublishResponseSchema` 完全兼容的响应，而不是返回 `ok: "published"` 等自定义值

### Requirement: 发布错误处理
系统应正确处理发布相关的错误情况，并将可恢复的业务冲突与真实内部错误区分开。对于 `slug` 归属冲突和重复版本，系统 MUST 返回稳定的冲突语义，而不是统一返回 500 Internal Server Error。

#### 场景：CDN 上传失败
- **当** CDN 上传失败时
- **则** 系统应返回 500 并附带 `{ "error": "storage upload failed" }`

#### 场景：数据库事务失败
- **当** 数据库操作失败时
- **则** 系统应回滚并返回 500 并附带 `{ "error": "database error" }`

#### 场景：版本冲突
- **WHEN** 当前用户发布的版本已存在时
- **THEN** 系统 MUST 返回稳定的版本冲突语义
- **THEN** 系统 MUST 不将该场景伪装为通用内部错误

#### 场景：slug 归属冲突
- **WHEN** 用户尝试发布到一个已存在且归属于其他用户的 `slug`
- **THEN** 系统 MUST 返回稳定的归属冲突语义
- **THEN** 系统 MUST 不将该场景伪装为通用内部错误

### 需求：发布时分配 skill 分类
系统 SHALL 允许发布请求携带可选 `categorySlugs`，并在保存 skill 时写入分类分配。

#### 场景：新 skill 未传分类
- **WHEN** 已认证用户发布不存在的新 skill，且 payload 未包含 `categorySlugs`
- **THEN** 系统 SHALL 创建 skill 和版本
- **THEN** 系统 SHALL 不创建任何分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类

#### 场景：新 skill 传空分类数组
- **WHEN** 已认证用户发布不存在的新 skill，且 payload 包含空数组 `categorySlugs`
- **THEN** 系统 SHALL 创建 skill 和版本
- **THEN** 系统 SHALL 不创建任何分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类

#### 场景：新 skill 传入多个分类
- **WHEN** 已认证用户发布不存在的新 skill，且 payload 包含多个有效 `categorySlugs`
- **THEN** 系统 SHALL 创建 skill 和版本
- **THEN** 系统 SHALL 将该 skill 关联到这些分类
- **THEN** 系统 MUST NOT 因分类分配改变现有 `tags` 字段

#### 场景：已有 skill 更新版本时缺省分类
- **WHEN** skill owner 发布已有 skill 的新版本，且 payload 未包含 `categorySlugs`
- **THEN** 系统 SHALL 创建新版本
- **THEN** 系统 SHALL 清空该 skill 当前分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类

#### 场景：已有 skill 显式清空分类
- **WHEN** skill owner 发布已有 skill 的新版本，且 payload 包含空数组 `categorySlugs`
- **THEN** 系统 SHALL 清空该 skill 当前分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类

#### 场景：缺省和空数组分类语义一致
- **WHEN** 发布 payload 未包含 `categorySlugs` 或包含空数组 `categorySlugs`
- **THEN** 系统 SHALL 将两者都解释为未分类
- **THEN** 系统 MUST NOT 保留已有 skill 的旧分类关联

#### 场景：发布时分类无效
- **WHEN** 发布 payload 中任一 `categorySlugs` 不存在或不可用
- **THEN** 系统 SHALL 返回稳定错误信息
- **THEN** 系统 MUST NOT 创建新版本或修改 skill 分类

#### 场景：发布时传入虚拟未分类 slug
- **WHEN** 发布 payload 中的 `categorySlugs` 包含 `uncategorized`
- **THEN** 系统 SHALL 返回稳定错误信息
- **THEN** 系统 MUST NOT 创建新版本或将 `uncategorized` 写入分类关联表

#### 场景：旧客户端发布兼容
- **WHEN** 旧 CLI 或旧前端只提交 `tags` 而不提交 `categorySlugs`
- **THEN** 系统 SHALL 接受发布请求
- **THEN** 新 skill 和已有 skill SHALL 都不创建或保留分类关联
- **THEN** 系统 SHALL 将该 skill 视为未分类
