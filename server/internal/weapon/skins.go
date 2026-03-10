// Weapon Skins - 武器皮肤系统
package weapon

import (
	"math/rand"
	"sync"
)

// Rarity 稀有度
type Rarity int

const (
	RarityCommon Rarity = iota
	RarityUncommon
	RarityRare
	RarityEpic
	RarityLegendary
)

// Skin 武器皮肤
type Skin struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	WeaponType  string  `json:"weapon_type"`
	Rarity      Rarity  `json:"rarity"`
	Color       string  `json:"color"`
	Pattern     string  `json:"pattern"`
	Price       int     `json:"price"`
	Description string  `json:"description"`
}

// SkinManager 皮肤管理器
type SkinManager struct {
	skins     map[string]*Skin
	playerSkins map[string][]string // playerID -> skinIDs
	mu        sync.RWMutex
}

// NewSkinManager 创建皮肤管理器
func NewSkinManager() *SkinManager {
	sm := &SkinManager{
		skins:       make(map[string]*Skin),
		playerSkins: make(map[string][]string),
	}

	// 初始化默认皮肤
	sm.initDefaultSkins()
	return sm
}

func (sm *SkinManager) initDefaultSkins() {
	defaultSkins := []*Skin{
		// 手枪皮肤
		{ID: "pistol_default", Name: "默认", WeaponType: "pistol", Rarity: RarityCommon, Color: "#333333", Price: 0},
		{ID: "pistol_gold", Name: "黄金", WeaponType: "pistol", Rarity: RarityLegendary, Color: "#FFD700", Pattern: "metallic", Price: 5000},
		{ID: "pistol_stealth", Name: "隐身", WeaponType: "pistol", Rarity: RarityEpic, Color: "#1a1a1a", Pattern: "matte", Price: 2000},

		// 步枪皮肤
		{ID: "rifle_default", Name: "默认", WeaponType: "rifle", Rarity: RarityCommon, Color: "#4a4a4a", Price: 0},
		{ID: "rifle_camo", Name: "迷彩", WeaponType: "rifle", Rarity: RarityRare, Color: "#228B22", Pattern: "camo", Price: 1000},
		{ID: "rifle_dragon", Name: "龙纹", WeaponType: "rifle", Rarity: RarityLegendary, Color: "#8B0000", Pattern: "dragon", Price: 8000},

		// 霰弹枪皮肤
		{ID: "shotgun_default", Name: "默认", WeaponType: "shotgun", Rarity: RarityCommon, Color: "#5a3d2b", Price: 0},
		{ID: "shotgun_rust", Name: "锈蚀", WeaponType: "shotgun", Rarity: RarityUncommon, Color: "#8B4513", Pattern: "rust", Price: 500},

		// 狙击枪皮肤
		{ID: "sniper_default", Name: "默认", WeaponType: "sniper", Rarity: RarityCommon, Color: "#2f4f4f", Price: 0},
		{ID: "sniper_ice", Name: "冰霜", WeaponType: "sniper", Rarity: RarityEpic, Color: "#87CEEB", Pattern: "frost", Price: 3000},
		{ID: "sniper_void", Name: "虚空", WeaponType: "sniper", Rarity: RarityLegendary, Color: "#4B0082", Pattern: "void", Price: 10000},
	}

	for _, skin := range defaultSkins {
		sm.skins[skin.ID] = skin
	}
}

// GetSkin 获取皮肤
func (sm *SkinManager) GetSkin(id string) *Skin {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.skins[id]
}

// GetAllSkins 获取所有皮肤
func (sm *SkinManager) GetAllSkins() []*Skin {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	skins := make([]*Skin, 0, len(sm.skins))
	for _, skin := range sm.skins {
		skins = append(skins, skin)
	}
	return skins
}

// GetSkinsByWeapon 获取武器皮肤
func (sm *SkinManager) GetSkinsByWeapon(weaponType string) []*Skin {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	skins := make([]*Skin, 0)
	for _, skin := range sm.skins {
		if skin.WeaponType == weaponType {
			skins = append(skins, skin)
		}
	}
	return skins
}

// GetSkinsByRarity 获取指定稀有度的皮肤
func (sm *SkinManager) GetSkinsByRarity(rarity Rarity) []*Skin {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	skins := make([]*Skin, 0)
	for _, skin := range sm.skins {
		if skin.Rarity == rarity {
			skins = append(skins, skin)
		}
	}
	return skins
}

// UnlockSkin 解锁皮肤
func (sm *SkinManager) UnlockSkin(playerID, skinID string) bool {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// 检查皮肤是否存在
	if _, exists := sm.skins[skinID]; !exists {
		return false
	}

	// 检查玩家是否已有
	skins := sm.playerSkins[playerID]
	for _, s := range skins {
		if s == skinID {
			return false // 已经拥有
		}
	}

	sm.playerSkins[playerID] = append(skins, skinID)
	return true
}

// GetPlayerSkins 获取玩家皮肤
func (sm *SkinManager) GetPlayerSkins(playerID string) []*Skin {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	skinIDs := sm.playerSkins[playerID]
	skins := make([]*Skin, 0, len(skinIDs))

	for _, id := range skinIDs {
		if skin, exists := sm.skins[id]; exists {
			skins = append(skins, skin)
		}
	}
	return skins
}

// RandomSkinDrop 随机掉落皮肤
func (sm *SkinManager) RandomSkinDrop() *Skin {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	// 按稀有度权重随机
	weights := []int{50, 30, 15, 4, 1} // Common 到 Legendary
	totalWeight := 0
	for _, w := range weights {
		totalWeight += w
	}

	roll := rand.Intn(totalWeight)
	var targetRarity Rarity

	cumulative := 0
	for i, w := range weights {
		cumulative += w
		if roll < cumulative {
			targetRarity = Rarity(i)
			break
		}
	}

	// 从该稀有度的皮肤中随机选择
	candidates := sm.GetSkinsByRarity(targetRarity)
	if len(candidates) == 0 {
		return nil
	}

	return candidates[rand.Intn(len(candidates))]
}

// RarityName 获取稀有度名称
func (r Rarity) String() string {
	names := []string{"普通", "罕见", "稀有", "史诗", "传说"}
	if int(r) < len(names) {
		return names[r]
	}
	return "未知"
}

// RarityColor 获取稀有度颜色
func (r Rarity) Color() string {
	colors := []string{"#ffffff", "#1eff00", "#0070dd", "#a335ee", "#ff8000"}
	if int(r) < len(colors) {
		return colors[r]
	}
	return "#ffffff"
}
