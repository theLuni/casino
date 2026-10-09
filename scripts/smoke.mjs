/* Интеграционный smoke-тест: поднимает всё приложение в jsdom,
   кликает по интерфейсу, играет во все 8 игр, проверяет баланс/промокоды/историю.
   Запуск: npm run smoke */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'scripts', '.smoke');
fs.mkdirSync(outDir, { recursive: true });

/* ---------- Собираем приложение в один classic-скрипт (jsdom не умеет ES-модули) ---------- */
const bundle = path.join(outDir, 'app.iife.js');
execFileSync(
  path.join(root, 'node_modules', '.bin', 'esbuild'),
  [
    path.join(root, 'src', 'main.js'),
    '--bundle',
    '--format=iife',
    `--outfile=${bundle}`,
    '--loader:.css=empty',
    '--log-level=error',
  ],
  { stdio: 'inherit' }
);
const bundleSrc = fs.readFileSync(bundle, 'utf8');

/* ---------- Stubs для браузерного API, которого нет в jsdom ---------- */
const stubs = `
  window.__errors = [];
  window.addEventListener('error', (e) => window.__errors.push('uncaught: ' + (e.error && e.error.stack || e.message)));
  (function () {
    const origError = console.error;
    console.error = function (...a) { window.__errors.push('console.error: ' + a.map(String).join(' ')); origError.apply(console, a); };
  })();
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.Element.prototype.scrollIntoView = function () {};
  // прокси для 2D-контекста: любой метод/цепочка возвращает «пустышку», но не падает
  const ctxProxy = (function make() {
    const f = function () { return ctxProxy; };
    return new Proxy(f, {
      get(t, k) {
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === 'measureText') return () => ({ width: 10 });
        if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop() {} });
        if (k === 'getImageData') return () => ({ data: [] });
        return ctxProxy;
      },
      set() { return true; },
      apply() { return ctxProxy; },
    });
  })();
  window.HTMLCanvasElement.prototype.getContext = function () { return ctxProxy; };
  window.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
    resume() {}
    createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }, connect() {} }; }
    createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len || 16) }; }
    createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect() {} }; }
  };
`;

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>smoke</title></head>
<body>
  <canvas id="bgfx"></canvas>
  <div id="app"></div>
  <script>${stubs}</script>
  <script>${bundleSrc}</script>
