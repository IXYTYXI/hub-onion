## 1. 共享解析工具

- [x] 1.1 新增 `src/lib/skillFrontmatter.ts`，实现 frontmatter 解析、`name` 提取以及推荐 slug / displayName 生成函数
- [x] 1.2 为 `src/lib/skillFrontmatter.ts` 补充工具级测试，覆盖有效 frontmatter、非法 frontmatter、缺失 `name` 和 slug 派生规则

## 2. 上传页自动填充

- [x] 2.1 在 `src/routes/upload.tsx` 中为 `slug` 和 `displayName` 增加手工编辑标记，确保用户输入优先于自动补全
- [x] 2.2 在 `applyExpandedFiles()` 链路中接入 `SKILL.md` / `skills.md` 识别与 frontmatter `name` 解析
- [x] 2.3 在解析成功时仅对未被手工修改且当前为空的 `slug` 和 `displayName` 执行默认值填充

## 3. 文件列表删除交互

- [x] 3.1 在上传页文件列表每一行增加删除入口，并按当前渲染项 index 删除对应文件
- [x] 3.2 确保删除文件后现有派生状态可立即重算文件数、总大小、必需文件校验、非文本文件校验和发布按钮状态
- [x] 3.3 调整上传页相关文案与样式，保证删除按钮和自动填充提示与现有 UI 一致

## 4. 验证与回归

- [x] 4.1 补充上传页路由测试，覆盖自动填充、手工输入不被覆盖、删除非文本文件、删除 `SKILL.md`、删除最后一个文件等场景
- [x] 4.2 运行与上传页相关的测试命令，确认新交互不影响现有 multipart 发布流程和校验行为
