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
	"fps-game/internal/hitbox"
	"fps-game/internal/player"
	"fps-game/internal/room"

	"github.com/gorilla/websocket"
)

func init() {
	// 初始化随机数种子
	rand.Seed(time.Now().UnixNano())
}

const (
	writeWait       = 10 * time.Second
	pongWait        = 90 * time.Second // 增加到 90 秒
	pingPeriod      = (pongWait * 9) / 10
	maxMessageSize  = 4096
	maxPlayerName   = 32  // 玩家名称最大长度
	maxChatMessage  = 256 // 聊天消息最大长度
	minPlayerName   = 1   // 玩家名称最小长度
)

// Client 客户端连接
type Client struct {
	Conn         *websocket.Conn
	Player       *player.Player
	Room         *room.Room
	Send         chan []byte
	hub          *Hub
	msgRateLimit *RateLimiter // 消息频率限制器
}

// RateLimiter 简单的令牌桶频率限制器
type RateLimiter struct {
	tokens    int
	maxTokens int
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
	// C4 爆破模式
	case "c4_plant":
		c.handleC4Plant(msg.Data, roomManager)
	case "c4_defuse":
		c.handleC4Defuse(roomManager)
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

	if !r.AddPlayer(c.Player) {
		c.Send <- NewMessage("error", map[string]string{
			"message": "Room is full",
		}).ToJSON()
		return
	}

	c.Room = r
	roomManager.JoinRoom(c.Player.ID, r.ID)

	// 发送房间信息给新玩家
	c.Send <- NewMessage("room_joined", map[string]interface{}{
		"room_id":      r.ID,
		"player_id":    c.Player.ID,
		"players":      r.GetPlayerList(),
		"player_count": r.GetPlayerCount(),
		"max_size":     r.MaxSize,
	}).ToJSON()

	// 广播给房间内其他玩家
	c.hub.BroadcastToRoom(r, "player_joined", map[string]interface{}{
		"player_id": c.Player.ID,
		"name":      c.Player.Name,
		"position":  c.Player.Position,
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
	}

	c.Room = nil
}

func (c *Client) handleMove(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil {
		return
	}

	var pos struct {
		X        float64 `json:"x"`
		Y        float64 `json:"y"`
		Z        float64 `json:"z"`
		Rotation float64 `json:"rotation"`
	}
	if err := json.Unmarshal(data, &pos); err != nil {
		return
	}

	c.Player.SetPosition(pos.X, pos.Y, pos.Z)
	c.Player.SetRotation(pos.Rotation)

	// 广播给其他玩家
	c.hub.BroadcastToRoom(c.Room, "player_moved", map[string]interface{}{
		"player_id": c.Player.ID,
		"position": map[string]float64{
			"x": pos.X,
			"y": pos.Y,
			"z": pos.Z,
		},
		"rotation": pos.Rotation,
	}, c.Player.ID)
}

func (c *Client) handleShoot(data json.RawMessage, roomManager *room.Manager) {
	if c.Room == nil || !c.Player.CanShoot() {
		return
	}

	c.Player.Shoot()

	var shootData struct {
		Position  map[string]float64 `json:"position"`
		Rotation  float64            `json:"rotation"`
		Direction map[string]float64 `json:"direction"`
		WeaponID  string             `json:"weapon_id"`
	}
	if err := json.Unmarshal(data, &shootData); err != nil { return }

	// 广播射击事件
	c.hub.BroadcastToRoom(c.Room, "player_shot", map[string]interface{}{
		"player_id": c.Player.ID,
		"position":  shootData.Position,
		"rotation":  shootData.Rotation,
		"ammo":      c.Player.Ammo,
	}, c.Player.ID)

	// 命中检测
	if shootData.Direction != nil {
		origin := hitbox.Position{
			X: shootData.Position["x"],
			Y: shootData.Position["y"],
			Z: shootData.Position["z"],
		}
		direction := hitbox.Position{
			X: shootData.Direction["x"],
			Y: shootData.Direction["y"],
			Z: shootData.Direction["z"],
		}

		// 武器射程 (默认 50)
		weaponRange := 50.0

		hit := c.detectHit(origin, direction, weaponRange)
		if hit != nil {
			// 基础伤害 (根据武器类型)
			baseDamage := 30
			if shootData.WeaponID == "sniper" {
				baseDamage = 100
			} else if shootData.WeaponID == "shotgun" {
				baseDamage = 80
			} else if shootData.WeaponID == "pistol" {
				baseDamage = 25
			}

			// 计算伤害
			damage := hitbox.CalculateDamage(baseDamage, hitbox.HitBoxType(hit.HitBoxType), hit.Distance, weaponRange)

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
				target.TakeDamage(damage)

				// 广播受伤消息
				c.hub.BroadcastToRoom(c.Room, "player_damaged", map[string]interface{}{
					"player_id":        hit.PlayerID,
					"attacker_id":      c.Player.ID,
					"damage":           damage,
					"hitbox":           hit.HitBoxType,
					"remaining_health": target.Health,
					"position":         target.Position,
					"is_bot":           isBot,
				}, "")

				// 检查死亡
				if target.Health <= 0 {
					// 更新击杀统计
					c.Player.AddKill(1)
					target.Die()

					c.hub.BroadcastToRoom(c.Room, "player_killed", map[string]interface{}{
						"victim_id":     hit.PlayerID,
						"killer_id":     c.Player.ID,
						"weapon_id":     shootData.WeaponID,
						"hitbox":        hit.HitBoxType,
						"is_headshot":   hit.HitBoxType == "head",
						"kill_distance": hit.Distance,
						"is_bot":        isBot,
					}, "")

					// 玩家自动重生，机器人不重生
					if !isBot {
						go c.respawnPlayer(target)
					}
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

			if hitbox.RaySphereIntersect(origin, direction, worldPos, hb.Radius) {
				distance := math.Sqrt(
					math.Pow(worldPos.X-origin.X, 2)+
						math.Pow(worldPos.Y-origin.Y, 2)+
						math.Pow(worldPos.Z-origin.Z, 2),
				)

				if distance < minDistance {
					minDistance = distance
					closestHit = &HitResult{
						PlayerID:   playerID,
						HitBoxType: hb.Type,
						Distance:   distance,
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

			if hitbox.RaySphereIntersect(origin, direction, worldPos, hb.Radius) {
				distance := math.Sqrt(
					math.Pow(worldPos.X-origin.X, 2)+
						math.Pow(worldPos.Y-origin.Y, 2)+
						math.Pow(worldPos.Z-origin.Z, 2),
				)

				if distance < minDistance {
					minDistance = distance
					closestHit = &HitResult{
						PlayerID:   bot.Player.ID,
						HitBoxType: hb.Type,
						Distance:   distance,
					}
				}
			}
		}
	}

	return closestHit
}

// respawnPlayer 重生玩家
func (c *Client) respawnPlayer(p *player.Player) {
	time.Sleep(3 * time.Second) // 3 秒重生延迟

	// 重置玩家状态
	p.Health = p.MaxHealth
	p.Position = player.Position{
		X: (rand.Float64()*100 - 50), // 使用加密安全的随机数
		Y: 0,
		Z: (rand.Float64()*100 - 50),
	}

	c.hub.BroadcastToRoom(c.Room, "player_respawned", map[string]interface{}{
		"player_id": p.ID,
		"position":  p.Position,
		"health":    p.Health,
	}, "")
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
	var pos struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
		Z float64 `json:"z"`
	}
	if err := json.Unmarshal(data, &pos); err != nil { return }

	c.Player.Respawn(pos.X, pos.Y, pos.Z)

	c.Send <- NewMessage("respawn", map[string]interface{}{
		"position": map[string]float64{
			"x": pos.X,
			"y": pos.Y,
			"z": pos.Z,
		},
		"health": c.Player.Health,
		"ammo":   c.Player.Ammo,
	}).ToJSON()

	// 广播重生
	c.hub.BroadcastToRoom(c.Room, "player_respawned", map[string]interface{}{
		"player_id": c.Player.ID,
		"position":  c.Player.Position,
	}, c.Player.ID)
}

// handleWeaponChange 处理武器切换
func (c *Client) handleWeaponChange(data json.RawMessage) {
	var req struct {
		Weapon string `json:"weapon"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	c.Player.SetWeapon(req.Weapon)

	// 广播武器切换
	c.hub.BroadcastToRoom(c.Room, "weapon_changed", map[string]interface{}{
		"player_id": c.Player.ID,
		"weapon":    req.Weapon,
	}, "")
}

// handleVoiceStart 处理语音开始
func (c *Client) handleVoiceStart() {
	if c.Room == nil {
		return
	}

	c.hub.BroadcastToRoom(c.Room, "voice_start", map[string]string{
		"player_id": c.Player.ID,
	}, c.Player.ID)
}

// handleVoiceStop 处理语音停止
func (c *Client) handleVoiceStop() {
	if c.Room == nil {
		return
	}

	c.hub.BroadcastToRoom(c.Room, "voice_stop", map[string]string{
		"player_id": c.Player.ID,
	}, c.Player.ID)
}

// handleVoiceData 处理语音数据
func (c *Client) handleVoiceData(data json.RawMessage) {
	if c.Room == nil {
		return
	}

	// 直接转发语音数据给房间内其他玩家
	c.hub.BroadcastToRoom(c.Room, "voice_data", map[string]interface{}{
		"player_id": c.Player.ID,
		"audio":     data,
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

	c.Player.SetTeam(req.Team)

	c.hub.BroadcastToRoom(c.Room, "team_changed", map[string]interface{}{
		"player_id": c.Player.ID,
		"team":      req.Team,
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

// handleC4Plant 处理 C4 放置
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

// handleC4Defuse 处理 C4 拆除
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
		SkillID  string `json:"skill_id"`
		TargetID string `json:"target_id"`
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
		Type    string `json:"type"`
		Message string `json:"message"`
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

	log.Printf("[DEBUG] Adding bot with difficulty: %s", difficulty)
	bot := c.Room.AddBot(difficulty, req.Team)
	if bot == nil {
		log.Printf("[DEBUG] handleAddBot: failed to add bot")
		c.Send <- NewMessage("error", map[string]string{
			"message": "Cannot add more bots",
		}).ToJSON()
		return
	}

	log.Printf("[DEBUG] Bot added: %s, broadcasting player_joined", bot.ID)
	// 广播机器人加入
	c.hub.BroadcastToRoom(c.Room, "player_joined", map[string]interface{}{
		"player_id":  bot.ID,
		"name":       bot.Name,
		"position":   bot.Position,
		"is_bot":     true,
		"difficulty": bot.Config.Difficulty,
	}, "")
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
}
