package config

import (
	"os"
	"testing"
	"time"
)

func TestLoad(t *testing.T) {
	cfg := Load()

	if cfg.Server.Host == "" {
		t.Error("Server host should not be empty")
	}
	if cfg.Server.Port == "" {
		t.Error("Server port should not be empty")
	}
	if cfg.Game.TickRate <= 0 {
		t.Error("Tick rate should be positive")
	}
	if cfg.Game.MaxPlayers <= 0 {
		t.Error("Max players should be positive")
	}
}

func TestGetEnv(t *testing.T) {
	// 测试默认值
	val := getEnv("NON_EXISTENT_VAR", "default")
	if val != "default" {
		t.Errorf("getEnv() = %s, want default", val)
	}

	// 测试环境变量
	os.Setenv("TEST_VAR", "test_value")
	defer os.Unsetenv("TEST_VAR")

	val = getEnv("TEST_VAR", "default")
	if val != "test_value" {
		t.Errorf("getEnv() = %s, want test_value", val)
	}
}

func TestGetIntEnv(t *testing.T) {
	// 测试默认值
	val := getIntEnv("NON_EXISTENT_INT", 42)
	if val != 42 {
		t.Errorf("getIntEnv() = %d, want 42", val)
	}

	// 测试环境变量
	os.Setenv("TEST_INT", "100")
	defer os.Unsetenv("TEST_INT")

	val = getIntEnv("TEST_INT", 42)
	if val != 100 {
		t.Errorf("getIntEnv() = %d, want 100", val)
	}

	// 测试无效值
	os.Setenv("TEST_INT_INVALID", "not_a_number")
	defer os.Unsetenv("TEST_INT_INVALID")

	val = getIntEnv("TEST_INT_INVALID", 42)
	if val != 42 {
		t.Errorf("getIntEnv() with invalid = %d, want 42", val)
	}
}

func TestGetFloatEnv(t *testing.T) {
	// 测试默认值
	val := getFloatEnv("NON_EXISTENT_FLOAT", 3.14)
	if val != 3.14 {
		t.Errorf("getFloatEnv() = %f, want 3.14", val)
	}

	// 测试环境变量
	os.Setenv("TEST_FLOAT", "2.5")
	defer os.Unsetenv("TEST_FLOAT")

	val = getFloatEnv("TEST_FLOAT", 3.14)
	if val != 2.5 {
		t.Errorf("getFloatEnv() = %f, want 2.5", val)
	}

	// 测试无效值
	os.Setenv("TEST_FLOAT_INVALID", "not_a_float")
	defer os.Unsetenv("TEST_FLOAT_INVALID")

	val = getFloatEnv("TEST_FLOAT_INVALID", 3.14)
	if val != 3.14 {
		t.Errorf("getFloatEnv() with invalid = %f, want 3.14", val)
	}
}

func TestGetBoolEnv(t *testing.T) {
	// 测试默认值
	val := getBoolEnv("NON_EXISTENT_BOOL", true)
	if val != true {
		t.Errorf("getBoolEnv() = %v, want true", val)
	}

	// 测试环境变量
	os.Setenv("TEST_BOOL", "false")
	defer os.Unsetenv("TEST_BOOL")

	val = getBoolEnv("TEST_BOOL", true)
	if val != false {
		t.Errorf("getBoolEnv() = %v, want false", val)
	}

	// 测试无效值
	os.Setenv("TEST_BOOL_INVALID", "not_a_bool")
	defer os.Unsetenv("TEST_BOOL_INVALID")

	val = getBoolEnv("TEST_BOOL_INVALID", true)
	if val != true {
		t.Errorf("getBoolEnv() with invalid = %v, want true", val)
	}
}

func TestGetDurationEnv(t *testing.T) {
	// 测试默认值
	val := getDurationEnv("NON_EXISTENT_DURATION", 10*time.Second)
	if val != 10*time.Second {
		t.Errorf("getDurationEnv() = %v, want 10s", val)
	}

	// 测试环境变量
	os.Setenv("TEST_DURATION", "5s")
	defer os.Unsetenv("TEST_DURATION")

	val = getDurationEnv("TEST_DURATION", 10*time.Second)
	if val != 5*time.Second {
		t.Errorf("getDurationEnv() = %v, want 5s", val)
	}

	// 测试无效值
	os.Setenv("TEST_DURATION_INVALID", "not_a_duration")
	defer os.Unsetenv("TEST_DURATION_INVALID")

	val = getDurationEnv("TEST_DURATION_INVALID", 10*time.Second)
	if val != 10*time.Second {
		t.Errorf("getDurationEnv() with invalid = %v, want 10s", val)
	}
}

func TestConfigDefaults(t *testing.T) {
	cfg := Load()

	// 验证默认值
	if cfg.Server.Host != "0.0.0.0" {
		t.Errorf("Default host = %s, want 0.0.0.0", cfg.Server.Host)
	}
	if cfg.Server.Port != "8080" {
		t.Errorf("Default port = %s, want 8080", cfg.Server.Port)
	}
	if cfg.Game.TickRate != 60 {
		t.Errorf("Default tick rate = %d, want 60", cfg.Game.TickRate)
	}
	if cfg.Game.MaxPlayers != 1000 {
		t.Errorf("Default max players = %d, want 1000", cfg.Game.MaxPlayers)
	}
	if cfg.Game.MaxRooms != 100 {
		t.Errorf("Default max rooms = %d, want 100", cfg.Game.MaxRooms)
	}
}

func TestConfigWithEnvVars(t *testing.T) {
	// 设置环境变量
	os.Setenv("SERVER_HOST", "127.0.0.1")
	os.Setenv("SERVER_PORT", "3000")
	os.Setenv("GAME_TICK_RATE", "30")
	os.Setenv("REDIS_ENABLED", "false")
	os.Setenv("LOG_LEVEL", "debug")

	defer func() {
		os.Unsetenv("SERVER_HOST")
		os.Unsetenv("SERVER_PORT")
		os.Unsetenv("GAME_TICK_RATE")
		os.Unsetenv("REDIS_ENABLED")
		os.Unsetenv("LOG_LEVEL")
	}()

	cfg := Load()

	if cfg.Server.Host != "127.0.0.1" {
		t.Errorf("Host = %s, want 127.0.0.1", cfg.Server.Host)
	}
	if cfg.Server.Port != "3000" {
		t.Errorf("Port = %s, want 3000", cfg.Server.Port)
	}
	if cfg.Game.TickRate != 30 {
		t.Errorf("TickRate = %d, want 30", cfg.Game.TickRate)
	}
	if cfg.Redis.Enabled != false {
		t.Errorf("Redis.Enabled = %v, want false", cfg.Redis.Enabled)
	}
	if cfg.Log.Level != "debug" {
		t.Errorf("Log.Level = %s, want debug", cfg.Log.Level)
	}
}

