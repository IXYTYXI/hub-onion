# 前端组件重构需求文档

## 概述

将前端从 Convex 迁移到 TanStack Query + Go 后端 API。需要重构 20 个使用 Convex hooks 的文件。

## 当前状态分析

### 使用 Convex 的文件列表 (20 个)

1. **核心基础设施**
   - `src/convex/client.ts` - Convex 客户端配置
   - `src/lib/useAuthStatus.ts` - 认证状态管理
   - `src/components/UserBootstrap.tsx` - 用户初始化

2. **技能相关页面**
   - `src/routes/skills/index.tsx` - 技能列表页面
   - `src/routes/skills/-useSkillsBrowseModel.ts` - 技能浏览逻辑
   - `src/routes/upload.tsx` - 技能上传页面
   - `src/components/SkillDetailPage.tsx` - 技能详情页面
   - `src/components/SkillFilesPanel.tsx` - 技能文件面板
   - `src/components/SkillDiffCard.tsx` - 技能差异卡片
   - `src/components/SkillCommentsPanel.tsx` - 技能评论面板

3. **Souls 相关**
   - `src/routes/souls/index.tsx` - Souls 列表页面
   - `src/components/SoulDetailPage.tsx` - Soul 详情页面

4. **用户相关**
   - `src/routes/u/$handle.tsx` - 用户资料页面
   - `src/routes/stars.tsx` - 收藏页面
   - `src/routes/dashboard.tsx` - 仪表板
   - `src/routes/settings.tsx` - 设置页面

5. **管理和其他**
   - `src/routes/management.tsx` - 管理页面
   - `src/routes/import.tsx` - 导入页面
   - `src/routes/cli/auth.tsx` - CLI 认证
   - `src/routes/index.tsx` - 首页

## 重构策略

### Phase 1: 核心功能（无认证）

重构以下核心功能，暂时移除认证相关功能：

#### 1. 技能列表和搜索

**文件**: `src/routes/skills/index.tsx`, `src/routes/skills/-useSkillsBrowseModel.ts`

**当前实现**:
```typescript
// Convex hooks
const totalSkills = useQuery(api.skills.countPublicSkills)
const { results, status, loadMore } = usePaginatedQuery(
  api.skills.listPublicPageV2,
  { sort, dir, highlightedOnly, nonSuspiciousOnly },
  { initialNumItems: 25 }
)
const searchSkills = useAction(api.search.searchSkills)
```

**目标实现**:
```typescript
// TanStack Query hooks
const { data: totalSkills } = useQuery({
  queryKey: ['skills', 'count'],
  queryFn: () => fetch('/api/v1/skills/count').then(r => r.json())
})

const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['skills', 'list', { sort, dir, highlightedOnly, nonSuspiciousOnly }],
  queryFn: ({ pageParam }) =>
    fetch(`/api/v1/skills?limit=25&cursor=${pageParam || ''}&sort=${sort}&dir=${dir}`)
      .then(r => r.json()),
  getNextPageParam: (lastPage) => lastPage.nextCursor
})

const { data: searchResults } = useQuery({
  queryKey: ['skills', 'search', query],
  queryFn: () => fetch(`/api/v1/search?q=${query}`).then(r => r.json()),
  enabled: query.length > 0
})
```

**需要的 API 端点**:
- ✅ `GET /api/v1/skills` - 已实现
- ✅ `GET /api/v1/search` - 已实现
- ⚠️ `GET /api/v1/skills/count` - 需要添加

**重构任务**:
1. 创建 `src/hooks/useSkillsList.ts` - 封装列表查询逻辑
2. 创建 `src/hooks/useSkillsSearch.ts` - 封装搜索逻辑
3. 重构 `-useSkillsBrowseModel.ts` 使用新 hooks
4. 更新 `index.tsx` 组件
5. 处理加载状态和错误状态
6. 实现无限滚动分页

#### 2. 技能详情

**文件**: `src/components/SkillDetailPage.tsx`

**当前实现**:
```typescript
const skillData = useQuery(api.skills.getBySlug, { slug })
const starSkill = useMutation(api.skills.star)
const unstarSkill = useMutation(api.skills.unstar)
const deleteSkill = useMutation(api.skills.deleteSkill)
const undeleteSkill = useMutation(api.skills.undeleteSkill)
```

