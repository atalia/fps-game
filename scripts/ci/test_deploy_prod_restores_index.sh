#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/scripts" "$TMP_DIR/client" "$TMP_DIR/bin"
cp "$ROOT_DIR/scripts/deploy-prod.sh" "$TMP_DIR/scripts/deploy-prod.sh"

cat > "$TMP_DIR/client/index.html" <<'EOF'
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="/css/main.css">
  </head>
  <body>
    <script src="/js/main.js"></script>
  </body>
</html>
EOF

cat > "$TMP_DIR/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "compose" ]]; then
  echo "unexpected docker invocation: $*" >&2
  exit 1
fi
shift

action=""
for arg in "$@"; do
  case "$arg" in
    build|up|ps|config)
      action="$arg"
      break
      ;;
  esac
done

index_path="${TEST_INDEX_PATH:?missing TEST_INDEX_PATH}"
case "$action" in
  build)
    grep -q '/css/main.css?v=testcommit"' "$index_path" || {
      echo "expected css asset to include commit during build" >&2
      exit 1
    }
    grep -q '/js/main.js?v=testcommit"' "$index_path" || {
      echo "expected js asset to include commit during build" >&2
      exit 1
    }
    ;;
  up|ps)
    ;;
  *)
    echo "unexpected compose action: $*" >&2
    exit 1
    ;;
esac
EOF
chmod +x "$TMP_DIR/bin/docker"

cat > "$TMP_DIR/bin/wget" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '{"status":"healthy"}\n'
EOF
chmod +x "$TMP_DIR/bin/wget"

before_contents="$(cat "$TMP_DIR/client/index.html")"
(
  cd "$TMP_DIR"
  PATH="$TMP_DIR/bin:$PATH" \
  BUILD_VERSION="testver" \
  BUILD_COMMIT="testcommit" \
  TEST_INDEX_PATH="$TMP_DIR/client/index.html" \
  bash scripts/deploy-prod.sh --skip-precheck >/dev/null
)
after_contents="$(cat "$TMP_DIR/client/index.html")"

if [[ "$after_contents" != "$before_contents" ]]; then
  echo "client/index.html was not restored after deploy script" >&2
  diff -u <(printf '%s\n' "$before_contents") <(printf '%s\n' "$after_contents") || true
  exit 1
fi

echo "deploy-prod.sh restores client/index.html after build"
