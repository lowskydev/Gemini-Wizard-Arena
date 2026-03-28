// audio.js — Web Audio & Gemini AI Integration
//
// ═══════════════════════════════════════════════════════════════
//  FLOW: Press SHIFT once → "Say a spell!" → speak → auto-stop
//        → "Charging…" while API processes → "Ready!" on result
//  SPELLS: "Fireball" · "Frostbite" · "Bolt" · "Nova" · "Surprise"
// ═══════════════════════════════════════════════════════════════

const PLAYER_SPEED_NORMAL = 1.0;
const PLAYER_SPEED_CASTING = window.SPELL_CONFIG?.CASTING_SPEED_MULT ?? 0.5;

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

const CORE_SPELLS = ['fireball', 'frostbite', 'bolt', 'nova'];

let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let microphone;
let animationId;
let peakVolume = 0;

// Casting state — read by game via events
var playerSpeed = PLAYER_SPEED_NORMAL;

// ── Casting state machine ─────────────────────────────────────────────────
// States: IDLE → LISTENING → PROCESSING → READY → IDLE
// Events dispatched: castStateChange { detail: { state, data? } }

const CastState = { IDLE: 'idle', LISTENING: 'listening', PROCESSING: 'processing', READY: 'ready' };
window.CastState = CastState;
let currentCastState = CastState.IDLE;

function setCastState(state, data) {
  currentCastState = state;
  window.dispatchEvent(new CustomEvent('castStateChange', { detail: { state, data } }));
}

// Keep currentCastState in sync when OTHER files dispatch the event (e.g. spells.js resets to IDLE)
window.addEventListener('castStateChange', (e) => {
  currentCastState = e.detail.state;
});

// ─── Audio Init ───────────────────────────────────────────────────────────

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

      // Transition: LISTENING → PROCESSING
      playerSpeed = PLAYER_SPEED_NORMAL;
      setCastState(CastState.PROCESSING);

      await sendAudioToGemini(audioBlob, peakVolume);
    };

    return true;
  } catch (err) {
    console.error('[Audio Init Error]:', err);
    return false;
  }
}

// ─── Volume Loop ──────────────────────────────────────────────────────────

function updateVolumeLevel() {
  if (!isRecording) return;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;
  const vol = Math.min(100, Math.max(1, Math.round((avg / 255) * 100 * 1.5)));
  if (vol > peakVolume) peakVolume = vol;

  // Dispatch live volume for HUD visualisation
  window.dispatchEvent(new CustomEvent('micVolume', { detail: vol }));

  animationId = requestAnimationFrame(updateVolumeLevel);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

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
  return CORE_SPELLS[Math.floor(Math.random() * CORE_SPELLS.length)];
}

// ─── Gemini API Call ──────────────────────────────────────────────────────

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
      setCastState(CastState.IDLE);
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

    // Transition: PROCESSING → READY (with spell data)
    setCastState(CastState.READY, result);

    // Hand off to Phaser game
    if (typeof window.castSpellFromAudio === 'function') {
      window.castSpellFromAudio(result);
    } else {
      console.warn('[Audio]: window.castSpellFromAudio not ready yet.');
    }

  } catch (err) {
    console.error('[Gemini Request Error]:', err);
    setCastState(CastState.IDLE);
  }
}

// ─── SHIFT Key — Toggle-based recording ───────────────────────────────────
// Press SHIFT once → start recording → auto-stops after RECORD_DURATION_MS
// Press SHIFT again while recording → immediate stop

let lastCastTime = 0;
let recordingTimeout;
const CAST_COOLDOWN_MS = window.SPELL_CONFIG?.CAST_COOLDOWN_MS ?? 2000;
const RECORD_DURATION_MS = window.SPELL_CONFIG?.RECORD_DURATION_MS ?? 2500;

window.addEventListener('keydown', async (e) => {
  if (e.key !== 'Shift' || e.repeat) return;

  // If already recording, stop immediately (toggle off)
  if (isRecording) {
    if (recordingTimeout) clearTimeout(recordingTimeout);
    stopRecording();
    return;
  }

  // If in PROCESSING or READY state, ignore new recordings
  if (currentCastState === CastState.PROCESSING || currentCastState === CastState.READY) return;

  // Cooldown check
  const now = Date.now();
  if ((now - lastCastTime) < CAST_COOLDOWN_MS) return;

  // Init mic if needed
  if (!mediaRecorder) {
    const ok = await initAudio();
    if (!ok) return;
  }

  if (mediaRecorder.state === 'inactive') {
    if (audioContext?.state === 'suspended') await audioContext.resume();

    isRecording = true;
    peakVolume = 0;
    playerSpeed = PLAYER_SPEED_CASTING;

    // Transition: IDLE → LISTENING
    setCastState(CastState.LISTENING);

    console.log('[Shift] Recording started (toggle). Speed → 50%');
    mediaRecorder.start();
    updateVolumeLevel();

    // Auto-stop after duration
    recordingTimeout = setTimeout(() => {
      stopRecording();
    }, RECORD_DURATION_MS);
  }
});

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;
  lastCastTime = Date.now();

  console.log('[Stop] Recording stopped.');

  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.stop();
    cancelAnimationFrame(animationId);
  }
}
