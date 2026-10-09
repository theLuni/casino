/* Слоты: 3 барабана × 3 ряда, выигрышная линия — средний ряд.
   Барабаны крутятся с motion-blur, останавливаются по очереди с «пинком». */

import {
  TAU, clamp, cryptoInt, formatMoney, tween, easeOutQuart,
} from '../core/util.js';
import {
  drawSceneBg, makeDust, stepDust, drawDust, Particles, neonText,
  goldGrad, fillRR, strokeRR, rr, GOLD, CREAM,
} from './common/art.js';
import { attachCanvas } from './common/canvas.js';
import {
  SLOT_SYMBOLS, buildStrip, evaluateSlotsLine, slotsRTP,
} from './math.js';

const strip = buildStrip();
const L = strip.length;

function starPath(ctx, cx, cy, r, points, inner) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const x = cx + rad * Math.cos(a);
    const y = cy + rad * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* ---------- Художники символов ---------- */

function drawSymbol(ctx, idx, cx, cy, s) {
  const sym = SLOT_SYMBOLS[idx];
  ctx.save();
  ctx.translate(cx, cy);
  switch (sym.id) {
    case 'seven': {
      ctx.font = `900 ${Math.round(s)}px 'Playfair Display', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(245,197,66,0.65)';
      ctx.shadowBlur = s * 0.3;
      ctx.fillStyle = goldGrad(ctx, -s / 2, -s / 2, s, s);
      ctx.fillText('7', 0, s * 0.05);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(110,80,14,0.9)';
      ctx.lineWidth = s * 0.035;
      ctx.strokeText('7', 0, s * 0.05);
      break;
    }
    case 'diamond': {
      const w = s * 0.6;
      const h = s * 0.82;
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, -h * 0.1);
      ctx.lineTo(w * 0.34, h / 2);
      ctx.lineTo(-w * 0.34, h / 2);
      ctx.lineTo(-w / 2, -h * 0.1);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, '#cfeeff');
      g.addColorStop(0.5, '#7dd3fc');
      g.addColorStop(1, '#2b6d8f');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(0, h / 2);
      ctx.moveTo(-w / 2, -h * 0.1);
      ctx.lineTo(w / 2, -h * 0.1);
      ctx.moveTo(-w * 0.34, h / 2);
      ctx.lineTo(w * 0.34, h / 2);
      ctx.stroke();
      break;
    }
    case 'bell': {
      const r = s * 0.5;
      ctx.beginPath();
      ctx.arc(0, -r * 0.3, r * 0.62, Math.PI, 0);
      ctx.lineTo(r * 0.8, r * 0.52);
      ctx.quadraticCurveTo(0, r * 0.78, -r * 0.8, r * 0.52);
      ctx.closePath();
      ctx.fillStyle = goldGrad(ctx, -r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a6410';
      ctx.lineWidth = s * 0.035;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.66, r * 0.17, 0, TAU);
      ctx.fillStyle = '#8a6410';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -r * 0.92, r * 0.15, 0, TAU);
      ctx.fillStyle = '#c9951f';
      ctx.fill();
      break;
    }
    case 'star': {
      starPath(ctx, 0, 0, s * 0.5, 5, s * 0.21);
      const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
      g.addColorStop(0, '#ddd0ff');
      g.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = s * 0.03;
      ctx.stroke();
      break;
    }
    case 'cherry': {
      ctx.strokeStyle = '#2f9e6e';
      ctx.lineWidth = s * 0.055;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, s * 0.2);
      ctx.bezierCurveTo(-s * 0.12, -s * 0.2, s * 0.08, -s * 0.42, s * 0.28, -s * 0.52);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.2, s * 0.3);
      ctx.bezierCurveTo(s * 0.22, 0, s * 0.26, -s * 0.2, s * 0.28, -s * 0.52);
      ctx.stroke();
      ctx.fillStyle = '#3ecf8e';
      ctx.beginPath();
      ctx.ellipse(s * 0.36, -s * 0.44, s * 0.15, s * 0.065, -0.5, 0, TAU);
      ctx.fill();
      for (const [dx, dy] of [[-0.2, 0.2], [0.2, 0.3]]) {
        const g = ctx.createRadialGradient(dx * s - s * 0.07, dy * s - s * 0.07, s * 0.02, dx * s, dy * s, s * 0.26);
        g.addColorStop(0, '#ff9d9d');
        g.addColorStop(1, '#c2334d');
        ctx.beginPath();
        ctx.arc(dx * s, dy * s, s * 0.24, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dx * s - s * 0.07, dy * s - s * 0.07, s * 0.05, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();
      }
      break;
    }
    case 'bar': {
      const w = s * 0.92;
      const h = s * 0.42;
      fillRR(ctx, -w / 2, -h / 2, w, h, s * 0.09, '#2a2438');
      strokeRR(ctx, -w / 2, -h / 2, w, h, s * 0.09, GOLD, s * 0.045);
      ctx.font = `800 ${Math.round(s * 0.2)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CREAM;
      ctx.fillText('BAR', 0, s * 0.01);
      break;
    }
  }
  ctx.restore();
}

/* ---------- Игра ---------- */

export function create(hooks) {
  const { audio } = hooks;
  let cv = null;
  let W = 0;
  let H = 0;

  let state = 'idle'; // idle | spinning | result
  let bet = 0;
  let reels = [0, 0, 0].map(() => ({ offset: 0, prev: 0 }));
  let outcome = null; // позиции среднего ряда на барабане
  let mult = 0;
  let payout = 0;
  let resultT = 0; // таймер показа результата
  let winPulse = 0;

  const particles = new Particles();
  let dust = [];

  function mount({ canvas }) {
    cv = attachCanvas(canvas, (w, h) => {
      W = w;
      H = h;
      dust = makeDust(w, h, 16);
    });
    W = cv.w;
    H = cv.h;
    reels.forEach((r, i) => (r.offset = r.prev = cryptoInt(L)));
  }

  function start(b) {
    bet = b;
    outcome = [cryptoInt(L), cryptoInt(L), cryptoInt(L)];
    const line = outcome.map((pos) => strip[(pos + 1) % L]);
    mult = evaluateSlotsLine(line);
    payout = Math.round(bet * mult);
    state = 'spinning';
    resultT = 0;
    particles.clear();
    audio.play('spin');

    reels.forEach((r, i) => {
      const from = r.offset;
      const loops = 2 + i;
      const target = outcome[i] - 1 + loops * L;
      tween(1250 + i * 430, (t, e) => {
        r.offset = from + (target - from) * e;
      }, {
        ease: easeOutQuart,
        onDone: () => {
          r.offset = ((target % L) + L) % L;
          r.prev = r.offset;
          audio.play('tick');
          if (i === 2) beginResult();
        },
      });
    });
  }

  function beginResult() {
    if (mult > 0) {
      state = 'result';
      resultT = 0;
      winPulse = 0;
      audio.play('win');
    } else {
      state = 'result';
      resultT = 0;
      audio.play('lose');
    }
  }

  function detailString() {
    if (mult <= 0) return 'нет выигрыша';
    const line = outcome.map((pos) => strip[(pos + 1) % L]);
    const a = line[0];
    const allSame = a === line[1] && line[1] === line[2];
    const name = SLOT_SYMBOLS[a].name;
    return allSame ? `3× ${name} · ×${SLOT_SYMBOLS[a].pay}` : `2× ${name} · ×0.5`;
  }

  /* ---------- Рендер ---------- */

  function render(now, dt) {
    const ctx = cv.ctx;
    if (state === 'result') resultT += dt;
    if (state === 'result' && resultT > 1.9) {
      state = 'idle';
      hooks.finish({ bet, payout, detail: detailString() });
      return;
    }
    winPulse += dt;
    stepDust(dust, dt, W, H);
    particles.update(dt);

    drawSceneBg(ctx, W, H);
    drawDust(ctx, dust, now);

    // размеры «автомата"
    const machineW = Math.min(W - 28, 560);
    const machineH = Math.min(H - 20, 410);
    const mx = (W - machineW) / 2;
    const my = (H - machineH) / 2;
    const pad = 16;
    const marqueeH = 34;
    const reelGap = 12;
    const reelW = (machineW - pad * 2 - reelGap * 2) / 3;
    const reelH = machineH - pad * 2 - marqueeH - 8;
    const reelY = my + pad + marqueeH + 4;
    const rowH = reelH / 3;

    // корпус
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 30;
    fillRR(ctx, mx, my, machineW, machineH, 20, 'rgba(18,12,29,0.92)');
    ctx.restore();
    strokeRR(ctx, mx, my, machineW, machineH, 20, 'rgba(245,197,66,0.35)', 1.5);
    // внутренняя золотая рамка
    strokeRR(ctx, mx + 6, my + 6, machineW - 12, machineH - 12, 15, 'rgba(245,197,66,0.12)', 1);

    // «маркиза» сверху
    fillRR(ctx, mx + pad, my + pad, machineW - pad * 2, marqueeH, 10, 'rgba(0,0,0,0.45)');
    strokeRR(ctx, mx + pad, my + pad, machineW - pad * 2, marqueeH, 10, 'rgba(245,197,66,0.25)', 1);
    neonText(ctx, 'LUNI ROYAL · SLOTS', mx + machineW / 2, my + pad + marqueeH / 2 + 1, {
      font: `700 ${Math.min(13, marqueeH * 0.42)}px Inter, sans-serif`,
      color: GOLD,
      glow: 10,
    });
    // лампочки по маркизе
    const bulbs = 9;
    for (let i = 0; i < bulbs; i++) {
      const bx = mx + pad + 16 + (i * (machineW - pad * 2 - 32)) / (bulbs - 1);
      const on = (Math.sin(now * 0.004 + i * 1.7) + 1) / 2;
      ctx.beginPath();
      ctx.arc(bx, my + pad + marqueeH / 2, 2.4, 0, TAU);
      ctx.fillStyle = `rgba(245,197,66,${0.25 + on * 0.75})`;
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = on * 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // барабаны
    const payY = reelY + rowH * 1.5;
    reels.forEach((r, i) => {
      const rx = mx + pad + i * (reelW + reelGap);
      // считаем скорость для blur
      const vel = (r.prev - r.offset) / Math.max(dt || 0.016, 0.001);
      r.prev = r.offset;
      const blur = clamp(Math.abs(vel) / 26, 0, 1);

      // окно барабана
      ctx.save();
      rr(ctx, rx, reelY, reelW, reelH, 10);
      ctx.clip();
      fillRR(ctx, rx, reelY, reelW, reelH, 10, 'rgba(8,5,14,0.85)');
      const frac = r.offset - Math.floor(r.offset);
      const base = Math.floor(r.offset);
      for (let k = -1; k <= 3; k++) {
        const symId = strip[((base + k) % L + L) % L]; // позиция на ленте → id символа
        const cy = reelY + (k - frac) * rowH + rowH / 2;
        const size = Math.min(rowH * 0.62, reelW * 0.62);
        if (blur > 0.12) {
          ctx.globalAlpha = 0.28;
          drawSymbol(ctx, symId, rx + reelW / 2, cy - 7 * blur, size);
          drawSymbol(ctx, symId, rx + reelW / 2, cy + 7 * blur, size);
          ctx.globalAlpha = 1;
        }
        // пульсация выигрышных символов
        let pulse = 0;
        if (state === 'result' && mult > 0) {
          const lineIdx = outcome.map((pos) => strip[(pos + 1) % L]);
          const winReels = new Set();
          if (lineIdx[0] === lineIdx[1] && lineIdx[1] === lineIdx[2]) {
            winReels.add(0).add(1).add(2);
          } else {
            if (lineIdx[0] === lineIdx[1]) { winReels.add(0); winReels.add(1); }
            if (lineIdx[1] === lineIdx[2]) { winReels.add(1); winReels.add(2); }
            if (lineIdx[0] === lineIdx[2]) { winReels.add(0); winReels.add(2); }
          }
          if (winReels.has(i)) pulse = (Math.sin(winPulse * 6) + 1) / 2;
        }
        if (pulse > 0) {
          ctx.shadowColor = GOLD;
          ctx.shadowBlur = 14 + pulse * 16;
        }
        drawSymbol(ctx, symId, rx + reelW / 2, cy, size);
        ctx.shadowBlur = 0;
      }
      // стекло
      const gl = ctx.createLinearGradient(0, reelY, 0, reelY + reelH);
      gl.addColorStop(0, 'rgba(255,255,255,0.13)');
      gl.addColorStop(0.25, 'rgba(255,255,255,0.02)');
      gl.addColorStop(0.8, 'rgba(0,0,0,0.12)');
      gl.addColorStop(1, 'rgba(0,0,0,0.3)');
      fillRR(ctx, rx, reelY, reelW, reelH, 10, gl);
      ctx.restore();
      strokeRR(ctx, rx, reelY, reelW, reelH, 10, 'rgba(255,255,255,0.09)', 1);
    });

    // разделители
    for (let i = 1; i < 3; i++) {
      const sx = mx + pad + i * (reelW + reelGap) - reelGap / 2;
      const g = ctx.createLinearGradient(0, reelY, 0, reelY + reelH);
      g.addColorStop(0, 'transparent');
      g.addColorStop(0.5, 'rgba(245,197,66,0.35)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 0.75, reelY, 1.5, reelH);
    }

    // линия выплат (средний ряд)
    ctx.save();
    ctx.strokeStyle = 'rgba(245,197,66,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(mx + 6, payY);
    ctx.lineTo(mx + machineW - 6, payY);
    ctx.stroke();
    ctx.setLineDash([]);
    // стрелки по краям
    for (const dir of [-1, 1]) {
      const ax = dir === -1 ? mx + 12 : mx + machineW - 12;
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(ax, payY);
      ctx.lineTo(ax + dir * 9, payY - 5);
      ctx.lineTo(ax + dir * 9, payY + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // частицы выигрыша
    particles.draw(ctx);

    // баннер результата
    if (state === 'result') {
      const p = clamp(resultT / 0.35, 0, 1);
      const pop = 1 + (1 - p) * 0;
      const scale = p < 1 ? 0.7 + 0.3 * (1 - Math.pow(1 - p, 3)) : 1;
      const cy = my + machineH / 2;
      ctx.save();
      ctx.translate(W / 2, cy);
      ctx.scale(scale, scale);
      if (mult > 0) {
        // подложка
        const bw = Math.min(machineW - 40, 380);
        fillRR(ctx, -bw / 2, -34, bw, 68, 16, 'rgba(10,6,18,0.82)');
        strokeRR(ctx, -bw / 2, -34, bw, 68, 16, 'rgba(62,207,142,0.6)', 1.5);
        neonText(ctx, `+${formatMoney(payout)}`, 0, -8, {
          font: `700 30px Unbounded, sans-serif`, color: '#3ecf8e', glow: 22,
        });
        neonText(ctx, detailString().toUpperCase(), 0, 20, {
          font: `600 11px Inter, sans-serif`, color: GOLD, glow: 8,
        });
      } else {
        neonText(ctx, 'НЕТ ВЫИГРЫША', 0, 0, {
          font: `600 16px Inter, sans-serif`, color: 'rgba(244,239,230,0.55)', glow: 0,
        });
      }
      ctx.restore();

      if (mult > 0 && resultT < 0.4) {
        particles.burst(W / 2, payY, {
          count: 60, color: '#3ecf8e', speed: 420, size: 3.5, life: 1.1,
        });
      }
    } else if (state === 'idle') {
      // подсказка
      const a = 0.55 + 0.45 * Math.sin(now * 0.0022);
      neonText(ctx, 'СДЕЛАЙ СТАВКУ И НАЖМИ «КРУТИТЬ»', W / 2, my + machineH + 16, {
        font: `600 ${Math.min(12, H * 0.03)}px Inter, sans-serif`,
        color: `rgba(179,168,204,${a.toFixed(2)})`,
        glow: 0,
      });
    }
  }

  return {
    mount,
    start,
    render,
    isBusy: () => state !== 'idle',
    setIdle: () => { state = 'idle'; },
    getPotential: () => {
      const b = hooks.getBet ? hooks.getBet() : bet;
      return `<span>Макс. выигрыш</span><b>×150 · ${formatMoney(Math.round(b * 150))}</b>`;
    },
    getInfo: () => ({
      rows: [
        ...SLOT_SYMBOLS.map((s) => [`3 × ${s.name}`, `×${s.pay}`]),
        ['2 одинаковых на линии', '×0.5'],
      ],
      rules: `Выигрышная линия — средний ряд. Выплата = множитель × ставка. Теоретический RTP: ${(slotsRTP() * 100).toFixed(1)}%.`,
    }),
    forceResolve: () => {
      if (state === 'idle') return null;
      const detail = state === 'spinning' ? detailString() : detailString();
      const result = { bet, payout, detail };
      state = 'idle';
      return result;
    },
    dispose: () => cv?.disconnect(),
  };
}
