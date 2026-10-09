/* Рулетка (европейская, 37 карманов): колесо на canvas + поле ставок на фишки.
   Фишка = текущая ставка из панели; клик по клетке — добавить фишку. */

import { h, ic } from '../core/dom.js';
import { TAU, clamp, cryptoInt, formatMoney, lerp, easeOutQuart } from '../core/util.js';
import {
  drawSceneBg, makeDust, stepDust, drawDust, Particles, neonText, radialGlow,
  goldGrad, fillRR, strokeRR, GOLD,
} from './common/art.js';
import { attachCanvas } from './common/canvas.js';
import {
  ROULETTE_WHEEL, rouletteColor, rouletteBetWins, rouletteBetPays, rouletteRTP,
} from './math.js';

const SEG = TAU / 37;
const NAMES_RU = { red: 'красное', black: 'чёрное', green: 'зеро' };
const OUTSIDE_LABELS = {
  low: '1–18', high: '19–36', even: 'ЧЁТ', odd: 'НЕЧЕТ', red: 'КРАСНОЕ', black: 'ЧЁРНОЕ',
  d12: '1–12', d24: '13–24', d36: '25–36', col1: '2:1', col2: '2:1', col3: '2:1',
};

export function create(hooks) {
  const { controls, audio, store } = hooks;
  let cv = null;
  let W = 0;
  let H = 0;

  let state = 'idle'; // idle | spinning | result
  let bets = new Map(); // key -> amount
  let betStack = []; // история кликов для «отменить»
  let totalBet = 0;
  let winning = 0;
  let payout = 0;
  let resultT = 0;
  let winBets = []; // [{key, label, amount}] для детализации

  // вращение
  let wheelAngle = 0;
  let ballAngle = 0;
  let ballR = 0;
  let spin = null; // {t, dur, wheelFrom, wheelTo, ballFrom, ballTo, landT}
  let lastTickQ = 0;
  let lastTickAt = 0;

  const particles = new Particles();
  let dust = [];

  /* ---------- Поле ставок (HTML) ---------- */
  const board = h('div', { class: 'roulette-wrap' });
  const grid = h('div', { class: 'roulette-board' });
  const cellEls = new Map();

  function cell(key, label, cls, style = {}) {
    const el = h('button', {
      type: 'button',
      class: `rb-cell ${cls}`,
      dataset: { key },
      style,
      onClick: () => placeBet(key),
    });
    el.appendChild(h('span', { class: 'rb-label', text: label }));
    const amt = h('span', { class: 'bet-amt', style: { display: 'none' } });
    el.appendChild(amt);
    cellEls.set(key, el);
    return el;
  }

  // ноль (слева, на 3 ряда)
  grid.appendChild(cell('n0', '0', 'green rb-zero'));

  // числа 3×12: верхний ряд 3,6..36; средний 2,5..35; нижний 1,4..34
  for (let row = 0; row < 3; row++) {
    for (let c = 0; c < 12; c++) {
      const n = 3 - row + c * 3;
      const color = rouletteColor(n);
      grid.appendChild(cell(`n${n}`, String(n), color === 'green' ? 'green' : color, { gridColumn: String(c + 2), gridRow: String(row + 1) }));
    }
  }
  // колонки 2:1 (справа)
  for (let r = 0; r < 3; r++) {
    const key = `col${r + 1}`;
    grid.appendChild(cell(key, '2:1', 'side rb-cols', { gridRow: String(r + 1) }));
  }
  // дюжины
  grid.appendChild(cell('d12', '1–12', 'outer', { gridColumn: '2 / span 4', gridRow: '4' }));
  grid.appendChild(cell('d24', '13–24', 'outer', { gridColumn: '6 / span 4', gridRow: '4' }));
  grid.appendChild(cell('d36', '25–36', 'outer', { gridColumn: '10 / span 4', gridRow: '4' }));
  // чёт/нечет, цвета, половины
  const evenRow = [
    ['low', '1–18'], ['even', 'ЧЁТ'], ['red', 'КРАСНОЕ'], ['black', 'ЧЁРНОЕ'], ['odd', 'НЕЧЕТ'], ['high', '19–36'],
  ];
  evenRow.forEach(([key, label], i) => {
    const cls = key === 'red' ? 'outer red' : key === 'black' ? 'outer black' : 'outer';
    grid.appendChild(cell(key, label, cls, { gridColumn: `${i * 2 + 2} / span 2`, gridRow: '5' }));
  });

  // действия под полем
  const clearBtn = h('button', {
    class: 'btn btn-ghost', type: 'button', html: `${ic('reset').innerHTML} Очистить`,
    onClick: () => { if (state !== 'idle') return; audio.play('click'); bets.clear(); betStack = []; syncBets(); },
  });
  const undoBtn = h('button', {
    class: 'btn btn-ghost', type: 'button', html: `${ic('arrow-left').innerHTML} Отменить`,
    onClick: () => {
      if (state !== 'idle' || !betStack.length) return;
      audio.play('click');
      const last = betStack.pop();
      const left = (bets.get(last.key) || 0) - last.amount; // снимаем ровно ту сумму, что ставили
      if (left <= 0) bets.delete(last.key); else bets.set(last.key, left);
      syncBets();
    },
  });
  const totalEl = h('span', { class: 'roulette-total', html: 'Всего: <b>0</b>' });

  const actions = h('div', { class: 'roulette-actions' }, undoBtn, clearBtn, totalEl);
  board.appendChild(grid);
  board.appendChild(actions);
  controls.appendChild(board);

  function chipValue() {
    return hooks.getBet ? hooks.getBet() : 0;
  }

  function placeBet(key) {
    if (state !== 'idle') return;
    const chip = chipValue();
    if (!chip) return;
    audio.play('click');
    bets.set(key, (bets.get(key) || 0) + chip);
    betStack.push({ key, amount: chip }); // запоминаем сумму клика для «Отменить»
    syncBets();
  }

  function syncBets() {
    totalBet = 0;
    for (const [key, amount] of bets) {
      totalBet += amount;
      const el = cellEls.get(key);
      if (el) {
        const amt = el.querySelector('.bet-amt');
        amt.style.display = '';
        amt.textContent = formatMoney(amount);
        el.classList.add('selected');
      }
    }
    for (const [key, el] of cellEls) {
      if (!bets.has(key)) {
        el.classList.remove('selected');
        const amt = el.querySelector('.bet-amt');
        amt.style.display = 'none';
      }
    }
    totalEl.innerHTML = `Всего ставок: <b>${formatMoney(totalBet)}</b>`;
    hooks.setPotential?.(
      `<span>На кону (фишка = ${formatMoney(chipValue())})</span><b>${formatMoney(totalBet)} · макс. ×36</b>`
    );
  }

  function mount({ canvas }) {
    cv = attachCanvas(canvas, (w, h) => {
      W = w;
      H = h;
      dust = makeDust(w, h, 12);
    });
    W = cv.w;
    H = cv.h;
    ballR = Math.min(W, H) * 0.44 * 0.97;
    ballAngle = -Math.PI / 2;
    syncBets();
  }

  /* ---------- Раунд ---------- */

  function start(bet) {
    // bet = общая сумма ставок (shell уже списал)
    winning = ROULETTE_WHEEL[cryptoInt(37)];
    state = 'spinning';
    resultT = 0;
    particles.clear();
    winBets = [];
    payout = 0;

    const idx = ROULETTE_WHEEL.indexOf(winning);
    const target = -idx * SEG; // колесо останавливается карманом под стрелкой сверху
    const wheelFrom = wheelAngle;
    let delta = (target - wheelFrom) % TAU;
    if (delta < 0) delta += TAU;
    const wheelTo = wheelFrom + TAU * 4 + delta;

    // шарик: крутится навстречу, падает в лузу и дальше следует за колесом
    const landT = 0.76;
    const dur = 4.6;
    const wheelAtLand = wheelFrom + (wheelTo - wheelFrom) * easeOutQuart(landT);
    const ballAtLand = -Math.PI / 2 - (wheelTo - wheelAtLand);
    const ballFrom = ballAtLand + TAU * 5.5;

    spin = { t: 0, dur, wheelFrom, wheelTo, ballFrom, ballTo: ballAtLand, landT };
    lastTickQ = Math.round(ballFrom / SEG);
    audio.play('spin');
  }

  function finishRound() {
    // расчёт выплат по ставкам
    payout = 0;
    winBets = [];
    for (const [key, amount] of bets) {
      if (rouletteBetWins(key, winning)) {
        const p = amount * rouletteBetPays(key);
        payout += p;
        winBets.push({ key, label: betLabel(key), amount, p });
      }
    }
    const colorRu = NAMES_RU[rouletteColor(winning)];
    const detail =
      `${winning} ${colorRu}` +
      (winBets.length ? ` · ${winBets.map((b) => `${b.label} +${formatMoney(b.p)}`).join(', ')}` : '');
    state = 'idle';
    hooks.finish({ bet: totalBet, payout, detail });
    // очищаем ставки после раунда
    bets.clear();
    betStack = [];
    syncBets();
  }

  function betLabel(key) {
    if (key.startsWith('n')) return `число ${key.slice(1)}`;
    return OUTSIDE_LABELS[key] || key;
  }

  /* ---------- Рендер ---------- */

  function render(now, dt) {
    const ctx = cv.ctx;

    if (state === 'spinning') {
      spin.t += dt;
      const p = clamp(spin.t / spin.dur, 0, 1);
      const we = easeOutQuart(p);
      wheelAngle = lerp(spin.wheelFrom, spin.wheelTo, we);
      if (p < spin.landT) {
        const bp = p / spin.landT;
        const be = easeOutQuart(bp);
        ballAngle = lerp(spin.ballFrom, spin.ballTo, be);
        ballR = lerp(Math.min(W, H) * 0.44 * 0.97, Math.min(W, H) * 0.44 * 0.77, clamp((bp - 0.78) / 0.22, 0, 1));
        // тики шарика по карманам
        const q = Math.round(((ballAngle % TAU) + TAU) % TAU / SEG);
        if (q !== lastTickQ && now - lastTickAt > 45) {
          lastTickQ = q;
          lastTickAt = now;
          audio.play('tick');
        }
      } else {
        const le = easeOutQuart(spin.landT);
        const ballAtLand = lerp(spin.ballFrom, spin.ballTo, le);
        const wheelAtLand = lerp(spin.wheelFrom, spin.wheelTo, le);
        ballAngle = ballAtLand + (wheelAngle - wheelAtLand);
        ballR = Math.min(W, H) * 0.44 * 0.77;
      }
      if (p >= 1) {
        state = 'result';
        resultT = 0;
        audio.play('pop');
        if (payout === 0 && totalBet > 0) {
          // считаем выплаты сразу, чтобы знать, выиграл ли игрок
        }
        // выплаты считаем здесь (ставки ещё не очищены)
        payout = 0;
        winBets = [];
        for (const [key, amount] of bets) {
          if (rouletteBetWins(key, winning)) {
            const p = amount * rouletteBetPays(key);
            payout += p;
            winBets.push({ key, label: betLabel(key), amount, p });
          }
        }
        if (payout > 0) {
          audio.play(payout >= totalBet * 10 ? 'bigWin' : 'win');
          particles.burst(W / 2, H / 2, { count: 80, color: '#f5c542', speed: 380, size: 3.2, life: 1.3 });
        } else {
          audio.play('lose');
        }
      }
    }
    if (state === 'result') {
      resultT += dt;
      if (resultT > 2.0) {
        finishRound();
        return;
      }
    }

    stepDust(dust, dt, W, H);
    particles.update(dt);
    drawSceneBg(ctx, W, H, '248,113,113', '245,197,66');
    drawDust(ctx, dust, now);

    drawWheel(ctx, now, dt);
    particles.draw(ctx);

    // баннер результата
    if (state === 'result') {
      const cx = W / 2;
      const cy = H * 0.5;
      const R = Math.min(W, H) * 0.44;
      const p = clamp(resultT / 0.3, 0, 1);
      const scale = 0.75 + 0.25 * (1 - Math.pow(1 - p, 3));
      ctx.save();
      ctx.translate(cx, cy + R + 44);
      ctx.scale(scale, scale);
      const color = rouletteColor(winning);
      const colHex = color === 'red' ? '#f87171' : color === 'black' ? '#c9c2d8' : '#3ecf8e';
      neonText(ctx, `${winning}`, 0, 0, {
        font: `700 ${Math.round(R * 0.32)}px Unbounded, sans-serif`,
        color: colHex,
        glow: 30,
      });
      neonText(ctx, NAMES_RU[color].toUpperCase(), 0, R * 0.24, {
        font: `600 ${Math.round(R * 0.09)}px Inter, sans-serif`,
        color: 'rgba(244,239,230,0.6)',
        glow: 0,
      });
      if (payout > 0) {
        neonText(ctx, `+${formatMoney(payout)}`, 0, R * 0.42, {
          font: `700 ${Math.round(R * 0.16)}px Unbounded, sans-serif`,
          color: '#3ecf8e',
          glow: 20,
        });
      }
      ctx.restore();
    } else if (state === 'idle') {
      const a = 0.55 + 0.45 * Math.sin(now * 0.0022);
      neonText(ctx, 'Поставь фишки на поле и нажми «Крутить»'.toUpperCase(), W / 2, H - 22, {
        font: `600 ${Math.min(11.5, H * 0.028)}px Inter, sans-serif`,
        color: `rgba(179,168,204,${a.toFixed(2)})`,
        glow: 0,
      });
    }
  }

  /* ---------- Колесо ---------- */

  function drawWheel(ctx, now, dt) {
    const cx = W / 2;
    const cy = H * 0.46;
    const R = Math.min(W, H) * 0.44;
    const pocketR = R * 0.62;
    const isResult = state === 'result';
    const winIdx = ROULETTE_WHEEL.indexOf(winning);

    ctx.save();
    ctx.translate(cx, cy);

    // тень колеса
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 34;
    ctx.beginPath();
    ctx.arc(0, 6, R + 8, 0, TAU);
    ctx.fillStyle = '#0a0712';
    ctx.fill();
    ctx.shadowBlur = 0;

    // внешний золотой обод
    ctx.beginPath();
    ctx.arc(0, 0, R + 8, 0, TAU);
    ctx.fillStyle = goldGrad(ctx, -R, -R, R * 2, R * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, R - 4, 0, TAU);
    ctx.fillStyle = '#171021';
    ctx.fill();

    // карманы
    for (let i = 0; i < 37; i++) {
      const a0 = i * SEG - Math.PI / 2 + wheelAngle;
      const n = ROULETTE_WHEEL[i];
      const color = rouletteColor(n);
      const fill = color === 'red' ? '#a02334' : color === 'black' ? '#171021' : '#157a52';
      const a1 = a0 + SEG;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a0) * pocketR, Math.sin(a0) * pocketR);
      ctx.arc(0, 0, R - 8, a0, a1);
      ctx.arc(0, 0, pocketR, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      // выигрышный карман подсвечивается
      if (isResult && i === winIdx) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(Math.cos(a0) * pocketR, Math.sin(a0) * pocketR);
        ctx.arc(0, 0, R - 8, a0, a1);
        ctx.arc(0, 0, pocketR, a1, a0, true);
        ctx.closePath();
        ctx.strokeStyle = '#f5c542';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#f5c542';
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.restore();
      }
      // číslo
      const mid = (a0 + a1) / 2;
      const tx = Math.cos(mid) * (R * 0.82);
      const ty = Math.sin(mid) * (R * 0.82);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);
      ctx.font = `600 ${Math.max(7, Math.round(R * 0.075))}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f4efe6';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
      // сепаратор
      ctx.strokeStyle = 'rgba(245,197,66,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a0) * pocketR, Math.sin(a0) * pocketR);
      ctx.lineTo(Math.cos(a0) * (R - 8), Math.sin(a0) * (R - 8));
      ctx.stroke();
    }

    // внутренняя «чаша» с концентрическими кольцами
    const cone = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, pocketR);
    cone.addColorStop(0, '#3a2a55');
    cone.addColorStop(0.7, '#241735');
    cone.addColorStop(1, '#171021');
    ctx.beginPath();
    ctx.arc(0, 0, pocketR, 0, TAU);
    ctx.fillStyle = cone;
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,197,66,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // спицы
    ctx.strokeStyle = 'rgba(245,197,66,0.22)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      const a = wheelAngle + (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12);
      ctx.lineTo(Math.cos(a) * pocketR, Math.sin(a) * pocketR);
      ctx.stroke();
    }

    // ступица
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.13, 0, TAU);
    ctx.fillStyle = goldGrad(ctx, -R * 0.1, -R * 0.1, R * 0.2, R * 0.2);
    ctx.fill();
    ctx.strokeStyle = '#8a6410';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.045, 0, TAU);
    ctx.fillStyle = '#171021';
    ctx.fill();

    // стрелка-указатель сверху
    ctx.rotate(0);
    ctx.beginPath();
    ctx.moveTo(0, -(R + 14));
    ctx.lineTo(-7, -(R - 2));
    ctx.lineTo(7, -(R - 2));
    ctx.closePath();
    ctx.fillStyle = GOLD;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    // шарик
    const bx = cx + Math.cos(ballAngle) * ballR;
    const by = cy + Math.sin(ballAngle) * ballR;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    const bg = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, 7);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#b9b3c9');
    ctx.beginPath();
    ctx.arc(bx, by, 6.5, 0, TAU);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    // последние числа (полоса под колесом)
    const hist = store.history('roulette').slice(0, 12);
    if (hist.length) {
      const n = hist.length;
      const gap = 6;
      const dotR = Math.min(11, (W * 0.8 - gap * (n - 1)) / n / 2);
      if (dotR > 4) {
        const totalW = n * dotR * 2 + (n - 1) * gap;
        const x0 = (W - totalW) / 2;
        const y0 = cy + R + 26;
        hist.forEach((r, i) => {
          const num = parseInt(r.detail, 10);
          if (Number.isNaN(num)) return;
          const color = rouletteColor(num);
          const fill = color === 'red' ? '#a02334' : color === 'black' ? '#171021' : '#157a52';
          ctx.beginPath();
          ctx.arc(x0 + i * (dotR * 2 + gap) + dotR, y0, dotR, 0, TAU);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = 'rgba(245,197,66,0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.font = `600 ${Math.round(dotR)}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#f4efe6';
          ctx.fillText(String(num), x0 + i * (dotR * 2 + gap) + dotR, y0);
        });
      }
    }
  }

  return {
    mount,
    start,
    render,
    isBusy: () => state !== 'idle',
    setIdle: () => { state = 'idle'; },
    getBetsTotal: () => totalBet,
    getPotential: () =>
      `<span>На кону (фишка = ${formatMoney(chipValue())})</span><b>${formatMoney(totalBet)} · макс. ×36</b>`,
    getInfo: () => ({
      rows: [
        ['Число (1 из 37)', '×36'],
        ['Красное / Чёрное', '×2'],
        ['Чёт / Нечет', '×2'],
        ['1–18 / 19–36', '×2'],
        ['Дюжина (12 чисел)', '×3'],
        ['Колонка (12 чисел)', '×3'],
      ],
      rules: `Европейская рулетка: 37 карманов (0–36). Ставка на число — выплата 36×, на равные шансы — 2×, на дюжины и колонки — 3×. Зеро не оплачивает равные шансы. RTP: ${(rouletteRTP() * 100).toFixed(1)}%.`,
    }),
    forceResolve: () => {
      if (state === 'idle') return null;
      // мгновенный расчёт по текущим ставкам
      const res = computePayout();
      const result = { bet: totalBet, payout: res.payout, detail: res.detail };
      state = 'idle';
      bets.clear();
      betStack = [];
      syncBets();
      return result;
    },
    dispose: () => cv?.disconnect(),
  };
}
