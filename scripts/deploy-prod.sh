#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUN_PRECHECK=1
DRY_RUN=0
WITH_MONITORING=0

for arg in "$@"; do
  case "$arg" in
    --skip-precheck)
      RUN_PRECHECK=0
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --with-monitoring)
      WITH_MONITORING=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

BUILD_VERSION="${BUILD_VERSION:-$(git describe --tags --always --dirty)}"
BUILD_COMMIT="${BUILD_COMMIT:-$(git rev-parse --short HEAD)}"
export BUILD_VERSION BUILD_COMMIT

INDEX_FILE="client/index.html"
INDEX_BACKUP="$(mktemp)"
cp "$INDEX_FILE" "$INDEX_BACKUP"
restore_index_file() {
  if [[ -f "$INDEX_BACKUP" ]]; then
    mv "$INDEX_BACKUP" "$INDEX_FILE"
  fi
}
trap restore_index_file EXIT

profiles=(--profile production)
if [[ "$WITH_MONITORING" -eq 1 ]]; then
  profiles+=(--profile monitoring)
fi

if ! command -v docker >/dev/null 2>&1; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "BUILD_VERSION=$BUILD_VERSION"
    echo "BUILD_COMMIT=$BUILD_COMMIT"
    exit 0
  fi
  echo "docker command not found" >&2
  exit 1
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  docker compose "${profiles[@]}" config
  exit 0
fi

python3 - <<'PY'
from pathlib import Path
import os
import re
path = Path('client/index.html')
text = path.read_text(encoding='utf-8')
text = re.sub(r'((?:src|href)="/(?:js|css)/[^"?]+)(?:\?v=[^"]*)?"', rf'\1?v={os.environ["BUILD_COMMIT"]}"', text)
path.write_text(text, encoding='utf-8')
PY

if [[ "$RUN_PRECHECK" -eq 1 ]]; then
  chmod +x scripts/pre-deploy-check.sh
  ./scripts/pre-deploy-check.sh
fi

docker compose "${profiles[@]}" build --no-cache game-server
docker compose "${profiles[@]}" up -d
sleep 5
docker compose "${profiles[@]}" ps
wget -qO- http://localhost:8080/api/health
