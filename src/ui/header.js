/* Шапка сайта: логотип, навигация, баланс (с анимацией счётчика), звук. */

import { h, ic } from '../core/dom.js';
import { store } from '../core/store.js';
import { audio } from '../core/audio.js';
import { formatMoney } from '../core/util.js';
import { navigate } from '../core/router.js';

export function renderHeader() {
  const balanceEl = h('span', { class: 'balance-value', text: formatMoney(store.balance()) });

  const soundBtn = h('button', {
    class: 'btn-icon',
    title: 'Звук',
    'aria-label': 'Переключить звук',
    html: ic(audio.on ? 'volume' : 'volume-off').innerHTML,
  });
  soundBtn.classList.toggle('active', audio.on);

  soundBtn.addEventListener('click', () => {
    const next = !audio.on;
    audio.set(next);
    store.setSound(next);
    soundBtn.innerHTML = ic(next ? 'volume' : 'volume-off').innerHTML;
    soundBtn.classList.toggle('active', next);
    if (next) audio.play('click');
  });

  // анимированный счётчик баланса
  let shown = store.balance();
  let animId = 0;
  store.subscribe((type, payload) => {
    if (type !== 'balance') return;
    const from = shown;
    const to = payload.to;
    if (from === to) return;
    cancelAnimationFrame(animId);
    const t0 = performance.now();
    const dur = 650;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      shown = from + (to - from) * e;
      balanceEl.textContent = formatMoney(shown);
      if (p < 1) animId = requestAnimationFrame(step);
      else shown = to;
    };
    animId = requestAnimationFrame(step);
  });

  return h(
    'header',
    { class: 'site-header' },
    h(
      'div',
      { class: 'wrap' },
      h(
        'a',
        { class: 'logo', href: '#/', onClick: (e) => { e.preventDefault(); navigate('/'); } },
        h('span', { class: 'logo-mark', html: ic('crown').innerHTML }),
        h(
          'span',
          { class: 'logo-text' },
          h('span', { class: 'logo-name grad-text', text: 'Luni Royal' }),
          h('span', { class: 'logo-sub', text: 'виртуальное казино' })
        )
      ),
      h(
        'nav',
        { class: 'nav' },
        h('a', { href: '#/', onClick: (e) => { e.preventDefault(); navigate('/'); }, text: 'Лобби' }),
        h('a', { href: '#/topup', onClick: (e) => { e.preventDefault(); navigate('/topup'); }, text: 'Пополнить' }),
        h('a', { href: '#/profile', onClick: (e) => { e.preventDefault(); navigate('/profile'); }, text: 'Профиль' })
      ),
      h(
        'div',
        { class: 'header-right' },
        h(
          'a',
          {
            class: 'balance-chip',
            href: '#/topup',
            title: 'Пополнить баланс',
            onClick: (e) => { e.preventDefault(); navigate('/topup'); },
          },
          h('span', { class: 'chip-ic', html: ic('chip').innerHTML }),
          balanceEl,
          h('span', { class: 'balance-label', text: 'фишек' })
        ),
        soundBtn
      )
    )
  );
}
