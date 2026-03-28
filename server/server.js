const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
app.use(express.static(path.join(__dirname, '../client')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// ── Game state (server-authoritative) ─────────────────────────────────────
// The server owns HP. Clients own position/physics.

const STARTING_HP = 100;
const RESPAWN_DELAY = 3000; // ms

let gameState = {
    'Player 1': { hp: STARTING_HP, alive: true },
    'Player 2': { hp: STARTING_HP, alive: true },
};

function resetGameState() {
    gameState = {
        'Player 1': { hp: STARTING_HP, alive: true },
        'Player 2': { hp: STARTING_HP, alive: true },
    };
}

// ── Server setup ───────────────────────────────────────────────────────────

const players = {};
let playerCount = 0;

function attachSocketIO(server) {
    const io = new Server(server);

    io.on('connection', (socket) => {
        console.log(`[Server]: Connected: ${socket.id}`);

        if (playerCount >= 2) {
            console.log(`[Server]: Rejected ${socket.id} — lobby full.`);
            socket.disconnect(true);
            return;
        }

        const assignedId = players['Player 1'] ? 'Player 2' : 'Player 1';
        players[assignedId] = socket.id;
        playerCount++;
        console.log(`[Server]: Assigned ${assignedId} to ${socket.id}`);

        socket.emit('PLAYER_JOINED', { id: assignedId, socketId: socket.id });

        // Sync current HP to the newly joined player
        socket.emit('HP_UPDATE', { playerId: 'Player 1', hp: gameState['Player 1'].hp });
        socket.emit('HP_UPDATE', { playerId: 'Player 2', hp: gameState['Player 2'].hp });

        // ── Position / spell relay ─────────────────────────────────────────

        socket.on('STATE_UPDATE', (data) => {
            socket.broadcast.emit('BROADCAST_STATE', data);
        });

        socket.on('SPELL_CAST', (data) => {
            socket.broadcast.emit('BROADCAST_SPELL', data);
        });

        // ── HP authority ───────────────────────────────────────────────────
        // Client reports a hit; server validates and resolves damage.

        socket.on('SPELL_HIT', ({ targetId, damage, spell }) => {
            const target = gameState[targetId];
            if (!target || !target.alive) return;

            const clampedDmg = Math.min(Math.max(0, damage), 50); // sanity cap
            target.hp = Math.max(0, target.hp - clampedDmg);

            console.log(`[Server]: ${spell} hit ${targetId} for ${clampedDmg}hp → ${target.hp}hp`);

            // Broadcast authoritative HP to both players
            io.emit('HP_UPDATE', { playerId: targetId, hp: target.hp });

            if (target.hp <= 0) {
                target.alive = false;
                console.log(`[Server]: ${targetId} died. Respawning in ${RESPAWN_DELAY}ms`);

                setTimeout(() => {
                    target.hp = STARTING_HP;
                    target.alive = true;
                    io.emit('HP_UPDATE', { playerId: targetId, hp: STARTING_HP });
                    console.log(`[Server]: ${targetId} respawned.`);
                }, RESPAWN_DELAY);
            }
        });

        // ── Disconnect ─────────────────────────────────────────────────────

        socket.on('disconnect', (reason) => {
            console.log(`[Server]: ${assignedId} disconnected — ${reason}`);
            if (players[assignedId] === socket.id) {
                delete players[assignedId];
                playerCount--;
            }
            // Reset game state so a fresh player can join cleanly
            if (playerCount === 0) resetGameState();
        });

        socket.on('error', (err) => console.error(`[Server]: socket error for ${assignedId}:`, err.message));
        socket.on('connect_error', (err) => console.error(`[Server]: connect_error for ${assignedId}:`, err.message));
    });

    io.engine.on('connection_error', (err) => {
        console.error('[Server]: engine connection_error:', err.message);
    });
}

// ── HTTPS / HTTP boot ──────────────────────────────────────────────────────

const CERT_KEY = path.join(__dirname, 'cert', 'key.pem');
const CERT_CERT = path.join(__dirname, 'cert', 'cert.pem');

if (fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CERT)) {
    const httpsServer = https.createServer({
        key: fs.readFileSync(CERT_KEY),
        cert: fs.readFileSync(CERT_CERT),
    }, app);

    attachSocketIO(httpsServer);
    httpsServer.listen(3000, () => {
        console.log('[Server]: Wizard Arena (HTTPS) → https://localhost:3000');
        console.log('[Server]: LAN friend → https://<YOUR-LAN-IP>:3000 (accept cert warning)');
    });
} else {
    const httpServer = http.createServer(app);
    attachSocketIO(httpServer);
    httpServer.listen(3000, () => {
        console.log('[Server]: Wizard Arena (HTTP) → http://localhost:3000');
        console.log('[Server]: ⚠️  Microphone will NOT work for LAN players over HTTP.');
        console.log('[Server]: Generate a self-signed cert to fix this:');
        console.log('   mkdir -p server/cert && cd server/cert');
        console.log('   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"');
    });
}
