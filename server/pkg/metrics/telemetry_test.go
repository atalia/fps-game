package metrics

import (
	"testing"
	"time"
)

func TestMetrics_RecordJoin(t *testing.T) {
	m := &Metrics{
		ModeUsage:     make(map[string]int64),
		WeaponUsage:   make(map[string]int64),
		PlatformUsage: make(map[string]int64),
	}

	// Test join recording
	m.RecordJoin(true)
	m.RecordJoin(true)
	m.RecordJoin(false)

	if m.TotalJoins != 3 {
		t.Errorf("TotalJoins = %d, want 3", m.TotalJoins)
	}
	if m.JoinSuccesses != 2 {
		t.Errorf("JoinSuccesses = %d, want 2", m.JoinSuccesses)
	}
	if m.JoinFailures != 1 {
		t.Errorf("JoinFailures = %d, want 1", m.JoinFailures)
	}
}

func TestMetrics_RecordConnection(t *testing.T) {
	m := &Metrics{
		ModeUsage:     make(map[string]int64),
		WeaponUsage:   make(map[string]int64),
		PlatformUsage: make(map[string]int64),
	}

	m.RecordConnection(true)
	m.RecordConnection(true)
	m.RecordConnection(false)

	if m.ActiveConnections != 1 {
		t.Errorf("ActiveConnections = %d, want 1", m.ActiveConnections)
	}
}

func TestMetrics_RecordMatch(t *testing.T) {
	m := &Metrics{
		ModeUsage:     make(map[string]int64),
		WeaponUsage:   make(map[string]int64),
		PlatformUsage: make(map[string]int64),
	}

	m.RecordMatchStart("deathmatch")
	m.RecordMatchStart("team_deathmatch")
	m.RecordMatchEnd(5 * time.Minute)

	if m.MatchesStarted != 2 {
		t.Errorf("MatchesStarted = %d, want 2", m.MatchesStarted)
	}
	if m.MatchesCompleted != 1 {
		t.Errorf("MatchesCompleted = %d, want 1", m.MatchesCompleted)
	}
	if m.ModeUsage["deathmatch"] != 1 {
		t.Errorf("ModeUsage[deathmatch] = %d, want 1", m.ModeUsage["deathmatch"])
	}
}

func TestMetrics_RecordWeaponUse(t *testing.T) {
	m := &Metrics{
		ModeUsage:     make(map[string]int64),
		WeaponUsage:   make(map[string]int64),
		PlatformUsage: make(map[string]int64),
	}

	m.RecordWeaponUse("rifle")
	m.RecordWeaponUse("rifle")
	m.RecordWeaponUse("pistol")

	if m.WeaponUsage["rifle"] != 2 {
		t.Errorf("WeaponUsage[rifle] = %d, want 2", m.WeaponUsage["rifle"])
	}
	if m.WeaponUsage["pistol"] != 1 {
		t.Errorf("WeaponUsage[pistol] = %d, want 1", m.WeaponUsage["pistol"])
	}
}

func TestMetrics_RecordKill(t *testing.T) {
	m := &Metrics{
		ModeUsage:     make(map[string]int64),
		WeaponUsage:   make(map[string]int64),
		PlatformUsage: make(map[string]int64),
	}

	m.RecordKill(false)
	m.RecordKill(true) // headshot
	m.RecordKill(true) // headshot

	if m.TotalKills != 3 {
		t.Errorf("TotalKills = %d, want 3", m.TotalKills)
	}
	if m.HeadshotKills != 2 {
		t.Errorf("HeadshotKills = %d, want 2", m.HeadshotKills)
	}
}

func TestMetrics_Snapshot(t *testing.T) {
	m := &Metrics{
		ModeUsage:     make(map[string]int64),
		WeaponUsage:   make(map[string]int64),
		PlatformUsage: make(map[string]int64),
	}

	m.RecordJoin(true)
	m.RecordJoin(true)
	m.RecordConnection(true)
	m.RecordWeaponUse("rifle")
	m.RecordKill(true)
	m.RecordMatchStart("deathmatch")
	m.RecordMatchEnd(2 * time.Minute)

	snapshot := m.Snapshot()

	connections, ok := snapshot["connections"].(map[string]interface{})
	if !ok {
		t.Fatal("connections not found in snapshot")
	}
	if connections["total_joins"] != int64(2) {
		t.Errorf("total_joins = %v, want 2", connections["total_joins"])
	}

	gameplay, ok := snapshot["gameplay"].(map[string]interface{})
	if !ok {
		t.Fatal("gameplay not found in snapshot")
	}
	if gameplay["headshot_rate"] != 100.0 {
		t.Errorf("headshot_rate = %v, want 100", gameplay["headshot_rate"])
	}
}

func TestMetrics_Reset(t *testing.T) {
	m := &Metrics{
		ModeUsage:     make(map[string]int64),
		WeaponUsage:   make(map[string]int64),
		PlatformUsage: make(map[string]int64),
	}

	m.RecordJoin(true)
	m.RecordWeaponUse("rifle")
	m.Reset()

	if m.TotalJoins != 0 {
		t.Errorf("TotalJoins = %d after Reset, want 0", m.TotalJoins)
	}
	if len(m.WeaponUsage) != 0 {
		t.Errorf("WeaponUsage = %v after Reset, want empty", m.WeaponUsage)
	}
}

func TestGlobalMetrics(t *testing.T) {
	global := Get()
	if global == nil {
		t.Fatal("Get() returned nil")
	}

	// Reset for clean test
	global.Reset()
	global.RecordPlatform("mobile")

	if global.PlatformUsage["mobile"] != 1 {
		t.Errorf("PlatformUsage[mobile] = %d, want 1", global.PlatformUsage["mobile"])
	}
}
