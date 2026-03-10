package game

import (
	"testing"
)

func TestNewPowerupManager(t *testing.T) {
	pm := NewPowerupManager()

	if pm == nil {
		t.Error("PowerupManager should not be nil")
	}

	powerups := pm.GetAllPowerups()
	if len(powerups) == 0 {
		t.Error("Should have powerups spawned")
	}
}

func TestPowerupManager_GetPowerup(t *testing.T) {
	pm := NewPowerupManager()

	powerups := pm.GetAllPowerups()
	if len(powerups) == 0 {
		t.Fatal("Should have powerups")
	}

	p := pm.GetPowerup(powerups[0].ID)
	if p == nil {
		t.Error("Should find powerup")
	}

	// 不存在的道具
	p = pm.GetPowerup("nonexistent")
	if p != nil {
		t.Error("Should return nil for nonexistent powerup")
	}
}

func TestPowerupManager_CheckPickup(t *testing.T) {
	pm := NewPowerupManager()

	powerups := pm.GetAllPowerups()
	if len(powerups) == 0 {
		t.Fatal("Should have powerups")
	}

	// 在道具位置拾取
	p := pm.CheckPickup(powerups[0].Position, 1.0)
	if p == nil {
		t.Error("Should pickup powerup")
	}

	// 道具应该变为不活跃
	if pm.GetPowerup(powerups[0].ID).Active {
		t.Error("Powerup should be inactive after pickup")
	}
}

func TestPowerupManager_CheckPickup_NotInRange(t *testing.T) {
	pm := NewPowerupManager()

	powerups := pm.GetAllPowerups()
	if len(powerups) == 0 {
		t.Fatal("Should have powerups")
	}

	// 在远处拾取
	p := pm.CheckPickup(Position{X: 1000, Y: 0, Z: 1000}, 1.0)
	if p != nil {
		t.Error("Should not pickup powerup when not in range")
	}
}

func TestPowerupManager_GetEffect(t *testing.T) {
	pm := NewPowerupManager()

	tests := []struct {
		powerupType PowerupType
		wantHealth  int
		wantAmmo    int
	}{
		{PowerupHealth, 50, 0},
		{PowerupAmmo, 0, 30},
	}

	for _, tt := range tests {
		effect := pm.GetEffect(tt.powerupType)
		if effect == nil {
			t.Errorf("Effect for type %d should not be nil", tt.powerupType)
			continue
		}

		if effect.Health != tt.wantHealth {
			t.Errorf("Health = %d, want %d", effect.Health, tt.wantHealth)
		}
		if effect.Ammo != tt.wantAmmo {
			t.Errorf("Ammo = %d, want %d", effect.Ammo, tt.wantAmmo)
		}
	}
}

func TestPowerupType_String(t *testing.T) {
	tests := []struct {
		t    PowerupType
		want string
	}{
		{PowerupHealth, "health"},
		{PowerupAmmo, "ammo"},
		{PowerupSpeed, "speed"},
		{PowerupDamage, "damage"},
		{PowerupShield, "shield"},
	}

	for _, tt := range tests {
		got := tt.t.String()
		if got != tt.want {
			t.Errorf("Type %d String() = %s, want %s", tt.t, got, tt.want)
		}
	}
}
