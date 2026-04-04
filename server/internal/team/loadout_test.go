package team

import "testing"

func TestCanTeamUseWeapon_RespectsTeamRestrictions(t *testing.T) {
	if !CanTeamUseWeapon(TeamCounterTerrorists, "m4a1") {
		t.Fatal("CT should be able to use M4A1")
	}
	if CanTeamUseWeapon(TeamCounterTerrorists, "ak47") {
		t.Fatal("CT should not be able to use AK47")
	}
	if !CanTeamUseWeapon(TeamTerrorists, "ak47") {
		t.Fatal("T should be able to use AK47")
	}
	if CanTeamUseWeapon(TeamTerrorists, "m4a1") {
		t.Fatal("T should not be able to use M4A1")
	}
}

func TestCanTeamUseWeapon_SharedWeapons(t *testing.T) {
	for _, weaponID := range []string{"mp5", "p90", "awp", "deagle"} {
		if !CanTeamUseWeapon(TeamCounterTerrorists, weaponID) {
			t.Fatalf("CT should be able to use %s", weaponID)
		}
		if !CanTeamUseWeapon(TeamTerrorists, weaponID) {
			t.Fatalf("T should be able to use %s", weaponID)
		}
	}
}

func TestNormalizeWeaponID_SMGMapsToMP5(t *testing.T) {
	if got := NormalizeWeaponID(TeamCounterTerrorists, "smg"); got != "mp5" {
		t.Fatalf("NormalizeWeaponID() = %s, want mp5", got)
	}
}
