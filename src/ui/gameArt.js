/* Мини-сцены для карточек игр в лобби (SVG + CSS-анимации по hover).
   Уникальные префиксы id обязательны: все SVG живут в одном документе. */

import { TAU } from '../core/util.js';

const GOLD = '#f5c542';
const GOLD2 = '#c9951f';
const VIOLET = '#a78bfa';
const ICE = '#7dd3fc';
const RED = '#f87171';
const GREEN = '#3ecf8e';
const CREAM = '#f4efe6';
const DIM = '#7d7295';

function defs(id, stops, extra = '') {
  const ss = stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('');
  return `<defs>${extra}<radialGradient id="${id}" cx="35%" cy="30%" r="80%">${ss}</radialGradient></defs>`;
}

const goldCoin = (id) => defs(id, [[0, '#ffe9a8'], [0.5, GOLD], [1, GOLD2]]);
const glass = (id) => defs(id, [[0, 'rgba(255,255,255,0.14)'], [1, 'rgba(255,255,255,0.02)']]);

/* ---------- Слоты: три барабана ---------- */
function artSlots() {
  const sym = (x, y, kind) => {
    if (kind === 'seven')
      return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Playfair Display,serif" font-weight="900" font-size="26" fill="${GOLD}" stroke="#7a5a10" stroke-width="0.8">7</text>`;
    if (kind === 'diamond')
      return `<path d="M${x} ${y - 11} L${x + 9} ${y} L${x} ${y + 11} L${x - 9} ${y} Z" fill="${ICE}" stroke="#2b6d8f" stroke-width="1"/>`;
    if (kind === 'star')
      return `<path d="M${x} ${y - 12} l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill="${VIOLET}"/>`;
    return '';
  };
  const reel = (x, symbols) => {
    const inner = symbols.concat(symbols).map((s, i) => sym(x + 22, 38 + i * 30 + 8, s)).join('');
    return `
      <clipPath id="sl-r${x}"><rect x="${x}" y="22" width="44" height="86" rx="9"/></clipPath>
      <rect x="${x}" y="22" width="44" height="86" rx="9" fill="#171021" stroke="rgba(245,197,66,0.35)"/>
      <g clip-path="url(#sl-r${x})"><g class="a-reel">${inner}</g></g>
      <rect x="${x}" y="22" width="44" height="86" rx="9" fill="url(#sl-gl)"/>
      <rect x="${x}" y="60" width="44" height="3" fill="${GOLD}" opacity="0.9"/>
      <rect x="${x}" y="61.5" width="44" height="1" fill="#fff" opacity="0.5"/>`;
  };
  return `<svg viewBox="0 0 220 130" aria-hidden="true">
    ${defs('sl-g', [[0, '#2a1c40'], [1, '#140d20']])}
    ${glass('sl-gl')}
    <rect x="14" y="10" width="192" height="110" rx="14" fill="url(#sl-g)" stroke="rgba(245,197,66,0.2)"/>
    <g class="art-float">
      ${reel(28, ['seven', 'diamond', 'star'])}
      ${reel(88, ['star', 'seven', 'diamond'])}
      ${reel(148, ['diamond', 'star', 'seven'])}
    </g>
  </svg>`;
}

/* ---------- Монетка ---------- */
function artCoin() {
  return `<svg viewBox="0 0 220 130" aria-hidden="true">
    ${goldCoin('cf-c1')}
    ${goldCoin('cf-c2')}
    <g class="art-float">
      <g class="a-spin">
        <circle cx="110" cy="65" r="40" fill="url(#cf-c1)" stroke="#8a6410" stroke-width="2.5"/>
        <circle cx="110" cy="65" r="31" fill="none" stroke="#9a7212" stroke-width="1.6"/>
        <path d="M110 47 l4.5 10 11 1.5-8 8 2 11-9.5-5-9.5 5 2-11-8-8 11-1.5z" fill="#9a7212"/>
        <ellipse cx="96" cy="50" rx="12" ry="6" fill="rgba(255,255,255,0.4)" transform="rotate(-30 96 50)"/>
      </g>
      <circle cx="163" cy="88" r="17" fill="url(#cf-c2)" stroke="#8a6410" stroke-width="1.5" opacity="0.85"/>
      <circle cx="57" cy="42" r="11" fill="url(#cf-c2)" stroke="#8a6410" stroke-width="1.2" opacity="0.6"/>
    </g>
  </svg>`;
}

