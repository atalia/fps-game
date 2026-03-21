package utils

import (
	"os"
	"testing"
	"time"
)

func TestGenerateID(t *testing.T) {
	id1 := GenerateID()
	id2 := GenerateID()

	if id1 == "" {
		t.Error("ID should not be empty")
	}
	if id1 == id2 {
		t.Error("IDs should be unique")
	}
	if len(id1) != 16 {
		t.Errorf("ID length = %d, want 16", len(id1))
	}
}

func TestGenerateIDWithPrefix(t *testing.T) {
	id := GenerateIDWithPrefix("player_")

	if len(id) < 17 {
		t.Error("ID with prefix should be longer")
	}
	if id[:7] != "player_" {
		t.Errorf("ID prefix = %s, want player_", id[:7])
	}
}

func TestTimestamp(t *testing.T) {
	ts := Timestamp()
	if ts == 0 {
		t.Error("Timestamp should not be zero")
	}

	time.Sleep(10 * time.Millisecond)
	ts2 := Timestamp()
	if ts2 <= ts {
		t.Error("Timestamp should increase")
	}
}

func TestTimestampMicro(t *testing.T) {
	ts := TimestampMicro()
	if ts == 0 {
		t.Error("TimestampMicro should not be zero")
	}
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		d    time.Duration
		want string
	}{
		{500 * time.Millisecond, "500ms"},
		{1500 * time.Millisecond, "1.5s"},
		{90 * time.Second, "1.5m"},
		{2 * time.Hour, "2.0h"},
	}

	for _, tt := range tests {
		got := FormatDuration(tt.d)
		if got != tt.want {
			t.Errorf("FormatDuration(%v) = %s, want %s", tt.d, got, tt.want)
		}
	}
}

func TestEnsureDir(t *testing.T) {
	tmpDir := "/tmp/test_ensure_" + GenerateID()
	defer os.RemoveAll(tmpDir)

	err := EnsureDir(tmpDir)
	if err != nil {
		t.Errorf("EnsureDir failed: %v", err)
	}

	if !DirExists(tmpDir) {
		t.Error("Directory should exist")
	}

	// 再次调用应该不报错
	err = EnsureDir(tmpDir)
	if err != nil {
		t.Errorf("EnsureDir on existing dir should not error: %v", err)
	}
}

func TestFileExists(t *testing.T) {
	// 创建临时文件
	tmpFile := "/tmp/test_file_" + GenerateID()
	_ = os.WriteFile(tmpFile, []byte("test"), 0644)
	defer os.Remove(tmpFile)

	if !FileExists(tmpFile) {
		t.Error("File should exist")
	}

	if FileExists("/nonexistent/file") {
		t.Error("Nonexistent file should not exist")
	}
}

func TestDirExists(t *testing.T) {
	// 创建临时目录
	tmpDir := "/tmp/test_dir_" + GenerateID()
	_ = os.MkdirAll(tmpDir, 0755)
	defer os.RemoveAll(tmpDir)

	if !DirExists(tmpDir) {
		t.Error("Directory should exist")
	}

	if DirExists("/nonexistent/dir") {
		t.Error("Nonexistent directory should not exist")
	}

	// 文件不是目录
	tmpFile := "/tmp/test_not_dir_" + GenerateID()
	_ = os.WriteFile(tmpFile, []byte("test"), 0644)
	defer os.Remove(tmpFile)

	if DirExists(tmpFile) {
		t.Error("File should not be detected as directory")
	}
}

func TestClamp(t *testing.T) {
	tests := []struct {
		value, min, max, want float64
	}{
		{5, 0, 10, 5},
		{-5, 0, 10, 0},
		{15, 0, 10, 10},
		{0.5, 0, 1, 0.5},
	}

	for _, tt := range tests {
		got := Clamp(tt.value, tt.min, tt.max)
		if got != tt.want {
			t.Errorf("Clamp(%f, %f, %f) = %f, want %f", tt.value, tt.min, tt.max, got, tt.want)
		}
	}
}

func TestClampInt(t *testing.T) {
	tests := []struct {
		value, min, max, want int
	}{
		{5, 0, 10, 5},
		{-5, 0, 10, 0},
		{15, 0, 10, 10},
	}

	for _, tt := range tests {
		got := ClampInt(tt.value, tt.min, tt.max)
		if got != tt.want {
			t.Errorf("ClampInt(%d, %d, %d) = %d, want %d", tt.value, tt.min, tt.max, got, tt.want)
		}
	}
}

func TestLerp(t *testing.T) {
	tests := []struct {
		a, b, t, want float64
	}{
		{0, 10, 0.5, 5},
		{0, 10, 0, 0},
		{0, 10, 1, 10},
		{10, 20, 0.5, 15},
	}

	for _, tt := range tests {
		got := Lerp(tt.a, tt.b, tt.t)
		if got != tt.want {
			t.Errorf("Lerp(%f, %f, %f) = %f, want %f", tt.a, tt.b, tt.t, got, tt.want)
		}
	}
}

func TestMin(t *testing.T) {
	if Min(1, 2) != 1 {
		t.Error("Min(1, 2) should be 1")
	}
	if Min(3, 2) != 2 {
		t.Error("Min(3, 2) should be 2")
	}
}

