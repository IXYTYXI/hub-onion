## Context

当前仓库没有现成的 i18n 基础设施，`package.json` 中也未引入 `i18next`、`react-intl` 或同类依赖。前端用户可见文案主要以硬编码字符串形式散落在路由和组件中，且优先路径上的英文密度较高：

- 首页与 Souls 首页：[`src/routes/index.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/index.tsx)
- 顶部导航与移动端菜单：[`src/components/Header.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/Header.tsx)
- 技能列表页与工具栏/结果列表：[`src/routes/skills/index.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/skills/index.tsx)、[`src/routes/skills/-SkillsToolbar.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/skills/-SkillsToolbar.tsx)、[`src/routes/skills/-SkillsResults.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/skills/-SkillsResults.tsx)
- 技能详情页相关组件：[`src/components/SkillDetailPage.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/SkillDetailPage.tsx)、[`src/components/SkillHeader.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/SkillHeader.tsx)、[`src/components/SkillDetailTabs.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/components/SkillVersionsPanel.tsx)
- 上传页：[`src/routes/upload.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/upload.tsx)、[`src/routes/upload/-utils.ts`](/Users/logo/self_repo/claw_case/clawhub/src/routes/upload/-utils.ts)
- 登录页：[`src/routes/auth/login.tsx`](/Users/logo/self_repo/claw_case/clawhub/src/routes/auth/login.tsx)

这次需求的目标不是“支持多语言切换”，而是“尽快把主路径改成中文，并避免未来继续把文案硬编码回组件里”。因此需要一个足够轻量、不会提前引入完整 i18n 成本，但又能约束文案组织方式的方案。

## Goals / Non-Goals

**Goals:**

- 将主路径中的英文用户可见文案切换为中文
- 在不引入完整 i18n 框架的前提下，建立一个最小可维护的文案组织层
- 让页面文案、按钮文案、校验错误、空状态和加载状态都能在同一位置集中管理
- 让后续新增中文化范围时，可继续沿用相同组织方式，而不是重新散落到 JSX

**Non-Goals:**

- 不引入运行时语言切换
- 不新增 locale 路由、语言检测、中英双语并存或翻译回退逻辑
- 不要求本次覆盖所有后台页、管理页和历史遗留示例组件
- 不对 SEO 元数据、markdown 内容或用户上传内容做自动翻译

## Decisions

### 决策一：先做单语言 `zh-CN` 文案收口，不直接引入完整 i18n

当前目标明确是中文化现有页面，而不是支持语言切换。直接引入 `i18next` 等完整方案，会提前带来 Provider、命名空间、语言检测、fallback、插值规范与测试改造成本，但短期并不能显著提升交付价值。

因此本次采用“文案收口 + 中文落地”的最小方案：

- 仅提供一套 `zh-CN` 文案
- 不在本次实现 `t()`、locale 状态或切换 UI
- 先让主路径完成集中定义，再视未来需求升级为真正 i18n

备选方案：

- 直接引入完整 i18n
  - 优点：后续中英切换基础完备
  - 缺点：当前需求只要中文，提前付出基础设施成本，容易拖慢落地

### 决策二：新增轻量文案模块，而不是继续把中文硬编码回页面

本次不应只做逐文件翻译，否则只是把英文硬编码替换成中文硬编码，未来继续统一术语时仍然成本很高。文案应按页面域进行收口，例如：

- `src/copy/common.ts`
- `src/copy/home.ts`
- `src/copy/navigation.ts`
- `src/copy/skills.ts`
- `src/copy/upload.ts`
- `src/copy/auth.ts`

页面和组件只消费文案对象，不直接写长文本。这样可以先不引入 i18n，也能得到集中管理收益。

备选方案：

- 使用单一巨大 `copy.ts`
  - 优点：初期实现快
  - 缺点：随着页面变多会迅速膨胀，不利于维护

### 决策三：优先改“用户感知最强”的路径，并保留可扩展边界

根据当前代码盘点，首批优先范围定为：

- 首页
- 导航
- 技能列表
- 技能详情
- 上传
- 搜索
- 登录

这些区域覆盖首次访问、核心浏览、发布和登录链路，且文案密度高、用户感知强。管理页、dashboard、stars、settings、import 等二级页面可暂时不纳入本次第一轮交付，但文案层设计要允许后续继续接入。

### 决策四：把“文案盘点”作为实施前置任务，而不是边改边找

当前英文文案不只存在于标题，也散落在：

- 空状态
- Loading 文案
- Placeholder
- 校验错误
- 按钮与 tab 标签
- tooltip / aria-label
- 营销 hero 文案

因此应先形成一份主路径清单，按页面记录待替换文案类型，再开始代码替换。这样可以避免遗漏隐藏文案，尤其是校验报错和辅助可访问性文本。

## Risks / Trade-offs

- [风险] 先做单语言收口，未来引入真正 i18n 时仍需二次改造
  → Mitigation：文案模块的 key 与分组按页面域设计，后续可直接迁移到 `t()` 或 locale 字典

- [风险] 同一术语在不同页面可能出现翻译不一致
  → Mitigation：在 `common` 层定义共享术语，如“技能”“上传”“搜索”“登录”“加载中”

- [风险] 测试中直接断言英文字符串的用例会失效
  → Mitigation：同步更新相关测试断言，尽量以可见中文文案或角色语义断言为主

- [风险] 只做主路径会留下次级页面英文残留
  → Mitigation：在任务中明确“首批范围”与“后续范围”，避免误解为全站一次性完成

## Migration Plan

1. 盘点首批目标页面和组件中的英文用户可见文案
2. 新建轻量文案模块并抽取共享术语
3. 按优先范围逐页替换为 `zh-CN`
4. 更新涉及文案断言的测试
5. 运行页面回归检查，确认主路径不再出现明显英文残留

回滚策略：

- 若某一页改造后回归，可逐页回退到该页面原实现，不影响其他页面文案模块
- 若文案模块组织方式不合适，可保留中文结果，后续再调整模块切分，不影响用户可见行为

## Open Questions

- Souls 模式首页与 Souls 列表是否应与 Skills 主站一并在首批完成，还是作为同一主路径包内顺手覆盖
- 登录页中的后端错误消息若直接返回英文，是否在本次前端增加错误码到中文提示的映射
