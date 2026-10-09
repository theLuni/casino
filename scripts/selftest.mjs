/* Селфтест чистой математики игр (без DOM). Запуск: npm run selftest
   Проверяет RTP, коэффициенты, распределения и инварианты баланса. */

import {
  comb,
  buildStrip,
  evaluateSlotsLine,
  slotsRTP,
  COIN_PAYOUT,
  diceOutcome,
  diceRTP,
  ROULETTE_WHEEL,
  rouletteColor,
  rouletteBetWins,
  rouletteBetPays,
  rouletteRTP,
  handValue,
  crashPoint,
  crashDisplay,
  minesMultiplier,
  PLINKO_ROWS,
  PLINKO_MULTIPLIERS,
  PLINKO_EDGE,
  plinkoRTP,
  plinkoPath,
} from '../src/games/math.js';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ok  ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`);
  }
}
function approx(a, b, eps = 0.02) {
  return Math.abs(a - b) <= eps;
}

console.log('== comb ==');
check('C(25,12) = 5200300', comb(25, 12) === 5200300, String(comb(25, 12)));
check('C(52,5) = 2598960', comb(52, 5) === 2598960, String(comb(52, 5)));
check('C(5,0) = 1', comb(5, 0) === 1);
check('C(5,6) = 0', comb(5, 6) === 0);

console.log('== слоты ==');
{
  const strip = buildStrip();
  check('длина барабана = 20', strip.length === 20);
  const rtp = slotsRTP(strip);
  check('RTP слотов в диапазоне 94–98%', approx(rtp, 0.96, 0.02), `RTP = ${(rtp * 100).toFixed(2)}%`);
  // все тройки одинаковых дают заявленные выплаты
  let ok = true;
  for (let s = 0; s < 6; s++) {
    const m = evaluateSlotsLine([s, s, s]);
    const expected = [150, 50, 30, 20, 13, 8][s];
    if (m !== expected) ok = false;
  }
  check('выплаты 3× соответствуют таблице', ok);
  check('два одинаковых = ×0.5', evaluateSlotsLine([0, 0, 1]) === 0.5);
  check('все разные = 0', evaluateSlotsLine([0, 1, 2]) === 0);
  // моделирование: RTP по Монте-Карло
  // Дисперсия большая (выплата ×150), при N=200k SE ≈ 0.008 — допуск 0.01 был бы ~1.3σ.
  // При N=2M SE ≈ 0.0025, допуск 0.01 = 4σ — проверка не флейит.
  let sum = 0;
  const N = 2000000;
  for (let i = 0; i < N; i++) {
    const a = strip[(Math.random() * 20) | 0];
    const b = strip[(Math.random() * 20) | 0];
    const c = strip[(Math.random() * 20) | 0];
    sum += evaluateSlotsLine([a, b, c]);
  }
  const mc = sum / N;
  check('Монте-Карло RTP сходится с теорией', approx(mc, rtp, 0.01), `MC = ${(mc * 100).toFixed(2)}%`);
}

console.log('== монетка ==');
check('выплата ×1.95', COIN_PAYOUT === 1.95);
check('RTP 97.5%', approx(COIN_PAYOUT / 2, 0.975, 0.001));

console.log('== кости ==');
{
  let counts = { less: 0, seven: 0, more: 0 };
  for (let d1 = 1; d1 <= 6; d1++)
    for (let d2 = 1; d2 <= 6; d2++) counts[diceOutcome(d1, d2)]++;
  check('меньше 7: 15/36', counts.less === 15, String(counts.less));
  check('ровно 7: 6/36', counts.seven === 6, String(counts.seven));
  check('больше 7: 15/36', counts.more === 15, String(counts.more));
  check('RTP костей ≈ 95.8%', approx(diceRTP(), 0.9583, 0.001), `${(diceRTP() * 100).toFixed(2)}%`);
}

console.log('== рулетка ==');
{
  check('на колесе 37 карманов', ROULETTE_WHEEL.length === 37);
  check('все числа 0..36 ровно по разу', new Set(ROULETTE_WHEEL).size === 37);
  check('красных 18', ROULETTE_WHEEL.filter((n) => rouletteColor(n) === 'red').length === 18);
  check('чёрных 18', ROULETTE_WHEEL.filter((n) => rouletteColor(n) === 'black').length === 18);
  check('зеро зелёное', rouletteColor(0) === 'green');
  check('число 32 — красное', rouletteColor(32) === 'red');
  check('число 26 — чёрное', rouletteColor(26) === 'black');
  check('ставка на число выигрывает только на своём числе', rouletteBetWins('n17', 17) && !rouletteBetWins('n17', 18));
  check('красное выигрывает на 1,3,5..', rouletteBetWins('red', 1) && rouletteBetWins('red', 36) && !rouletteBetWins('red', 2));
  check('чёт не выигрывает на 0', !rouletteBetWins('even', 0));
  check('нечет выигрывает на 7', rouletteBetWins('odd', 7));
  check('1–18 выигрывает на 18, не на 19', rouletteBetWins('low', 18) && !rouletteBetWins('low', 19));
  check('19–36 выигрывает на 19, не на 18', rouletteBetWins('high', 19) && !rouletteBetWins('high', 18));
  check('дюжина 13–24 ловит 24, не 25', rouletteBetWins('d24', 24) && !rouletteBetWins('d24', 25));
  check('колонка 1 ловит 1,4,7..34', rouletteBetWins('col1', 34) && !rouletteBetWins('col1', 35));
  check('выплата число ×36', rouletteBetPays('n0') === 36);
  check('выплата чётные ×2', rouletteBetPays('even') === 2);
  check('выплата дюжина ×3', rouletteBetPays('d12') === 3);
  check('выплата колонка ×3', rouletteBetPays('col2') === 3);
  check('RTP 97.3%', approx(rouletteRTP(), 36 / 37, 0.001), `${(rouletteRTP() * 100).toFixed(2)}%`);
  // RTP моделированием по всем ставкам
  let rtpEven = 0;
  for (let n = 0; n <= 36; n++) if (rouletteBetWins('red', n)) rtpEven += rouletteBetPays('red') / 37;
  check('RTP красного = 36/37', approx(rtpEven, 36 / 37, 0.001), `${(rtpEven * 100).toFixed(2)}%`);
}

console.log('== блэкджек ==');
{
  const A = { rank: 'A' };
  const K = { rank: 'K' };
  const T = { rank: '10' };
  check('A+K = 21 (блэкджек)', handValue([A, K]) === 21);
  check('A+A+9 = 21', handValue([A, A, { rank: '9' }]) === 21);
  check('A+6 = 17 (мягкая)', handValue([A, { rank: '6' }]) === 17);
  check('A+6+10 = 17 (туз стал 1)', handValue([A, { rank: '6' }, T]) === 17);
  check('K+Q+J = 30 (перебор)', handValue([K, { rank: 'Q' }, { rank: 'J' }]) === 30);
  check('A+A+A+8 = 21', handValue([A, A, A, { rank: '8' }]) === 21);
}

console.log('== краш ==');
{
  let instant = 0;
  const N = 200000;
  let sumInv = 0;
  let over2 = 0;
  let over10 = 0;
  for (let i = 0; i < N; i++) {
    const c = crashPoint();
    if (c === 1) instant++;
    sumInv += 1 / c;
    if (c > 2) over2++;
    if (c > 10) over10++;
  }
  check('доля мгновенных крашей ≈ 3%', approx(instant / N, 0.03, 0.006), `${((instant / N) * 100).toFixed(2)}%`);
  check('P(crash > 2) ≈ 0.485', approx(over2 / N, 0.485, 0.01), `${((over2 / N) * 100).toFixed(2)}%`);
  check('P(crash > 10) ≈ 0.097', approx(over10 / N, 0.097, 0.008), `${((over10 / N) * 100).toFixed(2)}%`);
  // RTP: при выводе на фиксированный x выигрыш = x с вероятностью P(crash ≥ x) = 0.97/x
  // матожидание = x · 0.97/x = 0.97 для любого x > 1
  // Для больших x дисперсия велика (при ×50 SE ≈ 0.015 при N=200k) — берём N побольше,
  // чтобы допуск 0.03 был ≥ 6 стандартных отклонений и проверка не флейила.
  const NEV = 2000000;
  for (const x of [1.5, 2, 3, 5, 10, 50]) {
    let ge = 0;
    for (let i = 0; i < NEV; i++) if (crashPoint() >= x) ge++;
    const ev = (ge / NEV) * x;
    check(`EV при выводе на ×${x} ≈ 0.97`, approx(ev, 0.97, 0.03), `EV = ${ev.toFixed(4)}`);
  }
  check('crashDisplay округляет вниз', crashDisplay(2.349) === 2.34 && crashDisplay(1.999) === 1.99);
}

console.log('== сапёр ==');
{
  check('1 мина, 1 клетка: ×1.03125', approx(minesMultiplier(1, 1), 0.99 * 25 / 24, 0.001), minesMultiplier(1, 1).toFixed(4));
  check('24 мины, 1 клетка: ×24.75', approx(minesMultiplier(24, 1), 0.99 * 25, 0.001), minesMultiplier(24, 1).toFixed(4));
  // монотонность в пределах допустимого числа открытий (25 − мин)
  let mono = true;
  for (let k = 1; k <= 22; k++) if (minesMultiplier(3, k) <= minesMultiplier(3, k - 1)) mono = false;
  check('множитель растёт с числом открытых клеток', mono);
  // за пределами — кламп, без отрицательных значений
  check('за пределами — конечный положительный множитель', Number.isFinite(minesMultiplier(3, 24)) && minesMultiplier(3, 24) > 0, minesMultiplier(3, 24).toFixed(2));
  // RTP: вероятность пройти k клеток = C(25-m,k)/C(25,k); матожидание выплаты при cashout на k
  // для m=3: матожидание «дойти до k и забрать» — проверим公平ость формулы на k=1:
  // P(первая безопасна) = 22/25; выплата = 25/22*0.99 → матожидание = 0.99
  const p1 = 22 / 25;
  const m1 = minesMultiplier(3, 1);
  check('матожидание шага ×0.99 (края банка 1%)', approx(p1 * m1, 0.99, 0.001), (p1 * m1).toFixed(4));
  // максимум для 3 мин разумен
  const maxM = minesMultiplier(3, 22);
  check('макс. множитель при 3 минах конечен и велик', maxM > 100 && maxM < 100000, maxM.toFixed(1));
}

console.log('== плинко ==');
{
  check('рядов 16, корзин 17', PLINKO_ROWS === 16 && PLINKO_MULTIPLIERS.length === 17);
  const rtp = plinkoRTP();
  check('RTP плинко в диапазоне 95–98%', approx(rtp, 0.97, 0.02), `RTP = ${(rtp * 100).toFixed(2)}%`);
  // моделирование (большая выборка: хвост ×500 даёт дисперсию)
  let sum = 0;
  const N = 2000000;
  for (let i = 0; i < N; i++) {
    const path = plinkoPath(PLINKO_ROWS);
    const bin = path.reduce((a, c) => a + c, 0);
    sum += PLINKO_MULTIPLIERS[bin] * PLINKO_EDGE;
  }
  const mc = sum / N;
  check('Монте-Карло RTP сходится с теорией', approx(mc, rtp, 0.012), `MC = ${(mc * 100).toFixed(2)}%`);
  // симметрия
  check('множители симметричны', PLINKO_MULTIPLIERS[0] === PLINKO_MULTIPLIERS[16] && PLINKO_MULTIPLIERS[3] === PLINKO_MULTIPLIERS[13]);
}

console.log('');
if (failures) {
  console.error(`Селфтест провален: ${failures} проверок не прошло.`);
  process.exit(1);
} else {
  console.log('Все проверки прошли.');
}
