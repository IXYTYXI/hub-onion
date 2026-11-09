#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

FRONTEND_REPO="${FRONTEND_REPO:-docker.yc345.tv/7to12/yclawhub-frontend}"
BACKEND_REPO="${BACKEND_REPO:-docker.yc345.tv/7to12/yclawhub-backend}"

BUILD_STAMP="${BUILD_STAMP:-$(date '+%y%m%d%H%M')}"
IMAGE_TAG="${IMAGE_TAG:-prd-${BUILD_STAMP}-amd64}"

FRONTEND_IMAGE="${FRONTEND_REPO}:${IMAGE_TAG}"
BACKEND_IMAGE="${BACKEND_REPO}:${IMAGE_TAG}"

ONLINE_ENV_FILE="${ONLINE_ENV_FILE:-.env.online}"

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

extract_host() {
  local value="$1"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  printf '%s\n' "${value}"
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
  local expected_backend_host="$2"
  local expected_frontend_host="$3"
  local unexpected_host="${4:-}"
  local tmpdir
  local cid

  tmpdir="$(mktemp -d)"
  cid="$(docker create --platform linux/amd64 "${image}")"
  trap 'docker rm -f "${cid}" >/dev/null 2>&1 || true; rm -rf "${tmpdir}"' RETURN

  run docker cp "${cid}:/app/.output" "${tmpdir}"
  run docker rm "${cid}" >/dev/null

  if ! rg -q "${expected_backend_host}" "${tmpdir}/.output"; then
    echo "前端产物中未找到后端地址 ${expected_backend_host}" >&2
    exit 1
  fi
  if ! rg -q "${expected_frontend_host}" "${tmpdir}/.output"; then
    echo "前端产物中未找到前端地址 ${expected_frontend_host}" >&2
    exit 1
  fi
  if [[ -n "${unexpected_host}" ]] && rg -q "${unexpected_host}" "${tmpdir}/.output"; then
    echo "前端产物中仍残留不应出现的地址 ${unexpected_host}" >&2
    exit 1
  fi

  echo "前端产物复检通过: ${image}"
  rm -rf "${tmpdir}"
  trap - RETURN
}

build_frontend() {
  local vite_site_url
  local vite_api_origin
  local expected_backend_host
  local expected_frontend_host

  echo "== 构建前端镜像 =="
  (
    cd "${ROOT_DIR}"
    set -a
    # shellcheck disable=SC1090
    source "${ONLINE_ENV_FILE}"
    set +a

    vite_site_url="${VITE_SITE_URL:-}"
    vite_api_origin="${VITE_API_ORIGIN:-}"

    if [[ -z "${vite_site_url}" || -z "${vite_api_origin}" ]]; then
      echo "${ONLINE_ENV_FILE} 必须至少包含 VITE_SITE_URL 和 VITE_API_ORIGIN" >&2
      exit 1
    fi

    expected_backend_host="$(extract_host "${vite_api_origin}")"
    expected_frontend_host="$(extract_host "${vite_site_url}")"

    run bun run build:online
    run docker buildx build \
      --progress=plain \
      --platform linux/amd64 \
      --load \
      -f Dockerfile.frontend \
      -t "${FRONTEND_IMAGE}" \
      .

    assert_platform "${FRONTEND_IMAGE}"
    verify_frontend_output "${FRONTEND_IMAGE}" "${expected_backend_host}" "${expected_frontend_host}" "${UNEXPECTED_FRONTEND_HOST:-}"
    run docker push "${FRONTEND_IMAGE}"
    assert_remote_platform "${FRONTEND_IMAGE}"
  )
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

require_cmd bun
require_cmd docker
require_cmd rg

echo "生产打包模式: 仅构建并推送，不执行部署"
echo "Frontend image: ${FRONTEND_IMAGE}"
echo "Backend image: ${BACKEND_IMAGE}"
echo "Env file: ${ONLINE_ENV_FILE}"

(
  cd "${ROOT_DIR}"
  run docker version --format '{{.Server.Os}}/{{.Server.Arch}} {{.Server.Version}}'
)

build_frontend
build_backend

echo
echo "打包完成"
echo "前端镜像: ${FRONTEND_IMAGE}"
echo "后端镜像: ${BACKEND_IMAGE}"
