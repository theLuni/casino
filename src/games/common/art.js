/* Общие художники: фишки, монеты, карты, кости, сцена, частицы, текст.
   Всё рисуется «предметно»: градиенты, тени, блики — никаких плоских примитивов. */

import { TAU } from '../../core/util.js';

export const GOLD = '#f5c542';
export const GOLD_DARK = '#c9951f';
export const VIOLET = '#a78bfa';
export const CREAM = '#f4efe6';

export function rr(ctx, x, y, w, h, r) {
  const rr2 = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr2, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr2);
  ctx.arcTo(x + w, y + h, x, y + h, rr2);
  ctx.arcTo(x, y + h, x, y, rr2);
  ctx.arcTo(x, y, x + w, y, rr2);
  ctx.closePath();
}

export function fillRR(ctx, x, y, w, h, r, fill) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeRR(ctx, x, y, w, h, r, stroke, lw = 1) {
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

export function radialGlow(ctx, x, y, r, color, alpha = 0.2) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color}, ${alpha})`);
  g.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function goldGrad(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#f9e29a');
  g.addColorStop(0.45, '#f5c542');
  g.addColorStop(1, '#c9951f');
  return g;
}

/* ---------- Сцена ---------- */

export function drawSceneBg(ctx, w, h, accent = '245,197,66', accent2 = '139,92,246') {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#181022');
  g.addColorStop(0.55, '#110b1c');
  g.addColorStop(1, '#0a0712');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  radialGlow(ctx, w / 2, h * 0.4, Math.max(w, h) * 0.55, accent, 0.09);
  radialGlow(ctx, w * 0.12, h * 0.9, Math.max(w, h) * 0.4, accent2, 0.07);
  radialGlow(ctx, w * 0.88, h * 0.85, Math.max(w, h) * 0.4, accent2, 0.06);

  // сетка
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const step = 46;
  ctx.beginPath();
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // виньетка
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/* ---------- Фишка казино ---------- */

const CHIP_COLORS = [
  [1000, '#ef4444'],
  [500, '#3ecf8e'],
  [100, '#f5c542'],
  [50, '#8b5cf6'],
  [10, '#8a80a8'],
];

export function chipColor(value) {
  for (const [v, c] of CHIP_COLORS) if (value >= v) return c;
  return '#8a80a8';
}

export function drawChip(ctx, x, y, r, value, opts = {}) {
  const color = opts.color || chipColor(value);
  const label = opts.label != null ? opts.label : value;
  ctx.save();
  ctx.translate(x, y);
  // тень
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = r * 0.5;
  ctx.shadowOffsetY = r * 0.18;
  // ободок с «насечками»
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const c = TAU * (r * 0.86);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, 0, TAU);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = r * 0.3;
  ctx.setLineDash([c / 12, c / 12]);
  ctx.stroke();
  ctx.setLineDash([]);
  // сердцевина
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 0.72);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, TAU);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.stroke();
  // номинал
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(r * 0.52)}px Unbounded, Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(label), 0, r * 0.04);
  // блик
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.34, r * 0.16, -0.6, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  ctx.restore();
}

/* ---------- Монета ---------- */

export function drawCoin(ctx, x, y, r, opts = {}) {
  const { face = 'heads', squash = 1, lift = 0 } = opts;
  ctx.save();
  ctx.translate(x, y - lift);
  ctx.scale(squash, 1);

  // толщина монеты (торец)
  ctx.beginPath();
  ctx.arc(0, r * 0.1, r, 0, TAU);
  ctx.fillStyle = '#8a6410';
  ctx.fill();

  // аверс
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffe9a8');
  g.addColorStop(0.45, '#f5c542');
  g.addColorStop(1, '#c9951f');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();

  // внешнее кольцо (гурт)
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.94, 0, TAU);
  ctx.strokeStyle = '#a87c14';
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, 0, TAU);
  ctx.strokeStyle = 'rgba(138,100,16,0.65)';
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.stroke();

  // гравировка
  ctx.strokeStyle = '#9a7212';
  ctx.fillStyle = '#9a7212';
  ctx.lineWidth = Math.max(1.2, r * 0.045);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (face === 'heads') {
    // корона
    const s = r * 0.52;
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, s * 0.35);
    ctx.lineTo(-s * 0.7, -s * 0.35);
    ctx.lineTo(-s * 0.35, -s * 0.02);
    ctx.lineTo(0, -s * 0.62);
    ctx.lineTo(s * 0.35, -s * 0.02);
    ctx.lineTo(s * 0.7, -s * 0.35);
    ctx.lineTo(s * 0.85, s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    fillRR(ctx, -s * 0.85, s * 0.35, s * 1.7, s * 0.22, s * 0.08, '#9a7212');
    // камни на короне
    ctx.fillStyle = '#fff3c4';
    for (const cx of [-s * 0.7, 0, s * 0.7]) {
      ctx.beginPath();
      ctx.arc(cx, -s * 0.35, s * 0.09, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#9a7212';
    ctx.font = `600 ${Math.round(r * 0.2)}px Unbounded, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LUNI', 0, s * 0.85);
  } else {
    // монограмма «L» в лавровом кольце
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.56, 0, TAU);
    ctx.stroke();
    ctx.font = `700 ${Math.round(r * 0.85)}px Unbounded, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('L', 0, r * 0.03);
    ctx.font = `600 ${Math.round(r * 0.18)}px Unbounded, sans-serif`;
    ctx.fillText('ROYAL', 0, r * 0.68);
  }

  // блик
  ctx.beginPath();
  ctx.ellipse(-r * 0.34, -r * 0.42, r * 0.36, r * 0.18, -0.7, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();
  ctx.restore();
}

/* ---------- игральные карты ---------- */

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const SUIT_COLOR = { spades: '#1c1526', clubs: '#1c1526', hearts: '#d8405a', diamonds: '#d8405a' };

export function drawSuit(ctx, suit, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (suit === 'hearts') {
    ctx.beginPath();
    ctx.moveTo(0, 0.34);
    ctx.bezierCurveTo(-0.55, -0.12, -0.52, -0.52, -0.24, -0.52);
    ctx.bezierCurveTo(-0.05, -0.52, 0, -0.38, 0, -0.28);
    ctx.bezierCurveTo(0, -0.38, 0.05, -0.52, 0.24, -0.52);
    ctx.bezierCurveTo(0.52, -0.52, 0.55, -0.12, 0, 0.34);
    ctx.closePath();
    ctx.fill();
  } else if (suit === 'diamonds') {
    ctx.beginPath();
    ctx.moveTo(0, -0.46);
    ctx.lineTo(0.3, 0);
    ctx.lineTo(0, 0.46);
    ctx.lineTo(-0.3, 0);
    ctx.closePath();
    ctx.fill();
  } else if (suit === 'spades') {
    ctx.beginPath();
    ctx.moveTo(0, -0.46);
    ctx.bezierCurveTo(0.3, -0.14, 0.5, -0.02, 0.5, 0.16);
    ctx.bezierCurveTo(0.5, 0.32, 0.3, 0.38, 0.12, 0.34);
    ctx.bezierCurveTo(0.1, 0.48, 0.04, 0.58, -0.08, 0.64);
    ctx.lineTo(0.08, 0.64);
    ctx.bezierCurveTo(-0.04, 0.58, -0.1, 0.48, -0.12, 0.34);
    ctx.bezierCurveTo(-0.3, 0.38, -0.5, 0.32, -0.5, 0.16);
    ctx.bezierCurveTo(-0.5, -0.02, -0.3, -0.14, 0, -0.46);
    ctx.closePath();
    ctx.fill();
  } else if (suit === 'clubs') {
    for (const [cx, cy] of [
      [0, -0.2],
      [-0.22, 0.1],
      [0.22, 0.1],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 0.26, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-0.08, 0.28);
    ctx.lineTo(0.08, 0.28);
    ctx.lineTo(0.05, 0.62);
    ctx.lineTo(-0.05, 0.62);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

const CARD_RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

export function drawCard(ctx, x, y, w, h, card, opts = {}) {
  const { faceUp = true, rot = 0, glow = null } = opts;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot);
  ctx.shadowColor = glow || 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = glow ? 26 : 14;
  ctx.shadowOffsetY = 6;

  if (!faceUp) {
    // рубашка
    fillRR(ctx, -w / 2, -h / 2, w, h, h * 0.09, '#241735');
    strokeRR(ctx, -w / 2, -h / 2, w, h, h * 0.09, 'rgba(245,197,66,0.5)', 1.2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
    ctx.clip();
    ctx.strokeStyle = 'rgba(245,197,66,0.28)';
    ctx.lineWidth = 1.4;
    for (let d = -h; d < w; d += 7) {
      ctx.beginPath();
      ctx.moveTo(-w / 2 + d, -h / 2);
      ctx.lineTo(-w / 2 + d + h, h / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.22, 0, TAU);
    ctx.strokeStyle = 'rgba(245,197,66,0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.12, 0, TAU);
    ctx.fillStyle = 'rgba(245,197,66,0.35)';
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }

  // лицо
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#faf5e8');
  g.addColorStop(1, '#e9dfc7');
  fillRR(ctx, -w / 2, -h / 2, w, h, h * 0.09, g);
  strokeRR(ctx, -w / 2, -h / 2, w, h, h * 0.09, 'rgba(120,100,60,0.5)', 1);

  const color = SUIT_COLOR[card.suit];
  const rank = card.rank;
  const fs = h * 0.2;
  ctx.font = `700 ${fs}px Inter, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // угол сверху слева
  ctx.fillStyle = color;
  ctx.fillText(rank, -w / 2 + w * 0.09, -h / 2 + h * 0.06);
  drawSuit(ctx, card.suit, -w / 2 + w * 0.13 + fs * 0.3, -h / 2 + h * 0.06 + fs * 1.05, fs * 0.42, color);
  // масть по центру
  drawSuit(ctx, card.suit, 0, h * 0.04, h * 0.34, color);
  // угол снизу справа (перевёрнутый)
  ctx.save();
  ctx.translate(w / 2 - w * 0.09, h / 2 - h * 0.06);
  ctx.rotate(Math.PI);
  ctx.fillText(rank, 0, 0);
  ctx.restore();
  ctx.restore();
}

