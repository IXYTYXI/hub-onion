# 飞书授权接入技术方案文档

## 1. 设计目标

本文档给出 ClawHub 在当前 Go 后端架构下接入飞书授权的最终技术方案，目标如下：

1. 飞书授权作为主登录方式
2. 在飞书客户端内支持基于 `requestAccess` 的免登
3. 普通浏览器支持飞书 OAuth 登录，并使用独立导航基地址发起跳转
4. 登录成功后仍由 ClawHub 签发本地 Session Cookie
5. 为已有本地用户提供“绑定飞书”能力
6. 为飞书主登录用户保留邮箱绑定能力
7. 不按邮箱自动合并账号
8. 未绑定邮箱的飞书账号不具备管理权限
9. 管理员和超级管理员必须依附已绑定邮箱的本地账号
10. 不破坏现有业务 API、CLI Token 和管理端权限模型

这里需要明确区分三类飞书登录场景：

- 飞书客户端内免登
- 普通浏览器中的飞书 OAuth 登录
- 飞书工作台点击应用后唤起浏览器进入平台

其中前两者为本期必须支持能力，第三类为后续可选增强，不纳入本期交付边界。

## 2. 当前实现分析

### 2.1 已有优势

当前项目已经具备以下基础条件：

- 后端有统一的本地 Session 签发能力
- 中间件统一从 `Authorization` 或 `clawhub_session` 读取身份
- 外部身份已抽象为 `IdentityProvider`
- 数据库已存在 `auth_identities` 表
- 前端登录态统一基于 `/api/v1/users/me`

这意味着飞书接入不需要推翻认证体系，只需要新增一种身份接入路径。

### 2.2 当前不足

当前不足主要有：

- 外部身份模型还不够丰富，无法完整表达飞书身份字段
- 现有外部身份登录默认“未命中即建号”，不支持“绑定当前用户”
- 当前用户模型没有把“邮箱绑定状态”作为显式权限前置条件
- 超级管理员识别仍偏向邮箱、handle、user id 的静态匹配
- 登录页尚未区分“飞书主登录”和“邮箱辅助登录”两类入口

## 3. 总体架构

### 3.1 核心原则

本方案坚持以下原则：

- 飞书负责认证，不负责平台授权
- ClawHub 自己维护本地用户
- ClawHub 自己签发 Session JWT
- 管理权限继续绑定本地用户
- 管理权限授予必须以“邮箱已绑定”为前置条件
- 飞书字段只作为身份来源和资料来源，不直接决定业务权限

这里必须再明确一层：

- 飞书身份和邮箱身份都只是本地用户的绑定身份
- 本地用户 `users.id` 才是平台唯一账号主体
- 权限、技能、设置、资料都绑定在本地用户上，而不是绑定在某个登录方式上

### 3.2 总体流程

飞书客户端内登录流程：

1. 前端检测到当前运行在飞书客户端内
2. 前端调用飞书 H5 SDK 的 `requestAccess`
3. 前端获取一次性 `code`
4. 前端将 `code` 发送给 ClawHub 后端
5. 后端使用 `code` 换取飞书 `user_access_token`
6. 后端调用飞书“获取用户信息”接口
7. 后端根据飞书身份查找或创建本地用户
8. 后端签发 `clawhub_session`
9. 前端继续使用现有 `/api/v1/users/me` 感知登录态

普通浏览器飞书登录流程：

1. 用户访问 `/auth/login`
2. 前端显示“飞书登录”入口
3. 用户点击后通过独立认证导航地址跳转到后端发起飞书 OAuth 授权
4. 飞书授权成功后回调 ClawHub 后端
5. 后端换取飞书身份并查找或创建本地用户
6. 后端签发 `clawhub_session`
7. 前端继续使用现有 `/api/v1/users/me` 感知登录态

飞书工作台唤起浏览器进入平台流程：

1. 用户从飞书工作台点击网页应用
2. 飞书按后台配置唤起系统浏览器打开指定页面
3. 浏览器页面再进入飞书预授权或 OAuth 登录流程
4. 登录成功后仍由 ClawHub 建立本地会话

该流程不作为本期必须能力，但在设计上需要与“普通浏览器飞书登录”区分，避免实现时混淆。

