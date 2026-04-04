package player

import (
	"testing"
	"time"
)

func TestPlayer_Jump(t *testing.T) {
	p := NewPlayer()

	p.Jump(DefaultConfig.JumpForce)

	// 验证跳跃
	if p.Velocity.Y != DefaultConfig.JumpForce {
		t.Errorf("Velocity.Y = %f, want %f", p.Velocity.Y, DefaultConfig.JumpForce)
	}
}

func TestPlayer_Jump_InAir(t *testing.T) {
	p := NewPlayer()

	// 第一次跳跃
	p.Jump(DefaultConfig.JumpForce)

	// 空中不能跳跃
	oldVelocity := p.Velocity.Y
	p.Jump(DefaultConfig.JumpForce)

	// 速度不应该改变
	if p.Velocity.Y != oldVelocity {
		t.Fatal("Should not jump while in air")
	}
}

func TestPlayer_SetName(t *testing.T) {
	p := NewPlayer()
	p.SetName("TestPlayer")

	if p.Name != "TestPlayer" {
		t.Errorf("Name = %s, want TestPlayer", p.Name)
	}
}

func TestPlayer_SetRotation(t *testing.T) {
	p := NewPlayer()
	p.SetRotation(1.57)

	if p.Rotation != 1.57 {
		t.Errorf("Rotation = %f, want 1.57", p.Rotation)
	}
}

func TestPlayer_Heal_Max(t *testing.T) {
	p := NewPlayer()

	// 已经满血
	remaining := p.Heal(50)

	if remaining != 100 {
		t.Errorf("Healing full health player: %d, want 100", remaining)
	}
}

func TestPlayer_Heal_Partial(t *testing.T) {
	p := NewPlayer()
	p.TakeDamage(50)

	remaining := p.Heal(30)

	if remaining != 80 {
		t.Errorf("Healing partial: %d, want 80", remaining)
	}
}

func TestPlayer_Die_WithHealth(t *testing.T) {
	p := NewPlayer()

	// 已经死亡，调用 Die 会增加死亡计数
	p.Health = 0
	p.Die()

	// 死亡数应该增加
	if p.Deaths != 1 {
		t.Errorf("Deaths = %d, want 1", p.Deaths)
	}
}

func TestPlayer_Respawn_ResetPosition(t *testing.T) {
	p := NewPlayer()
	p.SetPosition(100, 50, 100)
	p.TakeDamage(100)

	p.Respawn(0, 0, 0)

	if p.Position.X != 0 || p.Position.Y != 0 || p.Position.Z != 0 {
		t.Errorf("Position after respawn = %v, want {0, 0, 0}", p.Position)
	}
}

func TestPlayer_Respawn_ResetHealth(t *testing.T) {
	p := NewPlayer()
	p.TakeDamage(80)

	p.Respawn(0, 0, 0)

	if p.Health != 100 {
		t.Errorf("Health after respawn = %d, want 100", p.Health)
	}
}

func TestPlayer_Respawn_ResetAmmo(t *testing.T) {
	p := NewPlayer()

	// 消耗弹药
	for p.Ammo > 0 {
		p.Shoot()
	}

	p.Respawn(0, 0, 0)

	if p.Ammo != DefaultConfig.DefaultAmmo {
		t.Errorf("Ammo after respawn = %d, want %d", p.Ammo, DefaultConfig.DefaultAmmo)
	}
}

func TestPlayer_CanShoot_NoAmmo(t *testing.T) {
	p := NewPlayer()

	// 消耗所有弹药
	for p.Ammo > 0 {
		p.Shoot()
	}

	// 等待冷却
	time.Sleep(150 * time.Millisecond)

	if p.CanShoot() {
		t.Fatal("Should not be able to shoot with no ammo")
	}
}

func TestPlayer_ShootCooldown_Elapsed(t *testing.T) {
	p := NewPlayer()

	p.Shoot()
	time.Sleep(150 * time.Millisecond)

	if !p.CanShoot() {
		t.Fatal("Should be able to shoot after cooldown")
	}
}

func TestPlayer_Reload_Empty(t *testing.T) {
	p := NewPlayer()

	// 消耗所有弹药
	for p.Ammo > 0 {
		p.Shoot()
	}

	p.Reload()

	if p.Ammo != DefaultConfig.DefaultAmmo {
		t.Errorf("Ammo after reload = %d, want %d", p.Ammo, DefaultConfig.DefaultAmmo)
	}
}

