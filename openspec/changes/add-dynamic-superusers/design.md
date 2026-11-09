# 动态 Superuser 管理设计

## 目标

在不改变配置型 superuser 保底机制的前提下，为管理后台增加运行时可维护的飞书 superuser 邮箱集合。配置项只读展示，动态项可增删；配置与动态来源合并后共同决定 `IsSuperuser`。

## 数据模型

新增 `superuser_grants` 表：

- `id`：UUID 主键。
- `provider`：授权来源，当前固定为 `feishu`。
- `email`：规范化后的飞书邮箱，小写并去除首尾空白。
- `created_by`：创建该动态授权的用户 ID。
- `created_at`：创建时间。

约束：

- `(provider, email)` 唯一，避免重复授权。
- `email` 不允许为空。
- `provider` 当前仅由服务层写入 `feishu`，前端不提供 provider 选择。

## 权限判定

现有配置型 superuser 逻辑保持以飞书邮箱为主：`AuthService.IsSuperuserByIdentities` 基于 `auth_identities.provider_email` 匹配。配置中的 `subjects` 在当前需求中不作为独立用户 ID 语义处理，若继续保留配置项，也按飞书邮箱值并入同一邮箱判定集合。

新增动态判定不应在每次权限判断时查询数据库，而应使用内存判定集合：

1. 服务启动时读取配置文件 superuser，并查询 `superuser_grants` 表中的动态授权。
2. 将两类来源规范化为内存中的 provider/email 集合，例如 `feishu:name@example.com`。
3. `IsSuperuserByIdentities` 遍历当前用户的 `auth_identities`，只处理 `provider=feishu` 的身份。
4. 将 `ProviderEmail` 规范化为小写邮箱，并在内存集合中做 O(1) 查询。
5. 配置命中或动态命中任一成立，即返回 `true`。

系统仍不使用 `users.email` 判定 superuser。预置未注册邮箱是允许的，但必须等用户通过飞书登录并产生匹配身份后才会生效。

本次缓存语义默认单后端实例部署。不会出现多个后端实例之间需要同步内存缓存的场景，因此不引入分布式缓存、广播、轮询或版本订阅机制。

所有入口都 SHALL 使用同一个邮箱规范化函数，包括启动加载、同步缓存、添加动态授权、按邮箱删除和权限判定。规范化规则至少包含去除首尾空白、转小写和邮箱格式校验。

## 判定缓存与锁控制

`superuser_grants` 的数据库表仍是动态授权的持久化来源，但权限判定使用内存缓存，避免每次请求查询数据库。

- 启动加载：
  - `AuthService` 初始化时 SHALL 构建一个仅用于权限判定的内存集合。
  - 集合 SHALL 包含当前进程配置中的飞书 superuser 邮箱和数据库 `superuser_grants` 中的动态飞书邮箱。
  - 若启动时数据库动态授权加载失败，系统 SHALL 保留配置来源缓存，并允许后续判定在缓存缺失或未初始化时降级查询数据库。
- 读取：
  - `IsSuperuserByIdentities` SHALL 通过读锁读取内存集合。
  - 当内存集合已初始化时，读取路径 MUST NOT 查询 `superuser_grants` 数据库表。
  - 当内存集合缺失、尚未初始化或被标记为需要重建时，读取路径 MAY 降级查询 `superuser_grants` 表一次，并在写锁保护下回填内存集合。
  - 若降级查询数据库失败，系统 SHALL 保留配置来源判定能力；动态 superuser 判定 SHALL fail closed，即不因查询失败默认授予动态 superuser 权限，并记录日志。
  - 并发请求同时发现缓存缺失时，系统 MAY 允许多个请求并发回填，也 MAY 使用 double-check 或 singleflight 降低重复查询；无论采用哪种方式，写入内存集合都必须受写锁保护。
