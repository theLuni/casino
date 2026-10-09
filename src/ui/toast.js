/* Всплывающие уведомления (стек в правом верхнем углу). */

import { h, ic } from '../core/dom.js';
import { audio } from '../core/audio.js';

let stack = null;

function ensure() {
  if (!stack) {
    stack = h('div', { class: 'toast-stack' });
    document.body.appendChild(stack);
  }
  return stack;
}

const ICONS = { success: 'check', error: 'x', info: 'info', win: 'trophy' };

export function toast(message, type = 'info', opts = {}) {
  const { title, duration = 3600 } = opts;
  const el = h(
    'div',
    { class: `toast ${type}`, role: 'status' },
    h('div', { class: 't-ic', html: ic(ICONS[type] || 'info').innerHTML }),
    h('div', {}, h('b', { text: title || defaultTitle(type) }), h('span', { text: message }))
  );
  ensure().appendChild(el);
  if (type === 'error') audio.play('error');
  if (type === 'success' || type === 'win') audio.play('coin');
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, duration);
  return el;
}

function defaultTitle(type) {
  return { success: 'Готово', error: 'Ошибка', info: 'Подсказка', win: 'Выигрыш' }[type] || 'Уведомление';
}

export const toastSuccess = (msg, o) => toast(msg, 'success', o);
export const toastError = (msg, o) => toast(msg, 'error', o);
export const toastInfo = (msg, o) => toast(msg, 'info', o);
export const toastWin = (msg, o) => toast(msg, 'win', o);
