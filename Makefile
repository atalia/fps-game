.PHONY: all build run stop clean docker-up docker-down docker-logs test

# 默认目标
all: build

# 本地构建
build:
	cd server && go build -o bin/fps-server ./cmd/server

# 本地运行
run:
	cd server && go run ./cmd/server

# 运行测试
test:
	cd server && go test -v ./...

# Docker 构建
docker-build:
	docker-compose build

# 启动所有服务 (开发模式)
docker-up:
	docker-compose up -d

# 启动所有服务 (生产模式)
docker-up-prod:
	docker-compose --profile production up -d

# 启动所有服务 (带监控)
docker-up-monitoring:
	docker-compose --profile monitoring up -d

# 停止所有服务
docker-down:
	docker-compose down

# 查看日志
docker-logs:
	docker-compose logs -f

# 清理
clean:
	rm -rf server/bin
	docker-compose down -v

# 开发环境一键启动
dev: docker-up docker-logs

# 生产环境一键启动
prod: docker-up-prod docker-logs

# 重启服务
restart: docker-down docker-up

# 检查状态
status:
	docker-compose ps

# 进入容器
shell:
	docker-compose exec game-server sh
