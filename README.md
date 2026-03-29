# Gemini Wizard Arena

A 2-player LAN wizard duel — shout spells into your microphone, aim with your mouse, and blast your opponent off the platforms.

Built with Phaser 3, Socket.io, Web Audio, WebGPU and the Gemini AI API.

Hackathon Project Developed for the **Software Mansion x Gemini Hackathon**.

![Wizard Arena Gameplay](assets/public/gameplay.png)

---

## Quick Start (3 steps)

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Create your config file

Create the file `client/config.js` with your Gemini API key:

```js
const CONFIG = {
    GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE'
};
```

You can get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### 3. Run the server

```bash
cd server
node server.js
```

Open [http://localhost:3000](http://localhost:3000) in your browser. This works for single-machine testing, but the microphone **will not work** for a second player connecting over the network — you need HTTPS for that. Keep reading.

---

## Setting Up HTTPS (required for LAN play)

Browsers block microphone access on non-localhost HTTP connections. To play with a friend on your local network, you need to run the server over HTTPS with a self-signed certificate.

### Generate the certificate

Run these commands from the project root:

```bash
mkdir -p server/cert
cd server/cert

openssl req -x509 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

That's it. Two files will appear: `server/cert/key.pem` and `server/cert/cert.pem`.

### Start the server

```bash
cd server
node server.js
```

If the certs exist, the server automatically starts in HTTPS mode. You'll see:

```
[Server]: Wizard Arena (HTTPS) → https://localhost:3000
[Server]: LAN friend → https://<YOUR-LAN-IP>:3000 (accept cert warning)
```

---

## Connecting Two Players Over LAN

### Step 1 — Find the host's IP address

On the machine running the server:

| OS      | Command              |
|---------|----------------------|
| macOS   | `ipconfig getifaddr en0` |
| Windows | `ipconfig` → look for IPv4 Address under Wi-Fi or Ethernet |
| Linux   | `hostname -I` or `ip addr` |

You'll get something like `192.168.1.42`.

### Step 2 — Both players open the game

- **Player 1** (host): open `https://localhost:3000`
- **Player 2** (friend): open `https://192.168.1.42:3000` (use the host's IP)

Both machines must be on the **same Wi-Fi / LAN network**.

### Step 3 — Accept the certificate warning

Since the certificate is self-signed, both browsers will show a security warning. This is normal.

- **Chrome**: click "Advanced" → "Proceed to … (unsafe)"
- **Firefox**: click "Advanced" → "Accept the Risk and Continue"
- **Edge**: click "Advanced" → "Continue to … (unsafe)"

You only need to do this once per browser.

### Step 4 — Allow microphone access

Both players must click "Allow" when the browser asks for microphone permission. This prompt appears the first time you press SHIFT to cast a spell.

---

## How to Play

| Control | Action |
|---------|--------|
| **A / D** | Move left / right |
| **SPACE** | Jump (double-jump supported) |
| **S** | Drop through platforms |
| **SHIFT** | Hold to record a spell (speak into mic) |
| **Left Click** | Fire the charged spell at your cursor |

### Casting flow

1. Press **SHIFT** — the HUD shows "SAY A SPELL!"
2. Say one of the spell names into your mic: **Fireball**, **Frostbite**, **Bolt**, **Nova**, or **Surprise** (random)
3. Release SHIFT (or wait for auto-stop) — the HUD shows "CHARGING" while the AI processes your voice
4. Once ready, you get **3 shots** — three glowing pips appear below your character
5. **Left-click** up to 3 times to fire each shot at your cursor
6. Yell louder for bigger, more powerful spells

### Spells

| Spell | Speed | Effect |
|-------|-------|--------|
| Fireball | Medium | Burning damage over time (3s) |
| Frostbite | Medium | Slows enemy movement by 50% (2.5s) |
| Bolt | Very fast | Low damage, hard to dodge |
| Nova | Slow | High damage + knockback |

If you mumble or say something unrecognizable, the spell **backfires** and explodes on you.

---

## Project Structure

```
├── client/
│   ├── config.js          ← YOU CREATE THIS (gitignored)
│   ├── index.html          Entry point
│   ├── audio.js            Mic capture + Gemini AI
│   ├── spell-config.js     Spell stats & volume scaling
│   ├── spells.js           Spell casting & effects
│   ├── hud.js              Casting state HUD
│   ├── arena.js            Arena definitions
│   ├── socket.js           Multiplayer networking
│   ├── spell-fx.js         WebGPU spell textures
│   ├── bg-shader.js        WebGPU background
│   ├── utils.js            Shared helpers
│   ├── style.css
│   └── scenes/
│       ├── MenuScene.js    Arena selection
│       ├── GameScene.js    Main game
│       └── EndScene.js     Death screen
├── server/
│   ├── server.js           Express + Socket.io
│   ├── package.json
│   └── cert/               ← YOU CREATE THIS
│       ├── key.pem
│       └── cert.pem
├── assets/                 Sprites & backgrounds
└── skills/                 AI coding guidelines
```

---

## Troubleshooting

**"Microphone not working for Player 2"**
→ You're running over HTTP. Set up HTTPS (see above).

**"This site can't be reached" on Player 2's machine**
→ Check that both machines are on the same network. Make sure you're using `https://` (not `http://`). Try pinging the host IP from Player 2's machine.

**"Lobby full" in server logs**
→ Only 2 players can connect. If a previous session didn't disconnect cleanly, restart the server.

**Spells not firing after saying the word**
→ Make sure `client/config.js` exists and has a valid Gemini API key. Check the browser console for `[Gemini Error]` messages.

**No WebGPU spell effects**
→ WebGPU is optional. The game falls back to simple colored circles automatically. Chrome 113+ supports WebGPU on most hardware.

---

## License

MIT — see [LICENSE](LICENSE) for details.
