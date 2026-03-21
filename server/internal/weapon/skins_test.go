package weapon

import (
	"testing"
)

func TestNewSkinManager(t *testing.T) {
	sm := NewSkinManager()

	if sm == nil {
		t.Fatal("SkinManager should not be nil")
	}

	skins := sm.GetAllSkins()
	if len(skins) == 0 {
		t.Fatal("Should have default skins")
	}
}

func TestSkinManager_GetSkin(t *testing.T) {
	sm := NewSkinManager()

	skin := sm.GetSkin("pistol_default")
	if skin == nil {
		t.Fatal("Should find pistol_default skin")
	}

	if skin.Name != "默认" {
		t.Errorf("Skin name = %s, want 默认", skin.Name)
	}

	// 不存在的皮肤
	skin = sm.GetSkin("nonexistent")
	if skin != nil {
		t.Fatal("Should return nil for nonexistent skin")
	}
}

func TestSkinManager_GetSkinsByWeapon(t *testing.T) {
	sm := NewSkinManager()

	pistolSkins := sm.GetSkinsByWeapon("pistol")
	if len(pistolSkins) == 0 {
		t.Fatal("Should have pistol skins")
	}

	for _, skin := range pistolSkins {
		if skin.WeaponType != "pistol" {
			t.Errorf("Skin weapon type = %s, want pistol", skin.WeaponType)
		}
	}
}

func TestSkinManager_GetSkinsByRarity(t *testing.T) {
	sm := NewSkinManager()

	legendarySkins := sm.GetSkinsByRarity(RarityLegendary)
	if len(legendarySkins) == 0 {
		t.Fatal("Should have legendary skins")
	}

	for _, skin := range legendarySkins {
		if skin.Rarity != RarityLegendary {
			t.Errorf("Skin rarity = %d, want %d", skin.Rarity, RarityLegendary)
		}
	}
}

func TestSkinManager_UnlockSkin(t *testing.T) {
	sm := NewSkinManager()

	// 解锁皮肤
	if !sm.UnlockSkin("player1", "pistol_gold") {
		t.Fatal("Should unlock skin")
	}

	// 验证玩家拥有皮肤
	skins := sm.GetPlayerSkins("player1")
	if len(skins) != 1 {
		t.Errorf("Player skins count = %d, want 1", len(skins))
	}

	// 再次解锁同样的皮肤应该失败
	if sm.UnlockSkin("player1", "pistol_gold") {
		t.Fatal("Should not unlock same skin twice")
	}

	// 解锁不存在的皮肤应该失败
	if sm.UnlockSkin("player1", "nonexistent") {
		t.Fatal("Should not unlock nonexistent skin")
	}
}

func TestSkinManager_GetPlayerSkins(t *testing.T) {
	sm := NewSkinManager()

	// 没有皮肤的玩家
	skins := sm.GetPlayerSkins("empty_player")
	if len(skins) != 0 {
		t.Fatal("Should have no skins")
	}

	// 解锁多个皮肤
	sm.UnlockSkin("player1", "pistol_gold")
	sm.UnlockSkin("player1", "rifle_dragon")

	skins = sm.GetPlayerSkins("player1")
	if len(skins) != 2 {
		t.Errorf("Player skins count = %d, want 2", len(skins))
	}
}

func TestSkinManager_RandomSkinDrop(t *testing.T) {
	sm := NewSkinManager()

	// 多次随机掉落测试稀有度分布
	rarities := make(map[Rarity]int)
	for i := 0; i < 100; i++ {
		skin := sm.RandomSkinDrop()
		if skin != nil {
			rarities[skin.Rarity]++
		}
	}

	// 普通皮肤应该最多
	if rarities[RarityCommon] < rarities[RarityLegendary] {
		t.Error("Common skins should drop more frequently")
	}
}

func TestRarity_String(t *testing.T) {
	tests := []struct {
		rarity Rarity
		want   string
	}{
		{RarityCommon, "普通"},
		{RarityUncommon, "罕见"},
		{RarityRare, "稀有"},
		{RarityEpic, "史诗"},
		{RarityLegendary, "传说"},
	}

	for _, tt := range tests {
		got := tt.rarity.String()
		if got != tt.want {
			t.Errorf("Rarity(%d).String() = %s, want %s", tt.rarity, got, tt.want)
		}
	}
}

func TestRarity_Color(t *testing.T) {
	tests := []struct {
		rarity Rarity
		want   string
	}{
		{RarityCommon, "#ffffff"},
		{RarityLegendary, "#ff8000"},
	}

	for _, tt := range tests {
		got := tt.rarity.Color()
		if got != tt.want {
			t.Errorf("Rarity(%d).Color() = %s, want %s", tt.rarity, got, tt.want)
		}
	}
}
