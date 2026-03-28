// Package hitbox 提供命中检测功能
package hitbox

// HitBoxType 命中盒类型
type HitBoxType string

const (
	HitBoxHead HitBoxType = "head"
	HitBoxBody HitBoxType = "body"
	HitBoxArm  HitBoxType = "arm"
	HitBoxLeg  HitBoxType = "leg"
)

// HitBox 命中盒定义
type HitBox struct {
	Type   HitBoxType `json:"type"`
	Offset Position   `json:"offset"` // 相对于玩家中心
	Radius float64    `json:"radius"` // 碰撞球半径
}

// Position 3D 位置
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// DefaultHitBoxes 默认命中盒配置
var DefaultHitBoxes = []HitBox{
	{Type: HitBoxHead, Offset: Position{Y: 1.6}, Radius: 0.25},
	{Type: HitBoxBody, Offset: Position{Y: 1.0}, Radius: 0.4},
	{Type: HitBoxArm, Offset: Position{X: 0.3, Y: 1.0}, Radius: 0.15},
	{Type: HitBoxArm, Offset: Position{X: -0.3, Y: 1.0}, Radius: 0.15},
	{Type: HitBoxLeg, Offset: Position{X: 0.15, Y: 0.3}, Radius: 0.15},
	{Type: HitBoxLeg, Offset: Position{X: -0.15, Y: 0.3}, Radius: 0.15},
}

// DamageMultipliers 伤害倍率
var DamageMultipliers = map[HitBoxType]float64{
	HitBoxHead: 2.5,
	HitBoxBody: 1.0,
	HitBoxArm:  0.8,
	HitBoxLeg:  0.7,
}
