.PHONY: all build run test test-unit test-race test-integration test-mobile test-all cover lint fmt clean docker-build docker-up docker-down docker-logs docker-restart docker-ps dev prod monitoring full pre-deploy ci ci-local help

VERSION ?= $(shell git describe --tags --always --dirty)
GIT_COMMIT ?= $(shell git rev-parse --short HEAD)
LDFLAGS = -X 'main.buildVersion=$(VERSION)' -X 'main.buildCommit=$(GIT_COMMIT)'

GO_TEST_FLAGS = -count=1 -v
GO_UNIT_PACKAGES := $(shell cd server && go list ./... | grep -Ev '^fps-game/(cmd/server|internal/network)$$' | sed 's#^fps-game#.#')
GO_INTEGRATION_PACKAGES = ./cmd/server ./internal/network/...
VITEST_FLAGS = --run --reporter=verbose --no-color
CLIENT_UNIT_TEST_FILES := $(shell cd client && find tests js/__tests__ -type f -name '*.test.js' ! -path 'tests/mobile.test.js' ! -path 'tests/connection.test.js' ! -path 'js/__tests__/handlers.test.js' | sort | tr '\n' ' ')

ifeq ($(COVERAGE),1)
GO_UNIT_TEST_FLAGS = $(GO_TEST_FLAGS) -coverprofile=coverage.out -covermode=atomic
CLIENT_UNIT_TEST_FLAGS = $(VITEST_FLAGS) --coverage
else
GO_UNIT_TEST_FLAGS = $(GO_TEST_FLAGS)
CLIENT_UNIT_TEST_FLAGS = $(VITEST_FLAGS)
endif

# ================================
# 本地开发
# ================================

all: build

build:
	cd server && go build -ldflags "$(LDFLAGS)" -o bin/fps-server ./cmd/server

run:
	cd server && CLIENT_PATH=../client go run -ldflags "$(LDFLAGS)" ./cmd/server

test: test-unit

test-unit:
	@status=0; \
	echo "==> Go unit tests"; \
	(cd server && go test $(GO_UNIT_TEST_FLAGS) $(GO_UNIT_PACKAGES)) || status=$$?; \
	echo ""; \
	echo "==> Client unit tests"; \
	(cd client && npm test -- $(CLIENT_UNIT_TEST_FLAGS) $(CLIENT_UNIT_TEST_FILES)) || status=$$?; \
	exit $$status

test-race:
	cd server && go test $(GO_TEST_FLAGS) -race ./...

test-integration:
	@status=0; \
	echo "==> Go integration tests"; \
	(cd server && go test $(GO_TEST_FLAGS) $(GO_INTEGRATION_PACKAGES)) || status=$$?; \
	echo ""; \
	echo "==> Client integration tests"; \
	(cd client && npm test -- $(VITEST_FLAGS) tests/connection.test.js) || status=$$?; \
	exit $$status

test-mobile:
	cd client && npm test -- $(VITEST_FLAGS) tests/mobile.test.js

test-all: test-unit test-race test-integration test-mobile

cover:
	cd server && go test ./... -coverprofile=coverage.out
	cd server && go tool cover -html=coverage.out -o coverage.html
	@echo "✅ Coverage report: server/coverage.html"

lint:
	cd server && golangci-lint run

fmt:
	cd server && gofmt -w .
	cd server && goimports -w .

clean:
	rm -rf server/bin
	rm -f server/coverage.out server/coverage.html

# ================================
# 预部署检查
# ================================

pre-deploy:
	@chmod +x scripts/pre-deploy-check.sh
	@./scripts/pre-deploy-check.sh

# ================================
# Docker 部署
# ================================

docker-build:
	docker-compose build --no-cache

docker-up:
	docker-compose up -d
	@echo "✅ Services started!"
	@echo "🎮 Game: http://localhost:8080"
	@echo "📊 Redis: localhost:6379"

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-restart:
	docker-compose restart

docker-ps:
	docker-compose ps

# 开发环境 (game-server + redis)
dev:
	docker-compose --profile dev up -d --build
	@echo "✅ Dev environment started!"
	@echo "🎮 Game: http://localhost:8080"

# 生产环境 (+ nginx) - 部署前先检查
prod:
	./scripts/deploy-prod.sh
	@echo "✅ Production environment started!"
	@echo "🎮 Game: http://localhost"

# 带监控 (+ prometheus + grafana)
monitoring:
	docker-compose --profile monitoring up -d
	@echo "✅ Monitoring started!"
	@echo "📊 Prometheus: http://localhost:9091"
	@echo "📈 Grafana: http://localhost:3000 (admin/admin)"

# 完整部署 (生产 + 监控)
full:
	./scripts/deploy-prod.sh --with-monitoring
	@echo "✅ Full deployment started!"

# ================================
# CI
# ================================

ci: ci-local

ci-local: pre-deploy lint test-all
	@echo "✅ Local CI checks passed"

# ================================
# 帮助
# ================================

help:
	@echo "FPS Game - 命令列表"
	@echo ""
	@echo "本地开发:"
	@echo "  make build        构建后端"
	@echo "  make run          运行后端"
	@echo "  make test         运行单元测试"
	@echo "  make test-unit    运行 unit tests"
	@echo "  make test-race    运行 Go race detector"
	@echo "  make test-integration 运行 integration tests"
	@echo "  make test-mobile  运行 mobile tests"
	@echo "  make test-all     运行所有阻断式测试"
	@echo "  make ci-local     运行本地完整 CI 检查"
	@echo "  make cover        测试覆盖率报告"
	@echo "  make lint         代码检查"
	@echo "  make fmt          格式化代码"
	@echo ""
	@echo "预部署检查:"
	@echo "  make pre-deploy   部署前检查配置"
	@echo ""
	@echo "Docker 部署:"
	@echo "  make dev          开发环境 (game-server + redis)"
	@echo "  make prod         生产环境 (+ nginx)"
	@echo "  make monitoring   监控环境 (+ prometheus + grafana)"
	@echo "  make full         完整部署 (生产 + 监控)"
	@echo "  make docker-down  停止所有服务"
	@echo "  make docker-logs  查看日志"
	@echo "  make docker-ps    查看服务状态"
