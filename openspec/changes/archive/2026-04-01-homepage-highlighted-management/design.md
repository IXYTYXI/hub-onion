## Context

当前项目已经完成从 Convex 向 Go 后端迁移的主链路，但首页、管理后台和详情页统计仍残留一组未收口的前后端语义断裂：

- 首页 `src/routes/index.tsx` 仍用空数组渲染“精选技能”和“热门技能”。
- 前端 `useSkills` 已经会发送 `highlighted=1`，但 Go 后端 `/api/v1/skills` 不解析该参数。
- 管理后台当前只有删除/恢复 skill 的操作，没有精选运营能力。
- 管理后台 skill 列表中的作者栏没有收口为邮箱优先展示，后台运营仍可能看到 UID 风格标识。
- 公开用户页 `/u/:handle` 仍固定展示 `@handle`，在飞书场景下也会直接暴露 UID 风格标识。
- 后端 `skills` 表已有 `stats_installs` 字段，但下载链路只累计 `stats_downloads`。
- 详情页仍显示“当前安装 / 累计安装”双指标，而 Go 后端只维护单一 `stats.installs`。

本次变更横跨数据库、公开 API、管理 API、首页、详情页和技能列表页，属于典型的跨模块收口需求，适合先通过单独设计文档固定关键决策，避免编码阶段再次分叉。

约束条件：

- 当前代码库以 Go + Gin + PostgreSQL 为主，不再回退到 Convex badge/batch 模型。
- 现有公开列表接口已经可满足首页聚合需求，优先复用，不新增 homepage 专用接口。
- 本次需求强调“最小可落地”，不引入 install telemetry、设备去重或复杂精选批次体系。

## Goals / Non-Goals

**Goals:**

- 为 `skills` 增加单一且可持久化的精选状态字段。
- 让公开列表、首页和管理后台共享同一套 `highlighted` 语义。
- 恢复首页“精选技能”和“热门技能”的真实数据展示。
- 在下载成功时同步累计安装次数，形成可用的最小安装统计。
- 移除详情页不可信的“当前安装”展示，只保留后端实际维护的累计安装。
- 将管理后台 skill 列表中的作者展示统一收口为飞书授权邮箱优先。
- 将公开用户页的身份展示统一收口为飞书邮箱优先。

**Non-Goals:**

- 不实现 Convex 时代的 badge 表、batch 枚举或精选历史流水。
- 不增加 homepage 专用聚合后端接口。
- 不实现设备级安装上报、当前安装数去重或卸载回传。
- 不扩展到 souls 首页或 souls 管理能力。
- 不在本次中重构 owner 公开资料接口或首页 owner 展示模型。

## Decisions

### 1. 使用 `skills.is_highlighted` 作为唯一精选状态来源

决策：

- 在 `skills` 表新增 `is_highlighted BOOLEAN NOT NULL DEFAULT FALSE`。
- Go 模型内部使用 `IsHighlighted`，前端 API 统一返回 `highlighted: boolean`。

原因：

- 与 `is_deleted` 命名风格一致，容易理解。
- 不依赖旧 Convex 的 badge/batch 结构，迁移成本最低。
- 支持公开列表过滤、后台管理切换、首页精选展示三条链路共用。

备选方案与取舍：

- 复刻 Convex badge/batch 模型：灵活但复杂度明显过高，不符合本次“最小收口”目标。
- 使用 tags 复用精选状态：会把运营状态和内容标签混在一起，长期不可维护。

### 2. 首页复用现有 `GET /api/v1/skills`，不新增 homepage 专用接口

决策：

- 首页“精选技能”调用 `/api/v1/skills?highlighted=1&sort=updated&dir=desc&limit=6`
- 首页“热门技能”调用 `/api/v1/skills?sort=downloads&dir=desc&limit=6`

原因：

- 现有列表接口已具备分页、排序和 DTO 输出能力。
- 避免为首页单独引入服务层聚合接口，减少维护面。
- 可以直接让技能列表页和首页共享同一过滤与排序语义。

备选方案与取舍：

- 新增 `/api/v1/home` 聚合接口：接口更少，但会引入新的返回模型和新的缓存策略，不适合当前阶段。

### 3. 管理后台使用统一的 highlighted toggle 接口

决策：

- 新增 `POST /api/v1/admin/skills/:slug/highlighted`
- 请求体为 `{ "highlighted": true|false }`

原因：

- 比 `highlight` / `unhighlight` 双接口更易于前端实现和缓存失效。
- 便于在管理页中直接把按钮状态与目标状态绑定。

备选方案与取舍：

- 拆成两个接口：语义明确，但接口数翻倍，前端 mutation 分支更多。

### 3.1 管理后台作者栏优先展示飞书授权邮箱

决策：

- 管理接口继续复用现有 owner 摘要返回结构。
- `/management` 的作者栏优先显示 `owner.email`。
- 当 `owner.email` 缺失时，再回退到 `owner.handle`。

原因：

