package network

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"fps-game/internal/player"
	"fps-game/internal/room"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// Client 客户端连接
type Client struct {
	Conn   *websocket.Conn
	Player *player.Player
	Room   *room.Room
	Send   chan []byte
	hub    *Hub
	mu     sync.Mutex
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
	msg := NewMessage(msgType, data)
	h.mu.RLock()
	defer h.mu.RUnlock()

	for playerID := range r.Players {
		if playerID == excludeID {
			continue
		}
		if client, ok := h.clientMap[playerID]; ok {
			select {
			case client.Send <- msg.ToJSON():
			default:
				// 缓冲区满，跳过
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
	jsonData, _ := json.Marshal(data)
	return &Message{
		Type:      msgType,
		Data:      jsonData,
		Timestamp: time.Now().UnixMilli(),
	}
}

// ToJSON 转换为 JSON
func (m *Message) ToJSON() []byte {
	data, _ := json.Marshal(m)
	return data
}

func mustMarshal(v interface{}) json.RawMessage {
	data, _ := json.Marshal(v)
	return data
}

// ServeWS 处理 WebSocket 连接
func ServeWS(hub *Hub, roomManager *room.Manager, matcher interface{}, w http.ResponseWriter, r *http.Request) {
	var upgrader = websocket.Upgrader{
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
		CheckOrigin: func(r *http.Request) bool {
			return true // 允许所有来源
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
		Conn:   conn,
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 256),
		hub:    hub,
	}

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
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
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
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// 批量发送
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage 处理消息
func (c *Client) handleMessage(msg Message, roomManager *room.Manager) {
	switch msg.Type {
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

	c.Player.SetName(req.Name)

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
		"room_id":       r.ID,
		"player_id":     c.Player.ID,
		"players":       r.GetPlayerList(),
		"player_count":  r.GetPlayerCount(),
		"max_size":      r.MaxSize,
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

	var pos struct {
		Position map[string]float64 `json:"position"`
		Rotation float64            `json:"rotation"`
	}
	json.Unmarshal(data, &pos)

	// 广播射击事件
	c.hub.BroadcastToRoom(c.Room, "player_shot", map[string]interface{}{
		"player_id": c.Player.ID,
		"position":  pos.Position,
		"rotation":  pos.Rotation,
		"ammo":      c.Player.Ammo,
	}, c.Player.ID)
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
		return
	}

	var chat struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(data, &chat); err != nil {
		return
	}

	// 广播聊天消息
	c.hub.BroadcastToRoom(c.Room, "chat", map[string]string{
		"player_id": c.Player.ID,
		"name":      c.Player.Name,
		"message":   chat.Message,
	}, "")
}

func (c *Client) handleRespawn(data json.RawMessage, roomManager *room.Manager) {
	var pos struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
		Z float64 `json:"z"`
	}
	json.Unmarshal(data, &pos)

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
