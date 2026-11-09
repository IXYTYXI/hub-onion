## 为什么

当前 superuser 完全由 `backend/config/*.yaml` 中的 `auth.superusers.providers.feishu.emails` 管理。新增或移除管理用户时需要改配置并重启服务，无法在后台及时授权临时或新增管理员。

同时，配置内 superuser 是部署层面的保底入口，不应被运行时页面修改。我们需要在管理后台提供一个独立的动态管理员名册：配置项只读展示，数据库中的动态飞书邮箱可由 superuser 增删，并立即参与后台权限判定。

## 改什么

- 新增动态 superuser 名册能力，仅支持飞书邮箱。
- 保留配置文件 superuser 作为只读来源，并在后台展示。
- 新增数据库表保存动态 superuser 邮箱，支持预置未注册邮箱。
- 扩展 `IsSuperuser` 判定：配置命中或动态名册命中都视为 superuser。
- 在服务启动时将配置 superuser 与数据库动态 superuser 加载到内存判定集合，并在动态名册增删时同步更新该集合，避免每次权限判定查询数据库。
- 为内存判定集合的加载、读取和更新增加锁控制；该缓存仅用于权限判定，不用于管理页面列表展示。
- 当前缓存语义仅面向单后端实例部署；不设计跨实例广播、分布式缓存或多实例一致性。
- 当判定缓存缺失或尚未初始化时，权限判定允许降级查询数据库并回填一次内存缓存。
- 新增 `/api/v1/admin/superusers` 管理接口。
- 新增管理面板同步缓存按钮，允许 superuser 主动将数据库动态名册同步到内存判定缓存。
- 在 `/management` 增加 `superusers` tab，用于展示配置管理员和增删动态管理员。
- 补充后端集成测试和前端 route 测试。

## 不改什么

- 不允许通过 API 修改或删除配置文件中的 superuser。
- 不恢复 `/admin/users*` 用户审核前端入口。
- 不改为使用 `users.email` 判定 superuser，仍基于 `auth_identities` 中的飞书授权邮箱。
- 不支持 GitHub、GitLab 或跨 provider 邮箱匹配。
- 不支持多实例部署下的动态 superuser 缓存同步；如未来需要多实例，需要另行设计广播、轮询或集中缓存。

## 影响范围

- 后端：数据库 SQL、model、service、auth 判定缓存、admin handler、routes、集成测试。
- 前端：management tab、API 封装、hook、类型、文案、样式和 Vitest。
- OpenSpec：新增 `management-admin-roster`，并更新 `user-review-workflow`、`skill-management-surfaces`、`go-backend-api` 的 delta。
