#!/usr/bin/env bash
# 本地同时启动后端与前端（依据 .specstory 历史会话中的启动流程整理）。
#
# 用法:
#   ./scripts/dev-local.sh              # 启动前后端（默认先跑迁移）
#   ./scripts/dev-local.sh --no-migrate # 跳过数据库迁移
#   ./scripts/dev-local.sh --stop       # 停止本脚本启动的进程
#
# 环境变量（可选）:
#   BACKEND_PORT   后端端口，默认 8080；若被占用则自动尝试 8080-8090
#   FRONTEND_PORT  前端端口，默认 10091（与 package.json dev 脚本一致）
#   GO_ENV         默认 local
#   SKIP_MIGRATE=1 等同 --no-migrate
#
# 说明:
#   脚本会强制使用 localhost 作为前端/OAuth 回调地址，避免 shell 或 .env.test
#   中的测试域名（如 clawhub-test.yc345.tv）覆盖本地 .env.local 导致登录后跳走。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="${ROOT_DIR}/.dev-local.pids"

GO_ENV="local"
FRONTEND_PORT="${FRONTEND_PORT:-10091}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
RUN_MIGRATE=1
LOCAL_FRONTEND_URL="http://localhost:${FRONTEND_PORT}"

usage() {
	cat <<EOF
用法: $(basename "$0") [选项]

选项:
  --no-migrate  跳过数据库迁移
  --stop        停止由本脚本启动的前后端进程
  -h, --help    显示帮助

默认访问:
  前端  http://localhost:${FRONTEND_PORT}
  后端  http://localhost:<自动选择端口>/api/v1/health
EOF
}

log() {
	printf '[dev-local] %s\n' "$*" >&2
}

die() {
	printf '[dev-local] 错误: %s\n' "$*" >&2
	exit 1
}

port_in_use() {
	local port="$1"
	lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

pick_backend_port() {
	local candidate="$1"
	local port

	if ! port_in_use "${candidate}"; then
		echo "${candidate}"
		return 0
	fi

	for port in $(seq 8080 8090); do
		if ! port_in_use "${port}"; then
			log "端口 ${candidate} 已被占用，改用 ${port}"
			echo "${port}"
			return 0
		fi
	done

	die "8080-8090 端口均被占用，请设置 BACKEND_PORT 或释放端口"
}

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || die "未找到命令: $1"
}

stop_services() {
	if [[ ! -f "${PID_FILE}" ]]; then
		log "未找到 PID 文件，可能未通过本脚本启动"
		return 0
	fi

	log "正在停止本地服务..."
	while IFS= read -r pid; do
		[[ -n "${pid}" ]] || continue
		if kill -0 "${pid}" 2>/dev/null; then
			kill "${pid}" 2>/dev/null || true
			wait "${pid}" 2>/dev/null || true
		fi
	done <"${PID_FILE}"
	rm -f "${PID_FILE}"
	log "已停止"
}

cleanup() {
	trap - INT TERM EXIT
	stop_services
}

wait_for_health() {
	local url="$1"
	local label="$2"
	local i
	for i in $(seq 1 60); do
		if curl -sf "${url}" >/dev/null 2>&1; then
			log "${label} 就绪: ${url}"
			return 0
		fi
		sleep 0.5
	done
	die "${label} 启动超时: ${url}"
}

parse_args() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
		--no-migrate)
			RUN_MIGRATE=0
			shift
			;;
		--stop)
			stop_services
			exit 0
			;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			die "未知参数: $1（使用 --help 查看用法）"
			;;
		esac
	done

	if [[ "${SKIP_MIGRATE:-}" == "1" ]]; then
		RUN_MIGRATE=0
	fi
}

main() {
	parse_args "$@"

	require_cmd bun
	require_cmd curl
	require_cmd lsof
	require_cmd go

	if [[ ! -f "${ROOT_DIR}/backend/.env.local" ]]; then
		log "提示: 未找到 backend/.env.local，可从 backend/.env.local.example 复制并填写"
	fi

	BACKEND_PORT="$(pick_backend_port "${BACKEND_PORT}")"

	if port_in_use "${FRONTEND_PORT}"; then
		die "前端端口 ${FRONTEND_PORT} 已被占用，请设置 FRONTEND_PORT"
	fi

	if [[ -f "${PID_FILE}" ]]; then
		die "检测到已有运行实例（${PID_FILE}），请先执行: $0 --stop"
	fi

	trap cleanup INT TERM EXIT

	cd "${ROOT_DIR}/backend"

	if [[ "${RUN_MIGRATE}" -eq 1 ]]; then
		log "运行数据库迁移 (GO_ENV=${GO_ENV})..."
		GOTOOLCHAIN=auto GO_ENV="${GO_ENV}" go run cmd/migrate/main.go
	fi

	log "启动后端 (端口 ${BACKEND_PORT}, 登录回调 -> ${LOCAL_FRONTEND_URL})..."
	FRONTEND_URL="${LOCAL_FRONTEND_URL}" \
		OAUTH_PUBLIC_BASE_URL="" \
		GOTOOLCHAIN=auto GO_ENV="${GO_ENV}" PORT="${BACKEND_PORT}" \
		go run cmd/server/main.go &
	backend_pid=$!

	cd "${ROOT_DIR}"

	log "启动前端 (端口 ${FRONTEND_PORT}, 代理 -> http://localhost:${BACKEND_PORT})..."
	BACKEND_URL="http://localhost:${BACKEND_PORT}" \
		BACKEND_PROXY_TARGET="http://localhost:${BACKEND_PORT}" \
		VITE_SITE_URL="${LOCAL_FRONTEND_URL}" \
		VITE_API_ORIGIN="" \
		VITE_API_BASE="/api/v1" \
		VITE_AUTH_BASE_URL="" \
		VITE_CLI_SKILL_REGISTRY="${LOCAL_FRONTEND_URL}" \
		bun --bun vite dev --port "${FRONTEND_PORT}" &
	frontend_pid=$!

	printf '%s\n%s\n' "${backend_pid}" "${frontend_pid}" >"${PID_FILE}"

	wait_for_health "http://localhost:${BACKEND_PORT}/api/v1/health" "后端"
	wait_for_health "http://localhost:${FRONTEND_PORT}/api/v1/health" "前端代理"

	open "http://localhost:${FRONTEND_PORT}"
	cat <<EOF

本地开发服务已启动:
  前端  http://localhost:${FRONTEND_PORT}
  后端  http://localhost:${BACKEND_PORT}
  健康  http://localhost:${FRONTEND_PORT}/api/v1/health

按 Ctrl+C 停止，或执行: $0 --stop
EOF

	wait "${backend_pid}" "${frontend_pid}"
}

main "$@"
