// Skill system - 技能系统
package player

import (
	"sync"
	"time"
)

// SkillType 技能类型
type SkillType int

const (
	SkillDash SkillType = iota
	SkillHeal
	SkillShield
	SkillSlowmo
	SkillRage
	SkillTeleport
)

// Skill 技能定义
type Skill struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Description      string    `json:"description"`
	Type             SkillType `json:"type"`
	Cooldown         int       `json:"cooldown"` // 毫秒
	EnergyCost       int       `json:"energy_cost"`
	Distance         float64   `json:"distance"`          // 冲刺距离
	HealAmount       int       `json:"heal_amount"`       // 治疗量
	ShieldAmount     int       `json:"shield_amount"`     // 护盾量
	DamageMultiplier float64   `json:"damage_multiplier"` // 伤害倍率
	SpeedMultiplier  float64   `json:"speed_multiplier"`  // 速度倍率
	Duration         int       `json:"duration"`          // 持续时间(毫秒)
}

// SkillEffect 激活的技能效果
type SkillEffect struct {
	SkillID    string    `json:"skill_id"`
	Type       SkillType `json:"type"`
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time"`
	Multiplier float64   `json:"multiplier,omitempty"`
}

// SkillManager 技能管理器
type SkillManager struct {
	skills        map[string]*Skill
	cooldowns     map[string]map[string]time.Time // playerID -> skillID -> endTime
	activeEffects map[string][]*SkillEffect       // playerID -> effects
	mu            sync.RWMutex
}

// NewSkillManager 创建技能管理器
func NewSkillManager() *SkillManager {
	sm := &SkillManager{
		skills:        make(map[string]*Skill),
		cooldowns:     make(map[string]map[string]time.Time),
		activeEffects: make(map[string][]*SkillEffect),
	}

	sm.initDefaultSkills()
	return sm
}

func (sm *SkillManager) initDefaultSkills() {
	skills := []*Skill{
		{
			ID: "dash", Name: "冲刺", Type: SkillDash,
			Cooldown: 5000, EnergyCost: 20, Distance: 10,
		},
		{
			ID: "heal", Name: "治疗", Type: SkillHeal,
			Cooldown: 15000, EnergyCost: 30, HealAmount: 50,
		},
		{
			ID: "shield", Name: "护盾", Type: SkillShield,
			Cooldown: 20000, EnergyCost: 40, ShieldAmount: 100, Duration: 5000,
		},
		{
			ID: "slowmo", Name: "子弹时间", Type: SkillSlowmo,
			Cooldown: 30000, EnergyCost: 50, Duration: 3000,
		},
		{
			ID: "rage", Name: "狂暴", Type: SkillRage,
			Cooldown: 60000, EnergyCost: 60,
			DamageMultiplier: 2, SpeedMultiplier: 1.5, Duration: 10000,
		},
		{
			ID: "teleport", Name: "瞬移", Type: SkillTeleport,
			Cooldown: 25000, EnergyCost: 35,
		},
	}

	for _, skill := range skills {
		sm.skills[skill.ID] = skill
	}
}

// GetSkill 获取技能
func (sm *SkillManager) GetSkill(id string) *Skill {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.skills[id]
}

// GetAllSkills 获取所有技能
func (sm *SkillManager) GetAllSkills() []*Skill {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	result := make([]*Skill, 0, len(sm.skills))
	for _, skill := range sm.skills {
		result = append(result, skill)
	}
	return result
}

// CanUseSkill 检查是否可以使用技能
func (sm *SkillManager) CanUseSkill(playerID, skillID string, energy int) (bool, string) {
	skill := sm.GetSkill(skillID)
	if skill == nil {
		return false, "skill_not_found"
	}

	// 检查能量
	if skill.EnergyCost > energy {
		return false, "not_enough_energy"
	}

	// 检查冷却
	sm.mu.RLock()
	playerCooldowns, exists := sm.cooldowns[playerID]
	if exists {
		endTime, onCooldown := playerCooldowns[skillID]
		if onCooldown && time.Now().Before(endTime) {
			sm.mu.RUnlock()
			return false, "on_cooldown"
		}
	}
	sm.mu.RUnlock()

	return true, ""
}

// UseSkill 使用技能
func (sm *SkillManager) UseSkill(playerID, skillID string) *SkillEffect {
	skill := sm.GetSkill(skillID)
	if skill == nil {
		return nil
	}

	// 设置冷却
	sm.mu.Lock()
	if sm.cooldowns[playerID] == nil {
		sm.cooldowns[playerID] = make(map[string]time.Time)
	}
	sm.cooldowns[playerID][skillID] = time.Now().Add(time.Duration(skill.Cooldown) * time.Millisecond)
	sm.mu.Unlock()

	// 创建效果
	if skill.Duration > 0 {
		effect := &SkillEffect{
			SkillID:   skillID,
			Type:      skill.Type,
			StartTime: time.Now(),
			EndTime:   time.Now().Add(time.Duration(skill.Duration) * time.Millisecond),
		}

		sm.mu.Lock()
		sm.activeEffects[playerID] = append(sm.activeEffects[playerID], effect)
		sm.mu.Unlock()

		return effect
	}

	return nil
}

// GetCooldownRemaining 获取冷却剩余时间
func (sm *SkillManager) GetCooldownRemaining(playerID, skillID string) int {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	playerCooldowns, exists := sm.cooldowns[playerID]
	if !exists {
		return 0
	}

	endTime, onCooldown := playerCooldowns[skillID]
	if !onCooldown {
		return 0
	}

	remaining := time.Until(endTime).Milliseconds()
	if remaining < 0 {
		return 0
	}
	return int(remaining)
}

// GetActiveEffects 获取玩家的活跃效果
func (sm *SkillManager) GetActiveEffects(playerID string) []*SkillEffect {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	effects := sm.activeEffects[playerID]
	if effects == nil {
		return []*SkillEffect{}
	}

	// 过滤过期效果
	now := time.Now()
	active := make([]*SkillEffect, 0)
	for _, effect := range effects {
		if now.Before(effect.EndTime) {
			active = append(active, effect)
		}
	}

	sm.activeEffects[playerID] = active
	return active
}

// GetSkillCooldowns 获取玩家所有技能冷却状态
func (sm *SkillManager) GetSkillCooldowns(playerID string) map[string]int {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	result := make(map[string]int)
	for skillID := range sm.skills {
		remaining := 0
		if playerCooldowns, exists := sm.cooldowns[playerID]; exists {
			if endTime, onCooldown := playerCooldowns[skillID]; onCooldown {
				remaining = int(time.Until(endTime).Milliseconds())
				if remaining < 0 {
					remaining = 0
				}
			}
		}
		result[skillID] = remaining
	}

	return result
}

// SkillTypeString 获取技能类型名称
func (t SkillType) String() string {
	names := map[SkillType]string{
		SkillDash:     "dash",
		SkillHeal:     "heal",
		SkillShield:   "shield",
		SkillSlowmo:   "slowmo",
		SkillRage:     "rage",
		SkillTeleport: "teleport",
	}
	return names[t]
}
