/* Общие утилиты: математика, easing-функции, форматирование, RNG, tween-движок. */

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);

export const easeLinear = (t) => t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
export const easeOutBack = (t) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t) => {
  if (t === 0 || t === 1) return t;
  const c = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
};

/* ---------- Форматирование ---------- */

export function formatMoney(n) {
  return Math.round(Math.max(0, n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatSigned(n) {
  const v = Math.round(n);
  return (v > 0 ? '+' : v < 0 ? '−' : '') + formatMoney(Math.abs(v));
}

export function formatTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/* ---------- RNG (crypto, когда доступен) ---------- */

export function cryptoFloat() {
  if (globalThis.crypto?.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 2 ** 32;
  }
  return Math.random();
}

export function cryptoInt(n) {
  return Math.floor(cryptoFloat() * n);
}

export function pick(arr) {
  return arr[cryptoInt(arr.length)];
}

/** Вероятность p → boolean. */
export function chance(p) {
  return cryptoFloat() < p;
}

/* ---------- Tween-движок (общий, тикает из RAF shell'а) ---------- */

const tweens = new Set();

/**
 * tween(dur, onUpdate, opts)
 * onUpdate(t) — t нормализованный 0..1 (сырой), второй аргумент — eased.
 */
export function tween(dur, onUpdate, opts = {}) {
  const { ease = easeOutCubic, delay = 0, onDone } = opts;
  const start = performance.now() + delay;
  const tw = {
    start,
    dur,
    ease,
    onUpdate,
    onDone,
    done: false,
    cancel: () => {
      tw.done = true;
      tweens.delete(tw);
    },
  };
  tweens.add(tw);
  return tw;
}

export function tickTweens(now = performance.now()) {
  for (const tw of [...tweens]) {
    if (now < tw.start) continue;
    const raw = tw.dur <= 0 ? 1 : Math.min(1, (now - tw.start) / tw.dur);
    tw.onUpdate(raw, tw.ease(raw));
    if (raw >= 1) {
      tweens.delete(tw);
      tw.done = true;
      tw.onDone?.();
    }
  }
}

export function clearTweens() {
  tweens.clear();
}