export function randomCard(rand = Math.random) {
  return { rank: CARD_RANKS[(rand() * CARD_RANKS.length) | 0], suit: SUITS[(rand() * 4) | 0] };
}

/* ---------- Кость ---------- */

const DIE_PIPS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

export function drawDie(ctx, x, y, size, face, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const h = size / 2;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.25;
  ctx.shadowOffsetY = size * 0.08;
  const g = ctx.createLinearGradient(-h, -h, h, h);
  g.addColorStop(0, '#faf5e8');
  g.addColorStop(1, '#ddd2b8');
  fillRR(ctx, -h, -h, size, size, size * 0.22, g);
  strokeRR(ctx, -h, -h, size, size, size * 0.22, 'rgba(120,100,60,0.45)', 1);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#241a30';
  const off = size * 0.26;
  const pr = Math.max(2, size * 0.075);
  for (const [px, py] of DIE_PIPS[face] || DIE_PIPS[1]) {
    ctx.beginPath();
    ctx.arc(px * off, py * off, pr, 0, TAU);
    ctx.fill();
  }
  // блик
  ctx.beginPath();
  ctx.ellipse(-h * 0.4, -h * 0.45, size * 0.22, size * 0.1, -0.6, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
  ctx.restore();
}

/* ---------- Текст с неоновым свечением ---------- */

export function neonText(ctx, text, x, y, opts = {}) {
  const { font, color = GOLD, glow = 22, align = 'center', baseline = 'middle', stroke = null } = opts;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  if (stroke) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeText(text, x, y);
  }
  ctx.restore();
}

