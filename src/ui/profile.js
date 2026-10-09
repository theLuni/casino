/* Профиль: баланс, статистика, история операций, промокоды, сброс прогресса. */

import { h, ic } from '../core/dom.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { formatMoney, formatSigned, formatTime } from '../core/util.js';
import { GAMES } from '../games/registry.js';
import { PROMOS } from '../core/promos.js';
import { confirmModal } from './modal.js';

export function renderProfile(root) {
  const stats = store.stats();
  const opsWrap = h('div', { class: 'ops-wrap' });
  const promosBox = h('div', {});

  function winrate() {
    const { rounds, wins } = store.stats();
    return rounds ? Math.round((wins / rounds) * 100) : 0;
  }

  function renderStats() {
    const s = store.stats();
    const cards = [
      { label: 'Баланс', icon: 'chip', value: formatMoney(store.balance()), cls: 'gold' },
      { label: 'Поставлено', icon: 'coins', value: formatMoney(s.wagered), cls: '' },
      { label: 'Чистый результат', icon: 'trend', value: formatSigned(s.paidOut - s.wagered), cls: s.paidOut - s.wagered >= 0 ? 'green' : 'red' },
      { label: 'Раундов', icon: 'clock', value: String(s.rounds), cls: '' },
      { label: 'Крупнейший выигрыш', icon: 'trophy', value: formatMoney(s.biggestWin), cls: 'gold' },
      { label: 'Винрейт', icon: 'target', value: `${winrate()}%`, cls: '' },
    ];
    return h(
      'div',
      { class: 'stats-grid' },
      cards.map((c) =>
        h(
          'div',
          { class: `stat-card ${c.cls}` },
          h('div', { class: 's-label', html: `${ic(c.icon).innerHTML} ${c.label}` }),
          h('div', { class: 's-value', text: c.value })
        )
      )
    );
  }

  function renderOps() {
    const ops = store.ops();
    const table = h('table', { class: 'ops-table' });
    table.appendChild(
      h('tr', {},
        h('th', { text: 'Время' }), h('th', { text: 'Операция' }), h('th', { text: 'Ставка' }), h('th', { text: 'Выплата' }), h('th', { text: 'Итог' })
      )
    );
    if (!ops.length) {
      table.appendChild(h('tr', {}, h('td', { colspan: 5, style: { textAlign: 'center', color: 'var(--text-faint)' }, text: 'Операций пока нет' })));
    }
    for (const o of ops) {
      const isPromo = o.type === 'promo';
      const meta = GAMES.find((g) => g.id === o.game);
      const label = isPromo ? `Промокод ${o.code}` : meta?.name || o.game;
      const detail = isPromo ? '' : o.detail ? ` · ${o.detail}` : '';
      table.appendChild(
        h('tr', {},
          h('td', { text: formatTime(o.ts) }),
          h('td', { text: `${label}${detail}`, title: `${label}${detail}` }),
          h('td', { class: 'num', text: o.bet != null ? formatMoney(o.bet) : '—' }),
          h('td', { class: 'num', text: o.payout != null ? formatMoney(o.payout) : '—' }),
          h('td', { class: `num ${o.profit > 0 ? 'up' : o.profit < 0 ? 'down' : ''}`, text: o.profit != null ? formatSigned(o.profit) : '—' })
        )
      );
    }
    opsWrap.textContent = '';
    opsWrap.appendChild(table);
  }

  function renderPromos() {
    const used = store.usedPromos();
    promosBox.textContent = '';
    if (!used.length) {
      promosBox.appendChild(h('div', { class: 'hist-empty', text: 'Промокоды ещё не активированы' }));
      return;
    }
    for (const p of used) {
      const promo = PROMOS.find((x) => x.code === p.code);
      promosBox.appendChild(
        h('div', { class: 'promo-card used' },
          h('span', { class: 'p-code', text: p.code }),
          h('div', { class: 'p-body' },
            h('div', { class: 'p-label', text: promo?.label || 'Промокод' }),
            h('div', { class: 'p-label faint', text: new Date(p.ts).toLocaleDateString('ru-RU') })
          ),
          h('span', { class: 'p-amount', text: `+${formatMoney(p.amount)}` }),
          h('span', { class: 'badge badge-success', html: ic('check').innerHTML })
        )
      );
    }
  }

  const statsContainer = h('div', {});

  root.appendChild(
    h('div', { class: 'page wrap' },
      h('div', { class: 'page-head' },
        h('span', { class: 'eyebrow', text: 'аккаунт' }),
        h('h1', { class: 'display', text: 'Профиль' })
      ),
      statsContainer,
      h('div', { class: 'page-grid' },
        h('div', { class: 'side-panel' },
          h('h3', {}, ic('clock').innerHTML, 'История операций'),
          opsWrap
        ),
        h('div', {},
          h('div', { class: 'side-panel', style: { marginBottom: '14px' } },
            h('h3', {}, ic('gift').innerHTML, 'Активированные промокоды'),
            promosBox
          ),
          h('div', { class: 'side-panel' },
            h('h3', {}, ic('x').innerHTML, 'Опасная зона'),
            h('p', { class: 'rules-note', text: 'Сбросить весь прогресс: баланс, статистику и историю. Отменить нельзя.' }),
            h('button', {
              class: 'btn btn-danger',
              html: `${ic('reset').innerHTML} Сбросить прогресс`,
              onClick: () => {
                confirmModal({
                  title: 'Сбросить прогресс?',
                  text: 'Баланс, статистика, история и промокоды будут удалены. Действие необратимо.',
                  confirmText: 'Сбросить',
                  danger: true,
                  onConfirm: () => {
                    store.reset();
                    navigate('/');
                  },
                });
              },
            })
          )
        )
      )
    )
  );

  function rerender() {
    statsContainer.textContent = '';
    statsContainer.appendChild(renderStats());
    renderOps();
    renderPromos();
  }

  rerender();
  const unsub = store.subscribe((type) => {
    if (type === 'balance' || type === 'round' || type === 'promo' || type === 'reset' || type === 'stats') rerender();
  });
  return () => unsub();
}