/* ---------- Кости ---------- */
function artDice() {
  const pip = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#241a30"/>`;
  const die = (x, y, rot, pips, cls, delay) => `
    <g class="${cls}" style="animation-delay:${delay}s">
      <g transform="rotate(${rot} ${x + 26} ${y + 26})">
        <rect x="${x}" y="${y}" width="52" height="52" rx="12" fill="#f4efe6" stroke="rgba(120,100,60,0.5)"/>
        ${pips}
      </g>
    </g>`;
  return `<svg viewBox="0 0 220 130" aria-hidden="true">
    ${defs('dc-g', [[0, '#2a1c40'], [1, '#140d20']])}
    <rect x="14" y="10" width="192" height="110" rx="14" fill="url(#dc-g)" stroke="rgba(125,211,252,0.25)"/>
    <g class="art-float">
      ${die(52, 39, -10, [pip(66, 53, 4.5), pip(84, 71, 4.5), pip(75, 62, 4.5)].join(''), 'a-wiggle', 0)}
      ${die(112, 39, 12, [pip(126, 53, 4.5), pip(144, 53, 4.5), pip(126, 71, 4.5), pip(144, 71, 4.5)].join(''), 'a-wiggle', 0.15)}
    </g>
  </svg>`;
}

/* ---------- Рулетка ---------- */
function artRoulette() {
  const cx = 110;
  const cy = 65;
  const R = 46;
  let wedges = '';
  const N = 24;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * TAU - Math.PI / 2;
    const a1 = ((i + 1) / N) * TAU - Math.PI / 2;
    const col = i % 2 === 0 ? '#8f2233' : '#171021';
    wedges += `<path d="M${cx} ${cy} L${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A${R} ${R} 0 0 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)} Z" fill="${col}" stroke="rgba(245,197,66,0.35)" stroke-width="0.6"/>`;
  }
  return `<svg viewBox="0 0 220 130" aria-hidden="true">
    ${defs('rl-g', [[0, '#2a1c40'], [1, '#140d20']])}
    <rect x="14" y="10" width="192" height="110" rx="14" fill="url(#rl-g)" stroke="rgba(248,113,113,0.25)"/>
    <g class="art-float">
      <g class="a-rot">
        <circle cx="110" cy="65" r="52" fill="none"/>
        <circle cx="110" cy="65" r="50" fill="#1c1428" stroke="${GOLD}" stroke-width="2"/>
        ${wedges}
        <circle cx="110" cy="65" r="26" fill="#241735" stroke="rgba(245,197,66,0.5)"/>
        <circle cx="110" cy="65" r="9" fill="url(#rl-hub)" stroke="#8a6410"/>
        <circle cx="110" cy="19" r="5.5" fill="#f4efe6" stroke="#999" stroke-width="1"/>
      </g>
    </g>
    ${defs('rl-hub', [[0, '#ffe9a8'], [1, GOLD2]])}
  </svg>`;
}

/* ---------- Блэкджек ---------- */
function suitPath(suit, x, y, s, color) {
  if (suit === 'spades')
    return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -0.46 C0.3 -0.14 0.5 -0.02 0.5 0.16 C0.5 0.32 0.3 0.38 0.12 0.34 C0.1 0.48 0.04 0.58 -0.08 0.64 L0.08 0.64 C-0.04 0.58 -0.1 0.48 -0.12 0.34 C-0.3 0.38 -0.5 0.32 -0.5 0.16 C-0.5 -0.02 -0.3 -0.14 0 -0.46 Z" fill="${color}"/>`;
  if (suit === 'hearts')
    return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0.34 C-0.55 -0.12 -0.52 -0.52 -0.24 -0.52 C-0.05 -0.52 0 -0.38 0 -0.28 C0 -0.38 0.05 -0.52 0.24 -0.52 C0.52 -0.52 0.55 -0.12 0 0.34 Z" fill="${color}"/>`;
  return '';
}

function artBlackjack() {
  const card = (x, y, rot, rank, suit, cls, delay) => {
    const color = suit === 'hearts' ? '#c2334d' : '#1c1526';
    return `<g class="${cls}" style="animation-delay:${delay}s">
      <g transform="rotate(${rot} ${x + 24} ${y + 34})">
        <rect x="${x}" y="${y}" width="48" height="68" rx="7" fill="#f7f2e4" stroke="rgba(120,100,60,0.5)"/>
        <text x="${x + 6}" y="${y + 17}" font-family="Inter,sans-serif" font-weight="700" font-size="13" fill="${color}">${rank}</text>
        ${suitPath(suit, x + 24, y + 40, 16, color)}
      </g></g>`;
  };
  return `<svg viewBox="0 0 220 130" aria-hidden="true">
    ${defs('bj-g', [[0, '#2a1c40'], [1, '#140d20']])}
    ${defs('bj-felt', [[0, '#1d3a2c'], [1, '#0f2419']])}
    <rect x="14" y="10" width="192" height="110" rx="14" fill="url(#bj-felt)" stroke="rgba(62,207,142,0.35)"/>
    <g class="art-float">
      ${card(48, 32, -14, 'A', 'spades', 'a-wiggle', 0)}
      ${card(86, 26, 0, 'K', 'hearts', 'a-wiggle', 0.12)}
      ${card(124, 32, 14, 'Q', 'spades', 'a-wiggle', 0.24)}
    </g>
  </svg>`;
}

