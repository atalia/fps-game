// Package ai 提供 AI 机器人功能
package ai

import "time"

// Difficulty 难度等级
type Difficulty string

const (
	DifficultyEasy      Difficulty = "easy"
	DifficultyNormal    Difficulty = "normal"
	DifficultyHard      Difficulty = "hard"
	DifficultyNightmare Difficulty = "nightmare"
)

// Config AI 配置
type Config struct {
	Difficulty       Difficulty
	ReactionTime     time.Duration // 反应时间
	Accuracy         float64       // 准度 (0-1)
	DecisionRate     time.Duration // 决策频率
	EnableCover      bool          // 启用掩护行为
	EnablePrediction bool          // 启用预判射击
}

// DifficultyConfigs 各难度配置
var DifficultyConfigs = map[Difficulty]Config{
	DifficultyEasy: {
		Difficulty:   DifficultyEasy,
		ReactionTime: 800 * time.Millisecond,
		Accuracy:     0.3,
		DecisionRate: 1000 * time.Millisecond,
		EnableCover:  false,
	},
	DifficultyNormal: {
		Difficulty:   DifficultyNormal,
		ReactionTime: 500 * time.Millisecond,
		Accuracy:     0.5,
		DecisionRate: 500 * time.Millisecond,
		EnableCover:  true,
	},
	DifficultyHard: {
		Difficulty:   DifficultyHard,
		ReactionTime: 300 * time.Millisecond,
		Accuracy:     0.75,
		DecisionRate: 250 * time.Millisecond,
		EnableCover:  true,
	},
	DifficultyNightmare: {
		Difficulty:       DifficultyNightmare,
		ReactionTime:     150 * time.Millisecond,
		Accuracy:         0.9,
		DecisionRate:     100 * time.Millisecond,
		EnableCover:      true,
		EnablePrediction: true,
	},
}

// GetConfig 获取难度配置
func GetConfig(d Difficulty) Config {
	if cfg, ok := DifficultyConfigs[d]; ok {
		return cfg
	}
	return DifficultyConfigs[DifficultyNormal]
}
