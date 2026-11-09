#!/usr/bin/env bash
# 独立镜像启动后端：宿主机端口与容器内监听端口一致，均由 PORT 决定。
#
# 用法:
#   ./scripts/docker-run-backend.sh 10080
#   PORT=10080 ./scripts/docker-run-backend.sh
#   IMAGE=... NAME=my-backend ./scripts/docker-run-backend.sh 9090
#
# 其后参数原样传给 docker run（放在镜像名之前），例如:
#   ./scripts/docker-run-backend.sh 10080 --env-file /data/backend/.env.pro
# 或显式挂载后端专用 env 文件:
#   ./scripts/docker-run-backend.sh 10080 -v /data/.env.pro:/app/backend/.env.pro:ro -e GO_ENV=pro

set -euo pipefail

IMAGE="${IMAGE:-docker.yc345.tv/7to12/clawhub-backend:v0.0.1}"
NAME="${NAME:-clawhub-backend}"

if [[ -n "${1:-}" && "$1" =~ ^[0-9]+$ ]]; then
	PORT="$1"
	shift
else
	PORT="${PORT:-8080}"
fi

exec docker run -d \
	--name "${NAME}" \
	-e "PORT=${PORT}" \
	-p "${PORT}:${PORT}" \
	"$@" \
	"${IMAGE}"
