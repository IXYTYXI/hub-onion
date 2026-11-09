## 1. OpenSpec

- [x] 1.1 创建独立 `add-dynamic-superusers` change，并补充 proposal、design、tasks
- [x] 1.2 新增 `management-admin-roster` capability delta
- [x] 1.3 更新 `user-review-workflow`、`skill-management-surfaces`、`go-backend-api` delta
- [x] 1.4 运行 `openspec validate add-dynamic-superusers --strict`

## 2. 后端数据与权限

- [x] 2.1 在 `backend/data/sql/<YYYYMMDDHHMM>/` 准备 `schema.sql`、`data.sql`、`upgrade.sql`
- [x] 2.2 新增动态 superuser model 与 service，支持列表、创建、删除和命中查询
- [x] 2.3 扩展 `AuthService.IsSuperuserByIdentities`，合并配置来源和动态来源
- [x] 2.4 新增 `/api/v1/admin/superusers` 查询、创建和删除接口
- [x] 2.5 将新 handler 挂载到现有 admin routes

## 3. 前端管理页面

- [x] 3.1 新增 admin superuser API 封装、hook 和类型
- [x] 3.2 将 `/management` tab 扩展为 `skills | maintenance | categories | superusers`
- [x] 3.3 实现配置 superuser 只读展示和动态 superuser 增删 UI
- [x] 3.4 补充管理页面文案和必要样式

## 4. 测试与验证

- [x] 4.1 补充后端集成测试：非 superuser 403、配置只读展示、动态授权生效、删除后失效、重复和非法邮箱
- [x] 4.2 补充前端 route 测试：tab 懒加载、配置项不可删、动态项可删、添加和本地校验
- [x] 4.3 运行相关后端 Go 测试
- [x] 4.4 运行相关前端 Vitest 和 lint
- [x] 4.5 重新运行 `openspec validate add-dynamic-superusers --strict`

## 5. 判定缓存优化

- [x] 5.1 在 `AuthService` 启动初始化时加载配置 superuser 和数据库动态 superuser 到内存判定集合
- [x] 5.2 为内存判定集合增加读写锁控制，权限判定走读锁，动态名册增删后的缓存更新走写锁
- [x] 5.3 调整 `IsSuperuserByIdentities`，缓存已初始化时动态 superuser 判定只读取内存集合，不再查询 `superuser_grants` 表
- [x] 5.4 增加缓存缺失或未初始化时的降级查询与一次性回填逻辑
- [x] 5.5 确保配置加载、添加、删除、同步和判定都复用同一邮箱规范化逻辑
- [x] 5.6 调整动态 superuser 创建和删除流程，创建按邮箱写入，删除按邮箱查询/删除，数据库成功后同步更新内存判定集合
- [x] 5.7 拒绝添加已存在于配置文件中的 superuser 邮箱，并返回稳定错误
- [x] 5.8 拒绝删除只来自配置文件的 superuser 邮箱，并保持配置缓存不变
- [x] 5.9 新增 `POST /api/v1/admin/superusers/sync-cache`，支持管理面板主动把数据库动态授权同步到内存判定集合
- [x] 5.10 全量缓存重建采用锁外查询/构建、短写锁替换，避免慢查询阻塞权限判定读取
- [x] 5.11 保持 `GET /api/v1/admin/superusers` 管理列表继续从数据库读取动态授权，不使用判定缓存
- [x] 5.12 前端 superusers tab 增加同步缓存按钮，并将删除动态 superuser 的请求改为按邮箱提交
- [x] 5.13 补充后端测试：启动前插入动态授权，创建 `AuthService` 后无需重启即可通过缓存判定为 superuser
- [x] 5.14 补充后端测试：缓存已初始化时调用 `IsSuperuser` 或 admin 权限接口，不发生 `superuser_grants` 查询
- [x] 5.15 补充后端测试：缓存缺失或标记重建时第一次判定查询 DB 并回填，第二次判定不再查 DB
- [x] 5.16 补充后端测试：通过 API 添加动态 superuser 后立即生效，通过邮箱删除后立即失效
- [x] 5.17 补充后端测试：删除动态 superuser 仅使用邮箱参数，不依赖用户 ID 或 grant ID
- [x] 5.18 补充后端测试：人工直接写库不自动生效，调用 `POST /api/v1/admin/superusers/sync-cache` 后生效
- [x] 5.19 补充后端测试：添加配置 superuser 被拒绝、删除配置 superuser 被拒绝、降级查询失败时动态权限 fail closed
- [x] 5.20 补充后端并发测试或 race 验证：并发判定、增删和同步缓存无 data race，最终缓存与 DB 一致
- [x] 5.21 补充前端测试，覆盖同步缓存按钮、按邮箱删除、配置项增删被拒绝和同步失败提示
- [x] 5.22 运行相关后端 Go 测试、前端 Vitest，并重新执行 `openspec validate add-dynamic-superusers --strict`
