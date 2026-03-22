package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

// Message 消息结构
type Message struct {
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	Timestamp int64           `json:"timestamp"`
}

// Client 测试客户端
type Client struct {
	ID       string
	Name     string
	Conn     *websocket.Conn
	RoomID   string
	mu       sync.Mutex
	msgCount int
}

var (
	serverURL = flag.String("server", "ws://localhost:8080/ws", "WebSocket server URL")
	numClients = flag.Int("clients", 2, "Number of test clients")
	testMode   = flag.String("mode", "interactive", "Test mode: interactive, auto, stress")
)

func main() {
	flag.Parse()

	fmt.Printf("🎮 FPS Game WebSocket Test Client\n")
	fmt.Printf("Server: %s\n", *serverURL)
	fmt.Printf("Clients: %d\n", *numClients)
	fmt.Printf("Mode: %s\n\n", *testMode)

	switch *testMode {
	case "interactive":
		interactiveMode()
	case "auto":
		autoMode()
	case "stress":
		stressMode()
	default:
		interactiveMode()
	}
}

// interactiveMode 交互模式 - 单客户端，手动输入命令
func interactiveMode() {
	client := connectClient("Player1")
	defer client.Conn.Close()

	fmt.Println("\n📋 Commands:")
	fmt.Println("  join <room_id>  - Join or create room")
	fmt.Println("  move <x> <z>    - Move player")
	fmt.Println("  shoot           - Shoot")
	fmt.Println("  chat <message>  - Send chat message")
	fmt.Println("  team <team>     - Join team (red/blue)")
	fmt.Println("  weapon <name>   - Change weapon")
	fmt.Println("  reload          - Reload weapon")
	fmt.Println("  skill <id>      - Use skill")
	fmt.Println("  emote <id>      - Send emote")
	fmt.Println("  ping            - Send ping")
	fmt.Println("  leave           - Leave room")
	fmt.Println("  quit            - Exit")
	fmt.Println()

	// 启动消息接收协程
	go client.receiveMessages()

	// 读取用户输入
	scanner := bufio.NewScanner(os.Stdin)
	for {
		fmt.Print("> ")
		if !scanner.Scan() {
			break
		}

		line := scanner.Text()
		if line == "" {
			continue
		}

		if line == "quit" {
			break
		}

		client.handleCommand(line)
	}

	fmt.Println("👋 Disconnected")
}

// autoMode 自动模式 - 多客户端自动测试
func autoMode() {
	var clients []*Client
	var wg sync.WaitGroup

	// 创建多个客户端
	for i := 0; i < *numClients; i++ {
		client := connectClient(fmt.Sprintf("Player%d", i+1))
		clients = append(clients, client)
		defer client.Conn.Close()
	}

	// 所有客户端加入同一个房间
	roomID := ""
	for i, client := range clients {
		if i == 0 {
			// 第一个客户端创建房间
			client.send("join_room", map[string]string{
				"room_id": "",
				"name":    client.Name,
			})
			time.Sleep(100 * time.Millisecond)
			roomID = client.RoomID
		} else {
			// 其他客户端加入房间
			client.send("join_room", map[string]string{
				"room_id": roomID,
				"name":    client.Name,
			})
			time.Sleep(100 * time.Millisecond)
		}

		// 启动消息接收
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			c.receiveMessages()
		}(client)
	}

	fmt.Printf("\n✅ All %d clients joined room: %s\n", len(clients), roomID)

	// 自动测试序列
	go func() {
		time.Sleep(1 * time.Second)

		// 测试聊天
		fmt.Println("\n📢 Testing chat...")
		for _, c := range clients {
			c.send("chat", map[string]string{
				"message": fmt.Sprintf("Hello from %s!", c.Name),
			})
			time.Sleep(200 * time.Millisecond)
		}

		time.Sleep(1 * time.Second)

		// 测试移动
		fmt.Println("\n🏃 Testing movement...")
		for i, c := range clients {
			c.send("move", map[string]interface{}{
				"x":        float64(i * 10),
				"y":        0.0,
				"z":        float64(i * 5),
				"rotation": 0.0,
			})
			time.Sleep(100 * time.Millisecond)
		}

		time.Sleep(1 * time.Second)

		// 测试射击
		fmt.Println("\n🔫 Testing shooting...")
		for _, c := range clients {
			c.send("shoot", map[string]interface{}{
				"position": map[string]float64{"x": 0, "y": 1.25, "z": 0},
				"rotation": 0,
				"direction": map[string]float64{"x": 1, "y": 0, "z": 0},
			})
			time.Sleep(100 * time.Millisecond)
		}

		time.Sleep(1 * time.Second)

		// 测试团队
		fmt.Println("\n👥 Testing teams...")
		for i, c := range clients {
			team := "red"
			if i%2 == 1 {
				team = "blue"
			}
			c.send("team_join", map[string]string{"team": team})
			time.Sleep(100 * time.Millisecond)
		}

		time.Sleep(2 * time.Second)

		// 打印统计
		fmt.Println("\n📊 Message Statistics:")
		for _, c := range clients {
			fmt.Printf("  %s: %d messages received\n", c.Name, c.msgCount)
		}

		// 退出
		os.Exit(0)
	}()

	wg.Wait()
}

