package game

import (
	"fps-game/internal/team"
)

// Re-export team package symbols for backward compatibility
const (
	TeamCounterTerrorists = team.TeamCounterTerrorists
	TeamTerrorists        = team.TeamTerrorists
	AutoAssignTeam        = team.AutoAssignTeam
)

// Re-export types
type Team = team.Team
type TeamManager = team.TeamManager
type WeaponLoadout = team.WeaponLoadout

// Re-export functions
var (
	NormalizeTeamID         = team.NormalizeTeamID
	NewTeamManager          = team.NewTeamManager
	NewTeamManagerForRoom   = team.NewTeamManagerForRoom
	GetWeaponLoadout        = team.GetWeaponLoadout
	CanTeamUseWeapon        = team.CanTeamUseWeapon
	DefaultWeaponForTeam    = team.DefaultWeaponForTeam
	AvailableWeaponsForTeam = team.AvailableWeaponsForTeam
)
