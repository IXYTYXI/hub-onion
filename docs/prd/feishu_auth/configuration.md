# 飞书授权配置清单

本文档用于说明 ClawHub 当前飞书授权方案所需的配置项、飞书开放平台后台配置，以及本地开发、测试和线上环境的最小检查清单。

当前方案基线：

- 飞书客户端内优先走 H5 `requestAccess`
- 普通浏览器走飞书 OAuth 重定向登录
- 邮箱继续保留为辅助登录和邮箱绑定能力
- 管理权限仍以“本地用户 + 已绑定邮箱”为前提

## 1. 代码配置项

### 1.1 后端配置

后端当前使用的飞书相关配置项如下：

- `FEISHU_ENABLED`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FRONTEND_URL`

对应配置结构：

- `auth.feishu.enabled`
- `auth.feishu.app_id`
- `auth.feishu.app_secret`
- `auth.frontend_url`

参考代码：

- [backend/internal/config/config.go](/Users/logo/self_repo/claw_case/clawhub/backend/internal/config/config.go)
- [backend/config/default.yaml](/Users/logo/self_repo/claw_case/clawhub/backend/config/default.yaml)

作用说明：

- `FEISHU_ENABLED`
  - 开启或关闭飞书认证能力
- `FEISHU_APP_ID`
  - 飞书应用的 App ID
- `FEISHU_APP_SECRET`
  - 飞书应用的 App Secret
- `FRONTEND_URL`
  - OAuth 登录完成后后端回跳前端时使用的前端基础地址

### 1.2 前端配置

前端当前使用的飞书相关配置项如下：

- `VITE_FEISHU_APP_ID`
- `VITE_AUTH_BASE_URL`

参考代码：

- [src/lib/feishuAuth.ts](/Users/logo/self_repo/claw_case/clawhub/src/lib/feishuAuth.ts)

作用说明：

- 该配置仅用于飞书客户端内 H5 免登链路
- 普通浏览器 OAuth 登录不依赖前端直接持有 App Secret
- 如果未配置 `VITE_FEISHU_APP_ID`，端内 H5 免登无法发起，但普通浏览器 OAuth 仍可由后端重定向链路承接
- `VITE_AUTH_BASE_URL` 用于浏览器导航类 OAuth 跳转，例如 `/auth/feishu`、`/auth/feishu/bind`
- 建议将 `VITE_AUTH_BASE_URL` 与 API 代理链路分开配置，避免前端代理层吞掉后端 30x 重定向

示例：

- 本地开发：`VITE_AUTH_BASE_URL=http://localhost:8080`
- 测试环境：`VITE_AUTH_BASE_URL=https://api-staging.example.com`
- 生产环境：`VITE_AUTH_BASE_URL=https://api.example.com`

## 2. 飞书开放平台后台配置

除了本地代码配置，还必须在飞书开放平台后台完成网页应用与安全设置。

### 2.1 必配回调地址

当前实现至少需要配置以下重定向 URL：

- `http://<backend-host>/auth/feishu/callback`
- `http://<backend-host>/auth/feishu/bind/callback`

本地开发示例：

- `http://localhost:8080/auth/feishu/callback`
- `http://localhost:8080/auth/feishu/bind/callback`

测试环境示例：

- `https://api-staging.example.com/auth/feishu/callback`
- `https://api-staging.example.com/auth/feishu/bind/callback`

生产环境示例：

- `https://api.example.com/auth/feishu/callback`
- `https://api.example.com/auth/feishu/bind/callback`

如果飞书后台未配置这些 URL，常见结果是：

- 飞书授权页报“请求非法，请联系应用开发者”
- 浏览器回调失败
- 绑定流程回调失败

### 2.2 网页应用地址

飞书客户端内 H5 免登还需要在飞书应用后台配置网页应用地址，例如：

- 桌面端主页
- 移动端主页

这些地址应指向前端页面，而不是后端回调地址。

例如：

- `http://localhost:3000/auth/login`
- `https://app-staging.example.com/auth/login`
- `https://app.example.com/auth/login`

### 2.3 当前不要求的后台能力

本期不要求在飞书后台配置“工作台点击应用后唤起浏览器进入平台”的专用引导页能力。

也就是说：

- 普通浏览器飞书 OAuth 登录是本期必做
- 工作台唤起浏览器进入平台是后续可选增强

如果后续要支持这一能力，应额外补充：

- 专用引导页地址
- 对应的飞书工作台网页应用配置
- 对应的回调与预授权链路设计

## 3. 环境清单

### 3.1 本地开发环境

建议至少检查以下配置：

- 前端：
  - `VITE_FEISHU_APP_ID`
  - `VITE_AUTH_BASE_URL=http://localhost:8080`
- 后端：
  - `FEISHU_ENABLED=true`
  - `FEISHU_APP_ID`
  - `FEISHU_APP_SECRET`
  - `FRONTEND_URL=http://localhost:3000`
- 飞书后台：
  - 已配置 `http://localhost:8080/auth/feishu/callback`
  - 已配置 `http://localhost:8080/auth/feishu/bind/callback`

本地验证建议分两类：

- 飞书客户端内打开前端地址，验证 H5 `requestAccess`
- Chrome 打开前端地址，验证浏览器 OAuth 登录

### 3.2 测试环境

建议至少检查以下配置：

- 前端域名与 `FRONTEND_URL` 对应的站点一致
- 后端回调地址为可公开访问的 HTTPS 地址
- 飞书后台已配置测试环境的回调 URL
- 前后端部署域名之间的 Cookie、代理和跳转链路可正常工作

### 3.3 生产环境

建议至少检查以下配置：

- `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 使用生产应用凭据
- `FRONTEND_URL` 指向正式前端域名
- 飞书后台已配置正式后端回调 URL
- 已验证登录页、绑定页、回调页在正式域名下的跳转链路
- 已验证未绑定邮箱用户仍不能获得管理权限

## 4. 常见问题排查

### 4.1 浏览器中点击“飞书登录”后报非法请求

优先检查：

- 飞书后台是否配置了正确的重定向 URL
- 实际请求回调地址是否与后台白名单完全一致
- 是否把前端域名误配成了后端回调域名

### 4.2 飞书客户端内按钮不可用

优先检查：

- 是否已配置 `VITE_FEISHU_APP_ID`
- 当前访问环境是否确实在飞书客户端内
- H5 SDK 是否能正常加载

### 4.3 浏览器登录成功但跳转不对

优先检查：

- `FRONTEND_URL` 是否正确
- 后端是否通过该地址拼接最终回跳地址
- 是否存在代理层改写协议或 Host 的情况

### 4.4 绑定飞书回调失败

优先检查：

- 飞书后台是否配置了 `/auth/feishu/bind/callback`
- 用户是否已有有效本地登录态
- 浏览器是否保留了绑定过程中的状态 Cookie

## 5. 参考文档

- [飞书授权接入需求文档](./requirements.md)
- [飞书授权接入技术方案文档](./technical-design.md)
- 飞书实战文章: https://www.feishu.cn/content/7317091221654224898
