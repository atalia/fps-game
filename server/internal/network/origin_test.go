package network

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
)

func TestWebSocketOriginCheck(t *testing.T) {
	tests := []struct {
		name           string
		allowedOrigins []string
		requestOrigin  string
		shouldAllow    bool
	}{
		{
			name:           "允许 localhost",
			allowedOrigins: nil,
			requestOrigin:  "http://localhost:8080",
			shouldAllow:    true,
		},
		{
			name:           "允许 127.0.0.1",
			allowedOrigins: nil,
			requestOrigin:  "http://127.0.0.1:8080",
			shouldAllow:    true,
		},
		{
			name:           "允许服务器 IP",
			allowedOrigins: nil,
			requestOrigin:  "http://101.33.117.73:8080",
			shouldAllow:    true,
		},
		{
			name:           "允许 HTTPS",
			allowedOrigins: nil,
			requestOrigin:  "https://example.com",
			shouldAllow:    true,
		},
		{
			name:           "允许无 Origin (直接连接)",
			allowedOrigins: nil,
			requestOrigin:  "",
			shouldAllow:    true,
		},
		{
			name:           "白名单模式 - 匹配",
			allowedOrigins: []string{"http://example.com", "http://101.33.117.73:8080"},
			requestOrigin:  "http://101.33.117.73:8080",
			shouldAllow:    true,
		},
		{
			name:           "白名单模式 - 不匹配",
			allowedOrigins: []string{"http://example.com"},
			requestOrigin:  "http://evil.com",
			shouldAllow:    false,
		},
		{
			name:           "白名单通配符 *",
			allowedOrigins: []string{"*"},
			requestOrigin:  "http://any-domain.com",
			shouldAllow:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 创建测试服务器
			upgrader := websocket.Upgrader{
				CheckOrigin: func(r *http.Request) bool {
					if len(tt.allowedOrigins) == 0 {
						origin := r.Header.Get("Origin")
						return origin == "" ||
							strings.HasPrefix(origin, "http://localhost") ||
							strings.HasPrefix(origin, "http://127.0.0.1") ||
							strings.HasPrefix(origin, "http://101.33.117.73") ||
							strings.HasPrefix(origin, "https://") ||
							strings.HasPrefix(origin, "file:")
					}
					origin := r.Header.Get("Origin")
					for _, allowed := range tt.allowedOrigins {
						if allowed == origin || allowed == "*" {
							return true
						}
					}
					return origin == ""
				},
			}

			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				conn, err := upgrader.Upgrade(w, r, nil)
				if err != nil {
					t.Logf("Upgrade failed: %v", err)
					return
				}
				defer func() { _ = conn.Close() }()
			})

			server := httptest.NewServer(handler)
			defer server.Close()

			// 构造 WebSocket URL
			wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

			// 创建请求头
			header := http.Header{}
			if tt.requestOrigin != "" {
				header.Set("Origin", tt.requestOrigin)
			}

			// 尝试连接
			conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)

			if tt.shouldAllow {
				if err != nil {
					t.Errorf("期望连接成功，但失败: %v (Origin: %s)", err, tt.requestOrigin)
				} else {
					_ = conn.Close()
				}
			} else {
				if err == nil {
					_ = conn.Close()
					t.Errorf("期望连接失败，但成功 (Origin: %s)", tt.requestOrigin)
				}
			}
		})
	}
}

// TestDeploymentScenarios 测试真实部署场景
func TestDeploymentScenarios(t *testing.T) {
	t.Run("生产环境 IP 访问", func(t *testing.T) {
		// 模拟用户通过服务器 IP 访问
		origin := "http://101.33.117.73:8080"

		// 验证 CheckOrigin 逻辑
		upgrader := websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				o := r.Header.Get("Origin")
				return o == "" ||
					strings.HasPrefix(o, "http://localhost") ||
					strings.HasPrefix(o, "http://127.0.0.1") ||
					strings.HasPrefix(o, "http://101.33.117.73") ||
					strings.HasPrefix(o, "https://")
			},
		}

		req := httptest.NewRequest("GET", "/ws", nil)
		req.Header.Set("Origin", origin)

		if !upgrader.CheckOrigin(req) {
			t.Errorf("生产环境 IP 访问应该被允许，Origin: %s", origin)
		}
	})

	t.Run("移动端访问", func(t *testing.T) {
		// 移动端可能没有 Origin 或使用 file:// 协议
		origins := []string{"", "file://", "ionic://localhost"}

		for _, origin := range origins {
			req := httptest.NewRequest("GET", "/ws", nil)
			if origin != "" {
				req.Header.Set("Origin", origin)
			}

			upgrader := websocket.Upgrader{
				CheckOrigin: func(r *http.Request) bool {
					o := r.Header.Get("Origin")
					return o == "" || strings.HasPrefix(o, "file:")
				},
			}

			if !upgrader.CheckOrigin(req) {
				t.Errorf("移动端访问应该被允许，Origin: '%s'", origin)
			}
		}
	})
}
