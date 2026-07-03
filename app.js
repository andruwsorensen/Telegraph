const MORSE = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  0: "-----",
  1: ".----",
  2: "..---",
  3: "...--",
  4: "....-",
  5: ".....",
  6: "-....",
  7: "--...",
  8: "---..",
  9: "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "!": "-.-.--",
  "'": ".----.",
  "/": "-..-.",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  "(": "-.--.",
  ")": "-.--.-",
};

const FROM_MORSE = Object.fromEntries(
  Object.entries(MORSE).map(([character, code]) => [code, character]),
);

const MIN_MANUAL_LETTER_GAP_UNITS = 6;
const MANUAL_WORD_GAP_EXTRA_UNITS = 4;
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

const state = {
  audioContext: null,
  oscillator: null,
  gain: null,
  isPressed: false,
  pressedAt: 0,
  currentCode: "",
  decodedText: "",
  letterTimer: 0,
  wordTimer: 0,
  playing: false,
  audioPrimed: false,
  toneRequestId: 0,
};

const els = {
  audioStatus: document.querySelector("#audioStatus"),
  wpm: document.querySelector("#wpm"),
  wpmValue: document.querySelector("#wpmValue"),
  tone: document.querySelector("#tone"),
  toneValue: document.querySelector("#toneValue"),
  letterGap: document.querySelector("#letterGap"),
  letterGapValue: document.querySelector("#letterGapValue"),
  dashCutoff: document.querySelector("#dashCutoff"),
  dashCutoffValue: document.querySelector("#dashCutoffValue"),
  textInput: document.querySelector("#textInput"),
  encodedOutput: document.querySelector("#encodedOutput"),
  playText: document.querySelector("#playText"),
  enableSound: document.querySelector("#enableSound"),
  telegraphKey: document.querySelector("#telegraphKey"),
  manualMode: document.querySelector(".manual-mode"),
  morseReferenceGrid: document.querySelector("#morseReferenceGrid"),
  currentCode: document.querySelector("#currentCode"),
  decodedOutput: document.querySelector("#decodedOutput"),
  clearManual: document.querySelector("#clearManual"),
};

function dotMs() {
  return 1200 / Number(els.wpm.value);
}

function letterGapUnits() {
  return Number(els.letterGap.value);
}

function wordGapUnits() {
  return Math.max(7, letterGapUnits() + 4);
}

function manualLetterGapUnits() {
  return Math.max(MIN_MANUAL_LETTER_GAP_UNITS, letterGapUnits());
}

function manualWordGapUnits() {
  return manualLetterGapUnits() + MANUAL_WORD_GAP_EXTRA_UNITS;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureAudio() {
  if (!AudioContextClass) {
    els.audioStatus.textContent = "Audio unavailable";
    return false;
  }

  if (!state.audioContext) {
    state.audioContext = new AudioContextClass();
    state.gain = state.audioContext.createGain();
    state.gain.gain.value = 0;
    state.gain.connect(state.audioContext.destination);
  }

  if (state.audioContext.state === "suspended") {
    try {
      await state.audioContext.resume();
    } catch {
      els.audioStatus.textContent = "Tap to enable audio";
      return false;
    }
  }

  if (state.audioContext.state !== "running") {
    els.audioStatus.textContent = "Tap to enable audio";
    return false;
  }

  if (!state.audioPrimed) {
    const source = state.audioContext.createBufferSource();
    source.buffer = state.audioContext.createBuffer(1, 1, state.audioContext.sampleRate);
    source.connect(state.gain);
    source.start(0);
    state.audioPrimed = true;
  }

  return state.audioContext.state === "running";
}

async function enableSound() {
  els.enableSound.disabled = true;
  els.audioStatus.textContent = "Enabling sound";

  if (!(await ensureAudio())) {
    els.enableSound.disabled = false;
    return false;
  }

  const now = state.audioContext.currentTime;
  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = Number(els.tone.value);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  oscillator.connect(gain);
  gain.connect(state.audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.18);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };

  els.audioStatus.textContent = "Audio ready";
  els.enableSound.textContent = "Test sound";
  els.enableSound.disabled = false;
  return true;
}

async function toneOn() {
  if (state.oscillator) return true;

  const requestId = ++state.toneRequestId;
  if (!(await ensureAudio())) return false;

  if (requestId !== state.toneRequestId || (!state.isPressed && !state.playing)) {
    return false;
  }

  const now = state.audioContext.currentTime;
  state.oscillator = state.audioContext.createOscillator();
  state.oscillator.type = "sine";
  state.oscillator.frequency.value = Number(els.tone.value);
  state.oscillator.connect(state.gain);
  state.oscillator.start();
  state.gain.gain.cancelScheduledValues(now);
  state.gain.gain.setTargetAtTime(0.24, now, 0.006);
  els.audioStatus.textContent = "Signal on";
  return true;
}

function toneOff() {
  state.toneRequestId += 1;
  if (!state.audioContext || !state.oscillator) return;

  const oscillator = state.oscillator;
  const now = state.audioContext.currentTime;
  state.gain.gain.cancelScheduledValues(now);
  state.gain.gain.setTargetAtTime(0, now, 0.01);
  oscillator.stop(now + 0.06);
  oscillator.onended = () => {
    if (state.oscillator === oscillator) {
      state.oscillator = null;
      els.audioStatus.textContent = state.playing ? "Playing" : "Audio ready";
    }
  };
}

function encodeText(text) {
  return text
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      [...word]
        .map((character) => MORSE[character])
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join(" / ");
}

function updateEncoded() {
  els.encodedOutput.value = encodeText(els.textInput.value);
}