**目标实现**:
```typescript
const { data: skillData } = useQuery({
  queryKey: ['skills', 'detail', slug],
  queryFn: () => fetch(`/api/v1/skills/${slug}`).then(r => r.json())
})

const { data: versions } = useQuery({
  queryKey: ['skills', 'versions', slug],
  queryFn: () => fetch(`/api/v1/skills/${slug}/versions`).then(r => r.json())
})

// Phase 1: 移除 star/unstar 功能（需要认证）
// Phase 2: 重新实现

const deleteSkillMutation = useMutation({
  mutationFn: (slug: string) =>
    fetch(`/api/v1/skills/${slug}`, { method: 'DELETE' }).then(r => r.json()),
  onSuccess: () => {
    queryClient.invalidateQueries(['skills'])
  }
})
```

**需要的 API 端点**:
- ✅ `GET /api/v1/skills/:slug` - 已实现
- ✅ `GET /api/v1/skills/:slug/versions` - 已实现
- ✅ `DELETE /api/v1/skills/:slug` - 已实现
- ✅ `POST /api/v1/skills/:slug/undelete` - 已实现

**重构任务**:
1. 创建 `src/hooks/useSkill.ts` - 封装详情查询
2. 创建 `src/hooks/useSkillVersions.ts` - 封装版本查询
3. 使用已创建的 `useDeleteSkill.ts` 和 `useUndeleteSkill.ts`
4. 重构 `SkillDetailPage.tsx` 使用新 hooks
5. **暂时隐藏**: Star/Unstar 按钮、评论面板、用户资料链接
6. 保留组件结构，添加 `data-phase2` 属性标记

#### 3. 技能上传/发布

**文件**: `src/routes/upload.tsx`

**当前实现**:
```typescript
const generateUploadUrl = useMutation(api.uploads.generateUploadUrl)
const publishVersion = useAction(api.skills.publishVersion)
const generateChangelogPreview = useAction(api.skills.generateChangelogPreview)
const existingSkill = useQuery(api.skills.getBySlug, { slug })
```

**目标实现**:
```typescript
// 直接上传到 Go 后端，不需要预签名 URL
const publishSkillMutation = useMutation({
  mutationFn: async (data: PublishData) => {
    const formData = new FormData()

    // 添加 payload
    const payload = {
      slug: data.slug,
      displayName: data.displayName,
      version: data.version,
      changelog: data.changelog,
      tags: data.tags
    }
    formData.append('payload', new Blob([JSON.stringify(payload)], { type: 'application/json' }))

    // 添加文件
    data.files.forEach(file => {
      formData.append('files', file, file.name)
    })

    return fetch('/api/v1/skills', {
      method: 'POST',
      body: formData
    }).then(r => r.json())
  },
  onSuccess: (result) => {
    queryClient.invalidateQueries(['skills'])
    navigate({ to: `/skills/${result.skillId}` })
  }
})

const { data: existingSkill } = useQuery({
  queryKey: ['skills', 'detail', slug],
  queryFn: () => fetch(`/api/v1/skills/${slug}`).then(r => r.json()),
  enabled: Boolean(slug)
})
```

**需要的 API 端点**:
- ✅ `POST /api/v1/skills` - 已实现（multipart upload）
- ✅ `GET /api/v1/skills/:slug` - 已实现

**重构任务**:
1. 使用已创建的 `src/hooks/usePublishSkill.ts`
2. 重构 `upload.tsx` 使用新 hook
3. 移除 Convex 上传 URL 生成逻辑
4. 更新文件上传逻辑为 multipart form-data
5. **暂时移除**: Changelog AI 生成功能（需要后端支持）
6. 更新错误处理和验证

#### 4. 技能文件查看

**文件**: `src/components/SkillFilesPanel.tsx`

**当前实现**:
```typescript
const fileContent = useQuery(api.skills.getFileContent, {
  skillId,
  versionId,
  path
})
```

**目标实现**:
```typescript
const { data: fileContent } = useQuery({
  queryKey: ['skills', 'file', skillId, versionId, path],
  queryFn: () =>
    fetch(`/api/v1/skills/${skillId}/versions/${versionId}/files/${encodeURIComponent(path)}`)
      .then(r => r.text())
})
```

