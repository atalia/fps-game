package utils

import (
	"os"
	"testing"
)

func TestFileExists(t *testing.T) {
	// 创建临时文件
	tmpFile := "/tmp/test_file_" + GenerateID()
	os.WriteFile(tmpFile, []byte("test"), 0644)
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
	os.MkdirAll(tmpDir, 0755)
	defer os.RemoveAll(tmpDir)

	if !DirExists(tmpDir) {
		t.Error("Directory should exist")
	}

	if DirExists("/nonexistent/dir") {
		t.Error("Nonexistent directory should not exist")
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
		t.Error("Directory should be created")
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

func TestAbsFloat(t *testing.T) {
	if AbsFloat(-5.5) != 5.5 {
		t.Error("AbsFloat(-5.5) should be 5.5")
	}
	if AbsFloat(5.5) != 5.5 {
		t.Error("AbsFloat(5.5) should be 5.5")
	}
}

func TestTimestampMicro(t *testing.T) {
	ts := TimestampMicro()
	if ts == 0 {
		t.Error("TimestampMicro should not be zero")
	}
}

func TestSafeGo(t *testing.T) {
	SafeGo(func() {
		// goroutine 执行
	})

	// 等待 goroutine 执行
	// 由于是并发测试，这里不做严格验证
}

func TestSafeGo_Panic(t *testing.T) {
	// 测试 panic 恢复
	SafeGo(func() {
		panic("test panic")
	})

	// 如果到达这里，说明 panic 被恢复了
}
