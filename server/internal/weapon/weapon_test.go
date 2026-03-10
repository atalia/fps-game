package weapon

import (
	"testing"
	"time"
)

func TestNewPistol(t *testing.T) {
	w := NewPistol()

	if w.Type() != Pistol {
		t.Errorf("Type = %v, want %v", w.Type(), Pistol)
	}
	if w.Damage() != 25 {
		t.Errorf("Damage = %d, want 25", w.Damage())
	}
	if w.FireRate() != 300*time.Millisecond {
		t.Errorf("FireRate = %v, want 300ms", w.FireRate())
	}
	if w.MagazineSize() != 12 {
		t.Errorf("MagazineSize = %d, want 12", w.MagazineSize())
	}
}

func TestNewRifle(t *testing.T) {
	w := NewRifle()

	if w.Type() != Rifle {
		t.Errorf("Type = %v, want %v", w.Type(), Rifle)
	}
	if w.Damage() != 30 {
		t.Errorf("Damage = %d, want 30", w.Damage())
	}
	if w.FireRate() != 100*time.Millisecond {
		t.Errorf("FireRate = %v, want 100ms", w.FireRate())
	}
	if w.MagazineSize() != 30 {
		t.Errorf("MagazineSize = %d, want 30", w.MagazineSize())
	}
}

func TestNewShotgun(t *testing.T) {
	w := NewShotgun()

	if w.Type() != Shotgun {
		t.Errorf("Type = %v, want %v", w.Type(), Shotgun)
	}
	if w.Damage() != 15 {
		t.Errorf("Damage = %d, want 15", w.Damage())
	}
	if w.FireRate() != 800*time.Millisecond {
		t.Errorf("FireRate = %v, want 800ms", w.FireRate())
	}
	if w.MagazineSize() != 6 {
		t.Errorf("MagazineSize = %d, want 6", w.MagazineSize())
	}
}

func TestNewSniper(t *testing.T) {
	w := NewSniper()

	if w.Type() != Sniper {
		t.Errorf("Type = %v, want %v", w.Type(), Sniper)
	}
	if w.Damage() != 100 {
		t.Errorf("Damage = %d, want 100", w.Damage())
	}
	if w.FireRate() != 1500*time.Millisecond {
		t.Errorf("FireRate = %v, want 1500ms", w.FireRate())
	}
	if w.MagazineSize() != 5 {
		t.Errorf("MagazineSize = %d, want 5", w.MagazineSize())
	}
}

func TestGet(t *testing.T) {
	tests := []struct {
		weaponType Type
		wantNil    bool
	}{
		{Pistol, false},
		{Rifle, false},
		{Shotgun, false},
		{Sniper, false},
		{"unknown", true},
	}

	for _, tt := range tests {
		t.Run(string(tt.weaponType), func(t *testing.T) {
			w := Get(tt.weaponType)
			if (w == nil) != tt.wantNil {
				t.Errorf("Get(%v) nil = %v, want %v", tt.weaponType, w == nil, tt.wantNil)
			}
		})
	}
}

func TestGetAll(t *testing.T) {
	weapons := GetAll()

	if len(weapons) != 4 {
		t.Errorf("GetAll() returned %d weapons, want 4", len(weapons))
	}

	for _, wt := range []Type{Pistol, Rifle, Shotgun, Sniper} {
		if _, ok := weapons[wt]; !ok {
			t.Errorf("GetAll() missing weapon type %v", wt)
		}
	}
}

func TestWeaponStats(t *testing.T) {
	tests := []struct {
		name      string
		weapon    Weapon
		maxRange  float64
		recoil    float64
		spread    float64
	}{
		{"Pistol", NewPistol(), 50, 0.1, 0.02},
		{"Rifle", NewRifle(), 100, 0.15, 0.03},
		{"Shotgun", NewShotgun(), 20, 0.4, 0.15},
		{"Sniper", NewSniper(), 200, 0.5, 0.01},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.weapon.Range() != tt.maxRange {
				t.Errorf("Range = %f, want %f", tt.weapon.Range(), tt.maxRange)
			}
			if tt.weapon.Recoil() != tt.recoil {
				t.Errorf("Recoil = %f, want %f", tt.weapon.Recoil(), tt.recoil)
			}
			if tt.weapon.Spread() != tt.spread {
				t.Errorf("Spread = %f, want %f", tt.weapon.Spread(), tt.spread)
			}
		})
	}
}
