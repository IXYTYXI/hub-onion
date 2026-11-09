## Why

当前前端主路径仍存在大量英文硬编码文案，覆盖首页、导航、技能列表、技能详情、上传、搜索和登录等关键用户路径。这会直接影响中文用户的理解成本，也让后续统一调整语气、术语和页面一致性变得困难。

## What Changes

- 盘点并替换前端主路径中的英文用户可见文案，首期统一为 `zh-CN`。
- 为前端增加一个最小可维护的文案组织层，将高频页面和组件的文案从 JSX 内部抽离到集中定义位置，而不是继续散落硬编码。
- 优先覆盖首页、导航、技能列表、技能详情、上传、搜索、登录；其余次级页面保留后续增量空间。
- 统一空状态、加载状态、按钮、表单标签、校验错误和营销标题的中文术语，减少同义词漂移。
- 本次不引入完整语言切换流程，不增加 locale 路由、语言选择器或运行时翻译依赖。

## Capabilities

### New Capabilities
- `frontend-zh-cn-copy`: 定义前端主路径在单语言 `zh-CN` 场景下的文案呈现与最小文案组织方式。

### Modified Capabilities

## Impact

- 前端页面与组件：`src/routes/index.tsx`、`src/components/Header.tsx`、`src/routes/skills/*`、`src/components/SkillDetailPage.tsx`、`src/components/SkillHeader.tsx`、`src/routes/upload.tsx`、`src/routes/search.tsx`、`src/routes/auth/login.tsx`
- 文案组织层：`src/lib/*` 或新增 `src/copy/*`
- 前端测试：涉及文案断言的 `src/__tests__/*` 与组件测试
