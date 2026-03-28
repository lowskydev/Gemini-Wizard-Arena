const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the /client directory
app.use(express.static(path.join(__dirname, '../client')));

// Serve static art assets
app.use('/assets', express.static(path.join(__dirname, '../assets')));

const players = {};
let playerCount = 0;

io.on('connection', (socket) => {
    console.log(`[Server]: A user connected: ${socket.id}`);

    if (playerCount >= 2) {
        console.log(`[Server]: Connection rejected for ${socket.id}. Maximum of 2 players allowed.`);
        socket.disconnect(true);
        return;
    }

    let assignedId = 'Player 1';
    if (players['Player 1']) {
        assignedId = 'Player 2';
    }
    
    players[assignedId] = socket.id;
    playerCount++;

    console.log(`[Server]: Assigned ID ${assignedId} to socket ${socket.id}`);

    // PLAYER_JOINED: Server -> Client
    socket.emit('PLAYER_JOINED', { id: assignedId, socketId: socket.id });

    // STATE_UPDATE: Client -> Server
    socket.on('STATE_UPDATE', (data) => {
        console.log(`[Server]: Received STATE_UPDATE from ${assignedId} (${socket.id}):`, data);
        // BROADCAST_STATE: Server -> Client
        socket.broadcast.emit('BROADCAST_STATE', data);
    });

    // SPELL_CAST: Client -> Server
    socket.on('SPELL_CAST', (data) => {
        console.log(`[Server]: Received SPELL_CAST from ${assignedId} (${socket.id}):`, data);
        // BROADCAST_SPELL: Server -> Client
        socket.broadcast.emit('BROADCAST_SPELL', data);
    });

    socket.on('connect_error', (err) => {
        console.log(`[Server]: connect_error for ${assignedId} (${socket.id}):`, err.message);
    });

    socket.on('error', (err) => {
        console.log(`[Server]: error for ${assignedId} (${socket.id}):`, err.message);
    });

    socket.on('disconnect', (reason) => {
        console.log(`[Server]: A user disconnected: ${socket.id} (${assignedId}). Reason: ${reason}`);
        if (players[assignedId] === socket.id) {
            delete players[assignedId];
            playerCount--;
        }
    });
});

io.engine.on('connection_error', (err) => {
    console.log(`[Server]: Engine connection_error:`, err.message);
});

server.listen(PORT, () => {
    console.log(`[Server]: Wizard Arena running on http://localhost:${PORT}`);
});