- 管理后台的主要使用者是运营和管理员，邮箱比 UID 或 handle 更稳定、可读性更高。
- 当前后端管理接口已经返回 `owner.email`，收口主要在前端展示层，改动面小。

备选方案与取舍：

- 继续显示 handle 或 UID：实现简单，但后台可读性不足。
- 新增专门的 owner profile 接口：信息更完整，但本次没有必要扩大接口面。

### 3.2 公开用户页也使用邮箱优先展示

决策：

- `GET /api/v1/users/:handle` 返回 `email`
- `/u/:handle` 页面优先展示 `email`
- 邮箱缺失时回退到 `@handle`

原因：

- 管理页和用户页面对的是同一组账号，不应采用两套互相矛盾的身份展示规则。
- 当前用户页出现 `ou_xxx` 的根因是公开接口只返回了 `handle`，前端没有别的可读标识可用。

备选方案与取舍：

- 仅前端改动、不改后端：无数据来源，无法实现邮箱展示。
- 继续仅展示 handle：实现简单，但不满足需求。

### 4. 下载成功时同步累计 `stats_installs`

决策：

- 继续保留 `stats_downloads` 作为下载次数。
- 在 ZIP 下载成功后，同时递增 `stats_installs`。

原因：

- 现有 CLI install 通过下载接口完成，这个时机最接近“安装成功”。
- 无需增加新的 CLI 协议或 install event API。
- 可以快速修复“安装了但详情页仍显示 0”这一用户可见问题。

备选方案与取舍：

- 新增 install 上报接口：语义更干净，但需要 CLI 和后端一起扩协议。
- 只保留下载量、不维护安装量：无法满足当前页面与产品需求。

### 5. 详情页彻底移除“当前安装”展示

决策：

- 详情页不再读取 `installsCurrent`、`installsAllTime`
- 仅展示来自 `stats.installs` 的“累计安装”

原因：

- 当前 Go 后端没有当前安装数来源，继续展示属于伪能力。
- 保留单一累计安装指标可以让用户看到真实维护的数据。

备选方案与取舍：

- 暂时继续显示两个值且都映射到 `stats.installs`：会误导用户，以为两者语义不同。
- 前端完全隐藏安装统计：收口过度，不利于保留已有产品信号。

### 6. 首页首轮不强制展示 owner 信息

决策：

- 首页技能卡首轮接入真实数据时，不将 owner 信息作为阻塞项。

原因：

- 现有公共列表接口不返回 owner 摘要。
- 若为了首页保留 owner 展示而扩展公开列表 DTO，会扩大本次改动面。

备选方案与取舍：

- 同步扩展公开列表返回 owner：体验更完整，但会增加更多接口与前端适配成本。

## Risks / Trade-offs

- [安装统计语义是近似值而非严格安装数] → 在文档和页面文案中明确该值为“累计安装”，不再展示“当前安装”。
- [首页精选与列表筛选若使用不同字段会再次分叉] → 所有精选相关能力统一基于 `skills.is_highlighted`。
- [下载成功后的统计写入失败可能被忽略] → 将统计更新封装到 service 并显式记录错误，不阻断下载响应。
- [首页若保留 owner 展示会扩大量表与 DTO 改动] → 首轮实现先不把 owner 作为首页恢复的阻塞条件。
- [管理页作者字段若继续回退到 UID，运营识别成本仍然很高] → 管理页作者栏显式采用邮箱优先、handle 次优的展示规则。
- [用户页若继续固定展示 `@handle`，公开体验仍会看到 UID 风格标识] → 公开用户资料接口增加 `email` 并在页面采用邮箱优先展示。
- [已有前端代码仍残留 `installsCurrent` / `installsAllTime` 假设] → 在 `SkillHeader` 和相关类型中一次性清理，避免双语义继续扩散。

## Migration Plan

1. 新增数据库迁移，向 `skills` 表添加 `is_highlighted` 字段。
2. 更新 Go 模型与 DTO，打通 `highlighted` 的读写和返回结构。
3. 扩展公开列表接口以支持 `highlighted` 过滤。
4. 新增管理接口和管理页 toggle UI。
5. 修改下载统计逻辑，使下载成功时同时累计 `stats_downloads` 与 `stats_installs`。
6. 更新详情页统计展示，移除“当前安装”并仅保留累计安装。
7. 接入首页精选/热门真实数据源。
8. 补充后端集成测试和前端渲染测试。

部署与回滚：

- 数据库新增布尔字段为向后兼容变更，可先上线迁移再上线代码。
- 若前端提前发布但后端未支持 `highlighted`，首页精选仍为空，因此应优先后端后前端。
- 如需回滚前端，可保持后端字段与接口存在，不影响旧页面。

## Open Questions

- 首页首轮是否必须保留 owner 展示，如果必须保留，是否接受扩展公共列表接口返回 owner 摘要？
- 管理后台精选状态是否需要支持按“只看精选”过滤，还是首轮仅做状态展示与 toggle 即可？
- “热门技能”排序是否仅按 `downloads DESC`，还是需要在下载量相同情况下增加 `updated_at DESC` 作为稳定次排序？
