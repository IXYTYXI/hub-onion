## 1. 数据库迁移

- [x] 1.1 创建 `users` 表迁移脚本（id、github_id、handle、display_name、email、avatar_url、bio、role、created_at、updated_at）
- [x] 1.2 创建 `api_tokens` 表迁移脚本（id、user_id、label、token_hash、last_used_at、created_at）
- [x] 1.3 创建 `user_stars` 表迁移脚本（user_id、skill_id、created_at，联合唯一索引）
- [x] 1.4 `skills` 表新增 `owner_user_id` 列（nullable UUID，外键 users.id）
- [x] 1.5 `skills` 表新增 `stats_stars` 列（integer，默认 0）
- [x] 1.6 在 GORM model 中定义 User、APIToken、UserStar 结构体

## 2. GitHub OAuth 后端实现

- [x] 2.1 在 `config.go` 新增 `GitHubClientID`、`GitHubClientSecret`、`JWTSecret`、`FrontendURL` 配置项，绑定环境变量
- [x] 2.2 实现 `GET /auth/github` handler：生成随机 state 存 cookie，重定向到 GitHub OAuth URL
- [x] 2.3 实现 `GET /auth/github/callback` handler：验证 state、用 code 换 access token、获取 GitHub 用户信息
- [x] 2.4 实现 upsert user 逻辑：首次登录创建用户，重复登录更新 display_name/avatar_url/email
- [x] 2.5 实现 handle 唯一性保证逻辑（冲突时追加数字后缀）
- [x] 2.6 实现 JWT 颁发函数（payload: sub、handle、role、exp=30天）
- [x] 2.7 实现 `POST /auth/logout` handler：清除 clawhub_session cookie
- [x] 2.8 在 `routes.go` 注册 auth 路由组

## 3. 认证中间件

- [x] 3.1 实现 `AuthMiddleware`（可选认证）：从 cookie 或 Bearer header 解析 JWT，注入 current_user 到 context，无凭证时继续
- [x] 3.2 实现 `RequireAuth` 中间件：调用 AuthMiddleware 后检查 current_user，为 nil 则返回 401
- [x] 3.3 实现 CLI token 认证分支：Bearer token 非 JWT 格式时查 `api_tokens` 表验证 SHA-256 哈希，更新 last_used_at
- [x] 3.4 为现有受保护路由（POST /skills、DELETE /skills/:slug）添加 RequireAuth 中间件

## 4. 用户资料接口

- [x] 4.1 实现 `GET /api/v1/users/me` handler（需认证，返回完整用户信息）
- [x] 4.2 实现 `GET /api/v1/users/:handle` handler（公开，返回脱敏用户信息，不含 email/role）
- [x] 4.3 实现 `GET /api/v1/users/:handle/skills` handler（公开，分页，按 updated_at 降序）
- [x] 4.4 在 `routes.go` 注册用户资料路由

## 5. Stars 功能后端

- [x] 5.1 实现 `POST /api/v1/skills/:slug/star` handler（需认证，幂等 upsert）
- [x] 5.2 实现 `DELETE /api/v1/skills/:slug/star` handler（需认证）
- [x] 5.3 star/unstar 时同步更新 `skills.stats_stars` 计数
- [x] 5.4 实现 `GET /api/v1/users/me/stars` handler（需认证，分页，按收藏时间降序）
- [x] 5.5 修改 `GET /api/v1/skills/:slug` 响应，已登录用户包含 `isStarred` 字段
- [x] 5.6 在 `routes.go` 注册 stars 路由

## 6. CLI Token 管理后端

- [x] 6.1 实现 `POST /api/v1/users/me/tokens` handler（需认证，生成随机 token，存 SHA-256 哈希，返回原始 token）
- [x] 6.2 实现 `GET /api/v1/users/me/tokens` handler（需认证，返回 token 列表，不含 token 值）
- [x] 6.3 实现 `DELETE /api/v1/users/me/tokens/:id` handler（需认证，只能删除自己的 token）
- [x] 6.4 在 `routes.go` 注册 token 管理路由

## 7. skill 归属后端

- [x] 7.1 修改 publish handler：从 context 取 current_user，写入 `skills.owner_user_id`
- [x] 7.2 修改 delete handler：校验 current_user 是 owner 或 moderator/admin，否则返回 403
- [x] 7.3 修改 `GET /api/v1/skills/:slug` 响应，包含 owner 信息（handle、display_name、avatar_url）

## 8. 前端：auth 状态接入

- [x] 8.1 修改 `src/lib/useAuthStatus.ts`：调用 `GET /api/v1/users/me`，用 React Query 缓存，401 时返回未登录状态
- [x] 8.2 修改 `src/components/Header.tsx` 的 `useAuthActions`：`signIn` 跳转 `/auth/github`，`signOut` 调用 `POST /auth/logout` 后清除 query cache
- [x] 8.3 修改 `src/routes/cli/auth.tsx`：登录后调用 `POST /api/v1/users/me/tokens` 创建 CLI token，完成回调流程

## 9. 前端：用户页面接入

- [x] 9.1 修改 `src/routes/u/$handle.tsx`：调用 `GET /api/v1/users/:handle` 和 `GET /api/v1/users/:handle/skills` 替换占位符
- [x] 9.2 修改 `src/routes/dashboard.tsx`：调用 `GET /api/v1/users/me/skills`（即 `/users/:handle/skills` 用当前用户 handle）
- [x] 9.3 修改 `src/routes/stars.tsx`：调用 `GET /api/v1/users/me/stars` 替换占位符
- [x] 9.4 修改 `src/components/SkillDetailPage.tsx`：star 按钮调用 `POST/DELETE /api/v1/skills/:slug/star`，显示 `isStarred` 状态
- [x] 9.5 修改 `src/routes/settings.tsx`：展示 token 列表，支持创建和撤销 token

## 10. 测试与验证

- [ ] 10.1 为 auth middleware 编写单元测试（JWT 解析、CLI token 验证、无凭证场景）
- [ ] 10.2 为 OAuth callback handler 编写单元测试（state 验证、用户 upsert 逻辑）
- [ ] 10.3 在集成测试中添加认证场景（发布需登录、star 需登录、权限校验）
- [ ] 10.4 手动验证完整登录流程：GitHub OAuth → JWT cookie → 前端显示用户信息
- [ ] 10.5 手动验证 CLI token 流程：创建 token → 用 token 发布 skill → 撤销 token
- [x] 10.6 更新 `config.yaml` 注释，说明新增的环境变量（GITHUB_CLIENT_ID、GITHUB_CLIENT_SECRET、JWT_SECRET、FRONTEND_URL）
