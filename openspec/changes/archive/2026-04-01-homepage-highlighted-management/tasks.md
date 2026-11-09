## 1. 数据模型与后端接口

- [x] 1.1 新增数据库迁移，为 `skills` 表添加 `is_highlighted BOOLEAN NOT NULL DEFAULT FALSE`
- [x] 1.2 更新 Go `Skill` 模型和 API DTO，使公开接口与管理接口能够返回 `highlighted` 状态
- [x] 1.3 扩展 `ListSkills` handler 与 service，支持解析并执行 `highlighted=1|true` 过滤
- [x] 1.4 新增 superuser 管理接口 `POST /api/v1/admin/skills/:slug/highlighted`，支持设置和取消精选
- [x] 1.5 更新管理列表与详情返回结构，包含每个 skill 的 `highlighted` 状态

## 2. 下载统计收口

- [x] 2.1 将下载成功后的统计更新逻辑提取为可复用的 service 能力
- [x] 2.2 在 ZIP 下载成功后同时累计 `stats_downloads` 与 `stats_installs`
- [x] 2.3 为统计更新添加错误处理，确保统计失败不会阻断下载响应

## 3. 前端首页与管理后台

- [x] 3.1 更新前端 API 类型，统一使用 `highlighted` 与 `stats.installs` 语义
- [x] 3.2 改造首页技能站点数据源，接入真实“精选技能”和“热门技能”列表查询
- [x] 3.3 调整首页技能卡渲染，移除依赖占位空数组的逻辑
- [x] 3.4 在管理页增加精选状态展示和“设为精选 / 取消精选”操作
- [x] 3.5 在技能列表页验证并打通“仅看精选”筛选参数的真实生效链路
- [x] 3.6 将 `/management` 中 skill 列表的作者展示收口为飞书授权邮箱优先，避免继续显示 UID
- [x] 3.7 调整公开用户资料接口与 `/u/:handle` 页面，统一为飞书邮箱优先展示，handle 仅作回退

## 4. 详情页安装统计展示

- [x] 4.1 收口 `SkillHeader` 的安装统计展示，仅保留“累计安装”
- [x] 4.2 移除详情页对 `installsCurrent` / `installsAllTime` 伪字段的依赖
- [x] 4.3 校验详情页和技能列表页都使用后端 `stats.installs` 作为累计安装次数

## 5. 测试与验收

- [x] 5.1 补充后端集成测试，覆盖 `highlighted` 过滤、管理切换和下载成功后的双统计递增
- [x] 5.2 补充前端测试，覆盖首页真实渲染、管理页精选切换和详情页累计安装展示
- [x] 5.3 补充前端测试，覆盖 `/management` 作者栏优先展示飞书授权邮箱
- [x] 5.4 补充公开用户页测试，覆盖 `/u/:handle` 身份信息优先展示飞书邮箱
- [x] 5.5 执行手工验收：验证首页精选/热门、管理后台精选开关、管理页与用户页作者邮箱展示，以及 CLI 安装后的累计安装显示与后端数据一致
