package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"fps-game/internal/config"
	"fps-game/internal/game"
	"fps-game/internal/network"
	"fps-game/internal/room"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 开发环境允许所有来源
	},
}

func main() {
	// 加载配置
	cfg := config.Load()

	// 初始化组件
	hub := network.NewHub()
	go hub.Run()

	roomManager := room.NewManager(cfg.Game.MaxRooms, cfg.Game.DefaultRoomSize)
	gameEngine := game.NewEngine(cfg.Game.TickRate)
	gameEngine.Start()
	defer gameEngine.Stop()

	// WebSocket 路由
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}
		network.HandleConnection(conn, hub, roomManager)
	})

	// API 路由
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	http.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		stats := map[string]interface{}{
			"players_online": hub.GetClientCount(),
			"rooms_active":   gameEngine.GetActiveRoomCount(),
			"rooms_total":    roomManager.GetRoomCount(),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	})

	// 静态文件服务
	http.Handle("/", http.FileServer(http.Dir("./client")))

	// 启动服务器
	addr := cfg.Server.Host + ":" + cfg.Server.Port
	server := &http.Server{
		Addr:         addr,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	go func() {
		log.Printf("🎮 FPS Game Server starting on %s", addr)
		log.Printf("📡 WebSocket endpoint: ws://%s/ws", addr)
		log.Printf("🌐 Web client: http://%s", addr)
		log.Printf("📊 Tick rate: %d Hz", cfg.Game.TickRate)

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server error:", err)
		}
	}()

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server stopped")
}
