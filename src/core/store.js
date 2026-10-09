/* Хранилище состояния: баланс, статистика, история, промокоды, настройки.
   Всё в localStorage (ключ luni-royal:v1). Баланс никогда не уходит в минус:
   списания идут только через placeBet/withdraw с проверкой. */

import { findPromo, normalizeCode } from './promos.js';

const KEY = 'luni-royal:v1';

export const START_BALANCE = 1000;
export const OPS_LIMIT = 100; // сколько операций держим в общей ленте
export const HISTORY_LIMIT = 40; // сколько раундов на игру

function defaults() {
  return {
    balance: START_BALANCE,
    stats: {
      rounds: 0,
      wins: 0,
      losses: 0,
      wagered: 0,
      paidOut: 0,
      biggestWin: 0,
    },
    ops: [], // {ts, type: 'bet'|'promo', game, label, bet, payout, profit}
    history: {}, // gameId -> [{ts, bet, payout, profit, detail}]
    usedPromos: [], // [{code, amount, ts}]
    prevBets: {}, // gameId -> ставка прошлого раунда
    settings: { sound: true },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw);
    return { ...defaults(), ...data, stats: { ...defaults().stats, ...(data.stats || {}) }, settings: { ...defaults().settings, ...(data.settings || {}) } };
  } catch {
    return defaults();
  }
}

let state = load();
const listeners = new Set();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* приватный режим и т.п. — работаем в памяти */
  }
}

function emit(type, payload) {
  for (const fn of [...listeners]) {
    try {
      fn(type, payload);
    } catch (e) {
      console.error('store listener error', e);
    }
  }
}

export const store = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  get raw() {
    return state;
  },

  balance() {
    return state.balance;
  },

  stats() {
    return { ...state.stats };
  },

  sound() {
    return !!state.settings.sound;
  },

  setSound(on) {
    state.settings.sound = !!on;
    save();
    emit('settings', { sound: state.settings.sound });
  },

  /** Списание ставки. Возвращает false, если сумма некорректна или не хватает баланса. */
  placeBet(gameId, amount) {
    const bet = Math.floor(Number(amount));
    if (!Number.isFinite(bet) || bet <= 0) return false;
    if (bet > state.balance) return false; // баланс не уходим в минус
    const from = state.balance;
    state.balance -= bet;
    save();
    emit('balance', { from, to: state.balance });
    return true;
  },

  /** Зачисление выплаты + обновление статистики/истории. */
  resolveRound(gameId, bet, payout, detail) {
    const from = state.balance;
    state.balance += payout;
    state.stats.rounds += 1;
    state.stats.wagered += bet;
    state.stats.paidOut += payout;
    const profit = payout - bet;
    if (payout > 0) state.stats.wins += 1;
    else state.stats.losses += 1;
    if (payout > state.stats.biggestWin) state.stats.biggestWin = payout;
    state.prevBets[gameId] = bet;

    const entry = { ts: Date.now(), bet, payout, profit, detail };
    const h = (state.history[gameId] ||= []);
    h.unshift(entry);
    if (h.length > HISTORY_LIMIT) h.length = HISTORY_LIMIT;

    state.ops.unshift({
      ts: entry.ts,
      type: 'bet',
      game: gameId,
      bet,
      payout,
      profit,
      detail,
    });
    if (state.ops.length > OPS_LIMIT) state.ops.length = OPS_LIMIT;

    save();
    emit('balance', { from, to: state.balance });
    emit('round', { gameId, entry });
    emit('stats', state.stats);
    return entry;
  },

  /** Активация промокода. Одноразовые: повторно использовать нельзя. */
  redeem(code) {
    const c = normalizeCode(code);
    if (!c) return { ok: false, reason: 'empty' };
    const promo = findPromo(c);
    if (!promo) return { ok: false, reason: 'invalid' };
    if (state.usedPromos.some((p) => p.code === promo.code)) {
      return { ok: false, reason: 'used', promo };
    }
    const from = state.balance;
    state.balance += promo.amount;
    state.usedPromos.unshift({ code: promo.code, amount: promo.amount, ts: Date.now() });
    state.ops.unshift({
      ts: Date.now(),
      type: 'promo',
      code: promo.code,
      payout: promo.amount,
      profit: promo.amount,
    });
    if (state.ops.length > OPS_LIMIT) state.ops.length = OPS_LIMIT;
    save();
    emit('balance', { from, to: state.balance });
    emit('promo', { code: promo.code, amount: promo.amount });
    return { ok: true, promo };
  },

  usedPromos() {
    return [...state.usedPromos];
  },

  history(gameId) {
    return [...(state.history[gameId] || [])];
  },

  ops() {
    return [...state.ops];
  },

  /** Все раунды всех игр, свежие сверху (для ленты в лобби). */
  recentAll(limit = 8) {
    const all = [];
    for (const [gameId, arr] of Object.entries(state.history)) {
      for (const e of arr) all.push({ ...e, game: gameId });
    }
    all.sort((a, b) => b.ts - a.ts);
    return all.slice(0, limit);
  },

  prevBet(gameId) {
    return state.prevBets[gameId] || 0;
  },

  /** Полный сброс прогресса (для демо). */
  reset() {
    const from = state.balance;
    state = defaults();
    save();
    emit('balance', { from, to: state.balance });
    emit('reset', {});
  },
};
