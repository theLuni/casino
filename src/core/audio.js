/* Лёгкий синтезатор звуков на WebAudio.
   Все эффекты синтезируются кодом — внешние аудио-файлы не нужны.
   Громкость скромная, есть глобальный mute (сохраняется в настройках). */

let ac = null;
let master = null;
let enabled = true;

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone({ f = 440, f2, type = 'sine', t = 0.12, g = 0.18, delay = 0 }) {
  if (!enabled) return;
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const gn = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + t);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(g, t0 + 0.012);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  o.connect(gn);
  gn.connect(master);
  o.start(t0);
  o.stop(t0 + t + 0.03);
}

function noise(t = 0.08, g = 0.12, delay = 0) {
  if (!enabled) return;
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * t);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const gn = c.createGain();
  gn.gain.setValueAtTime(g, t0);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  const fl = c.createBiquadFilter();
  fl.type = 'highpass';
  fl.frequency.value = 900;
  src.connect(fl);
  fl.connect(gn);
  gn.connect(master);
  src.start(t0);
  src.stop(t0 + t + 0.02);
}

const sfx = {
  click: () => tone({ f: 920, type: 'triangle', t: 0.06, g: 0.12 }),
  tick: () => tone({ f: 1500, type: 'square', t: 0.028, g: 0.05 }),
  deal: () => {
    noise(0.05, 0.05);
    tone({ f: 300, type: 'sine', t: 0.06, g: 0.08 });
  },
  spin: () => tone({ f: 180, f2: 760, type: 'sawtooth', t: 0.32, g: 0.07 }),
  roll: () => {
    noise(0.16, 0.09);
    tone({ f: 240, f2: 90, type: 'triangle', t: 0.18, g: 0.1 });
  },
  flip: () => tone({ f: 700, f2: 1100, type: 'sine', t: 0.14, g: 0.09 }),
  win: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ f, type: 'triangle', t: 0.2, g: 0.16, delay: i * 0.07 })
    );
  },
  bigWin: () => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone({ f, type: 'triangle', t: 0.28, g: 0.17, delay: i * 0.065 })
    );
  },
  lose: () => {
    tone({ f: 220, f2: 105, type: 'sawtooth', t: 0.26, g: 0.1 });
    noise(0.12, 0.05);
  },
  cash: () => {
    tone({ f: 880, type: 'sine', t: 0.09, g: 0.14 });
    tone({ f: 1318.5, type: 'sine', t: 0.22, g: 0.12, delay: 0.06 });
  },
  coin: () => {
    tone({ f: 1567, type: 'sine', t: 0.07, g: 0.1 });
    tone({ f: 2093, type: 'sine', t: 0.24, g: 0.09, delay: 0.05 });
  },
  error: () => {
    tone({ f: 180, type: 'square', t: 0.09, g: 0.09 });
    tone({ f: 140, type: 'square', t: 0.12, g: 0.09, delay: 0.08 });
  },
  pop: () => tone({ f: 640, f2: 960, type: 'triangle', t: 0.1, g: 0.1 }),
};

export const audio = {
  get on() {
    return enabled;
  },
  set(on) {
    enabled = !!on;
    if (!enabled && ac) master.gain.setTargetAtTime(0, ac.currentTime, 0.02);
    if (enabled && ac) master.gain.setTargetAtTime(0.5, ac.currentTime, 0.02);
  },
  init() {
    ctx();
  },
  play(name) {
    const fn = sfx[name];
    if (fn) fn();
  },
};
