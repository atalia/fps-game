package protocol

import (
	"testing"
)

// TestRoomJoinedSchema 测试 room_joined 消息
func TestRoomJoinedSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid message",
			msg: map[string]interface{}{
				"room_id":   "room-123",
				"player_id": "player-456",
				"players": []interface{}{
					map[string]interface{}{
						"id":   "player-789",
						"name": "TestPlayer",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "missing room_id",
			msg: map[string]interface{}{
				"player_id": "player-456",
				"players":   []interface{}{},
			},
			wantErr: true,
		},
		{
			name: "missing player_id",
			msg: map[string]interface{}{
				"room_id": "room-123",
				"players": []interface{}{},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("room_joined", tt.msg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestPlayerJoinedSchema 测试 player_joined 消息
func TestPlayerJoinedSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid player",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"name":      "TestPlayer",
				"position": map[string]interface{}{
					"x": 10.0,
					"y": 0.0,
					"z": 20.0,
				},
				"is_bot": false,
			},
			wantErr: false,
		},
		{
			name: "valid bot",
			msg: map[string]interface{}{
				"player_id":  "bot-123",
				"name":       "Bot",
				"is_bot":     true,
				"difficulty": "normal",
			},
			wantErr: false,
		},
		{
			name: "missing player_id",
			msg: map[string]interface{}{
				"name": "TestPlayer",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("player_joined", tt.msg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestPlayerShotSchema 测试 player_shot 消息
func TestPlayerShotSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid shot with all fields",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"position": map[string]interface{}{
					"x": 10.0,
					"y": 1.7,
					"z": 20.0,
				},
				"rotation":  1.57,
				"ammo":      29,
				"weapon_id": "rifle",
				"direction": map[string]interface{}{
					"x": 0.0,
					"y": 0.0,
					"z": -1.0,
				},
			},
			wantErr: false,
		},
		{
			name: "minimal shot",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"position": map[string]interface{}{
					"x": 0.0,
					"y": 0.0,
					"z": 0.0,
				},
			},
			wantErr: false,
		},
		{
			name: "missing position",
			msg: map[string]interface{}{
				"player_id": "player-123",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("player_shot", tt.msg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestPlayerDamagedSchema 测试 player_damaged 消息
func TestPlayerDamagedSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid damage",
			msg: map[string]interface{}{
				"player_id":         "victim-123",
				"attacker_id":       "attacker-456",
				"attacker_position": map[string]interface{}{"x": 10.0, "y": 0.0, "z": 20.0},
				"damage":            25,
				"hitbox":            "body",
				"remaining_health":  75,
			},
			wantErr: false,
		},
		{
			name: "missing required fields",
			msg: map[string]interface{}{
				"player_id": "victim-123",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("player_damaged", tt.msg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestWeaponChangedSchema 测试 weapon_changed 消息
func TestWeaponChangedSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid weapon change",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"weapon":    "awp",
			},
			wantErr: false,
		},
		{
			name: "missing weapon",
			msg: map[string]interface{}{
				"player_id": "player-123",
			},
			wantErr: true,
		},
		{
			name: "invalid weapon",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"weapon":    "laser",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("weapon_changed", tt.msg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestMoneyUpdatedSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid money update",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"money":     2300,
				"delta":     300,
				"reason":    "kill",
			},
			wantErr: false,
		},
		{
			name: "missing money",
			msg: map[string]interface{}{
				"player_id": "player-123",
			},
			wantErr: true,
		},
		{
			name: "invalid reason",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"money":     1500,
				"reason":    "bonus",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("money_updated", tt.msg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestVoiceEventsSchema 测试语音事件
func TestVoiceEventsSchema(t *testing.T) {
	t.Run("voice_start", func(t *testing.T) {
		msg := map[string]interface{}{
			"playerId": "player-123",
		}
		err := ValidateSchemaStrict("voice_start", msg)
		if err != nil {
			t.Errorf("voice_start validation failed: %v", err)
		}
	})

	t.Run("voice_data", func(t *testing.T) {
		msg := map[string]interface{}{
			"playerId": "player-123",
			"audio":    "base64encodeddata",
		}
		err := ValidateSchemaStrict("voice_data", msg)
		if err != nil {
			t.Errorf("voice_data validation failed: %v", err)
		}
	})

	t.Run("voice_start missing playerId", func(t *testing.T) {
		msg := map[string]interface{}{}
		err := ValidateSchemaStrict("voice_start", msg)
		if err == nil {
			t.Error("expected error for missing playerId")
		}
	})
}
