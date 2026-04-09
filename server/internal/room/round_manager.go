package room

import (
	"fmt"
	"sync"
	"time"

	"fps-game/internal/balance"
	"fps-game/internal/player"
	"fps-game/internal/team"

	"fps-game/pkg/metrics"
)

type RoundPhase string

const (
	RoundPhaseWaiting   RoundPhase = "waiting"
	RoundPhaseFreeze    RoundPhase = "freeze"
	RoundPhaseLive      RoundPhase = "live"
	RoundPhaseEnded     RoundPhase = "ended"
	RoundPhaseMatchOver RoundPhase = "match_over"
)

type RoundEndReason string

const (
	RoundEndReasonElimination RoundEndReason = "elimination"
	RoundEndReasonTime        RoundEndReason = "time"
	RoundEndReasonExplosion   RoundEndReason = "explosion"
	RoundEndReasonDefused     RoundEndReason = "defused"
)

type RoundConfig struct {
	FreezeTime       time.Duration
	RoundTime        time.Duration
	BuyTime          time.Duration
	RoundEndDelay    time.Duration
	RegulationRounds int
	FirstToWin       int
	HalftimeAfter    int
}

var DefaultRoundConfig = RoundConfig{
	FreezeTime:       5 * time.Second,
	RoundTime:        2 * time.Minute,
	BuyTime:          15 * time.Second,
	RoundEndDelay:    3 * time.Second,
	RegulationRounds: 30,
	FirstToWin:       16,
	HalftimeAfter:    15,
}

const C4ExplosionTime = 40 * time.Second
const C4DefuseTime = 5 * time.Second
const C4DefuseTimeWithKit = 2500 * time.Millisecond

type RoundState struct {
	Phase            RoundPhase   `json:"phase"`
	RoundNumber      int          `json:"round_number"`
	RoundsPlayed     int          `json:"rounds_played"`
	RegulationRounds int          `json:"regulation_rounds"`
	FirstToWin       int          `json:"first_to_win"`
	TimerSeconds     int          `json:"timer_seconds"`
	BuyTimeLeft      int          `json:"buy_time_left"`
	C4ExplosionIn    int          `json:"c4_explosion_in"`
	CanMove          bool         `json:"can_move"`
	CanShoot         bool         `json:"can_shoot"`
	CanBuy           bool         `json:"can_buy"`
	IsOvertime       bool         `json:"is_overtime"`
	MatchWinner      string       `json:"match_winner,omitempty"`
	Teams            []*team.Team `json:"teams,omitempty"`
}

type RoundStartEvent struct {
	RoundState
	Announcement string `json:"announcement"`
}

type RoundMVP struct {
	PlayerID string `json:"player_id"`
	Name     string `json:"name"`
	Kills    int    `json:"kills"`
	Damage   int    `json:"damage"`
}

type RoundEndEvent struct {
	RoundNumber  int            `json:"round_number"`
	Winner       string         `json:"winner"`
	Reason       RoundEndReason `json:"reason"`
	Announcement string         `json:"announcement"`
	MVP          *RoundMVP      `json:"mvp,omitempty"`
	IsHalftime   bool           `json:"is_halftime"`
	IsOvertime   bool           `json:"is_overtime"`
	Teams        []*team.Team   `json:"teams,omitempty"`
}

type MatchEndEvent struct {
	Winner      string       `json:"winner"`
	RoundNumber int          `json:"round_number"`
	IsOvertime  bool         `json:"is_overtime"`
	Teams       []*team.Team `json:"teams,omitempty"`
}

type roundPlayerStats struct {
	Kills  int
	Damage int
}

type sideSwapPlayer struct {
	PlayerID string
	Team     string
}

type RoundManager struct {
	room *Room

	config RoundConfig

	mu               sync.RWMutex
	phase            RoundPhase
	currentRound     int
	roundsCompleted  int
	overtime         bool
	teamsSwapped     bool
	matchWinner      string
	phaseEndsAt      time.Time
	buyEndsAt        time.Time
	roundStats       map[string]*roundPlayerStats
	phaseTimer       *time.Timer
	nextRoundTimer   *time.Timer
	c4ExplosionTimer *time.Timer
	c4ExplosionAt    time.Time
	stateTickerStop  chan struct{}
	matchStartTime   time.Time
	closed           bool
}

