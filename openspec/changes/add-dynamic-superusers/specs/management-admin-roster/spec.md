## ADDED Requirements

### Requirement: 动态 superuser 名册
系统 SHALL 提供仅 superuser 可管理的动态飞书 superuser 名册，并将其与配置文件 superuser 合并加载到内存判定集合，用于后台权限判定。

#### Scenario: 配置与动态来源合并
- **WHEN** 系统判断一个已登录用户是否为 superuser
- **THEN** 系统 SHALL 同时检查配置文件 superuser 和动态 superuser 名册
- **THEN** 任一来源命中都 SHALL 将该用户视为 superuser

#### Scenario: 动态名册基于飞书授权邮箱
- **WHEN** 系统检查动态 superuser 名册
- **THEN** 系统 SHALL 仅匹配 `provider=feishu` 的授权身份
- **THEN** 系统 SHALL 使用授权身份的 provider email 进行大小写不敏感匹配
- **THEN** 系统 MUST NOT 使用本地 `users.email` 作为动态 superuser 匹配源

#### Scenario: 邮箱规范化一致
- **WHEN** 系统处理配置加载、动态授权创建、动态授权删除、缓存同步或权限判定中的邮箱
- **THEN** 系统 SHALL 使用同一个邮箱规范化逻辑
- **THEN** 规范化 SHALL 至少包含去除首尾空白、转小写和邮箱格式校验

#### Scenario: 配置 subjects 按飞书邮箱处理
- **WHEN** 系统加载配置文件中的 superuser 配置
- **THEN** 系统 SHALL 以飞书邮箱列表作为配置 superuser 的判定来源
- **THEN** 若配置中仍存在 `subjects` 项，系统 SHALL 仅将其中符合邮箱格式的值并入飞书邮箱判定集合
- **THEN** 系统 MUST NOT 在本次能力中引入独立的非邮箱 subject 管理语义

#### Scenario: 启动加载判定缓存
- **WHEN** 后端服务初始化认证服务
- **THEN** 系统 SHALL 将配置文件中的飞书 superuser 和数据库中的动态飞书 superuser 加载到内存判定集合
- **THEN** 后续权限判定 SHALL 使用该内存集合

#### Scenario: 单实例缓存语义
- **WHEN** 系统使用动态 superuser 判定缓存
- **THEN** 系统 SHALL 假设当前部署为单后端实例
- **THEN** 系统 SHALL NOT 要求跨实例广播、分布式缓存、轮询同步或多实例一致性机制

#### Scenario: 判定路径不查询动态名册表
- **WHEN** 系统执行 `IsSuperuser` 或等价管理权限判定，且内存判定集合已经初始化
- **THEN** 系统 SHALL 使用内存判定集合匹配飞书授权邮箱
- **THEN** 系统 MUST NOT 在该判定路径中查询 `superuser_grants` 表

#### Scenario: 缓存缺失时降级查询并回填
- **WHEN** 系统执行 superuser 判定但内存判定集合缺失、尚未初始化或被标记为需要重建
- **THEN** 系统 MAY 查询数据库动态 superuser 名册
- **THEN** 系统 SHALL 在写锁保护下将查询结果回填到内存判定集合
- **THEN** 后续判定 SHALL 优先使用回填后的内存判定集合

#### Scenario: 缓存缺失且数据库查询失败
- **WHEN** 系统执行 superuser 判定但缓存缺失，并且降级查询数据库失败
- **THEN** 系统 SHALL 保留配置文件 superuser 的判定能力
- **THEN** 系统 SHALL 对动态 superuser 判定 fail closed
- **THEN** 系统 MUST NOT 因数据库查询失败默认授予动态 superuser 权限

#### Scenario: 并发缓存回填
- **WHEN** 多个请求同时发现内存判定集合缺失或需要重建
- **THEN** 系统 MAY 允许多个请求并发执行回填查询，也 MAY 使用 double-check 或 singleflight 避免重复查询
- **THEN** 任一回填写入内存判定集合时都 SHALL 使用写锁

#### Scenario: 判定缓存读写锁
- **WHEN** 系统读取或更新内存判定集合
- **THEN** 系统 SHALL 使用锁控制并发访问
- **THEN** 权限判定 SHALL 使用读锁
- **THEN** 动态名册增删后的缓存更新 SHALL 使用写锁

#### Scenario: 全量同步短写锁替换
- **WHEN** 系统执行启动加载、降级回填或主动同步缓存
- **THEN** 系统 SHALL 在锁外查询数据库并构建新的判定集合
- **THEN** 系统 SHALL 仅在替换内存集合引用时短暂持有写锁
- **THEN** 系统 SHOULD 避免数据库慢查询长期阻塞权限判定读取

