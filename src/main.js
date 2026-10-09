/* Точка входа: стили, шрифты, шапка, роутер, фоновые частицы, звук. */

import './styles.css';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/800.css';
import '@fontsource/playfair-display/900.css';
import '@fontsource/unbounded/500.css';
import '@fontsource/unbounded/600.css';
import '@fontsource/unbounded/700.css';

import { h, ic } from './core/dom.js';
import { route, startRouter } from './core/router.js';
import { renderHeader } from './ui/header.js';
import { renderLobby } from './ui/lobby.js';
import { renderGameScreen } from './ui/gameScreen.js';
import { renderProfile } from './ui/profile.js';
import { renderTopup } from './ui/topup.js';
import { startBgFx } from './core/fx.js';
import { audio } from './core/audio.js';
import { store } from './core/store.js';

// Применяем сохранённую настройку звука
audio.set(store.sound());

// Шапка и подвал монтируются один раз, контент — под ними
const app = document.getElementById('app');
const main = h('main', { id: 'page' });
app.appendChild(renderHeader());
app.appendChild(main);
app.appendChild(
  h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'wrap' },
      h('span', {}, h('span', { class: 'grad-text', style: { fontFamily: 'var(--font-display)', fontWeight: 800 }, text: 'Luni Royal' }), h('span', { class: 'faint', text: ' — демо-казино на виртуальные фишки' })),
      h('span', { class: 'faint', text: 'Виртуальная валюта · реальные деньги не принимаются · играйте ответственно' })
    )
  )
);

// Роуты
route('/', (root) => renderLobby(root));
route('/game/:id', (root, { id }) => renderGameScreen(root, { id }));
route('/profile', (root) => renderProfile(root));
route('/topup', (root) => renderTopup(root));

// Фоновые bokeh-частицы
startBgFx();

// Первый запуск аудио по жесту (браузерная политика)
window.addEventListener('pointerdown', () => audio.init(), { once: true });

startRouter();
