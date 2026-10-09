/* Краш: множитель растёт экспоненциально, задача — забрать выигрыш до краша.
   Точка краша определяется в начале раунда (RTP 97%). */

import { h, ic } from '../core/dom.js';
import { TAU, clamp, formatMoney } from '../core/util.js';
import { drawSceneBg, makeDust, stepDust, drawDust, Particles, neonText, radialGlow, GOLD } from './common/art.js';
import { attachCanvas } from './common/canvas.js';
import { crashPoint, crashMultiplierAt, crashDisplay, CRASH_EDGE } from './math.js';

export function create(hooks) {
  const { controls, audio, store } = hooks;
  let cv = null;
  let W = 0;
  let H = 0;

  let state = 'idle'; // idle | running | cashed | crashed
  let bet = 0;
  let t = 0; // время раунда, сек
  let crashAt = 1;
  let curM = 1; // текущий отображаемый множитель
  let payout = 0;
  let detail = '';
  let autoTarget = 0; // автовывод, 0 — выключен
  let endT = 0; // таймер показа результата
  let flash = 0;
  let trail = []; // точки траектории [{x,y}]
  let lastTrailAt = 0;

  const particles = new Particles();
  let dust = [];

  /* ---------- Контролы: автовывод ---------- */
  const autoInput = h('input', {
    type: 'text',
    inputmode: 'decimal',
    placeholder: 'Автовывод, ×',
    maxlength: '7',
    'aria-label': 'Автовывод при множителе',
    style: {
      width: '130px', padding: '9px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.35)',
      border: '1px solid var(--line-soft)', color: 'var(--text)', fontFamily: 'var(--font-num)',
      fontSize: '13px', outline: 'none',
    },
  });
  const autoWrap = h('div', { class: 'seg', style: { alignItems: 'center', gap: '8px' } },
    h('span', { class: 'faint', style: { fontSize: '12px', fontWeight: 600, paddingLeft: '6px' }, html: `${ic('trend').innerHTML} Автовывод` }),
    autoInput
  );
  controls.appendChild(autoWrap);

  autoInput.addEventListener('input', () => {
    const v = parseFloat(autoInput.value.replace(',', '.').replace(/[^\d.]/g, ''));
    autoTarget = Number.isFinite(v) && v > 1 ? v : 0;
  });

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
    t = 0;
    crashAt = crashPoint();
    curM = 1;
    payout = 0;
    detail = '';
    endT = 0;
    flash = 0;
    trail = [];
    lastTrailAt = 0;
    state = 'running';
    particles.clear();
    audio.play('spin');
    hooks.setAction({
      label: 'Забрать',
      variant: 'success',
      keepEnabled: true,
      onClick: () => cashout(),
    });
    updateHud();
  }

  function currentMult() {
    return crashDisplay(crashMultiplierAt(t));
  }

  function potentialWin() {
    return Math.floor(bet * curM);
  }

  function updateHud() {
    if (state === 'running') {
      hooks.setPotential?.(
        `<span>Забрано будет</span><b>×${curM.toFixed(2)} · ${formatMoney(potentialWin())}</b>`
      );
      hooks.setAction({
        label: `Забрать ${formatMoney(potentialWin())}`,
        variant: 'success',
        keepEnabled: true,
        onClick: () => cashout(),
      });
    }
  }

  function cashout() {
    if (state !== 'running') return;
    curM = currentMult();
    payout = Math.floor(bet * curM);
    detail = `×${curM.toFixed(2)} — забрано`;
    state = 'cashed';
    endT = 0;
    flash = 0.5;
    audio.play('cash');
    particles.burst(W / 2, H * 0.5, { count: 70, color: '#3ecf8e', speed: 440, size: 3.4, life: 1.2 });
    hooks.setPotential?.(
      `<span>Забрано</span><b class="win-pos">+${formatMoney(payout)} · ×${curM.toFixed(2)}</b>`
    );
  }

  function doCrash() {
    curM = crashDisplay(crashAt);
    payout = 0;
    detail = `краш ×${curM.toFixed(2)}`;
    state = 'crashed';
    endT = 0;
    flash = 0.9;
    audio.play('lose');
    // взрыв в точке ракеты
    const r = rocketPos();
    particles.burst(r.x, r.y, { count: 90, color: '#ef4444', speed: 520, size: 4, life: 1.1, gravity: 500 });
    particles.burst(r.x, r.y, { count: 40, color: '#f59e0b', speed: 380, size: 3, life: 0.8, gravity: 400 });
    hooks.setPotential?.(`<span>Краш</span><b>×${curM.toFixed(2)} · ставка сгорела</b>`);
  }

  /* ---------- Геометрия ---------- */

  const MAX_M = 60; // выше — ракета у верхней кромки

  function plotRect() {
    const padX = Math.min(70, W * 0.09);
    const padTop = 64;
    const padBottom = Math.min(80, H * 0.18);
    return {
      x: padX,
      y: padTop,
      w: W - padX * 2,
      h: H - padTop - padBottom,
    };
  }

  /** Позиция точки кривой для множителя m (0..1 → слева внизу, вправо вверх). */
  function curvePoint(m) {
    const p = plotRect();
    const x = p.x + clamp(Math.log2(m) / Math.log2(MAX_M), 0, 1) * p.w;
    const y = p.y + p.h - clamp(Math.log(m) / Math.log(MAX_M), 0, 1) * p.h;
    return { x, y };
  }

  function rocketPos() {
    const pt = curvePoint(Math.min(curM, MAX_M));
    return { x: pt.x, y: Math.max(pt.y, plotRect().y - 6) };
  }

  /* ---------- Рендер ---------- */

  function render(now, dt) {
    const ctx = cv.ctx;

    if (state === 'running') {
      t += dt;
      const m = crashMultiplierAt(t);
      if (m >= crashAt) {
        doCrash();
      } else {
        curM = crashDisplay(m);
        if (autoTarget && curM >= autoTarget) cashout();
        updateHud();
      }
      // след ракеты
      if (now - lastTrailAt > 24) {
        lastTrailAt = now;
        const pt = curvePoint(Math.min(curM, MAX_M));
        trail.push({ x: pt.x, y: pt.y });
        if (trail.length > 500) trail.shift();
        // искры
        if (Math.random() < 0.5) {
          particles.burst(pt.x, pt.y, { count: 2, color: 'rgba(245,197,66,0.7)', speed: 60, size: 2, life: 0.5, gravity: 120 });
        }
      }
    }
    if (state === 'cashed' || state === 'crashed') {
      endT += dt;
      flash = Math.max(0, flash - dt * 1.6);
      if (endT > 1.6) {
        const result = { bet, payout, detail };
        state = 'idle';
        hooks.finish(result);
        return;
      }
    }

    stepDust(dust, dt, W, H);
    particles.update(dt);
    drawSceneBg(ctx, W, H, '245,197,66', '139,92,246');
    drawDust(ctx, dust, now);

    // последние краши (пилюли сверху)
    drawHistoryPills(ctx, now);

    // кривая
    drawCurve(ctx);

    // ракета
    if (state === 'running' || state === 'crashed') {
      drawRocket(ctx, now);
    }

    // множитель
    drawMultiplier(ctx, now);

    // вспышка краша / кэшаута
    if (flash > 0) {
      const p = plotRect();
      const col = state === 'crashed' ? '239,68,68' : '62,207,142';
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, `rgba(${col}, ${(flash * 0.4).toFixed(3)})`);
      g.addColorStop(1, `rgba(${col}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    particles.draw(ctx);

    // баннер результата
    if (state === 'crashed') {
      const a = clamp(endT / 0.25, 0, 1);
      const scale = 0.8 + 0.2 * (1 - Math.pow(1 - a, 3));
      ctx.save();
      ctx.translate(W / 2, H * 0.5);
      ctx.scale(scale, scale);
      neonText(ctx, `КРАШ ×${curM.toFixed(2)}`, 0, 0, {
        font: `700 ${Math.round(Math.min(W, H) * 0.11)}px Unbounded, sans-serif`,
        color: '#ff8a8a',
        glow: 30,
      });
      ctx.restore();
    } else if (state === 'cashed') {
      const a = clamp(endT / 0.25, 0, 1);
      const scale = 0.8 + 0.2 * (1 - Math.pow(1 - a, 3));
      ctx.save();
      ctx.translate(W / 2, H * 0.5);
      ctx.scale(scale, scale);
      neonText(ctx, `+${formatMoney(payout)}`, 0, 0, {
        font: `700 ${Math.round(Math.min(W, H) * 0.11)}px Unbounded, sans-serif`,
        color: '#3ecf8e',
        glow: 30,
      });
      neonText(ctx, `×${curM.toFixed(2)}`, 0, Math.min(W, H) * 0.09, {
        font: `600 ${Math.round(Math.min(W, H) * 0.05)}px Inter, sans-serif`,
        color: GOLD,
        glow: 10,
      });
      ctx.restore();
    } else if (state === 'idle') {
      const a = 0.55 + 0.45 * Math.sin(now * 0.0022);
      neonText(ctx, 'НАЖМИ «СТАРТ» И ЗАБЕРИ ДО КРАША', W / 2, H - 22, {
        font: `600 ${Math.min(11.5, H * 0.028)}px Inter, sans-serif`,
        color: `rgba(179,168,204,${a.toFixed(2)})`,
        glow: 0,
      });
    }
  }

  function drawHistoryPills(ctx, now) {
    const hist = store.history('crash').slice(0, 10);
    if (!hist.length) return;
    const pillH = 22;
    const gap = 6;
    const font = '600 11px Unbounded, sans-serif';
    ctx.font = font;
    let x = W / 2;
    // считаем ширину заранее
    const widths = hist.map((r) => {
      const m = parseFloat(r.detail.match(/×([\d.]+)/)?.[1] || '0');
      const txt = `×${m.toFixed(2)}`;
      return Math.max(52, ctx.measureText(txt).width + 18);
    });
    const totalW = widths.reduce((a, b) => a + b + gap, -gap);
    x = W / 2 - totalW / 2;
    const y = 16;
    hist.forEach((r, i) => {
      const m = parseFloat(r.detail.match(/×([\d.]+)/)?.[1] || '0');
      const crashed = r.payout === 0;
      const w = widths[i];
      const col = crashed ? (m < 2 ? '#ef4444' : m < 10 ? '#f5c542' : '#a78bfa') : '#3ecf8e';
      ctx.save();
      ctx.globalAlpha = 0.9;
      fillRRLocal(ctx, x, y, w, pillH, pillH / 2, 'rgba(255,255,255,0.05)');
      ctx.strokeStyle = hexA(col, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      roundRectLocal(ctx, x, y, w, pillH, pillH / 2);
      ctx.stroke();
      neonText(ctx, `×${m.toFixed(2)}`, x + w / 2, y + pillH / 2 + 0.5, {
        font, color: col, glow: 6,
      });
      ctx.restore();
      x += w + gap;
    });
  }

  function drawCurve(ctx) {
    if (trail.length < 2) return;
    const p = plotRect();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
    // градиент вдоль кривой: от тёмного к золотому
    const g = ctx.createLinearGradient(p.x, p.y + p.h, trail[trail.length - 1].x, trail[trail.length - 1].y);
    g.addColorStop(0, 'rgba(245,197,66,0.12)');
    g.addColorStop(1, 'rgba(245,197,66,0.95)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(245,197,66,0.5)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    // оси
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.lineTo(p.x + p.w, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawRocket(ctx, now) {
    const r = rocketPos();
    const crashed = state === 'crashed';
    const wob = Math.sin(now * 0.02) * 3;
    const tilt = -0.9 + wob * 0.01; // ~-51°, нос вверх-вправо
    ctx.save();
    ctx.translate(r.x, r.y);
    if (crashed) {
      // падает
      ctx.rotate(tilt + 2.2);
    } else {
      ctx.rotate(tilt);
    }
    const s = Math.min(W, H) * 0.055;
    // пламя
    if (!crashed) {
      const flick = 0.7 + Math.random() * 0.6;
      const fg = ctx.createLinearGradient(0, s * 0.9, 0, s * 2.1);
      fg.addColorStop(0, '#f59e0b');
      fg.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, s * 0.85);
      ctx.lineTo(0, s * 2.1 * flick);
      ctx.lineTo(s * 0.32, s * 0.85);
      ctx.closePath();
      ctx.fillStyle = fg;
      ctx.fill();
    }
    // корпус
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.5);
    ctx.bezierCurveTo(s * 0.55, -s * 0.7, s * 0.5, s * 0.2, s * 0.34, s * 0.9);
    ctx.lineTo(-s * 0.34, s * 0.9);
    ctx.bezierCurveTo(-s * 0.5, s * 0.2, -s * 0.55, -s * 0.7, 0, -s * 1.5);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, -s, 0, s);
    bg.addColorStop(0, '#f4efe6');
    bg.addColorStop(1, '#b9b3c9');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = '#8a84a0';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // иллюминатор
    ctx.beginPath();
    ctx.arc(0, -s * 0.35, s * 0.3, 0, TAU);
    ctx.fillStyle = '#7dd3fc';
    ctx.fill();
    ctx.strokeStyle = '#2b6d8f';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // плавники
    ctx.fillStyle = '#c9c2d8';
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, s * 0.45);
    ctx.lineTo(-s * 0.62, s * 1.0);
    ctx.lineTo(-s * 0.3, s * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.34, s * 0.45);
    ctx.lineTo(s * 0.62, s * 1.0);
    ctx.lineTo(s * 0.3, s * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMultiplier(ctx, now) {
    const m = state === 'running' ? curM : state === 'idle' ? 1 : curM;
    const col =
      state === 'running' ? (curM >= 10 ? '#f7d774' : curM >= 2 ? GOLD : '#f4efe6')
      : state === 'crashed' ? '#ff8a8a'
      : state === 'cashed' ? '#3ecf8e'
      : 'rgba(244,239,230,0.4)';
    const size = Math.min(W, H) * (state === 'idle' ? 0.09 : 0.16);
    const label = state === 'idle' ? '×1.00' : `×${m.toFixed(2)}`;
    neonText(ctx, label, W / 2, H * 0.42, {
      font: `700 ${Math.round(size)}px Unbounded, sans-serif`,
      color: col,
      glow: state === 'idle' ? 0 : 34,
    });
    if (state === 'running') {
      neonText(ctx, `ставка ${formatMoney(bet)}`, W / 2, H * 0.42 + size * 0.85, {
        font: `600 ${Math.round(size * 0.3)}px Inter, sans-serif`,
        color: 'rgba(179,168,204,0.8)',
        glow: 0,
      });
    }
  }

  /* локальные хелперы (чтобы не тянуть лишние импорты) */
  function fillRRLocal(ctx, x, y, w, h, r, fill) {
    roundRectLocal(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function roundRectLocal(ctx, x, y, w, h, r) {
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
    getPotential: () =>
      `<span>Множитель растёт до краша</span><b>RTP ${(1 - CRASH_EDGE) * 100}% · макс. ×1000</b>`,
    getInfo: () => ({
      rows: [
        ['Забрано до краша', '× текущий множитель'],
        ['Краш до забора', '×0'],
        ['Мгновенный краш (3%)', '×1.00'],
      ],
      rules: `Множитель растёт экспоненциально с момента старта. Нажми «Забрать», пока не поздно: выплата = ставка × текущий множитель. После краша ставка сгорает. Можно задать автовывод.`,
    }),
    forceResolve: () => {
      if (state === 'idle') return null;
      const result = { bet, payout, detail };
      state = 'idle';
      return result;
    },
    dispose: () => cv?.disconnect(),
  };
}
