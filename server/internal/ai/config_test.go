package ai

import (
	"testing"
	"time"
)

func TestGetConfig(t *testing.T) {
	tests := []struct {
		name       string
		difficulty Difficulty
		expected   Difficulty
	}{
		{"easy", DifficultyEasy, DifficultyEasy},
		{"normal", DifficultyNormal, DifficultyNormal},
		{"hard", DifficultyHard, DifficultyHard},
		{"nightmare", DifficultyNightmare, DifficultyNightmare},
		{"invalid", "invalid", DifficultyNormal}, // 默认返回 normal
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := GetConfig(tt.difficulty)
			if cfg.Difficulty != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, cfg.Difficulty)
			}
		})
	}
}

func TestDifficultyConfigs_Values(t *testing.T) {
	// 验证各难度配置值
	tests := []struct {
		difficulty    Difficulty
		reactionTime  time.Duration
		accuracy      float64
		enableCover   bool
		enablePredict bool
	}{
		{DifficultyEasy, 800 * time.Millisecond, 0.3, false, false},
		{DifficultyNormal, 500 * time.Millisecond, 0.5, true, false},
		{DifficultyHard, 300 * time.Millisecond, 0.75, true, false},
		{DifficultyNightmare, 150 * time.Millisecond, 0.9, true, true},
	}

	for _, tt := range tests {
		t.Run(string(tt.difficulty), func(t *testing.T) {
			cfg := DifficultyConfigs[tt.difficulty]
			if cfg.ReactionTime != tt.reactionTime {
				t.Errorf("reaction time: expected %v, got %v", tt.reactionTime, cfg.ReactionTime)
			}
			if cfg.Accuracy != tt.accuracy {
				t.Errorf("accuracy: expected %v, got %v", tt.accuracy, cfg.Accuracy)
			}
			if cfg.EnableCover != tt.enableCover {
				t.Errorf("enable cover: expected %v, got %v", tt.enableCover, cfg.EnableCover)
			}
			if cfg.EnablePrediction != tt.enablePredict {
				t.Errorf("enable prediction: expected %v, got %v", tt.enablePredict, cfg.EnablePrediction)
			}
		})
	}
}
