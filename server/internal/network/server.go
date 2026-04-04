package network

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode"

	"fps-game/internal/ai"
	"fps-game/internal/economy"
	"fps-game/internal/hitbox"
	"fps-game/internal/player"
	"fps-game/internal/room"
	"fps-game/internal/team"

	"github.com/gorilla/websocket"
)

func init() {
	// 初始化随机数种子
	rand.Seed(time.Now().UnixNano())
}

const (
	writeWait                  = 10 * time.Second
	pongWait                   = 90 * time.Second // 增加到 90 秒
	pingPeriod                 = (pongWait * 9) / 10
	maxMessageSize             = 4096
	maxPlayerName              = 32  // 玩家名称最大长度
	maxChatMessage             = 256 // 聊天消息最大长度
	minPlayerName              = 1   // 玩家名称最小长度
	maxAuthoritativeCoordinate = 100.0
	respawnCoordinateLimit     = 50.0
)

// C4 progress constants (in milliseconds)
const (
	C4PlantTime         = 3200 * time.Millisecond
	C4DefuseTime        = 5000 * time.Millisecond
	C4DefuseTimeWithKit = 2500 * time.Millisecond
	C4ProgressInterval  = 50 * time.Millisecond
)

var respawnDelay = 3 * time.Second

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

type moveRequest struct {
	X        *float64 `json:"x"`
	Y        *float64 `json:"y"`
	Z        *float64 `json:"z"`
	Rotation *float64 `json:"rotation"`
}

type vectorRequest struct {
	X *float64 `json:"x"`
	Y *float64 `json:"y"`
	Z *float64 `json:"z"`
}

type shootRequest struct {
	Pitch     *float64       `json:"pitch"`
	Direction *vectorRequest `json:"direction"`
}

// Client 客户端连接
type Client struct {
	Conn         *websocket.Conn
	Player       *player.Player
	Room         *room.Room
	Send         chan []byte
	hub          *Hub
	msgRateLimit *RateLimiter // 消息频率限制器
	// C4 progress tracking
	c4Planting     bool
	c4Defusing     bool
	c4Progress     float64
	c4StartPos     player.Position
	c4CancelChan   chan struct{}
	c4ProgressMu   sync.Mutex
}

// RateLimiter 简单的令牌桶频率限制器
type RateLimiter struct {
	tokens     int
	maxTokens  int
	refillRate time.Duration
	lastRefill time.Time
	mu         sync.Mutex
}

// NewRateLimiter 创建频率限制器
func NewRateLimiter(maxTokens int, refillRate time.Duration) *RateLimiter {
	return &RateLimiter{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

// Allow 检查是否允许请求
func (r *RateLimiter) Allow() bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	// 补充令牌
	now := time.Now()
	elapsed := now.Sub(r.lastRefill)
	if elapsed >= r.refillRate {
		r.tokens = r.maxTokens
		r.lastRefill = now
	}

	// 检查并消耗令牌
	if r.tokens > 0 {
		r.tokens--
		return true
	}
	return false
}

// Hub 连接中心
type Hub struct {
	clients    map[*Client]bool
	clientMap  map[string]*Client // playerID -> Client
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// NewHub 创建 Hub
// GetClientCount 获取客户端数量（线程安全）
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		clientMap:  make(map[string]*Client),
		register:   make(chan *Client, 256),
		unregister: make(chan *Client, 256),
	}
}

// Run 运行 Hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.clientMap[client.Player.ID] = client
			h.mu.Unlock()
			log.Printf("Client connected: %s (total: %d)", client.Player.ID, len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				delete(h.clientMap, client.Player.ID)
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("Client disconnected: %s (total: %d)", client.Player.ID, len(h.clients))
		}
	}
}

// GetClient 获取客户端
func (h *Hub) GetClient(playerID string) *Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.clientMap[playerID]
}

// InterruptC4Action 中断玩家的 C4 操作（用于受伤时）
func (h *Hub) InterruptC4Action(playerID string, reason string) {
	h.mu.RLock()
	client, ok := h.clientMap[playerID]
	h.mu.RUnlock()

	if ok && client != nil {
		client.c4ProgressMu.Lock()
		planting := client.c4Planting
		defusing := client.c4Defusing
		cancelChan := client.c4CancelChan
		if planting {
			client.c4Planting = false
		}
		if defusing {
			client.c4Defusing = false
		}
		client.c4Progress = 0
		if cancelChan != nil {
			select {
			case <-cancelChan:
				// already closed
			default:
				close(cancelChan)
			}
			if planting {
				client.c4CancelChan = nil
			}
			if defusing {
				client.c4CancelChan = nil
			}
		}
		client.c4ProgressMu.Unlock()

		// 广播取消
		if planting {
			client.hub.BroadcastToRoom(client.Room, "c4_plant_cancel", map[string]interface{}{
				"player_id": playerID,
				"reason":    reason,
			}, "")
		}
		if defusing {
			client.hub.BroadcastToRoom(client.Room, "c4_defuse_cancel", map[string]interface{}{
				"player_id": playerID,
				"reason":    reason,
			}, "")
		}
	}
}

// Broadcast 广播消息给所有客户端
func (h *Hub) Broadcast(msgType string, data interface{}) {
	msg := NewMessage(msgType, data)
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.Send <- msg.ToJSON():
		default:
			// 缓冲区满，跳过
		}
	}
}

// BroadcastToRoom 广播消息给房间内所有玩家
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
	if r == nil {
		return
	}
	msg := NewMessage(msgType, data)
	h.mu.RLock()
	defer h.mu.RUnlock()

	playerIDs := r.GetPlayerIDs()

	// 只在非移动消息时打印日志
	if msgType != "player_moved" && msgType != "move" {
		log.Printf("[DEBUG] BroadcastToRoom: type=%s, players=%d", msgType, len(playerIDs))
	}

	// 使用 GetPlayerIDs 获取线程安全的玩家列表
	for _, playerID := range playerIDs {
		if playerID == excludeID {
			continue
		}
		if client, ok := h.clientMap[playerID]; ok {
			select {
			case client.Send <- msg.ToJSON():
				// 成功发送
			default:
				log.Printf("[WARN] BroadcastToRoom: buffer full for %s, dropping message", playerID)
			}
		}
	}
}

// Message 消息结构
type Message struct {
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	Timestamp int64           `json:"timestamp"`
}

// NewMessage 创建消息
func NewMessage(msgType string, data interface{}) *Message {
	jsonData, err := json.Marshal(data)
	if err != nil {
		// 序列化失败时返回空数据
		jsonData = []byte("{}")
	}
	return &Message{
		Type:      msgType,
		Data:      jsonData,
		Timestamp: time.Now().UnixMilli(),
	}
}

// ToJSON 转换为 JSON
func (m *Message) ToJSON() []byte {
	data, err := json.Marshal(m)
	if err != nil {
		return []byte("{}")
	}
	return data
}

func mustMarshal(v interface{}) json.RawMessage {
	data, err := json.Marshal(v)
	if err != nil {
		return json.RawMessage("{}")
	}
	return data
}

