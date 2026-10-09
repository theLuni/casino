/* Промокоды. Виртуальная валюта, без реальных денег.
   Каждый код одноразовый: факт активации хранится в localStorage. */

export const PROMOS = [
  { code: 'WELCOME', amount: 500, label: 'Стартовый бонус новичка' },
  { code: 'LUNI', amount: 250, label: 'Талисман удачи' },
  { code: 'GOLD', amount: 1000, label: 'Золотой запас' },
  { code: 'VIP', amount: 2500, label: 'VIP-награда' },
  { code: 'JACKPOT', amount: 10000, label: 'Джекпот-промо' },
];

export function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function findPromo(code) {
  const c = normalizeCode(code);
  return PROMOS.find((p) => p.code === c) || null;
}
