const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Server is online");
});

const wss = new WebSocket.Server({ server });

let rooms = {};

const generateRoomID = () => Math.random().toString(36).substring(2, 7).toUpperCase();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);
            const { type, data } = msg;
            if (type === 'create') {
                const roomID = generateRoomID();
                rooms[roomID] = { host: ws, opponent: null };
                ws.roomID = roomID;
                ws.send(JSON.stringify({ type: 'roomCreated', data: { roomID } }));
            } else if (type === 'join') {
                const roomID = data.room;
                if (rooms[roomID] && !rooms[roomID].opponent) {
                    rooms[roomID].opponent = ws;
                    ws.roomID = roomID;
                    rooms[roomID].host.send(JSON.stringify({ type: 'start', data: { isHostStart: true } }));
                    rooms[roomID].opponent.send(JSON.stringify({ type: 'start', data: { isHostStart: false } }));
                } else {
                    ws.send(JSON.stringify({ type: 'error', data: { message: 'Room unavailable' } }));
                }
            } else if (type === 'move' || type === 'reset') {
                const roomID = ws.roomID;
                if (rooms[roomID]) {
                    const target = (ws === rooms[roomID].host) ? rooms[roomID].opponent : rooms[roomID].host;
                    if (target) target.send(JSON.stringify(msg));
                }
            }
        } catch (e) { console.error(e); }
    });
    ws.on('close', () => {
        const roomID = ws.roomID;
        if (roomID && rooms[roomID]) {
            const target = (ws === rooms[roomID].host) ? rooms[roomID].opponent : rooms[roomID].host;
            if (target) target.send(JSON.stringify({ type: 'error', data: { message: 'Mate left' } }));
            delete rooms[roomID];
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is global on port ${PORT}`);
});