// stressMode 压力测试模式
func stressMode() {
	var clients []*Client
	var wg sync.WaitGroup

	fmt.Println("\n🔥 Starting stress test...")

	// 快速创建客户端
	for i := 0; i < *numClients; i++ {
		client := connectClient(fmt.Sprintf("StressPlayer%d", i+1))
		clients = append(clients, client)

		// 快速加入房间
		client.send("join_room", map[string]string{
			"room_id": "",
			"name":    client.Name,
		})

		// 启动消息接收
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			c.receiveMessages()
		}(client)
	}

	// 持续发送消息
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	iteration := 0
	for {
		select {
		case <-stopChan:
			fmt.Println("\n\n📊 Final Statistics:")
			for _, c := range clients {
				fmt.Printf("  %s: %d messages\n", c.Name, c.msgCount)
			}
			return
		case <-ticker.C:
			iteration++
			for _, c := range clients {
				// 随机发送不同类型的消息
				switch iteration % 5 {
				case 0:
					c.send("move", map[string]interface{}{
						"x":        float64(iteration % 100),
						"y":        0.0,
						"z":        float64((iteration + 50) % 100),
						"rotation": 0.0,
					})
				case 1:
					c.send("chat", map[string]string{
						"message": fmt.Sprintf("Msg %d", iteration),
					})
				case 2:
					c.send("shoot", map[string]interface{}{
						"position": map[string]float64{"x": 0, "y": 1.25, "z": 0},
						"rotation": 0,
						"direction": map[string]float64{"x": 1, "y": 0, "z": 0},
					})
				}
			}

			if iteration%100 == 0 {
				fmt.Printf("📊 Iteration %d, Total messages: ", iteration)
				total := 0
				for _, c := range clients {
					total += c.msgCount
				}
				fmt.Printf("%d\n", total)
			}
		}
	}
}

// connectClient 连接到服务器
func connectClient(name string) *Client {
	u, err := url.Parse(*serverURL)
	if err != nil {
		log.Fatalf("Invalid URL: %v", err)
	}

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}

	client := &Client{
		Name: name,
		Conn: conn,
	}

	// 读取 welcome 消息
	_, data, err := conn.ReadMessage()
	if err != nil {
		log.Fatalf("Failed to read welcome: %v", err)
	}

	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Fatalf("Failed to parse welcome: %v", err)
	}

	if msg.Type != "welcome" {
		log.Fatalf("Expected welcome, got %s", msg.Type)
	}

	var welcomeData struct {
		PlayerID string `json:"player_id"`
	}
	if err := json.Unmarshal(msg.Data, &welcomeData); err != nil {
		log.Fatalf("Failed to parse welcome data: %v", err)
	}

	client.ID = welcomeData.PlayerID
	fmt.Printf("✅ Connected: %s (ID: %s)\n", name, client.ID)

	return client
}

// receiveMessages 接收消息循环
func (c *Client) receiveMessages() {
	for {
		_, data, err := c.Conn.ReadMessage()
		if err != nil {
			return
		}

		c.mu.Lock()
		c.msgCount++
		c.mu.Unlock()

		// 解析消息
		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		c.handleMessage(&msg)
	}
}

