#!/bin/bash
# setup-dev.sh - 开发环境设置
# 运行: ./scripts/setup-dev.sh

set -e

echo "🛠️  Setting up development environment..."
echo ""

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

step() { echo -e "${BLUE}→${NC} $1"; }
done_step() { echo -e "${GREEN}✓${NC} $1"; }

# 1. 安装 Git Hooks
step "Installing Git hooks..."
if [ -d ".git/hooks" ]; then
    cp scripts/pre-commit.sh .git/hooks/pre-commit 2>/dev/null || true
    chmod +x .git/hooks/pre-commit 2>/dev/null || true
    done_step "Git hooks installed"
else
    echo "  (Not in a git repository, skipping)"
fi

# 2. 检查 Go 环境
step "Checking Go environment..."
if command -v go &> /dev/null; then
    GO_VERSION=$(go version | awk '{print $3}')
    done_step "Go $GO_VERSION found"
    
    cd server
    if [ -f "go.mod" ]; then
        go mod download
        done_step "Go dependencies downloaded"
    fi
    cd ..
elif [ -f "$HOME/.local/go/bin/go" ]; then
    GO_VERSION=$($HOME/.local/go/bin/go version | awk '{print $3}')
    done_step "Go $GO_VERSION found at ~/.local/go/bin/go"
    
    cd server
    $HOME/.local/go/bin/go mod download
    done_step "Go dependencies downloaded"
    cd ..
else
    echo "  ⚠️  Go not found, install from: https://golang.org/dl/"
fi

# 3. 检查 Node.js 环境
step "Checking Node.js environment..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    done_step "Node.js $NODE_VERSION found"
    
    cd client
    if [ -f "package.json" ]; then
        npm install
        done_step "Node dependencies installed"
    fi
    cd ..
else
    echo "  ⚠️  Node.js not found, install from: https://nodejs.org/"
fi

# 4. 检查 Docker
step "Checking Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
    done_step "Docker $DOCKER_VERSION found"
else
    echo "  ⚠️  Docker not found"
fi

# 5. 检查代码质量工具
step "Checking code quality tools..."
if command -v golangci-lint &> /dev/null; then
    done_step "golangci-lint found"
else
    echo "  ℹ️  Install golangci-lint: curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh"
fi

# 6. 运行初始测试
step "Running initial tests..."
if command -v go &> /dev/null || [ -f "$HOME/.local/go/bin/go" ]; then
    GO_CMD=${GO_CMD:-go}
    [ -f "$HOME/.local/go/bin/go" ] && GO_CMD="$HOME/.local/go/bin/go"
    
    cd server
    $GO_CMD test -v -short ./... 2>&1 | tail -5
    done_step "Backend tests completed"
    cd ..
fi

if command -v npm &> /dev/null; then
    cd client
    npm test -- --run 2>&1 | tail -5
    done_step "Frontend tests completed"
    cd ..
fi

# 7. 运行预部署检查
step "Running pre-deploy checks..."
chmod +x scripts/pre-deploy-check.sh
./scripts/pre-deploy-check.sh

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Development environment ready!"
echo ""
echo "📋 Quick commands:"
echo "   make run       - Start local server"
echo "   make test      - Run all tests"
echo "   make ci        - Run CI checks locally"
echo "   make prod      - Deploy to production"
echo ""
echo "🔧 Git hooks installed:"
echo "   pre-commit     - Runs before each commit"
echo "═══════════════════════════════════════════════════"
