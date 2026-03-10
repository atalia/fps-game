package network

import (
	"encoding/json"
	"log"
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
	maxMessageSize = 1024
)

// Client 客户端连接
type Client struct {
	Conn     *websocket.Conn
	Player   *player.Player
	Room     *room.Room
	Send     chan []byte
	hub      *Hub
}

// Hub 连接中心
type Hub struct {
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// NewHub 创建 Hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run 运行 Hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			if client.Player != nil {
				log.Printf("Client connected: %s", client.Player.ID)
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
			h.mu.Unlock()
			if client.Player != nil {
				log.Printf("Client disconnected: %s", client.Player.ID)
			}
		}
	}
}

// GetClientCount 获取客户端数量
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Message 消息格式
type Message struct {
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	Timestamp int64           `json:"timestamp"`
	Seq       int64           `json:"seq,omitempty"`
}

// NewMessage 创建消息
func NewMessage(msgType string, data interface{}) Message {
	return Message{
		Type:      msgType,
		Data:      mustMarshal(data),
		Timestamp: time.Now().UnixMilli(),
	}
}

// ToJSON 转换为 JSON
func (m Message) ToJSON() []byte {
	data, _ := json.Marshal(m)
	return data
}

func mustMarshal(v interface{}) json.RawMessage {
	data, _ := json.Marshal(v)
	return data
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
		c.hub.unregister <- c
		if c.Room != nil {
			c.Room.RemovePlayer(c.Player.ID)
		}
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
		c.handleMove(msg.Data)
	case "shoot":
		c.handleShoot(msg.Data)
	case "reload":
		c.handleReload()
	case "chat":
		c.handleChat(msg.Data)
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

	c.Send <- NewMessage("room_joined", map[string]interface{}{
		"room_id": r.ID,
		"players": r.GetPlayerList(),
	}).ToJSON()
}

func (c *Client) handleLeaveRoom(roomManager *room.Manager) {
	if c.Room != nil {
		c.Room.RemovePlayer(c.Player.ID)
		roomManager.LeaveRoom(c.Player.ID)
		c.Room = nil
	}
}

func (c *Client) handleMove(data json.RawMessage) {
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
	for _, p := range c.Room.Players {
		if p.ID != c.Player.ID {
			// TODO: 通过客户端连接发送
		}
	}
}

func (c *Client) handleShoot(data json.RawMessage) {
	if c.Room == nil || !c.Player.CanShoot() {
		return
	}

	c.Player.Shoot()
	// 广播射击事件
}

func (c *Client) handleReload() {
	c.Player.Reload()
	c.Send <- NewMessage("reload", map[string]interface{}{
		"ammo":         c.Player.Ammo,
		"ammo_reserve": c.Player.AmmoReserve,
	}).ToJSON()
}

func (c *Client) handleChat(data json.RawMessage) {
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
	for range c.Room.Players {
		// TODO: 通过客户端连接发送
	}
}
