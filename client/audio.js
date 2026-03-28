// audio.js - Web Audio & Gemini AI Integration
//
// ═══════════════════════════════════════════════════════════════
//  SPELLS (hold SHIFT, say the spell name, release SHIFT):
//  ────────────────────────────────────────────────────────
//  "Fireball"  → Fast orange projectile toward the cursor.
//  "Frostbite" → Slow icy projectile, slows enemy on hit.
//  "Bolt"      → Lightning-fast straight projectile.
//  "Nova"      → Explodes in all directions from the caster.
//  "Surprise"  → Random spell. Chaos is the point.
//
//  BACKFIRE: mumble or stutter → spell hits YOU instead.
//
//  OUTPUT JSON:
//  { spell, clarity, volume, backfire }
//    spell    — spell name (surprise already resolved to a real spell)
//    clarity  — 0–100, how clearly the word was spoken (from Gemini)
//    volume   — 1–100, mic peak volume (from mic)
//    backfire — true if the cast should explode on the caster
// ═══════════════════════════════════════════════════════════════

const PLAYER_SPEED_NORMAL = 1.0;  // Movement multiplier when idle
const PLAYER_SPEED_CASTING = 0.5;  // Movement multiplier while holding SHIFT

const API_KEY = CONFIG.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

const SYSTEM_PROMPT = `Listen to the audio and transcribe exactly what the user said.

The ONLY valid spell names are these 5 English words: "fireball", "frostbite", "bolt", "nova", "surprise".

First, transcribe what you heard. Then compare it strictly to the 5 valid spell names.

Return ONLY a valid JSON object matching this schema:
{
  "heard": string,
  "spell": "fireball" | "frostbite" | "bolt" | "nova" | "surprise",
  "clarity": number (0-100),
  "backfire": boolean
}

Rules:
- "heard" -> write out exactly what word or words you heard, in whatever language.
- "spell" -> only if "heard" exactly matches one of the 5 valid spell names (case-insensitive). Otherwise pick the closest one as a formality — it does not matter since backfire will be true.
- "clarity" -> how closely "heard" matches one of the 5 exact valid spell names. If "heard" is not one of the 5 spell names, clarity must be below 25, no exceptions. If "heard" is a different language word, clarity must be below 10.
- "backfire" -> true if "heard" is anything other than one of the 5 exact spell names. This includes: words in other languages, partial spell names, random English words, mumbling, silence, or anything else. backfire is ONLY false when the user said one of the 5 exact spell names clearly.

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

// playerSpeed is read by game.js in handleLocalPlayerMovement()
// Declared as var so game.js can read it as a global
var playerSpeed = PLAYER_SPEED_NORMAL;

// ─── Audio Init ───────────────────────────────────────────────────────────────

async function initAudio() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('[Audio Init Error]: getUserMedia not supported in this browser.');
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

  const average = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
  const currentVolume = Math.min(100, Math.max(1, Math.round((average / 255) * 100 * 1.5)));

  if (currentVolume > peakVolume) peakVolume = currentVolume;

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
      contents: [{
        parts: [{ inline_data: { mime_type: 'audio/webm', data: base64Audio } }]
      }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json'
      }
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
    const botReplyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!botReplyText) {
      console.error('[Gemini Error]: Unexpected response payload:', data);
      return;
    }

    const parsed = JSON.parse(botReplyText.trim());

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

    // Hand the result off to Phaser via the bridge function defined in game.js
    if (typeof window.castSpellFromAudio === 'function') {
      window.castSpellFromAudio(result);
    } else {
      console.warn('[Audio]: window.castSpellFromAudio not ready yet.');
    }

  } catch (error) {
    console.error('[Gemini Request Error]:', error);
  }
}

// ─── SHIFT Key Listeners ──────────────────────────────────────────────────────

window.addEventListener('keydown', async (e) => {
  if (e.key === 'Shift' && !e.repeat && !isRecording) {

    if (!mediaRecorder) {
      const success = await initAudio();
      if (!success) return;
    }

    if (mediaRecorder.state === 'inactive') {
      if (audioContext?.state === 'suspended') await audioContext.resume();

      isRecording = true;
      peakVolume = 0;
      playerSpeed = PLAYER_SPEED_CASTING;

      console.log(`[Shift Down] Recording... speed -> ${playerSpeed * 100}%`);
      mediaRecorder.start();
      updateVolumeLevel();
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift' && isRecording) {
    isRecording = false;
    playerSpeed = PLAYER_SPEED_NORMAL;

    console.log(`[Shift Up] Recording stopped. speed -> ${playerSpeed * 100}%`);

    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
      cancelAnimationFrame(animationId);
    }
  }
});