/* Плинко: шар падает сквозь 16 рядов пегов и приземляется в корзину
   с множителем (края — крупные, центр — низкие). */

import { clamp, formatMoney } from '../core/util.js';
import { drawSceneBg, makeDust, stepDust, drawDust, Particles, neonText, radialGlow, GOLD } from './common/art.js';
import { attachCanvas } from './common/canvas.js';
import {
  PLINKO_ROWS, PLINKO_BINS, PLINKO_MULTIPLIERS, PLINKO_EDGE, plinkoPath, plinkoRTP,
} from './math.js';

const DROP_DUR = 2.5;

export function create(hooks) {
  const { audio } = hooks;
  let cv = null;
  let W = 0;
  let H = 0;

  let state = 'idle'; // idle | dropping | landed
  let bet = 0;
  let path = []; // направления шарика
  let bin = 0;
  let payout = 0;
  let dropT = 0;
  let endT = 0;
  let pulses = []; // [{x,y,t}]

  const particles = new Particles();
  let dust = [];

  function mount({ canvas }) {
    cv = attachCanvas(canvas, (w, h) => {
      W = w;
      H = h;
      dust = makeDust(w, h, 12);
    });
    W = cv.w;
    H = cv.h;
  }

  function start(b) {
    bet = b;
    path = plinkoPath(PLINKO_ROWS);
    bin = path.reduce((a, c) => a + c, 0);
    const mult = PLINKO_MULTIPLIERS[bin];
    payout = Math.round(bet * mult * PLINKO_EDGE);
    dropT = 0;
    endT = 0;
    pulses = [];
    state = 'dropping';
    particles.clear();
    audio.play('spin');
  }

  /* ---------- Геометрия ---------- */

  function board() {
    const boardW = Math.min(W - 36, 620);
    const cx = W / 2;
    const topY = 46;
    const binH = 42;
    const rowsH = H - topY - binH - 46;
    const rowH = rowsH / PLINKO_ROWS;
    const s = boardW / PLINKO_ROWS; // шаг по X
    return { boardW, cx, topY, binH, rowsH, rowH, s, binY: topY + rowsH + 12 };
  }

  function pegPos(r, j, b) {
    return { x: b.cx + (j - r / 2) * b.s, y: b.topY + (r + 0.5) * b.rowH };
  }

  /** Позиция шарика в момент прогресса p (0..1). */
  function ballPos(p, b) {
    const total = PLINKO_ROWS;
    const seg = clamp(p * total, 0, total); // текущий сегмент
    const k = Math.min(Math.floor(seg), total - 1); // текущий ряд
    const f = seg - k;
    // x на начало сегмента k: cx + (кол-во правых до k - k/2) * s
    let rights = 0;
    for (let i = 0; i < k; i++) rights += path[i];
    const x0 = b.cx + (rights - k / 2) * b.s;
    const dir = path[k] ? 1 : -1;
    const x = x0 + dir * b.s * 0.5 * f;
    const y = b.topY - 8 + (k + f) * b.rowH + b.rowH * 0.5;
    return { x, y, k, f };
  }

  /* ---------- Рендер ---------- */

  function render(now, dt) {
    const ctx = cv.ctx;
    const b = board();

    if (state === 'dropping') {
      const prevK = Math.floor(dropT / DROP_DUR * PLINKO_ROWS);
      dropT += dt;
      const p = clamp(dropT / DROP_DUR, 0, 1);
      const pos = ballPos(p, b);
      // пульс на пеге при переходе ряда
      if (pos.k !== prevK && pos.k < PLINKO_ROWS) {
        const j = Math.round((pos.x - b.cx) / b.s + pos.k / 2);
        const peg = pegPos(pos.k, clamp(j, 0, pos.k), b);
        pulses.push({ x: peg.x, y: peg.y, t: 0 });
        audio.play('tick');
      }
      if (p >= 1) {
        state = 'landed';
        endT = 0;
        const mult = PLINKO_MULTIPLIERS[bin];
        // приземление: пульс + частицы
        const bx = b.cx + (bin - PLINKO_ROWS / 2) * b.s;
        pulses.push({ x: bx, y: b.binY - 8, t: 0 });
        if (payout >= bet) {
          audio.play(payout >= bet * 10 ? 'bigWin' : 'win');
          particles.burst(bx, b.binY - 6, { count: 60, color: binColor(mult), speed: 380, size: 3.2, life: 1.1 });
        } else {
          audio.play('lose');
        }
      }
    }
    if (state === 'landed') {
      endT += dt;
      if (endT > 1.9) {
        state = 'idle';
        const mult = PLINKO_MULTIPLIERS[bin];
        hooks.finish({
          bet,
          payout,
          detail: `корзина ×${mult}${payout >= bet ? '' : ' · мимо'}`,
        });
        return;
      }
    }

    // пульсы пегов
    for (const pu of pulses) pu.t += dt * 2.4;
    pulses = pulses.filter((pu) => pu.t < 1);

    stepDust(dust, dt, W, H);
    particles.update(dt);
    drawSceneBg(ctx, W, H, '62,207,142', '139,92,246');
    drawDust(ctx, dust, now);

    drawBoard(ctx, b, now);

    // шарик
    if (state === 'dropping') {
      const p = clamp(dropT / DROP_DUR, 0, 1);
      const pos = ballPos(p, b);
      drawBall(ctx, pos.x, pos.y, now, false);
    } else if (state === 'landed') {
      const bx = b.cx + (bin - PLINKO_ROWS / 2) * b.s;
      const wob = Math.sin(endT * 8) * 2 * Math.max(0, 1 - endT);
      drawBall(ctx, bx, b.binY - 10 + wob, now, true);
    }

    particles.draw(ctx);

    // попап множителя над корзиной
    if (state === 'landed') {
      const mult = PLINKO_MULTIPLIERS[bin];
      const bx = b.cx + (bin - PLINKO_ROWS / 2) * b.s;
      const a = clamp(endT / 0.3, 0, 1);
      const scale = 0.7 + 0.3 * (1 - Math.pow(1 - a, 3));
      ctx.save();
      ctx.translate(bx, b.binY - 34);
      ctx.scale(scale, scale);
      neonText(ctx, `×${mult}`, 0, 0, {
        font: `700 ${Math.round(Math.min(W, H) * 0.07)}px Unbounded, sans-serif`,
        color: binColor(mult),
        glow: 26,
      });
      if (payout > 0) {
        neonText(ctx, `+${formatMoney(payout)}`, 0, Math.min(W, H) * 0.055, {
          font: `600 ${Math.round(Math.min(W, H) * 0.04)}px Inter, sans-serif`,
          color: payout >= bet ? '#3ecf8e' : '#ff8a8a',
          glow: 10,
        });
      }
      ctx.restore();
    } else if (state === 'idle') {
      const a = 0.55 + 0.45 * Math.sin(now * 0.0022);
      neonText(ctx, 'Брось шар — куда упадёт, столько и выиграешь'.toUpperCase(), W / 2, 24, {
        font: `600 ${Math.min(11, H * 0.026)}px Inter, sans-serif`,
        color: `rgba(179,168,204,${a.toFixed(2)})`,
        glow: 0,
      });
    }
  }

  function binColor(mult) {
    if (mult >= 25) return GOLD;
    if (mult >= 5) return '#a78bfa';
    if (mult >= 1) return '#3ecf8e';
    return '#ff8a8a';
  }

  function drawBoard(ctx, b, now) {
    // пеги
    for (let r = 0; r < PLINKO_ROWS; r++) {
      for (let j = 0; j <= r; j++) {
        const peg = pegPos(r, j, b);
        const tw = 0.55 + 0.45 * Math.sin(now * 0.003 + r * 1.7 + j * 2.3);
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${(0.35 + tw * 0.5).toFixed(2)})`;
        ctx.shadowColor = '#8b5cf6';
        ctx.shadowBlur = 6 + tw * 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // пульсы от шарика
    for (const pu of pulses) {
      const k = pu.t;
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, 4 + k * 16, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245,197,66,${((1 - k) * 0.7).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // корзины
    const binW = b.s;
    for (let i = 0; i < PLINKO_BINS; i++) {
      const mult = PLINKO_MULTIPLIERS[i];
      const x = b.cx + (i - PLINKO_ROWS / 2) * b.s - binW / 2 + 1.5;
      const y = b.binY;
      const hot = state === 'landed' && i === bin;
      const col = binColor(mult);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, binW - 3, b.binH, 7) : rounded(x, y, binW - 3, b.binH, 7, ctx);
      ctx.fillStyle = hot ? hexA(col, 0.3) : 'rgba(255,255,255,0.045)';
      ctx.fill();
      ctx.strokeStyle = hot ? col : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = hot ? 2 : 1;
      ctx.stroke();
      if (hot) {
        ctx.shadowColor = col;
        ctx.shadowBlur = 20 + Math.sin(now * 0.01) * 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
      neonText(ctx, `×${mult}`, x + (binW - 3) / 2, y + b.binH / 2 + 1, {
        font: `600 ${Math.max(8, Math.round(binW * 0.2))}px Unbounded, sans-serif`,
        color: hot ? col : 'rgba(244,239,230,0.75)',
        glow: hot ? 14 : 0,
      });
    }

    // стенки
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.cx - b.boardW / 2 - 6, b.topY - 10);
    ctx.lineTo(b.cx - b.boardW / 2 - 6, b.binY + b.binH);
    ctx.moveTo(b.cx + b.boardW / 2 + 6, b.topY - 10);
    ctx.lineTo(b.cx + b.boardW / 2 + 6, b.binY + b.binH);
    ctx.stroke();
  }

  function drawBall(ctx, x, y, now, landed) {
    const r = 7;
    // след
    ctx.save();
    ctx.strokeStyle = 'rgba(245,197,66,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + r + 4);
    ctx.lineTo(x, y + r + 22);
    ctx.stroke();
    ctx.restore();
    // шар
    ctx.save();
    if (landed) {
      ctx.shadowColor = '#f5c542';
      ctx.shadowBlur = 20 + Math.sin(now * 0.01) * 6;
    }
    const g = ctx.createRadialGradient(x - 2.5, y - 2.5, 1, x, y, r);
    g.addColorStop(0, '#ffe9a8');
    g.addColorStop(0.5, GOLD);
    g.addColorStop(1, '#c9951f');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 2.2, y - 2.2, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    ctx.restore();
  }

  function rounded(x, y, w, h, r, ctx) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  return {
    mount,
    start,
    render,
    isBusy: () => state !== 'idle',
    setIdle: () => { state = 'idle'; },
    getPotential: () => {
      const b = hooks.getBet ? hooks.getBet() : bet;
      const maxM = PLINKO_MULTIPLIERS[0];
      return `<span>Множители корзин</span><b>×${PLINKO_MULTIPLIERS[PLINKO_BINS - 1]} … ×${maxM} · RTP ${(plinkoRTP() * 100).toFixed(1)}%</b>`;
    },
    getInfo: () => ({
      rows: [
        ...PLINKO_MULTIPLIERS.filter((m, i) => i % 2 === 0 || i === PLINKO_BINS - 1)
          .map((m) => [`Корзина ×${m}`, `×${(m * PLINKO_EDGE).toFixed(2)}`]),
      ],
      rules: `Шар падает сквозь ${PLINKO_ROWS} рядов пегов, на каждом ряду случайно отклоняется влево или вправо. Множитель зависит от корзины: центр — низкий, края — до ×${PLINKO_MULTIPLIERS[0]}. Выплата = ставка × множитель × ${PLINKO_EDGE}. RTP: ${(plinkoRTP() * 100).toFixed(1)}%.`,
    }),
    forceResolve: () => {
      if (state === 'idle') return null;
      const mult = PLINKO_MULTIPLIERS[bin];
      const result = { bet, payout, detail: `корзина ×${mult}` };
      state = 'idle';
      return result;
    },
    dispose: () => cv?.disconnect(),
  };
}