func NewRoundManager(r *Room, cfg RoundConfig) *RoundManager {
	if cfg.FreezeTime <= 0 {
		cfg.FreezeTime = DefaultRoundConfig.FreezeTime
	}
	if cfg.RoundTime <= 0 {
		cfg.RoundTime = DefaultRoundConfig.RoundTime
	}
	if cfg.BuyTime <= 0 {
		cfg.BuyTime = DefaultRoundConfig.BuyTime
	}
	if cfg.RoundEndDelay <= 0 {
		cfg.RoundEndDelay = DefaultRoundConfig.RoundEndDelay
	}
	if cfg.RegulationRounds <= 0 {
		cfg.RegulationRounds = DefaultRoundConfig.RegulationRounds
	}
	if cfg.FirstToWin <= 0 {
		cfg.FirstToWin = DefaultRoundConfig.FirstToWin
	}
	if cfg.HalftimeAfter <= 0 {
		cfg.HalftimeAfter = DefaultRoundConfig.HalftimeAfter
	}

	return &RoundManager{
		room:       r,
		config:     cfg,
		phase:      RoundPhaseWaiting,
		roundStats: make(map[string]*roundPlayerStats),
	}
}

func (rm *RoundManager) Close() {
	rm.mu.Lock()
	if rm.closed {
		rm.mu.Unlock()
		return
	}

	rm.closed = true
	rm.stopTimersLocked()
	stop := rm.stateTickerStop
	rm.stateTickerStop = nil
	rm.mu.Unlock()

	if stop != nil {
		close(stop)
	}
}

func (rm *RoundManager) Snapshot() RoundState {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.snapshotLocked(time.Now())
}

func (rm *RoundManager) CanMove() bool {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.phase != RoundPhaseFreeze && rm.phase != RoundPhaseEnded && rm.phase != RoundPhaseMatchOver
}

func (rm *RoundManager) CanShoot() bool {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.phase != RoundPhaseFreeze && rm.phase != RoundPhaseEnded && rm.phase != RoundPhaseMatchOver
}

func (rm *RoundManager) CanBuy() bool {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	if rm.phase != RoundPhaseFreeze && rm.phase != RoundPhaseLive {
		return false
	}
	return time.Now().Before(rm.buyEndsAt)
}

func (rm *RoundManager) HandleRosterChanged() {
	rm.mu.RLock()
	phase := rm.phase
	rm.mu.RUnlock()

	switch phase {
	case RoundPhaseWaiting, RoundPhaseEnded:
		rm.MaybeStart()
	case RoundPhaseFreeze, RoundPhaseLive:
		if winner := rm.eliminationWinner(); winner != "" {
			rm.endRound(winner, RoundEndReasonElimination)
		}
	}
}

// StartC4Countdown arms the C4 explosion timer without broadcasting c4_planted.
// This is used by network paths that already emitted their own c4_planted event.
func (rm *RoundManager) StartC4Countdown() bool {
	rm.mu.Lock()
	if rm.closed || rm.phase != RoundPhaseLive {
		rm.mu.Unlock()
		return false
	}
	if rm.c4ExplosionTimer != nil {
		rm.c4ExplosionTimer.Stop()
	}

	rm.c4ExplosionAt = time.Now().Add(C4ExplosionTime)
	rm.c4ExplosionTimer = time.AfterFunc(C4ExplosionTime, rm.handleC4Explosion)
	rm.mu.Unlock()

	rm.broadcastRoundState()
	return true
}

// HandleC4Planted starts the C4 explosion timer when C4 is planted.
// Should be called when a terrorist successfully plants the bomb.
func (rm *RoundManager) HandleC4Planted(planterID string) {
	if !rm.StartC4Countdown() {
		return
	}

	rm.room.Broadcast("c4_planted", map[string]interface{}{
		"planter_id":   planterID,
		"explosion_in": int(C4ExplosionTime.Seconds()),
		"position":     rm.room.GetC4Position(),
	}, "")
}

