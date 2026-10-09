/* Реестр игр: метаданные + фабрика. Каждый модуль игры — отдельный файл. */

import { slotsRTP, plinkoRTP, diceRTP, rouletteRTP, COIN_RTP } from './math.js';

const pct = (x) => `${(x * 100).toFixed(1)}%`;

export const GAMES = [
  {
    id: 'slots',
    name: 'Слоты',
    tag: 'Три барабана классики',
    icon: 'chip',
    color: '#f5c542',
    rtp: pct(slotsRTP()),
    min: 10,
    max: 5000,
    playLabel: 'Крутить',
  },
  {
    id: 'coinflip',
    name: 'Монетка',
    tag: 'Орёл или решка',
    icon: 'coin',
    color: '#a78bfa',
    rtp: pct(COIN_RTP),
    min: 10,
    max: 5000,
    playLabel: 'Бросить',
  },
  {
    id: 'dice',
    name: 'Кости',
    tag: 'Сумма двух костей',
    icon: 'dice',
    color: '#7dd3fc',
    rtp: pct(diceRTP()),
    min: 10,
    max: 5000,
    playLabel: 'Бросить',
  },
  {
    id: 'roulette',
    name: 'Рулетка',
    tag: 'Европейская, 37 карманов',
    icon: 'wheel',
    color: '#f87171',
    rtp: pct(rouletteRTP()),
    min: 10,
    max: 5000,
    playLabel: 'Крутить',
  },
  {
    id: 'blackjack',
    name: 'Блэкджек',
    tag: 'Обыграй дилера',
    icon: 'cards',
    color: '#3ecf8e',
    rtp: '≈99%',
    min: 25,
    max: 5000,
    playLabel: 'Раздать',
  },
  {
    id: 'crash',
    name: 'Краш',
    tag: 'Забери до взлёта',
    icon: 'rocket',
    color: '#f5c542',
    rtp: '97%',
    min: 10,
    max: 5000,
    playLabel: 'Старт',
  },
  {
    id: 'mines',
    name: 'Сапёр',
    tag: 'Рискни и забери',
    icon: 'bomb',
    color: '#8b5cf6',
    rtp: '99%',
    min: 10,
    max: 5000,
    playLabel: 'Играть',
  },
  {
    id: 'plinko',
    name: 'Плинко',
    tag: 'Шар сквозь препятствия',
    icon: 'plinko',
    color: '#3ecf8e',
    rtp: pct(plinkoRTP()),
    min: 10,
    max: 5000,
    playLabel: 'Бросить шар',
  },
];

const factories = {
  slots: () => import('./slots.js'),
  coinflip: () => import('./coinflip.js'),
  dice: () => import('./dice.js'),
  roulette: () => import('./roulette.js'),
  blackjack: () => import('./blackjack.js'),
  crash: () => import('./crash.js'),
  mines: () => import('./mines.js'),
  plinko: () => import('./plinko.js'),
};

export function getGameMeta(id) {
  return GAMES.find((g) => g.id === id) || null;
}

/** Ленивая загрузка модуля игры и создание экземпляра. */
export async function createGame(id, hooks) {
  const meta = getGameMeta(id);
  if (!meta) return null;
  const loader = factories[id];
  if (!loader) return null;
  const mod = await loader();
  return mod.create(hooks);
}
