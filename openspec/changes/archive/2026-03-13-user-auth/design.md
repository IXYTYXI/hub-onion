## Context

ClawHub Go 后端（`backend/`）目前已实现 skill 的发布、搜索、下载等核心功能，但完全没有用户系统。前端所有用户相关页面（dashboard、settings、stars、cli/auth、u/$handle）均为 Phase 1 占位符，`useAuthStatus` 返回硬编码 mock 用户。

当前技术栈：Go + Gin + GORM + PostgreSQL，前端 React + TanStack Router + React Query。

## Goals / Non-Goals

**Goals:**
- GitHub OAuth 登录，后端颁发 JWT，前端存 cookie
- 受保护路由通过 Bearer token 或 cookie 校验身份
- skill 发布与用户绑定（owner_user_id）
- 用户公开资料与 skill 列表
- Stars 收藏功能
- CLI token（长期 API key）创建与管理

**Non-Goals:**
- 邮箱/密码注册登录
- 多 OAuth 提供商（仅 GitHub）
- 实时通知、关注系统
- 用户头像上传（使用 GitHub 头像）
- 权限细分（仅 user / moderator / admin 三级）

## Decisions

### 1. OAuth 方案：自实现 vs goth

选择**自实现 GitHub OAuth**（不引入 goth），原因：
- goth 依赖较重，对单一 provider 过度设计
- GitHub OAuth 流程简单（3 步：redirect → callback → exchange token）
- 减少外部依赖，便于维护

### 2. Session 方案：JWT cookie vs server-side session

选择 **JWT 存 HttpOnly cookie**：
- 无状态，后端不需要 session 存储
- HttpOnly + Secure + SameSite=Lax 防 XSS/CSRF
- JWT payload 包含 `user_id`、`handle`、`role`、`exp`
- 有效期 30 天，不做 refresh token（Phase 1 简化）

替代方案考虑：server-side session（需 Redis，复杂度高）、localStorage（XSS 风险）。

### 3. CLI token：JWT vs 随机 opaque token

选择**随机 opaque token**（`hex(32 bytes)`）存数据库：
- CLI token 需要可撤销，JWT 无法撤销
- 每次请求查库校验，性能可接受（token 数量少）
- 数据库存 `sha256(token)`，原始 token 只在创建时返回一次

### 4. skill 归属：发布时绑定 vs 事后关联

发布时从 JWT 中取 `user_id` 直接写入 `skills.owner_user_id`。
- 简单直接，无需事后迁移逻辑
- 历史无主 skill（`owner_user_id IS NULL`）保持可访问，但不可被任何用户管理

### 5. 前端 auth 状态：轮询 vs 单次请求

前端启动时调用一次 `GET /users/me`，结果存 React Query cache（staleTime: Infinity）。
登出时清除 cache + 清除 cookie。不做 WebSocket 实时同步。

## Risks / Trade-offs

- **JWT 无法提前失效** → 用户被封号后最多 30 天内仍可操作。缓解：moderator 操作走数据库校验，不依赖 JWT role 字段
- **GitHub OAuth 依赖外部服务** → GitHub 故障时无法登录。缓解：已登录用户不受影响（cookie 有效）
- **历史无主 skill** → `owner_user_id IS NULL` 的 skill 无人可管理。缓解：admin 可通过管理后台认领（Phase 2）
- **CLI token 查库** → 高频 CLI 操作每次查库。缓解：token 数量极少，加索引后可接受

## Migration Plan

1. 数据库迁移：新增 `users`、`user_stars`、`api_tokens` 表；`skills` 新增 `owner_user_id` 列（nullable）
2. 部署新后端（含 auth 路由）
3. 前端更新 `useAuthStatus` 接入真实 API
4. 现有 skill 的 `owner_user_id` 为 NULL，不影响读取，仅影响写操作权限

**回滚**：前端回滚到 mock `useAuthStatus`，后端回滚到无 auth 版本，数据库保留新表（不影响旧功能）。

## Open Questions

- GitHub OAuth callback URL 在生产环境的域名是什么？（需配置 GitHub App）
- 是否需要支持自托管实例使用不同的 GitHub App？（暂定：每个实例配自己的 Client ID/Secret）
