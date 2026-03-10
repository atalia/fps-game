package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

// GenerateID 生成唯一 ID
func GenerateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// GenerateIDWithPrefix 生成带前缀的唯一 ID
func GenerateIDWithPrefix(prefix string) string {
	return prefix + GenerateID()
}

// Timestamp 获取当前时间戳（毫秒）
func Timestamp() int64 {
	return time.Now().UnixMilli()
}

// TimestampMicro 获取当前时间戳（微秒）
func TimestampMicro() int64 {
	return time.Now().UnixMicro()
}

// FormatDuration 格式化持续时间
func FormatDuration(d time.Duration) string {
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Milliseconds())
	}
	if d < time.Minute {
		return fmt.Sprintf("%.1fs", d.Seconds())
	}
	if d < time.Hour {
		return fmt.Sprintf("%.1fm", d.Minutes())
	}
	return fmt.Sprintf("%.1fh", d.Hours())
}

// EnsureDir 确保目录存在
func EnsureDir(path string) error {
	return os.MkdirAll(path, 0755)
}

// FileExists 检查文件是否存在
func FileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// DirExists 检查目录是否存在
func DirExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// GetExecutableDir 获取可执行文件所在目录
func GetExecutableDir() (string, error) {
	execPath, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(execPath), nil
}

// Clamp 限制值在指定范围内
func Clamp(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// ClampInt 限制整数值在指定范围内
func ClampInt(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// Lerp 线性插值
func Lerp(a, b, t float64) float64 {
	return a + (b-a)*t
}

// Min 返回最小值
func Min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Max 返回最大值
func Max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// MinFloat 返回最小浮点值
func MinFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// MaxFloat 返回最大浮点值
func MaxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

// Abs 返回绝对值
func Abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

// AbsFloat 返回浮点绝对值
func AbsFloat(n float64) float64 {
	if n < 0 {
		return -n
	}
	return n
}

// Round 四舍五入
func Round(n float64) int {
	if n < 0 {
		return int(n - 0.5)
	}
	return int(n + 0.5)
}

// FormatNumber 格式化数字（千位分隔符）
func FormatNumber(n int) string {
	if n < 1000 {
		return fmt.Sprintf("%d", n)
	}
	if n < 1000000 {
		return fmt.Sprintf("%.1fK", float64(n)/1000)
	}
	return fmt.Sprintf("%.1fM", float64(n)/1000000)
}

// LogInfo 打印信息日志
func LogInfo(format string, args ...interface{}) {
	log.Printf("[INFO] "+format, args...)
}

// LogError 打印错误日志
func LogError(format string, args ...interface{}) {
	log.Printf("[ERROR] "+format, args...)
}

// LogDebug 打印调试日志（仅在 DEBUG 模式）
func LogDebug(format string, args ...interface{}) {
	if os.Getenv("DEBUG") == "true" {
		log.Printf("[DEBUG] "+format, args...)
	}
}

// Recover Panic 恢复
func Recover() {
	if r := recover(); r != nil {
		log.Printf("[PANIC] Recovered: %v", r)
	}
}

// SafeGo 安全的 goroutine
func SafeGo(fn func()) {
	go func() {
		defer Recover()
		fn()
	}()
}

// Contains 检查切片是否包含元素
func Contains[T comparable](slice []T, item T) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}

// Remove 从切片中移除元素
func Remove[T comparable](slice []T, item T) []T {
	result := make([]T, 0)
	for _, v := range slice {
		if v != item {
			result = append(result, v)
		}
	}
	return result
}

// Unique 去重
func Unique[T comparable](slice []T) []T {
	seen := make(map[T]bool)
	result := make([]T, 0)
	for _, v := range slice {
		if !seen[v] {
			seen[v] = true
			result = append(result, v)
		}
	}
	return result
}

// Reverse 反转切片
func Reverse[T any](slice []T) []T {
	result := make([]T, len(slice))
	for i, v := range slice {
		result[len(slice)-1-i] = v
	}
	return result
}
