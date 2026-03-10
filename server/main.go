package main

import (
	"log"
	"net/http"
	"os"

	"fps-game/network"
	"fps-game/room"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 开发环境允许所有来源
	},
}

func main() {
	// 初始化房间管理器
	roomManager := room.NewManager()

	// WebSocket 路由
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}
		// 处理新连接
		network.HandleConnection(conn, roomManager)
	})

	// 静态文件服务（前端）
	http.Handle("/", http.FileServer(http.Dir("../client")))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🎮 FPS Game Server starting on :%s", port)
	log.Printf("📡 WebSocket endpoint: ws://localhost:%s/ws", port)
	log.Printf("🌐 Web client: http://localhost:%s", port)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal("Server error:", err)
	}
}
