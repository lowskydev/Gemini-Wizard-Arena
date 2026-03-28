// audio.js - Web Audio & Gemini AI Integration

const API_KEY = 'LOAD_FROM_ENV'; // The actual key was moved to the .env file
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// System prompt exactly as defined in the skill file
const SYSTEM_PROMPT = `Listen to the audio. Determine which spell the user is trying to cast. Return ONLY a valid JSON object matching this schema: { "spell": "fireball" | "frostbite" | "bolt" | "nova", "backfire": boolean }. If the user is mumbling, stuttering, or the word is unintelligible, set backfire to true. Do not wrap the output in markdown code blocks.`;

let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let microphone;
let animationId;
let peakVolume = 0;
let playerSpeed = 1.0; // Track movement speed (1.0 = 100%, 0.5 = 50%)

// Initialize audio context and request microphone permissions
async function initAudio() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error("getUserMedia is not supported on your browser!");
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Choose appropriate mime type
    // WebM is widely supported for recording in Chrome/Firefox
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    // Set up AudioContext for volume calculation
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = []; // reset for next recording

      // Calculate multiplier from peak volume locally
      let scaleMultiplier = 1.0;
      if (peakVolume >= 1 && peakVolume <= 50) {
        scaleMultiplier = 1.0; // Normal
      } else if (peakVolume >= 51 && peakVolume <= 85) {
        scaleMultiplier = 1.5; // Yelling
      } else if (peakVolume >= 86 && peakVolume <= 100) {
        scaleMultiplier = 2.0; // Screaming
      }

      console.log(`Recording finished. Peak volume: ${peakVolume}/100, Applied Multiplier: ${scaleMultiplier}x`);

      // Send the recorded audio to Gemini API
      await sendAudioToGemini(audioBlob, scaleMultiplier);
    };

    return true;
  } catch (err) {
    console.error("Error accessing the microphone:", err);
    return false;
  }
}

// Loop to calculate the volume while recording
function updateVolumeLevel() {
  if (!isRecording) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    sum += dataArray[i];
  }

  const average = sum / bufferLength;
  // Normalize average (0-255) to a 1-100 scale
  // Multiplied slightly to make higher values more reachable
  let currentVolume = Math.min(100, Math.max(1, Math.round((average / 255) * 100 * 1.5)));

  if (currentVolume > peakVolume) {
    peakVolume = currentVolume;
  }

  animationId = requestAnimationFrame(updateVolumeLevel);
}

// Helper to encode Blob to base64 for the inline_data requirement of Gemini API
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // FileReader result looks like: "data:audio/webm;base64,GkXf..."
      // We only want the base64 string
      const baseString = reader.result.split(',')[1];
      resolve(baseString);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Fetch request to Gemini 1.5 API
async function sendAudioToGemini(audioBlob, scaleMultiplier) {
  try {
    const base64Audio = await blobToBase64(audioBlob);

    const payload = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: "audio/webm",
                data: base64Audio
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        // Optional: enforces json output structure if applicable
        response_mime_type: "application/json"
      }
    };

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const botReplyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (botReplyText) {
      const parsedJSON = JSON.parse(botReplyText.trim());
      console.log("-----------------------------------------");
      console.log(" Spell Parsing Result:", parsedJSON);
      console.log(" Volume Scale Multiplier:", scaleMultiplier);
      console.log("-----------------------------------------");
    } else {
      console.error("Unexpected response payload from Gemini:", data);
    }

  } catch (error) {
    console.error("Failed to process Gemini API request:", error);
  }
}

// Event Listeners for SHIFT key
window.addEventListener('keydown', async (e) => {
  // Trigger only on Shift key, not repeating, and not already recording
  if (e.key === 'Shift' && !e.repeat && !isRecording) {

    // Lazy-load audio setup
    if (!mediaRecorder) {
      const success = await initAudio();
      if (!success) return;
    }

    if (mediaRecorder.state === 'inactive') {
      // Ensure AudioContext is running (browsers suspend it by default until interaction)
      if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      isRecording = true;
      peakVolume = 0; // Reset peak volume for new recording

      // Constraint: drop player's movement speed to 50%
      playerSpeed = 0.5;
      console.log(`[Shift Down] Recording... Player speed reduced to ${playerSpeed * 100}%`);

      mediaRecorder.start();
      updateVolumeLevel();
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift' && isRecording) {
    isRecording = false;

    // Constraint: restore player's movement speed to 100%
    playerSpeed = 1.0;
    console.log(`[Shift Up] Recording stopped. Player speed restored to ${playerSpeed * 100}%`);

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      cancelAnimationFrame(animationId);
    }
  }
});
