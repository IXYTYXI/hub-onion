## Why

ClawHub 的 Go 后端目前没有用户系统，所有用户相关功能（登录、发布权限、个人主页、stars、CLI token）均为前端占位符。要让平台从匿名只读变为有归属感的社区，需要完整的用户认证与身份体系。

## What Changes

- 新增 GitHub OAuth 登录/登出流程（后端 callback 处理 + JWT session）
- 新增当前用户接口 `GET /users/me`，替换前端硬编码 mock
- 新增用户公开资料接口 `GET /users/:handle`，支持用户主页展示
- 新增发布权限控制：发布 skill 需携带有效 JWT，skill 归属当前用户
- 新增 stars 功能：`POST/DELETE /skills/:slug/star`、`GET /users/me/stars`
- 新增 CLI token 管理：`POST /users/me/tokens`、`GET /users/me/tokens`、`DELETE /users/me/tokens/:id`
- 新增用户 skill 列表：`GET /users/:handle/skills`
- 前端 `useAuthStatus` hook 替换为真实 API 调用
- 前端 Header 登录/登出按钮接入真实 OAuth 流程

## Capabilities

### New Capabilities

- `user-identity`: 用户账户模型、GitHub OAuth 认证、JWT session 管理
- `user-profile`: 用户公开资料查询、用户发布的 skills 列表
- `skill-ownership`: skill 发布与归属关系、发布权限校验
- `skill-stars`: 用户收藏（star/unstar）skill 功能
- `cli-tokens`: CLI API token 的创建、列举、撤销

### Modified Capabilities

- `skill-publishing`: 发布 skill 需要认证用户身份，skill 记录关联 `owner_user_id`
- `go-backend-api`: 新增认证中间件，受保护路由需携带 Bearer token

## Impact

- **数据库**：新增 `users`、`user_stars`、`api_tokens` 表；`skills` 表新增 `owner_user_id` 字段
- **后端**：新增 auth middleware、OAuth callback handler、用户相关 handler
- **前端**：`useAuthStatus`、`Header`、`cli/auth`、`dashboard`、`stars`、`settings`、`u/$handle` 页面全部接入真实接口
- **依赖**：后端新增 `golang-jwt/jwt`、`markbates/goth`（GitHub OAuth）
- **配置**：新增 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`JWT_SECRET` 环境变量