普通浏览器邮箱兼容流程：

1. 用户访问 `/auth/login`
2. 前端保留邮箱兼容入口
3. 邮箱登录成功后仍写入 `clawhub_session`

这里的邮箱流程需要从技术实现上明确为：

- 邮箱登录进入的是已有本地用户
- 邮箱注册/激活不应再默认创建平行账号主体
- 邮箱链路主要用于辅助进入和完成邮箱绑定

飞书绑定流程：

1. 用户先通过邮箱或既有方式登录
2. 在设置页点击“绑定飞书”
3. 前端发起飞书授权
4. 后端验证该飞书身份是否已被占用
5. 若未占用，则把飞书身份绑定到当前本地用户

邮箱绑定流程：

1. 用户先通过飞书主登录进入平台
2. 用户在设置页发起邮箱绑定
3. 后端完成邮箱验证
4. 本地用户进入“已绑定邮箱”状态

管理权限规则：

1. 飞书账号可以作为主登录身份
2. 但未绑定邮箱的账号只能拥有普通用户权限
3. 只有已绑定邮箱的本地用户，才允许被授予 `admin` / `moderator` / `isSuperuser`
4. 管理员后续可用飞书登录，但其管理资格仍来源于“本地用户 + 已绑定邮箱”

统一账号模型：

- 飞书登录命中本地用户 A，则进入 A
- 邮箱登录命中本地用户 A，也进入 A
- A 的技能、权限、资料永远不因登录方式改变

## 3.3 状态机到系统行为的映射

为了让需求文档中的状态机在实现上可落地，建议后端和前端都统一围绕本地用户状态处理。

### 状态 A：未登录

系统表现：

- 不存在 `clawhub_session`
- `/api/v1/users/me` 返回未登录

允许入口：

- 飞书主登录
- 邮箱辅助登录

### 状态 B：已通过飞书登录，未绑定邮箱

系统表现：

- 已存在本地用户
- 已绑定飞书身份
- `has_bound_email = false`

允许入口：

- 飞书主登录

允许动作：

- 绑定邮箱

禁止能力：

- 管理权限

### 状态 C：已绑定邮箱的普通用户

系统表现：

- 已存在本地用户
- `has_bound_email = true`
- 普通角色

允许入口：

- 飞书主登录
- 邮箱辅助登录

### 状态 D：已绑定邮箱的管理用户

系统表现：

- 已存在本地用户
- `has_bound_email = true`
- `role` 或 `isSuperuser` 满足管理条件

允许入口：

- 飞书主登录
- 邮箱辅助登录

允许能力：

- 管理后台

### 状态 E：历史邮箱用户，尚未绑定飞书

系统表现：

- 已存在本地用户
- 已绑定邮箱
- 未绑定飞书

允许动作：

- 邮箱辅助登录
- 绑定飞书

## 4. 飞书接入方式选择

### 4.1 为什么不直接套现有 `/auth/{provider}/callback`

当前 GitHub/GitLab 登录是标准浏览器重定向 OAuth 模型。  
飞书 H5 免登的主链路不是“浏览器跳转到授权页再回调”，而是：

- 前端在飞书客户端内直接通过 JSAPI 获取 `code`
- 后端拿该 `code` 换 token 和用户信息

因此更适合新增一个专用接口，而不是强行套入当前浏览器重定向模型。

但需要注意：

- 飞书在普通浏览器中的登录链路，本质上就是标准浏览器 OAuth 重定向模型
- 因此飞书在当前系统中应同时存在两种接入方式：
  - H5 `requestAccess` 专用交换接口
  - 浏览器 OAuth 登录与回调接口

### 4.2 推荐实现

推荐新增三类接口：

1. 飞书 H5 登录交换接口
- `POST /auth/feishu/h5-login`

2. 飞书浏览器 OAuth 登录接口
- `GET /auth/feishu`
- `GET /auth/feishu/callback`

3. 飞书身份绑定接口
- `POST /auth/feishu/bind`
- `GET /auth/feishu/bind`
- `GET /auth/feishu/bind/callback`

同时建议明确一类邮箱接口：

