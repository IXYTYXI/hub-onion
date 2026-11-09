#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-master@10.8.8.207}"

BACKEND_CONTAINER_NAME="${BACKEND_CONTAINER_NAME:-yclawhub-backend}"
FRONTEND_CONTAINER_NAME="${FRONTEND_CONTAINER_NAME:-yclawhub-frontend}"

FRONTEND_REPO="${FRONTEND_REPO:-docker.yc345.tv/7to12/yclawhub-frontend}"
BACKEND_REPO="${BACKEND_REPO:-docker.yc345.tv/7to12/yclawhub-backend}"

TAG_PREFIX="${TAG_PREFIX:-test}"
BUILD_STAMP="${BUILD_STAMP:-$(date '+%Y%m%d%H%M%S')}"
FRONTEND_TAG="${FRONTEND_TAG:-${TAG_PREFIX}-${BUILD_STAMP}-amd64-frontend}"
BACKEND_TAG="${BACKEND_TAG:-${TAG_PREFIX}-${BUILD_STAMP}-amd64-backend}"

FRONTEND_IMAGE="${FRONTEND_REPO}:${FRONTEND_TAG}"
BACKEND_IMAGE="${BACKEND_REPO}:${BACKEND_TAG}"

BACKEND_PORT="${BACKEND_PORT:-10080}"
FRONTEND_PORT="${FRONTEND_PORT:-10090}"

BACKEND_PUBLIC_URL="${BACKEND_PUBLIC_URL:-https://clawhub-api-test.yc345.tv}"
FRONTEND_PUBLIC_URL="${FRONTEND_PUBLIC_URL:-https://clawhub-test.yc345.tv}"

BACKEND_GO_ENV="${BACKEND_GO_ENV:-test}"
FRONTEND_NODE_ENV="${FRONTEND_NODE_ENV:-local}"
GITLAB_ENABLED="${GITLAB_ENABLED:-true}"

TEST_ENV_FILE="${TEST_ENV_FILE:-.env.test}"
EXPECTED_BACKEND_HOST="${EXPECTED_BACKEND_HOST:-clawhub-api-test.yc345.tv}"
EXPECTED_FRONTEND_HOST="${EXPECTED_FRONTEND_HOST:-clawhub-test.yc345.tv}"
UNEXPECTED_FRONTEND_HOST="${UNEXPECTED_FRONTEND_HOST:-10.8.8.207:10080}"

