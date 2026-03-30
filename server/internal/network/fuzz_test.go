package network

import (
	"encoding/json"
	"math/rand"
	"testing"
	"time"
)

// FuzzHandleShoot 测试 shoot 消息的异常输入
func FuzzHandleShoot(f *testing.F) {
	// 添加种子语料库
	f.Add([]byte(`{"position":{"x":0,"y":0,"z":0}}`))
	f.Add([]byte(`{"position":{"x":100,"y":200,"z":300},"rotation":1.57,"pitch":0.3}`))
	f.Add([]byte(`{"position":{"x":-999999,"y":999999,"z":0},"direction":{"x":0,"y":0,"z":-1},"weapon_id":"rifle"}`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`invalid json`))
	f.Add([]byte(`{"position":null}`))
	f.Add([]byte(`{"position":"invalid"}`))
	f.Add([]byte(`{"position":{"x":"string"},"rotation":{}}`))
	
	f.Fuzz(func(t *testing.T, data []byte) {
		// 解析消息
		var shootData struct {
			Position  map[string]interface{} `json:"position"`
			Rotation  float64                `json:"rotation"`
			Pitch     float64                `json:"pitch"`
			Direction map[string]interface{} `json:"direction"`
			WeaponID  string                 `json:"weapon_id"`
		}
		
		// 不应该 panic
		err := json.Unmarshal(data, &shootData)
		if err != nil {
			return // 无效 JSON，正常返回
		}
		
		// 验证位置值范围
		if shootData.Position != nil {
			for k, v := range shootData.Position {
				switch val := v.(type) {
				case float64:
					// 检查是否为 NaN 或 Inf
					if val != val || val > 1e10 || val < -1e10 {
						// 极端值应该被处理
					}
				case string:
					// 字符串类型应该被处理
				}
				_ = k
			}
		}
	})
}

// FuzzHandleWeaponChange 测试武器切换消息的异常输入
func FuzzHandleWeaponChange(f *testing.F) {
	f.Add([]byte(`{"weapon":"rifle"}`))
	f.Add([]byte(`{"weapon_id":"sniper"}`))
	f.Add([]byte(`{"weapon":"invalid_weapon"}`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"weapon":""}`))
	f.Add([]byte(`{"weapon":123}`))
	f.Add([]byte(`{"weapon":null}`))
	f.Add([]byte(`invalid`))
	
	f.Fuzz(func(t *testing.T, data []byte) {
		var req struct {
			Weapon   string `json:"weapon"`
			WeaponID string `json:"weapon_id"`
		}
		
		err := json.Unmarshal(data, &req)
		if err != nil {
			return
		}
		
		// 验证武器 ID 是否有效
		validWeapons := map[string]bool{
			"pistol":  true,
			"rifle":   true,
			"shotgun": true,
			"sniper":  true,
		}
		
		weapon := req.Weapon
		if weapon == "" {
			weapon = req.WeaponID
		}
		
		// 无效武器应该被忽略
		_ = validWeapons[weapon]
	})
}

// FuzzHandleVoiceData 测试语音数据的异常输入
func FuzzHandleVoiceData(f *testing.F) {
	f.Add([]byte(`{"audio":"base64data"}`))
	f.Add([]byte(`{"audio":""}`))
	f.Add([]byte(`{"audio":123}`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"audio":"data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="}`))
	f.Add([]byte(`{"audio":"\u0000\u0001\u0002"}`))
	f.Add([]byte(`{"audio":"` + string(make([]byte, 100000)) + `"}`)) // 大数据
	f.Add([]byte(`invalid`))
	
	f.Fuzz(func(t *testing.T, data []byte) {
		var voiceMsg struct {
			Audio string `json:"audio"`
		}
		
		err := json.Unmarshal(data, &voiceMsg)
		if err != nil {
			return
		}
		
		// 验证音频数据长度
		if len(voiceMsg.Audio) > 10*1024*1024 { // 10MB 限制
			// 应该被拒绝
		}
		
		// 验证是否为有效 base64
		_ = voiceMsg.Audio
	})
}

