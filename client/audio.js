// audio.js - Web Audio & Gemini AI Integration
//
// ═══════════════════════════════════════════════════════════════
//  SPELLS (hold SHIFT, say the spell name, release SHIFT):
//  "Fireball" · "Frostbite" · "Bolt" · "Nova" · "Surprise"
//  BACKFIRE: mumble or wrong word → spell hits YOU instead.
// ═══════════════════════════════════════════════════════════════

const PLAYER_SPEED_NORMAL = 1.0;
const PLAYER_SPEED_CASTING = 0.5;

const API_KEY = CONFIG.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

const SYSTEM_PROMPT = `Listen to the audio and transcribe exactly what the user said.

The ONLY valid spell names are these 5 English words: "fireball", "frostbite", "bolt", "nova", "surprise".

Return ONLY a valid JSON object matching this schema:
{
  "heard": string,
  "spell": "fireball" | "frostbite" | "bolt" | "nova" | "surprise",
  "clarity": number (0-100),
  "backfire": boolean
}

Rules:
- "heard" -> exactly what you heard, in whatever language.
- "spell" -> only if "heard" exactly matches one of the 5 valid spell names (case-insensitive). Otherwise pick the closest as a formality.
- "clarity" -> how closely "heard" matches one of the 5 spell names. Non-matching words must be below 25. Different language words below 10.
- "backfire" -> true if "heard" is anything other than one of the 5 exact spell names. Only false when the user clearly said one of the 5.

Do not wrap the output in markdown code blocks.`;

const SPELLS = ['fireball', 'frostbite', 'bolt', 'nova'];

let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let microphone;
let animationId;
let peakVolume = 0;

// playerSpeed read by game.js handleMyMovement() as a global
var playerSpeed = PLAYER_SPEED_NORMAL;

// ─── Audio Init ───────────────────────────────────────────────────────────────

async function initAudio() {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.error('[Audio Init Error]: getUserMedia not supported.');
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      await sendAudioToGemini(audioBlob, peakVolume);
    };

    return true;
  } catch (err) {
    console.error('[Audio Init Error]:', err);
    return false;
  }
}

// ─── Volume Loop ──────────────────────────────────────────────────────────────

function updateVolumeLevel() {
  if (!isRecording) return;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;
  const vol = Math.min(100, Math.max(1, Math.round((avg / 255) * 100 * 1.5)));
  if (vol > peakVolume) peakVolume = vol;
  animationId = requestAnimationFrame(updateVolumeLevel);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function resolveSpell(spell) {
  if (spell !== 'surprise') return spell;
  return SPELLS[Math.floor(Math.random() * SPELLS.length)];
}

// ─── Gemini API Call ──────────────────────────────────────────────────────────

async function sendAudioToGemini(audioBlob, volume) {
  try {
    const base64Audio = await blobToBase64(audioBlob);

    const payload = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ inline_data: { mime_type: 'audio/webm', data: base64Audio } }] }],
      generationConfig: { temperature: 0.1, response_mime_type: 'application/json' }
    };

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const replyTxt = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyTxt) {
      console.error('[Gemini Error]: Unexpected payload:', data);
      return;
    }

    const parsed = JSON.parse(replyTxt.trim());
    const result = {
      spell: resolveSpell(parsed.spell),
      clarity: parsed.clarity,
      volume: volume,
      backfire: parsed.backfire,
    };

    console.log('-----------------------------------------');
    console.log(' heard:   ', parsed.heard);
    console.log(' spell:   ', result.spell);
    console.log(' clarity: ', result.clarity, '/ 100');
    console.log(' volume:  ', result.volume, '/ 100');
    console.log(' backfire:', result.backfire);
    console.log('-----------------------------------------');

    // Hand off to Phaser game
    if (typeof window.castSpellFromAudio === 'function') {
      window.castSpellFromAudio(result);
    } else {
      console.warn('[Audio]: window.castSpellFromAudio not ready yet.');
    }

  } catch (err) {
    console.error('[Gemini Request Error]:', err);
  }
}

// ─── SHIFT Key Listeners ──────────────────────────────────────────────────────

let lastCastTime = 0;
const CAST_COOLDOWN_MS = 2000; // 2 seconds between casts

window.addEventListener('keydown', async (e) => {
  const now = Date.now();
  if (e.key === 'Shift' && !e.repeat && !isRecording && (now - lastCastTime) >= CAST_COOLDOWN_MS) {
    if (!mediaRecorder) {
      const ok = await initAudio();
      if (!ok) return;
    }
    if (mediaRecorder.state === 'inactive') {
      if (audioContext?.state === 'suspended') await audioContext.resume();
      isRecording = true;
      peakVolume = 0;
      playerSpeed = PLAYER_SPEED_CASTING;
      console.log('[Shift Down] Recording... speed -> 50%');
      mediaRecorder.start();
      updateVolumeLevel();
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift' && isRecording) {
    isRecording = false;
    lastCastTime = Date.now();
    playerSpeed = PLAYER_SPEED_NORMAL;
    console.log('[Shift Up] Recording stopped. speed -> 100%');
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
      cancelAnimationFrame(animationId);
    }
  }
});