.PHONY: all build run test cover lint fmt clean docker-build docker-up docker-down dev prod pre-deploy ci

# ================================
# 本地开发
# ================================

all: build

build:
	cd server && go build -o bin/fps-server ./cmd/server

run:
	cd server && CLIENT_PATH=../client go run ./cmd/server

test:
	cd server && go test -v ./...

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
prod: pre-deploy
	docker-compose --profile production up -d --build
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
	docker-compose --profile production --profile monitoring up -d --build
	@echo "✅ Full deployment started!"

# ================================
# CI
# ================================

ci: fmt test lint pre-deploy
	@echo "✅ CI checks passed"

# ================================
# 帮助
# ================================

help:
	@echo "FPS Game - 命令列表"
	@echo ""
	@echo "本地开发:"
	@echo "  make build        构建后端"
	@echo "  make run          运行后端"
	@echo "  make test         运行测试"
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
