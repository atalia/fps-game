package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"fps-game/internal/config"
	"fps-game/internal/game"
	"fps-game/internal/match"
	"fps-game/internal/network"
	"fps-game/internal/room"

	"github.com/gorilla/mux"
)

var (
	buildVersion = "dev"
	buildCommit  = "unknown"
)

func formattedBuildVersion() string {
	if buildCommit == "" || buildCommit == "unknown" {
		return buildVersion
	}
	return fmt.Sprintf("%s+%s", buildVersion, buildCommit)
}

func shouldDisableStaticCache(path string) bool {
	if path == "/" || path == "/index.html" {
		return true
	}
	switch strings.ToLower(filepath.Ext(path)) {
	case ".js", ".css", ".html":
		return true
	default:
		return false
	}
}

func withStaticAssetHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if shouldDisableStaticCache(r.URL.Path) {
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			w.Header().Set("X-Build-Commit", buildCommit)
			w.Header().Set("X-Build-Version", formattedBuildVersion())
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	// 加载配置
	cfg := config.Load()

	// 初始化组件
	gameEngine := game.NewEngine(cfg.Game.TickRate)
	roomManager := room.NewManager(cfg.Game.MaxRooms, cfg.Game.DefaultRoomSize)
	matcher := match.NewMatcher(5, 30*time.Second) // 5v5, 30秒最大等待

	// 启动游戏引擎
	gameEngine.Start()
	defer gameEngine.Stop()

	// 初始化 WebSocket Hub
	hub := network.NewHub()
	go hub.Run()

	// 路由
	r := mux.NewRouter()

	// API 路由
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", healthHandler).Methods("GET")
	api.HandleFunc("/stats", statsHandler(gameEngine, roomManager)).Methods("GET")
	api.HandleFunc("/rooms", listRoomsHandler(roomManager)).Methods("GET")

	// WebSocket 路由
	r.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		network.ServeWS(hub, roomManager, matcher, cfg.CORS.AllowedOrigins, w, r)
	})

	// 静态文件服务
	r.PathPrefix("/").Handler(withStaticAssetHeaders(http.FileServer(http.Dir(cfg.ClientPath))))

	// 中间件
	handler := withCORS(cfg.CORS.AllowedOrigins, r)
	handler = withLogging(handler)

	// 启动服务器
	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	log.Printf("🎮 FPS Game Server starting on %s", addr)
	log.Printf("📊 Health check: http://%s/api/health", addr)
	log.Printf("🔌 WebSocket: ws://%s/ws", addr)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
		"version":   formattedBuildVersion(),
		"commit":    buildCommit,
	}); err != nil {
		log.Printf("Error encoding health response: %v", err)
	}
}

func statsHandler(engine *game.Engine, rm *room.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]interface{}{
			"players": rm.GetTotalPlayerCount(),
			"rooms":   rm.GetRoomCount(),
			"uptime":  time.Now().Unix(),
		}); err != nil {
			log.Printf("Error encoding stats response: %v", err)
		}
	}
}

func listRoomsHandler(rm *room.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		rooms := rm.ListRooms()
		if err := json.NewEncoder(w).Encode(map[string]interface{}{
			"rooms": rooms,
			"count": len(rooms),
		}); err != nil {
			log.Printf("Error encoding rooms response: %v", err)
		}
	}
}

func withCORS(allowedOrigins []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		origin := r.Header.Get("Origin")
		allowed := isAllowedOrigin(origin, allowedOrigins)
		if origin != "" && allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}

		if r.Method == "OPTIONS" {
			if origin != "" && !allowed {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func isAllowedOrigin(origin string, allowedOrigins []string) bool {
	if origin == "" {
		return true
	}
	if len(allowedOrigins) == 0 {
		return strings.HasPrefix(origin, "http://localhost") || strings.HasPrefix(origin, "http://127.0.0.1")
	}
	for _, allowed := range allowedOrigins {
		if allowed == origin {
			return true
		}
	}
	return false
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
	})
}