</body></html>`;

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    if (!window.crypto?.getRandomValues) {
      Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
    }
  },
});

const { window } = dom;
const { document } = window;

/* ---------- Утилиты ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeout = 8000, step = 40) {
  const t0 = Date.now();
  for (;;) {
    try {
      const v = fn();
      if (v) return v;
    } catch {}
    if (Date.now() - t0 > timeout) throw new Error('waitFor: таймаут');
    await sleep(step);
  }
}
const store = () =>
  JSON.parse(
    window.localStorage.getItem('luni-royal:v1') ||
      '{"balance":1000,"stats":{"rounds":0,"wins":0,"losses":0,"wagered":0,"paidOut":0,"biggestWin":0},"history":{},"usedPromos":[],"ops":[]}'
  );
const balance = () => store().balance;

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  ok  ${name}${extra ? ` — ${extra}` : ''}`);
  else {
    failures += 1;
    console.error(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`);
  }
}
function setBet(v) {
  const input = document.querySelector('.bet-input');
  input.value = String(v);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function play() {
  document.querySelector('.bet-panel .play-btn').click();
}
async function openGame(id) {
  window.location.hash = `#/game/${id}`;
  await waitFor(() => document.querySelector('.game-stage canvas'));
  await waitFor(() => document.querySelector('.bet-panel .play-btn'));
  await sleep(120); // дождаться async-загрузки модуля игры
}
async function playAndWait(id, bet) {
  setBet(bet);
  const before = balance();
  play();
  await sleep(250);
  const afterBet = balance();
  check(`${id}: ставка списана`, afterBet === before - bet, `${before} → ${afterBet}`);
  await waitFor(() => (store().history[id] || []).length >= 1, 15000);
  const h = store().history[id][0];
  check(`${id}: раунд завершён и записан`, !!h, `выплата ${h.payout}, профит ${h.profit}`);
  return h;
}

/* ---------- Сценарий ---------- */
console.log('== лобби ==');
await waitFor(() => document.querySelectorAll('.game-card').length === 8, 5000);
check('8 карточек игр', document.querySelectorAll('.game-card').length === 8);
check('баланс стартовый 1000', balance() === 1000, String(balance()));
check('хедер с балансом отрисован', !!document.querySelector('.balance-value'));

console.log('== слоты ==');
await openGame('slots');
await playAndWait('slots', 50);

console.log('== монетка ==');
await openGame('coinflip');
await playAndWait('coinflip', 10);

console.log('== кости ==');
await openGame('dice');
// выбираем «ровно 7»
const segBtns = [...document.querySelectorAll('.game-controls .seg button')];
segBtns.find((b) => b.textContent.includes('Ровно 7'))?.click();
await playAndWait('dice', 10);

console.log('== рулетка ==');
await openGame('roulette');
await waitFor(() => document.querySelector('.rb-cell'));
setBet(25); // фишка = 25
// ставим фишку на число 17 и на красное → всего 50
document.querySelector('.rb-cell[data-key="n17"]').click();
document.querySelector('.rb-cell[data-key="red"]').click();
{
  const before = balance();
  play();
  await sleep(250);
  check('рулетка: списана общая сумма ставок', balance() === before - 50, `${before} → ${balance()}`);
  await waitFor(() => (store().history.roulette || []).length >= 1, 15000);
  const h = store().history.roulette[0];
  check('рулетка: раунд завершён', !!h, `деталь: ${h.detail}`);
  check('рулетка: ставки очищены после раунда', !document.querySelector('.rb-cell.selected'));
}

console.log('== блэкджек ==');
await openGame('blackjack');
setBet(25);
play();
await sleep(400);
// ждём либо ход игрока (кнопка «Стоять»), либо мгновенный конец (натурал 21 у кого-то из соперников)
await waitFor(() => {
  if ((store().history.blackjack || []).length >= 1) return true;
  const stand = [...document.querySelectorAll('.game-controls .seg button')].find((b) => b.textContent.includes('Стоять'));
  return stand && !stand.disabled ? stand : null;
}, 8000);
if (!(store().history.blackjack || []).length) {
  // ход игрока — стоим
  [...document.querySelectorAll('.game-controls .seg button')].find((b) => b.textContent.includes('Стоять')).click();
}
await waitFor(() => (store().history.blackjack || []).length >= 1, 15000);
check('блэкджек: раунд завершён', !!store().history.blackjack[0], `деталь: ${store().history.blackjack[0].detail}`);

console.log('== краш ==');
await openGame('crash');
setBet(10);
play();
// действие «Забрать» выставляется синхронно в game.start — кликаем сразу, пока раунд жив
{
  const btn = document.querySelector('.bet-panel .play-btn');
  check('краш: кнопка «Забрать» активна сразу после старта', !!btn && !btn.disabled && btn.textContent.includes('Забрать'), btn?.textContent);
  btn.click();
}
await waitFor(() => (store().history.crash || []).length >= 1, 10000);
{
  const h = store().history.crash[0];
  check('краш: cashout сыгран', h.detail.includes('забрано') && h.payout >= 10, `деталь: ${h.detail}, выплата ${h.payout}`);
}

console.log('== сапёр ==');
await openGame('mines');
// 3 мины по умолчанию
setBet(10);
const minesHistLen = () => (store().history.mines || []).length;
check('сапёр: 25 клеток', document.querySelectorAll('.mine-tile').length === 25);

// --- раунд 1: одна клетка, затем cashout (или мина с первой клетки) ---
play();
await sleep(300);
{
  const before = minesHistLen();
  [...document.querySelectorAll('.mine-tile')][0].click();
  await sleep(200);
  const cashBtn = [...document.querySelectorAll('.game-controls .btn-success')].find((b) => b.textContent.includes('Забрать'));
  if (cashBtn && !cashBtn.disabled) {
    cashBtn.click(); // забираем при первом же безопасном открытии
    await waitFor(() => minesHistLen() > before, 8000);
    const h = store().history.mines[0];
    check('сапёр: cashout сыгран', h.payout > 0, `деталь: ${h.detail}`);
  } else {
    await waitFor(() => minesHistLen() > before, 8000);
    check('сапёр: мина с первой клетки', store().history.mines[0].payout === 0, `деталь: ${store().history.mines[0].detail}`);
  }
}

// --- раунд 2: кликаем клетки подряд, пока не рванёт (детерминированно ловим ветку подрыва) ---
{
  let boom = null;
  let minesShown = 0;
  for (let attempt = 0; attempt < 3 && !boom; attempt++) {
    const before = minesHistLen();
    play();
    await sleep(250);
    const ts = [...document.querySelectorAll('.mine-tile')];
    for (const t of ts) {
      if (minesHistLen() > before) break; // раунд уже окончен
      if (t.disabled) continue;
      t.click();
      await sleep(50);
      const shown = document.querySelectorAll('.mine-tile.mine').length;
      if (shown > 0) { minesShown = shown; break; } // подрыв: все мины раскрыты синхронно
    }
    await waitFor(() => minesHistLen() > before, 8000);
    const h = store().history.mines[0];
    if (h.payout === 0 && h.detail.includes('мина на клетке')) boom = h;
  }
  check('сапёр: подрыв раскрыл все 3 мины и завершился без ошибок', !!boom && minesShown === 3, `деталь: ${boom ? boom.detail : '—'}, раскрыто мин: ${minesShown}`);
}

console.log('== плинко ==');
await openGame('plinko');
await playAndWait('plinko', 10);

console.log('== пополнение ==');
window.location.hash = '#/topup';
await waitFor(() => document.querySelector('.promo-input'));
{
  const before = balance();
  const input = document.querySelector('.promo-input');
  input.value = 'welcome'; // намеренно в нижнем регистре
  document.querySelector('.redeem-box .btn-gold').click();
  await sleep(250);
  check('промокод WELCOME активирован (+500)', balance() === before + 500, `${before} → ${balance()}`);
  check('промокод записан в использованные', store().usedPromos.some((p) => p.code === 'WELCOME'));
  // повторная активация запрещена
  input.value = 'WELCOME';
  document.querySelector('.redeem-box .btn-gold').click();
  await sleep(250);
  check('повторный ввод промокода отклонён', balance() === before + 500, String(balance()));
  // неверный код
  input.value = 'BADCODE';
  document.querySelector('.redeem-box .btn-gold').click();
  await sleep(250);
  check('неверный промокод отклонён', balance() === before + 500, String(balance()));
}

console.log('== профиль ==');
window.location.hash = '#/profile';
await waitFor(() => document.querySelector('.ops-table'));
check('профиль: таблица операций отрисована', document.querySelectorAll('.ops-table tbody tr, .ops-table tr').length > 1);
check('профиль: статистика отрисована', document.querySelectorAll('.stat-card').length === 6);
check('профиль: промокоды показаны', document.querySelectorAll('.promo-card').length >= 1);

console.log('== баланс не ушёл в минус и нет ошибок ==');
check('баланс ≥ 0', balance() >= 0, String(balance()));
check('раундов сыграно ≥ 8', store().stats.rounds >= 8, String(store().stats.rounds));
const appErrors = window.__errors.filter((e) => !e.includes('Not implemented'));
check('нет ошибок в консоли', appErrors.length === 0, appErrors.slice(0, 3).join(' | '));

console.log('');
if (failures) {
  console.error(`Smoke-тест провален: ${failures} проверок.`);
  process.exit(1);
} else {
  console.log('Все smoke-проверки прошли.');
}
process.exit(0);