**需要的 API 端点**:
- ⚠️ `GET /api/v1/skills/:skillId/versions/:versionId/files/:path` - 需要实现

**重构任务**:
1. 创建 `src/hooks/useSkillFile.ts`
2. 重构 `SkillFilesPanel.tsx`
3. 后端实现文件读取端点

### Phase 1: 暂时移除的功能

以下功能依赖认证，Phase 1 暂时隐藏或禁用：

#### 1. 认证相关 UI

**文件**: 所有使用 `useAuthStatus` 的组件

**处理方式**:
```typescript
// 创建 stub 实现
export function useAuthStatus() {
  return {
    isAuthenticated: false,
    isLoading: false,
    me: null
  }
}
```

**需要隐藏的 UI 元素**:
- 登录/注册按钮
- 用户头像和菜单
- Star/Unstar 按钮
- 评论功能
- 用户资料链接
- 仪表板链接
- 设置链接

**实现方式**:
```tsx
// 添加条件渲染
{isAuthenticated && (
  <button data-phase2="auth-required">Star</button>
)}

// 或添加禁用状态
<button disabled data-phase2="auth-required" title="Available in Phase 2">
  Star
</button>
```

#### 2. 用户相关页面

**文件**:
- `src/routes/u/$handle.tsx` - 用户资料
- `src/routes/stars.tsx` - 收藏列表
- `src/routes/dashboard.tsx` - 仪表板
- `src/routes/settings.tsx` - 设置

**处理方式**:
- 添加占位符页面显示 "Coming in Phase 2"
- 或重定向到首页
- 保留路由定义，便于 Phase 2 恢复

#### 3. 评论功能

**文件**: `src/components/SkillCommentsPanel.tsx`

**处理方式**:
```tsx
export function SkillCommentsPanel() {
  return (
    <div className="comments-placeholder" data-phase2="comments">
      <p>Comments will be available in Phase 2</p>
    </div>
  )
}
```

#### 4. 管理功能

**文件**: `src/routes/management.tsx`

**处理方式**:
- 暂时禁用管理页面
- 或显示 "Admin features coming in Phase 2"

#### 5. Souls 功能

**文件**:
- `src/routes/souls/index.tsx`
- `src/components/SoulDetailPage.tsx`

**处理方式**:
- Phase 1 专注于 Skills
- Souls 功能暂时禁用或显示占位符

### Phase 2: 认证和高级功能（未来）

Phase 2 将实现：
- 用户认证（JWT 或 session）
- Star/Unstar 功能
- 评论系统
- 用户资料
- 仪表板
- 管理功能
- Souls 支持

## 技术实现细节

### 1. TanStack Query 配置

**文件**: `src/lib/queryClient.ts`

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
```

### 2. API 客户端

**文件**: `src/lib/apiClient.ts`

```typescript
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/v1'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ApiError(
      error.error || 'Request failed',
      response.status,
      error
    )
  }

  return response.json()
}
```

### 3. 类型定义

**文件**: `src/types/api.ts`

```typescript
// 匹配后端 Go 类型
export interface Skill {
  id: string
  slug: string
  displayName: string
  description?: string
  tags: string[]
  moderationStatus: string
  latestVersionId?: string
  createdAt: string
  updatedAt: string
  latestVersion?: VersionInfo
}

export interface VersionInfo {
  version: string
  createdAt: number
  changelog: string
}

export interface SkillListResponse {
  items: SkillItem[]
  nextCursor: string | null
}

export interface SkillItem {
  slug: string
  displayName: string
  summary?: string
  tags: string[]
  stats: {
    downloads: number
    installs: number
    versions: number
  }
  createdAt: number
  updatedAt: number
  latestVersion?: VersionInfo
}

export interface SearchResult {
  slug: string
  displayName: string
  summary?: string
  version?: string
  score: number
  updatedAt?: number
}

export interface SearchResponse {
  results: SearchResult[]
}

export interface PublishPayload {
  slug: string
  displayName: string
  version: string
  changelog: string
  tags: string[]
}

