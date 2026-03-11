package weapon

import "time"

// Type 武器类型
type Type string

const (
	Pistol  Type = "pistol"
	Rifle   Type = "rifle"
	Shotgun Type = "shotgun"
	Sniper  Type = "sniper"
)

// Weapon 武器接口
type Weapon interface {
	Type() Type
	Damage() int
	FireRate() time.Duration
	MagazineSize() int
	MaxAmmo() int
	Range() float64
	Recoil() float64
	Spread() float64
}

// BaseWeapon 基础武器
type BaseWeapon struct {
	weaponType   Type
	damage       int
	fireRate     time.Duration
	magazineSize int
	maxAmmo      int
	maxRange     float64
	recoil       float64
	spread       float64
}

func (w *BaseWeapon) Type() Type              { return w.weaponType }
func (w *BaseWeapon) Damage() int             { return w.damage }
func (w *BaseWeapon) FireRate() time.Duration { return w.fireRate }
func (w *BaseWeapon) MagazineSize() int       { return w.magazineSize }
func (w *BaseWeapon) MaxAmmo() int            { return w.maxAmmo }
func (w *BaseWeapon) Range() float64          { return w.maxRange }
func (w *BaseWeapon) Recoil() float64         { return w.recoil }
func (w *BaseWeapon) Spread() float64         { return w.spread }

// NewPistol 创建手枪
func NewPistol() Weapon {
	return &BaseWeapon{
		weaponType:   Pistol,
		damage:       25,
		fireRate:     300 * time.Millisecond,
		magazineSize: 12,
		maxAmmo:      48,
		maxRange:     50,
		recoil:       0.1,
		spread:       0.02,
	}
}

// NewRifle 创建步枪
func NewRifle() Weapon {
	return &BaseWeapon{
		weaponType:   Rifle,
		damage:       30,
		fireRate:     100 * time.Millisecond,
		magazineSize: 30,
		maxAmmo:      90,
		maxRange:     100,
		recoil:       0.15,
		spread:       0.03,
	}
}

// NewShotgun 创建霰弹枪
func NewShotgun() Weapon {
	return &BaseWeapon{
		weaponType:   Shotgun,
		damage:       15, // 每颗弹丸
		fireRate:     800 * time.Millisecond,
		magazineSize: 6,
		maxAmmo:      24,
		maxRange:     20,
		recoil:       0.4,
		spread:       0.15,
	}
}

// NewSniper 创建狙击枪
func NewSniper() Weapon {
	return &BaseWeapon{
		weaponType:   Sniper,
		damage:       100,
		fireRate:     1500 * time.Millisecond,
		magazineSize: 5,
		maxAmmo:      20,
		maxRange:     200,
		recoil:       0.5,
		spread:       0.01,
	}
}

// Registry 武器注册表
var Registry = map[Type]Weapon{
	Pistol:  NewPistol(),
	Rifle:   NewRifle(),
	Shotgun: NewShotgun(),
	Sniper:  NewSniper(),
}

// Get 获取武器
func Get(t Type) Weapon {
	return Registry[t]
}

// GetAll 获取所有武器
func GetAll() map[Type]Weapon {
	return Registry
}