- 更新：
  - `POST /api/v1/admin/superusers` 成功写入数据库后，SHALL 在同一请求流程中通过写锁把新增邮箱加入内存集合。
  - `DELETE /api/v1/admin/superusers?email={email}` 成功删除数据库记录后，SHALL 在同一请求流程中通过写锁从内存集合移除对应邮箱。
  - 若数据库写入或删除失败，MUST NOT 更新内存集合。
  - 动态授权删除 SHALL 以邮箱作为查询和删除参数，不得使用用户 ID 作为删除依据。
  - 缓存更新 SHALL 在锁保护下完成；若发现 DB 与缓存可能不一致，系统 SHALL 支持由管理面板主动触发缓存同步。
  - 缓存全量重建 SHALL 先在锁外查询数据库并构建新的集合，再短暂持有写锁替换内存引用，避免数据库慢查询阻塞权限判定读取。
- 使用边界：
  - 该缓存仅用于 `IsSuperuser` / 管理权限判定。
  - `GET /api/v1/admin/superusers` 的动态列表 SHALL 继续查询数据库，确保管理页面展示持久化真实状态，而不是读取判定缓存。
  - 人工直接修改 `superuser_grants` 表不会自动影响内存判定集合，必须通过管理面板同步按钮或重启服务后才会生效。

## 缓存同步

管理面板 SHALL 提供“同步缓存”按钮，由 superuser 主动触发数据库到内存判定集合的刷新。

- 后端 SHALL 提供 `POST /api/v1/admin/superusers/sync-cache` 或等价接口。
- 同步接口 SHALL 在锁外重新读取配置 superuser 与数据库动态 superuser，并构建新的判定集合。
- 同步接口 SHALL 在短写锁保护下替换旧的内存判定集合。
- 同步接口 SHALL 返回同步结果，至少包含当前缓存中的动态授权数量或同步状态。
- 同步接口只影响权限判定缓存，不改变数据库动态授权。
- 同步接口以调用时当前权限判定结果作为授权依据；同步成功后，当前操作者 MAY 因缓存刷新而失去后续 superuser 权限。

## 后端 API

所有接口挂在现有 `/api/v1/admin` 分组下，并沿用 `HasManagementAccess && IsSuperuser` 校验。

- `GET /api/v1/admin/superusers`
  - 返回配置项与动态项：
    - `configured`: 当前进程加载的 `auth.superusers.providers.feishu.emails`，只读。
    - `dynamic`: 数据库中的动态授权。
  - 该接口继续查询数据库动态授权，不使用权限判定缓存作为列表数据源。
- `POST /api/v1/admin/superusers`
  - 请求体：`{ "email": "name@example.com" }`
  - 服务端固定 `provider=feishu`。
  - 成功返回创建后的动态授权。
  - 重复邮箱返回 409，非法邮箱返回 400。
  - 若邮箱已存在于配置文件 superuser 中，返回稳定错误，不创建动态授权。
  - 数据库创建成功后同步更新内存判定集合。
- `DELETE /api/v1/admin/superusers?email={email}`
  - 按邮箱删除动态授权，服务端固定 `provider=feishu`。
  - 不允许使用用户 ID 作为删除条件。
  - 不存在返回 404。
  - 若邮箱只存在于配置文件 superuser 中，返回稳定错误并保持配置项只读。
  - 数据库删除成功后同步更新内存判定集合。
- `POST /api/v1/admin/superusers/sync-cache`
  - 从配置与数据库重新构建内存判定集合。
  - 不修改数据库。
  - 用于人工改库后或管理员怀疑缓存不一致时主动同步。

## 前端交互

`/management` 新增 `superusers` tab。

- 配置文件管理员区：
  - 只读展示配置内飞书邮箱。
  - 不显示编辑或删除按钮。
  - 提示配置项需要改 YAML 并重启服务。
- 动态管理员区：
  - 邮箱输入框与添加按钮。
  - 列表展示动态授权邮箱、创建时间和删除按钮。
  - 删除时提交该动态授权的邮箱，而不是用户 ID。
  - 添加或删除成功后刷新列表。
- 缓存同步区：
  - 展示“同步缓存”按钮。
  - 点击后调用同步缓存接口，将数据库动态名册主动同步到内存判定集合。

非 superuser 仍在 management 顶层被拦截，并且不会请求 admin superuser API。

## 错误处理

