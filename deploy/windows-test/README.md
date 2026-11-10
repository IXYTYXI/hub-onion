# Windows 隔离测试环境

在目标 Windows 机器安装并启动 Docker Desktop（Linux 容器模式），然后在 PowerShell 中执行：

```powershell
git clone https://github.com/IXYTYXI/hub-onion.git
cd hub-onion
.\deploy\windows-test\setup.ps1
```

脚本首次执行会生成 `deploy/windows-test/.env`，其中是随机测试凭据；该文件不提交到 Git，也不会进入 Docker 构建上下文。后续执行会复用同一组凭据和数据卷。

服务仅绑定 Windows 本机的回环地址：

| 服务 | 地址 | 数据存储 |
| --- | --- | --- |
| 前端 | http://localhost:13000 | 无持久数据 |
| 后端健康检查 | http://localhost:18080/api/v1/health | PostgreSQL 与 MinIO |
| PostgreSQL | 127.0.0.1:15432 | Docker 命名卷 `yclawhubtest_pgdata` |
| MinIO API | http://localhost:19000 | Docker 命名卷 `yclawhubtest_miniodata` |
| MinIO 控制台 | http://localhost:19001 | 同上 |

启动顺序是创建前置分类表、对独立的 `clawhub_test` 数据库运行项目基线迁移、执行仓库内的升级 SQL，最后启动后端。MinIO 初始化任务只创建 `clawhub-test` 存储桶。这里的数据库连接与生产、共享测试实例无关。

查看状态与日志：

```powershell
$envFile = 'deploy/windows-test/.env'
$composeFile = 'deploy/windows-test/compose.yml'
docker compose -p yclawhubtest --env-file $envFile -f $composeFile ps
docker compose -p yclawhubtest --env-file $envFile -f $composeFile logs --tail=100 backend
```

停止服务且保留数据：

```powershell
docker compose -p yclawhubtest --env-file deploy/windows-test/.env -f deploy/windows-test/compose.yml down
```

只有明确需要清空这套测试数据时，才在停止服务后删除 `yclawhubtest_pgdata` 和 `yclawhubtest_miniodata` 两个命名卷。
