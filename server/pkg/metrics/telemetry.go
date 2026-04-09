// Package metrics provides lightweight gameplay telemetry for product decisions.
package metrics

import (
	"log"
	"sync"
	"time"
)

// Metrics holds gameplay telemetry data.
type Metrics struct {
	mu sync.RWMutex

	// 连接统计
	TotalJoins        int64
	JoinSuccesses     int64
	JoinFailures      int64
	ActiveConnections int64

	// 对局统计
	MatchesStarted   int64
	MatchesCompleted int64
	TotalMatchTime   time.Duration
	Disconnects      int64

	// 游戏模式使用
	ModeUsage map[string]int64

	// 武器使用
	WeaponUsage map[string]int64

	// 平台统计 (mobile/desktop)
	PlatformUsage map[string]int64

	// 击杀统计
	TotalKills   int64
	HeadshotKills int64

	// 每小时统计 (用于计算速率)
	hourlyStats map[string]*HourlyMetric
}

// HourlyMetric tracks metrics per hour.
type HourlyMetric struct {
	Count     int64
	LastReset time.Time
}

// Global metrics instance.
var global *Metrics

func init() {
	global = &Metrics{
		ModeUsage:     make(map[string]int64),
		WeaponUsage:   make(map[string]int64),
		PlatformUsage: make(map[string]int64),
		hourlyStats:   make(map[string]*HourlyMetric),
	}
}

// Get returns the global metrics instance.
func Get() *Metrics {
	return global
}

// RecordJoin records a join attempt.
func (m *Metrics) RecordJoin(success bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.TotalJoins++
	if success {
		m.JoinSuccesses++
	} else {
		m.JoinFailures++
	}
}

// RecordConnection records an active connection change.
func (m *Metrics) RecordConnection(connected bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if connected {
		m.ActiveConnections++
	} else {
		m.ActiveConnections--
		if m.ActiveConnections < 0 {
			m.ActiveConnections = 0
		}
	}
}

// RecordDisconnect records a player disconnect.
func (m *Metrics) RecordDisconnect() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.Disconnects++
}

// RecordMatchStart records a match start.
func (m *Metrics) RecordMatchStart(mode string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.MatchesStarted++
	if mode != "" {
		m.ModeUsage[mode]++
	}
}

// RecordMatchEnd records a match completion.
func (m *Metrics) RecordMatchEnd(duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.MatchesCompleted++
	m.TotalMatchTime += duration
}

// RecordWeaponUse records weapon usage.
func (m *Metrics) RecordWeaponUse(weapon string) {
	if weapon == "" {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	m.WeaponUsage[weapon]++
}

// RecordKill records a kill.
func (m *Metrics) RecordKill(headshot bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.TotalKills++
	if headshot {
		m.HeadshotKills++
	}
}

// RecordPlatform records client platform (mobile/desktop).
func (m *Metrics) RecordPlatform(platform string) {
	if platform == "" {
		platform = "unknown"
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	m.PlatformUsage[platform]++
}

// Snapshot returns a snapshot of current metrics.
func (m *Metrics) Snapshot() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	avgMatchTime := time.Duration(0)
	if m.MatchesCompleted > 0 {
		avgMatchTime = m.TotalMatchTime / time.Duration(m.MatchesCompleted)
	}

	joinRate := float64(0)
	if m.TotalJoins > 0 {
		joinRate = float64(m.JoinSuccesses) / float64(m.TotalJoins) * 100
	}

	disconnectRate := float64(0)
	if m.MatchesStarted > 0 {
		disconnectRate = float64(m.Disconnects) / float64(m.MatchesStarted) * 100
	}

	headshotRate := float64(0)
	if m.TotalKills > 0 {
		headshotRate = float64(m.HeadshotKills) / float64(m.TotalKills) * 100
	}

	// Copy maps
	modeUsage := make(map[string]int64)
	for k, v := range m.ModeUsage {
		modeUsage[k] = v
	}

	weaponUsage := make(map[string]int64)
	for k, v := range m.WeaponUsage {
		weaponUsage[k] = v
	}

	platformUsage := make(map[string]int64)
	for k, v := range m.PlatformUsage {
		platformUsage[k] = v
	}

	return map[string]interface{}{
		"connections": map[string]interface{}{
			"total_joins":       m.TotalJoins,
			"join_successes":    m.JoinSuccesses,
			"join_failures":     m.JoinFailures,
			"join_success_rate": joinRate,
			"active":            m.ActiveConnections,
		},
		"matches": map[string]interface{}{
			"started":           m.MatchesStarted,
			"completed":         m.MatchesCompleted,
			"avg_duration_secs": avgMatchTime.Seconds(),
			"disconnects":       m.Disconnects,
			"disconnect_rate":   disconnectRate,
		},
		"gameplay": map[string]interface{}{
			"total_kills":    m.TotalKills,
			"headshot_kills": m.HeadshotKills,
			"headshot_rate":  headshotRate,
		},
		"usage": map[string]interface{}{
			"modes":    modeUsage,
			"weapons":  weaponUsage,
			"platform": platformUsage,
		},
	}
}

// LogSnapshot logs current metrics.
func (m *Metrics) LogSnapshot() {
	snapshot := m.Snapshot()
	log.Printf("[TELEMETRY] Metrics snapshot: %+v", snapshot)
}

// Reset resets all metrics (useful for testing).
func (m *Metrics) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.TotalJoins = 0
	m.JoinSuccesses = 0
	m.JoinFailures = 0
	m.ActiveConnections = 0
	m.MatchesStarted = 0
	m.MatchesCompleted = 0
	m.TotalMatchTime = 0
	m.Disconnects = 0
	m.TotalKills = 0
	m.HeadshotKills = 0

	m.ModeUsage = make(map[string]int64)
	m.WeaponUsage = make(map[string]int64)
	m.PlatformUsage = make(map[string]int64)
}