func TestPlayer_Reload_NoReserve(t *testing.T) {
	p := NewPlayer()
	p.AmmoReserve = 0

	// 消耗一些弹药
	for i := 0; i < 10; i++ {
		p.Shoot()
	}

	ammoBefore := p.Ammo
	p.Reload()

	if p.Ammo != ammoBefore {
		t.Fatal("Should not reload without reserve ammo")
	}
}

func TestPlayer_AddKill_Multiple(t *testing.T) {
	p := NewPlayer()

	p.AddKill(100)
	p.AddKill(100)
	p.AddKill(150)

	if p.Kills != 3 {
		t.Errorf("Kills = %d, want 3", p.Kills)
	}
	if p.Score != 350 {
		t.Errorf("Score = %d, want 350", p.Score)
	}
}

func TestPlayer_Update(t *testing.T) {
	p := NewPlayer()

	// 设置在空中
	p.Position.Y = 10
	p.Velocity.Y = -5

	p.Update()

	// 验证重力应用（每帧减少 0.5）
	if p.Velocity.Y >= -5 {
		t.Errorf("Velocity.Y = %f, should be less than -5", p.Velocity.Y)
	}

	// 验证位置更新
	if p.Position.Y >= 10 {
		t.Errorf("Position.Y = %f, should be less than 10", p.Position.Y)
	}
}

func TestPlayer_Update_Ground(t *testing.T) {
	p := NewPlayer()
	p.Position.Y = -1

	p.Update()

	// 应该落在地面
	if p.Position.Y != 0 {
		t.Errorf("Position.Y = %f, want 0", p.Position.Y)
	}
}

func TestPlayer_ToMap_AllFields(t *testing.T) {
	p := NewPlayer()
	p.SetName("TestPlayer")
	p.SetPosition(10, 5, 20)
	p.AddKill(100)
	p.TakeDamage(30)

	m := p.ToMap()

	if m["name"] != "TestPlayer" {
		t.Error("Name should be in map")
	}
	if m["kills"] != 1 {
		t.Error("Kills should be in map")
	}
	if m["health"] != 70 {
		t.Error("Health should be in map")
	}
}

func TestNewPlayerWithConfig(t *testing.T) {
	cfg := Config{
		DefaultHealth:      150,
		DefaultAmmo:        20,
		DefaultAmmoReserve: 60,
		Speed:              10,
		JumpForce:          12,
		ShootCooldown:      50 * time.Millisecond,
	}

	p := NewPlayerWithConfig(cfg)

	if p.Health != 150 {
		t.Errorf("Health = %d, want 150", p.Health)
	}
	if p.MaxHealth != 150 {
		t.Errorf("MaxHealth = %d, want 150", p.MaxHealth)
	}
	if p.Ammo != 20 {
		t.Errorf("Ammo = %d, want 20", p.Ammo)
	}
	if p.AmmoReserve != 60 {
		t.Errorf("AmmoReserve = %d, want 60", p.AmmoReserve)
	}
}

func TestPlayer_Team(t *testing.T) {
	p := NewPlayer()
	p.Team = "red"

	if p.Team != "red" {
		t.Errorf("Team = %s, want red", p.Team)
	}
}

func TestPlayer_Weapon(t *testing.T) {
	p := NewPlayer()
	p.Weapon = "shotgun"

	if p.Weapon != "shotgun" {
		t.Errorf("Weapon = %s, want shotgun", p.Weapon)
	}
}

func TestPlayer_StartsWithMoney(t *testing.T) {
	p := NewPlayer()

	if p.GetMoney() != 800 {
		t.Fatalf("Money = %d, want 800", p.GetMoney())
	}
}

func TestPlayer_SpendAndAddMoney(t *testing.T) {
	p := NewPlayer()

	if !p.SpendMoney(650) {
		t.Fatal("SpendMoney should succeed")
	}
	if got := p.GetMoney(); got != 150 {
		t.Fatalf("Money after spend = %d, want 150", got)
	}

	if p.SpendMoney(200) {
		t.Fatal("SpendMoney should fail when funds are insufficient")
	}
	if got := p.GetMoney(); got != 150 {
		t.Fatalf("Money after failed spend = %d, want 150", got)
	}

	if got := p.AddMoney(300); got != 450 {
		t.Fatalf("AddMoney() = %d, want 450", got)
	}
}
