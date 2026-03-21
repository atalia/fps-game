package hitbox

import (
	"math"
)

// RaySphereIntersect 检测射线是否与球体相交
func RaySphereIntersect(origin, direction, center Position, radius float64) bool {
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
	return discriminant >= 0
}

// CalculateDamage 计算最终伤害
func CalculateDamage(baseDamage int, hitBoxType HitBoxType, distance, weaponRange float64) int {
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

	return int(damage)
}
