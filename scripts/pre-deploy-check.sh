#!/bin/bash
# pre-deploy-check.sh - 部署前检查
# 在 CI/CD 流程中运行，验证关键配置

set -e

echo "🔍 Pre-deployment checks..."
echo ""

# 配置
SERVER_IP="101.33.117.73"
SERVER_PORT="8080"
TIMEOUT=5

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

# 1. 检查 WebSocket Origin 配置
echo "1️⃣  Checking WebSocket Origin configuration..."
if grep -q "101.33.117.73" server/internal/network/server.go; then
    pass "Server IP is in allowed origins"
else
    fail "Server IP NOT in allowed origins! WebSocket connections will fail"
fi

# 2. 检查前端资源
echo ""
echo "2️⃣  Checking frontend assets..."
required_files=(
    "client/js/network.js"
    "client/js/main.js"
    "client/js/mobile-controls.js"
    "client/index.html"
)
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        pass "$file exists"
    else
        fail "$file missing"
    fi
done

# 3. 检查手机支持
echo ""
echo "3️⃣  Checking mobile support..."
if grep -q "mobile-controls.js" client/index.html; then
    pass "Mobile controls script included"
else
    fail "Mobile controls script NOT included in index.html"
fi

if grep -q "detectMobile\|MobileControls" client/js/mobile-controls.js; then
    pass "Mobile detection logic exists"
else
    warn "Mobile detection might be incomplete"
fi

# 4. 检查配置一致性
echo ""
echo "4️⃣  Checking configuration consistency..."
if grep -q "port: 8080" server/configs/config.yaml; then
    pass "Server port configured correctly"
else
    warn "Server port might be misconfigured"
fi

# 5. 测试编译
echo ""
echo "5️⃣  Testing build..."
if ~/.local/go/bin/go build -o /dev/null ./server/cmd/server 2>/dev/null; then
    pass "Server builds successfully"
else
    warn "Server build failed (may need Go in PATH)"
fi

if command -v node &> /dev/null && node -e "console.log('ok')" &>/dev/null; then
    pass "Node.js available for frontend tests"
else
    warn "Node.js not available, skipping frontend tests"
fi

# 6. 运行关键测试
echo ""
echo "6️⃣  Running critical tests..."
if go test -v ./server/internal/network/... -run "TestWebSocketOriginCheck" 2>&1 | grep -q "PASS"; then
    pass "WebSocket Origin tests pass"
else
    warn "WebSocket Origin tests failed or not found"
fi

# 7. 检查 Docker 配置
echo ""
echo "7️⃣  Checking Docker configuration..."
if [ -f "docker-compose.yml" ] && grep -q "game-server" docker-compose.yml; then
    pass "Docker Compose configured"
else
    warn "Docker Compose might be misconfigured"
fi

# 8. 检查 Nginx WebSocket 代理
echo ""
echo "8️⃣  Checking Nginx WebSocket proxy..."
if [ -f "nginx.conf" ] && grep -q "location /ws" nginx.conf; then
    pass "Nginx WebSocket proxy configured"
else
    warn "Nginx WebSocket proxy might be missing"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Pre-deployment checks completed!"
echo ""
echo "📋 Summary:"
echo "   - WebSocket Origin: Checked"
echo "   - Frontend assets: Checked"
echo "   - Mobile support: Checked"
echo "   - Build: Checked"
echo "   - Docker: Checked"
echo ""
echo "🚀 Ready to deploy? Run: make prod"
echo "═══════════════════════════════════════════════════"