// ResolveC4Defused clears the active C4 countdown and ends the round for CTs
// without broadcasting c4_defused. Network paths that already send their own
// c4_defused payload can call this to avoid duplicate events.
func (rm *RoundManager) ResolveC4Defused() bool {
	rm.mu.Lock()
	if rm.closed || rm.phase != RoundPhaseLive || !rm.room.IsC4Planted() {
		rm.mu.Unlock()
		return false
	}

	rm.clearC4ExplosionStateLocked()
	rm.mu.Unlock()

	rm.endRound(team.TeamCounterTerrorists, RoundEndReasonDefused)
	return true
}

// HandleC4Defused handles successful C4 defusal by a counter-terrorist.
func (rm *RoundManager) HandleC4Defused(defuserID string) {
	if !rm.ResolveC4Defused() {
		return
	}

	rm.room.Broadcast("c4_defused", map[string]interface{}{
		"defuser_id": defuserID,
	}, "")
}

// handleC4Explosion is called when the C4 timer expires.
func (rm *RoundManager) handleC4Explosion() {
	rm.mu.RLock()
	if rm.closed || rm.phase != RoundPhaseLive {
		rm.mu.RUnlock()
		return
	}
	rm.mu.RUnlock()

	rm.endRound(team.TeamTerrorists, RoundEndReasonExplosion)
	rm.room.Broadcast("c4_exploded", map[string]interface{}{
		"position": rm.room.GetC4Position(),
	}, "")
}

// GetC4ExplosionTime returns seconds until C4 explodes, or 0 if not planted.
func (rm *RoundManager) GetC4ExplosionTime() int {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	if rm.c4ExplosionAt.IsZero() {
		return 0
	}
	remaining := time.Until(rm.c4ExplosionAt)
	if remaining <= 0 {
		return 0
	}
	return int((remaining + time.Second - 1) / time.Second)
}

func (rm *RoundManager) MaybeStart() bool {
	rm.mu.Lock()
	if rm.closed || (rm.phase != RoundPhaseWaiting && rm.phase != RoundPhaseEnded) {
		rm.mu.Unlock()
		return false
	}
	if !rm.readyToStartLocked() {
		changed := rm.phase == RoundPhaseEnded
		if changed {
			rm.phase = RoundPhaseWaiting
			rm.phaseEndsAt = time.Time{}
			rm.buyEndsAt = time.Time{}
		}
		rm.mu.Unlock()
		if changed {
			rm.stopStateTicker()
			rm.broadcastRoundState()
		}
		return false
	}

	now := time.Now()
	rm.currentRound = rm.roundsCompleted + 1
	if rm.roundsCompleted == 0 {
		rm.matchStartTime = now
	}
	rm.phase = RoundPhaseFreeze
	rm.phaseEndsAt = now.Add(rm.config.FreezeTime)
	rm.buyEndsAt = now.Add(rm.config.BuyTime)
	rm.roundStats = make(map[string]*roundPlayerStats)
	rm.matchWinner = ""
	rm.stopTimersLocked()
	rm.phaseTimer = time.AfterFunc(rm.config.FreezeTime, rm.beginLivePhase)
	shouldStartTicker := rm.stateTickerStop == nil
	rm.mu.Unlock()

	if shouldStartTicker {
		rm.startStateTicker()
	}

	rm.resetParticipantsForRound()
	rm.broadcastRoundState()
	if rm.roundsCompleted == 0 {
		metrics.Get().RecordMatchStart(rm.room.GameMode)
	}
	rm.room.Broadcast("round_started", RoundStartEvent{
		RoundState:   rm.Snapshot(),
		Announcement: rm.roundStartAnnouncement(),
	}, "")

	return true
}

