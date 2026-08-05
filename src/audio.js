/* Every sound is synthesised at runtime — the repository ships no audio files. */

let ctx = null;

export function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noise(duration, freq, gainValue, type = "lowpass") {
  const c = audio();
  const frames = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.value = gainValue;
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
}

function tone(freq, duration, gainValue, type = "sawtooth", slideTo = null) {
  const c = audio();
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  if (slideTo)
    osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + duration);
  const gain = c.createGain();
  gain.gain.value = gainValue;
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

/** Distant sounds are quieter and duller, which is enough to localise them. */
const falloff = (distance) => Math.max(0, 1 - distance / 55);

export const sfx = {
  shot(w, distance = 0) {
    const k = distance ? falloff(distance) : 1;
    if (k <= 0.02) return;
    noise(0.13, w.tone * 2.4, w.volume * k);
    tone(w.tone, 0.09, w.volume * 0.5 * k, "square", w.tone * 0.35);
  },
  dryFire: () => tone(180, 0.05, 0.18, "square"),
  reload() {
    noise(0.05, 2600, 0.26, "highpass");
    setTimeout(() => noise(0.06, 1500, 0.28, "highpass"), 220);
  },
  swap: () => noise(0.05, 1800, 0.2, "highpass"),
  flesh: () => noise(0.09, 420, 0.34),
  headshot() {
    noise(0.14, 700, 0.5);
    tone(1400, 0.06, 0.12, "sine", 400);
  },
  impact: (d = 0) => noise(0.06, 1200, 0.2 * falloff(d), "highpass"),
  growl: (d = 0) =>
    tone(70 + Math.random() * 40, 0.5, 0.055 * falloff(d), "sawtooth", 45),
  hurt() {
    noise(0.22, 260, 0.4);
    tone(140, 0.2, 0.12, "square", 70);
  },
  kill() {
    tone(660, 0.07, 0.1, "sine");
    setTimeout(() => tone(880, 0.1, 0.1, "sine"), 60);
  },
  waveClear() {
    tone(392, 0.18, 0.12, "triangle");
    setTimeout(() => tone(523, 0.28, 0.12, "triangle"), 150);
  },
  death: () => tone(200, 1.1, 0.22, "sawtooth", 40),
  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone(f, 0.3, 0.12, "triangle"), i * 130),
    );
  },
  click: () => noise(0.03, 3000, 0.1, "highpass"),

  /** Low body you feel, plus a crack that carries. */
  explosion(distance = 0) {
    const k = Math.max(0.08, falloff(distance));
    noise(0.7, 220, 0.8 * k);
    noise(0.16, 1800, 0.35 * k, "highpass");
    tone(90, 0.55, 0.5 * k, "sine", 32);
  },

  /** The bang, then the ring in your ears. */
  flashbang(distance = 0) {
    const k = Math.max(0.08, falloff(distance));
    noise(0.28, 3400, 0.75 * k, "highpass");
    tone(2600, 1.4, 0.14 * k, "sine", 1900);
  },

  throwSound: () => noise(0.09, 900, 0.16, "highpass"),
};
