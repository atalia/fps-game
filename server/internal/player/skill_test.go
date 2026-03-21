package player

import (
	"testing"
	"time"
)

func TestNewSkillManager(t *testing.T) {
	sm := NewSkillManager()

	if sm == nil {
		t.Error("SkillManager should not be nil")
	}

	skills := sm.GetAllSkills()
	if len(skills) == 0 {
		t.Fatal("Should have default skills")
	}
}

func TestSkillManager_GetSkill(t *testing.T) {
	sm := NewSkillManager()

	skill := sm.GetSkill("dash")
	if skill == nil {
		t.Fatal("Should find dash skill")
	}

	if skill.Name != "冲刺" {
		t.Errorf("Skill name = %s, want 冲刺", skill.Name)
	}

	// 不存在的技能
	skill = sm.GetSkill("nonexistent")
	if skill != nil {
		t.Fatal("Should return nil for nonexistent skill")
	}
}

func TestSkillManager_CanUseSkill(t *testing.T) {
	sm := NewSkillManager()

	// 能量足够
	canUse, reason := sm.CanUseSkill("player1", "dash", 100)
	if !canUse {
		t.Errorf("Should be able to use skill, reason: %s", reason)
	}

	// 能量不足
	canUse, _ = sm.CanUseSkill("player1", "dash", 10)
	if canUse {
		t.Fatal("Should not be able to use skill (not enough energy)")
	}

	// 不存在的技能
	canUse, _ = sm.CanUseSkill("player1", "nonexistent", 100)
	if canUse {
		t.Fatal("Should not be able to use nonexistent skill")
	}
}

func TestSkillManager_UseSkill(t *testing.T) {
	sm := NewSkillManager()

	// 使用技能
	effect := sm.UseSkill("player1", "shield")

	// shield 有持续时间，应该返回 effect
	if effect == nil {
		t.Error("Shield skill should return effect")
	}

	// 检查冷却
	remaining := sm.GetCooldownRemaining("player1", "shield")
	if remaining <= 0 {
		t.Error("Skill should be on cooldown")
	}
}

func TestSkillManager_UseSkill_NoDuration(t *testing.T) {
	sm := NewSkillManager()

	// dash 没有持续时间
	effect := sm.UseSkill("player1", "dash")

	// dash 没有持续效果
	if effect != nil {
		t.Error("Dash skill should not return effect (no duration)")
	}

	// 但应该在冷却中
	remaining := sm.GetCooldownRemaining("player1", "dash")
	if remaining <= 0 {
		t.Error("Skill should be on cooldown")
	}
}

func TestSkillManager_CooldownExpiry(t *testing.T) {
	sm := NewSkillManager()

	// 使用一个短冷却技能（创建临时的）
	sm.skills["test"] = &Skill{
		ID:       "test",
		Cooldown: 100, // 100ms
	}

	sm.UseSkill("player1", "test")

	// 等待冷却
	time.Sleep(150 * time.Millisecond)

	remaining := sm.GetCooldownRemaining("player1", "test")
	if remaining != 0 {
		t.Errorf("Cooldown should be expired, remaining: %d", remaining)
	}
}

func TestSkillManager_GetActiveEffects(t *testing.T) {
	sm := NewSkillManager()

	// 使用 shield
	sm.UseSkill("player1", "shield")

	effects := sm.GetActiveEffects("player1")
	if len(effects) == 0 {
		t.Fatal("Should have active effect")
	}

	// 不存在的玩家
	effects = sm.GetActiveEffects("nonexistent")
	if len(effects) != 0 {
		t.Fatal("Should have no effects for nonexistent player")
	}
}

func TestSkillManager_GetSkillCooldowns(t *testing.T) {
	sm := NewSkillManager()

	// 使用一个技能
	sm.UseSkill("player1", "dash")

	cooldowns := sm.GetSkillCooldowns("player1")

	if cooldowns["dash"] <= 0 {
		t.Error("dash should be on cooldown")
	}

	// 其他技能应该不在冷却
	if cooldowns["heal"] != 0 {
		t.Error("heal should not be on cooldown")
	}
}

func TestSkillType_String(t *testing.T) {
	tests := []struct {
		t    SkillType
		want string
	}{
		{SkillDash, "dash"},
		{SkillHeal, "heal"},
		{SkillShield, "shield"},
		{SkillRage, "rage"},
	}

	for _, tt := range tests {
		got := tt.t.String()
		if got != tt.want {
			t.Errorf("Type %d String() = %s, want %s", tt.t, got, tt.want)
		}
	}
}
