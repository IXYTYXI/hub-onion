## 背景

ClawHub 目前使用 Convex 作为其后端平台，提供数据库、文件存储和实时能力。虽然 Convex 提供快速开发能力，但它造成了供应商锁定并限制了部署灵活性。系统需要迁移到自托管技术栈，以实现：

- 对基础设施的完全控制和标准部署模式
- 消除专有平台依赖
- 成本可预测性和扩展控制
- 使用成熟工具的标准 PostgreSQL 数据库

当前架构：
- 前端：使用 Convex React hooks 进行数据 fetch 的 React
- 后端：Convex 函数（TypeScript）搭配 Convex 数据库
- CLI：HTTP 客户端调用 Convex HTTP API 端点
- 文件存储：Convex 文件存储

目标架构：
- 前端：使用 TanStack Query + fetch 的 React
- 后端：使用 PostgreSQL 数据库的 Go (Gin)
- CLI：无需修改（已基于 HTTP）
- 文件存储：CDN 提供商

## 目标 / 非目标

**目标：**
- 用 Go + PostgreSQL 替换 Convex 后端，保持所有 Phase 1 功能
- 实现与现有路由 schema 匹配的 RESTful API，以确保 CLI 兼容性
- 将前端从 Convex hooks 迁移到 TanStack Query，对用户零感知变化
- 提供基于 PostgreSQL 的搜索，性能与 Convex 相当
- 实现带有适当错误处理的 CDN 文件存储
- 确保确定性 ZIP 生成以进行内容哈希
- 通过适当的事务处理保持数据完整性

**非目标：**
- 认证系统（Phase 1 - 推迟到 Phase 2）
- 实时功能（订阅、实时更新）
- 审核工作流（star、评论、举报、封禁）
- Elasticsearch 集成（使用 PostgreSQL pg_trgm 替代）
- Discord webhook 或外部通知
- GitHub 备份功能
- 统计聚合和排行榜
- 迁移现有 Convex 数据（Phase 1 可以全新开始）

## 决策

### 决策 0：技术栈选择

**选择：**
- **ORM**：GORM（gorm.io/gorm）
- **连接池**：使用 GORM 默认配置，无需额外优化
- **文件元数据存储**：PostgreSQL JSONB 字段

**理由：**
- GORM 提供成熟的 ORM 功能，减少样板代码
- Phase 1 规模下默认配置足够
- JSONB 提供灵活的 schema-less 存储，适合文件元数据

### 决策 1：使用 Go + Gin 框架作为后端

**选择：** 使用 Go 和 Gin Web 框架

**理由：**
- Go 提供卓越的性能和低资源使用率
- Gin 成熟、文档完善、生态系统强大
- 标准库对 ZIP 生成、加密、HTTP 操作支持良好
- 易于部署为单一二进制文件
- 对 PostgreSQL 驱动支持良好（pgx、GORM）

**考虑的替代方案：**
- Node.js + Express：团队熟悉但内存使用率高，文件操作性能较差
- Rust + Actix：性能更好但学习曲线陡峭，开发速度较慢
- Python + FastAPI：适合快速开发但运行时性能较慢

### 决策 2：使用 PostgreSQL 配合 pg_trgm 进行搜索

**选择：** 使用 PostgreSQL ILIKE + pg_trgm 扩展进行全文本搜索

**理由：**
- 避免额外基础设施（Elasticsearch）
- pg_trgm 提供带有相似度评分的良好模糊匹配
- GIN 索引使三元组搜索性能优异
- 更简单的运维模型（单一数据库）
- 对 Phase 1 规模足够（预计 < 10k skills）

**数据表设计确认：**
- Phase 1 仅需 `skills` 和 `skill_versions` 两个表
- 暂不需要 `users` 表（认证相关功能推迟到 Phase 2）
- 文件元数据使用 JSONB 存储在 `skill_versions.files` 字段

**考虑的替代方案：**
- Elasticsearch：搜索质量更好但增加运维复杂性
- PostgreSQL 全文搜索（tsvector）：模糊匹配灵活性较差
- 外部搜索服务（Algolia、Meilisearch）：额外成本和依赖

**权衡：** 搜索质量可能略低于 Elasticsearch，但对 Phase 1 可接受。如果需要可以在 Phase 2 迁移到 ES。

### 决策 3：使用 CDN 进行文件存储

**选择：**
- 使用阿里云 OSS（S3 协议兼容）作为 CDN 存储提供商
- 文件上传通过后端中转（不直接上传到 CDN）
- 使用流式处理避免内存缓冲
- 不生成预签名 URL（所有下载通过后端 API）