func (rm *RoundManager) RecordDamage(attackerID string, damage int) {
	if damage <= 0 {
		return
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()

	if rm.closed || rm.phase != RoundPhaseLive || attackerID == "" {
		return
	}

	stats := rm.roundStats[attackerID]
	if stats == nil {
		stats = &roundPlayerStats{}
		rm.roundStats[attackerID] = stats
	}
	stats.Damage += damage
}

func (rm *RoundManager) RecordKill(killerID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if rm.closed || rm.phase != RoundPhaseLive || killerID == "" {
		return
	}

	stats := rm.roundStats[killerID]
	if stats == nil {
		stats = &roundPlayerStats{}
		rm.roundStats[killerID] = stats
	}
	stats.Kills++
}

func (rm *RoundManager) beginLivePhase() {
	rm.mu.Lock()
	if rm.closed || rm.phase != RoundPhaseFreeze {
		rm.mu.Unlock()
		return
	}

	rm.phase = RoundPhaseLive
	rm.phaseEndsAt = time.Now().Add(rm.config.RoundTime)
	rm.phaseTimer = time.AfterFunc(rm.config.RoundTime, rm.handleRoundTimeout)
	rm.mu.Unlock()

	rm.broadcastRoundState()
}

func (rm *RoundManager) handleRoundTimeout() {
	rm.endRound(rm.timeoutWinner(), RoundEndReasonTime)
}

func (rm *RoundManager) endRound(winner string, reason RoundEndReason) bool {
	normalizedWinner := team.NormalizeTeamID(winner)
	if normalizedWinner == "" {
		return false
	}

	rm.mu.Lock()
	if rm.closed || rm.phase == RoundPhaseWaiting || rm.phase == RoundPhaseEnded || rm.phase == RoundPhaseMatchOver {
		rm.mu.Unlock()
		return false
	}

	rm.stopTimersLocked()
	rm.roundsCompleted++
	if rm.currentRound == 0 {
		rm.currentRound = rm.roundsCompleted
	}
	rm.phase = RoundPhaseEnded
	rm.phaseEndsAt = time.Now().Add(rm.config.RoundEndDelay)
	rm.room.TeamManager.AddScore(normalizedWinner, 1)

	ctScore := rm.room.TeamManager.GetScore(team.TeamCounterTerrorists)
	tScore := rm.room.TeamManager.GetScore(team.TeamTerrorists)
	isHalftime := rm.roundsCompleted == rm.config.HalftimeAfter && !rm.teamsSwapped
	if !rm.overtime && ctScore == rm.config.HalftimeAfter && tScore == rm.config.HalftimeAfter {
		rm.overtime = true
	}

	matchOver := false
	if !rm.overtime {
		matchOver = ctScore >= rm.config.FirstToWin || tScore >= rm.config.FirstToWin
	} else {
		diff := ctScore - tScore
		if diff < 0 {
			diff = -diff
		}
		matchOver = (ctScore > rm.config.HalftimeAfter || tScore > rm.config.HalftimeAfter) && diff >= 2
	}

	teams := rm.room.GetTeams()
	mvp := rm.determineMVPLocked(normalizedWinner)

	if matchOver {
		rm.phase = RoundPhaseMatchOver
		// Record match completion
		if !rm.matchStartTime.IsZero() {
			metrics.Get().RecordMatchEnd(time.Since(rm.matchStartTime))
		}
		rm.phaseEndsAt = time.Time{}
		rm.matchWinner = normalizedWinner
	} else {
		rm.nextRoundTimer = time.AfterFunc(rm.config.RoundEndDelay, func() {
			rm.MaybeStart()
		})
	}
	rm.mu.Unlock()

	rm.awardRoundMoney(normalizedWinner)
	rm.room.Broadcast("team_scores_updated", map[string]interface{}{
		"winner": normalizedWinner,
		"teams":  teams,
	}, "")
	rm.room.Broadcast("round_ended", RoundEndEvent{
		RoundNumber:  rm.completedRounds(),
		Winner:       normalizedWinner,
		Reason:       reason,
		Announcement: rm.roundEndAnnouncement(normalizedWinner, reason, mvp),
		MVP:          mvp,
		IsHalftime:   isHalftime,
		IsOvertime:   rm.isOvertime(),
		Teams:        teams,
	}, "")

	if isHalftime {
		rm.applyHalftimeSideSwitch()
	}

	if matchOver {
		rm.broadcastRoundState()
		rm.room.Broadcast("match_ended", MatchEndEvent{
			Winner:      normalizedWinner,
			RoundNumber: rm.completedRounds(),
			IsOvertime:  rm.isOvertime(),
			Teams:       teams,
		}, "")
		rm.stopStateTicker()
		return true
	}

	rm.broadcastRoundState()
	return true
}

func (rm *RoundManager) completedRounds() int {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.roundsCompleted
}

func (rm *RoundManager) isOvertime() bool {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.overtime
}

func (rm *RoundManager) roundStartAnnouncement() string {
	snapshot := rm.Snapshot()
	if snapshot.IsOvertime {
		return fmt.Sprintf("Overtime Round %d", snapshot.RoundNumber)
	}
	return fmt.Sprintf("Round %d start", snapshot.RoundNumber)
}

func (rm *RoundManager) roundEndAnnouncement(winner string, reason RoundEndReason, mvp *RoundMVP) string {
	label := teamLabel(winner)
	if mvp != nil && mvp.Name != "" {
		return label + " win by " + string(reason) + " | MVP: " + mvp.Name
	}
	return label + " win by " + string(reason)
}

func (rm *RoundManager) timeoutWinner() string {
	total, _ := rm.room.teamCombatState()
	if total[team.TeamCounterTerrorists] > 0 {
		return team.TeamCounterTerrorists
	}
	if total[team.TeamTerrorists] > 0 {
		return team.TeamTerrorists
	}
	return ""
}

func (rm *RoundManager) eliminationWinner() string {
	total, alive := rm.room.teamCombatState()
	if total[team.TeamCounterTerrorists] == 0 && total[team.TeamTerrorists] == 0 {
		return ""
	}
	if total[team.TeamCounterTerrorists] == 0 {
		return team.TeamTerrorists
	}
	if total[team.TeamTerrorists] == 0 {
		return team.TeamCounterTerrorists
	}
	if alive[team.TeamCounterTerrorists] > 0 && alive[team.TeamTerrorists] == 0 {
		return team.TeamCounterTerrorists
	}
	if alive[team.TeamTerrorists] > 0 && alive[team.TeamCounterTerrorists] == 0 {
		return team.TeamTerrorists
	}
	return ""
}

func (rm *RoundManager) readyToStartLocked() bool {
	total, _ := rm.room.teamCombatState()
	return total[team.TeamCounterTerrorists] > 0 && total[team.TeamTerrorists] > 0
}

func (rm *RoundManager) snapshotLocked(now time.Time) RoundState {
	timerSeconds := 0
	if !rm.phaseEndsAt.IsZero() {
		remaining := time.Until(rm.phaseEndsAt)
		if remaining > 0 {
			timerSeconds = int((remaining + time.Second - 1) / time.Second)
		}
	}

	buyTimeLeft := 0
	if !rm.buyEndsAt.IsZero() {
		remaining := time.Until(rm.buyEndsAt)
		if remaining > 0 {
			buyTimeLeft = int((remaining + time.Second - 1) / time.Second)
		}
	}

	c4ExplosionIn := 0
	if !rm.c4ExplosionAt.IsZero() {
		remaining := time.Until(rm.c4ExplosionAt)
		if remaining > 0 {
			c4ExplosionIn = int((remaining + time.Second - 1) / time.Second)
		}
	}

	canBuy := (rm.phase == RoundPhaseFreeze || rm.phase == RoundPhaseLive) && now.Before(rm.buyEndsAt)
	return RoundState{
		Phase:            rm.phase,
		RoundNumber:      rm.displayRoundNumberLocked(),
		RoundsPlayed:     rm.roundsCompleted,
		RegulationRounds: rm.config.RegulationRounds,
		FirstToWin:       rm.config.FirstToWin,
		TimerSeconds:     timerSeconds,
		BuyTimeLeft:      buyTimeLeft,
		C4ExplosionIn:    c4ExplosionIn,
		CanMove:          rm.phase != RoundPhaseFreeze && rm.phase != RoundPhaseEnded && rm.phase != RoundPhaseMatchOver,
		CanShoot:         rm.phase != RoundPhaseFreeze && rm.phase != RoundPhaseEnded && rm.phase != RoundPhaseMatchOver,
		CanBuy:           canBuy,
		IsOvertime:       rm.overtime,
		MatchWinner:      rm.matchWinner,
		Teams:            rm.room.GetTeams(),
	}
}

func (rm *RoundManager) displayRoundNumberLocked() int {
	if rm.currentRound > 0 && rm.phase != RoundPhaseWaiting {
		return rm.currentRound
	}
	if rm.matchWinner != "" && rm.roundsCompleted > 0 {
		return rm.roundsCompleted
	}
	return rm.roundsCompleted + 1
}

func (rm *RoundManager) awardRoundMoney(winner string) {
	for _, p := range rm.room.GetPlayers() {
		playerTeam := team.NormalizeTeamID(p.GetTeam())
		if playerTeam == "" {
			continue
		}

		reward := balance.Get().Economy.RoundLossReward
		reason := "round_loss"
		if playerTeam == winner {
			reward = balance.Get().Economy.RoundWinReward
			reason = "round_win"
		}

		p.AddMoney(reward)
		rm.room.Broadcast("money_updated", map[string]interface{}{
			"player_id": p.ID,
			"money":     p.GetMoney(),
			"delta":     reward,
			"reason":    reason,
		}, "")
	}
}

func (rm *RoundManager) determineMVPLocked(winner string) *RoundMVP {
	var bestID string
	bestKills := -1
	bestDamage := -1

	for playerID, stats := range rm.roundStats {
		if stats.Kills > bestKills || (stats.Kills == bestKills && stats.Damage > bestDamage) {
			bestID = playerID
			bestKills = stats.Kills
			bestDamage = stats.Damage
		}
	}

	if bestID == "" {
		for _, participant := range rm.room.roundParticipants() {
			if team.NormalizeTeamID(participant.GetTeam()) == winner {
				bestID = participant.ID
				bestKills = 0
				bestDamage = 0
				break
			}
		}
	}

	if bestID == "" {
		return nil
	}

	current := rm.room.findParticipant(bestID)
	if current == nil {
		return nil
	}

	return &RoundMVP{
		PlayerID: bestID,
		Name:     current.Name,
		Kills:    max(bestKills, 0),
		Damage:   max(bestDamage, 0),
	}
}

func (rm *RoundManager) applyHalftimeSideSwitch() {
	rm.mu.Lock()
	if rm.closed || rm.teamsSwapped {
		rm.mu.Unlock()
		return
	}
	rm.teamsSwapped = true
	rm.mu.Unlock()

	players := rm.room.switchSides()
	teams := rm.room.GetTeams()

	for _, changed := range players {
		rm.room.Broadcast("team_changed", map[string]interface{}{
			"player_id": changed.PlayerID,
			"team":      changed.Team,
			"teams":     teams,
		}, "")
	}

	rm.broadcastRoundState()
}

func (rm *RoundManager) resetParticipantsForRound() {
	rm.mu.Lock()
	rm.clearC4ExplosionStateLocked()
	rm.mu.Unlock()

	for _, participant := range rm.room.roundParticipants() {
		teamID := team.NormalizeTeamID(participant.GetTeam())
		if teamID == "" {
			continue
		}

		spawn := SpawnPositionForTeam(teamID)
		participant.Respawn(spawn.X, spawn.Y, spawn.Z)
		ApplyRespawnLoadout(participant)
		state := participant.Snapshot()

		rm.room.Broadcast("player_respawned", map[string]interface{}{
			"player_id": participant.ID,
			"position":  state.Position,
			"health":    state.Health,
			"ammo":      state.Ammo,
		}, "")
		rm.room.Broadcast("weapon_changed", map[string]interface{}{
			"player_id": participant.ID,
			"weapon":    state.Weapon,
			"reason":    "round_reset",
		}, "")
	}
}

func (rm *RoundManager) clearC4ExplosionStateLocked() {
	rm.room.SetC4Planted(false, "", player.Position{})
	rm.c4ExplosionAt = time.Time{}
	if rm.c4ExplosionTimer != nil {
		rm.c4ExplosionTimer.Stop()
		rm.c4ExplosionTimer = nil
	}
}

func (rm *RoundManager) broadcastRoundState() {
	if rm.room == nil {
		return
	}
	rm.room.Broadcast("round_state", rm.Snapshot(), "")
}

func (rm *RoundManager) startStateTicker() {
	stop := make(chan struct{})

	rm.mu.Lock()
	if rm.closed {
		rm.mu.Unlock()
		close(stop)
		return
	}
	if rm.stateTickerStop != nil {
		rm.mu.Unlock()
		close(stop)
		return
	}
	rm.stateTickerStop = stop
	rm.mu.Unlock()

	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				rm.broadcastRoundState()
			case <-stop:
				return
			}
		}
	}()
}

