#!/bin/bash

# FPS Game 快速启动脚本

set -e

echo "🎮 FPS Game - 快速部署"
echo "========================"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装"
    exit 1
fi

# 复制环境变量
if [ ! -f .env ]; then
    echo "📋 复制环境变量配置..."
    cp .env.example .env
fi

# 选择部署模式
echo ""
echo "选择部署模式:"
echo "  1) 开发环境 (game-server + redis)"
echo "  2) 生产环境 (+ nginx)"
echo "  3) 完整部署 (+ prometheus + grafana)"
echo ""
read -p "请选择 [1-3]: " choice

case $choice in
    1)
        echo "🚀 启动开发环境..."
        docker-compose up -d --build
        ;;
    2)
        echo "🚀 启动生产环境..."
        docker-compose --profile production up -d --build
        ;;
    3)
        echo "🚀 启动完整部署..."
        docker-compose --profile production --profile monitoring up -d --build
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "✅ 部署完成!"
echo ""
echo "📍 服务地址:"
echo "  🎮 游戏:     http://localhost:8080"
echo "  🔌 WebSocket: ws://localhost:8080/ws"
echo "  📊 Redis:    localhost:6379"

if [ "$choice" = "2" ] || [ "$choice" = "3" ]; then
    echo "  🌐 Nginx:    http://localhost"
fi

if [ "$choice" = "3" ]; then
    echo "  📈 Prometheus: http://localhost:9091"
    echo "  📊 Grafana:    http://localhost:3000 (admin/admin)"
fi

echo ""
echo "📝 常用命令:"
echo "  查看日志: docker-compose logs -f"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart"
