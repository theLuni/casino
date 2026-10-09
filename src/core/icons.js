/* Единый набор SVG-иконок (stroke-стиль, 24×24, currentColor).
   Никаких эмодзи в интерфейсе — только эти иконки и арт на canvas/SVG. */

const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  crown: `<path ${S} d="M4 17.5 5.4 8.2l3.8 3.3L12 5.6l2.8 5.9 3.8-3.3 1.4 9.3z"/><path ${S} d="M5.5 20.5h13"/>`,
  chip: `<circle ${S} cx="12" cy="12" r="8.2"/><circle ${S} cx="12" cy="12" r="3.4"/><path ${S} d="M12 3.8v3M12 17.2v3M3.8 12h3M17.2 12h3M6.2 6.2l2.1 2.1M15.7 15.7l2.1 2.1M17.8 6.2l-2.1 2.1M8.3 15.7l-2.1 2.1"/>`,
  dice: `<rect ${S} x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.15" fill="currentColor"/><circle cx="15" cy="15" r="1.15" fill="currentColor"/><circle cx="15" cy="9" r="1.15" fill="currentColor"/><circle cx="9" cy="15" r="1.15" fill="currentColor"/><circle cx="12" cy="12" r="1.15" fill="currentColor"/>`,
  wheel: `<circle ${S} cx="12" cy="12" r="8.4"/><circle ${S} cx="12" cy="12" r="2.6"/><path ${S} d="M12 3.6v5.8M12 14.6v5.8M3.6 12h5.8M14.6 12h5.8M6.1 6.1l4.1 4.1M13.8 13.8l4.1 4.1M17.9 6.1l-4.1 4.1M10.2 13.8l-4.1 4.1"/>`,
  cards: `<rect ${S} x="3.4" y="5.6" width="10" height="13.4" rx="1.8"/><rect ${S} x="10.6" y="5" width="10" height="13.4" rx="1.8" fill="var(--bg-1, #1a1227)"/><path d="M15.6 9.2c1.1 1.3 2.1 2 2.1 3.1a1.7 1.7 0 0 1-3 1 1.7 1.7 0 0 1-3-1c0-1.1 1-1.8 2.1-3.1z" fill="#e0455a" stroke="none" transform="translate(-1.4 -0.4)"/>`,
  rocket: `<path ${S} d="M12 2.8c2.9 1.9 4.3 5 4.3 8.6l-1.7 2.4h-5.2L7.7 11.4c0-3.6 1.4-6.7 4.3-8.6z"/><circle ${S} cx="12" cy="9.4" r="1.7"/><path ${S} d="M7.6 11.5 5.4 15l3 .3M16.4 11.5l2.2 3.5-3 .3M10.4 16.5c.2 1.6.9 2.7 1.6 3.7.7-1 1.4-2.1 1.6-3.7"/>`,
  bomb: `<circle ${S} cx="10.6" cy="13.6" r="5.6"/><path ${S} d="M9.3 8.2 10.4 5.6h2.4l.8 2.2"/><path ${S} d="M13.6 5.2c1.2-1.5 2.8-1.7 4-1"/><path d="M18.6 2.6l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="currentColor" stroke="none"/>`,
  plinko: `<circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="8" cy="11" r="1.5" fill="currentColor"/><circle cx="16" cy="11" r="1.5" fill="currentColor"/><circle cx="4" cy="17" r="1.5" fill="currentColor"/><circle cx="12" cy="17" r="1.5" fill="currentColor"/><circle cx="20" cy="17" r="1.5" fill="currentColor"/><circle ${S} cx="12" cy="21" r="1.6"/>`,
  coin: `<circle ${S} cx="12" cy="12" r="8.4"/><circle ${S} cx="12" cy="12" r="5.4"/><path ${S} d="M12 9.2v5.6M9.8 10.6h3.4a1.2 1.2 0 0 1 0 2.4H10.8a1.2 1.2 0 0 0 0 2.4h3.4" stroke-width="1.4"/>`,
  user: `<circle ${S} cx="12" cy="8.4" r="3.6"/><path ${S} d="M4.8 20c.6-3.8 3.5-5.8 7.2-5.8s6.6 2 7.2 5.8"/>`,
  wallet: `<rect ${S} x="3.4" y="6.4" width="17.2" height="13.2" rx="2.6"/><path ${S} d="M3.4 9.6h17.2"/><circle cx="17" cy="14.6" r="1.15" fill="currentColor" stroke="none"/>`,
  volume: `<path d="M4 9.6v4.8h3.2L12 18V6L7.2 9.6z" fill="currentColor" stroke="none"/><path ${S} d="M15.2 9.4a4.2 4.2 0 0 1 0 5.2M17.8 7.2a7.4 7.4 0 0 1 0 9.6"/>`,
  'volume-off': `<path d="M4 9.6v4.8h3.2L12 18V6L7.2 9.6z" fill="currentColor" stroke="none"/><path ${S} d="M15.6 9.8l4.8 4.8M20.4 9.8l-4.8 4.8"/>`,
  'arrow-left': `<path ${S} d="M14.4 5.6 8 12l6.4 6.4"/>`,
  'arrow-right': `<path ${S} d="M9.6 5.6 16 12l-6.4 6.4"/>`,
  play: `<path d="M8.4 5.4v13.2L19 12z" fill="currentColor" stroke="none"/>`,
  plus: `<path ${S} d="M12 5.4v13.2M5.4 12h13.2"/>`,
  minus: `<path ${S} d="M5.4 12h13.2"/>`,
  check: `<path ${S} d="M5 12.6l4.4 4.4L19 7.4"/>`,
  copy: `<rect ${S} x="9" y="9" width="11" height="11" rx="2"/><path ${S} d="M5 15V6a2 2 0 0 1 2-2h9"/>`,
  gift: `<rect ${S} x="4" y="11" width="16" height="9.4" rx="1.6"/><path ${S} d="M3 7.4h18v3.6H3zM12 7.4v13"/><path ${S} d="M12 7.4C8.6 7.4 7.4 3.6 9.4 3.1c1.9-.5 2.6 2.4 2.6 4.3 0-1.9.7-4.8 2.6-4.3 2 .5.8 4.3-2.6 4.3z"/>`,
  clock: `<circle ${S} cx="12" cy="12" r="8.4"/><path ${S} d="M12 7.4V12l3.2 2"/>`,
  info: `<circle ${S} cx="12" cy="12" r="8.4"/><path ${S} d="M12 11v5.2"/><circle cx="12" cy="7.8" r="1.05" fill="currentColor" stroke="none"/>`,
  x: `<path ${S} d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>`,
  reset: `<path ${S} d="M19.6 12a7.6 7.6 0 1 1-2.2-5.4"/><path ${S} d="M19.8 3.6v3.6h-3.6"/>`,
  star: `<path d="M12 3.4l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill="currentColor" stroke="none"/>`,
  flame: `<path d="M12 3c.9 2.9 3.9 4.4 3.9 7.7a4.6 4.6 0 0 1-9.2 0c0-1.9.9-3.4 1.9-4.5.1 1.4.6 2.4 1.5 2.9C9.7 6.7 10.4 4.9 12 3z" fill="currentColor" stroke="none"/>`,
  gem: `<path ${S} d="M7.4 4.4h9.2l3.8 4.8L12 20.4 3.6 9.2z"/><path ${S} d="M3.6 9.2h16.8M7.4 4.4l4.6 15.8L16.6 4.4" stroke-width="1.3"/>`,
  trophy: `<path ${S} d="M7.4 4.4h9.2v5a4.6 4.6 0 0 1-9.2 0z"/><path ${S} d="M7.4 5.6H4.6a2.9 2.9 0 0 0 3 3.6M16.6 5.6h2.8a2.9 2.9 0 0 1-3 3.6"/><path ${S} d="M12 14v3M8.4 20h7.2M9.8 17h4.4"/>`,
  sparkles: `<path d="M11 4l1.6 3.9L16.5 9.5l-3.9 1.6L11 15l-1.6-3.9L5.5 9.5l3.9-1.6z" fill="currentColor" stroke="none"/><path d="M18 14.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="currentColor" stroke="none"/>`,
  home: `<path ${S} d="M4.4 10.8 12 4.2l7.6 6.6"/><path ${S} d="M6.4 9.4V20h11.2V9.4"/>`,
  target: `<circle ${S} cx="12" cy="12" r="8.4"/><circle ${S} cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>`,
  trend: `<path ${S} d="M3.6 17.4l5.6-5.6 3.6 3.6 6.8-7.6"/><path ${S} d="M15.6 7.8h4.4v4.4"/>`,
  spade: `<path d="M12 3.2c3.4 3.6 6.4 5.6 6.4 8.6a3.6 3.6 0 0 1-5.2 3.2c-.4-1.2-1-2.2-2-2.9l.9 3.1H8.9l.9-3.1c-1 .7-1.6 1.7-2 2.9a3.6 3.6 0 0 1-5.2-3.2c0-3 3-5 6.4-8.6z" fill="currentColor" stroke="none"/>`,
  heart: `<path d="M12 20.2C7.2 16.6 4 13.6 4 10.2 4 7.9 5.8 6 8.1 6c1.5 0 2.9.8 3.9 2.1C13 6.8 14.4 6 15.9 6 18.2 6 20 7.9 20 10.2c0 3.4-3.2 6.4-8 10z" fill="currentColor" stroke="none"/>`,
  diamond: `<path d="M12 3.6 18.6 12 12 20.4 5.4 12z" fill="currentColor" stroke="none"/>`,
  club: `<circle cx="12" cy="7.6" r="3.4" fill="currentColor" stroke="none"/><circle cx="8.2" cy="13" r="3.4" fill="currentColor" stroke="none"/><circle cx="15.8" cy="13" r="3.4" fill="currentColor" stroke="none"/><path d="M10.9 14.5h2.2l.8 5h-3.8z" fill="currentColor" stroke="none"/>`,
  sound: `<path d="M4 9.6v4.8h3.2L12 18V6L7.2 9.6z" fill="currentColor" stroke="none"/><path ${S} d="M15.2 9.4a4.2 4.2 0 0 1 0 5.2"/>`,
  logout: `<path ${S} d="M14.4 4H6.8A1.8 1.8 0 0 0 5 5.8v12.4A1.8 1.8 0 0 0 6.8 20h7.6"/><path ${S} d="M10.4 12h9.2M16.4 8.8 19.6 12l-3.2 3.2"/>`,
  'chev-down': `<path ${S} d="M6.4 9.6 12 15.2l5.6-5.6"/>`,
  coins: `<ellipse ${S} cx="12" cy="6.4" rx="6.4" ry="2.7"/><path ${S} d="M5.6 6.4v5.2c0 1.5 2.9 2.7 6.4 2.7s6.4-1.2 6.4-2.7V6.4"/><path ${S} d="M5.6 11.6v5.2c0 1.5 2.9 2.7 6.4 2.7s6.4-1.2 6.4-2.7v-5.2"/>`,
};

/** Возвращает SVG-строку иконки по имени. */
export function icon(name, size = 24) {
  const inner = ICONS[name] || ICONS.info;
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
}