// handleMessage 处理收到的消息
func (c *Client) handleMessage(msg *Message) {
	switch msg.Type {
	case "room_joined":
		var data struct {
			RoomID string `json:"room_id"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			c.RoomID = data.RoomID
			fmt.Printf("🏠 [%s] Joined room: %s\n", c.Name, data.RoomID)
		}

	case "player_joined":
		var data struct {
			PlayerID string `json:"player_id"`
			Name     string `json:"name"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("👤 [%s] Player joined: %s (%s)\n", c.Name, data.Name, data.PlayerID[:8])
		}

	case "player_left":
		var data struct {
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("🚪 [%s] Player left: %s\n", c.Name, data.PlayerID[:8])
		}

	case "chat":
		var data struct {
			Name    string `json:"name"`
			Message string `json:"message"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("💬 [%s] %s: %s\n", c.Name, data.Name, data.Message)
		}

	case "player_moved":
		var data struct {
			PlayerID string `json:"player_id"`
			Position struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
				Z float64 `json:"z"`
			} `json:"position"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			// 移动消息太多，只在交互模式显示
			if *testMode == "interactive" {
				fmt.Printf("🏃 [%s] Player %s moved to (%.1f, %.1f, %.1f)\n",
					c.Name, data.PlayerID[:8], data.Position.X, data.Position.Y, data.Position.Z)
			}
		}

	case "player_shot":
		var data struct {
			PlayerID string `json:"player_id"`
			Ammo     int    `json:"ammo"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("🔫 [%s] Player %s shot (ammo: %d)\n", c.Name, data.PlayerID[:8], data.Ammo)
		}

	case "player_damaged":
		var data struct {
			PlayerID  string `json:"player_id"`
			Attacker  string `json:"attacker_id"`
			Damage    int    `json:"damage"`
			Hitbox    string `json:"hitbox"`
			Remaining int    `json:"remaining_health"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("💥 [%s] %s hit %s (%s) for %d damage (HP: %d)\n",
				c.Name, data.Attacker[:8], data.PlayerID[:8], data.Hitbox, data.Damage, data.Remaining)
		}

	case "player_killed":
		var data struct {
			VictimID   string `json:"victim_id"`
			KillerID   string `json:"killer_id"`
			IsHeadshot bool   `json:"is_headshot"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			headshot := ""
			if data.IsHeadshot {
				headshot = " 💀 HEADSHOT"
			}
			fmt.Printf("☠️ [%s] %s killed %s%s\n", c.Name, data.KillerID[:8], data.VictimID[:8], headshot)
		}

	case "team_changed":
		var data struct {
			PlayerID string `json:"player_id"`
			Team     string `json:"team"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("👥 [%s] Player %s joined %s team\n", c.Name, data.PlayerID[:8], data.Team)
		}

	case "weapon_changed":
		var data struct {
			PlayerID string `json:"player_id"`
			Weapon   string `json:"weapon"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("🔪 [%s] Player %s switched to %s\n", c.Name, data.PlayerID[:8], data.Weapon)
		}

	case "skill_used":
		var data struct {
			PlayerID string `json:"player_id"`
			SkillID  string `json:"skill_id"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("⚡ [%s] Player %s used skill: %s\n", c.Name, data.PlayerID[:8], data.SkillID)
		}

	case "emote":
		var data struct {
			PlayerID string `json:"player_id"`
			EmoteID  string `json:"emote_id"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("🎭 [%s] Player %s: %s\n", c.Name, data.PlayerID[:8], data.EmoteID)
		}

	case "ping":
		var data struct {
			PlayerID string `json:"player_id"`
			Type     string `json:"type"`
			Message  string `json:"message"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("📍 [%s] Player %s ping: %s (%s)\n", c.Name, data.PlayerID[:8], data.Type, data.Message)
		}

	case "voice_start":
		var data struct {
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("🎤 [%s] Player %s started speaking\n", c.Name, data.PlayerID[:8])
		}

	case "voice_stop":
		var data struct {
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("🔇 [%s] Player %s stopped speaking\n", c.Name, data.PlayerID[:8])
		}

	case "reload":
		var data struct {
			Ammo        int `json:"ammo"`
			AmmoReserve int `json:"ammo_reserve"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("🔄 [%s] Reloaded: %d/%d\n", c.Name, data.Ammo, data.AmmoReserve)
		}

	case "respawn":
		var data struct {
			Health int `json:"health"`
			Ammo   int `json:"ammo"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("♻️ [%s] Respawned: HP=%d, Ammo=%d\n", c.Name, data.Health, data.Ammo)
		}

	case "player_respawned":
		var data struct {
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("♻️ [%s] Player %s respawned\n", c.Name, data.PlayerID[:8])
		}

	case "error":
		var data struct {
			Message string `json:"message"`
		}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			fmt.Printf("❌ [%s] Error: %s\n", c.Name, data.Message)
		}

	default:
		fmt.Printf("📩 [%s] %s: %s\n", c.Name, msg.Type, string(msg.Data))
	}
}

