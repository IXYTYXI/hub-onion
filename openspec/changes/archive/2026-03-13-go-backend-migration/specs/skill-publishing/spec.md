## 新增需求

### 需求：多部分表单上传
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

### 需求：slug 验证
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

### 需求：版本验证
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

### 需求：文件类型验证
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

### 需求：总大小限制
系统应对 skill 版本中的所有文件执行最大总大小限制。

#### 场景：大小在限制内
- **当** 所有文件的总大小为 50MB 或更小时
- **则** 系统应接受上传

#### 场景：大小超出限制
- **当** 所有文件的总大小超过 50MB 时
- **则** 系统应返回 413 Payload Too Large 并附带错误"total size exceeds 50MB limit"

### 需求：SHA-256 哈希计算
系统应为每个上传的文件计算 SHA-256 哈希。

#### 场景：哈希与文件元数据一起存储
- **当** 处理上传的文件时
- **则** 系统应计算 SHA-256 哈希并将其存储在 files JSONB 数组中

#### 场景：哈希用于完整性验证
- **当** 文件稍后下载时
- **则** 系统应使用存储的哈希进行完整性验证

### 需求：CDN 文件上传
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

### 需求：数据库事务
系统应使用数据库事务确保 skill 发布的原子性。

#### 场景：成功发布事务
- **当** 所有验证通过且文件上传完成时
- **则** 系统应在单个事务中创建 skill_versions 记录并更新 skills.latest_version_id

#### 场景：失败时回滚
- **当** 发布过程中的任何步骤失败时
- **则** 系统应回滚数据库更改并删除已上传的 CDN 文件

### 需求：首次发布创建 skill
系统应在发布到新 slug 时创建新的 skill 记录。

#### 场景：创建新 skill
- **当** 发布到不存在的 slug 时
- **则** 系统应创建新的 skills 记录，包含 payload 中的 display_name

#### 场景：更新现有 skill
- **当** 发布到现有的 slug 时
- **则** 系统应创建新版本并更新 latest_version_id

### 需求：发布请求格式
系统应正确解析 multipart/form-data 请求。

#### 场景：payload 部分格式
- **当** 解析 payload 部分时
- **则** payload 应为 JSON，包含：
  - slug: string（3-50 字符，匹配 ^[a-z0-9-]+$）
  - displayName: string
  - version: string（semver 格式）
  - changelog: string
  - tags: string[]（可选）
  - source: object（可选，包含 kind、url、repo、ref、commit、path、importedAt）
  - forkOf: object（可选，包含 slug 和 version）

#### 场景：files 部分格式
- **当** 解析 files 部分时
- **则** 每个文件应包含：
  - path: string（文件在 skill 中的相对路径）
  - size: number（字节大小）
  - storageId: string（CDN 存储 ID）
  - sha256: string（SHA-256 哈希）
  - contentType: string（可选，MIME 类型）

### 需求：发布响应格式
系统应按照标准 schema 格式返回发布结果。

#### 场景：成功发布响应
- **当** 发布成功时
- **则** 系统应返回 200 OK，包含：
  - ok: "true"
  - skillId: string
  - versionId: string

### 需求：发布错误处理
系统应正确处理发布相关的错误情况。

#### 场景：CDN 上传失败
- **当** CDN 上传失败时
- **则** 系统应返回 500 并附带 `{ "error": "storage upload failed" }`

#### 场景：数据库事务失败
- **当** 数据库操作失败时
- **则** 系统应回滚并返回 500 并附带 `{ "error": "database error" }`

#### 场景：版本冲突
- **当** 发布的版本已存在时
- **则** 系统应返回 409 Conflict 并附带 `{ "error": "version already exists" }`
