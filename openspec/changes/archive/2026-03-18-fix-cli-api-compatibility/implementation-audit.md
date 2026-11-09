## 前端 / CLI 共用接口对照表

| 接口 | 调用方 | 前端依赖点 | CLI 依赖点 | 当前后端行为 | 风险 | 处理方式 |
|---|---|---|---|---|---|---|
| `GET /api/v1/search` | 共用 | `src/hooks/useSearchSkills.ts` | `packages/clawdhub/src/cli/commands/skills.ts` `cmdSearch` | 路径正确；无结果时 `results` 可能序列化为 `null` | 高：CLI schema 直接报错，前端也依赖数组 | 修复为始终返回 `{ results: [] }` |
| `GET /api/v1/skills` | 共用 | `src/routes/dashboard.tsx` 等列表页通过 `apiRequest('/skills...')` | `cmdExplore` | 仅处理 `limit/cursor`，未处理 CLI 传入的 `sort` | 高：CLI 参数失效；前端排序逻辑与后端默认排序可能漂移 | 为后端补 `sort` 解析并确认不破坏前端默认列表 |
| `GET /api/v1/skills/:slug` | 共用 | `src/hooks/useSkill.ts`、`src/components/SkillDetailPage.tsx` | `cmdInstall`、`cmdUpdate`、`cmdInspect` | 路径正确；需保证 `owner`、`latestVersion` 显式可空；前端额外读取 `isStarred` | 中：若为兼容 CLI 删掉字段会破坏前端收藏状态 | 保持现有字段并补齐 CLI 需要的 `null` 包装，不删除前端扩展字段 |
| `GET /api/v1/skills/:slug/versions` | 共用 | `src/hooks/useSkillVersions.ts` | `cmdInspect --versions` | 当前已返回 `{ items, nextCursor }` | 低：已兼容 | 保持对象包装和空数组语义 |
| `GET /api/v1/skills/:slug/versions/:version` | 共用 | `src/hooks/useSkillVersion.ts`、版本 diff 组件 | `cmdInspect --files/--version` | 返回 `{ version, skill }` | 低：当前看起来兼容 | 保持不变，验证空文件与可选字段 |
| `GET /api/v1/skills/:slug/file` | 共用 | `src/lib/skillFiles.ts`、详情文件预览 | `cmdInspect --file` | 返回文本内容；支持 `version`，路由层接受 `tag=latest` | 低：契约大体一致 | 保持文本响应，验证 `tag/latest` 与错误码 |
| `GET /api/v1/resolve` | CLI 为主，前端间接依赖下载/更新链路一致性 | 无直接前端调用 | `cmdUpdate`、`syncHelpers` | 需确认无匹配时返回 200 + `{ match: null }` | 中：影响 CLI 更新/同步 | 按 CLI schema 校正；前端无额外兼容成本 |
| `GET /api/v1/download` | 共用 | 前端下载按钮直接拼接 URL | `cmdInstall`、`cmdUpdate` | 二进制下载，路径正确 | 低：主要验证查询参数兼容 | 保持路径与参数 |
| `POST /api/v1/skills` | 共用 | `src/hooks/usePublishSkill.ts`、上传/导入页面 | `cmdPublish` | 成功响应需为 `{ ok: "true", skillId, versionId }` | 高：CLI 强校验；前端也消费响应 | 统一响应为 CLI schema；前端类型已兼容该结构 |
| `DELETE /api/v1/skills/:slug` | 共用 | `src/hooks/useDeleteSkill.ts`、我的技能页 | CLI delete 命令与管理流 | 当前已返回 `{ ok: "true" }` | 低：需回归验证 | 保持结构，验证权限/已删除分支 |
| `POST /api/v1/skills/:slug/undelete` | 共用 | `src/hooks/useUndeleteSkill.ts`、我的技能页 | CLI undelete 命令 | 当前已返回 `{ ok: "true" }` | 低：需回归验证 | 保持结构，验证错误码 |
| `GET /api/v1/whoami` | 仅 CLI | 前端不用；前端走 `/users/me` | `cmdLogin`、`cmdWhoami`、`syncHelpers` | 已有兼容包装 `{ user: ... }` | 中：需验证 401 和字段可空 | 保持独立兼容入口，不改前端 `/users/me` |
| `GET /api/v1/users/me` | 仅前端 | `src/lib/useAuthStatus.ts`、设置/管理页 | CLI 不用 | 返回扁平对象 | 中：若错误改成 `{ user: ... }` 会破坏前端 | 明确保留前端契约，不纳入 CLI 包装改造 |
| `POST/DELETE /api/v1/stars/:slug` | 仅 CLI | 前端不用；前端走 `/skills/:slug/star` | CLI `star` / `unstar` | 路由存在；响应已为 `{ ok: "true", ... }` | 低：需与 CLI schema 逐项验证 | 保持别名路由 |
| `POST/DELETE /api/v1/skills/:slug/star` | 仅前端 | `src/components/SkillDetailPage.tsx`、`src/routes/stars.tsx` | CLI 不用 | 与 CLI 别名共用同一 handler | 中：如果改坏会影响前端收藏交互 | 继续复用同一 handler，确保前端路径不变 |
| `GET /api/v1/users/me/stars` | 仅前端 | `src/routes/stars.tsx` | CLI 不用 | 返回 `{ items, nextCursor }` | 低 | 保持不变 |

## 已识别的不兼容点

按严重度排序：