- 空邮箱或格式明显非法：前端先展示表单错误，不发请求。
- 服务端校验失败：返回稳定错误字段，前端展示在表单区域。
- 重复动态邮箱：返回 409。
- 添加已由配置文件授权的邮箱：返回稳定错误，例如 `config_superuser_readonly` 或等价错误码，提示无需动态添加。
- 删除配置文件中的 superuser 邮箱：返回稳定错误，例如 `config_superuser_readonly`；配置项仍只能通过配置变更和重启管理。
- 加载失败：tab 内展示失败提示和重试入口。
- 动态用户删除自己的授权：允许。删除后下一次权限请求会失效；配置 superuser 作为保底入口不可通过页面删除。
- 人工直接修改数据库后不会自动影响权限判定缓存；需要点击管理面板同步缓存按钮或重启服务。

## 测试策略

后端集成测试覆盖权限、配置只读展示、动态授权生效、删除后失效、重复与非法邮箱，并验证缓存已初始化时 superuser 判定路径不访问 `superuser_grants` 数据库表。前端 route 测试覆盖 tab 懒加载、只读展示、添加、按邮箱删除、本地校验、同步缓存按钮和非 superuser 不请求。

判定路径“不查库”的测试建议采用可观测方式验证：先让服务启动加载动态授权并完成缓存初始化，然后用一个会记录 SQL 的测试 DB logger、mock repository 或测试钩子统计 `superuser_grants` 查询次数；在调用 `GET /api/v1/users/me` 或 admin 权限接口时，断言该请求没有发生针对 `superuser_grants` 的查询。缓存缺失降级测试则反过来：先清空或标记缓存未初始化，再调用判定，断言发生一次 DB 查询并且后续再次判定不再查库。

### 判定缓存测试流程

1. 启动加载缓存：
   - 在创建 `AuthService` 前，先向 `superuser_grants` 插入 `dynamic-super@example.com`。
   - 创建带配置 superuser 的 `AuthService`。
   - 创建一个飞书授权身份邮箱为 `dynamic-super@example.com` 的用户。
   - 调用 `GET /api/v1/users/me` 或 `IsSuperuser`，断言 `isSuperuser=true`。
   - 这个用例证明启动时数据库动态授权已经进入内存判定集合。

2. 缓存已初始化时不查库：
   - 在启动加载缓存完成后，开启 SQL 记录器、mock repository 计数器或测试钩子。
   - 调用 `GET /api/v1/users/me`、`GET /api/v1/admin/superusers` 之外的 admin 权限接口，或直接调用 `IsSuperuser`。
   - 断言该判定流程没有发生针对 `superuser_grants` 的查询。
   - 注意：`GET /api/v1/admin/superusers` 本身是管理列表接口，按设计应查询数据库，不能用于“不查库判定”断言。

3. 缓存缺失时降级查询并回填：
   - 通过测试专用方法或构造方式让内存判定集合处于未初始化或需要重建状态。
   - 第一次调用 `IsSuperuser`，断言会查询一次 `superuser_grants` 并返回正确权限。
   - 随后再次调用同一判定，断言不再查询 `superuser_grants`，证明第一次已经回填缓存。

4. 增删后缓存同步：
   - 使用配置 superuser 调用 `POST /api/v1/admin/superusers` 添加 `new-admin@example.com`。
   - 不重启服务，立即用该邮箱对应飞书用户访问 admin 接口，断言成功。
   - 调用 `DELETE /api/v1/admin/superusers?email=new-admin@example.com`。
   - 不重启服务，立即再次访问 admin 接口，断言返回 403。

5. 按邮箱删除：
   - 创建动态授权后，只通过 `email` 参数删除。
   - 测试不得依赖用户 ID 或 grant ID。
   - 断言数据库记录删除，且内存判定集合中该邮箱也被移除。

6. 主动同步缓存：
   - 直接向数据库插入 `manual-admin@example.com`，不调用新增 API。
   - 在未触发同步前，用该邮箱用户判定 superuser，断言不生效。
   - 调用 `POST /api/v1/admin/superusers/sync-cache`。
   - 再次判定同一用户，断言生效。
   - 这个用例证明人工改库不会自动生效，必须主动同步或重启。

7. 并发读写安全：
   - 使用 Go race detector 或并发测试，同时启动多个 goroutine 做 `IsSuperuser` 判定和动态名册增删/同步缓存。
   - 断言无 data race、无 panic，并且最终缓存状态与数据库动态授权一致。
   - 该用例主要验证读写锁覆盖读取、增删和全量同步三条路径。
