/* Блэкджек: игрок против дилера. Hit / Stand / Double, дилер добирает до 17.
   Выплаты: выигрыш ×2, блэкджек ×2.5, ничья — возврат ставки. */

import { h, ic } from '../core/dom.js';
import { TAU, clamp, cryptoInt, formatMoney, lerp, easeOutCubic, tween } from '../core/util.js';
import {
  drawSceneBg, makeDust, stepDust, drawDust, Particles, neonText, radialGlow,
  drawCard, fillRR, strokeRR, GOLD,
} from './common/art.js';
import { attachCanvas } from './common/canvas.js';
import { handValue, BJ_PAYOUT_WIN, BJ_PAYOUT_BLACKJACK, BJ_PAYOUT_PUSH, BJ_DEALER_STAND } from './math.js';
import { toastError } from '../ui/toast.js';

const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

function newDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  // shuffle (Fisher-Yates, crypto)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = cryptoInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function create(hooks) {
  const { controls, audio } = hooks;
  let cv = null;
  let W = 0;
  let H = 0;

  let state = 'idle'; // idle | dealing | player | dealer | result
  let bet = 0;
  let deck = [];
  let player = [];
  let dealer = [];
  let doubled = false;
  let payout = 0;
  let resultT = 0;
  let resultText = '';
  let resultColor = GOLD;
  let busted = false;

  const particles = new Particles();
  let dust = [];

  /* ---------- Контролы игрока ---------- */
  const bar = h('div', { class: 'seg', role: 'group', 'aria-label': 'Действия' });
  const hitBtn = h('button', { type: 'button', html: `${ic('plus').innerHTML} Взять`, onClick: () => doHit() });
  const standBtn = h('button', { type: 'button', html: `${ic('check').innerHTML} Стоять`, onClick: () => doStand() });
  const doubleBtn = h('button', { type: 'button', html: `${ic('coins').innerHTML} Дабл`, onClick: () => doDouble() });
  bar.append(hitBtn, standBtn, doubleBtn);
  controls.appendChild(bar);

  function syncButtons() {
    const isPlayer = state === 'player';
    hitBtn.disabled = !isPlayer;
    standBtn.disabled = !isPlayer;
    doubleBtn.disabled = !(isPlayer && player.length === 2 && !doubled);
  }

  function mount({ canvas }) {
    cv = attachCanvas(canvas, (w, h) => {
      W = w;
      H = h;
      dust = makeDust(w, h, 12);
    });
    W = cv.w;
    H = cv.h;
    syncButtons();
  }

  /* ---------- Раунд ---------- */

  function start(b) {
    bet = b;
    doubled = false;
    busted = false;
    deck = newDeck();
    player = [];
    dealer = [];
    payout = 0;
    resultText = '';
    particles.clear();
    state = 'dealing';
    audio.play('deal');
    // раздача по очереди: игрок, дилер, игрок, дилер(рубашкой)
    const seq = [
      { to: 'player', faceUp: true, delay: 250 },
      { to: 'dealer', faceUp: true, delay: 550 },
      { to: 'player', faceUp: true, delay: 850 },
      { to: 'dealer', faceUp: false, delay: 1150 },
    ];
    for (const s of seq) {
      tween(0, () => {}, {
        delay: s.delay,
        onDone: () => {
          dealCard(s.to, s.faceUp);
          audio.play('deal');
          if (s.to === 'dealer' && !s.faceUp) afterDeal();
        },
      });
    }
  }

  function cardSize() {
    const w = clamp(Math.min(W * 0.105, H * 0.16), 40, 74);
    return { w, h: w * 1.4 };
  }

  function handLayout(hand, y) {
    const { w } = cardSize();
    const overlap = w * 0.52;
    const totalW = w + (hand.length - 1) * overlap;
    const x0 = W / 2 - totalW / 2;
    return hand.map((c, i) => ({ x: x0 + i * overlap, y }));
  }

  function dealCard(to, faceUp) {
    const { w, h } = cardSize();
    const hand = to === 'player' ? player : dealer;
    const card = deck.pop();
    const c = {
      ...card,
      faceUp,
      fromX: W - w - 26,
      fromY: 24,
      t: 0,
      flip: 0, // 0..1 анимация переворота
      w,
      h,
    };
    hand.push(c);
    tween(340, (t, e) => {
      c.t = e;
    }, { ease: easeOutCubic });
  }

  function afterDeal() {
    const pv = handValue(player.map((c) => c));
    const dv = handValue([dealer[0]]); // открытая карта дилера
    const playerBJ = player.length === 2 && pv === 21;
    const dealerBJ = dealer.length === 2 && handValue(dealer.map((c) => c)) === 21;
    if (playerBJ || dealerBJ) {
      // сразу вскрываемся и считаем
      revealDealer(() => resolve(playerBJ, dealerBJ));
    } else {
      state = 'player';
      syncButtons();
    }
  }

  function doHit() {
    if (state !== 'player') return;
    audio.play('click');
    dealCard('player', true);
    audio.play('deal');
    state = 'dealing';
    syncButtons();
    tween(0, () => {}, {
      delay: 380,
      onDone: () => {
        const pv = handValue(player.map((c) => c));
        if (pv > 21) {
          busted = true;
          revealDealer(() => resolve(false, false));
        } else if (pv === 21) {
          doStand();
        } else {
          state = 'player';
          syncButtons();
        }
      },
    });
  }

  function doStand() {
    if (state !== 'player') return;
    audio.play('click');
    state = 'dealer';
    syncButtons();
    revealDealer(() => dealerTurn());
  }

  function doDouble() {
    if (state !== 'player' || player.length !== 2 || doubled) return;
    if (!hooks.withdrawExtra(bet)) {
      toastError('Недостаточно фишек для дабла');
      return;
    }
    audio.play('cash');
    doubled = true;
    bet *= 2;
    dealCard('player', true);
    audio.play('deal');
    state = 'dealing';
    syncButtons();
    tween(0, () => {}, {
      delay: 420,
      onDone: () => {
        const pv = handValue(player.map((c) => c));
        if (pv > 21) {
          busted = true;
          revealDealer(() => resolve(false, false));
        } else {
          state = 'dealer';
          revealDealer(() => dealerTurn());
        }
      },
    });
  }

  function revealDealer(cb) {
    const hidden = dealer.find((c) => !c.faceUp);
    if (!hidden) {
      cb();
      return;
    }
    state = 'dealing';
    syncButtons();
    tween(420, (t, e) => {
      hidden.flip = e;
    }, {
      ease: easeOutCubic,
      onDone: () => {
        hidden.faceUp = true;
        hidden.flip = 0;
        audio.play('flip');
        tween(0, () => {}, { delay: 250, onDone: cb });
      },
    });
  }

  function dealerTurn() {
    const step = () => {
      const dv = handValue(dealer.map((c) => c));
      if (dv >= BJ_DEALER_STAND || busted) {
        resolve(false, false);
        return;
      }
      dealCard('dealer', true);
      audio.play('deal');
      tween(0, () => {}, { delay: 480, onDone: step });
    };
    step();
  }

  /** Итог раунда. playerBJ/dealerBJ — при первичной раздаче. */
  function resolve(playerBJ, dealerBJ) {
    const pv = handValue(player.map((c) => c));
    const dv = handValue(dealer.map((c) => c));
    let mult = 0;
    let text = '';
    if (busted) {
      mult = 0;
      text = `ПЕРЕБОР ${pv}`;
    } else if (playerBJ && dealerBJ) {
      mult = BJ_PAYOUT_PUSH;
      text = 'НИЧЬЯ — блэкджек у обоих';
    } else if (playerBJ) {
      mult = BJ_PAYOUT_BLACKJACK;
      text = 'БЛЭКДЖЕК!';
    } else if (dealerBJ) {
      mult = 0;
      text = 'Блэкджек у дилера';
    } else if (dv > 21) {
      mult = BJ_PAYOUT_WIN;
      text = `Дилер перебрал (${dv})`;
    } else if (pv > dv) {
      mult = BJ_PAYOUT_WIN;
      text = `${pv} против ${dv}`;
    } else if (pv < dv) {
      mult = 0;
      text = `${pv} против ${dv}`;
    } else {
      mult = BJ_PAYOUT_PUSH;
      text = `Ничья ${pv}`;
    }
    payout = Math.round(bet * mult);
    resultText = text;
    resultColor = mult > 1 ? '#3ecf8e' : mult === 1 ? GOLD : '#ff8a8a';
    state = 'result';
    resultT = 0;
    syncButtons();
    if (mult > 1) {
      audio.play(mult >= BJ_PAYOUT_BLACKJACK ? 'bigWin' : 'win');
      particles.burst(W / 2, H * 0.45, { count: 70, color: '#3ecf8e', speed: 420, size: 3.4, life: 1.2 });
    } else if (mult === 1) {
      audio.play('cash');
    } else {
      audio.play('lose');
    }
  }

  function finishRound() {
    const pv = handValue(player.map((c) => c));
    const dv = handValue(dealer.map((c) => c));
    const playerBJ = player.length === 2 && pv === 21;
    const dealerBJ = dealer.length === 2 && dv === 21;
    state = 'idle';
    hooks.finish({
      bet,
      payout,
      detail: busted ? `перебор ${pv}` : `${pv} vs ${dv}${playerBJ ? ' · блэкджек' : ''}`,
    });
  }

  /* ---------- Рендер ---------- */

  function render(now, dt) {
    const ctx = cv.ctx;
    if (state === 'result') {
      resultT += dt;
      if (resultT > 2.2) {
        finishRound();
        return;
      }
    }
    stepDust(dust, dt, W, H);
    particles.update(dt);
    drawSceneBg(ctx, W, H, '62,207,142', '245,197,66');
    drawDust(ctx, dust, now);

    const { w, h } = cardSize();
    const dealerY = H * 0.19;
    const playerY = H * 0.61;

    // «стол»
    const feltX = 16;
    const feltW = W - 32;
    fillRR(ctx, feltX, 14, feltW, H - 28, 18, 'rgba(9,20,14,0.55)');
    strokeRR(ctx, feltX, 14, feltW, H - 28, 18, 'rgba(245,197,66,0.22)', 1.5);
    // золотая «рельса» сверху
    ctx.strokeStyle = 'rgba(245,197,66,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(feltX + 18, 26);
    ctx.lineTo(feltX + feltW - 18, 26);
    ctx.stroke();

    // подписи (у игрока подпись отражает ход)
    const playerLabel =
      state === 'player' ? 'ВАШ ХОД'
      : state === 'dealer' ? 'ХОД ДИЛЕРА…'
      : state === 'dealing' ? 'РАЗДАЧА…'
      : 'ИГРОК';
    neonText(ctx, 'ДИЛЕР', W / 2, Math.max(26, dealerY - 18), {
      font: `700 ${Math.round(h * 0.13)}px Inter, sans-serif`, color: 'rgba(244,239,230,0.5)', glow: 0,
    });
    const labelPulse = state === 'player' ? 0.6 + 0.4 * Math.sin(now * 0.004) : 1;
    neonText(ctx, playerLabel, W / 2, playerY - 18, {
      font: `700 ${Math.round(h * 0.13)}px Inter, sans-serif`,
      color: state === 'player' ? `rgba(245,197,66,${labelPulse.toFixed(2)})` : GOLD,
      glow: state === 'player' ? 10 : 8,
    });

    // колода
    drawDeck(ctx, now, w, h);

    // карты дилера
    drawHand(ctx, dealer, dealerY);
    // карты игрока
    drawHand(ctx, player, playerY);

    // значение в «пузырях»
    if (dealer.length) {
      const shown = dealer.every((c) => c.faceUp) ? handValue(dealer.map((c) => c)) : handValue([dealer[0]]);
      drawValueBubble(ctx, dealer, dealerY, shown, false);
    }
    if (player.length) {
      const pv = handValue(player.map((c) => c));
      drawValueBubble(ctx, player, playerY, pv, pv === 21);
    }

    // ставка по центру (между руками)
    const betY = (dealerY + h + playerY) / 2;
    drawBetCircle(ctx, now, betY);

    particles.draw(ctx);

    // баннер результата (с подложкой, чтобы не теряться на картах)
    if (state === 'result') {
      const p = clamp(resultT / 0.3, 0, 1);
      const scale = 0.75 + 0.25 * (1 - Math.pow(1 - p, 3));
      const bw = Math.min(W - 40, h * 4.6);
      const bh = h * 0.95;
      ctx.save();
      ctx.translate(W / 2, betY);
      ctx.scale(scale, scale);
      fillRR(ctx, -bw / 2, -bh / 2, bw, bh, 16, 'rgba(10,6,18,0.9)');
      strokeRR(ctx, -bw / 2, -bh / 2, bw, bh, 16, hexA(resultColor, 0.6), 1.5);
      neonText(ctx, resultText.toUpperCase(), 0, -h * 0.12, {
        font: `700 ${Math.round(h * 0.17)}px Unbounded, sans-serif`, color: resultColor, glow: 26,
      });
      if (payout > bet) {
        neonText(ctx, `+${formatMoney(payout - bet)}`, 0, h * 0.22, {
          font: `700 ${Math.round(h * 0.15)}px Unbounded, sans-serif`, color: '#3ecf8e', glow: 22,
        });
      } else if (payout === bet) {
        neonText(ctx, 'СТАВКА ВОЗВРАЩЕНА', 0, h * 0.22, {
          font: `600 ${Math.round(h * 0.1)}px Inter, sans-serif`, color: GOLD, glow: 10,
        });
      }
      ctx.restore();
    } else if (state === 'idle') {
      const a = 0.55 + 0.45 * Math.sin(now * 0.0022);
      neonText(ctx, 'СДЕЛАЙ СТАВКУ И НАЖМИ «РАЗДАТЬ»', W / 2, H - 22, {
        font: `600 ${Math.min(11.5, H * 0.028)}px Inter, sans-serif`,
        color: `rgba(179,168,204,${a.toFixed(2)})`,
        glow: 0,
      });
    }
  }

  function drawDeck(ctx, now, w, h) {
    const x = W - w - 26;
    const y = 24;
    const bob = Math.sin(now * 0.003) * 2;
    for (let i = 3; i >= 0; i--) {
      drawCard(ctx, x - i * 3, y - i * 3 + bob, w, h, null, { faceUp: false });
    }
    if (deck.length === 0 && (state === 'idle' || state === 'dealing')) {
      // колода пуста — метка
    }
  }

  function drawHand(ctx, hand, y, side) {
    // раскладка с небольшим «веером» для последних карт
    const { w } = cardSize();
    const overlap = w * 0.52;
    const totalW = w + (hand.length - 1) * overlap;
    const x0 = W / 2 - totalW / 2;
    hand.forEach((c, i) => {
      let x = c.x;
      let yy = c.y;
      if (c.t < 1) {
        const e = easeOutCubic(c.t);
        x = lerp(c.fromX, c.x, e);
        yy = lerp(c.fromY, c.y, e) - Math.sin(e * Math.PI) * 16;
      }
      const rot = (c.t < 1 ? (1 - easeOutCubic(c.t)) * 0.12 : 0) * (i % 2 === 0 ? 1 : -1);
      ctx.save();
      if (c.flip > 0) {
        // переворот: сжимаемся по X, на середине меняем лицо
        const s = Math.abs(Math.cos(c.flip * Math.PI));
        ctx.translate(x + c.w / 2, yy + c.h / 2);
        ctx.scale(Math.max(s, 0.02), 1);
        ctx.translate(-(x + c.w / 2), -(yy + c.h / 2));
        const faceUp = c.flip < 0.5 ? c.faceUp : true;
        drawCard(ctx, x, yy, c.w, c.h, faceUp ? c : null, { faceUp, rot });
      } else {
        drawCard(ctx, x, yy, c.w, c.h, c.faceUp ? c : null, { faceUp: c.faceUp, rot });
      }
      ctx.restore();
    });
  }

  function drawValueBubble(ctx, hand, y, value, hot) {
    const { w } = cardSize();
    const overlap = w * 0.52;
    const totalW = w + (hand.length - 1) * overlap;
    const x0 = W / 2 - totalW / 2;
    const bx = x0 - 40;
    const by = y + cardSize().h / 2;
    const r = 17;
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.fillStyle = hot ? 'rgba(245,197,66,0.18)' : 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = hot ? GOLD : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    neonText(ctx, String(value), bx, by + 1, {
      font: `700 14px Unbounded, sans-serif`, color: hot ? GOLD : '#f4efe6', glow: hot ? 12 : 0,
    });
    ctx.restore();
  }

  function drawBetCircle(ctx, now, y) {
    const cx = W / 2;
    const { h } = cardSize();
    const r = clamp(h * 0.42, 22, 34);
    ctx.save();
    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = 'rgba(245,197,66,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    if (bet > 0) {
      const pulse = 1 + Math.sin(now * 0.004) * 0.04;
      ctx.beginPath();
      ctx.arc(cx, y, r * pulse * 0.62, 0, TAU);
      ctx.fillStyle = 'rgba(245,197,66,0.12)';
      ctx.fill();
      neonText(ctx, formatMoney(bet), cx, y - r * 0.12, {
        font: `600 ${Math.round(r * 0.38)}px Unbounded, sans-serif`, color: GOLD, glow: 10,
      });
      if (doubled) {
        neonText(ctx, '×2', cx, y + r * 0.38, {
          font: `700 ${Math.round(r * 0.3)}px Inter, sans-serif`, color: '#3ecf8e', glow: 8,
        });
      }
    }
    ctx.restore();
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  /* ---------- Force resolve (уход со страницы mid-round) ---------- */

  function simulateInstant() {
    // страховка: раздать остаток и рассчитать
    if (state === 'idle') return null;
    // добиваем руки если раздача не завершена
    while (player.length < 2) dealCard('player', true);
    while (dealer.length < 2) dealCard('dealer', dealer.length === 1 ? false : true);
    const pv = handValue(player.map((c) => c));
    const dv = handValue(dealer.map((c) => c));
    const playerBJ = player.length === 2 && pv === 21;
    const dealerBJ = dealer.length === 2 && dv === 21;
    // «стоим»: дилер добирает до 17, если игрок не перебрал
    if (pv <= 21) {
      let guard = 0;
      while (handValue(dealer.map((c) => c)) < BJ_DEALER_STAND && guard++ < 12) {
        dealCard('dealer', true);
      }
    }
    busted = pv > 21;
    resolve(playerBJ, dealerBJ);
    const result = {
      bet,
      payout,
      detail: busted ? `перебор ${pv}` : `${pv} vs ${handValue(dealer.map((c) => c))}${playerBJ ? ' · блэкджек' : ''}`,
    };
    state = 'idle';
    return result;
  }

  return {
    mount,
    start,
    render,
    isBusy: () => state !== 'idle',
    setIdle: () => { state = 'idle'; syncButtons(); },
    getPotential: () => {
      const b = hooks.getBet ? hooks.getBet() : bet;
      return `<span>Выигрыш 1:1, блэкджек 3:2</span><b>до ×2.5 · ${formatMoney(Math.round(b * 2.5))}</b>`;
    },
    getInfo: () => ({
      rows: [
        ['Выигрыш (1:1)', '×2'],
        ['Блэкджек (3:2)', '×2.5'],
        ['Ничья', 'возврат ставки'],
        ['Дабл', 'ставка ×2, одна карта'],
      ],
      rules: `Цель — набрать 21, не перебрав. Туз = 1 или 11. Дилер добирает до 17 и останавливается. Блэкджек — два первых карты (туз + десятка).`,
    }),
    forceResolve: simulateInstant,
    dispose: () => cv?.disconnect(),
  };
}