#### Scenario: 预置未注册邮箱
- **WHEN** superuser 添加一个尚未注册或尚未登录的飞书邮箱到动态名册
- **THEN** 系统 SHALL 保存该动态授权
- **WHEN** 该邮箱后续通过飞书登录并产生匹配授权身份
- **THEN** 系统 SHALL 将其视为 superuser

### Requirement: 配置 superuser 只读展示
系统 SHALL 允许 superuser 在管理后台查看配置文件中的飞书 superuser，并禁止通过运行时 API 修改配置来源。

#### Scenario: 查看配置 superuser
- **WHEN** superuser 请求管理员名册
- **THEN** 系统 SHALL 返回当前进程加载的配置文件飞书 superuser 邮箱
- **THEN** 每个配置项 SHALL 标记为只读来源

#### Scenario: 配置 superuser 不可删除
- **WHEN** superuser 在管理后台查看配置项
- **THEN** 前端 MUST NOT 为配置项展示删除或编辑操作
- **THEN** 后端 SHALL NOT 提供删除配置项的 API

### Requirement: 动态 superuser 增删
系统 SHALL 允许任一 superuser 添加或删除数据库中的动态飞书 superuser 邮箱。

#### Scenario: 添加动态 superuser
- **WHEN** superuser 提交有效飞书邮箱到 `POST /api/v1/admin/superusers`
- **THEN** 系统 SHALL 创建动态 superuser 授权
- **THEN** 系统 SHALL 在数据库创建成功后同步更新内存判定集合
- **THEN** 响应 SHALL 返回创建后的动态授权

#### Scenario: 添加已配置 superuser 被拒绝
- **WHEN** superuser 提交一个已经存在于配置文件 superuser 中的邮箱到 `POST /api/v1/admin/superusers`
- **THEN** 系统 SHALL 返回稳定错误
- **THEN** 系统 MUST NOT 创建重复的动态授权

#### Scenario: 删除动态 superuser
- **WHEN** superuser 请求 `DELETE /api/v1/admin/superusers?email={email}` 删除动态授权
- **THEN** 系统 SHALL 删除该动态授权
- **THEN** 系统 SHALL 在数据库删除成功后同步更新内存判定集合
- **THEN** 该邮箱后续 SHALL 不再因该动态授权获得 superuser 权限

#### Scenario: 删除配置 superuser 被拒绝
- **WHEN** superuser 请求删除一个只存在于配置文件 superuser 中的邮箱
- **THEN** 系统 SHALL 返回稳定错误
- **THEN** 系统 MUST NOT 从内存判定集合移除该配置邮箱

#### Scenario: 删除动态 superuser 使用邮箱
- **WHEN** 系统删除动态 superuser
- **THEN** 系统 SHALL 使用规范化后的飞书邮箱作为查询和删除参数
- **THEN** 系统 MUST NOT 使用用户 ID 作为删除或缓存移除依据

#### Scenario: 管理列表继续查询数据库
- **WHEN** superuser 请求 `GET /api/v1/admin/superusers`
- **THEN** 系统 SHALL 从配置快照和数据库动态授权生成管理列表
- **THEN** 系统 MUST NOT 将内存判定集合作为动态管理列表的数据源

#### Scenario: 主动同步判定缓存
- **WHEN** superuser 在管理后台触发同步缓存操作
- **THEN** 系统 SHALL 从配置快照和数据库动态授权重新构建内存判定集合
- **THEN** 系统 SHALL 在写锁保护下替换旧的内存判定集合
- **THEN** 系统 MUST NOT 因同步缓存操作修改数据库动态授权

#### Scenario: 同步后当前操作者可能失权
- **WHEN** 当前操作者在缓存未同步时仍被判定为 superuser 并触发同步缓存
- **THEN** 系统 SHALL 按同步前的当前权限判定允许或拒绝该同步请求
- **THEN** 同步成功后当前操作者 MAY 因缓存刷新而失去后续 superuser 权限

#### Scenario: 人工改库需要主动同步
- **WHEN** 运维或其他外部流程直接修改 `superuser_grants` 表
- **THEN** 系统 SHALL NOT 保证该变更自动进入内存判定集合
- **THEN** 管理员 SHALL 通过同步缓存操作或重启服务使人工数据库变更进入权限判定

#### Scenario: 动态 superuser 互相管理
- **WHEN** 当前用户通过动态名册获得 superuser 权限
- **THEN** 系统 SHALL 允许其添加或删除其他动态 superuser

#### Scenario: 非 superuser 被拒绝
- **WHEN** 非 superuser 请求任一 `/api/v1/admin/superusers` 接口
- **THEN** 系统 SHALL 返回 403 Forbidden
- **THEN** 系统 MUST NOT 修改动态 superuser 名册

#### Scenario: 重复或非法邮箱被拒绝
- **WHEN** superuser 提交空邮箱、格式非法邮箱或已存在的动态邮箱
- **THEN** 系统 SHALL 返回稳定错误
- **THEN** 系统 MUST NOT 创建重复或无效授权
