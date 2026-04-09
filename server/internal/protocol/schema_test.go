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

func TestPlayerKilledSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid kill event",
			msg: map[string]interface{}{
				"victim_id":     "victim-123",
				"killer_id":     "killer-456",
				"weapon_id":     "ak47",
				"hitbox":        "head",
				"is_headshot":   true,
				"kill_distance": 23.5,
				"is_bot":        false,
			},
			wantErr: false,
		},
		{
			name: "missing killer_id",
			msg: map[string]interface{}{
				"victim_id": "victim-123",
			},
			wantErr: true,
		},
		{
			name: "invalid hitbox",
			msg: map[string]interface{}{
				"victim_id": "victim-123",
				"killer_id": "killer-456",
				"hitbox":    "torso",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("player_killed", tt.msg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestArmorUpdatedSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid armor update",
			msg: map[string]interface{}{
				"player_id":  "player-123",
				"armor":      75,
				"has_helmet": true,
			},
			wantErr: false,
		},
		{
			name: "missing armor",
			msg: map[string]interface{}{
				"player_id": "player-123",
			},
			wantErr: true,
		},
		{
			name: "armor exceeds max",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"armor":     120,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("armor_updated", tt.msg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestPlayerRespawnedSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid respawn payload",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"position": map[string]interface{}{
					"x": 10.0,
					"y": 0.0,
					"z": -5.0,
				},
				"health":     100,
				"armor":      50,
				"has_helmet": true,
				"ammo":       30,
			},
			wantErr: false,
		},
		{
			name: "missing position",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"health":    100,
			},
			wantErr: true,
		},
		{
			name: "health exceeds max",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"position": map[string]interface{}{
					"x": 0.0,
					"y": 0.0,
					"z": 0.0,
				},
				"health": 101,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("player_respawned", tt.msg)
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

func TestRoundStateSchema(t *testing.T) {
	msg := map[string]interface{}{
		"phase":             "freeze",
		"round_number":      2,
		"rounds_played":     1,
		"regulation_rounds": 30,
		"first_to_win":      16,
		"timer_seconds":     5,
		"buy_time_left":     15,
		"can_move":          false,
		"can_shoot":         false,
		"can_buy":           true,
		"is_overtime":       false,
	}

	if err := ValidateSchemaStrict("round_state", msg); err != nil {
		t.Fatalf("round_state validation failed: %v", err)
	}
}

func TestRoundEndedSchema(t *testing.T) {
	msg := map[string]interface{}{
		"round_number": 9,
		"winner":       "ct",
		"reason":       "elimination",
		"announcement": "CT win by elimination | MVP: Alice",
		"mvp": map[string]interface{}{
			"player_id": "alice",
			"name":      "Alice",
			"kills":     2,
			"damage":    145,
		},
	}

	if err := ValidateSchemaStrict("round_ended", msg); err != nil {
		t.Fatalf("round_ended validation failed: %v", err)
	}
}

func TestMatchEndedSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid match end",
			msg: map[string]interface{}{
				"winner":       "ct",
				"round_number": 16,
				"is_overtime":  false,
			},
			wantErr: false,
		},
		{
			name: "missing winner",
			msg: map[string]interface{}{
				"round_number": 16,
			},
			wantErr: true,
		},
		{
			name: "invalid winner",
			msg: map[string]interface{}{
				"winner":       "draw",
				"round_number": 16,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("match_ended", tt.msg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestC4Schemas(t *testing.T) {
	t.Run("c4_planted", func(t *testing.T) {
		tests := []struct {
			name    string
			msg     map[string]interface{}
			wantErr bool
		}{
			{
				name: "valid planted payload",
				msg: map[string]interface{}{
					"player_id": "player-123",
					"position": map[string]interface{}{
						"x": 12.0,
						"y": 0.0,
						"z": -8.0,
					},
					"team":         "t",
					"explosion_in": 40,
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
				err := ValidateSchemaStrict("c4_planted", tt.msg)
				if (err != nil) != tt.wantErr {
					t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
				}
			})
		}
	})

	t.Run("c4_exploded", func(t *testing.T) {
		tests := []struct {
			name    string
			msg     map[string]interface{}
			wantErr bool
		}{
			{
				name: "valid exploded payload",
				msg: map[string]interface{}{
					"position": map[string]interface{}{
						"x": 12.0,
						"y": 0.0,
						"z": -8.0,
					},
				},
				wantErr: false,
			},
			{
				name:    "missing position",
				msg:     map[string]interface{}{},
				wantErr: true,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := ValidateSchemaStrict("c4_exploded", tt.msg)
				if (err != nil) != tt.wantErr {
					t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
				}
			})
		}
	})

	t.Run("c4_defused", func(t *testing.T) {
		tests := []struct {
			name    string
			msg     map[string]interface{}
			wantErr bool
		}{
			{
				name: "valid defused payload",
				msg: map[string]interface{}{
					"player_id": "player-123",
					"team":      "ct",
				},
				wantErr: false,
			},
			{
				name:    "missing player_id",
				msg:     map[string]interface{}{},
				wantErr: true,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := ValidateSchemaStrict("c4_defused", tt.msg)
				if (err != nil) != tt.wantErr {
					t.Errorf("ValidateSchemaStrict() error = %v, wantErr %v", err, tt.wantErr)
				}
			})
		}
	})
}

func TestGrenadeThrownSchema(t *testing.T) {
	tests := []struct {
		name    string
		msg     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid grenade event",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"type":      "flashbang",
				"position": map[string]interface{}{
					"x": 1.0,
					"y": 2.0,
					"z": 3.0,
				},
				"velocity": map[string]interface{}{
					"x": 4.0,
					"y": 5.0,
					"z": 6.0,
				},
			},
			wantErr: false,
		},
		{
			name: "invalid grenade type",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"type":      "frag",
				"position": map[string]interface{}{
					"x": 1.0,
					"y": 2.0,
					"z": 3.0,
				},
				"velocity": map[string]interface{}{
					"x": 4.0,
					"y": 5.0,
					"z": 6.0,
				},
			},
			wantErr: true,
		},
		{
			name: "missing velocity",
			msg: map[string]interface{}{
				"player_id": "player-123",
				"type":      "flashbang",
				"position": map[string]interface{}{
					"x": 1.0,
					"y": 2.0,
					"z": 3.0,
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSchemaStrict("grenade_thrown", tt.msg)
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
