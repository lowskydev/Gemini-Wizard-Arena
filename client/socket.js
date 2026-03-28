// socket.js — Socket.io connection + server event wiring
// ─────────────────────────────────────────────────────────────────────────────
// Globals exposed to GameScene:
//   socket       — live Socket.io instance
//   myPlayerId   — 'Player 1' | 'Player 2'
//   gameSceneRef — injected by GameScene.create()
// ─────────────────────────────────────────────────────────────────────────────

const socket = io();  // eslint-disable-line no-undef

let myPlayerId = null;
let gameSceneRef = null;

// ── Server → Client ────────────────────────────────────────────────────────

socket.on('connect', () => {
    console.log('[Socket]: Connected —', socket.id);
});

socket.on('PLAYER_JOINED', ({ id, socketId }) => {
    myPlayerId = id;
    console.log(`[Socket]: Assigned ${id} (socket ${socketId})`);
    if (gameSceneRef) gameSceneRef.assignPlayers();
});

socket.on('BROADCAST_STATE', (data) => {
    if (gameSceneRef) gameSceneRef.onRemoteStateUpdate(data);
});

socket.on('BROADCAST_SPELL', (data) => {
    if (gameSceneRef) gameSceneRef.onRemoteSpell(data);
});

/** Server has resolved damage — update the authoritative HP display. */
socket.on('HP_UPDATE', (data) => {
    if (gameSceneRef) gameSceneRef.onHpUpdate(data);
});

socket.on('connect_error', (err) => {
    console.error('[Socket]: connect_error —', err.message);
});

// ── Audio → Game bridge ────────────────────────────────────────────────────
// audio.js calls window.castSpellFromAudio(result) after Gemini responds.
// GameScene.prepareSpell stores it; user clicks to fire.

window.castSpellFromAudio = (result) => {
    if (!gameSceneRef) {
        console.warn('[Socket]: castSpellFromAudio called before GameScene was ready.');
        return;
    }
    gameSceneRef.prepareSpell(result);
};