func (rm *RoundManager) stopStateTicker() {
	rm.mu.Lock()
	stop := rm.stateTickerStop
	rm.stateTickerStop = nil
	rm.mu.Unlock()

	if stop != nil {
		close(stop)
	}
}

func (rm *RoundManager) stopTimersLocked() {
	if rm.phaseTimer != nil {
		rm.phaseTimer.Stop()
		rm.phaseTimer = nil
	}
	if rm.nextRoundTimer != nil {
		rm.nextRoundTimer.Stop()
		rm.nextRoundTimer = nil
	}
	if rm.c4ExplosionTimer != nil {
		rm.c4ExplosionTimer.Stop()
		rm.c4ExplosionTimer = nil
	}
}

func (r *Room) roundParticipants() []*player.Player {
	players := make([]*player.Player, 0, r.GetPlayerCount()+len(r.GetBots()))

	for _, current := range r.GetPlayers() {
		if team.NormalizeTeamID(current.GetTeam()) == "" {
			continue
		}
		players = append(players, current)
	}
	for _, bot := range r.GetBots() {
		if bot == nil || bot.Player == nil || team.NormalizeTeamID(bot.Player.GetTeam()) == "" {
			continue
		}
		players = append(players, bot.Player)
	}

	return players
}

func (r *Room) findParticipant(playerID string) *player.Player {
	if playerID == "" {
		return nil
	}
	if current := r.GetPlayer(playerID); current != nil {
		return current
	}
	for _, bot := range r.GetBots() {
		if bot != nil && bot.Player != nil && bot.Player.ID == playerID {
			return bot.Player
		}
	}
	return nil
}