4. 邮箱绑定接口或复用现有邮箱激活接口
- `POST /auth/email/bind`
- 或复用现有注册/激活流程，但要在语义上支持“给当前飞书账号绑定邮箱”

可选增强：

5. 飞书工作台唤起浏览器的专用引导页
- 例如 `GET /auth/feishu/browser-entry`
- 用于承接飞书工作台打开浏览器后的跳转与预授权逻辑
- 本期不要求实现

本次优先级：

- 必做：H5 登录、浏览器飞书 OAuth 登录、飞书绑定、邮箱绑定
- 可选增强：飞书工作台唤起浏览器进入平台

## 4.3 邮箱三链路的技术语义

在最终方案中，邮箱相关链路需要重新定义技术语义。

### 1. 邮箱注册

从技术语义上，应优先理解为：

- 发起邮箱绑定

推荐实现原则：

- 已登录用户调用时，把邮箱注册请求解释为“给当前本地用户发起邮箱绑定”
- 不再默认创建新的平行账号主体

### 2. 邮箱激活

从技术语义上，应理解为：

- 验证邮箱所有权
- 完成邮箱绑定
- 设置 `has_bound_email = true`

### 3. 邮箱登录

从技术语义上，应理解为：

- 通过邮箱身份进入已有本地用户

推荐实现原则：

- 只允许命中已有本地用户
- 不允许在邮箱登录链路中隐式创建第二套账号主体

## 5. 数据模型设计

### 5.1 目标

需要让本地用户与飞书身份解耦，并同时支持：

- 通过飞书首次创建用户
- 将飞书身份绑定到已有本地用户
- 飞书主登录
- 普通浏览器飞书 OAuth 登录
- 管理员权限不随登录方式变化
- 管理权限以邮箱绑定状态为前置条件

这里的关键不是“兼容两套账号”，而是：

- 兼容两种身份入口
- 收敛到同一个本地用户主体

### 5.2 推荐身份表扩展

当前 `auth_identities` 建议扩展支持飞书字段：

- `provider`
- `provider_subject`
- `provider_username`
- `provider_email`
- `provider_avatar_url`
- `raw_claims`
- `last_login_at`

针对飞书，建议在 `raw_claims` 中至少持久化：

- `open_id`
- `union_id`
- `tenant_key`
- `name`
- `avatar_url`
- `email`
- `employee_no`

如果需要更高查询效率，建议新增专门字段：

- `provider_open_id`
- `provider_union_id`
- `provider_tenant_key`

### 5.3 推荐主键策略

推荐规则：

- `provider = feishu`
- `provider_subject = union_id`
- 若 `union_id` 缺失，则回退 `provider_subject = open_id`

同时保存：

- `open_id`
- `union_id`
- `tenant_key`

原因：

- `provider_subject` 必须是稳定且单值的唯一识别字段
- `union_id` 更利于飞书主登录下的稳定识别
- `open_id` 作为兼容回退值更稳妥

### 5.4 用户主表策略

`users` 继续保留本地主体地位：

- `users.id` 是平台内部唯一主体
- `role`、`status`、`isSuperuser` 判断逻辑都绑定到本地用户
- `authProvider` 仅表达最近或主要登录来源，不应再被视为唯一身份来源
- 是否具备已绑定邮箱，是管理权限校验的一部分

因此推荐的账号语义是：

- 一个本地用户可以同时绑定飞书身份和邮箱身份
- 飞书和邮箱都是登录方式，不是两个账号
- 本地用户是唯一承载业务状态的对象

建议新增或明确以下本地状态字段：

- `email`
- `email_verified_at` 或等价状态
- `has_bound_email`

规则：

- `has_bound_email = true` 才允许授予管理权限
- 纯飞书创建用户默认 `has_bound_email = false`

推荐补充的数据语义：

- `email` 表示当前本地用户已绑定的邮箱身份
- `email_verified_at` 表示邮箱所有权已验证
- `has_bound_email` 是权限判断友好的布尔派生状态

## 6. 后端模块设计

### 6.1 新增 Feishu 身份服务

建议新增：

- `backend/internal/service/oauth_provider_feishu_h5.go`

职责：

