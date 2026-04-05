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
			allowedOrigins: []string{"http://example.com", "http://test.local:8080"},
			requestOrigin:  "http://test.local:8080",
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

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				r.Header.Set("Origin", tt.requestOrigin)
				conn, err := upgrader.Upgrade(w, r, nil)
				if err != nil {
					if tt.shouldAllow {
						t.Errorf("expected to allow, but got error: %v", err)
					}
					return
				}
				defer conn.Close()
				if !tt.shouldAllow {
					t.Errorf("expected to reject, but connection was allowed")
				}
			}))
			defer server.Close()

			// 使用 WS 客户端测试连接
			headers := http.Header{}
			if tt.requestOrigin != "" {
				headers.Set("Origin", tt.requestOrigin)
			}

			wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
			conn, _, err := websocket.DefaultDialer.Dial(wsURL, headers)
			if err != nil {
				if tt.shouldAllow {
					t.Errorf("expected to allow, but got error: %v", err)
				}
				return
			}
			defer conn.Close()

			if !tt.shouldAllow {
				t.Errorf("expected to reject, but connection was allowed")
			}
		})
	}
}
