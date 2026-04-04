package hitbox

import (
	"testing"
)

func TestRaySphereIntersect_Hit(t *testing.T) {
	// 射线从原点沿 X 轴射向 (5, 0, 0) 的球体
	origin := Position{X: 0, Y: 0, Z: 0}
	direction := Position{X: 1, Y: 0, Z: 0}
	center := Position{X: 5, Y: 0, Z: 0}
	radius := 1.0

	tval := RaySphereIntersect(origin, direction, center, radius)
	if tval < 0 {
		t.Error("expected ray to intersect sphere")
	}
}

func TestRaySphereIntersect_Miss(t *testing.T) {
	// 射线从原点沿 X 轴，球体在 Y=5 处
	origin := Position{X: 0, Y: 0, Z: 0}
	direction := Position{X: 1, Y: 0, Z: 0}
	center := Position{X: 5, Y: 5, Z: 0}
	radius := 1.0

	tval := RaySphereIntersect(origin, direction, center, radius)
	if tval >= 0 {
		t.Error("expected ray to miss sphere")
	}
}

func TestRaySphereIntersect_Tangent(t *testing.T) {
	// 射线与球体相切
	origin := Position{X: 0, Y: 1, Z: 0}
	direction := Position{X: 1, Y: 0, Z: 0}
	center := Position{X: 5, Y: 0, Z: 0}
	radius := 1.0

	tval := RaySphereIntersect(origin, direction, center, radius)
	if tval < 0 {
		t.Error("expected ray to be tangent to sphere")
	}
}

func TestCalculateDamage_Headshot(t *testing.T) {
	baseDamage := 40
	distance := 10.0
	weaponRange := 50.0

	damage, armorDmg := CalculateDamage(baseDamage, HitBoxHead, distance, weaponRange, 0, false)

	expected := int(float64(baseDamage) * DamageMultipliers[HitBoxHead])
	if damage != expected {
		t.Errorf("expected %d, got %d", expected, damage)
	}
	if armorDmg != 0 {
		t.Errorf("expected 0 armor damage, got %d", armorDmg)
	}
}

func TestCalculateDamage_Body(t *testing.T) {
	baseDamage := 40
	distance := 10.0
	weaponRange := 50.0

	damage, armorDmg := CalculateDamage(baseDamage, HitBoxBody, distance, weaponRange, 0, false)

	if damage != baseDamage {
		t.Errorf("expected %d, got %d", baseDamage, damage)
	}
	if armorDmg != 0 {
		t.Errorf("expected 0 armor damage, got %d", armorDmg)
	}
}

func TestCalculateDamage_DistanceFalloff(t *testing.T) {
	baseDamage := 40
	distance := 75.0 // 超出射程
	weaponRange := 50.0

	damage, _ := CalculateDamage(baseDamage, HitBoxBody, distance, weaponRange, 0, false)

	// 应该有衰减
	if damage >= baseDamage {
		t.Error("expected damage to be reduced due to distance falloff")
	}
}

func TestCalculateDamage_MinimumDamage(t *testing.T) {
	baseDamage := 40
	distance := 200.0 // 远超射程
	weaponRange := 50.0

	damage, _ := CalculateDamage(baseDamage, HitBoxBody, distance, weaponRange, 0, false)

	// 最小伤害应该是基础伤害的 30%
	minDamage := int(float64(baseDamage) * 0.3)
	if damage < minDamage {
		t.Errorf("expected minimum damage %d, got %d", minDamage, damage)
	}
}

func TestCalculateDamage_Arm(t *testing.T) {
	baseDamage := 50
	distance := 20.0
	weaponRange := 50.0

	damage, _ := CalculateDamage(baseDamage, HitBoxArm, distance, weaponRange, 0, false)

	expected := int(float64(baseDamage) * DamageMultipliers[HitBoxArm])
	if damage != expected {
		t.Errorf("expected %d, got %d", expected, damage)
	}
}

func TestCalculateDamage_Leg(t *testing.T) {
	baseDamage := 50
	distance := 20.0
	weaponRange := 50.0

	damage, _ := CalculateDamage(baseDamage, HitBoxLeg, distance, weaponRange, 0, false)

	expected := int(float64(baseDamage) * DamageMultipliers[HitBoxLeg])
	if damage != expected {
		t.Errorf("expected %d, got %d", expected, damage)
	}
}

// 护甲测试

func TestCalculateDamage_ArmorReducesBodyDamage(t *testing.T) {
	baseDamage := 40
	distance := 10.0
	weaponRange := 50.0
	armor := 100

	damage, armorDmg := CalculateDamage(baseDamage, HitBoxBody, distance, weaponRange, armor, false)

	// 护甲应减少 50% 伤害
	expected := baseDamage / 2
	if damage != expected {
		t.Errorf("expected %d damage with armor, got %d", expected, damage)
	}
	// 护甲损耗应等于吸收的伤害
	if armorDmg != expected {
		t.Errorf("expected %d armor damage, got %d", expected, armorDmg)
	}
}

func TestCalculateDamage_HelmetReducesHeadshot(t *testing.T) {
	baseDamage := 40
	distance := 10.0
	weaponRange := 50.0

	// 无头盔
	damageNoHelmet, _ := CalculateDamage(baseDamage, HitBoxHead, distance, weaponRange, 0, false)
	expectedNoHelmet := int(float64(baseDamage) * 2.5) // 100
	if damageNoHelmet != expectedNoHelmet {
		t.Errorf("expected %d headshot without helmet, got %d", expectedNoHelmet, damageNoHelmet)
	}

	// 有头盔
	damageWithHelmet, armorDmg := CalculateDamage(baseDamage, HitBoxHead, distance, weaponRange, 100, true)
	// 头盔减伤 50%
	if damageWithHelmet >= damageNoHelmet {
		t.Error("expected helmet to reduce headshot damage")
	}
	if armorDmg <= 0 {
		t.Error("expected armor to be consumed")
	}
}

func TestCalculateDamage_ArmorDoesNotReduceHeadshotWithoutHelmet(t *testing.T) {
	baseDamage := 40
	distance := 10.0
	weaponRange := 50.0

	// 有护甲但无头盔 - 头部伤害不减
	damage, armorDmg := CalculateDamage(baseDamage, HitBoxHead, distance, weaponRange, 100, false)

	expected := int(float64(baseDamage) * 2.5)
	if damage != expected {
		t.Errorf("expected %d headshot damage (no helmet), got %d", expected, damage)
	}
	if armorDmg != 0 {
		t.Errorf("expected 0 armor damage, got %d", armorDmg)
	}
}

func TestCalculateDamage_ArmorLimitedByAmount(t *testing.T) {
	baseDamage := 100
	distance := 10.0
	weaponRange := 50.0
	armor := 10 // 只有 10 点护甲

	damage, armorDmg := CalculateDamage(baseDamage, HitBoxBody, distance, weaponRange, armor, false)

	// 护甲只能吸收 10 点伤害
	if armorDmg != 10 {
		t.Errorf("expected 10 armor damage, got %d", armorDmg)
	}
	// 实际伤害 = 100 - 10 = 90
	if damage != 90 {
		t.Errorf("expected 90 damage, got %d", damage)
	}
}

func TestCalculateDamageSimple_BackwardCompatible(t *testing.T) {
	baseDamage := 40
	distance := 10.0
	weaponRange := 50.0

	damage := CalculateDamageSimple(baseDamage, HitBoxHead, distance, weaponRange)

	expected := int(float64(baseDamage) * DamageMultipliers[HitBoxHead])
	if damage != expected {
		t.Errorf("expected %d, got %d", expected, damage)
	}
}