// ServeWS 处理 WebSocket 连接
func ServeWS(hub *Hub, roomManager *room.Manager, matcher interface{}, allowedOrigins []string, w http.ResponseWriter, r *http.Request) {
	var upgrader = websocket.Upgrader{
		ReadBufferSize:  8192,
		WriteBufferSize: 8192,
		CheckOrigin: func(r *http.Request) bool {
			// 如果没有配置允许的域名，则只允许同源（生产环境应配置）
			if len(allowedOrigins) == 0 {
				origin := r.Header.Get("Origin")
				// 开发环境：允许 localhost 和文件协议
				return origin == "" || strings.HasPrefix(origin, "http://localhost") || strings.HasPrefix(origin, "http://127.0.0.1")
			}
			// 生产环境：检查白名单
			origin := r.Header.Get("Origin")
			for _, allowed := range allowedOrigins {
				if allowed == origin {
					return true
				}
			}
			return false
		},
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	HandleConnection(conn, hub, roomManager)
}

// HandleConnection 处理连接
func HandleConnection(conn *websocket.Conn, hub *Hub, roomManager *room.Manager) {
	client := &Client{
		Conn:         conn,
		Player:       player.NewPlayer(),
		Send:         make(chan []byte, 512), // 增加缓冲区
		hub:          hub,
		msgRateLimit: NewRateLimiter(30, time.Second), // 每秒最多30条消息
	}

	log.Printf("[DEBUG] New connection, player ID: %s", client.Player.ID)

	// 注册客户端
	hub.register <- client

	// 发送欢迎消息
	client.Send <- NewMessage("welcome", map[string]string{
		"player_id": client.Player.ID,
		"message":   "Welcome to FPS Game!",
	}).ToJSON()

	// 启动读写协程
	go client.writePump()
	go client.readPump(roomManager)
}

// readPump 读取消息
func (c *Client) readPump(roomManager *room.Manager) {
	defer func() {
		if c.Room != nil {
			c.handleLeaveRoom(roomManager)
		}
		c.hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			log.Printf("[DEBUG] Read error from %s: %v", c.Player.ID, err)
			break
		}

		// 频率限制检查（心跳和移动消息除外）
		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("[WARN] Unmarshal error: %v", err)
			continue
		}

		if msg.Type != "move" && msg.Type != "heartbeat" {
			// 检查频率限制
			if !c.msgRateLimit.Allow() {
				log.Printf("[WARN] Rate limit exceeded for player %s", c.Player.ID)
				c.Send <- NewMessage("error", map[string]string{
					"message": "Rate limit exceeded, please slow down",
				}).ToJSON()
				continue
			}
			log.Printf("[DEBUG] Message: %s from %s", msg.Type, c.Player.ID)
		}

		c.handleMessage(msg, roomManager)
	}
}

