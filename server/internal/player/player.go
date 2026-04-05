package player

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"
)

// Position 3D 位置
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// HitBox 命中盒定义
type HitBox struct {
	Type   string   `json:"type"`
	Offset Position `json:"offset"`
	Radius float64  `json:"radius"`
}

// Player 玩家
type Player struct {
	ID             string               `json:"id"`
	Name           string               `json:"name"`
	Position       Position             `json:"position"`
	Rotation       float64              `json:"rotation"` // Y 轴旋转
	Velocity       Position             `json:"-"`
	Health         int                  `json:"health"`
	MaxHealth      int                  `json:"max_health"`
	Money          int                  `json:"money"`
	Score          int                  `json:"score"`
	Kills          int                  `json:"kills"`
	Deaths         int                  `json:"deaths"`
	Team           string               `json:"team"`
	Weapon         string               `json:"weapon"`
	Armor          int                  `json:"armor"`
	HasHelmet      bool                 `json:"has_helmet"`
	HasDefuseKit   bool                 `json:"has_defuse_kit"`
	Flashbangs     int                  `json:"flashbangs"`
	HEGrenades     int                  `json:"he_grenades"`
	SmokeGrenades  int                  `json:"smoke_grenades"`
	Ammo           int                  `json:"ammo"`
	AmmoReserve    int                  `json:"ammo_reserve"`
	MaxAmmo        int                  `json:"max_ammo"`
	LastShot       time.Time            `json:"-"`
	SkillCooldowns map[string]time.Time `json:"-"`
	Connected      bool                 `json:"-"`
	HitBoxes       []HitBox             `json:"hit_boxes"`
	OwnedWeapons   map[string]bool      `json:"-"`
	mu             sync.RWMutex
}

// Snapshot 玩家状态快照
type Snapshot struct {
	Position    Position
	Rotation    float64
	Health      int
	MaxHealth   int
	Money       int
	Team        string
	Weapon      string
	Armor       int
	HasHelmet   bool
	Ammo        int
	AmmoReserve int
}

// Config 玩家配置
type Config struct {
	DefaultHealth      int
	DefaultAmmo        int
	DefaultAmmoReserve int
	DefaultMoney       int
	Speed              float64
	JumpForce          float64
	ShootCooldown      time.Duration
}

// DefaultConfig 默认配置
var DefaultConfig = Config{
	DefaultHealth:      100,
	DefaultAmmo:        30,
	DefaultAmmoReserve: 90,
	DefaultMoney:       800,
	Speed:              5.0,
	JumpForce:          8.0,
	ShootCooldown:      100 * time.Millisecond,
}

// NewPlayer 创建玩家
func NewPlayer() *Player {
	return NewPlayerWithConfig(DefaultConfig)
}

// DefaultHitBoxes 默认命中盒配置
var DefaultHitBoxes = []HitBox{
	{Type: "head", Offset: Position{Y: 1.6}, Radius: 0.25},
	{Type: "body", Offset: Position{Y: 1.0}, Radius: 0.4},
	{Type: "arm", Offset: Position{X: 0.3, Y: 1.0}, Radius: 0.15},
	{Type: "arm", Offset: Position{X: -0.3, Y: 1.0}, Radius: 0.15},
	{Type: "leg", Offset: Position{X: 0.15, Y: 0.3}, Radius: 0.15},
	{Type: "leg", Offset: Position{X: -0.15, Y: 0.3}, Radius: 0.15},
}

// NewPlayerWithConfig 使用配置创建玩家
func NewPlayerWithConfig(cfg Config) *Player {
	return &Player{
		ID:             generateID(),
		Health:         cfg.DefaultHealth,
		MaxHealth:      cfg.DefaultHealth,
		Money:          cfg.DefaultMoney,
		Score:          0,
		Kills:          0,
		Deaths:         0,
		Weapon:         "rifle",
		Ammo:           cfg.DefaultAmmo,
		AmmoReserve:    cfg.DefaultAmmoReserve,
		MaxAmmo:        cfg.DefaultAmmo,
		SkillCooldowns: make(map[string]time.Time),
		Connected:      true,
		HitBoxes:       DefaultHitBoxes,
		OwnedWeapons:   make(map[string]bool),
	}
}

// SetName 设置名字
func (p *Player) SetName(name string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Name = name
}