function updateControls() {
  els.wpmValue.value = `${els.wpm.value} WPM`;
  els.toneValue.value = `${els.tone.value} Hz`;
  els.letterGapValue.value = `${els.letterGap.value} units`;
  els.dashCutoffValue.value = `${els.dashCutoff.value} ms`;
}

function setManualOutputs() {
  els.currentCode.value = state.currentCode;
  els.decodedOutput.value = state.decodedText;
}

function buildMorseReference() {
  const referenceCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  els.morseReferenceGrid.innerHTML = "";

  for (const character of referenceCharacters) {
    const item = document.createElement("div");
    item.className = "reference-item";

    const label = document.createElement("span");
    label.className = "reference-char";
    label.textContent = character;

    const code = document.createElement("span");
    code.className = "reference-code";
    code.textContent = MORSE[character];

    item.append(label, code);
    els.morseReferenceGrid.append(item);
  }
}

function clearManualTimers() {
  clearTimeout(state.letterTimer);
  clearTimeout(state.wordTimer);
}

function commitLetter() {
  if (!state.currentCode) return;
  state.decodedText += FROM_MORSE[state.currentCode] || "?";
  state.currentCode = "";
  setManualOutputs();
}

function commitWordGap() {
  commitLetter();
  if (state.decodedText && !state.decodedText.endsWith(" ")) {
    state.decodedText += " ";
    setManualOutputs();
  }
}

function scheduleManualDecode() {
  clearManualTimers();
  const unit = dotMs();
  state.letterTimer = setTimeout(commitLetter, unit * manualLetterGapUnits());
  state.wordTimer = setTimeout(commitWordGap, unit * manualWordGapUnits());
}

function pressKey() {
  if (state.isPressed || state.playing) return;
  state.isPressed = true;
  state.pressedAt = performance.now();
  clearManualTimers();
  els.telegraphKey.classList.add("is-pressed");
  toneOn();
}

function releaseKey() {
  if (!state.isPressed) return;
  const duration = performance.now() - state.pressedAt;
  state.isPressed = false;
  els.telegraphKey.classList.remove("is-pressed");
  toneOff();

  state.currentCode += duration >= Number(els.dashCutoff.value) ? "-" : ".";
  setManualOutputs();
  scheduleManualDecode();
}

async function playSymbol(symbol, unit) {
  if (symbol === ".") {
    await toneOn();
    await sleep(unit);
    toneOff();
    await sleep(unit);
    return;
  }

  if (symbol === "-") {
    await toneOn();
    await sleep(unit * 3);
    toneOff();
    await sleep(unit);
  }
}

async function playMorse() {
  const code = encodeText(els.textInput.value);
  if (!code || state.playing) return;

  state.playing = true;
  els.playText.disabled = true;
  els.audioStatus.textContent = "Playing";
  const unit = dotMs();

  for (const token of code.split(" ")) {
    if (token === "/") {
      await sleep(unit * Math.max(0, wordGapUnits() - letterGapUnits()));
      continue;
    }

    for (const symbol of token) {
      await playSymbol(symbol, unit);
    }

    await sleep(unit * Math.max(0, letterGapUnits() - 1));
  }

  state.playing = false;
  els.playText.disabled = false;
  els.audioStatus.textContent = "Audio ready";
}

els.textInput.addEventListener("input", updateEncoded);
els.wpm.addEventListener("input", () => {
  updateControls();
  if (state.currentCode) {
    scheduleManualDecode();
  }
});
els.tone.addEventListener("input", () => {
  updateControls();
  if (state.oscillator) {
    state.oscillator.frequency.value = Number(els.tone.value);
  }
});
els.letterGap.addEventListener("input", () => {
  updateControls();
  if (state.currentCode) {
    scheduleManualDecode();
  }
});
els.dashCutoff.addEventListener("input", updateControls);
els.enableSound.addEventListener("click", enableSound);
els.playText.addEventListener("click", playMorse);
els.clearManual.addEventListener("click", () => {
  clearManualTimers();
  state.currentCode = "";
  state.decodedText = "";
  setManualOutputs();
});

function handleKeyStart(event) {
  event.preventDefault();
  if (event.pointerId !== undefined) {
    els.telegraphKey.setPointerCapture(event.pointerId);
  }
  pressKey();
}

function handleKeyEnd(event) {
  event.preventDefault();
  releaseKey();
}

if (window.PointerEvent) {
  els.telegraphKey.addEventListener("pointerdown", handleKeyStart);
  els.telegraphKey.addEventListener("pointerup", handleKeyEnd);
  els.telegraphKey.addEventListener("pointercancel", handleKeyEnd);
  els.telegraphKey.addEventListener("pointerleave", handleKeyEnd);
} else {
  els.telegraphKey.addEventListener("touchstart", handleKeyStart, { passive: false });
  els.telegraphKey.addEventListener("touchend", handleKeyEnd, { passive: false });
  els.telegraphKey.addEventListener("touchcancel", handleKeyEnd, { passive: false });
  els.telegraphKey.addEventListener("mousedown", handleKeyStart);
  els.telegraphKey.addEventListener("mouseup", handleKeyEnd);
  els.telegraphKey.addEventListener("mouseleave", handleKeyEnd);
}

els.manualMode.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

els.manualMode.addEventListener("selectstart", (event) => {
  event.preventDefault();
});

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.repeat) return;
  if (document.activeElement === els.textInput) return;
  event.preventDefault();
  pressKey();
});

window.addEventListener("keyup", (event) => {
  if (event.code !== "Space") return;
  if (document.activeElement === els.textInput) return;
  event.preventDefault();
  releaseKey();
});

updateControls();
updateEncoded();
buildMorseReference();
setManualOutputs();