/* ---------- Частицы ---------- */

export class Particles {
  constructor() {
    this.list = [];
  }

  burst(x, y, opts = {}) {
    const {
      count = 26,
      color = GOLD,
      speed = 300,
      size = 3,
      life = 0.9,
      gravity = 320,
      angle = -Math.PI / 2,
      spread = Math.PI * 2,
      shapes = true,
    } = opts;
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * (0.3 + Math.random() * 0.7);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: size * (0.4 + Math.random() * 0.8),
        t: 0,
        life: life * (0.6 + Math.random() * 0.5),
        color,
        g: gravity,
        square: shapes && Math.random() < 0.35,
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.t += dt;
      p.vy += p.g * dt;
      p.vx *= 1 - 1.4 * dt;
      p.vy *= 1 - 0.6 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.t < p.life);
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = k * 0.95;
      ctx.fillStyle = p.color;
      if (p.square) {
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.5 + k * 0.5), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  clear() {
    this.list.length = 0;
  }
}

/* ---------- Фоновая «пыль» для сцен ---------- */

export function makeDust(w, h, n = 16, color = '245,197,66') {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1 + Math.random() * 2.2,
      a: 0.05 + Math.random() * 0.14,
      vy: 6 + Math.random() * 14,
      ph: Math.random() * TAU,
      sp: 0.4 + Math.random() * 0.8,
      color,
    });
  }
  return arr;
}

export function stepDust(dust, dt, w, h) {
  for (const d of dust) {
    d.y -= d.vy * dt;
    d.ph += dt * d.sp;
    if (d.y < -10) {
      d.y = h + 10;
      d.x = Math.random() * w;
    }
  }
}

export function drawDust(ctx, dust, time) {
  ctx.save();
  for (const d of dust) {
    const tw = 0.6 + 0.4 * Math.sin(time * 0.001 * d.sp + d.ph);
    ctx.globalAlpha = d.a * tw;
    ctx.fillStyle = `rgba(${d.color},1)`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
