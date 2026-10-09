/* Сапёр: поле 5×5, прячем мины, открываем клетки и забираем выигрыш
   с растущим множителем. наступил на мину — ставка сгорает. */

import { h, ic } from '../core/dom.js';
import { clamp, cryptoInt, formatMoney } from '../core/util.js';
import { drawSceneBg, makeDust, stepDust, drawDust, Particles, neonText, radialGlow, GOLD } from './common/art.js';
import { attachCanvas } from './common/canvas.js';
import { minesMultiplier, MINES_GRID, MINES_EDGE } from './math.js';

const GRID = 5;
const CELLS = GRID * GRID;
const MINE_OPTIONS = [1, 3, 5, 10, 15, 24];

const ICON_GEM = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M7.4 4.4h9.2l3.8 4.8L12 20.4 3.6 9.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3.6 9.2h16.8M7.4 4.4l4.6 15.8L16.6 4.4" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
const ICON_BOMB = `<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="10.6" cy="13.6" r="5.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.3 8.2 10.4 5.6h2.4l.8 2.2M13.6 5.2c1.2-1.5 2.8-1.7 4-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.6 2.6l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="currentColor"/></svg>`;

export function create(hooks) {
  const { controls, overlay, audio, store } = hooks;
  let cv = null;
  let W = 0;
  let H = 0;

  let state = 'idle'; // idle | playing | exploded | cashed
  let bet = 0;
  let minesCount = 3;
  let minePositions = new Set();
  let revealed = 0;
  let payout = 0;
  let detail = '';
  let endT = 0;
  let cashoutRequested = false;

  const particles = new Particles();
  let dust = [];

  /* ---------- Сетка (HTML поверх canvas) ---------- */
  const gridEl = h('div', { class: 'mines-wrap' });
  const grid = h('div', { class: 'mines-grid' });
  const tiles = [];
  for (let i = 0; i < CELLS; i++) {
    const tile = h('button', {
      type: 'button',
      class: 'mine-tile',
      'aria-label': `Клетка ${i + 1}`,
      html: `<span class="t-ic">${ICON_GEM}</span>`,
      onClick: () => reveal(i),
    });
    tiles.push(tile);
    grid.appendChild(tile);
  }
  gridEl.appendChild(grid);
  overlay.appendChild(gridEl);

  /* ---------- Контролы ---------- */
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Количество мин' });
  const mineBtns = {};
  for (const n of MINE_OPTIONS) {
    const btn = h('button', {
      type: 'button',
      class: n === minesCount ? 'active' : '',
      html: `${ic('bomb').innerHTML} ${n}`,
      onClick: () => {
        if (state !== 'idle') return;
        audio.play('click');
        minesCount = n;
        for (const [k, b] of Object.entries(mineBtns)) b.classList.toggle('active', Number(k) === n);
        updatePotential();
      },
    });
    mineBtns[n] = btn;
    seg.appendChild(btn);
  }
  controls.appendChild(seg);

  const cashBtn = h('button', {
    class: 'btn btn-success btn-lg',
    style: { minWidth: '190px' },
    disabled: true,
    html: `${ic('coins').innerHTML} <span>Забрать</span>`,
    onClick: () => cashout(),
  });
  const cashLabel = cashBtn.querySelector('span');
  const cashWrap = h('div', { style: { marginLeft: 'auto' } }, cashBtn);
  controls.appendChild(cashWrap);

  function currentMult() {
    return minesMultiplier(minesCount, revealed);
  }

  function updatePotential() {
    if (state === 'idle') {
      const maxM = minesMultiplier(minesCount, CELLS - minesCount);
      hooks.setPotential?.(
        `<span>Мин: ${minesCount} · открыто клеток: 0</span><b>множитель до ×${maxM.toFixed(2)}</b>`
      );
    }
  }

  function mount({ canvas }) {
    cv = attachCanvas(canvas, (w, h) => {
      W = w;
      H = h;
      dust = makeDust(w, h, 12);
    });
    W = cv.w;
    H = cv.h;
    updatePotential();
    syncTiles();
  }

  function syncTiles() {
    for (const tile of tiles) {
      tile.disabled = state !== 'playing';
      tile.classList.remove('boom');
    }
  }

  /* ---------- Раунд ---------- */

  function start(b) {
    bet = b;
    revealed = 0;
    payout = 0;
    detail = '';
    endT = 0;
    cashoutRequested = false;
    // размещаем мины (crypto)
    minePositions = new Set();
    while (minePositions.size < minesCount) minePositions.add(cryptoInt(CELLS));
    for (const tile of tiles) {
      tile.className = 'mine-tile';
      tile.disabled = false;
    }
    state = 'playing';
    audio.play('spin');
    updateCashBtn();
    updatePotentialPlaying();
    syncTiles();
  }

  function reveal(i) {
    if (state !== 'playing') return;
    const tile = tiles[i];
    if (tile.classList.contains('safe') || tile.classList.contains('mine')) return;
    if (minePositions.has(i)) {
      // взрыв
      tile.classList.add('mine', 'boom');
      tile.innerHTML = `<span class="t-ic">${ICON_BOMB}</span>`;
      state = 'exploded';
      endT = 0;
      audio.play('lose');
      // показываем все мины
      for (let k = 0; k < CELLS; k++) {
        const t2 = tiles[k];
        if (minePositions.has(k)) {
          t2.classList.add('mine');
          t2.innerHTML = `<span class="t-ic">${ICON_BOMB}</span>`;
        } else if (!t2.classList.contains('safe')) {
          t2.classList.add('dim');
        }
        t2.disabled = true;
      }
      syncTiles();
      // искры на canvas
      const r = tile.getBoundingClientRect();
      const stage = gridEl.getBoundingClientRect();
      particles.burst(
        r.left - stage.left + r.width / 2,
        r.top - stage.top + r.height / 2,
        { count: 40, color: '#ef4444', speed: 320, size: 3.5, life: 0.9, gravity: 400 }
      );
      detail = `мина на клетке ${i + 1} · ставка сгорела`;
      hooks.setPotential?.(`<span>Мина!</span><b>ставка сгорела</b>`);
      cashBtn.disabled = true;
      return;
    }
    // безопасная клетка
    tile.classList.add('safe');
    tile.disabled = true;
    revealed += 1;
    audio.play('pop');
    const mult = currentMult();
    updateCashBtn();
    updatePotentialPlaying();
    // все безопасные открыты — авто-cashout
    if (revealed === CELLS - minesCount) {
      cashout();
    }
  }

  function updateCashBtn() {
    if (state !== 'playing' || revealed === 0) {
      cashBtn.disabled = true;
      cashLabel.textContent = 'Забрать';
      return;
    }
    cashBtn.disabled = false;
    const mult = currentMult();
    const win = Math.floor(bet * mult);
    cashLabel.textContent = `Забрать ${formatMoney(win)} · ×${mult.toFixed(2)}`;
  }

  function updatePotentialPlaying() {
    const mult = currentMult();
    hooks.setPotential?.(
      `<span>Мин: ${minesCount} · открыто: ${revealed}</span><b>×${mult.toFixed(2)} · ${formatMoney(Math.floor(bet * mult))}</b>`
    );
  }

  function cashout() {
    if (state !== 'playing' || revealed === 0) return;
    cashoutRequested = true;
    const mult = currentMult();
    payout = Math.floor(bet * mult);
    detail = `${minesCount} мин · ${revealed} клеток · ×${mult.toFixed(2)}`;
    state = 'cashed';
    endT = 0;
    audio.play('cash');
    // подсветка открытых клеток
    for (const tile of tiles) {
      tile.disabled = true;
      if (tile.classList.contains('safe')) tile.classList.add('dim');
    }
    particles.burst(W / 2, H / 2, { count: 70, color: '#3ecf8e', speed: 420, size: 3.4, life: 1.2 });
    hooks.setPotential?.(
      `<span>Забрано</span><b class="win-pos">+${formatMoney(payout)} · ×${mult.toFixed(2)}</b>`
    );
    cashBtn.disabled = true;
  }

  /* ---------- Рендер (фон под сеткой) ---------- */

  function render(now, dt) {
    const ctx = cv.ctx;
    if (state === 'exploded' || state === 'cashed') {
      endT += dt;
      if (endT > 1.8) {
        const result = { bet, payout, detail };
        state = 'idle';
        // сброс сетки для следующего раунда
        for (const tile of tiles) {
          tile.className = 'mine-tile';
          tile.innerHTML = `<span class="t-ic">${ICON_GEM}</span>`;
        }
        cashBtn.disabled = true;
        cashLabel.textContent = 'Забрать';
        updatePotential();
        syncTiles();
        hooks.finish(result);
        return;
      }
    }
    stepDust(dust, dt, W, H);
    particles.update(dt);
    drawSceneBg(ctx, W, H, '139,92,246', '245,197,66');
    drawDust(ctx, dust, now);

    // подсказки по состоянию
    if (state === 'idle') {
      const a = 0.55 + 0.45 * Math.sin(now * 0.0022);
      neonText(ctx, 'Выбери число мин и открой клетки'.toUpperCase(), W / 2, 26, {
        font: `600 ${Math.min(11.5, H * 0.028)}px Inter, sans-serif`,
        color: `rgba(179,168,204,${a.toFixed(2)})`,
        glow: 0,
      });
      // крупный множитель-потолок
      const maxM = minesMultiplier(minesCount, CELLS - minesCount);
      neonText(ctx, `×${maxM.toFixed(2)}`, W / 2, H - 26, {
        font: `700 ${Math.round(Math.min(W, H) * 0.07)}px Unbounded, sans-serif`,
        color: 'rgba(245,197,66,0.35)',
        glow: 0,
      });
      neonText(ctx, 'максимум при всех клетках', W / 2, H - 26 + Math.min(W, H) * 0.09, {
        font: `600 10px Inter, sans-serif`,
        color: 'rgba(179,168,204,0.5)',
        glow: 0,
      });
    } else if (state === 'playing') {
      // текущий множитель сверху
      const mult = currentMult();
      neonText(ctx, `×${mult.toFixed(2)}`, W / 2, 30, {
        font: `700 ${Math.round(Math.min(W, H) * 0.06)}px Unbounded, sans-serif`,
        color: revealed > 0 ? GOLD : 'rgba(244,239,230,0.5)',
        glow: revealed > 0 ? 18 : 0,
      });
    } else if (state === 'exploded') {
      const a = clamp(endT / 0.25, 0, 1);
      const scale = 0.8 + 0.2 * (1 - Math.pow(1 - a, 3));
      ctx.save();
      ctx.translate(W / 2, 34);
      ctx.scale(scale, scale);
      neonText(ctx, 'МИНА!', 0, 0, {
        font: `700 ${Math.round(Math.min(W, H) * 0.09)}px Unbounded, sans-serif`,
        color: '#ff8a8a',
        glow: 26,
      });
      ctx.restore();
    } else if (state === 'cashed') {
      const a = clamp(endT / 0.25, 0, 1);
      const scale = 0.8 + 0.2 * (1 - Math.pow(1 - a, 3));
      ctx.save();
      ctx.translate(W / 2, 34);
      ctx.scale(scale, scale);
      neonText(ctx, `+${formatMoney(payout)}`, 0, 0, {
        font: `700 ${Math.round(Math.min(W, H) * 0.09)}px Unbounded, sans-serif`,
        color: '#3ecf8e',
        glow: 26,
      });
      ctx.restore();
    }

    particles.draw(ctx);
  }

  return {
    mount,
    start,
    render,
    isBusy: () => state !== 'idle',
    setIdle: () => {
      state = 'idle';
      for (const tile of tiles) {
        tile.className = 'mine-tile';
        tile.innerHTML = `<span class="t-ic">${ICON_GEM}</span>`;
      }
      cashBtn.disabled = true;
      cashLabel.textContent = 'Забрать';
      updatePotential();
      syncTiles();
    },
    getPotential: () => {
      if (state === 'playing') {
        const mult = currentMult();
        return `<span>Мин: ${minesCount} · открыто: ${revealed}</span><b>×${mult.toFixed(2)} · ${formatMoney(Math.floor(bet * mult))}</b>`;
      }
      const maxM = minesMultiplier(minesCount, CELLS - minesCount);
      return `<span>Мин: ${minesCount} · открыто клеток: 0</span><b>множитель до ×${maxM.toFixed(2)}</b>`;
    },
    getInfo: () => ({
      rows: [
        ['Множитель за клетку', `×(25−i)/(25−i−мины) ×${MINES_EDGE}`],
        ['Краш клетка', 'ставка сгорает'],
        ['Cashout', 'ставка × текущий множитель'],
      ],
      rules: `Поле 5×5, ты выбираешь количество мин (1–24). Каждая открытая безопасная клетка увеличивает множитель; забрать можно в любой момент кнопкой «Забрать». Наступил на мину — раунд проигран.`,
    }),
    forceResolve: () => {
      if (state === 'idle') return null;
      let result;
      if (state === 'cashed') {
        // cashout уже нажат — возвращаем ту же выплату, что и отложенный finish
        result = { bet, payout, detail };
      } else if (state === 'exploded') {
        result = { bet, payout: 0, detail: detail || 'мина · ставка сгорела' };
      } else if (revealed > 0) {
        // считаем cashout по текущему множителю
        const mult = currentMult();
        result = {
          bet,
          payout: Math.floor(bet * mult),
          detail: `${minesCount} мин · ${revealed} клеток · ×${mult.toFixed(2)} (автозакрытие)`,
        };
      } else {
        // ни одной клетки не открыто — возвращаем ставку (раунд не начинался)
        result = { bet, payout: bet, detail: 'раунд отменён — ставка возвращена' };
      }
      state = 'idle';
      return result;
    },
    dispose: () => cv?.disconnect(),
  };
}
