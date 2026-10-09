/* Кости: два кубика, ставка на сумму — меньше 7, ровно 7, больше 7. */

import { h, ic } from '../core/dom.js';
import { clamp, cryptoInt, formatMoney, lerp, easeOutCubic } from '../core/util.js';
import { drawSceneBg, makeDust, stepDust, drawDust, Particles, neonText, drawDie, radialGlow, GOLD } from './common/art.js';
import { attachCanvas } from './common/canvas.js';
import { DICE_PAYOUTS, diceOutcome, diceRTP } from './math.js';

const OPTIONS = [
  { id: 'less', label: 'Меньше 7', icon: 'arrow-left', pay: DICE_PAYOUTS.less },
  { id: 'seven', label: 'Ровно 7', icon: 'target', pay: DICE_PAYOUTS.seven },
  { id: 'more', label: 'Больше 7', icon: 'arrow-right', pay: DICE_PAYOUTS.more },
];

export function create(hooks) {
  const { controls, audio } = hooks;
  let cv = null;
  let W = 0;
  let H = 0;

  let choice = 'less';
  let state = 'idle'; // idle | rolling | result
  let bet = 0;
  let d1 = 1;
  let d2 = 1;
  let win = false;
  let payout = 0;
  let rollT = 0;
  let resultT = 0;
  let diceAnim = [];

  const particles = new Particles();
  let dust = [];

  /* ---------- Контролы ---------- */
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Ставка на сумму' });
  const btns = {};
  for (const o of OPTIONS) {
    const btn = h('button', {
      type: 'button',
      class: o.id === choice ? 'active' : '',
      html: `${ic(o.icon).innerHTML} ${o.label} ×${o.pay}`,
      onClick: () => {
        if (state !== 'idle') return;
        audio.play('click');
        choice = o.id;
        for (const [id, b] of Object.entries(btns)) b.classList.toggle('active', id === choice);
        updatePotential();
      },
    });
    btns[o.id] = btn;
    seg.appendChild(btn);
  }
  controls.appendChild(seg);

  function updatePotential() {
    const b = hooks.getBet ? hooks.getBet() : bet;
    const pay = DICE_PAYOUTS[choice];
    hooks.setPotential?.(
      `<span>Вариант: ${OPTIONS.find((o) => o.id === choice).label}</span><b>×${pay} · ${formatMoney(Math.round(b * pay))}</b>`
    );
  }

  function mount({ canvas }) {
    cv = attachCanvas(canvas, (w, h) => {
      W = w;
      H = h;
      dust = makeDust(w, h, 14);
    });
    W = cv.w;
    H = cv.h;
    updatePotential();
  }

  function start(b) {
    bet = b;
    d1 = 1 + cryptoInt(6);
    d2 = 1 + cryptoInt(6);
    const outcome = diceOutcome(d1, d2);
    win = outcome === choice;
    payout = win ? Math.round(bet * DICE_PAYOUTS[choice]) : 0;
    state = 'rolling';
    rollT = 0;
    resultT = 0;
    bursted = false;
    particles.clear();
    const size = dieSize();
    diceAnim = [0, 1].map((i) => ({
      x: W / 2 + (i === 0 ? -1 : 1) * size * 1.15,
      y: H * 0.4,
      vx: (i === 0 ? -1 : 1) * 90,
      vy: -300 - Math.random() * 140,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 16,
      face: 1 + cryptoInt(6),
      bounces: 0,
      settled: false,
      rot0: 0,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0,
    }));
    audio.play('roll');
  }

  function dieSize() {
    return Math.min(W, H) * 0.17;
  }

  const ROLL_DUR = 1.5;

  function render(now, dt) {
    const ctx = cv.ctx;
    const size = dieSize();
    const groundY = H * 0.6;

    if (state === 'rolling') {
      rollT += dt;
      for (const d of diceAnim) {
        if (d.settled) continue;
        d.vy += 1500 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rot += d.vr * dt;
        if (Math.random() < dt * 16) d.face = 1 + cryptoInt(6); // грани мелькают в полёте
        if (d.y > groundY) {
          d.y = groundY;
          d.vy *= -0.42;
          d.vx *= 0.82;
          d.vr *= 0.7;
          d.bounces += 1;
          audio.play('tick');
          if (d.bounces > 2 || Math.abs(d.vy) < 60) {
            d.settled = true;
            d.vy = 0;
            d.vx = 0;
            d.vr = 0;
            d.rot0 = d.rot;
          }
        }
        const half = size / 2;
        if (d.x < half + 12) { d.x = half + 12; d.vx = Math.abs(d.vx) * 0.8; }
        if (d.x > W - half - 12) { d.x = W - half - 12; d.vx = -Math.abs(d.vx) * 0.8; }
      }
      if (rollT >= ROLL_DUR && diceAnim.every((d) => d.settled)) {
        state = 'result';
        resultT = 0;
        diceAnim.forEach((d, i) => {
          d.fromX = d.x;
          d.fromY = d.y;
          d.toX = W / 2 + (i === 0 ? -1 : 1) * size * 1.15;
          d.toY = groundY;
        });
        if (win) {
          audio.play('win');
        } else {
          audio.play('lose');
        }
      }
    }
    if (state === 'result') {
      resultT += dt;
      if (!bursted) {
        bursteded = true;
        if (win) {
          particles.burst(W / 2, groundY - size, { count: 60, color: '#3ecf8e', speed: 400, size: 3.2, life: 1.1 });
        }
      }
      if (resultT > 1.8) {
        state = 'idle';
        hooks.finish({
          bet,
          payout,
          detail: `сумма ${d1 + d2} — ${win ? 'выигрыш' : 'мимо'}`,
        });
        return;
      }
    }

    stepDust(dust, dt, W, H);
    particles.update(dt);
    drawSceneBg(ctx, W, H, '125,211,252');
    drawDust(ctx, dust, now);

    radialGlow(ctx, W / 2, groundY, Math.min(W, H) * 0.7, win && state === 'result' ? '62,207,142' : '125,211,252', state === 'result' && win ? 0.28 : 0.12);

    // «стол»
    ctx.strokeStyle = 'rgba(125,211,252,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.12, groundY + size / 2 + 10);
    ctx.lineTo(W * 0.88, groundY + size / 2 + 10);
    ctx.stroke();

    // тени кубиков
    for (const d of diceAnim) {
      const dx = state === 'result' ? lerp(d.fromX, d.toX, easeOutCubic(clamp(resultT / 0.35, 0, 1))) : d.x;
      const dy = state === 'result' ? lerp(d.fromY, d.toY, easeOutCubic(clamp(resultT / 0.35, 0, 1))) : d.y;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.ellipse(dx, groundY + size / 2 + 8, size * 0.55, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
    }

    // кубики
    for (const [i, d] of diceAnim.entries()) {
      const e = state === 'result' ? easeOutCubic(clamp(resultT / 0.35, 0, 1)) : 0;
      const x = state === 'result' ? lerp(d.fromX, d.toX, e) : d.x;
      const y = state === 'result' ? lerp(d.fromY, d.toY, e) : d.y;
      const rot = state === 'result' ? d.rot0 * (1 - e) : d.rot;
      const face = state === 'result' ? (i === 0 ? d1 : d2) : d.face;
      ctx.save();
      if (state === 'result' && win) {
        ctx.shadowColor = '#3ecf8e';
        ctx.shadowBlur = 26 + Math.sin(now * 0.008) * 8;
      }
      drawDie(ctx, x, y, size, face, rot);
      ctx.restore();
    }

    // сумма
    if (state !== 'idle') {
      const sum = d1 + d2;
      neonText(ctx, state === 'rolling' ? '…' : String(sum), W / 2, H * 0.18, {
        font: `700 ${Math.round(Math.min(W, H) * 0.15)}px Unbounded, sans-serif`,
        color: state === 'result' ? (win ? '#3ecf8e' : 'rgba(244,239,230,0.6)') : GOLD,
        glow: 24,
      });
    }

    particles.draw(ctx);

    // баннер
    if (state === 'result') {
      const p = clamp(resultT / 0.3, 0, 1);
      const scale = 0.75 + 0.25 * (1 - Math.pow(1 - p, 3));
      const sum = d1 + d2;
      ctx.save();
      ctx.translate(W / 2, H * 0.84);
      ctx.scale(scale, scale);
      if (win) {
        neonText(ctx, `СУММА ${sum} · +${formatMoney(payout)}`, 0, 0, {
          font: `700 ${Math.round(Math.min(W, H) * 0.07)}px Unbounded, sans-serif`,
          color: '#3ecf8e',
          glow: 24,
        });
      } else {
        neonText(ctx, `СУММА ${sum} · МИМО`, 0, 0, {
          font: `600 ${Math.round(Math.min(W, H) * 0.055)}px Inter, sans-serif`,
          color: 'rgba(244,239,230,0.55)',
          glow: 0,
        });
      }
      ctx.restore();
    } else if (state === 'idle') {
      const a = 0.55 + 0.45 * Math.sin(now * 0.0022);
      neonText(ctx, 'ВЫБЕРИ СУММУ И БРОСАЙ КОСТИ', W / 2, H - 24, {
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
      return `<span>Вариант: ${OPTIONS.find((o) => o.id === choice).label}</span><b>×${DICE_PAYOUTS[choice]} · ${formatMoney(Math.round(b * DICE_PAYOUTS[choice]))}</b>`;
    },
    getInfo: () => ({
      rows: [
        ['Сумма меньше 7 (15/36)', `×${DICE_PAYOUTS.less}`],
        ['Сумма ровно 7 (6/36)', `×${DICE_PAYOUTS.seven}`],
        ['Сумма больше 7 (15/36)', `×${DICE_PAYOUTS.more}`],
      ],
      rules: `Бросаются две кости. Ставка на итоговую сумму: меньше 7, ровно 7 или больше 7. Выплата = множитель × ставка. RTP: ${(diceRTP() * 100).toFixed(1)}%.`,
    }),
    forceResolve: () => {
      if (state === 'idle') return null;
      const result = {
        bet,
        payout,
        detail: `сумма ${d1 + d2} — ${win ? 'выигрыш' : 'мимо'}`,
      };
      state = 'idle';
      return result;
    },
    dispose: () => cv?.disconnect(),
  };
}
