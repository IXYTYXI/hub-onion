## 新增需求

### 需求：TanStack Query 设置
系统应配置 TanStack Query 作为数据获取库以替换 Convex hooks。

#### 场景：QueryClient 提供者设置
- **当** 应用初始化时
- **则** 系统应用 QueryClientProvider 包装应用

#### 场景：默认查询选项
- **当** 配置 QueryClient 时
- **则** 系统应为 staleTime、cacheTime 和重试行为设置适当的默认值

### 需求：API 客户端抽象
系统应提供集中式 API 客户端用于向后端发出 HTTP 请求。

#### 场景：基础 URL 配置
- **当** API 客户端初始化时
- **则** 系统应使用配置的基础 URL（如 /api/v1 或完整域名）

#### 场景：请求错误处理
- **当** API 请求失败时
- **则** 系统应解析错误响应并抛出类型化错误

#### 场景：响应解析
- **当** API 请求成功时
- **则** 系统应解析 JSON 响应并返回类型化数据

### 需求：Skills 查询 hooks
系统应提供用于查询 skills 数据的 React hooks。

#### 场景：用于列表的 useSkills hook
- **当** 组件使用 useSkills hook 时
- **则** 系统应从 GET /api/v1/skills 获取并返回类型化的 skill 列表

#### 场景：用于单个技能的 useSkill hook
- **当** 组件使用 useSkill(slug) hook 时
- **则** 系统应从 GET /api/v1/skills/{slug} 获取并返回类型化的技能详情

#### 场景：useSkillVersions hook
- **当** 组件使用 useSkillVersions(slug) hook 时
- **则** 系统应从 GET /api/v1/skills/{slug}/versions 获取并返回版本历史

### 需求：搜索查询 hook
系统应提供用于搜索 skills 的 hook。

#### 场景：useSearchSkills hook
- **当** 组件使用 useSearchSkills(query) hook 时
- **则** 系统应从 GET /api/v1/search?q={query} 获取并返回搜索结果

#### 场景：防抖搜索
- **当** 搜索查询快速变化时
- **则** 系统应防抖请求以避免过多的 API 调用

### 需求：Mutation hooks
系统应提供用于变更 skills 数据的 React hooks。

#### 场景：usePublishSkill mutation
- **当** 组件使用 usePublishSkill mutation 时
- **则** 系统应 POST 到 /api/v1/skills，附带多部分表单数据

#### 场景：useDeleteSkill mutation
- **当** 组件使用 useDeleteSkill mutation 时
- **则** 系统应发送 DELETE 到 /api/v1/skills/{slug}

#### 场景：useUndeleteSkill mutation
- **当** 组件使用 useUndeleteSkill mutation 时
- **则** 系统应 POST 到 /api/v1/skills/{slug}/undelete

#### 场景：变更后的缓存失效
- **当** mutation 成功时
- **则** 系统应使相关的查询缓存失效以触发重新获取

### 需求：加载和错误状态
系统应从 queries 和 mutations 中暴露加载和错误状态。

#### 场景：查询加载状态
- **当** 查询正在获取时
- **则** hook 应返回 isLoading: true

#### 场景：查询错误状态
- **当** 查询失败时
- **则** hook 应返回带消息的错误对象

#### 场景：Mutation 加载状态
- **当** mutation 正在进行时
- **则** hook 应返回 isPending: true

### 需求：移除 Convex 依赖
系统应移除前端中所有 Convex 相关代码。

#### 场景：移除 ConvexProvider
- **当** 更新 AppProviders 组件时
- **则** 系统应移除 ConvexProvider 和 ConvexAuthProvider

#### 场景：移除 Convex 客户端
- **当** 清理依赖时
- **则** 系统应删除 src/convex/client.ts 文件

#### 场景：移除 Convex 导入
- **当** 重构组件时
- **则** 系统应移除所有来自'convex/react'的导入并替换为 TanStack Query

### 需求：API 响应类型定义
系统应定义类型化的 API 响应。

#### 场景：Skill 类型定义
- **当** 定义 TypeScript 类型时
- **则** 应包含：
  - slug: string
  - displayName: string
  - summary: string | null
  - tags: string[] | object
  - stats: { downloads: number; installs: number; versions: number }
  - createdAt: number
  - updatedAt: number
  - latestVersion?: { version: string; createdAt: number; changelog: string }

#### 场景：SearchResult 类型定义
- **当** 定义 TypeScript 类型时
- **则** 应包含：
  - slug: string
  - displayName: string
  - summary: string | null
  - version: string | null
  - score: number
  - updatedAt?: number

### 需求：API 错误处理
系统应实现统一的错误处理机制。

#### 场景：HTTP 错误解析
- **当** API 请求失败时
- **则** 系统应解析响应体中的错误消息

#### 场景：网络错误处理
- **当** 发生网络错误时
- **则** 系统应返回友好的错误消息

#### 场景：超时处理
- **当** 请求超时时
- **则** 系统应返回超时错误并允许重试

### 需求：QueryClient 配置
系统应配置适当的 TanStack Query 选项。

#### 场景：staleTime 配置
- **当** 配置 QueryClient 时
- **则** staleTime 应设置为适当的值（如 1000ms）

#### 场景：cacheTime 配置
- **当** 配置 QueryClient 时
- **则** cacheTime 应设置为适当的值（如 5 分钟）

#### 场景：retry 配置
- **当** 配置 QueryClient 时
- **则** retry 应设置为 3 次重试

#### 场景：不需要背景轮询
- **当** 配置 QueryClient 时
- **则** refetchInterval 应设置为 disabled（不需要背景轮询）
- **理由**：Phase 1 不需要实时更新功能

### 需求：前端配置管理
系统应提供前端 API 配置。

#### 场景：基础 URL 配置
- **当** 应用启动时
- **则** 系统应从环境变量读取 API 基础 URL（VITE_API_BASE_URL）

#### 场景：开发环境配置
- **当** 在开发环境运行时
- **则** API 基础 URL 应默认为 /api/v1（开发服务器代理）

#### 场景：生产环境配置
- **当** 在生产环境运行时
- **则** API 基础 URL 应指向完整的 API 域名
