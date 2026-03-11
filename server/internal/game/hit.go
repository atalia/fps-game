package game

import (
	"math"
	"math/rand"
	"sync"

	"fps-game/internal/player"
	"fps-game/internal/weapon"
)

// HitResult 命中结果
type HitResult struct {
	Hit      bool    `json:"hit"`
	TargetID string  `json:"target_id,omitempty"`
	Damage   int     `json:"damage,omitempty"`
	Distance float64 `json:"distance,omitempty"`
	Headshot bool    `json:"headshot,omitempty"`
}

// HitDetector 命中检测器
type HitDetector struct {
	mapSize float64
	mu      sync.RWMutex
}

// NewHitDetector 创建命中检测器
func NewHitDetector(mapSize float64) *HitDetector {
	return &HitDetector{
		mapSize: mapSize,
	}
}

// DetectHit 检测命中
func (h *HitDetector) DetectHit(
	shooterPos player.Position,
	shooterRot float64,
	targets map[string]*player.Player,
	w weapon.Weapon,
) []HitResult {
	results := []HitResult{}

	for id, target := range targets {
		if !target.IsAlive() {
			continue
		}

		result := h.checkSingleTarget(shooterPos, shooterRot, target, w)
		if result.Hit {
			results = append(results, HitResult{
				Hit:      true,
				TargetID: id,
				Damage:   result.Damage,
				Distance: result.Distance,
				Headshot: result.Headshot,
			})
		}
	}

	return results
}

type singleHitResult struct {
	Hit      bool
	Damage   int
	Distance float64
	Headshot bool
}

func (h *HitDetector) checkSingleTarget(
	shooterPos player.Position,
	shooterRot float64,
	target *player.Player,
	w weapon.Weapon,
) singleHitResult {
	targetPos := target.Position

	// 计算距离
	distance := math.Sqrt(
		(targetPos.X-shooterPos.X)*(targetPos.X-shooterPos.X) +
			(targetPos.Z-shooterPos.Z)*(targetPos.Z-shooterPos.Z),
	)

	// 超出射程
	if distance > w.Range() {
		return singleHitResult{Hit: false}
	}

	// 计算射线方向
	dirX := math.Sin(shooterRot)
	dirZ := math.Cos(shooterRot)

	// 计算目标相对位置
	dx := targetPos.X - shooterPos.X
	dz := targetPos.Z - shooterPos.Z

	// 计算夹角
	if distance > 0 {
		dot := (dx*dirX + dz*dirZ) / distance
		angle := math.Acos(dot)

		// 考虑散布
		spread := w.Spread()
		playerRadius := 0.5 // 玩家碰撞体半径

		// 如果角度在散布范围内，命中
		if angle < spread+math.Atan2(playerRadius, distance) {
			// 计算伤害（考虑距离衰减）
			damage := h.calculateDamage(w, distance)

			// 检查爆头（简化：高度差）
			headshot := math.Abs(targetPos.Y-shooterPos.Y) > 1.0

			if headshot {
				damage = int(float64(damage) * 1.5)
			}

			return singleHitResult{
				Hit:      true,
				Damage:   damage,
				Distance: distance,
				Headshot: headshot,
			}
		}
	}

	return singleHitResult{Hit: false}
}

// calculateDamage 计算伤害（考虑距离衰减）
func (h *HitDetector) calculateDamage(w weapon.Weapon, distance float64) int {
	baseDamage := w.Damage()

	// 距离衰减
	if distance > w.Range()*0.5 {
		falloff := 1.0 - (distance-w.Range()*0.5)/(w.Range()*0.5)
		if falloff < 0.3 {
			falloff = 0.3
		}
		baseDamage = int(float64(baseDamage) * falloff)
	}

	return baseDamage
}

// ApplyDamage 应用伤害
func (h *HitDetector) ApplyDamage(target *player.Player, damage int) int {
	return target.TakeDamage(damage)
}

// ShotgunHit 霰弹枪命中检测（多发弹丸）
func (h *HitDetector) ShotgunHit(
	shooterPos player.Position,
	shooterRot float64,
	targets map[string]*player.Player,
	pelletCount int,
) []HitResult {
	results := []HitResult{}
	w := weapon.NewShotgun()

	for i := 0; i < pelletCount; i++ {
		// 每颗弹丸有随机散布
		spread := w.Spread()
		randomAngle := shooterRot + (rand.Float64()-0.5)*spread*2

		for id, target := range targets {
			if !target.IsAlive() {
				continue
			}

			result := h.checkSingleTarget(shooterPos, randomAngle, target, w)
			if result.Hit {
				results = append(results, HitResult{
					Hit:      true,
					TargetID: id,
					Damage:   result.Damage,
					Distance: result.Distance,
				})
			}
		}
	}

	return results
}
