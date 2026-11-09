## 1. 契约盘点与空结果修复

- [x] 1.1 逐项核对 `packages/clawdhub` 与 `src/` 中实际使用的后端路由、schema 与当前后端 handler 返回结构，形成“仅 CLI / 仅前端 / 共用”实现对照表
- [x] 1.2 对共用接口逐项评估兼容修复是否会影响前端逻辑，并在对照表中记录处置方式（直接修复 / 补字段 / 加兼容路由 / 保持前端入口）
- [x] 1.3 修复 `/api/v1/search` 的空结果返回，确保 `results` 在无数据时始终为 `[]`
- [x] 1.4 修复其他 CLI 消费的集合响应，确保列表类接口返回空数组和对象包装，而不是 `null` 或裸数组

## 2. 路径与响应格式兼容

- [x] 2.1 为 CLI 增加或对齐兼容路由，包括 `/api/v1/whoami` 与 `/api/v1/stars/:slug`
- [x] 2.2 修复 `publish`、`delete`、`undelete`、`star`、`unstar` 的成功响应格式，使其符合 CLI schema 对 `ok` 和附加字段的要求
- [x] 2.3 修复 `GET /api/v1/skills/:slug/versions` 和 `GET /api/v1/skills/:slug` 的包装层与可空字段行为，使其兼容 CLI `inspect`、`explore`、`install`、`update`

## 3. 回归验证

- [x] 3.1 为 CLI 兼容路径补充后端测试，覆盖 `search`、`publish`、`delete/undelete`、`whoami`、`star/unstar`
- [x] 3.2 增加无结果和幂等成功场景测试，防止 `null` 集合和错误 `ok` 值再次回归
- [x] 3.3 验证前端当前使用的共用接口在兼容修复后仍保持可用，至少覆盖搜索、技能详情、版本列表、收藏相关页面或 hooks
- [ ] 3.4 使用本地后端手工验证 `npx clawhub@latest --registry <local>` 的核心命令至少覆盖 `search`、`inspect`、`publish`、`delete`、`whoami`

## 2026-03-17 状态备注

- 3.3 已补齐搜索、技能详情、版本列表与收藏链路的前端回归覆盖，涉及 [`src/__tests__/use-search-skills.test.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/__tests__/use-search-skills.test.tsx)、[`src/__tests__/skill-detail-page.test.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/__tests__/skill-detail-page.test.tsx)、[`src/hooks/useSkillVersions.ts`](/Users/logo/self_repo/claw_case/clawhub/src/hooks/useSkillVersions.ts)、[`src/__tests__/stars-route.test.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/__tests__/stars-route.test.tsx)。
- 3.4 已完成一轮 `npx clawhub@latest` 手工验证记录整理，但仍有兼容性残差未清零；详见 [`implementation-audit.md`](/Users/logo/self_repo/claw_case/clawhub/openspec/changes/fix-cli-api-compatibility/implementation-audit.md) 中的“手工验证兼容性残差（2026-03-17）”，因此该任务暂不勾选。
- 后端新增/更新的 CLI 兼容测试已落在 [`backend/test/integration/cli_api_compatibility_test.go`](/Users/logo/self_repo/claw_case/clawhub/backend/test/integration/cli_api_compatibility_test.go) 与 [`backend/test/integration/cli_auth_compatibility_test.go`](/Users/logo/self_repo/claw_case/clawhub/backend/test/integration/cli_auth_compatibility_test.go)。
