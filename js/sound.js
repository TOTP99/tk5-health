"use strict";
/* =====================================================================
   Button click sound effect.

   iOS Safari (and Bluefy, which is a Safari/WebKit wrapper) mutes
   synthesized Web Audio tones whenever the hardware silent switch is
   on — this is a long-standing WebKit limitation with no fully public
   workaround from a website. The best available mitigation:

     1. A hidden, silent <audio> element (#audioUnlock in index.html) is
        played once on the very first user gesture. This nudges iOS to
        treat the page's audio as an active "playback" session rather
        than "ambient", which lets a following Web Audio tone through
        far more often than if we only ever used the AudioContext.
     2. The actual click tone is a short synthesized "tick" through the
        Web Audio API so it doesn't need any bundled audio asset.

   This is best-effort, not a guarantee — but by design, the very first
   tap anywhere primes the audio session, so every click after that one
   should sound normally, even on runs where the very first click is
   silent.
===================================================================== */

let audioCtx = null;
let soundUnlocked = false;

function unlockAudioSession() {
  if (soundUnlocked) return;
  soundUnlocked = true;
  try {
    const el = $("audioUnlock");
    if (el) { el.currentTime = 0; el.play().catch(() => {}); }
  } catch (_) {}
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) {}
}

function playClick() {
  unlockAudioSession();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  try {
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(500, t0 + 0.08);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.11);
  } catch (_) {}
}

function initSoundEffects() {
  // Nothing to wire up eagerly — unlockAudioSession() runs lazily
  // inside the first playClick() call, which the global button click
  // listener in main.js already triggers on every press.
}
