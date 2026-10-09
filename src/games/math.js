/* Чистая математика игр: RTP, коэффициенты, оценка исходов.
   Модуль без DOM-зависимостей — покрывается scripts/selftest.mjs. */

export function comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/* ================= Слоты ================= */

export const SLOT_SYMBOLS = [
  { id: 'seven', name: 'Семёрка', pay: 150, weight: 1, color: '#f5c542' },
  { id: 'diamond', name: 'Алмаз', pay: 50, weight: 2, color: '#7dd3fc' },
  { id: 'bell', name: 'Колокол', pay: 30, weight: 2, color: '#f7d774' },
  { id: 'star', name: 'Звезда', pay: 20, weight: 3, color: '#a78bfa' },
  { id: 'cherry', name: 'Вишня', pay: 13, weight: 5, color: '#f87171' },
  { id: 'bar', name: 'Бар', pay: 8, weight: 7, color: '#c9c2d8' },
];
export const SLOT_PAY_TWO = 0.5; // два одинаковых символа на линии
export const SLOT_STRIP_LEN = 20;

/** Барабан: 20 позиций, веса символов заданы так, чтобы RTP ≈ 96%. */
export function buildStrip() {
  const strip = [];
  for (let s = 0; s < SLOT_SYMBOLS.length; s++) {
    for (let i = 0; i < SLOT_SYMBOLS[s].weight; i++) strip.push(s);
  }
  return strip;
}

/** Множитель выигрыша для трёх символов средней линии (в ставках). */
export function evaluateSlotsLine(idxs) {
  const [a, b, c] = idxs;
  if (a === b && b === c) return SLOT_SYMBOLS[a].pay;
  if (a === b || b === c || a === c) return SLOT_PAY_TWO;
  return 0;
}

/** Теоретический RTP при равномерном положении барабанов. */
export function slotsRTP(strip = buildStrip()) {
  const L = strip.length;
  let sum = 0;
  for (let i = 0; i < L; i++)
    for (let j = 0; j < L; j++)
      for (let k = 0; k < L; k++) sum += evaluateSlotsLine([strip[i], strip[j], strip[k]]);
  return sum / L ** 3;
}

/* ================= Монетка ================= */

export const COIN_PAYOUT = 1.95; // RTP 97.5%
export const COIN_RTP = COIN_PAYOUT / 2;

/* ================= Кости ================= */

export const DICE_PAYOUTS = { less: 2.3, seven: 5.7, more: 2.3 };

export function diceOutcome(d1, d2) {
  const sum = d1 + d2;
  if (sum < 7) return 'less';
  if (sum > 7) return 'more';
  return 'seven';
}

/** RTP для ставок «меньше/больше 7» (15/36 шанс, ×2.3). */
export function diceRTP() {
  return (15 / 36) * DICE_PAYOUTS.less;
}

/* ================= Рулетка (европейская) ================= */

export const ROULETTE_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20,
  14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const ROULETTE_REDS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function rouletteColor(n) {
  if (n === 0) return 'green';
  return ROULETTE_REDS.has(n) ? 'red' : 'black';
}

export const ROULETTE_PAY_NUMBER = 36; // выплата с возвратом ставки (35:1)
export const ROULETTE_PAY_EVEN = 2; // выплата с возвратом ставки (1:1)

export function rouletteBetWins(betKey, number) {
  if (betKey.startsWith('n')) return Number(betKey.slice(1)) === number;
  const color = rouletteColor(number);
  switch (betKey) {
    case 'red':
      return color === 'red';
    case 'black':
      return color === 'black';
    case 'even':
      return number !== 0 && number % 2 === 0;
    case 'odd':
      return number % 2 === 1;
    case 'low':
      return number >= 1 && number <= 18;
    case 'high':
      return number >= 19 && number <= 36;
    case 'd12':
      return number >= 1 && number <= 12;
    case 'd24':
      return number >= 13 && number <= 24;
    case 'd36':
      return number >= 25 && number <= 36;
    case 'col1':
      return number !== 0 && number % 3 === 1;
    case 'col2':
      return number !== 0 && number % 3 === 2;
    case 'col3':
      return number !== 0 && number % 3 === 0;
    default:
      return false;
  }
}