// SetPosition 设置位置
func (p *Player) SetPosition(x, y, z float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Position.X = x
	p.Position.Y = y
	p.Position.Z = z
}

// SetRotation 设置旋转
func (p *Player) SetRotation(rot float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Rotation = rot
}

// Move 移动
func (p *Player) Move(dx, dz float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Position.X += dx
	p.Position.Z += dz
}

// Jump 跳跃
func (p *Player) Jump(force float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.Position.Y <= 0 {
		p.Velocity.Y = force
	}
}

// Update 更新状态
func (p *Player) Update() {
	p.mu.Lock()
	defer p.mu.Unlock()

	// 应用重力
	p.Velocity.Y -= 0.5 // 简化重力
	p.Position.Y += p.Velocity.Y

	// 地面检测
	if p.Position.Y <= 0 {
		p.Position.Y = 0
		p.Velocity.Y = 0
	}
}

// TakeDamage 受伤
func (p *Player) TakeDamage(damage int) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Health -= damage
	if p.Health < 0 {
		p.Health = 0
	}
	return p.Health
}

// Heal 治疗
func (p *Player) Heal(amount int) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Health += amount
	if p.Health > p.MaxHealth {
		p.Health = p.MaxHealth
	}
	return p.Health
}

// IsAlive 是否存活
func (p *Player) IsAlive() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Health > 0
}

// Die 死亡
func (p *Player) Die() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Health = 0
	p.Deaths++
}

// Respawn 重生
func (p *Player) Respawn(x, y, z float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Health = p.MaxHealth
	p.Ammo = p.MaxAmmo
	p.Position = Position{X: x, Y: y, Z: z}
}

// AddKill 添加击杀
func (p *Player) AddKill(points int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Kills++
	p.Score += points
}

// CanShoot 是否可以射击
func (p *Player) CanShoot() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Ammo > 0 && time.Since(p.LastShot) >= DefaultConfig.ShootCooldown
}

// Shoot 射击
func (p *Player) Shoot() bool {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.Ammo <= 0 {
		return false
	}

	p.Ammo--
	p.LastShot = time.Now()
	return true
}

// GetAmmo 线程安全地获取当前弹药
func (p *Player) GetAmmo() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Ammo
}

// Reload 换弹
func (p *Player) Reload() {
	p.mu.Lock()
	defer p.mu.Unlock()

	needed := DefaultConfig.DefaultAmmo - p.Ammo
	if p.MaxAmmo > 0 {
		needed = p.MaxAmmo - p.Ammo
	}
	if needed <= 0 || p.AmmoReserve <= 0 {
		return
	}

	toReload := needed
	if toReload > p.AmmoReserve {
		toReload = p.AmmoReserve
	}

	p.Ammo += toReload
	p.AmmoReserve -= toReload
}

// ToMap 转换为 map
func (p *Player) ToMap() map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return map[string]interface{}{
		"id":       p.ID,
		"name":     p.Name,
		"position": p.Position,
		"rotation": p.Rotation,
		"health":   p.Health,
		"money":    p.Money,
		"score":    p.Score,
		"kills":    p.Kills,
		"deaths":   p.Deaths,
		"team":     p.Team,
		"weapon":   p.Weapon,
		"ammo":     p.Ammo,
	}
}

// Snapshot 返回玩家状态快照
func (p *Player) Snapshot() Snapshot {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return Snapshot{
		Position:    p.Position,
		Rotation:    p.Rotation,
		Health:      p.Health,
		MaxHealth:   p.MaxHealth,
		Money:       p.Money,
		Team:        p.Team,
		Weapon:      p.Weapon,
		Armor:       p.Armor,
		HasHelmet:   p.HasHelmet,
		Ammo:        p.Ammo,
		AmmoReserve: p.AmmoReserve,
	}
}

func generateID() string {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		// 如果随机数生成失败，使用时间戳作为备选
		return fmt.Sprintf("%x", time.Now().UnixNano())[:8]
	}
	return hex.EncodeToString(b)
}

// SetWeapon 设置武器
func (p *Player) SetWeapon(weapon string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Weapon = weapon
}

