#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="$ROOT_DIR/packages/clawhub"
CLI_DIR="$ROOT_DIR/packages/yclawhub"
CLI_PACKAGE_JSON="$CLI_DIR/package.json"
TMP_PACKAGE_JSON="$(mktemp)"

DRY_RUN="${DRY_RUN:-0}"
PUBLISH_TAG="${PUBLISH_TAG:-}"
REGISTRY="${REGISTRY:-}"

cleanup() {
  if [[ -f "$TMP_PACKAGE_JSON" ]]; then
    cp "$TMP_PACKAGE_JSON" "$CLI_PACKAGE_JSON"
    rm -f "$TMP_PACKAGE_JSON"
  fi
}

trap cleanup EXIT

cd "$ROOT_DIR"
cp "$CLI_PACKAGE_JSON" "$TMP_PACKAGE_JSON"

read_package_field() {
  local package_json="$1"
  local field_name="$2"
  node -e "
const fs = require('node:fs')
const packageJson = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'))
const value = packageJson[process.argv[2]]
if (value === undefined) {
  throw new Error(\`Missing field \${process.argv[2]} in \${process.argv[1]}\`)
}
process.stdout.write(String(value))
" "$package_json" "$field_name"
}

CORE_NAME="$(read_package_field "$CORE_DIR/package.json" "name")"
CORE_VERSION="$(read_package_field "$CORE_DIR/package.json" "version")"
CLI_NAME="$(read_package_field "$CLI_DIR/package.json" "name")"
CLI_VERSION="$(read_package_field "$CLI_DIR/package.json" "version")"

echo "==> Building $CORE_NAME@$CORE_VERSION"
(cd "$CORE_DIR" && bun run build)

echo "==> Building $CLI_NAME@$CLI_VERSION"
(cd "$CLI_DIR" && bun run build)

echo "==> Pinning $CLI_NAME dependency on $CORE_NAME@$CORE_VERSION for publish"
node - "$CLI_PACKAGE_JSON" "$CORE_NAME" "$CORE_VERSION" <<'EOF'
const fs = require('node:fs')

const [packageJsonPath, depName, depVersion] = process.argv.slice(2)
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
if (!packageJson.dependencies || !(depName in packageJson.dependencies)) {
  throw new Error(`Missing dependency ${depName} in ${packageJsonPath}`)
}
packageJson.dependencies[depName] = depVersion
fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
EOF

PUBLISH_ARGS=()
if [[ -n "$PUBLISH_TAG" ]]; then
  PUBLISH_ARGS+=(--tag "$PUBLISH_TAG")
fi
if [[ -n "$REGISTRY" ]]; then
  PUBLISH_ARGS+=(--registry "$REGISTRY")
fi

if [[ "$DRY_RUN" == "1" ]]; then
  PUBLISH_ARGS+=(--dry-run)
  echo "==> Dry run mode enabled"
fi

publish_package() {
  local package_dir="$1"
  if (( ${#PUBLISH_ARGS[@]} > 0 )); then
    (cd "$package_dir" && npm publish "${PUBLISH_ARGS[@]}")
  else
    (cd "$package_dir" && npm publish)
  fi
}

echo "==> Publishing $CORE_NAME@$CORE_VERSION"
publish_package "$CORE_DIR"

echo "==> Publishing $CLI_NAME@$CLI_VERSION"
publish_package "$CLI_DIR"

echo "==> Done"
if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run completed. No packages were published."
else
  echo "Published:"
  echo "  $CORE_NAME@$CORE_VERSION"
  echo "  $CLI_NAME@$CLI_VERSION"
fi
