package config

import (
	"os"
	"strconv"
	"time"
)

// Config 游戏服务器配置
type Config struct {
	Server     ServerConfig
	Game       GameConfig
	Redis      RedisConfig
	Log        LogConfig
	Metrics    MetricsConfig
	ClientPath string
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Host         string
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

// GameConfig 游戏配置
type GameConfig struct {
	TickRate        int           // 服务端帧率
	MaxPlayers      int           // 最大玩家数
	MaxRooms        int           // 最大房间数
	DefaultRoomSize int           // 默认房间人数
	MapSize         float64       // 地图大小
	SpawnDistance   float64       // 出生点距离
}

// RedisConfig Redis 配置
type RedisConfig struct {
	Addr     string
	Password string
	DB       int
	Enabled  bool
}

// LogConfig 日志配置
type LogConfig struct {
	Level  string
	Format string // json, text
}

// MetricsConfig 监控配置
type MetricsConfig struct {
	Enabled bool
	Port    string
}

// Load 从环境变量加载配置
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Host:         getEnv("SERVER_HOST", "0.0.0.0"),
			Port:         getEnv("SERVER_PORT", "8080"),
			ReadTimeout:  getDurationEnv("READ_TIMEOUT", 10*time.Second),
			WriteTimeout: getDurationEnv("WRITE_TIMEOUT", 10*time.Second),
		},
		Game: GameConfig{
			TickRate:        getIntEnv("GAME_TICK_RATE", 60),
			MaxPlayers:      getIntEnv("GAME_MAX_PLAYERS", 1000),
			MaxRooms:        getIntEnv("GAME_MAX_ROOMS", 100),
			DefaultRoomSize: getIntEnv("GAME_ROOM_SIZE", 10),
			MapSize:         getFloatEnv("GAME_MAP_SIZE", 100.0),
			SpawnDistance:   getFloatEnv("GAME_SPAWN_DISTANCE", 10.0),
		},
		Redis: RedisConfig{
			Addr:     getEnv("REDIS_ADDR", "redis:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getIntEnv("REDIS_DB", 0),
			Enabled:  getBoolEnv("REDIS_ENABLED", true),
		},
		Log: LogConfig{
			Level:  getEnv("LOG_LEVEL", "info"),
			Format: getEnv("LOG_FORMAT", "json"),
		},
		Metrics: MetricsConfig{
			Enabled: getBoolEnv("METRICS_ENABLED", true),
			Port:    getEnv("METRICS_PORT", "9090"),
		},
		ClientPath: getEnv("CLIENT_PATH", "./client"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getFloatEnv(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if f, err := strconv.ParseFloat(value, 64); err == nil {
			return f
		}
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if b, err := strconv.ParseBool(value); err == nil {
			return b
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}
