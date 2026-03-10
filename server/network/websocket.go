package network

import (
	"encoding/json"
	"log"
	"time"

	"fps-game/player"
	"fps-game/room"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512
)

// Client represents a WebSocket client
type Client struct {
	Conn   *websocket.Conn
	Player *player.Player
	Room   *room.Room
	Send   chan []byte
}

// Message represents a network message
type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// HandleConnection handles a new WebSocket connection
func HandleConnection(conn *websocket.Conn, roomManager *room.Manager) {
	client := &Client{
		Conn:   conn,
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 256),
	}

	// 发送欢迎消息
	client.SendMessage(Message{
		Type: "welcome",
		Data: mustMarshal(map[string]string{
			"player_id": client.Player.ID,
			"message":   "Welcome to FPS Game!",
		}),
	})

	// 启动读写协程
	go client.WritePump()
	go client.ReadPump(roomManager)
}

// ReadPump pumps messages from the WebSocket connection
func (c *Client) ReadPump(roomManager *room.Manager) {
	defer func() {
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
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("JSON unmarshal error: %v", err)
			continue
		}

		c.HandleMessage(msg, roomManager)
	}
}

// WritePump pumps messages to the WebSocket connection
func (c *Client) WritePump() {
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

			// Batch messages
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

// SendMessage sends a message to the client
func (c *Client) SendMessage(msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("JSON marshal error: %v", err)
		return
	}
	select {
	case c.Send <- data:
	default:
		log.Printf("Client send buffer full")
	}
}

// HandleMessage handles incoming messages
func (c *Client) HandleMessage(msg Message, roomManager *room.Manager) {
	switch msg.Type {
	case "join_room":
		c.handleJoinRoom(msg.Data, roomManager)
	case "leave_room":
		c.handleLeaveRoom()
	case "move":
		c.handleMove(msg.Data)
	case "shoot":
		c.handleShoot(msg.Data)
	case "chat":
		c.handleChat(msg.Data)
	default:
		log.Printf("Unknown message type: %s", msg.Type)
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

	c.Player.Name = req.Name

	var r *room.Room
	if req.RoomID != "" {
		r = roomManager.GetRoom(req.RoomID)
	}
	if r == nil {
		r = roomManager.CreateRoom()
	}

	r.AddPlayer(c.Player)
	c.Room = r

	c.SendMessage(Message{
		Type: "room_joined",
		Data: mustMarshal(map[string]interface{}{
			"room_id": r.ID,
			"players": r.GetPlayerList(),
		}),
	})
}

func (c *Client) handleLeaveRoom() {
	if c.Room != nil {
		c.Room.RemovePlayer(c.Player.ID)
		c.Room = nil
	}
}

func (c *Client) handleMove(data json.RawMessage) {
	if c.Room == nil {
		return
	}

	var pos struct {
		X, Y, Z float64 `json:"x,y,z"`
		Rotation float64 `json:"rotation"`
	}
	if err := json.Unmarshal(data, &pos); err != nil {
		return
	}

	c.Player.Position.X = pos.X
	c.Player.Position.Y = pos.Y
	c.Player.Position.Z = pos.Z
	c.Player.Rotation = pos.Rotation

	// 广播给房间其他玩家
	c.Room.Broadcast(Message{
		Type: "player_moved",
		Data: mustMarshal(map[string]interface{}{
			"player_id": c.Player.ID,
			"position":  c.Player.Position,
			"rotation":  c.Player.Rotation,
		}),
	}, c.Player.ID)
}

func (c *Client) handleShoot(data json.RawMessage) {
	if c.Room == nil {
		return
	}

	var shot struct {
		TargetID string `json:"target_id"`
		Damage   int    `json:"damage"`
	}
	if err := json.Unmarshal(data, &shot); err != nil {
		return
	}

	// 广播射击事件
	c.Room.Broadcast(Message{
		Type: "player_shot",
		Data: mustMarshal(map[string]interface{}{
			"player_id": c.Player.ID,
			"target_id": shot.TargetID,
			"damage":    shot.Damage,
		}),
	}, "")
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

	c.Room.Broadcast(Message{
		Type: "chat",
		Data: mustMarshal(map[string]interface{}{
			"player_id": c.Player.ID,
			"name":      c.Player.Name,
			"message":   chat.Message,
		}),
	}, "")
}

func mustMarshal(v interface{}) json.RawMessage {
	data, _ := json.Marshal(v)
	return data
}