**理由：**
- 阿里云 OSS 提供可靠的存储服务，S3 协议兼容降低集成复杂度
- 后端中转上传可以统一验证和错误处理
- 流式处理避免大文件占用内存（50MB 上传仅需 32KB 缓冲区）
- 不暴露 CDN 细节给客户端，简化架构
- 无需预签名 URL 简化实现

**存储键格式：** `skills/{skill_id}/{version_id}/{file_path}`

**流式上传实现：**
```go
type StorageService interface {
    // 流式上传，接受 io.Reader 而非 []byte
    Upload(ctx context.Context, key string, reader io.Reader, contentType string) error
    Download(ctx context.Context, key string) (io.ReadCloser, error)
    Delete(ctx context.Context, key string) error
}

// 使用 AWS SDK v2 连接阿里云 OSS
func NewOSSClient(cfg OSSConfig) (*s3.Client, error) {
    creds := credentials.NewStaticCredentialsProvider(
        cfg.AccessKeyID,
        cfg.AccessKeySecret,
        "",
    )

    awsCfg, _ := config.LoadDefaultConfig(context.TODO(),
        config.WithRegion(cfg.Region),
        config.WithCredentialsProvider(creds),
    )

    return s3.NewFromConfig(awsCfg, func(o *s3.Options) {
        o.BaseEndpoint = aws.String("https://" + cfg.Endpoint)
        o.UsePathStyle = false // OSS 使用虚拟主机风格
    }), nil
}

// 流式上传 + 同时计算 SHA-256
func (s *StorageService) UploadWithHash(ctx context.Context, key string, file io.Reader) (string, error) {
    hasher := sha256.New()
    teeReader := io.TeeReader(file, hasher) // 边读边计算哈希

    _, err := s.client.PutObject(ctx, &s3.PutObjectInput{
        Bucket: aws.String(s.bucket),
        Key:    aws.String(key),
        Body:   teeReader, // 流式上传
    })

    return hex.EncodeToString(hasher.Sum(nil)), err
}
```

**阿里云 OSS 配置：**
- 端点格式：`oss-{region}.aliyuncs.com`（公网）或 `oss-{region}-internal.aliyuncs.com`（内网）
- 示例：`oss-cn-hangzhou.aliyuncs.com`
- 使用 S3 兼容 API（AWS SDK v2）
- 虚拟主机风格访问：`https://{bucket}.{endpoint}/{key}`

**考虑的替代方案：**
- 本地文件系统：简单但无法扩展，无冗余
- 直接客户端上传：需要预签名 URL，增加复杂度
- 其他 S3 兼容提供商（Cloudflare R2、MinIO）

**权衡：** 后端中转上传增加服务器带宽使用，但通过流式处理将内存开销降至最低（32KB vs 50MB），并简化了整体架构。

### 决策 4：确定性 ZIP 生成

**选择：** 按路径排序文件，使用固定时间戳，一致压缩

**理由：**
- 通过哈希匹配实现基于内容的版本控制
- CLI 可以通过比较哈希检测更新
- 可验证的可重现构建
- 与现有 Convex 实现对齐

**实现细节：**
- 在添加到 ZIP 之前按路径字典序排序文件
- 将所有文件修改时间设置为 Unix 纪元（1970-01-01）
- 使用固定级别的标准 deflate 压缩
- 包含带有版本元数据的 _meta.json

### 决策 5：使用 TanStack Query 进行前端数据获取

**选择：** 用 TanStack Query + fetch 替换 Convex hooks

**理由：**
- React 数据获取的行业标准
- 提供缓存、去重、后台重新获取
- 与 Convex hooks 类似的开发者体验
- 无供应商锁定，适用于任何 HTTP API

**迁移模式：**
```typescript
// 之前：Convex
const skills = useQuery(api.skills.listPublicPageV2, { limit: 25 })

// 之后：TanStack Query
const { data: skills } = useQuery({
  queryKey: ['skills', 'list', { limit: 25 }],
  queryFn: () => fetch('/api/v1/skills?limit=25').then(r => r.json())
})
```

**考虑的替代方案：**
- SWR：类似能力但生态系统较小
- Apollo Client：过度设计，专注于 GraphQL
- Redux Toolkit Query：需要 Redux，更多样板代码

### 决策 6：数据库事务策略

**选择：** 对所有多步骤操作使用事务（发布、删除）

**理由：**
- 确保技能发布的原子性（版本 + 技能更新）
- 防止失败时的部分状态
- 简化错误处理和回滚

**实现：**
- 将发布操作包装在事务中：创建版本 → 更新 skill.latest_version_id
- 在 CDN 上传失败时，回滚事务并删除已上传文件
- 使用 PostgreSQL 隔离级别 READ COMMITTED（默认）

