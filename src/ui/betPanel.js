/* Панель ставки — общая для всех игр.
   Фишки, поле ввода со степперами, быстрые кнопки ×½/×2/МАКС/ПРЕД,
   строка «потенциальный выигрыш» и главная кнопка действия. */

import { h, ic } from '../core/dom.js';
import { audio } from '../core/audio.js';
import { formatMoney, clamp } from '../core/util.js';

const CHIPS = [10, 50, 100, 500, 1000];

export function createBetPanel({ min, max, initial, defaultLabel, onAction }) {
  let bet = clamp(initial, min, max);
  let locked = false;
  let action = { label: defaultLabel, variant: 'gold', disabled: false, onClick: null };

  const input = h('input', {
    class: 'bet-input',
    inputmode: 'numeric',
    autocomplete: 'off',
    spellcheck: 'false',
    value: String(bet),
    'aria-label': 'Размер ставки',
  });

  const potentialEl = h('div', { class: 'bet-info', html: '<span>Потенциальный выигрыш</span><b>—</b>' });

  const playBtn = h(
    'button',
    { class: 'btn btn-gold btn-lg play-btn', type: 'button' },
    h('span', { class: 'play-ic', html: ic('play').innerHTML }),
    h('span', { class: 'play-label', text: defaultLabel })
  );

  function syncChips() {
    for (const c of chipsRow.querySelectorAll('.chip-btn')) {
      c.classList.toggle('active', Number(c.dataset.v) === bet);
    }
  }

  function setBet(v, { silent = false } = {}) {
    bet = clamp(Math.floor(Number(v) || 0), 0, max);
    input.value = bet > 0 ? String(bet) : '';
    syncChips();
    if (!silent) onAction?.('change', bet);
  }

  input.addEventListener('input', () => {
    const raw = input.value.replace(/[^\d]/g, '').slice(0, 9);
    input.value = raw;
    bet = clamp(Number(raw || 0), 0, max);
    syncChips();
  });
  input.addEventListener('blur', () => setBet(bet));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
      doAction();
    }
  });

  const chipsRow = h(
    'div',
    { class: 'chips-row' },
    CHIPS.map((v) =>
      h('button', {
        class: 'chip-btn',
        type: 'button',
        dataset: { v },
        style: { '--chip-c': chipCssColor(v) },
        onClick: () => {
          audio.play('click');
          setBet(v);
        },
        text: formatMoney(v),
      })
    )
  );

  const minusBtn = h('button', {
    class: 'stepper', type: 'button', 'aria-label': 'Меньше', html: ic('minus').innerHTML,
    onClick: () => setBet(Math.max(min, Math.floor(bet / 2))),
  });
  const plusBtn = h('button', {
    class: 'stepper', type: 'button', 'aria-label': 'Больше', html: ic('plus').innerHTML,
    onClick: () => setBet(Math.min(max, bet + (bet < 100 ? 10 : bet < 1000 ? 100 : 500))),
  });

  const quick = (label, fn) =>
    h('button', {
      class: 'quick-btn', type: 'button', text: label,
      onClick: () => { audio.play('click'); fn(); },
    });

  const quickRow = h(
    'div',
    { class: 'quick-row' },
    quick('×½', () => setBet(Math.max(min, Math.floor(bet / 2)))),
    quick('×2', () => setBet(Math.min(max, bet * 2))),
    quick('МАКС', () => setBet(max)),
    quick('ПРЕД', () => setBet(lastExternalBet || initial))
  );

  let lastExternalBet = initial;

  function renderAction() {
    playBtn.className = `btn btn-lg play-btn ${action.variant === 'success' ? 'btn-success' : action.variant === 'danger' ? 'btn-danger' : 'btn-gold'}`;
    // keepEnabled — действие игры (например, «Забрать» в краше) не гасится во время раунда
    playBtn.disabled = action.disabled || (locked && !action.keepEnabled);
    playBtn.querySelector('.play-label').textContent = action.label;
  }

  function doAction() {
    if (playBtn.disabled) return;
    if (action.onClick) action.onClick();
    else onAction?.('play', bet);
  }

  playBtn.addEventListener('click', () => {
    audio.play('click');
    doAction();
  });

  renderAction();
  syncChips();

  const el = h(
    'div',
    { class: 'bet-panel' },
    h('div', { class: 'bet-row' }, chipsRow),
    h(
      'div',
      { class: 'bet-row' },
      h(
        'div',
        { class: 'bet-field' },
        h('span', { class: 'cur', html: ic('chip').innerHTML }),
        input,
        minusBtn,
        plusBtn
      ),
      h('div', { style: { marginLeft: 'auto', display: 'flex' } }, quickRow)
    ),
    potentialEl,
    playBtn
  );

  return {
    el,
    getBet: () => bet,
    setBet,
    setLastBet: (v) => { lastExternalBet = v; },
    lock(on) {
      locked = !!on;
      for (const b of el.querySelectorAll('button')) b.disabled = locked || (b === playBtn ? playBtn.disabled : b.disabled);
      // chips/quick/steppers гасим через locked, но play-кнопку решает action
      for (const b of chipsRow.querySelectorAll('button')) b.disabled = locked;
      for (const b of quickRow.querySelectorAll('button')) b.disabled = locked;
      minusBtn.disabled = locked;
      plusBtn.disabled = locked;
      input.disabled = locked;
      renderAction();
    },
    setAction(opts) {
      if (opts && 'onClick' in opts) {
        // полная замена действия (например, «Забрать» во время раунда краша)
        action = {
          label: opts.label ?? defaultLabel,
          variant: opts.variant ?? 'gold',
          disabled: opts.disabled ?? false,
          keepEnabled: !!opts.keepEnabled,
          onClick: opts.onClick,
        };
      } else {
        action = { ...action, ...opts };
      }
      renderAction();
    },
    resetAction(label) {
      action = { label: label || defaultLabel, variant: 'gold', disabled: false, onClick: null };
      renderAction();
    },
    setPotential(html) {
      potentialEl.innerHTML = html;
    },
  };
}

function chipCssColor(v) {
  if (v >= 1000) return '#ef4444';
  if (v >= 500) return '#3ecf8e';
  if (v >= 100) return '#f5c542';
  if (v >= 50) return '#8b5cf6';
  return '#8a80a8';
}