/* ---------- Краш ---------- */
function artCrash() {
  return `<svg viewBox="0 0 220 130" aria-hidden="true">
    ${defs('cr-g', [[0, '#2a1c40'], [1, '#140d20']])}
    <rect x="14" y="10" width="192" height="110" rx="14" fill="url(#cr-g)" stroke="rgba(245,197,66,0.25)"/>
    <g class="art-float">
      <path d="M28 108 C70 104 96 92 122 66 C142 46 158 34 178 26" fill="none" stroke="rgba(245,197,66,0.35)" stroke-width="2" stroke-dasharray="5 6"/>
      <g class="a-bob">
        <g transform="translate(178 26) rotate(-38)">
          <path d="M0 -14 C7 -8 9 0 7 8 L-7 8 C-9 0 -7 -8 0 -14 Z" fill="#e8e2f2" stroke="#9a8fb5" stroke-width="1"/>
          <circle cx="0" cy="-3" r="3.2" fill="${ICE}" stroke="#2b6d8f"/>
          <path d="M-7 8 L-11 15 L-4 12 Z M7 8 L11 15 L4 12 Z" fill="#c9c2d8"/>
          <path class="a-pulse" d="M-3.5 12 C-2 17 2 17 3.5 12 C2 14 -2 14 -3.5 12 Z" fill="#f59e0b"/>
          <path class="a-pulse" style="animation-delay:0.2s" d="M-2 13 C-1 19 1 19 2 13 Z" fill="#ef4444"/>
        </g>
      </g>
      <text x="42" y="52" font-family="Unbounded,sans-serif" font-weight="700" font-size="26" fill="${GOLD}" opacity="0.9">×2.4</text>
    </g>
  </svg>`;
}

/* ---------- Сапёр ---------- */
function artMines() {
  const tile = (x, y, cls, delay, content) => `
    <g class="${cls}" style="animation-delay:${delay}s">
      <rect x="${x}" y="${y}" width="34" height="34" rx="9" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.14)"/>
      ${content}
    </g>`;
  const gem = (x, y) => `<path d="M${x} ${y - 8} L${x + 7} ${y} L${x} ${y + 8} L${x - 7} ${y} Z" fill="${GREEN}" opacity="0.9"/>`;
  const bomb = (x, y) => `<circle cx="${x}" cy="${y + 2}" r="7.5" fill="#3a3a46" stroke="#777"/><rect x="${x - 1.6}" y="${y - 9}" width="3.2" height="4" rx="1" fill="#777"/><path d="M${x + 2} ${y - 9} c3 -3 6 -2 6 1" fill="none" stroke="#f59e0b" stroke-width="1.4"/>`;
  return `<svg viewBox="0 0 220 130" aria-hidden="true">
    ${defs('mn-g', [[0, '#2a1c40'], [1, '#140d20']])}
    <rect x="14" y="10" width="192" height="110" rx="14" fill="url(#mn-g)" stroke="rgba(139,92,246,0.35)"/>
    <g class="art-float">
      ${tile(52, 26, 'a-seq', 0, gem(69, 43))}
      ${tile(94, 26, 'a-seq', 0.18, '')}
      ${tile(136, 26, 'a-seq', 0.36, gem(153, 43))}
      ${tile(52, 68, 'a-seq', 0.54, '')}
      ${tile(94, 68, 'a-seq', 0.72, bomb(111, 85))}
      ${tile(136, 68, 'a-seq', 0.9, gem(153, 85))}
    </g>
  </svg>`;
}

/* ---------- Плинко ---------- */
function artPlinko() {
  let pegs = '';
  const rows = [1, 2, 3, 4];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const x = 110 + (i - (n - 1) / 2) * 34;
      const y = 30 + r * 20;
      pegs += `<circle cx="${x}" cy="${y}" r="2.6" fill="${VIOLET}" opacity="0.85"/>`;
    }
  });
  const bins = [-2, -1, 0, 1, 2].map((i, k) => {
    const x = 110 + (i - 2) * 26 - 12;
    const hot = Math.abs(i) === 2;
    return `<rect x="${x}" y="106" width="24" height="12" rx="3" fill="${hot ? 'rgba(245,197,66,0.25)' : 'rgba(255,255,255,0.06)'}" stroke="${hot ? GOLD : 'rgba(255,255,255,0.15)'}" stroke-width="0.8"/>`;
  }).join('');
  return `<svg viewBox="0 0 220 130" aria-hidden="true">
    ${defs('pl-g', [[0, '#2a1c40'], [1, '#140d20']])}
    <rect x="14" y="10" width="192" height="110" rx="14" fill="url(#pl-g)" stroke="rgba(62,207,142,0.3)"/>
    <g class="art-float">
      ${pegs}
      ${bins}
      <circle class="a-drop" cx="110" cy="18" r="6" fill="${GOLD}" stroke="#8a6410" stroke-width="1.5"/>
    </g>
  </svg>`;
}

export const GAME_ART = {
  slots: artSlots,
  coinflip: artCoin,
  dice: artDice,
  roulette: artRoulette,
  blackjack: artBlackjack,
  crash: artCrash,
  mines: artMines,
  plinko: artPlinko,
};
