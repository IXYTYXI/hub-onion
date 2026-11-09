## 为什么

当前的 Convex 后端造成了供应商锁定并限制了部署灵活性。迁移到自托管的 Go + PostgreSQL 技术栈可以提供对基础设施的完全控制，实现标准部署模式，并消除对 Convex 专有平台的依赖，同时保持所有核心功能。

## 变更内容

- 用 `backend/` 目录中的 Go (Gin 框架) + PostgreSQL 后端替换 Convex 后端
- 实现与现有路由 schema 匹配的 RESTful HTTP API (`/api/v1/*`)
- 将数据模型从 Convex 迁移到 PostgreSQL，带有适当的索引和搜索功能
- 用基于 CDN 的文件存储替换 Convex 文件存储
- 将前端从 Convex React hooks 重构为 TanStack Query + fetch
- 更新 28 个前端组件文件以使用新的 API 客户端
- 确保 CLI 与新后端的兼容性（CLI 本身无需修改）
- **Phase 1 范围**：无认证、无实时功能、无审核工作流
- **破坏性变更**：完全移除 Convex 依赖 - 需要数据迁移

## 能力

### 新增能力
- `go-backend-api`: 完整的 Go 后端，包含 Gin 框架、PostgreSQL 数据库和 RESTful API 端点
- `skill-crud-operations`: Skills 的 CRUD 操作（列表、获取、创建、删除、恢复）
- `skill-search`: 基于 PostgreSQL 的全文本搜索，使用 ILIKE 和 pg_trgm 扩展
- `skill-publishing`: 多部分文件上传，包含验证、SHA-256 哈希和 CDN 存储
- `skill-download`: ZIP 归档生成，带有确定性排序和元数据
- `skill-version-resolution`: 版本解析和哈希匹配，用于 CLI 更新
- `cdn-file-storage`: CDN 集成，用于技能文件存储，包含上传/下载/删除操作
- `frontend-api-client`: 基于 TanStack Query 的 API 客户端，替换 Convex hooks
- `registry-discovery`: 用于注册表发现的 Well-known 端点 (/.well-known/clawhub.json)

### 修改的能力
<!-- 没有现有能力被修改 - 这是一个完整的后端替换 -->

## 影响

**后端:**
- 新的 `backend/` 目录，包含完整的 Go 应用程序
- 带有迁移的 PostgreSQL 数据库
- 需要 CDN 存储配置

**前端:**
- 移除 `src/convex/client.ts`
- 更新 `src/components/AppProviders.tsx` 以移除 ConvexAuthProvider
- 重构 28 个使用 Convex hooks 的组件文件
- 禁用/隐藏依赖认证的 UI 元素

**CLI:**
- 不需要代码修改（已经使用 HTTP API）
- 需要后端实现兼容的 JSON 响应格式
- Phase 1 中认证命令将返回 501

**基础设施:**
- 需要 PostgreSQL 实例（本地 Docker 或托管服务）
- 需要 CDN 服务配置
- 需要 Go 1.22+ 运行时
