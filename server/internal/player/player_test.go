package player

import (
	"testing"
	"time"
)

func TestNewPlayer(t *testing.T) {
	p := NewPlayer()

	if p.ID == "" {
		t.Error("Player ID should not be empty")
	}
	if p.Health != DefaultConfig.DefaultHealth {
		t.Errorf("Health = %d, want %d", p.Health, DefaultConfig.DefaultHealth)
	}
	if p.Ammo != DefaultConfig.DefaultAmmo {
		t.Errorf("Ammo = %d, want %d", p.Ammo, DefaultConfig.DefaultAmmo)
	}
}

func TestPlayer_SetPosition(t *testing.T) {
	p := NewPlayer()
	p.SetPosition(10, 5, 20)

	if p.Position.X != 10 || p.Position.Y != 5 || p.Position.Z != 20 {
		t.Errorf("Position = %v, want {10, 5, 20}", p.Position)
	}
}

func TestPlayer_Move(t *testing.T) {
	p := NewPlayer()
	p.SetPosition(0, 0, 0)
	p.Move(5, 10)

	if p.Position.X != 5 || p.Position.Z != 10 {
		t.Errorf("Position after move = %v, want {5, 0, 10}", p.Position)
	}
}

func TestPlayer_TakeDamage(t *testing.T) {
	p := NewPlayer()

	remaining := p.TakeDamage(30)
	if remaining != 70 {
		t.Errorf("Remaining health = %d, want 70", remaining)
	}

	// 超过生命值
	remaining = p.TakeDamage(100)
	if remaining != 0 {
		t.Errorf("Remaining health = %d, want 0", remaining)
	}
}

func TestPlayer_Heal(t *testing.T) {
	p := NewPlayer()
	p.TakeDamage(50)

	remaining := p.Heal(30)
	if remaining != 80 {
		t.Errorf("Remaining health = %d, want 80", remaining)
	}

	// 超过最大生命值
	remaining = p.Heal(50)
	if remaining != 100 {
		t.Errorf("Remaining health = %d, want 100", remaining)
	}
}

func TestPlayer_IsAlive(t *testing.T) {
	p := NewPlayer()

	if !p.IsAlive() {
		t.Error("Player should be alive")
	}

	p.TakeDamage(100)
	if p.IsAlive() {
		t.Error("Player should be dead")
	}
}

func TestPlayer_Die(t *testing.T) {
	p := NewPlayer()
	p.Die()

	if p.Health != 0 {
		t.Errorf("Health = %d, want 0", p.Health)
	}
	if p.Deaths != 1 {
		t.Errorf("Deaths = %d, want 1", p.Deaths)
	}
}

func TestPlayer_Respawn(t *testing.T) {
	p := NewPlayer()
	p.TakeDamage(100)
	p.Respawn(10, 0, 20)

	if p.Health != DefaultConfig.DefaultHealth {
		t.Errorf("Health after respawn = %d, want %d", p.Health, DefaultConfig.DefaultHealth)
	}
	if p.Ammo != DefaultConfig.DefaultAmmo {
		t.Errorf("Ammo after respawn = %d, want %d", p.Ammo, DefaultConfig.DefaultAmmo)
	}
	if p.Position.X != 10 || p.Position.Z != 20 {
		t.Errorf("Position after respawn = %v, want {10, 0, 20}", p.Position)
	}
}

func TestPlayer_AddKill(t *testing.T) {
	p := NewPlayer()
	p.AddKill(100)

	if p.Kills != 1 {
		t.Errorf("Kills = %d, want 1", p.Kills)
	}
	if p.Score != 100 {
		t.Errorf("Score = %d, want 100", p.Score)
	}
}

func TestPlayer_Shoot(t *testing.T) {
	p := NewPlayer()

	// 可以射击
	if !p.CanShoot() {
		t.Error("Player should be able to shoot")
	}

	// 射击
	if !p.Shoot() {
		t.Error("Shoot should succeed")
	}
	if p.Ammo != DefaultConfig.DefaultAmmo-1 {
		t.Errorf("Ammo after shoot = %d, want %d", p.Ammo, DefaultConfig.DefaultAmmo-1)
	}

	// 消耗所有弹药
	for p.Ammo > 0 {
		p.Shoot()
	}

	// 不能射击
	if p.CanShoot() {
		t.Error("Player should not be able to shoot with no ammo")
	}
}

func TestPlayer_Reload(t *testing.T) {
	p := NewPlayer()

	// 消耗一些弹药
	for i := 0; i < 10; i++ {
		p.Shoot()
	}

	p.Reload()

	if p.Ammo != DefaultConfig.DefaultAmmo {
		t.Errorf("Ammo after reload = %d, want %d", p.Ammo, DefaultConfig.DefaultAmmo)
	}
	if p.AmmoReserve != DefaultConfig.DefaultAmmoReserve-10 {
		t.Errorf("AmmoReserve after reload = %d, want %d", p.AmmoReserve, DefaultConfig.DefaultAmmoReserve-10)
	}
}

func TestPlayer_ShootCooldown(t *testing.T) {
	p := NewPlayer()

	// 第一次射击
	p.Shoot()

	// 立即射击（冷却中）- 由于时间间隔极短，可能仍处于冷却
	time.Sleep(150 * time.Millisecond)

	// 冷却后可以射击
	if !p.CanShoot() {
		t.Error("Player should be able to shoot after cooldown")
	}
}

func TestPlayer_ConcurrentAccess(t *testing.T) {
	p := NewPlayer()

	// 并发测试
	done := make(chan bool)

	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				p.TakeDamage(1)
				p.Heal(1)
				p.SetPosition(float64(j), 0, 0)
			}
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}

	// 应该仍然健康
	if !p.IsAlive() {
		t.Error("Player should still be alive after concurrent access")
	}
}