func (r *Room) teamCombatState() (map[string]int, map[string]int) {
	total := map[string]int{
		team.TeamCounterTerrorists: 0,
		team.TeamTerrorists:        0,
	}
	alive := map[string]int{
		team.TeamCounterTerrorists: 0,
		team.TeamTerrorists:        0,
	}

	for _, participant := range r.roundParticipants() {
		teamID := team.NormalizeTeamID(participant.GetTeam())
		if teamID == "" {
			continue
		}
		total[teamID]++
		if participant.IsAlive() {
			alive[teamID]++
		}
	}

	return total, alive
}

func (r *Room) switchSides() []sideSwapPlayer {
	changes := make([]sideSwapPlayer, 0)
	counts := map[string]int{
		team.TeamCounterTerrorists: 0,
		team.TeamTerrorists:        0,
	}

	for _, current := range r.GetPlayers() {
		nextTeam := oppositeTeam(current.GetTeam())
		if nextTeam == "" {
			continue
		}
		current.SetTeam(nextTeam)
		counts[nextTeam]++
		changes = append(changes, sideSwapPlayer{PlayerID: current.ID, Team: nextTeam})
	}
	for _, bot := range r.GetBots() {
		if bot == nil || bot.Player == nil {
			continue
		}
		nextTeam := oppositeTeam(bot.Player.GetTeam())
		if nextTeam == "" {
			continue
		}
		bot.Player.SetTeam(nextTeam)
		changes = append(changes, sideSwapPlayer{PlayerID: bot.Player.ID, Team: nextTeam})
	}

	r.TeamManager.SyncPlayerCounts(counts)
	return changes
}

func oppositeTeam(teamID string) string {
	switch team.NormalizeTeamID(teamID) {
	case team.TeamCounterTerrorists:
		return team.TeamTerrorists
	case team.TeamTerrorists:
		return team.TeamCounterTerrorists
	default:
		return ""
	}
}

func teamLabel(teamID string) string {
	switch team.NormalizeTeamID(teamID) {
	case team.TeamCounterTerrorists:
		return "CT"
	case team.TeamTerrorists:
		return "T"
	default:
		return "Unknown"
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
