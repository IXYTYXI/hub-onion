# Deploy

## Windows 独立测试环境

`deploy/windows-test/` 在 Windows 的 Docker Desktop（Linux 容器模式）中启动独立的 PostgreSQL、S3 兼容对象存储、后端和前端。测试数据库名为 `clawhub_test`，存储桶名为 `clawhub-test`；数据保存在 Docker 命名卷内。端口仅绑定到 Windows 主机的 `127.0.0.1`。

在项目根目录运行 `deploy/windows-test/setup.ps1`。脚本首次运行会创建随机凭据文件 `deploy/windows-test/.env`，后续运行会复用凭据与数据。该文件不应提交到仓库。

测试 Compose 使用 DaoCloud 镜像站。对象存储使用固定版本的 [PGSTY MinIO 兼容镜像](https://github.com/pgsty/silo)，服务端与初始化任务使用同一镜像内置的 `mc` 客户端。Docker Hub 在当前测试机连接超时，原 `minio/minio` 与 `minio/mc` 镜像通过镜像站拉取时返回 `denied`；更换镜像只影响这套隔离环境，不更改生产存储。

端口、状态检查、日志和停止命令见 [Windows 测试环境说明](../deploy/windows-test/README.md)。
