## 新增需求

### 需求：ZIP 归档生成
系统应生成包含 skill 版本所有文件的 ZIP 归档。

#### 场景：下载最新版本
- **当** 客户端请求 GET /api/v1/download?slug={slug} 时
- **则** 系统应生成包含最新版本所有文件的 ZIP

#### 场景：下载特定版本
- **当** 客户端请求 GET /api/v1/download?slug={slug}&version={version} 时
- **则** 系统应生成包含指定版本所有文件的 ZIP

#### 场景：技能未找到
- **当** 客户端请求不存在的 slug 的下载时
- **则** 系统应返回 404 Not Found

#### 场景：版本未找到
- **当** 客户端请求不存在的版本的下载时
- **则** 系统应返回 404 Not Found

### 需求：确定性 ZIP 排序
系统应创建具有确定性文件排序的 ZIP 归档以进行一致哈希。

#### 场景：按路径排序文件
- **当** 生成 ZIP 归档时
- **则** 系统应按文件路径的字典序添加文件

#### 场景：固定修改时间
- **当** 生成 ZIP 归档时
- **则** 系统应将所有文件修改时间设置为固定时间戳（如 Unix 纪元）

#### 场景：一致压缩
- **当** 生成 ZIP 归档时
- **则** 系统应使用一致的压缩设置以实现可重现的输出

### 需求：元数据文件包含
系统应在 ZIP 归档中包含 _meta.json 文件，带有版本元数据。

#### 场景：元数据文件内容
- **当** 生成 ZIP 归档时
- **则** 系统应包含 _meta.json，包含 skill slug、version、display_name、description、tags 和带哈希的文件列表

#### 场景：元数据文件位置
- **当** 生成 ZIP 归档时
- **则** 系统应将 _meta.json 放在 ZIP 的根目录

### 需求：从 CDN 检索文件
系统应在构建 ZIP 时从 CDN 存储检索文件内容。

#### 场景：获取所有版本文件
- **当** 为版本构建 ZIP 时
- **则** 系统应从 CDN 获取 skill_versions.files JSONB 中列出的所有文件

#### 场景：CDN 获取失败
- **当** 无法从 CDN 检索任何文件时
- **则** 系统应返回 500 Internal Server Error 并附带错误"failed to retrieve file from storage"

### 需求：流式 ZIP 响应
系统应将 ZIP 内容直接流式传输到客户端，而不将整个归档缓冲到内存中。

#### 场景：大技能下载
- **当** 下载包含许多文件的技能时
- **则** 系统应在生成 ZIP 内容时流式传输，以最小化内存使用

#### 场景：Content-Disposition 响应头
- **当** 发送 ZIP 响应时
- **则** 系统应设置 Content-Disposition 响应头为 attachment，文件名格式为 {slug}-{version}.zip

### 需求：下载统计跟踪
系统应在 ZIP 成功生成时递增下载计数器。

#### 场景：递增下载计数
- **当** ZIP 下载完成时
- **则** 系统应将 skills.stats_downloads 递增 1

#### 场景：失败下载不递增
- **当** ZIP 下载失败或取消时
- **则** 系统不应递增下载计数器

### 需求：下载响应格式
系统应使用正确的响应头返回 ZIP 文件。

#### 场景：Content-Type 响应头
- **当** 返回 ZIP 响应时
- **则** 系统应设置 Content-Type: application/zip

#### 场景：Content-Disposition 响应头
- **当** 返回 ZIP 响应时
- **则** 系统应设置 Content-Disposition: attachment; filename="{slug}-{version}.zip"

#### 场景：Content-Length 响应头
- **当** 返回 ZIP 响应时
- **则** 系统应设置 Content-Length 响应头（如果大小已知）

### 需求：下载错误处理
系统应正确处理下载相关的错误情况。

#### 场景：技能未找到错误
- **当** 请求的 slug 不存在时
- **则** 系统应返回 404 并附带 `{ "error": "skill not found" }`

#### 场景：版本未找到错误
- **当** 请求的版本不存在时
- **则** 系统应返回 404 并附带 `{ "error": "version not found" }`

#### 场景：CDN 检索失败
- **当** 从 CDN 检索文件失败时
- **则** 系统应返回 500 并附带 `{ "error": "failed to retrieve file from storage" }`

### 需求：下载缓存策略
系统应实现适当的缓存策略以减少 CDN 成本。

#### 场景：ETag 响应头
- **当** 返回 ZIP 响应时
- **则** 系统应根据内容哈希生成 ETag 响应头

#### 场景：If-None-Match 请求头
- **当** 客户端发送 If-None-Match 请求头且与 ETag 匹配时
- **则** 系统应返回 304 Not Modified
