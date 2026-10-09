/* Лобби: hero, промо-баннер, сетка из 8 игр с превью-анимацией, лента раундов. */

import { h, ic } from '../core/dom.js';
import { GAMES } from '../games/registry.js';
import { GAME_ART } from './gameArt.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { formatSigned, formatTime } from '../core/util.js';
import { PROMOS } from '../core/promos.js';

export function renderLobby(root) {
  const recentEl = h('div', { class: 'recent-list' });

  function renderRecent() {
    const items = store.recentAll(10);
    recentEl.textContent = '';
    if (!items.length) {
      recentEl.appendChild(h('div', { class: 'recent-empty', text: 'Раундов пока нет — начни с любой игры ниже' }));
      return;
    }
    for (const r of items) {
      const meta = GAMES.find((g) => g.id === r.game);
      recentEl.appendChild(
        h(
          'div',
          { class: 'recent-pill' },
          h('span', { class: 'dot', style: { background: meta?.color || '#888' } }),
          h('span', { text: `${meta?.name || r.game} · ${r.detail}` }),
          h('b', { class: r.profit > 0 ? 'up' : r.profit < 0 ? 'down' : '', text: formatSigned(r.profit) })
        )
      );
    }
  }

  const promo = PROMOS[0];
  const used = store.usedPromos().some((p) => p.code === promo.code);

  const grid = h(
    'div',
    { class: 'games-grid' },
    GAMES.map((g) => {
      const card = h(
        'div',
        {
          class: 'game-card',
          tabindex: '0',
          role: 'button',
          'aria-label': `Играть: ${g.name}`,
          onClick: () => navigate(`/game/${g.id}`),
          onKeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate(`/game/${g.id}`);
            }
          },
        },
        h('div', {
          class: 'game-art',
          style: {
            '--art-a': artBgA(g.id),
            '--art-b': artBgB(g.id),
            '--art-glow': `${hexToRgba(g.color, 0.16)}`,
          },
          html: GAME_ART[g.id](),
        }),
        h(
          'div',
          { class: 'game-body' },
          h('div', { class: 'game-name', text: g.name }),
          h('div', { class: 'game-tag', text: g.tag }),
          h(
            'div',
            { class: 'game-meta' },
            h('span', { class: 'badge badge-gold', text: `RTP ${g.rtp}` }),
            h('span', { class: 'badge', text: `от ${g.min}` }),
            h('span', { class: 'go', html: `${ic('arrow-right').innerHTML} Играть` })
          )
        )
      );
      return card;
    })
  );

  root.appendChild(
    h(
      'div',
      { class: 'lobby wrap' },
      // HERO
      h(
        'section',
        { class: 'hero' },
        h(
          'div',
          {},
          h('span', { class: 'eyebrow', text: 'виртуальное казино' }),
          h('h1', { class: 'display' }, 'Золото ждёт ', h('span', { class: 'grad-text', text: 'смелых' })),
          h(
            'p',
            { class: 'lead' },
            'Восемь игр, премиальная подача и честные коэффициенты. Фишки виртуальные — реальные деньги мы не принимаем и не выплачиваем.'
          ),
          h(
            'div',
            { class: 'hero-cta' },
            h('a', { class: 'btn btn-gold btn-lg', href: '#games', onClick: (e) => { e.preventDefault(); document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' }); } }, ic('play').innerHTML, 'Играть сейчас'),
            h('a', { class: 'btn btn-ghost btn-lg', href: '#/topup', onClick: (e) => { e.preventDefault(); navigate('/topup'); } }, ic('gift').innerHTML, 'Промокоды')
          ),
          h(
            'div',
            { class: 'hero-stats' },
            h('div', { class: 'hero-stat' }, h('b', { text: '8' }), h('span', { text: 'игр' })),
            h('div', { class: 'hero-stat' }, h('b', { text: 'до 99%' }), h('span', { text: 'RTP' })),
            h('div', { class: 'hero-stat' }, h('b', { text: '0 ₽' }), h('span', { text: 'реальных денег' }))
          )
        ),
        h(
          'div',
          { class: 'hero-art' },
          h('div', { class: 'hero-orb' }),
          h(
            'div',
            { class: 'hero-card-stack' },
            cardEl(58, 40, -14, 'back'),
            cardEl(40, 30, -7, 'red', 'K', '♥'),
            cardEl(22, 20, 0, 'dark', 'A', '♠')
          )
        )
      ),
      // Промо-баннер
      h(
        'section',
        { class: 'promo-banner' },
        h('div', { class: 'promo-gift', html: ic('gift').innerHTML }),
        h(
          'div',
          { class: 'promo-body' },
          h('b', { text: used ? 'Промокод WELCOME уже активирован' : 'Новым игрокам — промокод WELCOME' }),
          h('span', { text: used ? 'Забери другой промокод на странице пополнения' : `+${promo.amount} фишек на старт. Виртуальная валюта, без вложений.` })
        ),
        h('span', { class: 'promo-code', text: promo.code }),
        h('button', {
          class: `btn ${used ? 'btn-ghost' : 'btn-gold'}`,
          text: used ? 'Все промокоды' : 'Забрать',
          onClick: () => navigate('/topup'),
        })
      ),
      // Сетка игр
      h(
        'section',
        { id: 'games' },
        h(
          'div',
          { class: 'section-head' },
          h('div', {}, h('span', { class: 'eyebrow', text: 'лобби' }), h('h2', { class: 'display', text: 'Выбери свою игру' })),
          h('span', { class: 'muted', style: { fontSize: '13px' }, text: 'Наведи на карточку — увидишь превью' })
        ),
        grid
      ),
      // Лента
      h(
        'section',
        { class: 'recent-strip' },
        h('h3', {}, ic('clock').innerHTML, 'Твои последние раунды'),
        recentEl
      )
    )
  );

  renderRecent();
  const unsub = store.subscribe((type) => {
    if (type === 'round') renderRecent();
  });
  return () => unsub();
}

/* Декоративные карты в hero */
function cardEl(left, top, rot, kind, rank = '', suit = '') {
  const red = kind === 'red';
  const cls = kind === 'back' ? 'hcard back' : `hcard ${red ? 'red' : ''}`;
  const inner =
    kind === 'back'
      ? ''
      : `<span class="corner">${rank}<b class="corner-suit"><svg viewBox="0 0 24 24" aria-hidden="true">${suitShape(suit)}</svg></b></span>` +
        `<svg class="big-suit" width="44" height="44" viewBox="0 0 24 24">${suitShape(suit)}</svg>`;
  return h('div', {
    class: cls,
    html: inner,
    style: { left: `${left}px`, top: `${top}px`, transform: `rotate(${rot}deg)`, zIndex: String(10 - top) },
  });
}

function suitShape(suit) {
  if (suit === '♥')
    return `<path d="M12 20.2C7.2 16.6 4 13.6 4 10.2 4 7.9 5.8 6 8.1 6c1.5 0 2.9.8 3.9 2.1C13 6.8 14.4 6 15.9 6 18.2 6 20 7.9 20 10.2c0 3.4-3.2 6.4-8 10z" fill="currentColor"/>`;
  return `<path d="M12 3.2c3.4 3.6 6.4 5.6 6.4 8.6a3.6 3.6 0 0 1-5.2 3.2c-.4-1.2-1-2.2-2-2.9l.9 3.1H8.9l.9-3.1c-1 .7-1.6 1.7-2 2.9a3.6 3.6 0 0 1-5.2-3.2c0-3 3-5 6.5-8.6z" fill="currentColor"/>`;
}

function artBgA(id) {
  return {
    slots: '#2b1c10', coinflip: '#241735', dice: '#10222b', roulette: '#2b1016',
    blackjack: '#12241b', crash: '#241a10', mines: '#1d1530', plinko: '#10241c',
  }[id] || '#241735';
}
function artBgB(id) {
  return {
    slots: '#120c1d', coinflip: '#120c1d', dice: '#0c1418', roulette: '#160a10',
    blackjack: '#0c1810', crash: '#140d20', mines: '#120c1d', plinko: '#0b1a13',
  }[id] || '#120c1d';
}

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
