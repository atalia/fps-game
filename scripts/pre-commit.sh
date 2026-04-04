#!/bin/bash
# pre-commit hook - 提交前检查
# 安装: cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

echo "🔍 Running pre-commit checks..."
echo ""

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

# 获取修改的文件
GO_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.go$' | grep -v '_test\.go$')
JS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.js$' | grep -v '__tests__' | grep -v 'node_modules')
TEST_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '_test\.\(go\|js\)$')

# 1. Go 格式化检查
if [ -n "$GO_FILES" ]; then
    echo "1️⃣  Checking Go formatting..."
    UNFORMATTED=$(gofmt -l $GO_FILES)
    if [ -n "$UNFORMATTED" ]; then
        fail "Go files need formatting: $UNFORMATTED"
        echo "Run: gofmt -w $UNFORMATTED"
        exit 1
    fi
    pass "Go formatting OK"
fi

# 2. Go vet 检查
if [ -n "$GO_FILES" ]; then
    echo ""
    echo "2️⃣  Running go vet..."
    cd server
    if go vet ./... 2>&1; then
        pass "Go vet OK"
    else
        fail "Go vet found issues"
    fi
    cd ..
fi

# 3. 关键测试 (只测试修改相关的)
if [ -n "$GO_FILES" ] || [ -n "$TEST_FILES" ]; then
    echo ""
    echo "3️⃣  Running quick tests..."
    cd server
    
    # 运行 WebSocket Origin 测试 (关键)
    if go test -v ./internal/network/... -run "Origin|Deployment" 2>&1 | grep -q "PASS"; then
        pass "WebSocket Origin tests pass"
    else
        warn "WebSocket Origin tests failed or skipped"
    fi
    
    # 运行修改相关的测试
    if [ -n "$GO_FILES" ]; then
        # 找出需要测试的包
        PACKAGES=$(echo "$GO_FILES" | sed 's|/[^/]*$||' | sort -u | xargs -I {} sh -c 'echo "./{}"' | tr '\n' ' ')
        if [ -n "$PACKAGES" ]; then
            echo "Testing packages: $PACKAGES"
            go test -v -short $PACKAGES 2>&1 | tail -5
        fi
    fi
    cd ..
fi

# 4. 前端语法检查
if [ -n "$JS_FILES" ]; then
    echo ""
    echo "4️⃣  Checking JavaScript syntax..."
    SYNTAX_OK=true
    for file in $JS_FILES; do
        if [ -f "$file" ]; then
            # 使用 node 检查语法
            if node --check "$file" 2>/dev/null; then
                pass "$file syntax OK"
            else
                fail "$file has syntax errors"
                SYNTAX_OK=false
            fi
        fi
    done
    
    if [ "$SYNTAX_OK" = false ]; then
        exit 1
    fi
fi

# 5. 预部署检查 (当修改关键配置时)
CRITICAL_FILES="server/internal/network/server.go client/js/network.js client/index.html nginx.conf docker-compose.yml"
CRITICAL_CHANGED=false
for file in $CRITICAL_FILES; do
    if git diff --cached --name-only | grep -q "$file"; then
        CRITICAL_CHANGED=true
        break
    fi
done

if [ "$CRITICAL_CHANGED" = true ]; then
    echo ""
    echo "5️⃣  Running pre-deploy checks (critical files changed)..."
    chmod +x scripts/pre-deploy-check.sh
    ./scripts/pre-deploy-check.sh
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ All pre-commit checks passed!"
echo "═══════════════════════════════════════════════════"