run() {
  echo "+ $*"
  "$@"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

assert_platform() {
  local image="$1"
  local platform
  platform="$(docker image inspect "${image}" --format '{{.Os}}/{{.Architecture}}')"
  if [[ "${platform}" != "linux/amd64" ]]; then
    echo "镜像平台错误: ${image} => ${platform}" >&2
    exit 1
  fi
  echo "镜像平台确认: ${image} => ${platform}"
}

assert_remote_platform() {
  local image="$1"
  local platform_json
  platform_json="$(docker buildx imagetools inspect --format '{{json .Image}}' "${image}")"
  if ! printf '%s\n' "${platform_json}" | rg -q '"os"\s*:\s*"linux"'; then
    echo "远端镜像平台错误: ${image}" >&2
    echo "${platform_json}" >&2
    exit 1
  fi
  if ! printf '%s\n' "${platform_json}" | rg -q '"architecture"\s*:\s*"amd64"'; then
    echo "远端镜像平台错误: ${image}" >&2
    echo "${platform_json}" >&2
    exit 1
  fi
  echo "远端平台确认: ${image} => linux/amd64"
}

verify_frontend_output() {
  local image="$1"
  local tmpdir
  local cid

  tmpdir="$(mktemp -d)"
  cid="$(docker create --platform linux/amd64 "${image}")"
  trap 'docker rm -f "${cid}" >/dev/null 2>&1 || true; rm -rf "${tmpdir}"' RETURN

  run docker cp "${cid}:/app/.output" "${tmpdir}"
  run docker rm "${cid}" >/dev/null

  if ! rg -q "${EXPECTED_BACKEND_HOST}" "${tmpdir}/.output"; then
    echo "前端产物中未找到后端地址 ${EXPECTED_BACKEND_HOST}" >&2
    exit 1
  fi
  if ! rg -q "${EXPECTED_FRONTEND_HOST}" "${tmpdir}/.output"; then
    echo "前端产物中未找到前端地址 ${EXPECTED_FRONTEND_HOST}" >&2
    exit 1
  fi
  if rg -q "${UNEXPECTED_FRONTEND_HOST}" "${tmpdir}/.output"; then
    echo "前端产物中仍残留旧地址 ${UNEXPECTED_FRONTEND_HOST}" >&2
    exit 1
  fi

  echo "前端产物复检通过: ${image}"
  rm -rf "${tmpdir}"
  trap - RETURN
}

build_frontend() {
  echo "== 构建前端产物 =="
  (
    cd "${ROOT_DIR}"
    set -a
    # shellcheck disable=SC1090
    source "${TEST_ENV_FILE}"
    set +a
    run bun run build
    run docker buildx build \
      --progress=plain \
      --platform linux/amd64 \
      --load \
      -f Dockerfile.frontend \
      -t "${FRONTEND_IMAGE}" \
      .
  )

  assert_platform "${FRONTEND_IMAGE}"
  verify_frontend_output "${FRONTEND_IMAGE}"
  run docker push "${FRONTEND_IMAGE}"
  assert_remote_platform "${FRONTEND_IMAGE}"
}

build_backend() {
  echo "== 构建后端镜像 =="
  (
    cd "${ROOT_DIR}"
    run docker buildx build \
      --progress=plain \
      --platform linux/amd64 \
      --load \
      -f backend/Dockerfile \
      -t "${BACKEND_IMAGE}" \
      .
  )

  assert_platform "${BACKEND_IMAGE}"
  run docker push "${BACKEND_IMAGE}"
  assert_remote_platform "${BACKEND_IMAGE}"
}

deploy_remote() {
  echo "== 部署到测试机 =="
  ssh "${REMOTE_HOST}" \
    REMOTE_BACKEND_IMAGE="${BACKEND_IMAGE}" \
    REMOTE_FRONTEND_IMAGE="${FRONTEND_IMAGE}" \
    REMOTE_BACKEND_CONTAINER_NAME="${BACKEND_CONTAINER_NAME}" \
    REMOTE_FRONTEND_CONTAINER_NAME="${FRONTEND_CONTAINER_NAME}" \
    REMOTE_BACKEND_PORT="${BACKEND_PORT}" \
    REMOTE_FRONTEND_PORT="${FRONTEND_PORT}" \
    REMOTE_BACKEND_PUBLIC_URL="${BACKEND_PUBLIC_URL}" \
    REMOTE_FRONTEND_PUBLIC_URL="${FRONTEND_PUBLIC_URL}" \
    REMOTE_BACKEND_GO_ENV="${BACKEND_GO_ENV}" \
    REMOTE_FRONTEND_NODE_ENV="${FRONTEND_NODE_ENV}" \
    REMOTE_GITLAB_ENABLED="${GITLAB_ENABLED}" \
    'bash -s' <<'REMOTE_SCRIPT'
set -euo pipefail

backend_image="${REMOTE_BACKEND_IMAGE}"
frontend_image="${REMOTE_FRONTEND_IMAGE}"
backend_container="${REMOTE_BACKEND_CONTAINER_NAME}"
frontend_container="${REMOTE_FRONTEND_CONTAINER_NAME}"
backend_port="${REMOTE_BACKEND_PORT}"
frontend_port="${REMOTE_FRONTEND_PORT}"
backend_public_url="${REMOTE_BACKEND_PUBLIC_URL}"
frontend_public_url="${REMOTE_FRONTEND_PUBLIC_URL}"
backend_go_env="${REMOTE_BACKEND_GO_ENV}"
frontend_node_env="${REMOTE_FRONTEND_NODE_ENV}"
gitlab_enabled="${REMOTE_GITLAB_ENABLED}"

docker pull "${backend_image}"
docker pull "${frontend_image}"

docker stop "${backend_container}" >/dev/null 2>&1 || true
docker rm "${backend_container}" >/dev/null 2>&1 || true
docker run -d \
  --name "${backend_container}" \
  --restart unless-stopped \
  -p "${backend_port}:${backend_port}" \
  -e GO_ENV="${backend_go_env}" \
  -e PORT="${backend_port}" \
  -e FRONTEND_URL="${frontend_public_url}" \
  -e GITLAB_ENABLED="${gitlab_enabled}" \
  "${backend_image}"

docker stop "${frontend_container}" >/dev/null 2>&1 || true
docker rm "${frontend_container}" >/dev/null 2>&1 || true
docker run -d \
  --name "${frontend_container}" \
  --restart unless-stopped \
  -p "${frontend_port}:${frontend_port}" \
  -e NODE_ENV="${frontend_node_env}" \
  -e PORT="${frontend_port}" \
  -e BACKEND_URL="${backend_public_url}" \
  -e API_ORIGIN="${backend_public_url}" \
  "${frontend_image}"

docker ps --filter "name=${backend_container}" --filter "name=${frontend_container}" \
  --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
REMOTE_SCRIPT
}

require_cmd bun
require_cmd docker
require_cmd ssh
require_cmd rg

echo "Deploy target: ${REMOTE_HOST}"
echo "Frontend image: ${FRONTEND_IMAGE}"
echo "Backend image: ${BACKEND_IMAGE}"

(
  cd "${ROOT_DIR}"
  run docker version --format '{{.Server.Os}}/{{.Server.Arch}} {{.Server.Version}}'
)

build_frontend
build_backend
deploy_remote

echo
echo "部署完成"
echo "前端镜像: ${FRONTEND_IMAGE}"
echo "后端镜像: ${BACKEND_IMAGE}"