export const ROULETTE_PAY_OUTSIDE3 = 3; // 2:1 (дюжины и колонки) с возвратом ставки

export function rouletteBetPays(betKey) {
  if (betKey.startsWith('n')) return ROULETTE_PAY_NUMBER;
  if (betKey.startsWith('d') || betKey.startsWith('col')) return ROULETTE_PAY_OUTSIDE3;
  return ROULETTE_PAY_EVEN;
}

export function rouletteRTP() {
  return 36 / 37; // 97.3%
}

/* ================= Блэкджек ================= */

export function handValue(cards) {
  let sum = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') {
      aces += 1;
      sum += 11;
    } else if ('KQJ'.includes(c.rank)) sum += 10;
    else sum += Number(c.rank);
  }
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces -= 1;
  }
  return sum;
}

export const BJ_PAYOUT_WIN = 2; // 1:1 с возвратом ставки
export const BJ_PAYOUT_BLACKJACK = 2.5; // 3:2 с возвратом ставки
export const BJ_PAYOUT_PUSH = 1; // возврат ставки
export const BJ_DEALER_STAND = 17;

/* ================= Краш ================= */

export const CRASH_EDGE = 0.03; // 3% мгновенных крашей → RTP 97%
export const CRASH_GROWTH = 0.058; // m(t) = e^(growth·t), t в секундах
export const CRASH_MAX = 1000;

/** Точка краша: P(crash > x) = (1-edge)/x → RTP = 1-edge при выводе на x. */
export function crashPoint(rand = Math.random) {
  const u = rand();
  if (u < CRASH_EDGE) return 1;
  const m = (1 - CRASH_EDGE) / (1 - u);
  return Math.min(CRASH_MAX, Math.max(1, m));
}

export function crashMultiplierAt(tSec) {
  return Math.exp(CRASH_GROWTH * tSec);
}

/** Множитель, который реально засчитывается (округление вниз до 2 знаков). */
export function crashDisplay(m) {
  return Math.floor(m * 100) / 100;
}

/* ================= Сапёр ================= */

export const MINES_EDGE = 0.99; // множитель края банка на каждый открытый шаг
export const MINES_GRID = 25;

/** Множитель при cashout после `revealed` безопасных клеток.
   revealed клампится в допустимый диапазон [0, 25 − mines]. */
export function minesMultiplier(mines, revealed) {
  const maxSafe = Math.max(0, MINES_GRID - mines);
  const k = Math.max(0, Math.min(maxSafe, Math.floor(revealed)));
  let m = 1;
  for (let i = 1; i <= k; i++) {
    m *= ((MINES_GRID + 1 - i) / (MINES_GRID + 1 - i - mines)) * MINES_EDGE;
  }
  return m;
}

export function minesMaxMultiplier(mines) {
  return minesMultiplier(mines, MINES_GRID - mines);
}

/* ================= Плинко ================= */

export const PLINKO_ROWS = 16;
export const PLINKO_BINS = PLINKO_ROWS + 1;
export const PLINKO_MULTIPLIERS = [
  500, 100, 25, 7, 2.5, 1.3, 0.7, 0.4, 0.5, 0.4, 0.7, 1.3, 2.5, 7, 25, 100, 500,
];
export const PLINKO_EDGE = 0.97; // домножается на выигрыш

export function plinkoBinProbs(rows = PLINKO_ROWS) {
  const n = 2 ** rows;
  const probs = [];
  for (let i = 0; i <= rows; i++) probs.push(comb(rows, i) / n);
  return probs;
}

export function plinkoRTP(mults = PLINKO_MULTIPLIERS, rows = PLINKO_ROWS, edge = PLINKO_EDGE) {
  const probs = plinkoBinProbs(rows);
  let sum = 0;
  for (let i = 0; i <= rows; i++) sum += probs[i] * mults[i];
  return sum * edge;
}

/** Путь шарика: массив направлений (0 влево, 1 вправо); сумма = номер корзины. */
export function plinkoPath(rows = PLINKO_ROWS, rand = Math.random) {
  const path = [];
  for (let i = 0; i < rows; i++) path.push(rand() < 0.5 ? 0 : 1);
  return path;
}