### 决策 7：多部分上传验证

**选择：** 在处理之前验证 slug、版本、文件类型和大小

**理由：**
- 防止无效数据进入系统
- 快速失败并提供清晰的错误消息
- 防止恶意上传

**验证规则：**
- Slug：^[a-z0-9-]+$，长度 3-50
- 版本：有效的 semver（使用 go-semver 库）
- 文件：仅限文本类型（.md、.txt、.json、.yaml、.js、.ts、.py、.sh）
- 总大小：<= 50MB
- 为每个文件计算 SHA-256 哈希

### 决策 8：Phase 1 不使用认证

**选择：** 将认证推迟到 Phase 2，所有端点公开

**理由：**
- 降低初始复杂性
- 允许专注于核心功能
- 认证可以作为中间件层在后期添加
- CLI 已有可以返回 501 的认证命令

**影响：**
- DELETE 和 POST 端点未受保护（Phase 1 可接受）
- 前端隐藏依赖认证的 UI（登录、stars、评论）
- 数据库 schema 包含 user_id 字段（可为空，供 Phase 2 使用）

## 风险 / 权衡

### 风险 1：PostgreSQL 搜索在大规模下的性能
**风险：** pg_trgm 搜索在 10k+ skills 时可能变慢

**缓解：**
- 在 display_name 和 description 上使用 GIN 索引
- 限制搜索结果最多 100 条
- 监控查询性能，必要时添加缓存
- 如果需要可以在 Phase 2 迁移到 Elasticsearch

### 风险 2：发布期间的 CDN 上传失败
**风险：** 如果 CDN 在半途中失败可能导致部分上传

**缓解：**
- 将整个发布包装在事务中
- 失败时删除已上传的 CDN 文件后回滚
- 使用指数退避实现重试逻辑（3 次尝试）
- 向用户返回清晰的错误消息

### 风险 3：前端重构范围
**风险：** 28 个文件需要重构，可能出现 bug

**缓解：**
- 创建带有类型化响应的集中式 API 客户端
- 渐进式重构，测试每个组件
- 使用 TypeScript 捕获类型不匹配
- 在 git 历史中保留 Convex 代码供参考

### 风险 4：CLI 兼容性
**风险：** Go 后端 JSON 响应可能与 Convex 格式不完全匹配

**缓解：**
- 参考 packages/schema/src/ 获取确切类型
- 在启动前针对 Go 后端测试 CLI 命令
- 使用与 Convex 响应相同的字段名和结构
- 为 CLI 工作流添加集成测试

### 风险 5：数据迁移复杂性
**风险：** 将现有 Convex 数据迁移到 PostgreSQL

**缓解：**
- Phase 1 采用全新开始策略（不需要迁移现有数据）
- 如果需要迁移，通过 API 导出 Convex 数据
- 编写迁移脚本：Convex JSON → PostgreSQL INSERT
- 迁移后验证数据完整性

### 风险 6：无实时更新
**风险：** 用户期望实时更新（新 skills、版本变更）

**缓解：**
- Phase 1 不需要 TanStack Query 轮询
- 在 Phase 1 发布说明中记录限制
- 计划 Phase 2 支持 WebSocket
- 大多数用例不需要实时（CLI、浏览）

### 风险 7：CDN 成本不可预测
**风险：** 随着受欢迎程度增加，CDN 带宽成本可能飙升

**缓解：**
- 设置账单提醒
- 在下载端点实施速率限制
- 在 CDN 边缘缓存频繁访问的文件
- 监控带宽使用并在必要时优化

## 迁移计划

### Phase 1：开发
1. 设置 Go 项目结构和 PostgreSQL 数据库
2. 实现后端 API 端点
3. 重构前端组件
4. 验证所有关键工作流（发布、搜索、下载、安装）

**Phase 1 范围确认：**
- 数据：全新开始，不需要从 Convex 迁移现有数据（目前无生产数据）
- 部署：开发阶段，不需要 Docker 容器化
- 测试：使用集成测试验证关键流程，不编写单元测试

### Phase 2：部署
1. 部署 Go 后端到生产环境
2. 更新前端指向新后端
3. 部署前端变更
4. 监控错误率和性能
5. 保持 Convex 后端运行 1 周作为回退

### Phase 3：清理
1. 验证所有功能在新栈上正常工作
2. 禁用 Convex 后端
3. 从 package.json 移除 Convex 依赖
4. 在 git 中归档 Convex 代码

### 回退策略
- 如果发现关键问题，将前端恢复为使用 Convex 后端
- 迁移后保持 Convex 后端活动 1 周
- 数据库回退：从备份恢复 PostgreSQL
- CDN 回退：文件保持可访问，不需要清理
