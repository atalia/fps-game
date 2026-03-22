# FPS Game Test Client Makefile

.PHONY: build run clean deps

# 默认服务器地址
SERVER ?= ws://localhost:8080/ws

deps:
	go mod download
	go mod tidy

build: deps
	go build -o test-client .

run: build
	./test-client -server $(SERVER)

# 交互模式
interactive: build
	./test-client -server $(SERVER) -mode interactive

# 自动测试模式 (2个客户端)
auto: build
	./test-client -server $(SERVER) -mode auto -clients 2

# 压力测试模式
stress: build
	./test-client -server $(SERVER) -mode stress -clients 10

# 远程服务器测试
test-remote: build
	./test-client -server ws://101.33.117.73:8080/ws -mode auto -clients 2

# 清理
clean:
	rm -f test-client
