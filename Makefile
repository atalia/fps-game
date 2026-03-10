.PHONY: all build run test cover lint fmt clean

# 默认目标
all: build

# 构建
build:
	cd server && go build -o bin/fps-server ./cmd/server

# 运行
run:
	cd server && go run ./cmd/server

# 测试
test:
	cd server && go test -v ./...

# 测试覆盖率
cover:
	cd server && go test ./... -coverprofile=coverage.out
	cd server && go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: server/coverage.html"

# Lint 检查
lint:
	cd server && golangci-lint run

# 格式化
fmt:
	cd server && gofmt -w .
	cd server && goimports -w .

# 清理
clean:
	rm -rf server/bin
	rm -f server/coverage.out server/coverage.html

# Docker
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# 开发
dev: docker-up docker-logs

# CI
ci: fmt test lint
	@echo "CI checks passed"
