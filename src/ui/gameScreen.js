/* Экран игры: сцена (canvas) сверху, панель ставки снизу, история и коэффициенты сбоку.
   Shell управляет деньгами и историей; модуль игры — только логикой и анимацией.
   Модуль игры загружается асинхронно, но cleanup возвращается синхронно. */

import { h, ic } from '../core/dom.js';
import { getGameMeta, createGame } from '../games/registry.js';
import { createBetPanel } from './betPanel.js';
import { store } from '../core/store.js';
import { audio } from '../core/audio.js';
import { navigate } from '../core/router.js';
import { toastError, toastWin } from './toast.js';
import { formatMoney, formatSigned, formatTime, tickTweens, clearTweens, clamp } from '../core/util.js';

export function renderGameScreen(root, { id }) {
  const meta = getGameMeta(id);
  if (!meta) {
    navigate('/');
    return () => {};
  }

  /* ---------- DOM ---------- */
  const canvas = h('canvas');
  const overlay = h('div', { class: 'stage-overlay' });
  const stage = h('div', { class: 'game-stage' }, canvas, overlay);
  const controlsEl = h('div', { class: 'game-controls' });
  const histList = h('div', { class: 'hist-list' });
  const infoPanel = h('div', { class: 'side-panel' });

  const initialBet = clamp(store.prevBet(id) || Math.max(meta.min, 10), meta.min, meta.max);

  /* ---------- Состояние раунда ---------- */
  let game = null;
  let finished = true; // true, когда можно начинать новый раунд
  let disposed = false;
  let raf = 0;

  /* ---------- hooks для модуля игры ---------- */
  const hooks = {
    controls: controlsEl,
    overlay,
    audio,
    store,
    meta,
    toastError,
    getBet: () => betPanel.getBet(),
    setPotential: (html) => betPanel.setPotential(html),
    setAction: (opts) => betPanel.setAction(opts),
    resetAction: () => betPanel.resetAction(meta.playLabel),
    withdrawExtra: (amount) => store.placeBet(id, amount),
    finish: (result) => {
      if (finished || disposed) return;
      finished = true;
      const { bet, payout, detail } = result;
      store.resolveRound(id, bet, payout, detail);
      betPanel.lock(false);
      betPanel.resetAction(meta.playLabel);
      betPanel.setLastBet(bet);
      renderHistory(true);
      const profit = payout - bet;
      if (profit > 0) {
        audio.play(profit >= bet * 4 ? 'bigWin' : 'win');
        if (profit >= bet * 4) {
          toastWin(`+${formatMoney(profit)} фишек`, { title: `${meta.name}: ${detail}` });
        }
      } else if (payout > 0) {
        audio.play('cash');
      } else {
        audio.play('lose');
      }
      game?.setIdle?.();
    },
  };

  /* ---------- Панель ставки ---------- */
  const betPanel = createBetPanel({
    min: meta.min,
    max: meta.max,
    initial: initialBet,
    defaultLabel: meta.playLabel,
    onAction: (kind, bet) => {
      if (kind === 'play') onPlay(bet);
      else if (kind === 'change' && game?.getPotential) {
        const p = game.getPotential();
        if (p) betPanel.setPotential(p);
      }
    },
  });

  /* ---------- Запуск раунда ---------- */
  function onPlay(panelBet) {
    if (!game || !finished || disposed) return;
    if (game.isBusy()) return;
    const bet = typeof game.getBetsTotal === 'function' ? game.getBetsTotal() : panelBet;
    if (!bet || bet < meta.min) {
      toastError(`Минимальная ставка — ${formatMoney(meta.min)} фишек`);
      return;
    }
    if (bet > store.balance()) {
      toastError('Недостаточно фишек — пополни баланс промокодом');
      return;
    }
    if (!store.placeBet(id, bet)) {
      toastError('Недостаточно фишек');
      return;
    }
    finished = false;
    betPanel.lock(true);
    betPanel.setAction({ disabled: true });
    audio.play('spin');
    game.start(bet);
  }

  /* ---------- История ---------- */
  let lastHistTs = 0;
  function renderHistory(animateNew = false) {
    const items = store.history(id);
    histList.textContent = '';
    if (!items.length) {
      histList.appendChild(h('div', { class: 'hist-empty', text: 'Раундов пока нет — сыграй первый' }));
      return;
    }
    for (const r of items) {
      const fresh = animateNew && r.ts > lastHistTs;
      lastHistTs = Math.max(lastHistTs, r.ts);
      histList.appendChild(
        h(
          'div',
          { class: 'hist-item', style: fresh ? 'animation: pillIn .35s ease both' : '' },
          h('span', { class: 'dot', style: { background: meta.color } }),
          h('span', { class: 'h-detail', text: r.detail, title: r.detail }),
          h('span', { class: 'h-time', text: formatTime(r.ts) }),
          h('span', {
            class: `h-profit ${r.profit > 0 ? 'up' : r.profit < 0 ? 'down' : 'zero'}`,
            text: r.profit === 0 ? '±0' : formatSigned(r.profit),
          })
        )
      );
    }
  }

  /* ---------- Сборка ---------- */
  root.appendChild(
    h(
      'div',
      { class: 'game-screen wrap' },
      h(
        'div',
        { class: 'game-top' },
        h('button', {
          class: 'btn-icon',
          title: 'В лобби',
          'aria-label': 'Назад в лобби',
          html: ic('arrow-left').innerHTML,
          onClick: () => navigate('/'),
        }),
        h(
          'div',
          { class: 'game-title-block' },
          h('h1', { class: 'display', text: meta.name }),
          h('div', { class: 'tag', text: meta.tag })
        ),
        h(
          'div',
          { class: 'game-top-badges' },
          h('span', { class: 'badge badge-gold', html: `${ic('sparkles').innerHTML} RTP ${meta.rtp}` }),
          h('span', { class: 'badge', text: `ставка от ${formatMoney(meta.min)}` })
        )
      ),
      h(
        'div',
        { class: 'game-layout' },
        h('div', { class: 'game-main' }, stage, controlsEl, betPanel.el),
        h(
          'aside',
          { class: 'game-side' },
          h('div', { class: 'side-panel' }, h('h3', {}, ic('clock').innerHTML, 'История раундов'), histList),
          infoPanel
        )
      )
    )
  );

  renderHistory();

  /* ---------- Загрузка модуля игры ---------- */
  createGame(id, hooks).then((g) => {
    if (disposed) {
      g?.dispose?.();
      return;
    }
    game = g;
    if (!game) {
      navigate('/');
      return;
    }
    game.mount?.({ canvas, controls: controlsEl, overlay });

    // info-панель
    const info = game.getInfo?.() || { rows: [], rules: '' };
    infoPanel.appendChild(h('h3', {}, ic('info').innerHTML, 'Коэффициенты'));
    if (info.rows?.length) {
      const table = h('table', { class: 'coef-table' });
      for (const [k, v] of info.rows) {
        table.appendChild(h('tr', {}, h('td', { text: k }), h('td', { text: v })));
      }
      infoPanel.appendChild(table);
    }
    if (info.rules) {
      infoPanel.appendChild(h('p', { class: 'rules-note', text: info.rules }));
    }

    if (game.getPotential) {
      const p = game.getPotential();
      if (p) betPanel.setPotential(p);
    }

    // RAF-цикл
    let last = performance.now();
    const loop = (now) => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tickTweens(now);
      try {
        game.render?.(now, dt);
      } catch (e) {
        console.error('game render error', e);
      }
    };
    raf = requestAnimationFrame(loop);
  });

  /* ---------- Cleanup при уходе со страницы ---------- */
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    clearTweens();
    if (game && game.isBusy?.()) {
      // Раунд не доигран: рассчитываем мгновенно, чтобы деньги не «сгорали»
      const pending = game.forceResolve?.();
      if (pending) {
        finished = true;
        store.resolveRound(id, pending.bet, pending.payout, pending.detail);
      }
    }
    game?.dispose?.();
  };
}