// writePump 写入消息
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)

			// 批量发送
			n := len(c.Send)
			for i := 0; i < n; i++ {
				_, _ = w.Write([]byte{'\n'})
				_, _ = w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage 处理消息
func (c *Client) handleMessage(msg Message, roomManager *room.Manager) {
	switch msg.Type {
	case "heartbeat":
		// 心跳消息，只记录日志
		log.Printf("[DEBUG] Heartbeat from %s", c.Player.ID)
		// 重置读取超时
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	case "join_room":
		c.handleJoinRoom(msg.Data, roomManager)
	case "leave_room":
		c.handleLeaveRoom(roomManager)
	case "move":
		c.handleMove(msg.Data, roomManager)
	case "shoot":
		c.handleShoot(msg.Data, roomManager)
	case "reload":
		c.handleReload()
	case "chat":
		c.handleChat(msg.Data, roomManager)
	case "respawn":
		c.handleRespawn(msg.Data, roomManager)
	// 武器系统
	case "weapon_change":
		c.handleWeaponChange(msg.Data)
	case "buy":
		c.handleBuy(msg.Data)
	// 语音系统
	case "voice_start":
		c.handleVoiceStart()
	case "voice_stop":
		c.handleVoiceStop()
	case "voice_data":
		c.handleVoiceData(msg.Data)
	// 队伍系统
	case "team_join":
		c.handleTeamJoin(msg.Data, roomManager)
	// 投掷物
	case "grenade_throw":
		c.handleGrenadeThrow(msg.Data, roomManager)
	case "grenade_explode":
		c.handleGrenadeExplode(msg.Data, roomManager)
	case "molotov_explode":
		c.handleMolotovExplode(msg.Data, roomManager)
	case "decoy_detonate":
		c.handleDecoyDetonate(msg.Data, roomManager)
	// C4 爆破模式
	case "c4_plant":
		c.handleC4Plant(msg.Data, roomManager)
	case "c4_plant_start":
		c.handleC4PlantStart(msg.Data, roomManager)
	case "c4_plant_cancel":
		c.handleC4PlantCancel()
	case "c4_defuse":
		c.handleC4Defuse(roomManager)
	case "c4_defuse_start":
		c.handleC4DefuseStart(roomManager)
	case "c4_defuse_cancel":
		c.handleC4DefuseCancel()
	// 技能系统
	case "skill_use":
		c.handleSkillUse(msg.Data, roomManager)
	// 表情系统
	case "emote":
		c.handleEmote(msg.Data, roomManager)
	// 标记系统
	case "ping":
		c.handlePing(msg.Data, roomManager)
	// AI 机器人
	case "add_bot":
		c.handleAddBot(msg.Data)
	case "remove_bot":
		c.handleRemoveBot(msg.Data)
	}
}

func (c *Client) handleJoinRoom(data json.RawMessage, roomManager *room.Manager) {
	var req struct {
		RoomID string `json:"room_id"`
		Name   string `json:"name"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	// 验证玩家名称
	name := strings.TrimSpace(req.Name)
	if len(name) < minPlayerName || len(name) > maxPlayerName {
		c.Send <- NewMessage("error", map[string]string{
			"message": fmt.Sprintf("Player name must be between %d and %d characters", minPlayerName, maxPlayerName),
		}).ToJSON()
		return
	}
	// 验证名称字符（只允许字母、数字、中文和空格）
	for _, r := range name {
		if !unicode.IsLetter(r) && !unicode.IsNumber(r) && !unicode.IsSpace(r) && r != '_' && r != '-' {
			c.Send <- NewMessage("error", map[string]string{
				"message": "Player name can only contain letters, numbers, spaces, underscores and hyphens",
			}).ToJSON()
			return
		}
	}

	c.Player.SetName(name)

	var r *room.Room
	if req.RoomID != "" {
		r = roomManager.GetRoom(req.RoomID)
	}
	if r == nil {
		r = roomManager.CreateRoom()
	}

	// 检查房间是否创建成功（可能因达到上限而返回 nil）
	if r == nil {
		c.Send <- NewMessage("error", map[string]string{
			"message": "Server is full, cannot create new room",
		}).ToJSON()
		return
	}

	if !roomManager.JoinPlayer(c.Player, r.ID) {
		c.Send <- NewMessage("error", map[string]string{
			"message": "Room is full",
		}).ToJSON()
		return
	}

	c.Room = r
	r.SetBroadcaster(func(msgType string, data interface{}, excludeID string) {
		c.hub.BroadcastToRoom(r, msgType, data, excludeID)
	})

	// 发送房间信息给新玩家
	c.Send <- NewMessage("room_joined", map[string]interface{}{
		"room_id":      r.ID,
		"player_id":    c.Player.ID,
		"players":      r.GetPlayerList(),
		"teams":        r.GetTeams(),
		"round_state":  r.RoundManager.Snapshot(),
		"player_count": r.GetPlayerCount(),
		"max_size":     r.MaxSize,
	}).ToJSON()

	// 广播给房间内其他玩家
	c.hub.BroadcastToRoom(r, "player_joined", map[string]interface{}{
		"player_id": c.Player.ID,
		"name":      c.Player.Name,
		"position":  c.Player.Position,
		"team":      c.Player.GetTeam(),
		"weapon":    c.Player.Snapshot().Weapon,
	}, c.Player.ID)
}

func (c *Client) handleLeaveRoom(roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	r := c.Room

	// 广播离开消息
	c.hub.BroadcastToRoom(r, "player_left", map[string]string{
		"player_id": c.Player.ID,
	}, c.Player.ID)

	// 移除玩家
	r.RemovePlayer(c.Player.ID)
	roomManager.LeaveRoom(c.Player.ID)

	// 如果房间空了，移除房间
	if r.GetPlayerCount() == 0 {
		roomManager.RemoveRoom(r.ID)
	} else if r.RoundManager != nil {
		r.RoundManager.HandleRosterChanged()
	}

	c.Room = nil
}

func (c *Client) handleMove(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var req moveRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}
	if req.X == nil || req.Z == nil {
		return
	}
	if !isFiniteFloat(*req.X) || !isFiniteFloat(*req.Z) {
		return
	}

	// 移动会中断 C4 操作
	c.c4ProgressMu.Lock()
	if c.c4Planting || c.c4Defusing {
		planting := c.c4Planting
		defusing := c.c4Defusing
		c.c4Planting = false
		c.c4Defusing = false
		c.c4Progress = 0
		if c.c4CancelChan != nil {
			close(c.c4CancelChan)
			c.c4CancelChan = nil
		}
		c.c4ProgressMu.Unlock()
		
		if planting {
			c.hub.BroadcastToRoom(c.Room, "c4_plant_cancel", map[string]interface{}{
				"player_id": c.Player.ID,
				"reason":    "moved",
			}, "")
		}
		if defusing {
			c.hub.BroadcastToRoom(c.Room, "c4_defuse_cancel", map[string]interface{}{
				"player_id": c.Player.ID,
				"reason":    "moved",
			}, "")
		}
	} else {
		c.c4ProgressMu.Unlock()
	}

	current := c.Player.Snapshot()
	x, z := current.Position.X, current.Position.Z
	if c.Room.RoundManager == nil || c.Room.RoundManager.CanMove() {
		x, z = clampAuthoritativePosition(*req.X, *req.Z)
	}
	rotation := current.Rotation
	if req.Rotation != nil {
		if !isFiniteFloat(*req.Rotation) {
			return
		}
		rotation = *req.Rotation
	}

	c.Player.SetPosition(x, current.Position.Y, z)
	c.Player.SetRotation(rotation)

	updated := c.Player.Snapshot()

	// 广播给其他玩家
	c.hub.BroadcastToRoom(c.Room, "player_moved", map[string]interface{}{
		"player_id": c.Player.ID,
		"position":  updated.Position,
		"rotation":  updated.Rotation,
	}, c.Player.ID)

	// 检查火焰伤害
	c.checkFireDamage(updated.Position)
}

// checkFireDamage 检查并应用火焰伤害
func (c *Client) checkFireDamage(pos player.Position) {
	if c.Room == nil {
		return
	}

	fireZones := c.Room.GetFireZones()
	now := time.Now()

	for _, fire := range fireZones {
		// 检查是否过期
		if now.Sub(fire.StartTime) >= fire.Duration {
			continue
		}

		// 检查距离
		dx := pos.X - fire.Position.X
		dy := pos.Y - fire.Position.Y
		dz := pos.Z - fire.Position.Z
		distance := math.Sqrt(dx*dx + dy*dy + dz*dz)

		if distance <= fire.Radius {
			// 计算伤害（基于距离和 DPS）
			damage := fire.DPS / 10 // 每次移动 tick 约 0.1 秒

			// 友军伤害减半
			if fire.AttackerTeam != "" && fire.AttackerTeam == c.Player.GetTeam() && c.Player.ID != fire.AttackerID {
				damage = damage / 2
			}

			remainingHealth := c.Player.TakeDamage(damage)

			// 广播受伤消息
			c.hub.BroadcastToRoom(c.Room, "player_damaged", map[string]interface{}{
				"player_id":        c.Player.ID,
				"attacker_id":      fire.AttackerID,
				"damage":           damage,
				"remaining_health": remainingHealth,
				"position":         pos,
				"is_fire":          true,
			}, "")

			// 检查击杀
			if remainingHealth <= 0 {
				c.hub.BroadcastToRoom(c.Room, "player_killed", map[string]interface{}{
					"victim_id":   c.Player.ID,
					"killer_id":   fire.AttackerID,
					"weapon":      "molotov",
					"is_headshot": false,
					"killer_pos":  fire.Position,
					"victim_pos":  pos,
				}, "")

				// 更新击杀统计（需要获取攻击者）
				if attacker := c.hub.GetClient(fire.AttackerID); attacker != nil {
					attacker.Player.AddKill(1)
				}
				c.Player.Die()
			}
			break // 每次移动只受一个火焰区域伤害
		}
	}

	// 清理过期火焰
	c.Room.CleanExpiredFireZones()
}

func (c *Client) handleShoot(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}
	if c.Room.RoundManager != nil && !c.Room.RoundManager.CanShoot() {
		return
	}

	var req shootRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	shooter := c.Player.Snapshot()
	direction, ok := resolveShootDirection(req, shooter.Rotation)
	if !ok {
		return
	}
	if !c.Player.CanShoot() || !c.Player.Shoot() {
		return
	}

	shooter = c.Player.Snapshot()
	weaponID := shooter.Weapon
	loadout, hasLoadout := team.GetWeaponLoadout(shooter.Team, weaponID)
	origin := hitbox.Position{
		X: shooter.Position.X,
		Y: shooter.Position.Y,
		Z: shooter.Position.Z,
	}

	// 广播射击事件（包含 weapon_id 和 direction，让其他客户端正确还原射击）
	c.hub.BroadcastToRoom(c.Room, "player_shot", map[string]interface{}{
		"player_id": c.Player.ID,
		"position":  shooter.Position,
		"rotation":  shooter.Rotation,
		"ammo":      shooter.Ammo,
		"weapon_id": weaponID,
		"direction": map[string]float64{"x": direction.X, "y": direction.Y, "z": direction.Z},
	}, c.Player.ID)

	weaponRange := 50.0
	baseDamage := 30
	if hasLoadout {
		weaponRange = loadout.Range
		baseDamage = loadout.Damage
	}

	hit := c.detectHit(origin, direction, weaponRange)
	if hit != nil {
		// 获取被击中的目标（玩家或机器人）
		var target *player.Player
		var isBot bool

		// 检查是否是机器人
		if strings.HasPrefix(hit.PlayerID, "bot_") {
			bots := c.Room.GetBots()
			for _, bot := range bots {
				if bot.Player.ID == hit.PlayerID {
					target = bot.Player
					isBot = true
					break
				}
			}
		} else {
			target = c.Room.GetPlayer(hit.PlayerID)
		}

		if target != nil && target.IsAlive() {
			// 获取目标护甲状态
			armor, hasHelmet := target.GetArmorState()

			// 计算伤害（带护甲减伤）
			damage, armorDamage := hitbox.CalculateDamage(baseDamage, hitbox.HitBoxType(hit.HitBoxType), hit.Distance, weaponRange, armor, hasHelmet)

			// 扣除护甲
			if armorDamage > 0 {
				newArmor := armor - armorDamage
				if newArmor < 0 {
					newArmor = 0
				}
				target.SetArmor(newArmor, hasHelmet)

				// 广播护甲更新
				c.hub.BroadcastToRoom(c.Room, "armor_updated", map[string]interface{}{
					"player_id":  hit.PlayerID,
					"armor":      newArmor,
					"has_helmet": hasHelmet,
				}, "")
			}

			remainingHealth := target.TakeDamage(damage)
			targetState := target.Snapshot()
			if c.Room.RoundManager != nil {
				c.Room.RoundManager.RecordDamage(c.Player.ID, damage)
			}

			// 中断目标的 C4 操作
			c.hub.InterruptC4Action(hit.PlayerID, "damaged")

			// 广播受伤消息（包含 attacker_position 用于显示受击方向指示）
			c.hub.BroadcastToRoom(c.Room, "player_damaged", map[string]interface{}{
				"player_id":         hit.PlayerID,
				"attacker_id":       c.Player.ID,
				"attacker_position": shooter.Position,
				"damage":            damage,
				"hitbox":            hit.HitBoxType,
				"remaining_health":  remainingHealth,
				"position":          targetState.Position,
				"is_bot":            isBot,
				"armor_damage":      armorDamage,
			}, "")

			// 检查死亡
			if remainingHealth <= 0 {
				// 更新击杀统计
				c.Player.AddKill(1)
				c.awardMoney(c.Player, economy.KillReward, "kill")
				target.Die()
				if c.Room.RoundManager != nil {
					c.Room.RoundManager.RecordKill(c.Player.ID)
				}

				c.hub.BroadcastToRoom(c.Room, "player_killed", map[string]interface{}{
					"victim_id":     hit.PlayerID,
					"killer_id":     c.Player.ID,
					"weapon_id":     weaponID,
					"hitbox":        hit.HitBoxType,
					"is_headshot":   hit.HitBoxType == "head",
					"kill_distance": hit.Distance,
					"is_bot":        isBot,
				}, "")

				if c.Room.RoundManager != nil {
					c.Room.RoundManager.HandleRosterChanged()
				}
			}
		}
	}
}

// HitResult 命中结果
type HitResult struct {
	PlayerID   string
	HitBoxType string
	Distance   float64
}

// detectHit 检测射击命中
func (c *Client) detectHit(origin, direction hitbox.Position, maxRange float64) *HitResult {
	if c.Room == nil {
		return nil
	}

	var closestHit *HitResult
	minDistance := math.MaxFloat64

	// 检查真实玩家（使用线程安全的方法获取玩家列表）
	players := c.Room.GetPlayers()
	for playerID, p := range players {
		if playerID == c.Player.ID {
			continue // 不打自己
		}

		for _, hb := range p.HitBoxes {
			worldPos := hitbox.Position{
				X: p.Position.X + hb.Offset.X,
				Y: p.Position.Y + hb.Offset.Y,
				Z: p.Position.Z + hb.Offset.Z,
			}

			// 使用返回 t 值的版本，检查射线是否在有效范围内
			t := hitbox.RaySphereIntersect(origin, direction, worldPos, hb.Radius)
			if t >= 0 && t <= maxRange {
				if t < minDistance {
					minDistance = t
					closestHit = &HitResult{
						PlayerID:   playerID,
						HitBoxType: hb.Type,
						Distance:   t,
					}
				}
			}
		}
	}

	// 检查 AI 机器人
	bots := c.Room.GetBots()
	for _, bot := range bots {
		for _, hb := range bot.Player.HitBoxes {
			worldPos := hitbox.Position{
				X: bot.Player.Position.X + hb.Offset.X,
				Y: bot.Player.Position.Y + hb.Offset.Y,
				Z: bot.Player.Position.Z + hb.Offset.Z,
			}

			// 使用返回 t 值的版本，检查射线是否在有效范围内
			t := hitbox.RaySphereIntersect(origin, direction, worldPos, hb.Radius)
			if t >= 0 && t <= maxRange {
				if t < minDistance {
					minDistance = t
					closestHit = &HitResult{
						PlayerID:   bot.Player.ID,
						HitBoxType: hb.Type,
						Distance:   t,
					}
				}
			}
		}
	}

	return closestHit
}

// respawnPlayer 重生玩家
func (c *Client) respawnPlayer(p *player.Player, respawnRoom *room.Room) {
	time.Sleep(respawnDelay)

	spawn := spawnPositionForTeam(p.GetTeam())
	p.Respawn(spawn.X, spawn.Y, spawn.Z)
	applyRespawnLoadout(p)
	state := p.Snapshot()

	c.hub.BroadcastToRoom(respawnRoom, "player_respawned", map[string]interface{}{
		"player_id":  p.ID,
		"position":   state.Position,
		"health":     state.Health,
		"armor":      state.Armor,
		"has_helmet": state.HasHelmet,
		"ammo":       state.Ammo,
	}, "")
	c.hub.BroadcastToRoom(respawnRoom, "weapon_changed", map[string]interface{}{
		"player_id": p.ID,
		"weapon":    state.Weapon,
	}, "")
}

func (c *Client) resetRoomForNextRound(respawnRoom *room.Room) {
	time.Sleep(respawnDelay)

	for _, p := range respawnRoom.GetPlayers() {
		teamID := team.NormalizeTeamID(p.GetTeam())
		if teamID == "" {
			continue
		}

		spawn := spawnPositionForTeam(teamID)
		p.Respawn(spawn.X, spawn.Y, spawn.Z)
		applyRespawnLoadout(p)
		state := p.Snapshot()

		c.hub.BroadcastToRoom(respawnRoom, "player_respawned", map[string]interface{}{
			"player_id":  p.ID,
			"position":   state.Position,
			"health":     state.Health,
			"armor":      state.Armor,
			"has_helmet": state.HasHelmet,
			"ammo":       state.Ammo,
		}, "")
		c.hub.BroadcastToRoom(respawnRoom, "weapon_changed", map[string]interface{}{
			"player_id": p.ID,
			"weapon":    state.Weapon,
		}, "")
	}

	respawnRoom.ResetRoundState()
}

func (c *Client) handleReload() {
	c.Player.Reload()
	c.Send <- NewMessage("reload", map[string]interface{}{
		"ammo":         c.Player.Ammo,
		"ammo_reserve": c.Player.AmmoReserve,
	}).ToJSON()
}

func (c *Client) handleChat(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		log.Printf("[DEBUG] handleChat: client not in room")
		return
	}

	var chat struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(data, &chat); err != nil {
		log.Printf("[DEBUG] handleChat unmarshal error: %v", err)
		return
	}

	// 验证聊天消息长度
	message := strings.TrimSpace(chat.Message)
	if len(message) == 0 {
		return
	}
	if len(message) > maxChatMessage {
		c.Send <- NewMessage("error", map[string]string{
			"message": fmt.Sprintf("Chat message too long (max %d characters)", maxChatMessage),
		}).ToJSON()
		return
	}

	log.Printf("[DEBUG] handleChat: %s says: %s, broadcasting to room", c.Player.Name, message)
	// 广播聊天消息
	c.hub.BroadcastToRoom(c.Room, "chat", map[string]string{
		"player_id": c.Player.ID,
		"name":      c.Player.Name,
		"message":   message,
	}, "")
}

func (c *Client) handleRespawn(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		c.Send <- NewMessage("error", map[string]string{
			"message": "You must join a room before respawning",
		}).ToJSON()
		return
	}
	if c.Player.IsAlive() {
		c.Send <- NewMessage("error", map[string]string{
			"message": "Cannot respawn while alive",
		}).ToJSON()
		return
	}
	if c.Room.RoundManager != nil {
		state := c.Room.RoundManager.Snapshot()
		if state.Phase != room.RoundPhaseWaiting && state.Phase != room.RoundPhaseMatchOver {
			c.Send <- NewMessage("error", map[string]string{
				"message": "Respawn is disabled while rounds are active",
			}).ToJSON()
			return
		}
	}
	spawn := spawnPositionForTeam(c.Player.GetTeam())
	c.Player.Respawn(spawn.X, spawn.Y, spawn.Z)
	applyRespawnLoadout(c.Player)
	state := c.Player.Snapshot()

	c.Send <- NewMessage("respawn", map[string]interface{}{
		"position":   state.Position,
		"health":     state.Health,
		"armor":      state.Armor,
		"has_helmet": state.HasHelmet,
		"ammo":       state.Ammo,
	}).ToJSON()

	// 广播重生（排除自己，因为已经收到 respawn 消息）
	c.hub.BroadcastToRoom(c.Room, "player_respawned", map[string]interface{}{
		"player_id":  c.Player.ID,
		"position":   state.Position,
		"health":     state.Health,
		"armor":      state.Armor,
		"has_helmet": state.HasHelmet,
	}, c.Player.ID)
}

func clampAuthoritativePosition(x, z float64) (float64, float64) {
	return clampCoordinate(x, maxAuthoritativeCoordinate), clampCoordinate(z, maxAuthoritativeCoordinate)
}

func clampCoordinate(v, limit float64) float64 {
	if v < -limit {
		return -limit
	}
	if v > limit {
		return limit
	}
	return v
}

func isFiniteFloat(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0)
}

func resolveShootDirection(req shootRequest, rotation float64) (hitbox.Position, bool) {
	pitch := 0.0
	if req.Pitch != nil {
		if !isFiniteFloat(*req.Pitch) {
			return hitbox.Position{}, false
		}
		pitch = *req.Pitch
	}

	if req.Direction != nil {
		if req.Direction.X == nil || req.Direction.Y == nil || req.Direction.Z == nil {
			return hitbox.Position{}, false
		}
		if !isFiniteFloat(*req.Direction.X) || !isFiniteFloat(*req.Direction.Y) || !isFiniteFloat(*req.Direction.Z) {
			return hitbox.Position{}, false
		}

		direction := hitbox.Position{
			X: *req.Direction.X,
			Y: *req.Direction.Y,
			Z: *req.Direction.Z,
		}
		dirLen := math.Sqrt(direction.X*direction.X + direction.Y*direction.Y + direction.Z*direction.Z)
		if dirLen == 0 {
			return hitbox.Position{}, false
		}
		direction.X /= dirLen
		direction.Y /= dirLen
		direction.Z /= dirLen
		return direction, true
	}

	return hitbox.Position{
		X: -math.Sin(rotation) * math.Cos(pitch),
		Y: math.Sin(pitch),
		Z: -math.Cos(rotation) * math.Cos(pitch),
	}, true
}

func spawnPositionForTeam(teamID string) player.Position {
	return room.SpawnPositionForTeam(teamID)
}

func applyRespawnLoadout(p *player.Player) {
	room.ApplyRespawnLoadout(p)
}

func (c *Client) sendMoneyUpdate(p *player.Player, delta int, reason string) {
	if p == nil {
		return
	}

	payload := map[string]interface{}{
		"player_id": p.ID,
		"money":     p.GetMoney(),
	}
	if delta != 0 {
		payload["delta"] = delta
	}
	if reason != "" {
		payload["reason"] = reason
	}

	if c.Room != nil {
		c.hub.BroadcastToRoom(c.Room, "money_updated", payload, "")
		return
	}

	target := c.hub.GetClient(p.ID)
	if target == nil {
		return
	}
	target.Send <- NewMessage("money_updated", payload).ToJSON()
}

func (c *Client) awardMoney(p *player.Player, amount int, reason string) {
	if p == nil || amount == 0 {
		return
	}

	p.AddMoney(amount)
	c.sendMoneyUpdate(p, amount, reason)
}

func (c *Client) awardRoundMoney(r *room.Room, winner string) {
	if r == nil {
		return
	}

	normalizedWinner := team.NormalizeTeamID(winner)
	for _, p := range r.GetPlayers() {
		playerTeam := team.NormalizeTeamID(p.GetTeam())
		if playerTeam == "" {
			continue
		}

		if playerTeam == normalizedWinner {
			c.awardMoney(p, economy.RoundWinReward, "round_win")
			continue
		}

		c.awardMoney(p, economy.RoundLossReward, "round_loss")
	}
}

// handleWeaponChange 处理武器切换
func (c *Client) handleWeaponChange(data json.RawMessage) {
	var req struct {
		Weapon   string `json:"weapon"`
		WeaponID string `json:"weapon_id"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	// 支持 weapon 和 weapon_id 两种字段
	weapon := req.Weapon
	if weapon == "" {
		weapon = req.WeaponID
	}
	if weapon == "" {
		return
	}

	teamID := c.Player.GetTeam()
	if teamID != "" && !team.CanTeamUseWeapon(teamID, weapon) {
		c.Send <- NewMessage("error", map[string]string{
			"message": "That weapon is not available for your team",
		}).ToJSON()
		return
	}

	loadout, ok := team.GetWeaponLoadout(teamID, weapon)
	if !ok {
		c.Send <- NewMessage("error", map[string]string{
			"message": "Unknown weapon",
		}).ToJSON()
		return
	}

	if teamID != "" && !c.Player.HasWeapon(loadout.ID) {
		c.Send <- NewMessage("error", map[string]string{
			"message": "You have not purchased that weapon yet",
		}).ToJSON()
		return
	}

	c.Player.ApplyLoadout(loadout.ID, loadout.MagazineSize, loadout.ReserveAmmo)

	// 广播武器切换
	c.hub.BroadcastToRoom(c.Room, "weapon_changed", map[string]interface{}{
		"player_id": c.Player.ID,
		"weapon":    loadout.ID,
	}, "")
}

// handleVoiceStart 处理语音开始
func (c *Client) handleVoiceStart() {
	if c.Room == nil {
		return
	}

	c.hub.BroadcastToRoom(c.Room, "voice_start", map[string]string{
		"playerId": c.Player.ID,
	}, c.Player.ID)
}

// handleVoiceStop 处理语音停止
func (c *Client) handleVoiceStop() {
	if c.Room == nil {
		return
	}

	c.hub.BroadcastToRoom(c.Room, "voice_stop", map[string]string{
		"playerId": c.Player.ID,
	}, c.Player.ID)
}

// handleVoiceData 处理语音数据
func (c *Client) handleVoiceData(data json.RawMessage) {
	if c.Room == nil {
		return
	}

	// 解析客户端发送的音频数据
	var voiceMsg struct {
		Audio string `json:"audio"`
	}
	if err := json.Unmarshal(data, &voiceMsg); err != nil {
		return
	}

	// 转发语音数据给房间内其他玩家
	c.hub.BroadcastToRoom(c.Room, "voice_data", map[string]interface{}{
		"playerId": c.Player.ID,
		"audio":    voiceMsg.Audio,
	}, c.Player.ID)
}

// handleTeamJoin 处理队伍加入
func (c *Client) handleTeamJoin(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var req struct {
		Team string `json:"team"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	assignedTeam, err := c.Room.JoinTeam(c.Player, req.Team)
	if err != nil {
		c.Send <- NewMessage("error", map[string]string{
			"message": err.Error(),
		}).ToJSON()
		return
	}

	c.Player.ResetOwnedWeapons(team.DefaultWeaponForTeam(assignedTeam))
	c.Player.SetWeapon(team.DefaultWeaponForTeam(assignedTeam))
	spawn := spawnPositionForTeam(assignedTeam)
	c.Player.Respawn(spawn.X, spawn.Y, spawn.Z)
	applyRespawnLoadout(c.Player)
	state := c.Player.Snapshot()
	teams := c.Room.GetTeams()

	c.hub.BroadcastToRoom(c.Room, "team_changed", map[string]interface{}{
		"player_id": c.Player.ID,
		"team":      assignedTeam,
		"teams":     teams,
	}, "")

	c.hub.BroadcastToRoom(c.Room, "weapon_changed", map[string]interface{}{
		"player_id": c.Player.ID,
		"weapon":    state.Weapon,
		"reason":    "team_join",
	}, "")

	c.hub.BroadcastToRoom(c.Room, "player_respawned", map[string]interface{}{
		"player_id":  c.Player.ID,
		"position":   state.Position,
		"health":     state.Health,
		"armor":      state.Armor,
		"has_helmet": state.HasHelmet,
		"ammo":       state.Ammo,
	}, "")
	if c.Room.RoundManager != nil {
		c.Room.RoundManager.HandleRosterChanged()
	}
}

func (c *Client) handleBuy(data json.RawMessage) {
	if c.Room == nil {
		c.Send <- NewMessage("error", map[string]string{
			"message": "You must join a room before buying",
		}).ToJSON()
		return
	}
	if c.Room.RoundManager != nil && !c.Room.RoundManager.CanBuy() {
		c.hub.BroadcastToRoom(c.Room, "buy_result", map[string]interface{}{
			"player_id": c.Player.ID,
			"success":   false,
			"message":   "Buy time is over",
		}, "")
		return
	}

	var req struct {
		ItemID string `json:"item_id"`
		Item   string `json:"item"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	itemID := req.ItemID
	if itemID == "" {
		itemID = req.Item
	}
	if itemID == "" {
		return
	}

	item, err := economy.ApplyPurchase(c.Player, itemID)
	if err != nil {
		c.hub.BroadcastToRoom(c.Room, "buy_result", map[string]interface{}{
			"player_id": c.Player.ID,
			"item_id":   itemID,
			"success":   false,
			"message":   err.Error(),
		}, "")
		return
	}

	c.sendMoneyUpdate(c.Player, -item.Price, "purchase")
	c.hub.BroadcastToRoom(c.Room, "buy_result", map[string]interface{}{
		"player_id": c.Player.ID,
		"item_id":   item.ID,
		"success":   true,
	}, "")
	if item.Category != economy.CategoryWeapon {
		return
	}

	state := c.Player.Snapshot()
	c.hub.BroadcastToRoom(c.Room, "weapon_changed", map[string]interface{}{
		"player_id": c.Player.ID,
		"weapon":    state.Weapon,
	}, "")
}

// handleGrenadeThrow 处理投掷物
func (c *Client) handleGrenadeThrow(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var req struct {
		Type string `json:"type"`
		Pos  struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			Z float64 `json:"z"`
		} `json:"position"`
		Vel struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			Z float64 `json:"z"`
		} `json:"velocity"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	// 扣除投掷物数量
	switch req.Type {
	case "flashbang":
		if c.Player.Flashbangs > 0 {
			c.Player.Flashbangs--
		} else {
			return // 没有闪光弹
		}
	case "he":
		if c.Player.HEGrenades > 0 {
			c.Player.HEGrenades--
		} else {
			return
		}
	case "smoke":
		if c.Player.SmokeGrenades > 0 {
			c.Player.SmokeGrenades--
		} else {
			return
		}
	}

	// 广播投掷物
	c.hub.BroadcastToRoom(c.Room, "grenade_thrown", map[string]interface{}{
		"player_id": c.Player.ID,
		"type":      req.Type,
		"position": map[string]float64{
			"x": req.Pos.X,
			"y": req.Pos.Y,
			"z": req.Pos.Z,
		},
		"velocity": map[string]float64{
			"x": req.Vel.X,
			"y": req.Vel.Y,
			"z": req.Vel.Z,
		},
	}, "")
}

// handleGrenadeExplode 处理投掷物爆炸（高爆手雷伤害）
func (c *Client) handleGrenadeExplode(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var req struct {
		Type     string `json:"type"`
		Position struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			Z float64 `json:"z"`
		} `json:"position"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	// 只处理高爆手雷
	if req.Type != "he" {
		return
	}

	// 高爆手雷参数
	const (
		maxDamage   = 98
		damageRadius = 8.0
		minDamage   = 1
	)

	// 获取所有玩家和机器人
	var targets []struct {
		id     string
		pos    player.Position
		health int
		p      *player.Player
	}

	// 玩家
	for _, p := range c.Room.GetPlayers() {
		if p.IsAlive() {
			state := p.Snapshot()
			targets = append(targets, struct {
				id     string
				pos    player.Position
				health int
				p      *player.Player
			}{id: p.ID, pos: state.Position, health: state.Health, p: p})
		}
	}

	// 机器人
	for _, bot := range c.Room.GetBots() {
		if bot.Player.IsAlive() {
			state := bot.Player.Snapshot()
			targets = append(targets, struct {
				id     string
				pos    player.Position
				health int
				p      *player.Player
			}{id: bot.Player.ID, pos: state.Position, health: state.Health, p: bot.Player})
		}
	}

	// 计算范围伤害
	for _, target := range targets {
		dx := target.pos.X - req.Position.X
		dy := target.pos.Y - req.Position.Y
		dz := target.pos.Z - req.Position.Z
		distance := math.Sqrt(dx*dx + dy*dy + dz*dz)

		if distance > damageRadius {
			continue
		}

		// 距离衰减：越远伤害越低
		damageMultiplier := 1.0 - (distance / damageRadius)
		damage := int(float64(maxDamage) * damageMultiplier)
		if damage < minDamage {
			damage = minDamage
		}

		// 友军伤害减半
		attackerTeam := c.Player.GetTeam()
		targetTeam := target.p.GetTeam()
		if attackerTeam != "" && attackerTeam == targetTeam && target.id != c.Player.ID {
			damage = damage / 2
		}

		// 造成伤害
		remainingHealth := target.p.TakeDamage(damage)

		// 广播受伤消息
		c.hub.BroadcastToRoom(c.Room, "player_damaged", map[string]interface{}{
			"player_id":        target.id,
			"attacker_id":      c.Player.ID,
			"damage":           damage,
			"remaining_health": remainingHealth,
			"position":         target.pos,
			"is_explosion":     true,
		}, "")

		// 检查击杀
		if remainingHealth <= 0 {
			c.hub.BroadcastToRoom(c.Room, "player_killed", map[string]interface{}{
				"victim_id":    target.id,
				"killer_id":    c.Player.ID,
				"weapon":       "he_grenade",
				"is_headshot":  false,
				"killer_pos":   c.Player.Snapshot().Position,
				"victim_pos":   target.pos,
			}, "")

			// 更新击杀统计
			c.Player.AddKill(1)
			target.p.Die()
		}
	}
}

// handleMolotovExplode 处理燃烧瓶爆炸
func (c *Client) handleMolotovExplode(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var req struct {
		Position struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			Z float64 `json:"z"`
		} `json:"position"`
		Duration int `json:"duration"` // 毫秒
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	// 广播火焰区域
	c.hub.BroadcastToRoom(c.Room, "molotov_fire", map[string]interface{}{
		"attacker_id": c.Player.ID,
		"position": map[string]float64{
			"x": req.Position.X,
			"y": req.Position.Y,
			"z": req.Position.Z,
		},
		"radius":    4.0,
		"duration":  req.Duration,
		"dps":       40, // 每秒40伤害
		"team":      c.Player.GetTeam(),
	}, "")

	// 创建火焰伤害区域
	fire := &room.FireZone{
		Position:     player.Position{X: req.Position.X, Y: req.Position.Y, Z: req.Position.Z},
		Radius:       4.0,
		StartTime:    time.Now(),
		Duration:     time.Duration(req.Duration) * time.Millisecond,
		DPS:          40,
		AttackerID:   c.Player.ID,
		AttackerTeam: c.Player.GetTeam(),
	}

	c.Room.AddFireZone(fire)
}

// handleDecoyDetonate 处理诱饵弹
func (c *Client) handleDecoyDetonate(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var req struct {
		Position struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			Z float64 `json:"z"`
		} `json:"position"`
		Duration int `json:"duration"` // 毫秒
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	// 广播诱饵弹位置给其他玩家
	c.hub.BroadcastToRoom(c.Room, "decoy_active", map[string]interface{}{
		"player_id": c.Player.ID,
		"position": map[string]float64{
			"x": req.Position.X,
			"y": req.Position.Y,
			"z": req.Position.Z,
		},
		"duration": req.Duration,
		"team":     c.Player.GetTeam(),
	}, "")
}

// handleC4Plant 处理 C4 放置 (旧版即时放置，保留兼容)
func (c *Client) handleC4Plant(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var req struct {
		Position struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			Z float64 `json:"z"`
		} `json:"position"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	// 转换为 player.Position
	pos := player.Position{
		X: req.Position.X,
		Y: req.Position.Y,
		Z: req.Position.Z,
	}

	// 设置房间 C4 状态
	c.Room.SetC4Planted(true, c.Player.ID, pos)

	c.hub.BroadcastToRoom(c.Room, "c4_planted", map[string]interface{}{
		"player_id": c.Player.ID,
		"position":  pos,
		"team":      c.Player.Team,
	}, "")
}

// handleC4PlantStart 开始 C4 安装进度
func (c *Client) handleC4PlantStart(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	// 检查是否已经在安装或拆除
	c.c4ProgressMu.Lock()
	if c.c4Planting || c.c4Defusing {
		c.c4ProgressMu.Unlock()
		return
	}

	// 检查回合状态
	if c.Room.RoundManager != nil && !c.Room.RoundManager.CanShoot() {
		c.c4ProgressMu.Unlock()
		c.Send <- NewMessage("error", map[string]string{
			"message": "Cannot plant during freeze time",
		}).ToJSON()
		return
	}

	// 检查 C4 是否已经安装
	if c.Room.IsC4Planted() {
		c.c4ProgressMu.Unlock()
		c.Send <- NewMessage("error", map[string]string{
			"message": "C4 already planted",
		}).ToJSON()
		return
	}

	// 只有 T 可以安装 C4
	if team.NormalizeTeamID(c.Player.GetTeam()) != team.TeamTerrorists {
		c.c4ProgressMu.Unlock()
		c.Send <- NewMessage("error", map[string]string{
			"message": "Only terrorists can plant C4",
		}).ToJSON()
		return
	}

	// 玩家必须存活
	if !c.Player.IsAlive() {
		c.c4ProgressMu.Unlock()
		return
	}

	var req struct {
		Position struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			Z float64 `json:"z"`
		} `json:"position"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.c4ProgressMu.Unlock()
		return
	}

	// 记录开始位置用于检测移动
	snapshot := c.Player.Snapshot()
	c.c4StartPos = snapshot.Position
	c.c4Planting = true
	c.c4Defusing = false
	c.c4Progress = 0
	c.c4CancelChan = make(chan struct{})
	c.c4ProgressMu.Unlock()

	// 广播开始安装
	c.hub.BroadcastToRoom(c.Room, "c4_plant_start", map[string]interface{}{
		"player_id": c.Player.ID,
		"position": map[string]float64{
			"x": req.Position.X,
			"y": req.Position.Y,
			"z": req.Position.Z,
		},
	}, "")

	// 开始安装进度
	go c.runC4PlantProgress(player.Position{
		X: req.Position.X,
		Y: req.Position.Y,
		Z: req.Position.Z,
	})
}

// runC4PlantProgress 运行 C4 安装进度
func (c *Client) runC4PlantProgress(targetPos player.Position) {
	ticker := time.NewTicker(C4ProgressInterval)
	defer ticker.Stop()

	startTime := time.Now()
	plantDuration := C4PlantTime

	for {
		select {
		case <-c.c4CancelChan:
			// 被取消
			return
		case <-ticker.C:
			// 检查玩家是否还活着
			if !c.Player.IsAlive() {
				c.cancelC4Plant("killed")
				return
			}

			// 检查是否移动了（允许小范围移动）
			snapshot := c.Player.Snapshot()
			dx := snapshot.Position.X - c.c4StartPos.X
			dz := snapshot.Position.Z - c.c4StartPos.Z
			if dx*dx+dz*dz > 0.25 { // 0.5m 移动限制
				c.cancelC4Plant("moved")
				return
			}

			// 更新进度
			elapsed := time.Since(startTime).Seconds()
			progress := (elapsed / plantDuration.Seconds()) * 100
			c.c4ProgressMu.Lock()
			c.c4Progress = progress
			c.c4ProgressMu.Unlock()

			// 广播进度
			c.hub.BroadcastToRoom(c.Room, "c4_plant_progress", map[string]interface{}{
				"player_id": c.Player.ID,
				"progress":  progress,
			}, "")

			// 检查是否完成
			if progress >= 100 {
				c.completeC4Plant(targetPos)
				return
			}
		}
	}
}

// cancelC4Plant 取消 C4 安装
func (c *Client) cancelC4Plant(reason string) {
	c.c4ProgressMu.Lock()
	if !c.c4Planting {
		c.c4ProgressMu.Unlock()
		return
	}
	c.c4Planting = false
	c.c4Progress = 0
	if c.c4CancelChan != nil {
		close(c.c4CancelChan)
		c.c4CancelChan = nil
	}
	c.c4ProgressMu.Unlock()

	// 广播取消
	c.hub.BroadcastToRoom(c.Room, "c4_plant_cancel", map[string]interface{}{
		"player_id": c.Player.ID,
		"reason":    reason,
	}, "")
}

// completeC4Plant 完成 C4 安装
func (c *Client) completeC4Plant(pos player.Position) {
	c.c4ProgressMu.Lock()
	c.c4Planting = false
	c.c4Progress = 100
	if c.c4CancelChan != nil {
		close(c.c4CancelChan)
		c.c4CancelChan = nil
	}
	c.c4ProgressMu.Unlock()

	// 设置房间 C4 状态
	c.Room.SetC4Planted(true, c.Player.ID, pos)

	// 广播完成
	c.hub.BroadcastToRoom(c.Room, "c4_planted", map[string]interface{}{
		"player_id": c.Player.ID,
		"position":  pos,
		"team":      c.Player.Team,
	}, "")

	// 触发 C4 爆炸计时
	if c.Room.RoundManager != nil {
		c.Room.RoundManager.HandleC4Planted(c.Player.ID)
	}
}

// handleC4PlantCancel 取消 C4 安装（客户端主动取消）
func (c *Client) handleC4PlantCancel() {
	c.c4ProgressMu.Lock()
	if c.c4Planting {
		c.c4Planting = false
		c.c4Progress = 0
		if c.c4CancelChan != nil {
			close(c.c4CancelChan)
			c.c4CancelChan = nil
		}
	}
	c.c4ProgressMu.Unlock()

	c.hub.BroadcastToRoom(c.Room, "c4_plant_cancel", map[string]interface{}{
		"player_id": c.Player.ID,
		"reason":    "cancelled",
	}, "")
}

// handleC4DefuseStart 开始 C4 拆除进度
func (c *Client) handleC4DefuseStart(roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	// 检查是否已经在安装或拆除
	c.c4ProgressMu.Lock()
	if c.c4Planting || c.c4Defusing {
		c.c4ProgressMu.Unlock()
		return
	}

	// 检查 C4 是否已安装
	if !c.Room.IsC4Planted() {
		c.c4ProgressMu.Unlock()
		c.Send <- NewMessage("error", map[string]string{
			"message": "No C4 to defuse",
		}).ToJSON()
		return
	}

	// 只有 CT 可以拆除 C4
	if team.NormalizeTeamID(c.Player.GetTeam()) != team.TeamCounterTerrorists {
		c.c4ProgressMu.Unlock()
		c.Send <- NewMessage("error", map[string]string{
			"message": "Only counter-terrorists can defuse C4",
		}).ToJSON()
		return
	}

	// 玩家必须存活
	if !c.Player.IsAlive() {
		c.c4ProgressMu.Unlock()
		return
	}

	// 记录开始位置用于检测移动
	snapshot := c.Player.Snapshot()
	c.c4StartPos = snapshot.Position
	c.c4Defusing = true
	c.c4Planting = false
	c.c4Progress = 0
	c.c4CancelChan = make(chan struct{})
	hasKit := c.Player.GetDefuseKit()
	c.c4ProgressMu.Unlock()

	// 广播开始拆除
	c.hub.BroadcastToRoom(c.Room, "c4_defuse_start", map[string]interface{}{
		"player_id":  c.Player.ID,
		"has_kit":    hasKit,
		"position":   c.Room.GetC4Position(),
	}, "")

	// 开始拆除进度
	go c.runC4DefuseProgress()
}

// runC4DefuseProgress 运行 C4 拆除进度
func (c *Client) runC4DefuseProgress() {
	ticker := time.NewTicker(C4ProgressInterval)
	defer ticker.Stop()

	startTime := time.Now()
	defuseDuration := C4DefuseTime
	if c.Player.GetDefuseKit() {
		defuseDuration = C4DefuseTimeWithKit
	}

	for {
		select {
		case <-c.c4CancelChan:
			// 被取消
			return
		case <-ticker.C:
			// 检查玩家是否还活着
			if !c.Player.IsAlive() {
				c.cancelC4Defuse("killed")
				return
			}

			// 检查是否移动了
			snapshot := c.Player.Snapshot()
			dx := snapshot.Position.X - c.c4StartPos.X
			dz := snapshot.Position.Z - c.c4StartPos.Z
			if dx*dx+dz*dz > 0.25 {
				c.cancelC4Defuse("moved")
				return
			}

			// 检查 C4 是否还存在
			if !c.Room.IsC4Planted() {
				c.cancelC4Defuse("exploded")
				return
			}

			// 更新进度
			elapsed := time.Since(startTime).Seconds()
			progress := (elapsed / defuseDuration.Seconds()) * 100
			c.c4ProgressMu.Lock()
			c.c4Progress = progress
			c.c4ProgressMu.Unlock()

			// 广播进度
			c.hub.BroadcastToRoom(c.Room, "c4_defuse_progress", map[string]interface{}{
				"player_id": c.Player.ID,
				"progress":  progress,
				"has_kit":   c.Player.GetDefuseKit(),
			}, "")

			// 检查是否完成
			if progress >= 100 {
				c.completeC4Defuse()
				return
			}
		}
	}
}

// cancelC4Defuse 取消 C4 拆除
func (c *Client) cancelC4Defuse(reason string) {
	c.c4ProgressMu.Lock()
	if !c.c4Defusing {
		c.c4ProgressMu.Unlock()
		return
	}
	c.c4Defusing = false
	c.c4Progress = 0
	if c.c4CancelChan != nil {
		close(c.c4CancelChan)
		c.c4CancelChan = nil
	}
	c.c4ProgressMu.Unlock()

	// 广播取消
	c.hub.BroadcastToRoom(c.Room, "c4_defuse_cancel", map[string]interface{}{
		"player_id": c.Player.ID,
		"reason":    reason,
	}, "")
}

// completeC4Defuse 完成 C4 拆除
func (c *Client) completeC4Defuse() {
	c.c4ProgressMu.Lock()
	c.c4Defusing = false
	c.c4Progress = 100
	if c.c4CancelChan != nil {
		close(c.c4CancelChan)
		c.c4CancelChan = nil
	}
	c.c4ProgressMu.Unlock()

	// 设置房间 C4 状态
	c.Room.SetC4Planted(false, "", player.Position{})

	// 广播完成
	c.hub.BroadcastToRoom(c.Room, "c4_defused", map[string]interface{}{
		"player_id": c.Player.ID,
		"team":      c.Player.Team,
	}, "")

	// 触发回合结束
	if c.Room.RoundManager != nil {
		c.Room.RoundManager.HandleC4Defused(c.Player.ID)
	}
}

// handleC4DefuseCancel 取消 C4 拆除（客户端主动取消）
func (c *Client) handleC4DefuseCancel() {
	c.c4ProgressMu.Lock()
	if c.c4Defusing {
		c.c4Defusing = false
		c.c4Progress = 0
		if c.c4CancelChan != nil {
			close(c.c4CancelChan)
			c.c4CancelChan = nil
		}
	}
	c.c4ProgressMu.Unlock()

	c.hub.BroadcastToRoom(c.Room, "c4_defuse_cancel", map[string]interface{}{
		"player_id": c.Player.ID,
		"reason":    "cancelled",
	}, "")
}

// handleC4Defuse 处理 C4 拆除 (旧版即时拆除，保留兼容)
func (c *Client) handleC4Defuse(roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	if !c.Room.IsC4Planted() {
		return
	}

	c.Room.SetC4Planted(false, "", player.Position{})

	c.hub.BroadcastToRoom(c.Room, "c4_defused", map[string]string{
		"player_id": c.Player.ID,
		"team":      c.Player.Team,
	}, "")
}

// handleSkillUse 处理技能使用
func (c *Client) handleSkillUse(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var req struct {
		SkillID  string  `json:"skill_id"`
		TargetID string  `json:"target_id"`
		X        float64 `json:"x"`
		Y        float64 `json:"y"`
		Z        float64 `json:"z"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	// 检查技能冷却
	if !c.Player.CanUseSkill(req.SkillID) {
		c.Send <- NewMessage("error", map[string]string{
			"message": "Skill on cooldown",
		}).ToJSON()
		return
	}

	c.Player.UseSkill(req.SkillID)

	c.hub.BroadcastToRoom(c.Room, "skill_used", map[string]interface{}{
		"player_id": c.Player.ID,
		"skill_id":  req.SkillID,
		"position": map[string]float64{
			"x": req.X,
			"y": req.Y,
			"z": req.Z,
		},
		"target_id": req.TargetID,
	}, "")
}

// handleEmote 处理表情
func (c *Client) handleEmote(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var req struct {
		EmoteID string `json:"emote_id"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	c.hub.BroadcastToRoom(c.Room, "emote", map[string]string{
		"player_id": c.Player.ID,
		"emote_id":  req.EmoteID,
	}, "")
}

// handlePing 处理标记
func (c *Client) handlePing(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var req struct {
		Type    string  `json:"type"`
		Message string  `json:"message"`
		X       float64 `json:"x"`
		Y       float64 `json:"y"`
		Z       float64 `json:"z"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	c.hub.BroadcastToRoom(c.Room, "ping", map[string]interface{}{
		"player_id": c.Player.ID,
		"type":      req.Type,
		"position": map[string]float64{
			"x": req.X,
			"y": req.Y,
			"z": req.Z,
		},
		"message": req.Message,
	}, "")
}

// handleAddBot 处理添加机器人
func (c *Client) handleAddBot(data json.RawMessage) {
	log.Printf("[DEBUG] handleAddBot called, data: %s", string(data))

	var req struct {
		Difficulty string `json:"difficulty"`
		Team       string `json:"team"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		log.Printf("[DEBUG] handleAddBot unmarshal error: %v", err)
		return
	}

	if c.Room == nil {
		log.Printf("[DEBUG] handleAddBot: client not in room")
		return
	}

	difficulty := ai.Difficulty(req.Difficulty)
	if difficulty == "" {
		difficulty = ai.DifficultyNormal
	}

	normalizedTeam := team.NormalizeTeamID(req.Team)
	log.Printf("[DEBUG] Adding bot with difficulty: %s", difficulty)
	bot := c.Room.AddBot(difficulty, normalizedTeam)
	if bot == nil {
		log.Printf("[DEBUG] handleAddBot: failed to add bot")
		c.Send <- NewMessage("error", map[string]string{
			"message": "Cannot add more bots",
		}).ToJSON()
		return
	}

	if normalizedTeam != "" {
		spawn := spawnPositionForTeam(normalizedTeam)
		bot.Player.Respawn(spawn.X, spawn.Y, spawn.Z)
		applyRespawnLoadout(bot.Player)
	}

	log.Printf("[DEBUG] Bot added: %s, broadcasting player_joined", bot.ID)
	// 广播机器人加入
	c.hub.BroadcastToRoom(c.Room, "player_joined", map[string]interface{}{
		"player_id":  bot.ID,
		"name":       bot.Name,
		"position":   bot.Position,
		"team":       bot.Team,
		"weapon":     bot.Player.Snapshot().Weapon,
		"is_bot":     true,
		"difficulty": bot.Config.Difficulty,
	}, "")
	if c.Room.RoundManager != nil {
		c.Room.RoundManager.HandleRosterChanged()
	}
}

// handleRemoveBot 处理移除机器人
func (c *Client) handleRemoveBot(data json.RawMessage) {
	var req struct {
		BotID string `json:"bot_id"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	if c.Room == nil {
		return
	}

	c.Room.RemoveBot(req.BotID)

	// 广播机器人离开
	c.hub.BroadcastToRoom(c.Room, "player_left", map[string]interface{}{
		"player_id": req.BotID,
	}, "")
	if c.Room.RoundManager != nil {
		c.Room.RoundManager.HandleRosterChanged()
	}
}
