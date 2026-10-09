/* Простое модальное окно подтверждения. */

import { h, ic } from '../core/dom.js';

export function confirmModal({ title, text, confirmText = 'Подтвердить', cancelText = 'Отмена', danger = false, onConfirm }) {
  const backdrop = h('div', { class: 'modal-backdrop' });
  const modal = h(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    h('h3', { text: title }),
    h('p', { text: text }),
    h(
      'div',
      { class: 'modal-actions' },
      h('button', { class: 'btn btn-ghost', text: cancelText, onClick: close }),
      h('button', {
        class: `btn ${danger ? 'btn-danger' : 'btn-gold'}`,
        text: confirmText,
        onClick: () => {
          close();
          onConfirm?.();
        },
      })
    )
  );
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  }
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  return close;
}