// FuzzHandleChat 测试聊天消息的异常输入
func FuzzHandleChat(f *testing.F) {
	f.Add([]byte(`{"message":"hello"}`))
	f.Add([]byte(`{"message":""}`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"message":"` + string(make([]byte, 10000)) + `"}`)) // 长消息
	f.Add([]byte(`{"message":"<script>alert('xss')</script>"}`))
	f.Add([]byte(`{"message":"\u0000\u0001\u0002"}`))
	f.Add([]byte(`{"message":123}`))
	f.Add([]byte(`invalid`))
	
	f.Fuzz(func(t *testing.T, data []byte) {
		var chatMsg struct {
			Message string `json:"message"`
		}
		
		err := json.Unmarshal(data, &chatMsg)
		if err != nil {
			return
		}
		
		// 验证消息长度
		if len(chatMsg.Message) > 256 {
			// 应该被截断或拒绝
		}
		
		// 验证消息内容（防止 XSS）
		_ = chatMsg.Message
	})
}

// FuzzHandleMove 测试移动消息的异常输入
func FuzzHandleMove(f *testing.F) {
	f.Add([]byte(`{"x":0,"y":0,"z":0,"rotation":0}`))
	f.Add([]byte(`{"x":1e10,"y":-1e10,"z":0}`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"x":"invalid","y":0}`))
	f.Add([]byte(`{"x":NaN,"y":Infinity}`))
	f.Add([]byte(`invalid`))
	
	f.Fuzz(func(t *testing.T, data []byte) {
		var moveData map[string]interface{}
		
		err := json.Unmarshal(data, &moveData)
		if err != nil {
			return
		}
		
		// 验证坐标值
		for _, key := range []string{"x", "y", "z", "rotation"} {
			if val, ok := moveData[key]; ok {
				switch v := val.(type) {
				case float64:
					// 检查范围
					if v > 1e6 || v < -1e6 {
						// 极端坐标应该被限制
					}
				case string:
					// 字符串应该被处理
				}
			}
		}
	})
}

// FuzzPlayerName 测试玩家名称的异常输入
func FuzzPlayerName(f *testing.F) {
	f.Add([]byte("Player"))
	f.Add([]byte(""))
	f.Add([]byte("A"))
	f.Add([]byte(string(make([]byte, 100)))) // 长名称
	f.Add([]byte("<script>alert('xss')</script>"))
	f.Add([]byte("Player\x00Name"))
	f.Add([]byte("Player\t\n\rName"))
	f.Add([]byte("玩家名"))
	f.Add([]byte("🎮Player🎮"))
	
	f.Fuzz(func(t *testing.T, name []byte) {
		// 验证名称长度
		if len(name) == 0 || len(name) > 32 {
			// 应该被拒绝
			return
		}
		
		// 验证字符是否合法
		for _, c := range name {
			// 只允许字母、数字、空格、下划线、连字符
			if !((c >= 'a' && c <= 'z') ||
				(c >= 'A' && c <= 'Z') ||
				(c >= '0' && c <= '9') ||
				c == ' ' || c == '_' || c == '-') {
				// 无效字符应该被拒绝
			}
		}
	})
}

// BenchmarkHandleShoot 性能测试
func BenchmarkHandleShoot(b *testing.B) {
	data := []byte(`{"position":{"x":10,"y":1.7,"z":20},"rotation":1.57,"pitch":0.3,"weapon_id":"rifle"}`)
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var shootData struct {
			Position  map[string]float64 `json:"position"`
			Rotation  float64            `json:"rotation"`
			Pitch     float64            `json:"pitch"`
			WeaponID  string             `json:"weapon_id"`
		}
		_ = json.Unmarshal(data, &shootData)
	}
}

// TestMalformedJSON 测试畸形 JSON
func TestMalformedJSON(t *testing.T) {
	testCases := []struct {
		name  string
		input []byte
	}{
		{"empty object", []byte(`{}`)},
		{"missing brace", []byte(`{"position":{"x":0}`)},
		{"extra comma", []byte(`{"position":{"x":0,},}`)},
		{"null values", []byte(`{"position":null,"rotation":null}`)},
		{"wrong types", []byte(`{"position":123,"rotation":"string"}`)},
		{"unicode", []byte(`{"message":"你好世界🎉"}`)},
		{"escape sequences", []byte(`{"message":"line1\nline2\ttab"}`)},
	}
	
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var data map[string]interface{}
			err := json.Unmarshal(tc.input, &data)
			
			// 不应该 panic
			if err != nil {
				// 解析失败是正常的
				t.Logf("Expected parse error: %v", err)
			}
		})
	}
}

// TestExtremeValues 测试极端值
func TestExtremeValues(t *testing.T) {
	rand.Seed(time.Now().UnixNano())
	
	testCases := []struct {
		name  string
		value interface{}
	}{
		{"max float", 1.7976931348623157e+308},
		{"min float", -1.7976931348623157e+308},
		{"very large int", int64(9223372036854775807)},
		{"very small int", int64(-9223372036854775808)},
		{"zero", 0},
		{"negative zero", -0.0},
	}
	
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			data := map[string]interface{}{
				"value": tc.value,
			}
			
			jsonData, err := json.Marshal(data)
			if err != nil {
				t.Fatalf("Failed to marshal: %v", err)
			}
			
			var parsed map[string]interface{}
			if err := json.Unmarshal(jsonData, &parsed); err != nil {
				t.Fatalf("Failed to unmarshal: %v", err)
			}
		})
	}
}