- 用 `code` 换 `user_access_token`
- 用 `user_access_token` 获取飞书用户信息
- 把飞书用户信息转换为统一 `ExternalIdentity`

这里不一定要硬实现为当前 `IdentityProvider` 接口，因为 H5 登录并非标准 `BuildAuthURL -> callback` 流程。  
更自然的方式是新增一个轻量服务，例如：

```go
type FeishuH5AuthService interface {
  ExchangeCode(ctx context.Context, code string) (*ExternalIdentity, error)
}
```

### 6.2 `AuthService` 扩展点

`AuthService` 需要新增三类能力：

1. 根据飞书身份登录或创建本地用户
2. 在当前登录用户上绑定飞书身份
3. 在权限判断前校验邮箱绑定状态
4. 让邮箱链路落到“绑定邮箱”或“进入已有本地用户”的语义上

建议新增方法：

```go
LoginWithFeishuIdentity(ctx context.Context, identity *ExternalIdentity) (*model.User, string, error)
BindFeishuIdentity(ctx context.Context, currentUserID string, identity *ExternalIdentity) error
BindEmailToCurrentUser(ctx context.Context, currentUserID string, email string, verificationData any) error
LoginWithEmailIdentity(ctx context.Context, email string, password string) (*model.User, string, error)
CanReceiveManagementPermission(user *model.User) bool
```

### 6.3 `IdentityService` 改造

当前 `UpsertExternalIdentity` 更接近“未命中则创建，命中则更新”。  
本次需要拆分为更清晰的三个操作：

- `FindUserByExternalIdentity`
- `CreateUserWithExternalIdentity`
- `BindExternalIdentityToUser`

原因：

- 登录与绑定是两种不同业务语义
- 绑定场景不能误建新号
- 登录场景不能误占别人的身份绑定
- 所有身份入口都必须统一落到本地用户，而不是生成平行账号

建议最终抽象为：

```go
type IdentityService struct { ... }

func (s *IdentityService) ResolveExternalIdentity(...)
func (s *IdentityService) CreateUserWithIdentity(...)
func (s *IdentityService) BindIdentityToUser(...)
func (s *IdentityService) FindUserByEmailIdentity(...)
```

额外建议：

- 飞书身份和邮箱身份都统一收口到 IdentityService 管理
- 不要让邮箱登录继续绕过身份层，直接形成第二套语义

### 6.4 Handler 设计

建议新增：

- `FeishuH5LoginHandler`
- `BindFeishuHandler`
- `BindEmailHandler` 或复用现有邮箱绑定能力

#### `POST /auth/feishu/h5-login`

请求：

```json
{
  "code": "feishu_temp_code"
}
```

响应：

```json
{
  "ok": "logged in",
  "handle": "user_handle",
  "authProvider": "feishu"
}
```

行为：

- 交换飞书身份
- 查找本地绑定
- 若未绑定则创建新账号
- 校验用户状态
- 签发 `clawhub_session`
- 若账号未绑定邮箱，则仅进入普通用户态

这里的“新账号”严格指“新的本地用户主体”，不是“新的飞书侧账号概念”。

#### `POST /auth/feishu/bind`

请求：

```json
{
  "code": "feishu_temp_code"
}
```

响应：

```json
{
  "ok": "bound"
}
```

行为：

- 要求当前用户已登录
- 交换飞书身份
- 校验该身份未被其他用户占用
- 绑定到当前用户

绑定成功后：

- 当前本地用户新增一种飞书登录方式
- 不是创建第二个用户

#### `POST /auth/email/bind`

请求：

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

响应：

```json
{
  "ok": "email bound"
}
```

行为：

- 要求当前用户已登录
- 完成邮箱验证
- 把邮箱绑定到当前本地用户
- 将 `has_bound_email` 更新为 `true`

绑定成功后：

- 当前本地用户新增一种邮箱登录方式或邮箱验证状态
- 不是创建第二个用户

#### `POST /auth/login`

若继续保留现有邮箱登录接口，其技术语义应明确为：

- 使用邮箱身份进入已有本地用户

行为约束：

- 先按邮箱查找已存在本地用户
- 命中后签发 `clawhub_session`
- 未命中时不得隐式创建新的平行账号主体

#### `POST /auth/register`