export interface PublishResponse {
  ok: string
  skillId: string
  versionId: string
}
```

### 4. 自定义 Hooks

#### useSkills (列表)

**文件**: `src/hooks/useSkills.ts`

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/apiClient'
import type { SkillListResponse } from '../types/api'

interface UseSkillsOptions {
  sort?: string
  dir?: 'asc' | 'desc'
  limit?: number
}

export function useSkills(options: UseSkillsOptions = {}) {
  const { sort = 'downloads', dir = 'desc', limit = 25 } = options

  return useInfiniteQuery({
    queryKey: ['skills', 'list', { sort, dir, limit }],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(limit),
        sort,
        dir,
      })
      if (pageParam) params.set('cursor', pageParam)

      return apiRequest<SkillListResponse>(`/skills?${params}`)
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}
```

#### useSkill (详情)

**文件**: `src/hooks/useSkill.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/apiClient'
import type { SkillDetailResponse } from '../types/api'

export function useSkill(slug: string) {
  return useQuery({
    queryKey: ['skills', 'detail', slug],
    queryFn: () => apiRequest<SkillDetailResponse>(`/skills/${slug}`),
    enabled: Boolean(slug),
  })
}
```

#### useSearchSkills

**文件**: `src/hooks/useSearchSkills.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/apiClient'
import type { SearchResponse } from '../types/api'

export function useSearchSkills(query: string) {
  return useQuery({
    queryKey: ['skills', 'search', query],
    queryFn: () => {
      const params = new URLSearchParams({ q: query })
      return apiRequest<SearchResponse>(`/search?${params}`)
    },
    enabled: query.length > 0,
  })
}
```

#### usePublishSkill

**文件**: `src/hooks/usePublishSkill.ts` (已创建)

需要更新以使用 multipart form-data。

### 5. 错误处理

**文件**: `src/components/ErrorBoundary.tsx`

```typescript
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const { reset } = useQueryErrorResetBoundary()

  return (
    <ReactErrorBoundary
      onReset={reset}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <pre>{error.message}</pre>
          <button onClick={resetErrorBoundary}>Try again</button>
        </div>
      )}
    >
      {children}
    </ReactErrorBoundary>
  )
}
```

## 实施计划

### 阶段 1: 基础设施 (1-2 天)

1. ✅ 创建 TanStack Query 配置
2. ✅ 创建 API 客户端
3. ✅ 定义类型
4. ✅ 创建基础 hooks (useSkills, useSkill, useSearchSkills, usePublishSkill, useDeleteSkill, useUndeleteSkill)
5. 设置错误边界

### 阶段 2: 技能列表和搜索 (2-3 天)

1. 重构 `-useSkillsBrowseModel.ts`
2. 重构 `src/routes/skills/index.tsx`
3. 更新 `SkillsResults` 组件
4. 更新 `SkillsToolbar` 组件
5. 测试分页和搜索

### 阶段 3: 技能详情 (2-3 天)

1. 重构 `SkillDetailPage.tsx`
2. 隐藏认证相关 UI
3. 更新删除/恢复功能
4. 测试详情页面

### 阶段 4: 技能上传 (2-3 天)

1. 重构 `upload.tsx`
2. 更新文件上传逻辑
3. 移除 Changelog AI 生成
4. 测试上传流程

### 阶段 5: 清理和测试 (1-2 天)

1. 移除所有 Convex 导入
2. 删除 `src/convex/client.ts`
3. 更新认证相关组件为 stub
4. 添加 Phase 2 占位符
5. 全面测试

### 阶段 6: 文档和部署 (1 天)

1. 更新 README
2. 文档化 Phase 2 计划
3. 部署到测试环境
4. 验证 CLI 兼容性

## 需要的后端 API 端点

### 已实现 ✅

- `GET /api/v1/health`
- `GET /.well-known/clawhub.json`
- `GET /api/v1/skills`
- `GET /api/v1/skills/:slug`
- `GET /api/v1/skills/:slug/versions`
- `POST /api/v1/skills` (multipart)
- `DELETE /api/v1/skills/:slug`
- `POST /api/v1/skills/:slug/undelete`
- `GET /api/v1/search`
- `GET /api/v1/download`
- `GET /api/v1/resolve`

### 需要添加 ⚠️

- `GET /api/v1/skills/count` - 返回技能总数
- `GET /api/v1/skills/:skillId/versions/:versionId/files/:path` - 读取单个文件内容

## 风险和缓解

### 风险 1: 分页逻辑复杂