1. `search` 无结果时返回 `results: null`
   - 影响：CLI 必然失败；前端搜索页也需要数组语义
   - 处置：service 或 handler 侧显式初始化空 slice
2. `skills` 列表未处理 `sort`
   - 影响：CLI `explore --sort` 参数不生效；前端当前多为客户端排序，但默认列表可能与 CLI 不一致
   - 处置：补后端 `sort` 支持，并验证默认排序对前端首页/列表页无回归
3. `whoami` 与 `/users/me` 契约不同
   - 影响：CLI 需要 `{ user: ... }`，前端需要扁平对象
   - 处置：保留双入口，不做合并
4. `star/unstar` 存在双路径
   - 影响：CLI 走 `/stars/:slug`，前端走 `/skills/:slug/star`
   - 处置：继续让两条路由复用同一 handler，避免前端改动
5. `skill detail` 需要同时满足 CLI 可空字段和前端扩展字段
   - 影响：前端详情页读取 `isStarred`，CLI 只校验 `skill/latestVersion/owner`
   - 处置：兼容修复时只补充、不删除字段

## 修改原则

- 共用接口优先做“向后兼容”的修复，避免迫使前端同步改动。
- 仅 CLI 使用的接口，直接按 CLI schema 收敛。
- 前端专用接口保持现状，除非它们与共用 handler 强耦合，才一起做回归验证。

## 当前实现进展（2026-03-17）

- 已落地的后端兼容修复：
  - `/api/v1/search` 无结果时稳定返回 `{ "results": [] }`
  - `/api/v1/skills` 支持 CLI 传入的 `sort` / `dir`
  - 新增 `/api/v1/whoami`、`/api/v1/stars/:slug` CLI 兼容路由
  - `publish`、`delete`、`undelete`、`star`、`unstar` 已统一收敛到 `ok: "true"`
  - `/api/v1/skills/:slug/versions` 已改为 `{ items, nextCursor }` 包装
  - `/api/v1/resolve` 已按 `content_hash` 匹配并保留 `{ match: null, latestVersion }` 语义
- 已补充的验证资产：
  - 后端新增 [`cli_api_compatibility_test.go`](/Users/logo/self_repo/claw_case/clawhub/backend/test/integration/cli_api_compatibility_test.go) 与 [`cli_auth_compatibility_test.go`](/Users/logo/self_repo/claw_case/clawhub/backend/test/integration/cli_auth_compatibility_test.go)
  - 前端为版本列表包装调整了 [`useSkillVersions.ts`](/Users/logo/self_repo/claw_case/clawhub/src/hooks/useSkillVersions.ts) 并修正了 [`skill-detail-page.test.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/__tests__/skill-detail-page.test.tsx)

## 手工验证兼容性残差（2026-03-17）

以下条目用于保存本轮 `npx clawhub@latest --registry <local>` 手工验证后仍需收口的兼容性问题，避免后续实现时遗漏：

1. `inspect --tag latest` 仍有残差
   - 现象：CLI 的 `inspect --tag latest` / `inspect --file ... --tag latest` 依赖 `skill.tags` 是 `{ latest: "1.2.3" }` 这种 tag 到版本号的映射；当前后端在 skill 详情里仍返回字符串数组，CLI 会把它当成普通对象条目处理，最终无法解析 `latest`。
   - 影响：显式使用 `--tag latest` 的 inspect 链路仍可能报 `Unknown tag "latest"`，即使 `latestVersion` 已存在。
   - 证据：[`packages/clawdhub/src/cli/commands/inspect.ts`](/Users/logo/self_repo/claw_case/clawhub/packages/clawdhub/src/cli/commands/inspect.ts) 的 `normalizeTags` 期望 tag 映射；[`backend/internal/service/skill_service.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/service/skill_service.go) 的 `skillToItem` 当前直接透传 `skill.Tags`。

2. `inspect --versions --limit <N>` 仍未真正尊重 `limit`
   - 现象：CLI 会向 `/api/v1/skills/{slug}/versions?limit=<N>` 发送 limit；当前后端虽然已改成 `{ items, nextCursor }` 包装，但 handler 仍然忽略该查询参数并返回全量版本列表，`nextCursor` 固定为 `null`。
   - 影响：schema 已兼容，但行为仍与 CLI 预期存在偏差；版本较多时，手工 inspect 输出会超出请求的 limit。
   - 证据：[`packages/clawdhub/src/cli/commands/inspect.ts`](/Users/logo/self_repo/claw_case/clawhub/packages/clawdhub/src/cli/commands/inspect.ts) 会显式设置 `limit`；[`backend/internal/handler/skills.go`](/Users/logo/self_repo/claw_case/clawhub/backend/internal/handler/skills.go) 的 `GetSkillVersionsHandler` 尚未解析 `limit` / `cursor`。

## 当前验证结论（2026-03-17）

- 前端 Vitest 已验证通过：
  - `bun run test src/__tests__/skill-detail-page.test.tsx`
- Go 集成测试当前未在本地沙箱完成实跑：
  - `go test ./test/integration ...` 因测试数据库地址 `10.8.8.120:5412` 在当前沙箱环境中被拒绝访问而失败，属于环境阻塞，不代表新增兼容测试本身失败。
- 因此，本变更可以视为“核心兼容修复已基本落地，仍有 inspect/tag 与 versions limit 两个手工验证残差待收口，且前端共用接口回归覆盖尚未完成”。