// handleCommand 处理用户输入命令
func (c *Client) handleCommand(line string) {
	parts := parseCommand(line)
	if len(parts) == 0 {
		return
	}

	cmd := parts[0]
	args := parts[1:]

	switch cmd {
	case "join":
		roomID := ""
		if len(args) > 0 {
			roomID = args[0]
		}
		c.send("join_room", map[string]string{
			"room_id": roomID,
			"name":    c.Name,
		})

	case "move":
		x := 0.0
		z := 0.0
		if len(args) > 0 {
			fmt.Sscanf(args[0], "%f", &x)
		}
		if len(args) > 1 {
			fmt.Sscanf(args[1], "%f", &z)
		}
		c.send("move", map[string]interface{}{
			"x":        x,
			"y":        0.0,
			"z":        z,
			"rotation": 0.0,
		})

	case "shoot":
		c.send("shoot", map[string]interface{}{
			"position": map[string]float64{"x": 0, "y": 1.25, "z": 0},
			"rotation": 0,
			"direction": map[string]float64{"x": 0, "y": 0, "z": 1},
		})

	case "chat":
		if len(args) > 0 {
			msg := args[0]
			for i := 1; i < len(args); i++ {
				msg += " " + args[i]
			}
			c.send("chat", map[string]string{"message": msg})
		} else {
			fmt.Println("Usage: chat <message>")
		}

	case "team":
		if len(args) > 0 {
			c.send("team_join", map[string]string{"team": args[0]})
		} else {
			fmt.Println("Usage: team <red|blue>")
		}

	case "weapon":
		if len(args) > 0 {
			c.send("weapon_change", map[string]string{"weapon": args[0]})
		} else {
			fmt.Println("Usage: weapon <pistol|rifle|shotgun|sniper>")
		}

	case "reload":
		c.send("reload", map[string]string{})

	case "skill":
		if len(args) > 0 {
			c.send("skill_use", map[string]interface{}{
				"skill_id": args[0],
				"x":        0.0,
				"y":        0.0,
				"z":        0.0,
			})
		} else {
			fmt.Println("Usage: skill <skill_id>")
		}

	case "emote":
		if len(args) > 0 {
			c.send("emote", map[string]string{"emote_id": args[0]})
		} else {
			fmt.Println("Usage: emote <emote_id>")
		}

	case "ping":
		c.send("ping", map[string]interface{}{
			"type":    "enemy",
			"message": "Enemy spotted!",
			"x":       100.0,
			"y":       0.0,
			"z":       50.0,
		})

	case "leave":
		c.send("leave_room", map[string]string{})

	case "help":
		fmt.Println("📋 Commands:")
		fmt.Println("  join <room_id>  - Join or create room")
		fmt.Println("  move <x> <z>    - Move player")
		fmt.Println("  shoot           - Shoot")
		fmt.Println("  chat <message>  - Send chat message")
		fmt.Println("  team <team>     - Join team (red/blue)")
		fmt.Println("  weapon <name>   - Change weapon")
		fmt.Println("  reload          - Reload weapon")
		fmt.Println("  skill <id>      - Use skill")
		fmt.Println("  emote <id>      - Send emote")
		fmt.Println("  ping            - Send ping")
		fmt.Println("  leave           - Leave room")
		fmt.Println("  quit            - Exit")

	default:
		fmt.Printf("Unknown command: %s (type 'help' for commands)\n", cmd)
	}
}

// send 发送消息
func (c *Client) send(msgType string, data interface{}) {
	msg := map[string]interface{}{
		"type": msgType,
		"data": data,
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		fmt.Printf("Failed to marshal: %v\n", err)
		return
	}

	if err := c.Conn.WriteMessage(websocket.TextMessage, jsonData); err != nil {
		fmt.Printf("Failed to send: %v\n", err)
	}
}

// parseCommand 解析命令行
func parseCommand(line string) []string {
	var result []string
	current := ""
	inQuote := false

	for _, ch := range line {
		switch ch {
		case '"':
			inQuote = !inQuote
		case ' ', '\t':
			if !inQuote && current != "" {
				result = append(result, current)
				current = ""
			} else if inQuote {
				current += string(ch)
			}
		default:
			current += string(ch)
		}
	}

	if current != "" {
		result = append(result, current)
	}

	return result
}