**缓解**:
- 使用 TanStack Query 的 `useInfiniteQuery`
- 参考现有 Convex 分页逻辑
- 充分测试边界情况

### 风险 2: 搜索性能

**缓解**:
- 后端已使用 pg_trgm 优化
- 添加防抖（debounce）
- 缓存搜索结果

### 风险 3: 文件上传大小限制

**缓解**:
- 前端验证文件大小
- 后端限制 50MB
- 显示清晰的错误消息

### 风险 4: 用户体验降级

**缓解**:
- 保留所有 UI 结构
- 添加 "Coming in Phase 2" 消息
- 确保核心功能完整

## 成功标准

### 功能完整性

- ✅ 技能列表和分页工作正常
- ✅ 搜索功能正常
- ✅ 技能详情显示正确
- ✅ 技能上传成功
- ✅ 删除/恢复功能正常
- ✅ 错误处理完善

### 性能

- 首次加载 < 2 秒
- 搜索响应 < 500ms
- 分页加载 < 1 秒

### 代码质量

- 无 TypeScript 错误
- 无 ESLint 警告
- 所有 Convex 导入已移除
- 代码结构清晰

### 用户体验

- 加载状态清晰
- 错误消息友好
- Phase 2 功能有明确说明
- CLI 兼容性保持

## 附录

### A. Convex vs TanStack Query 对照表

| Convex | TanStack Query | 说明 |
|--------|----------------|------|
| `useQuery(api.x.y, args)` | `useQuery({ queryKey, queryFn })` | 基础查询 |
| `useMutation(api.x.y)` | `useMutation({ mutationFn })` | 变更操作 |
| `useAction(api.x.y)` | `useMutation({ mutationFn })` | 异步操作 |
| `usePaginatedQuery(...)` | `useInfiniteQuery(...)` | 分页查询 |
| 自动缓存失效 | 手动 `invalidateQueries` | 缓存管理 |
| 实时订阅 | 轮询或 WebSocket | 实时更新 |

### B. 文件清单

**需要重构的文件 (20 个)**:
1. src/convex/client.ts
2. src/lib/useAuthStatus.ts
3. src/components/UserBootstrap.tsx
4. src/routes/skills/index.tsx
5. src/routes/skills/-useSkillsBrowseModel.ts
6. src/routes/upload.tsx
7. src/components/SkillDetailPage.tsx
8. src/components/SkillFilesPanel.tsx
9. src/components/SkillDiffCard.tsx
10. src/components/SkillCommentsPanel.tsx
11. src/routes/souls/index.tsx
12. src/components/SoulDetailPage.tsx
13. src/routes/u/$handle.tsx
14. src/routes/stars.tsx
15. src/routes/dashboard.tsx
16. src/routes/settings.tsx
17. src/routes/management.tsx
18. src/routes/import.tsx
19. src/routes/cli/auth.tsx
20. src/routes/index.tsx

**需要创建的文件**:
- src/lib/queryClient.ts
- src/lib/apiClient.ts
- src/types/api.ts
- src/hooks/useSkills.ts
- src/hooks/useSkill.ts
- src/hooks/useSkillVersions.ts
- src/hooks/useSearchSkills.ts
- src/hooks/useSkillFile.ts
- src/components/ErrorBoundary.tsx

**已创建的文件** ✅:
- src/hooks/usePublishSkill.ts
- src/hooks/useDeleteSkill.ts
- src/hooks/useUndeleteSkill.ts
- src/hooks/useDownloadSkill.ts
- src/hooks/useResolveVersion.ts

### C. 环境变量

```env
# .env.development
VITE_API_BASE=http://localhost:8080/api/v1

# .env.production
VITE_API_BASE=https://api.clawhub.com/api/v1
```

### D. 测试清单

**单元测试**:
- [ ] API 客户端错误处理
- [ ] Hooks 返回正确数据
- [ ] 类型定义正确

**集成测试**:
- [ ] 技能列表加载
- [ ] 搜索功能
- [ ] 技能详情
- [ ] 上传流程
- [ ] 删除/恢复

**E2E 测试**:
- [ ] 完整用户流程
- [ ] 错误场景
- [ ] 边界情况

**CLI 兼容性测试**:
- [ ] `claw search`
- [ ] `claw install`
- [ ] `claw publish`