// ApplyLoadout 用武器配置原子性地更新玩家当前装备。
func (p *Player) ApplyLoadout(weapon string, magSize, reserve int) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.Weapon = weapon
	p.MaxAmmo = magSize
	p.Ammo = magSize
	p.AmmoReserve = reserve
	if p.OwnedWeapons == nil {
		p.OwnedWeapons = make(map[string]bool)
	}
	if normalized := normalizeWeaponID(weapon); normalized != "" {
		p.OwnedWeapons[normalized] = true
	}
}

// SetTeam 设置队伍
func (p *Player) SetTeam(team string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Team = team
}

// GetTeam 获取队伍
func (p *Player) GetTeam() string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Team
}

func (p *Player) GetMoney() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Money
}

func (p *Player) SetMoney(amount int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if amount < 0 {
		amount = 0
	}
	p.Money = amount
}

func (p *Player) AddMoney(amount int) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Money += amount
	if p.Money < 0 {
		p.Money = 0
	}
	return p.Money
}

func (p *Player) SpendMoney(amount int) bool {
	if amount <= 0 {
		return true
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	if p.Money < amount {
		return false
	}
	p.Money -= amount
	return true
}

func (p *Player) SetArmor(armor int, hasHelmet bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if armor < 0 {
		armor = 0
	}
	p.Armor = armor
	p.HasHelmet = hasHelmet
}

func (p *Player) GetArmorState() (int, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Armor, p.HasHelmet
}

func (p *Player) SetDefuseKit(hasKit bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.HasDefuseKit = hasKit
}

func (p *Player) GetDefuseKit() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.HasDefuseKit
}

func (p *Player) AddGrenade(grenadeType string, count int) {
	if count <= 0 {
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	switch strings.ToLower(strings.TrimSpace(grenadeType)) {
	case "flashbang", "flash":
		p.Flashbangs += count
	case "he_grenade", "he":
		p.HEGrenades += count
	case "smoke":
		p.SmokeGrenades += count
	}
}

func (p *Player) GetGrenadeCounts() (int, int, int) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Flashbangs, p.HEGrenades, p.SmokeGrenades
}

func (p *Player) ResetOwnedWeapons(weapons ...string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.OwnedWeapons = make(map[string]bool, len(weapons))
	for _, weapon := range weapons {
		if normalized := normalizeWeaponID(weapon); normalized != "" {
			p.OwnedWeapons[normalized] = true
		}
	}
}

func (p *Player) GrantWeapon(weapon string) {
	normalized := normalizeWeaponID(weapon)
	if normalized == "" {
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	if p.OwnedWeapons == nil {
		p.OwnedWeapons = make(map[string]bool)
	}
	p.OwnedWeapons[normalized] = true
}

func (p *Player) HasWeapon(weapon string) bool {
	normalized := normalizeWeaponID(weapon)
	if normalized == "" {
		return false
	}

	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.OwnedWeapons[normalized]
}

func normalizeWeaponID(weapon string) string {
	return strings.ToLower(strings.TrimSpace(weapon))
}

// SkillConfig 技能配置
var SkillCooldowns = map[string]time.Duration{
	"heal":     30 * time.Second,
	"speed":    20 * time.Second,
	"shield":   45 * time.Second,
	"teleport": 60 * time.Second,
	"scan":     25 * time.Second,
	"drone":    40 * time.Second,
	"smoke":    15 * time.Second,
	"flash":    20 * time.Second,
}

// CanUseSkill 是否可以使用技能
func (p *Player) CanUseSkill(skillID string) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()

	cooldown, exists := SkillCooldowns[skillID]
	if !exists {
		return false
	}

	lastUsed, used := p.SkillCooldowns[skillID]
	if !used {
		return true
	}

	return time.Since(lastUsed) >= cooldown
}

// UseSkill 使用技能
func (p *Player) UseSkill(skillID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.SkillCooldowns[skillID] = time.Now()
}

// GetSkillCooldown 获取技能剩余冷却时间
func (p *Player) GetSkillCooldown(skillID string) time.Duration {
	p.mu.RLock()
	defer p.mu.RUnlock()

	cooldown, exists := SkillCooldowns[skillID]
	if !exists {
		return 0
	}

	lastUsed, used := p.SkillCooldowns[skillID]
	if !used {
		return 0
	}

	remaining := cooldown - time.Since(lastUsed)
	if remaining < 0 {
		return 0
	}
	return remaining
}
