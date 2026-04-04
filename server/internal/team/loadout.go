package team

import "strings"

// WeaponLoadout 是服务端需要的简化武器定义。
type WeaponLoadout struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Damage       int     `json:"damage"`
	Range        float64 `json:"range"`
	MagazineSize int     `json:"magazine_size"`
	ReserveAmmo  int     `json:"reserve_ammo"`
}

var weaponLoadouts = map[string]WeaponLoadout{
	"pistol": {
		ID:           "pistol",
		Name:         "Pistol",
		Damage:       25,
		Range:        50,
		MagazineSize: 12,
		ReserveAmmo:  48,
	},
	"rifle": {
		ID:           "rifle",
		Name:         "Rifle",
		Damage:       30,
		Range:        100,
		MagazineSize: 30,
		ReserveAmmo:  90,
	},
	"sniper": {
		ID:           "sniper",
		Name:         "Sniper",
		Damage:       100,
		Range:        200,
		MagazineSize: 5,
		ReserveAmmo:  20,
	},
	"usp": {
		ID:           "usp",
		Name:         "USP",
		Damage:       24,
		Range:        55,
		MagazineSize: 12,
		ReserveAmmo:  48,
	},
	"glock": {
		ID:           "glock",
		Name:         "Glock",
		Damage:       20,
		Range:        50,
		MagazineSize: 20,
		ReserveAmmo:  120,
	},
	"deagle": {
		ID:           "deagle",
		Name:         "Deagle",
		Damage:       54,
		Range:        80,
		MagazineSize: 7,
		ReserveAmmo:  35,
	},
	"mp5": {
		ID:           "mp5",
		Name:         "MP5",
		Damage:       22,
		Range:        70,
		MagazineSize: 30,
		ReserveAmmo:  120,
	},
	"p90": {
		ID:           "p90",
		Name:         "P90",
		Damage:       24,
		Range:        80,
		MagazineSize: 50,
		ReserveAmmo:  100,
	},
	"m4a1": {
		ID:           "m4a1",
		Name:         "M4A1",
		Damage:       33,
		Range:        120,
		MagazineSize: 30,
		ReserveAmmo:  90,
	},
	"famas": {
		ID:           "famas",
		Name:         "Famas",
		Damage:       28,
		Range:        95,
		MagazineSize: 25,
		ReserveAmmo:  90,
	},
	"ak47": {
		ID:           "ak47",
		Name:         "AK-47",
		Damage:       36,
		Range:        115,
		MagazineSize: 30,
		ReserveAmmo:  90,
	},
	"galil": {
		ID:           "galil",
		Name:         "Galil",
		Damage:       30,
		Range:        95,
		MagazineSize: 35,
		ReserveAmmo:  90,
	},
	"awp": {
		ID:           "awp",
		Name:         "AWP",
		Damage:       115,
		Range:        300,
		MagazineSize: 10,
		ReserveAmmo:  30,
	},
	"shotgun": {
		ID:           "shotgun",
		Name:         "Shotgun",
		Damage:       80,
		Range:        20,
		MagazineSize: 6,
		ReserveAmmo:  24,
	},
}

var teamWeaponPools = map[string]map[string]bool{
	TeamCounterTerrorists: {
		"usp":    true,
		"mp5":    true,
		"p90":    true,
		"m4a1":   true,
		"famas":  true,
		"awp":    true,
		"deagle": true,
	},
	TeamTerrorists: {
		"glock":  true,
		"mp5":    true,
		"p90":    true,
		"ak47":   true,
		"galil":  true,
		"awp":    true,
		"deagle": true,
	},
}

// NormalizeWeaponID 兼容旧 weapon id，并按队伍映射到 CS 风格武器。
func NormalizeWeaponID(teamID, weaponID string) string {
	normalizedTeam := NormalizeTeamID(teamID)
	normalizedWeapon := strings.ToLower(strings.TrimSpace(weaponID))

	switch normalizedWeapon {
	case "":
		return ""
	case "desert_eagle":
		return "deagle"
	case "sniper":
		if normalizedTeam == "" {
			return "sniper"
		}
		return "awp"
	case "smg":
		return "mp5"
	case "pistol":
		if normalizedTeam == "" {
			return "pistol"
		}
		if normalizedTeam == TeamTerrorists {
			return "glock"
		}
		return "usp"
	case "rifle":
		if normalizedTeam == "" {
			return "rifle"
		}
		if normalizedTeam == TeamTerrorists {
			return "ak47"
		}
		return "m4a1"
	default:
		if _, exists := weaponLoadouts[normalizedWeapon]; exists {
			return normalizedWeapon
		}
		return ""
	}
}

func GetWeaponLoadout(teamID, weaponID string) (WeaponLoadout, bool) {
	normalizedWeapon := NormalizeWeaponID(teamID, weaponID)
	loadout, ok := weaponLoadouts[normalizedWeapon]
	return loadout, ok
}

func CanTeamUseWeapon(teamID, weaponID string) bool {
	normalizedTeam := NormalizeTeamID(teamID)
	normalizedWeapon := NormalizeWeaponID(teamID, weaponID)

	if normalizedWeapon == "" {
		return false
	}
	if normalizedTeam == "" {
		_, ok := weaponLoadouts[normalizedWeapon]
		return ok
	}

	allowedWeapons, ok := teamWeaponPools[normalizedTeam]
	if !ok {
		return false
	}
	return allowedWeapons[normalizedWeapon]
}

func DefaultWeaponForTeam(teamID string) string {
	if NormalizeTeamID(teamID) == TeamTerrorists {
		return "glock"
	}
	return "usp"
}

func AvailableWeaponsForTeam(teamID string) []string {
	normalizedTeam := NormalizeTeamID(teamID)
	if normalizedTeam == "" {
		return nil
	}

	weapons := make([]string, 0, len(teamWeaponPools[normalizedTeam]))
	for _, weaponID := range []string{"usp", "glock", "mp5", "p90", "m4a1", "famas", "ak47", "galil", "awp", "deagle"} {
		if teamWeaponPools[normalizedTeam][weaponID] {
			weapons = append(weapons, weaponID)
		}
	}
	return weapons
}
