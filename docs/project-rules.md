---
summary: '项目级稳定规则：构建、镜像、环境变量、OAuth、数据库、对象存储与发布约束。'
read_when:
  - 开始打包前后端镜像
  - 准备测试或生产发布
  - 调整前端 VITE 变量、后端 GO_ENV、OAuth 与对象存储配置
---

# Project Rules

本文档只记录“应长期记住”的工程规则，不记录一次性的排障细节。

## 1. 镜像与打包规则

1. 前后端 Docker 镜像统一按 `linux/amd64` 打包。
2. 测试环境镜像标签使用普通时间戳，例如 `04021011`。
3. 生产环境镜像标签统一使用 `prd-<YYMMDDHHMM>-amd64`，例如 `prd-2604031827-amd64`。
4. 生产发布时使用的镜像命名规则：
   - `docker.yc345.tv/7to12/yclawhub-frontend:prd-<YYMMDDHHMM>-amd64`
   - `docker.yc345.tv/7to12/yclawhub-backend:prd-<YYMMDDHHMM>-amd64`

## 2. 前端构建规则

1. 当前前端镜像模式是“先本地构建 `.output`，再把 `.output` 打进镜像”。
2. 所有 `VITE_*` 变量都是构建时变量，不是运行时变量。
3. `docker run -e VITE_*` 不会覆盖已打进镜像的前端构建结果。
4. 测试环境和生产环境前端打包前，必须先确认对应的环境文件或构建参数。
5. 线上前端默认使用：
   - `.env.online`
   - `bun run build:online`
6. 测试环境前端如果直接用命令注入变量构建，构建参数必须显式写清楚。

## 3. 前端运行规则

1. 前端运行时只依赖少量运行时变量：
   - `NODE_ENV`
   - `PORT`
   - `BACKEND_URL`
   - `API_ORIGIN`
2. 浏览器应优先访问前端域名，由前端代理 `/api/v1/*`、`/auth/*`、`/.well-known/clawhub.json` 到后端。
3. 不要默认让浏览器直接访问后端地址做 OAuth 跳转，除非确认端口和回调链路没有浏览器限制。

## 4. OAuth 与飞书规则

1. 飞书登录需要区分两条链路：
   - 普通浏览器 OAuth 跳转
   - 飞书客户端内 H5 / 免登链路
2. 后端飞书 OAuth 至少需要：
   - `FEISHU_ENABLED=true`
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
3. 前端若需要飞书 H5 相关能力，必须在构建时注入：
   - `VITE_FEISHU_APP_ID`
4. 前端 `/auth/*` 代理必须保留后端 30x 跳转，不应在代理层吞掉外部重定向。
5. OAuth 回调地址生成必须优先基于前端访问域名，而不是盲目使用后端容器监听地址。
6. 针对当前测试环境，浏览器 OAuth 不应把回调导向 `10080`，否则可能触发 `ERR_UNSAFE_PORT`。
7. 生产或测试环境需要提前在飞书开放平台配置回调地址白名单。

## 5. `VITE_AUTH_BASE_URL` 使用规则

1. `VITE_AUTH_BASE_URL` 是构建时变量。
2. 它会改变浏览器 OAuth 导航行为，不只是 API 请求行为。
3. 在当前测试环境里，不要把 `VITE_AUTH_BASE_URL` 指向 `https://clawhub-api-test.yc345.tv` 这类后端直连登录链路。
4. 如果前端已经能正确代理 `/auth/*`，优先不设置 `VITE_AUTH_BASE_URL`。
5. 只有在明确需要“浏览器绕过前端代理、直跳后端 OAuth 入口”时，才考虑启用 `VITE_AUTH_BASE_URL`。

## 6. 后端配置规则

1. 后端配置加载顺序固定为：
   - `backend/config/default.yaml`
   - `backend/config/${GO_ENV}.yaml`
   - `backend/.env.${GO_ENV}`（如果存在）
   - 进程环境变量覆盖
2. `GO_ENV` 对应的环境文件必须存在，否则后端启动失败。
3. 当前已有环境文件：
   - `local`
   - `dev`
   - `test`
   - `pro`
4. 生产运行统一使用：
   - `GO_ENV=pro`
5. 测试运行统一使用：
   - `GO_ENV=test`

## 7. SQL 与数据库变更规则

1. 后续所有线上 SQL 变更都走人工管理、人工审核、人工上线。
2. 不把生产数据库变更依赖在应用自动迁移上。
3. `clawhub-migrate` 可以保留在镜像里作为辅助工具，但不是生产发布必需步骤。
4. 发布前需要明确区分：
   - 应用镜像发布
   - 数据库 SQL 发布
5. 数据库初始化和 schema 变更必须提前人工执行完成，再进行应用上线。

## 8. 对象存储规则

1. 当前对象存储按“后端中转读写”模式使用。
2. Bucket 不需要公共读权限，私有权限即可。
3. 后端通过 AK/SK 直接执行：
   - 上传
   - 下载
   - 删除
4. 只有当未来改成“前端或 CLI 直接访问对象存储 URL”时，才需要重新评估公读或预签名 URL 方案。

## 9. 安全规则

1. OSS、OAuth、JWT、飞书、SMTP 等真实凭据不应长期保存在仓库配置文件里。
2. 数据库连接串、邮箱域名白名单和超级用户邮箱允许按环境保留在 `backend/config/*.yaml` 中。
3. 生产与测试环境应优先使用 `backend/.env.${GO_ENV}` 或进程环境变量注入敏感信息。
4. 若真实密钥已经出现在聊天记录、仓库或镜像中，应视为已暴露并尽快轮换。
5. 后端镜像当前会把 `backend/config` 整个目录打进去，因此配置文件中的敏感值也会进入镜像；真实 `backend/.env*` 必须被 `.dockerignore` 排除。

## 10. 部署与验证规则

1. 发布顺序固定建议为：
   - 人工执行 SQL
   - 构建前端
   - 打包前端镜像
   - 打包后端镜像
   - 推送镜像
   - 拉取并启动后端
   - 拉取并启动前端
   - 执行接口与登录验证
2. 验证 OAuth 时优先使用：
   - `curl -i`
   - 不使用 `curl -I`
3. 需要重点检查的不是是否 200，而是：
   - `/auth/feishu` 是否 307
   - `Location` 中的 `redirect_uri` 是否正确
4. 前端生产镜像打完后，如需确认构建时变量，优先回看用于构建的环境文件，而不是依赖 `docker run -e VITE_*` 推断。

## 11. 当前仓库内已形成的生产约定

1. 线上前端构建默认参考：
   - `.env.online`
2. 线上品牌名当前为：
   - `OnionHub`
3. 线上前端地址当前约定为：
   - `https://onionhub.yc345.tv`
4. 线上后端地址当前约定为：
   - `https://onionhub-api.yc345.tv`

## 12. 关联文档

- [docs/deploy.md](/Users/logo/self_repo/claw_case/clawhub/docs/deploy.md)
- [docs/prd/feishu_auth/configuration.md](/Users/logo/self_repo/claw_case/clawhub/docs/prd/feishu_auth/configuration.md)
- [README.md](/Users/logo/self_repo/claw_case/clawhub/README.md)
