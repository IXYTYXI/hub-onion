## 1. 后端排序与筛选

- [x] 1.1 修正公开 `ListSkills`：`newest`/`created_at` → `created_at`，保留 `updated` → `updated_at`
- [x] 1.2 扩展 `listManagedSkills` / `GET /api/v1/admin/skills`：支持 `sort`/`dir`（缺省 `updated_at`/`desc`，非法 400）、稳定次排序 `id ASC`
- [x] 1.3 实现 `createdFrom`/`createdTo` 契约：仅 `YYYY-MM-DD`（`Asia/Shanghai` 日界）或带时区 RFC3339；闭区间 `[from, to]`；反转/非法 400；列表与导出共用解析
- [x] 1.4 补充集成测试：排序缺省/非法、时间边界包含、反转范围、非法格式、单侧边界

## 2. 管理侧 CSV 导出

- [x] 2.1 新增 `GET /api/v1/admin/skills/export`（superuser、CSV、5000 行上限、RFC3339/`Asia/Shanghai`）
- [x] 2.2 空字段输出空串；`Content-Disposition: attachment; filename="skills-YYYYMMDD-HHmmss.csv"`
- [x] 2.3 导出复用列表筛选/排序/时间契约与稳定次序
- [x] 2.4 补充导出成功、空字段、超限、403、时间非法的集成测试

## 3. 前端管理面与我的 skill

- [x] 3.1 `/management` Skills 列表展示提交时间、最近更新、最新版本提交时间（Unix 秒正确转换）
- [x] 3.2 增加按时间排序与提交时间范围筛选；日期控件编码为 `YYYY-MM-DD`（或带时区 RFC3339）
- [x] 3.3 增加「导出 CSV」按钮，带上当前筛选/排序
- [x] 3.4 `/my/skills` 列表展示提交时间（不做导出）
- [x] 3.5 更新文案与 management / my-skills 路由测试

## 4. 公开列表与 CLI

- [x] 4.1 公开 `/skills` 的 `newest` 请求参数与后端口径对齐
- [x] 4.2 CLI `explore --sort newest` 改为请求 `newest`/`created_at`，文本/JSON 展示时间字段
- [x] 4.3 在 `explore` 下增加 CSV 导出模式；`--from`/`--to` 遵循同一时间契约；覆盖非法参数与 403
- [x] 4.4 更新 CLI 单测与必要 schema/帮助文案

## 5. 验收收尾

- [x] 5.1 按 openspec 场景冒烟（含闭区间边界、反转 400、CSV 文件名与空字段）
- [x] 5.2 确认未引入 `published_at`，CSV 时区为 `Asia/Shanghai`，导出挂在 `explore`

## 6. 增量：双时间口径筛选 + CSV 中文表头与昵称（待实现）

- [x] 6.1 后端：管理列表/导出增加 `timeField=created_at|submitted_at`（缺省 `created_at`）；`submitted_at` 按最新版本 `created_at` 闭区间筛选，无版本排除；非法 `timeField` → 400
- [x] 6.2 后端：管理列表/导出 `sort` 增加 `submitted_at`；无版本记录按 design §8 排到末尾；补充筛选/排序集成测试
- [x] 6.3 后端：CSV 改为中文表头 + UTF-8 BOM；新增「用户昵称」列（`owner.displayName`）；「创建时间」「提交时间」分别对应 `createdAt` / `latestVersion.createdAt`；更新导出测试
- [x] 6.4 前端 Management：文案对齐新口径；时间筛选增加口径选择并传 `timeField`；排序增加「提交时间」；导出带上 `timeField`
- [x] 6.5 前端 `/my/skills`：提交时间改为 `latestVersion.createdAt`；宜同时展示创建时间；更新测试
- [x] 6.6 CLI `explore` 导出增加时间口径 flag → `timeField`；不改写中文表头；更新单测与帮助文案
- [ ] 6.7 按增量场景冒烟后交审核猫 review
