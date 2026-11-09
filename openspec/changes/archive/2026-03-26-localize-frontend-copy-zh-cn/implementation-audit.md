# 前端中文化实施盘点

## 已覆盖的首批主路径

### 首页与导航
- `src/routes/index.tsx`
- `src/components/Header.tsx`

已替换内容：
- 首页首屏标题、副标题、CTA、空状态、加载态
- Skills 模式与 Souls 模式下的导航入口、上传入口、搜索入口
- 移动端菜单、主题切换 aria-label、登录/登出入口

### 技能列表与搜索主路径
- `src/routes/skills/index.tsx`
- `src/routes/skills/-SkillsToolbar.tsx`
- `src/routes/skills/-SkillsResults.tsx`
- `src/routes/skills/-useSkillsBrowseModel.ts`

已替换内容：
- 页面标题、副标题
- 搜索框 placeholder
- 筛选、排序、视图切换、分页
- 空状态、加载态、列表/卡片摘要兜底文案

### 技能详情主路径
- `src/components/SkillDetailPage.tsx`
- `src/components/SkillHeader.tsx`
- `src/components/SkillDetailTabs.tsx`
- `src/components/SkillVersionsPanel.tsx`
- `src/components/SkillFilesPanel.tsx`
- `src/components/SkillCommentsPanel.tsx`
- `src/components/SkillDiffCard.tsx`
- `src/components/SkillReportDialog.tsx`
- `src/components/SkillInstallCard.tsx`
- `src/components/SkillSecurityScanResults.tsx`
- `src/components/skillDetailUtils.ts`
- `src/components/UserBadge.tsx`

已替换内容：
- 详情头部、状态横幅、举报入口、管理入口
- 文件区、版本区、评论区、差异对比区
- 安全扫描结果、运行要求、安装信息
- 徽标、作者前缀、空状态、失败提示

### 上传页
- `src/routes/upload.tsx`
- `src/routes/upload/-utils.ts`

已替换内容：
- 表单标签、拖拽提示、文件计数
- 校验错误、状态提示、失败提示
- 更新日志 placeholder、发布按钮文案

### 登录页
- `src/routes/auth/login.tsx`

已替换内容：
- 入口页、邮箱登录、邮箱注册、账号激活
- OAuth 状态提示、登录错误、激活错误、重发提示

## 文案组织方案

本次采用“单语言中文化 + 文案收口”方案，不引入完整 i18n 框架。

新增文案模块：
- `src/copy/common.ts`
- `src/copy/navigation.ts`
- `src/copy/home.ts`
- `src/copy/skills.ts`
- `src/copy/upload.ts`
- `src/copy/auth.ts`
- `src/copy/import.ts`
- `src/copy/management.ts`
- `src/copy/my-skills.ts`
- `src/copy/stars.ts`
- `src/copy/user-profile.ts`
- `src/copy/dashboard.ts`
- `src/copy/settings.ts`
- `src/copy/souls.ts`

约定：
- 首批主路径组件优先从 `src/copy/` 读取用户可见长文案
- 共享术语放在 `common.ts` 和领域 copy 中复用
- 技术标识如 `SKILL.md`、`CLI`、`Nix` 保留原术语，其余用户说明文本统一中文化

## 本次暂未覆盖的次级页面

以下页面或模块仍可能保留英文文案，作为下一轮增量中文化清单：

- 认证后管理流中的二级操作弹窗
- 非主路径的提示组件、示例区块和历史兼容页面
