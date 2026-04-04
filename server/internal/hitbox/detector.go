package hitbox

import (
	"math"
)

// RaySphereIntersect 检测射线是否与球体相交，返回最近的交点距离 t
// 如果不相交或交点在射线下游（t < 0），返回 -1
func RaySphereIntersect(origin, direction, center Position, radius float64) float64 {
	// 射线方程: P = origin + t * direction
	// 球体方程: |P - center| = radius
	// 联立得: |origin + t*direction - center|^2 = radius^2
	// 展开为二次方程: a*t^2 + b*t + c = 0

	oc := Position{
		X: origin.X - center.X,
		Y: origin.Y - center.Y,
		Z: origin.Z - center.Z,
	}

	a := direction.X*direction.X + direction.Y*direction.Y + direction.Z*direction.Z
	b := 2 * (oc.X*direction.X + oc.Y*direction.Y + oc.Z*direction.Z)
	c := oc.X*oc.X + oc.Y*oc.Y + oc.Z*oc.Z - radius*radius

	discriminant := b*b - 4*a*c
	if discriminant < 0 {
		return -1
	}

	// 计算两个交点，取最近的有效交点
	sqrtDisc := math.Sqrt(discriminant)
	t1 := (-b - sqrtDisc) / (2 * a)
	t2 := (-b + sqrtDisc) / (2 * a)

	// 选择最近的有效交点 (t >= 0)
	if t1 >= 0 {
		return t1
	}
	if t2 >= 0 {
		return t2
	}
	return -1
}

// RaySphereIntersectSimple 简单版本，只判断是否相交（保持向后兼容）
func RaySphereIntersectSimple(origin, direction, center Position, radius float64) bool {
	return RaySphereIntersect(origin, direction, center, radius) >= 0
}

// CalculateDamage 计算最终伤害（带护甲减伤）
func CalculateDamage(baseDamage int, hitBoxType HitBoxType, distance, weaponRange float64, armor int, hasHelmet bool) (finalDamage int, armorDamage int) {
	// 1. 基础伤害
	damage := float64(baseDamage)

	// 2. 命中部位倍率
	if multiplier, ok := DamageMultipliers[hitBoxType]; ok {
		damage *= multiplier
	}

	// 3. 距离衰减 (超过射程后衰减到最小 30%)
	if distance > weaponRange {
		falloff := 1.0 - (distance-weaponRange)/weaponRange
		falloff = math.Max(0.3, falloff)
		damage *= falloff
	}

	// 4. 护甲减伤
	// - 头部：只有头盔能减伤 50%
	// - 身体/手臂/腿部：护甲减伤 50%
	armorDamage = 0

	if hitBoxType == HitBoxHead && hasHelmet {
		// 头盔减少 50% 头部伤害
		absorbed := damage * 0.5
		armorDamage = int(math.Min(float64(armor), absorbed))
		damage = damage - float64(armorDamage)
	} else if hitBoxType != HitBoxHead && armor > 0 {
		// 身体护甲减少 50% 伤害
		absorbed := damage * 0.5
		armorDamage = int(math.Min(float64(armor), absorbed))
		damage = damage - float64(armorDamage)
	}

	return int(damage), armorDamage
}

// CalculateDamageSimple 计算最终伤害（简化版，向后兼容）
func CalculateDamageSimple(baseDamage int, hitBoxType HitBoxType, distance, weaponRange float64) int {
	damage, _ := CalculateDamage(baseDamage, hitBoxType, distance, weaponRange, 0, false)
	return damage
}
