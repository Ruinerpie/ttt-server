const WebSocket = require('ws');
const http = require('http');

// Render requires us to create a basic HTTP server to "bind" to a port
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Tic Tac Toe Server is Running");
});

const wss = new WebSocket.Server({ server });

let rooms = {};

const generateRoomID = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
};

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const msg = JSON.parse(message);
        const { type, data } = msg;

        if (type === 'create') {
            const roomID = generateRoomID();
            rooms[roomID] = { host: ws, opponent: null };
            ws.roomID = roomID;
            ws.send(JSON.stringify({ type: 'roomCreated', data: { roomID } }));
        }

        if (type === 'join') {
            const roomID = data.room;
            if (rooms[roomID] && !rooms[roomID].opponent) {
                rooms[roomID].opponent = ws;
                ws.roomID = roomID;
                
                // Tell both players to start
                rooms[roomID].host.send(JSON.stringify({ type: 'start', data: { isHostStart: true } }));
                rooms[roomID].opponent.send(JSON.stringify({ type: 'start', data: { isHostStart: false } }));
            } else {
                ws.send(JSON.stringify({ type: 'error', data: { message: 'Room full or does not exist.' } }));
            }
        }

        if (type === 'move' || type === 'reset') {
            const roomID = ws.roomID;
            if (rooms[roomID]) {
                const target = (ws === rooms[roomID].host) ? rooms[roomID].opponent : rooms[roomID].host;
                if (target) target.send(JSON.stringify(msg));
            }
        }
    });

    ws.on('close', () => {
        const roomID = ws.roomID;
        if (roomID && rooms[roomID]) {
            const target = (ws === rooms[roomID].host) ? rooms[roomID].opponent : rooms[roomID].host;
            if (target) target.send(JSON.stringify({ type: 'error', data: { message: 'Mate disconnected.' } }));
            delete rooms[roomID];
        }
    });
});

// IMPORTANT: Render uses the "PORT" environment variable
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
