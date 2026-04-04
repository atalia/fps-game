package economy

import (
	"testing"

	"fps-game/internal/player"
	"fps-game/internal/team"
)

func TestApplyPurchase_DeductsMoneyAndAppliesWeapon(t *testing.T) {
	p := player.NewPlayer()
	p.SetTeam(team.TeamCounterTerrorists)
	p.SetMoney(4000)
	p.ResetOwnedWeapons(team.DefaultWeaponForTeam(team.TeamCounterTerrorists))

	item, err := ApplyPurchase(p, "m4a1")
	if err != nil {
		t.Fatalf("ApplyPurchase() error = %v", err)
	}

	if item.ID != "m4a1" {
		t.Fatalf("item.ID = %s, want m4a1", item.ID)
	}
	if got := p.GetMoney(); got != 900 {
		t.Fatalf("money = %d, want %d", got, 900)
	}
	state := p.Snapshot()
	if state.Weapon != "m4a1" {
		t.Fatalf("weapon = %s, want m4a1", state.Weapon)
	}
	if !p.HasWeapon("m4a1") {
		t.Fatal("player should own m4a1 after purchase")
	}
}

func TestApplyPurchase_RejectsWrongTeam(t *testing.T) {
	p := player.NewPlayer()
	p.SetTeam(team.TeamTerrorists)

	_, err := ApplyPurchase(p, "m4a1")
	if err == nil {
		t.Fatal("expected wrong-team error")
	}

	purchaseErr, ok := err.(*PurchaseError)
	if !ok {
		t.Fatalf("error type = %T, want *PurchaseError", err)
	}
	if purchaseErr.Code != "wrong_team" {
		t.Fatalf("error code = %s, want wrong_team", purchaseErr.Code)
	}
	if got := p.GetMoney(); got != StartMoney {
		t.Fatalf("money = %d, want %d", got, StartMoney)
	}
}

func TestApplyPurchase_RejectsInsufficientFunds(t *testing.T) {
	p := player.NewPlayer()
	p.SetTeam(team.TeamCounterTerrorists)
	p.SetMoney(500)

	_, err := ApplyPurchase(p, "famas")
	if err == nil {
		t.Fatal("expected insufficient-funds error")
	}

	purchaseErr, ok := err.(*PurchaseError)
	if !ok {
		t.Fatalf("error type = %T, want *PurchaseError", err)
	}
	if purchaseErr.Code != "insufficient_funds" {
		t.Fatalf("error code = %s, want insufficient_funds", purchaseErr.Code)
	}
	if got := p.GetMoney(); got != 500 {
		t.Fatalf("money = %d, want 500", got)
	}
}

func TestApplyPurchase_EquipmentUpdatesPlayerState(t *testing.T) {
	p := player.NewPlayer()
	p.SetTeam(team.TeamCounterTerrorists)
	p.SetMoney(2000)

	if _, err := ApplyPurchase(p, "kevlar_helmet"); err != nil {
		t.Fatalf("ApplyPurchase(kevlar_helmet) error = %v", err)
	}
	if _, err := ApplyPurchase(p, "flashbang"); err != nil {
		t.Fatalf("ApplyPurchase(flashbang) error = %v", err)
	}
	if _, err := ApplyPurchase(p, "smoke"); err != nil {
		t.Fatalf("ApplyPurchase(smoke) error = %v", err)
	}

	armor, hasHelmet := p.GetArmorState()
	if armor != 100 {
		t.Fatalf("armor = %d, want 100", armor)
	}
	if !hasHelmet {
		t.Fatal("expected helmet after kevlar_helmet purchase")
	}

	flashbangs, heGrenades, smokeGrenades := p.GetGrenadeCounts()
	if flashbangs != 1 || heGrenades != 0 || smokeGrenades != 1 {
		t.Fatalf("grenades = (%d,%d,%d), want (1,0,1)", flashbangs, heGrenades, smokeGrenades)
	}

	wantMoney := 500
	if got := p.GetMoney(); got != wantMoney {
		t.Fatalf("money = %d, want %d", got, wantMoney)
	}
}
