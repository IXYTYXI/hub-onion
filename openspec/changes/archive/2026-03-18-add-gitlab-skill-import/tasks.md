## 1. 导入来源与共享契约

- [x] 1.1 校正现有实现与 spec，使 GitLab 导入从“前端直连”改为“后端授权拉取”，并保留 GitHub 现有前端导入能力
- [x] 1.2 扩展 `packages/schema` 中的发布来源定义及相关类型，保持 `source.kind` 支持 `github` 与 `gitlab`
- [x] 1.3 明确并接入服务端固定 token/PAT 配置读取方式，约束 GitLab 导入只使用服务端凭据

## 2. Go 后端 GitLab 导入代理

- [x] 2.1 在 Go 后端实现私有 GitLab URL 解析逻辑，支持项目根、`/-/tree/<ref>/<path>` 和 `/-/blob/<ref>/<path>`
- [x] 2.2 在 Go 后端实现基于固定 token/PAT 的 GitLab 项目访问、ref 到 commit 解析和 host 白名单校验
- [x] 2.3 在 Go 后端实现 GitLab skill 候选探测、文件列表预览和默认文件选择逻辑
- [x] 2.4 在 Go 后端实现基于已锁定 commit 的文件内容拉取接口，供前端导入发布复用

## 3. `/import` 页面集成

- [x] 3.1 调整 `src/routes/import.tsx`，保留 GitHub 现有直连入口，并将 GitLab 路径改为调用后端预览 API
- [x] 3.2 将 GitLab 后端预览结果接入现有候选选择、文件选择、slug/displayName/version 编辑和发布提交流程
- [x] 3.3 在导入预览中展示 GitLab 项目、路径与 commit pinned 状态，并补齐认证/授权相关错误提示
- [x] 3.4 清理当前前端直连 GitLab 的实现，确保 GitLab 失败时不会影响 GitHub 导入页面可用性

## 4. 回归验证

- [x] 4.1 为 Go 后端 GitLab 导入代理补充单元测试，覆盖 URL 解析、host 校验、commit 解析、候选探测和文件拉取
- [x] 4.2 为 `/import` 页面补充 GitHub 保持可用、GitLab 走后端代理、认证失败和无候选等场景测试
- [x] 4.3 手工验证 GitHub 既有导入流程保持可用，再验证至少一个 GitLab 项目导入成功
