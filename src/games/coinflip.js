/* Монетка: выбери сторону, монета подбрасывается с 3D-флипом.
   Угадал — выплата ×1.95. */

import { h, ic } from '../core/dom.js';
import { TAU, clamp, chance, formatMoney } from '../core/util.js';
import { drawSceneBg, makeDust, stepDust, drawDust, Particles, neonText, drawCoin, radialGlow, GOLD } from './common/art.js';
import { attachCanvas } from './common/canvas.js';
import { COIN_PAYOUT } from './math.js';

const SIDES = [
  { id: 'heads', label: 'Орёл', icon: 'crown' },
  { id: 'tails', label: 'Решка', icon: 'coin' },
];

export function create(hooks) {
  const { controls, audio } = hooks;
  let cv = null;
  let W = 0;
  let H = 0;

  let side = 'heads'; // выбранная сторона
  let state = 'idle'; // idle | flipping | result
  let bet = 0;
  let win = false;
  let payout = 0;
  let flipT = 0;
  let resultT = 0;
  let landedFace = 'heads';

  const particles = new Particles();
  let dust = [];

  /* ---------- Контролы: выбор стороны ---------- */
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Сторона монеты' });
  const sideBtns = {};
  for (const s of SIDES) {
    const btn = h('button', {
      type: 'button',
      class: s.id === side ? 'active' : '',
      html: `${ic(s.icon).innerHTML} ${s.label}`,
      onClick: () => {
        if (state !== 'idle') return;
        audio.play('click');
        side = s.id;
        for (const [id, b] of Object.entries(sideBtns)) b.classList.toggle('active', id === side);
      },
    });
    sideBtns[s.id] = btn;
    seg.appendChild(btn);
  }
  controls.appendChild(seg);

  function mount({ canvas }) {
    cv = attachCanvas(canvas, (w, h) => {
      W = w;
      H = h;
      dust = makeDust(w, h, 14);
    });
    W = cv.w;
    H = cv.h;
  }

  function start(b) {
    bet = b;
    win = chance(0.5);
    payout = win ? Math.round(bet * COIN_PAYOUT) : 0;
    landedFace = win ? side : side === 'heads' ? 'tails' : 'heads';
    state = 'flipping';
    flipT = 0;
    resultT = 0;
    particles.clear();
    audio.play('flip');
  }

  const FLIP_DUR = 1.75;

  function render(now, dt) {
    const ctx = cv.ctx;
    if (state === 'flipping') {
      flipT += dt;
      if (flipT >= FLIP_DUR) {
        state = 'result';
        resultT = 0;
        if (win) {
          audio.play('win');
          particles.burst(W / 2, H * 0.42, { count: 70, color: '#3ecf8e', speed: 460, size: 3.5, life: 1.2 });
        } else {
          audio.play('lose');
        }
      }
    }
    if (state === 'result') resultT += dt;
    if (state === 'result' && resultT > 1.7) {
      state = 'idle';
      hooks.finish({
        bet,
        payout,
        detail: `${landedFace === 'heads' ? 'Орёл' : 'Решка'} — ${win ? 'угадано' : 'мимо'}`,
      });
      return;
    }

    stepDust(dust, dt, W, H);
    particles.update(dt);
    drawSceneBg(ctx, W, H, '167,139,250');
    drawDust(ctx, dust, now);

    const cx = W / 2;
    const cy = H * 0.44;
    const R = Math.min(W, H) * 0.26;

    // подсветка под монетой
    radialGlow(ctx, cx, cy + R * 0.9, R * 1.6, win && state === 'result' ? '62,207,142' : '245,197,66', state === 'result' && win ? 0.3 : 0.14);

    // тень
    let squash = 1;
    let lift = 0;
    let face = landedFace;
    if (state === 'flipping') {
      const p = clamp(flipT / FLIP_DUR, 0, 1);
      const rot = p * TAU * 3;
      squash = Math.abs(Math.cos(rot));
      lift = Math.sin(Math.PI * p) * R * 0.75;
      // лицо меняется на середине каждого оборота
      face = Math.floor(p * 3) % 2 === 0 ? 'heads' : 'tails';
    }
    const shadowScale = 1 - lift / (R * 2);
    ctx.save();
    ctx.globalAlpha = 0.35 * clamp(shadowScale, 0.2, 1);
    ctx.beginPath();
    ctx.ellipse(cx, cy + R * 1.05, R * 0.9 * clamp(shadowScale, 0.2, 1), R * 0.16, 0, 0, TAU);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    // «пьедестал» (кольцо) под монетой
    ctx.beginPath();
    ctx.ellipse(cx, cy + R * 1.02, R * 1.05, R * 0.22, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(245,197,66,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // монета
    ctx.save();
    if (state === 'result' && win) {
      ctx.shadowColor = '#3ecf8e';
      ctx.shadowBlur = 30 + Math.sin(now * 0.008) * 10;
    }
    drawCoin(ctx, cx, cy, R, { face, squash: Math.max(squash, 0.06), lift });
    ctx.restore();

    // подписи сторон под монетой
    const labelY = cy + R * 1.35;
    for (const s of SIDES) {
      const isSel = s.id === side;
      const isLanded = state === 'result' && landedFace === s.id;
      neonText(ctx, s.label.toUpperCase(), s.id === 'heads' ? cx - R * 1.3 : cx + R * 1.3, labelY, {
        font: `700 ${Math.round(R * 0.11)}px Inter, sans-serif`,
        color: isLanded ? (win ? '#3ecf8e' : '#ff8a8a') : isSel ? GOLD : 'rgba(179,168,204,0.5)',
        glow: isLanded || isSel ? 14 : 0,
      });
    }

    particles.draw(ctx);

    // баннер результата
    if (state === 'result') {
      const p = clamp(resultT / 0.3, 0, 1);
      const scale = 0.75 + 0.25 * (1 - Math.pow(1 - p, 3));
      ctx.save();
      ctx.translate(cx, cy - R * 1.55);
      ctx.scale(scale, scale);
      if (win) {
        neonText(ctx, `+${formatMoney(payout)}`, 0, 0, {
          font: `700 ${Math.round(R * 0.3)}px Unbounded, sans-serif`,
          color: '#3ecf8e',
          glow: 26,
        });
      } else {
        neonText(ctx, 'МИМО', 0, 0, {
          font: `600 ${Math.round(R * 0.2)}px Inter, sans-serif`,
          color: 'rgba(244,239,230,0.5)',
          glow: 0,
        });
      }
      ctx.restore();
    } else if (state === 'idle') {
      const a = 0.55 + 0.45 * Math.sin(now * 0.0022);
      neonText(ctx, 'ВЫБЕРИ СТОРОНУ И НАЖМИ «БРОСИТЬ»', cx, H - 26, {
        font: `600 ${Math.min(12, H * 0.03)}px Inter, sans-serif`,
        color: `rgba(179,168,204,${a.toFixed(2)})`,
        glow: 0,
      });
    } else if (state === 'flipping') {
      neonText(ctx, 'Подбрасываем…'.toUpperCase(), cx, H - 26, {
        font: `600 ${Math.min(12, H * 0.03)}px Inter, sans-serif`,
        color: 'rgba(245,197,66,0.8)',
        glow: 8,
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
      return `<span>Выигрыш за угаданную сторону</span><b>×1.95 · ${formatMoney(Math.round(b * COIN_PAYOUT))}</b>`;
    },
    getInfo: () => ({
      rows: [
        ['Орёл (угадан)', `×${COIN_PAYOUT}`],
        ['Решка (угадана)', `×${COIN_PAYOUT}`],
      ],
      rules: 'Выбери сторону монеты и нажми «Бросить». При верном выборе выплата 1.95× от ставки. RTP: 97.5%.',
    }),
    forceResolve: () => {
      if (state === 'idle') return null;
      const result = {
        bet,
        payout,
        detail: `${landedFace === 'heads' ? 'Орёл' : 'Решка'} — ${win ? 'угадано' : 'мимо'}`,
      };
      state = 'idle';
      return result;
    },
    dispose: () => cv?.disconnect(),
  };
}
