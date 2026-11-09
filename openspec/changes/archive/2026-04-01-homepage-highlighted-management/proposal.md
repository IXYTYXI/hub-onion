## Why

当前首页的“精选技能”和“热门技能”仍使用前端占位空数组，导致公开首页持续为空；同时前端保留了 `highlighted` 筛选与“当前安装 / 累计安装”展示，但 Go 后端既没有精选状态的持久化与管理链路，也没有可支撑当前安装双指标的安装统计模型。这个断裂已经影响首页可用性、后台运营能力和详情页数据可信度，需要在现有 Go 后端架构上做一轮最小而完整的收口。

## What Changes

- 为 `skills` 引入可持久化的 `highlighted` 状态，并让公开列表接口支持 `highlighted` 过滤。
- 在 superuser 的 `Management` 后台增加“设为精选 / 取消精选”操作、当前精选状态展示，并将作者栏收口为飞书授权邮箱优先展示。
- 调整公开用户页 `/u/:handle`，使用户信息区域同样优先展示飞书邮箱，而不是 UID 风格 handle。
- 恢复首页技能站点的真实数据展示：
  - “精选技能”基于 `highlighted` 状态读取真实数据
  - “热门技能”基于下载量排序读取真实数据
- 对下载链路采用最小安装统计方案：ZIP 下载成功后同时累计 `stats_downloads` 与 `stats_installs`。
- 收口详情页安装展示语义，移除不可信的“当前安装”，仅保留基于后端 `stats.installs` 的“累计安装”。
- 补充相应的后端集成测试和前端页面测试，覆盖精选筛选、后台管理、首页渲染与安装统计更新。

## Capabilities

### New Capabilities
- `homepage-skill-surfaces`: 定义首页“精选技能”和“热门技能”的真实数据展示行为，以及首页对技能列表接口的复用规则。

### Modified Capabilities
- `skill-crud-operations`: 技能公开列表和详情需要支持 `highlighted` 状态返回，并允许通过查询参数筛选精选技能。
- `skill-download`: ZIP 下载成功后除递增下载次数外，还需要同步递增累计安装次数。
- `skill-management-surfaces`: `Management` 后台需要新增精选状态展示与切换操作，而不仅是删除和恢复，同时 skill 列表作者栏需要优先展示飞书授权邮箱。
- `frontend-api-client`: 前端 API 类型与 hook 消费需要对齐 `highlighted` 和累计安装语义，并停止假定存在 `installsCurrent` / `installsAllTime` 双字段。
- `user-profile`: 公开用户资料接口和 `/u/:handle` 页面需要支持并消费邮箱优先展示逻辑。

## Impact

- 后端数据库与模型：
  - `backend/internal/database/migrations/*`
  - `backend/internal/model/skill.go`
- 后端服务与路由：
  - `backend/internal/service/skill_service.go`
  - `backend/internal/handler/skills.go`
  - `backend/internal/handler/skill_management.go`
  - `backend/internal/handler/download.go`
  - `backend/internal/handler/routes.go`
- 前端页面与类型：
  - `src/routes/index.tsx`
  - `src/routes/management.tsx`
  - `src/components/SkillHeader.tsx`
  - `src/hooks/useSkills.ts`
  - `src/routes/skills/-useSkillsBrowseModel.ts`
  - `src/types/api.ts`
  - `src/copy/home.ts`
  - `src/copy/management.ts`
  - `src/copy/skills.ts`
- 测试：
  - `backend/test/integration/*`
  - `src/__tests__/*`