func TestMax(t *testing.T) {
	if Max(1, 2) != 2 {
		t.Error("Max(1, 2) should be 2")
	}
	if Max(3, 2) != 3 {
		t.Error("Max(3, 2) should be 3")
	}
}

func TestMinFloat(t *testing.T) {
	if MinFloat(1.5, 2.5) != 1.5 {
		t.Error("MinFloat(1.5, 2.5) should be 1.5")
	}
	if MinFloat(3.5, 2.5) != 2.5 {
		t.Error("MinFloat(3.5, 2.5) should be 2.5")
	}
}

func TestMaxFloat(t *testing.T) {
	if MaxFloat(1.5, 2.5) != 2.5 {
		t.Error("MaxFloat(1.5, 2.5) should be 2.5")
	}
	if MaxFloat(3.5, 2.5) != 3.5 {
		t.Error("MaxFloat(3.5, 2.5) should be 3.5")
	}
}

func TestAbs(t *testing.T) {
	if Abs(-5) != 5 {
		t.Error("Abs(-5) should be 5")
	}
	if Abs(5) != 5 {
		t.Error("Abs(5) should be 5")
	}
	if Abs(0) != 0 {
		t.Error("Abs(0) should be 0")
	}
}

func TestAbsFloat(t *testing.T) {
	if AbsFloat(-5.5) != 5.5 {
		t.Error("AbsFloat(-5.5) should be 5.5")
	}
	if AbsFloat(5.5) != 5.5 {
		t.Error("AbsFloat(5.5) should be 5.5")
	}
}

func TestRound(t *testing.T) {
	tests := []struct {
		n, want float64
	}{
		{1.4, 1},
		{1.5, 2},
		{1.6, 2},
		{-1.5, -2},
	}

	for _, tt := range tests {
		got := Round(tt.n)
		if got != int(tt.want) {
			t.Errorf("Round(%f) = %d, want %d", tt.n, got, int(tt.want))
		}
	}
}

func TestFormatNumber(t *testing.T) {
	tests := []struct {
		n    int
		want string
	}{
		{100, "100"},
		{1500, "1.5K"},
		{1500000, "1.5M"},
	}

	for _, tt := range tests {
		got := FormatNumber(tt.n)
		if got != tt.want {
			t.Errorf("FormatNumber(%d) = %s, want %s", tt.n, got, tt.want)
		}
	}
}

func TestContains(t *testing.T) {
	slice := []string{"a", "b", "c"}

	if !Contains(slice, "a") {
		t.Error("Should contain 'a'")
	}
	if Contains(slice, "d") {
		t.Error("Should not contain 'd'")
	}

	intSlice := []int{1, 2, 3}
	if !Contains(intSlice, 2) {
		t.Error("Should contain 2")
	}
	if Contains(intSlice, 4) {
		t.Error("Should not contain 4")
	}
}

func TestRemove(t *testing.T) {
	slice := []int{1, 2, 3, 2, 4}
	result := Remove(slice, 2)

	if len(result) != 3 {
		t.Errorf("Remove result length = %d, want 3", len(result))
	}
	if Contains(result, 2) {
		t.Error("Should not contain removed element")
	}
}

func TestUnique(t *testing.T) {
	slice := []int{1, 2, 2, 3, 3, 3}
	result := Unique(slice)

	if len(result) != 3 {
		t.Errorf("Unique result length = %d, want 3", len(result))
	}

	// 验证顺序保留
	if result[0] != 1 || result[1] != 2 || result[2] != 3 {
		t.Errorf("Unique result = %v, want [1 2 3]", result)
	}
}

func TestReverse(t *testing.T) {
	slice := []int{1, 2, 3}
	result := Reverse(slice)

	if result[0] != 3 || result[1] != 2 || result[2] != 1 {
		t.Errorf("Reverse result = %v, want [3 2 1]", result)
	}

	// 原切片不应改变
	if slice[0] != 1 {
		t.Error("Original slice should not be modified")
	}
}

func TestGetExecutableDir(t *testing.T) {
	dir, err := GetExecutableDir()
	if err != nil {
		t.Errorf("GetExecutableDir failed: %v", err)
	}
	if dir == "" {
		t.Error("Directory should not be empty")
	}
}

func TestLogFunctions(t *testing.T) {
	// 这些函数只测试不会 panic
	LogInfo("test info %s", "message")
	LogError("test error %s", "message")

	// Debug 需要 DEBUG 环境变量
	os.Setenv("DEBUG", "true")
	LogDebug("test debug %s", "message")
	os.Unsetenv("DEBUG")
	LogDebug("should not print")
}

func TestRecover(t *testing.T) {
	// 测试 Recover 不会 panic
	func() {
		defer Recover()
		panic("test panic")
	}()

	// 如果到达这里，说明 Recover 成功恢复了
}

func TestSafeGo(t *testing.T) {
	done := make(chan bool, 1)

	SafeGo(func() {
		done <- true
	})

	select {
	case <-done:
		// 成功
	case <-time.After(time.Second):
		t.Error("SafeGo should execute function")
	}
}

func TestSafeGo_WithPanic(t *testing.T) {
	// 测试 SafeGo 恢复 panic
	SafeGo(func() {
		panic("test panic in goroutine")
	})

	// 等待 goroutine 执行
	time.Sleep(100 * time.Millisecond)
	// 如果到达这里，说明 panic 被恢复了
}
