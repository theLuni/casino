/* Пополнение: активация промокодов (виртуальная валюта, мгновенное зачисление). */

import { h, ic } from '../core/dom.js';
import { store } from '../core/store.js';
import { audio } from '../core/audio.js';
import { PROMOS, normalizeCode } from '../core/promos.js';
import { navigate } from '../core/router.js';
import { formatMoney } from '../core/util.js';
import { toastSuccess, toastError } from './toast.js';

export function renderTopup(root) {
  const input = h('input', {
    class: 'promo-input',
    placeholder: 'Введи промокод',
    maxlength: '20',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Промокод',
  });

  const codesBox = h('div', {});

  function tryRedeem(code) {
    const res = store.redeem(code);
    if (res.ok) {
      audio.play('coin');
      toastSuccess(`Промокод ${res.promo.code} активирован — баланс пополнен`, { title: `+${formatMoney(res.promo.amount)} фишек` });
      input.value = '';
      renderCodes();
    } else if (res.reason === 'used') {
      audio.play('error');
      toastError('Этот промокод уже был использован');
      input.classList.add('err');
      setTimeout(() => input.classList.remove('err'), 500);
    } else if (res.reason === 'invalid') {
      audio.play('error');
      toastError('Промокод не найден. Проверь написание — например, WELCOME');
      input.classList.add('err');
      setTimeout(() => input.classList.remove('err'), 500);
    }
  }

  function renderCodes() {
    const used = store.usedPromos().map((p) => p.code);
    codesBox.textContent = '';
    if (store.balance() <= 0) {
      codesBox.appendChild(
        h('div', { class: 'empty-balance', html: `${ic('info').innerHTML} Баланс пуст — активируй промокод ниже, чтобы продолжить играть` })
      );
    }
    for (const p of PROMOS) {
      const isUsed = used.includes(p.code);
      codesBox.appendChild(
        h('div', { class: `promo-card ${isUsed ? 'used' : ''}` },
          h('span', { class: 'p-code', text: p.code }),
          h('div', { class: 'p-body' },
            h('div', { class: 'p-label', text: p.label }),
            h('div', { class: 'p-amount', text: `+${formatMoney(p.amount)} фишек` })
          ),
          isUsed
            ? h('span', { class: 'badge', html: `${ic('check').innerHTML} активирован` })
            : h('button', {
                class: 'btn btn-ghost',
                html: `${ic('copy').innerHTML} Ввести`,
                onClick: () => {
                  input.value = p.code;
                  input.focus();
                },
              })
        )
      );
    }
  }

  root.appendChild(
    h('div', { class: 'page wrap' },
      h('div', { class: 'page-head' },
        h('span', { class: 'eyebrow', text: 'баланс' }),
        h('h1', { class: 'display', text: 'Пополнение' }),
        h('p', { class: 'muted', style: { marginTop: '8px' }, text: 'Валюта виртуальная: фишки начисляются мгновенно и существуют только в этом демо. Реальные деньги не принимаются.' })
      ),
      h('div', { class: 'page-grid' },
        h('div', {},
          h('div', { class: 'side-panel', style: { marginBottom: '14px' } },
            h('h3', {}, ic('wallet').innerHTML, 'Текущий баланс'),
            h('div', { style: { fontFamily: 'var(--font-num)', fontSize: '30px', fontWeight: 600, color: 'var(--gold-1)', margin: '6px 0 2px' }, text: formatMoney(store.balance()) }),
            h('div', { class: 'faint', style: { fontSize: '12.5px' }, text: 'фишек' })
          ),
          h('div', { class: 'side-panel' },
            h('h3', {}, ic('gift').innerHTML, 'Активировать промокод'),
            h('div', { class: 'redeem-box' },
              input,
              h('button', {
                class: 'btn btn-gold btn-lg',
                html: `${ic('gift').innerHTML} Активировать`,
                onClick: () => tryRedeem(input.value),
              })
            ),
            h('p', { class: 'rules-note', text: 'Каждый промокод одноразовый: повторно использовать его нельзя. Регистр не важен: welcome и WELCOME — одно и то же.' })
          )
        ),
        h('div', { class: 'side-panel' },
          h('h3', {}, ic('sparkles').innerHTML, 'Доступные промокоды'),
          codesBox
        )
      ),
      h('div', { style: { marginTop: '26px', textAlign: 'center' } },
        h('button', { class: 'btn btn-ghost', html: `${ic('arrow-left').innerHTML} Вернуться в лобби`, onClick: () => navigate('/') })
      )
    )
  );

  input.addEventListener('input', () => {
    input.value = normalizeCode(input.value).slice(0, 20);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryRedeem(input.value);
  });

  renderCodes();
  const unsub = store.subscribe((type) => {
    if (type === 'promo' || type === 'balance' || type === 'reset') renderCodes();
  });
  return () => unsub();
}
