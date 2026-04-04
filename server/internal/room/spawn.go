package room

import (
	"math/rand"

	"fps-game/internal/player"
	"fps-game/internal/team"
)

var ctSpawnPoints = []player.Position{
	{X: -40, Y: 0, Z: 0},
	{X: -40, Y: 0, Z: 10},
	{X: -40, Y: 0, Z: -10},
	{X: -35, Y: 0, Z: 5},
	{X: -35, Y: 0, Z: -5},
}

var tSpawnPoints = []player.Position{
	{X: 40, Y: 0, Z: 0},
	{X: 40, Y: 0, Z: 10},
	{X: 40, Y: 0, Z: -10},
	{X: 35, Y: 0, Z: 5},
	{X: 35, Y: 0, Z: -5},
}

func randomSpawnPosition() player.Position {
	return player.Position{
		X: rand.Float64()*100 - 50,
		Y: 0,
		Z: rand.Float64()*100 - 50,
	}
}

func SpawnPositionForTeam(teamID string) player.Position {
	switch team.NormalizeTeamID(teamID) {
	case team.TeamCounterTerrorists:
		return ctSpawnPoints[rand.Intn(len(ctSpawnPoints))]
	case team.TeamTerrorists:
		return tSpawnPoints[rand.Intn(len(tSpawnPoints))]
	default:
		return randomSpawnPosition()
	}
}

func ApplyRespawnLoadout(p *player.Player) {
	teamID := p.GetTeam()
	if teamID == "" {
		return
	}

	currentWeapon := p.Snapshot().Weapon
	if currentWeapon == "rifle" || currentWeapon == "pistol" || currentWeapon == "sniper" || currentWeapon == "" {
		loadout, ok := team.GetWeaponLoadout(teamID, team.DefaultWeaponForTeam(teamID))
		if !ok {
			return
		}
		p.ApplyLoadout(loadout.ID, loadout.MagazineSize, loadout.ReserveAmmo)
		return
	}

	preferredWeapon := currentWeapon
	if !team.CanTeamUseWeapon(teamID, preferredWeapon) {
		preferredWeapon = team.DefaultWeaponForTeam(teamID)
	}

	loadout, ok := team.GetWeaponLoadout(teamID, preferredWeapon)
	if !ok {
		loadout, ok = team.GetWeaponLoadout(teamID, team.DefaultWeaponForTeam(teamID))
	}
	if !ok {
		return
	}

	p.ApplyLoadout(loadout.ID, loadout.MagazineSize, loadout.ReserveAmmo)
}
