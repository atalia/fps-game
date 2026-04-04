package economy

import (
	"strings"

	"fps-game/internal/player"
	"fps-game/internal/team"
)

const (
	StartMoney      = 800
	KillReward      = 300
	RoundWinReward  = 3000
	RoundLossReward = 1400
)

type Category string

const (
	CategoryWeapon    Category = "weapon"
	CategoryEquipment Category = "equipment"
)

type Item struct {
	ID            string
	Name          string
	Category      Category
	Group         string
	Price         int
	WeaponID      string
	AllowedTeam   string
	Armor         int
	Helmet        bool
	Flashbangs    int
	HEGrenades    int
	SmokeGrenades int
}

type PurchaseError struct {
	Code    string
	Message string
}

func (e *PurchaseError) Error() string {
	return e.Message
}

var catalog = map[string]Item{
	"glock": {
		ID:          "glock",
		Name:        "Glock",
		Category:    CategoryWeapon,
		Group:       "pistols",
		Price:       400,
		WeaponID:    "glock",
		AllowedTeam: team.TeamTerrorists,
	},
	"usp": {
		ID:          "usp",
		Name:        "USP",
		Category:    CategoryWeapon,
		Group:       "pistols",
		Price:       500,
		WeaponID:    "usp",
		AllowedTeam: team.TeamCounterTerrorists,
	},
	"deagle": {
		ID:       "deagle",
		Name:     "Deagle",
		Category: CategoryWeapon,
		Group:    "pistols",
		Price:    650,
		WeaponID: "deagle",
	},
	"mp5": {
		ID:       "mp5",
		Name:     "MP5",
		Category: CategoryWeapon,
		Group:    "smgs",
		Price:    1500,
		WeaponID: "mp5",
	},
	"p90": {
		ID:       "p90",
		Name:     "P90",
		Category: CategoryWeapon,
		Group:    "smgs",
		Price:    2350,
		WeaponID: "p90",
	},
	"ak47": {
		ID:          "ak47",
		Name:        "AK47",
		Category:    CategoryWeapon,
		Group:       "rifles",
		Price:       2500,
		WeaponID:    "ak47",
		AllowedTeam: team.TeamTerrorists,
	},
	"m4a1": {
		ID:          "m4a1",
		Name:        "M4A1",
		Category:    CategoryWeapon,
		Group:       "rifles",
		Price:       3100,
		WeaponID:    "m4a1",
		AllowedTeam: team.TeamCounterTerrorists,
	},
	"famas": {
		ID:          "famas",
		Name:        "Famas",
		Category:    CategoryWeapon,
		Group:       "rifles",
		Price:       2250,
		WeaponID:    "famas",
		AllowedTeam: team.TeamCounterTerrorists,
	},
	"galil": {
		ID:          "galil",
		Name:        "Galil",
		Category:    CategoryWeapon,
		Group:       "rifles",
		Price:       2000,
		WeaponID:    "galil",
		AllowedTeam: team.TeamTerrorists,
	},
	"awp": {
		ID:       "awp",
		Name:     "AWP",
		Category: CategoryWeapon,
		Group:    "sniper",
		Price:    4750,
		WeaponID: "awp",
	},
	"kevlar": {
		ID:       "kevlar",
		Name:     "Kevlar",
		Category: CategoryEquipment,
		Group:    "equipment",
		Price:    650,
		Armor:    100,
	},
	"kevlar_helmet": {
		ID:       "kevlar_helmet",
		Name:     "Helmet+Kevlar",
		Category: CategoryEquipment,
		Group:    "equipment",
		Price:    1000,
		Armor:    100,
		Helmet:   true,
	},
	"flashbang": {
		ID:         "flashbang",
		Name:       "Flash",
		Category:   CategoryEquipment,
		Group:      "equipment",
		Price:      200,
		Flashbangs: 1,
	},
	"he_grenade": {
		ID:         "he_grenade",
		Name:       "HE",
		Category:   CategoryEquipment,
		Group:      "equipment",
		Price:      300,
		HEGrenades: 1,
	},
	"smoke": {
		ID:            "smoke",
		Name:          "Smoke",
		Category:      CategoryEquipment,
		Group:         "equipment",
		Price:         300,
		SmokeGrenades: 1,
	},
}

func normalizeItemID(itemID string) string {
	return strings.ToLower(strings.TrimSpace(itemID))
}

func GetItem(itemID string) (Item, bool) {
	item, ok := catalog[normalizeItemID(itemID)]
	return item, ok
}

func ValidatePurchase(p *player.Player, itemID string) (Item, error) {
	item, ok := GetItem(itemID)
	if !ok {
		return Item{}, &PurchaseError{
			Code:    "unknown_item",
			Message: "Unknown buy item",
		}
	}

	teamID := team.NormalizeTeamID(p.GetTeam())
	if teamID == "" {
		return Item{}, &PurchaseError{
			Code:    "team_required",
			Message: "Join a team before buying",
		}
	}

	if item.AllowedTeam != "" && item.AllowedTeam != teamID {
		return Item{}, &PurchaseError{
			Code:    "wrong_team",
			Message: "That item is not available for your team",
		}
	}

	if p.GetMoney() < item.Price {
		return Item{}, &PurchaseError{
			Code:    "insufficient_funds",
			Message: "Insufficient funds",
		}
	}

	if item.Category == CategoryWeapon {
		if !team.CanTeamUseWeapon(teamID, item.WeaponID) {
			return Item{}, &PurchaseError{
				Code:    "wrong_team",
				Message: "That item is not available for your team",
			}
		}
		if _, ok := team.GetWeaponLoadout(teamID, item.WeaponID); !ok {
			return Item{}, &PurchaseError{
				Code:    "unknown_item",
				Message: "Unknown weapon loadout",
			}
		}
	}

	return item, nil
}

func ApplyPurchase(p *player.Player, itemID string) (Item, error) {
	item, err := ValidatePurchase(p, itemID)
	if err != nil {
		return Item{}, err
	}

	if !p.SpendMoney(item.Price) {
		return Item{}, &PurchaseError{
			Code:    "insufficient_funds",
			Message: "Insufficient funds",
		}
	}

	if item.Category == CategoryWeapon {
		loadout, _ := team.GetWeaponLoadout(p.GetTeam(), item.WeaponID)
		p.ApplyLoadout(loadout.ID, loadout.MagazineSize, loadout.ReserveAmmo)
		return item, nil
	}

	armor, hasHelmet := p.GetArmorState()
	if item.Armor > 0 {
		armor = item.Armor
	}
	p.SetArmor(armor, hasHelmet || item.Helmet)

	if item.Flashbangs > 0 {
		p.AddGrenade("flashbang", item.Flashbangs)
	}
	if item.HEGrenades > 0 {
		p.AddGrenade("he_grenade", item.HEGrenades)
	}
	if item.SmokeGrenades > 0 {
		p.AddGrenade("smoke", item.SmokeGrenades)
	}

	return item, nil
}
