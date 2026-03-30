#!/bin/bash
# scripts/run-e2e.sh - 运行 E2E 测试

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"

echo "=== FPS Game E2E Tests ==="

# 检查服务器是否已运行
if curl -s http://localhost:8080 > /dev/null 2>&1; then
  echo "✓ Server already running on port 8080"
else
  echo "Starting game server..."
  cd "$SERVER_DIR"
  
  # 后台启动服务器
  export PATH="$HOME/.local/go/bin:$PATH"
  go run ./cmd/server &
  SERVER_PID=$!
  
  # 等待服务器启动
  echo "Waiting for server to start..."
  for i in {1..30}; do
    if curl -s http://localhost:8080 > /dev/null 2>&1; then
      echo "✓ Server started on port 8080"
      break
    fi
    sleep 1
  done
  
  # 清理函数
  cleanup() {
    echo "Stopping server..."
    kill $SERVER_PID 2>/dev/null || true
  }
  trap cleanup EXIT
fi

# 运行测试
cd "$PROJECT_ROOT"
echo ""
echo "Running Playwright tests..."
npx playwright test --project=chromium

echo ""
echo "=== E2E Tests Complete ==="