若继续保留现有邮箱注册接口，其技术语义建议明确区分两种情况：

- 已登录：作为“发起邮箱绑定”接口使用
- 未登录：仅在明确允许的兜底策略下使用，且需要谨慎约束

如果产品层不希望再保留未登录邮箱注册建号，可在实现中限制：

- 未登录状态下拒绝注册
- 登录状态下仅允许给当前本地用户绑定邮箱

### 6.5 审计与日志

建议记录以下审计事件：

- `auth.feishu.login.success`
- `auth.feishu.login.failed`
- `auth.feishu.bind.success`
- `auth.feishu.bind.conflict`
- `auth.feishu.user.created`
- `auth.email.bind.success`
- `auth.email.login.success`
- `auth.email.login.user_not_found`
- `auth.management.permission.denied_email_unbound`

建议日志中记录：

- 本地 `user_id`
- `provider = feishu`
- `provider_subject`
- `tenant_key`
- 失败原因

注意：

- 不要记录 `user_access_token`

## 7. 前端设计

### 7.1 登录页设计

当前登录页以邮箱为中心。  
本次建议做最小改造，不重做整页结构。

当前实现行为：

- 页面加载时检测是否运行在飞书客户端内
- 若在飞书内且已配置 `VITE_FEISHU_APP_ID`：
  - 自动发起 `requestAccess`
- 若不在飞书内：
  - 点击飞书登录后通过 `VITE_AUTH_BASE_URL` 生成浏览器 OAuth 跳转地址
- 邮箱入口仍保留在登录页中，作为兼容入口

当前实现要点：

- 浏览器 OAuth 导航不再复用 API 代理链路
- `VITE_AUTH_BASE_URL` 专门用于 `/auth/feishu`、`/auth/feishu/bind` 这类跳转
- 登录页不会把邮箱入口表达成独立账号体系

### 7.2 设置页设计

当前实现中的设置页行为：

- 个人资料区展示用户名、本地系统 UID 和平台邮箱
- 账号绑定区仅展示飞书账号绑定状态
- 已绑定时展示“飞书同步邮箱”
- 不直接展示 `open_id`、`union_id`、`tenant_key` 或飞书 `user_id`
- 邮箱绑定区块当前不在设置页直接展示
- 仍保留未绑定邮箱时的管理权限提示

### 7.3 用户页设计

当前前端展示规则：

- 平台显示名
- 平台头像
- 本地系统 UID
- 已绑定飞书账号状态
- 飞书同步邮箱（若飞书接口返回）

不建议公开展示：

- `open_id`
- `union_id`
- `tenant_key`
- 飞书 `user_id`
- 原始 `raw_claims`
- `employee_no`

界面约束：

- 设置页账号绑定区仅展示“已绑定飞书账号”和飞书同步邮箱等业务字段
- 不在设置页直接展示飞书原始标识字段
- 用户触发消息、欢迎文案、资料页展示优先使用 `display_name`、飞书 `name`、平台邮箱和本地 UID
- 禁止直接向前端暴露类似 `ou_xxx` 或 `tenant_key: xxx` 的内部标识文本

### 7.4 运行环境检测

需要封装前端工具方法，例如：

- 检测是否存在飞书 H5 SDK 环境
- 检测 `window.tt` 是否可用
- 优先调用 `requestAccess`
- 必要时兼容旧版本 `requestAuthCode`

但本次产品主路径仍以 `requestAccess` 为准。

## 8. 账号绑定与冲突策略

### 8.1 不自动按邮箱合并

这是本方案的硬约束。

原因：

- 飞书邮箱不是强身份字段
- 自动合并会带来账号劫持和误合并风险

### 8.2 绑定冲突规则

若飞书身份已绑定到其他本地用户：

- 登录场景：直接登录到已绑定账号
- 绑定场景：拒绝绑定并提示冲突

### 8.3 首次飞书登录规则

若飞书身份未绑定到任何本地用户：

- 默认创建新的本地用户
- 不主动去搜索同邮箱账户并合并

### 8.4 管理员账号规则

管理员使用飞书登录时推荐流程：

1. 先确保已有管理员本地账号已绑定邮箱
2. 在设置页绑定飞书
3. 绑定完成后使用飞书登录进入同一本地用户

