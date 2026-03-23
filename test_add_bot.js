const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:8080/ws");

ws.on("open", () => {
    console.log("Connected");
    ws.send(JSON.stringify({ type: "join_room", data: { room_id: "", name: "TestBot" }, timestamp: Date.now() }));
});

ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    console.log("Received:", msg.type, JSON.stringify(msg.data || {}).substring(0, 100));
    
    if (msg.type === "room_joined") {
        setTimeout(() => {
            ws.send(JSON.stringify({ type: "add_bot", data: { difficulty: "normal" }, timestamp: Date.now() }));
            console.log("add_bot sent");
        }, 500);
    }
});

setTimeout(() => { ws.close(); process.exit(0); }, 10000);