这样最安全，不需要做危险的自动合并。

## 8.5 邮箱辅助登录规则

邮箱辅助登录的技术规则建议明确如下：

- 邮箱登录只能命中已有本地用户
- 邮箱登录成功后进入与飞书绑定相同的本地用户
- 邮箱登录失败不能触发自动建号
- 历史邮箱用户可继续通过邮箱进入，再执行绑定飞书

## 9. 管理员与超级管理员设计

### 9.1 核心硬约束

纯飞书账号不能直接拥有管理权限。

拥有管理权限的账号必须同时满足：

- 本地用户存在
- 邮箱已绑定
- 本地角色或 superuser 条件成立

### 9.2 superuser 识别策略

superuser 识别建议支持以下匹配方式：

- 本地 `user_id`
- 飞书 `union_id`
- 飞书 `open_id`
- 兼容保留 `email`
- 兼容保留 `handle`

推荐优先级：

1. `user_id`
2. `feishu_union_id`
3. `feishu_open_id`
4. `email`
5. `handle`

但是实际授予时必须附加一道前置校验：

```text
if !user.has_bound_email {
  deny management permission
}
```

也就是说，命中 superuser 识别条件不等于可以直接拥有管理权限，仍要通过邮箱绑定校验。

换句话说：

- 飞书可以决定“如何登录进来”
- 本地用户决定“这是谁”
- 邮箱绑定状态 + 本地角色决定“能不能管理”

## 10. 与现有系统的兼容策略

### 10.1 与 Session 兼容

不改：

- `clawhub_session`
- `RequireAuth`
- `AuthMiddleware`
- `/api/v1/users/me`

只要飞书登录最终也签发本地 Session，业务侧无需感知。

### 10.2 与 CLI 兼容

不改：

- API Token 生成协议
- `/cli/auth`
- CLI loopback callback 协议

CLI 继续只依赖“Web 端已登录”。

### 10.3 与邮箱登录兼容

保留：

- 邮箱注册
- 邮箱激活
- 邮箱登录

新增：

- 飞书绑定
- 邮箱绑定能力的显式入口或显式状态
- 飞书内免登

兼容原则：

- 保留已有邮箱入口，但重新定义其语义
- 兼容历史邮箱用户进入已有本地用户
- 不再让邮箱链路承担“默认创建主账号”的职责

### 10.4 与审核流兼容

当前实现中，飞书新用户直接激活：

- 飞书首次登录创建的本地用户默认状态为 `active`
- 不再因飞书接入而进入 `review_pending`
- 但这不影响管理权限约束
- 未绑定邮箱的飞书用户仍不能获得管理权限

## 11. 实施建议

本方案直接以最终目标态实施，建议一次性按以下范围设计：

- 飞书主登录
- 邮箱辅助登录
- 飞书绑定
- 邮箱绑定
- 管理权限的邮箱前置校验
- superuser 与本地用户绑定关系梳理
- 邮箱注册 / 激活 / 登录三条链路的语义重构

## 12. 待确认事项

正式实施前仍建议确认以下问题：

1. 飞书侧最终采用 `union_id` 还是 `open_id` 作为本次上线主键
2. 当前飞书应用是否只有单应用场景
3. 飞书新用户直接激活后，是否需要补充额外风控或审计日志
4. 设置页是否需要支持“解绑飞书”
5. 管理端是否需要展示 `tenant_key`
6. “已绑定邮箱”的判定是否直接复用现有邮箱注册/激活状态

## 13. 参考资料

- 飞书网页应用开发指南概述  
  https://open.feishu.cn/document/client-docs/h5/development-guide/basic-concepts

- 飞书网页应用免登  
  https://open.feishu.cn/document/client-docs/h5/development-guide/step-3

- 飞书网页应用发布与使用  
  https://open.feishu.cn/document/client-docs/h5/development-guide/step-4

- `requestAccess`  
  https://open.feishu.cn/document/uYjL24iN/uUzMuUzMuUzM/requestaccess

- 获取授权码  
  https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code

- 获取 `user_access_token`  
  https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/get-user-access-token

- 获取用户信息  
  https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/user_info/get
