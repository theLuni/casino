/* Hash-роутер: #/ (лобби), #/game/:id, #/profile, #/topup. */

const routes = [];

let currentCleanup = null;

export function route(pattern, render) {
  // pattern — строка с :param или RegExp
  if (pattern instanceof RegExp) {
    routes.push({ re: pattern, render });
  } else {
    const keys = [];
    const re = new RegExp(
      '^' +
        pattern
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/:([a-zA-Z]+)/g, (_, k) => {
            keys.push(k);
            return '([^/]+)';
          }) +
        '$'
    );
    routes.push({ re, keys, render });
  }
}

function match(path) {
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = {};
    if (r.keys) r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    return { render: r.render, params };
  }
  return null;
}

function getPath() {
  const hash = location.hash.replace(/^#/, '') || '/';
  return hash.startsWith('/') ? hash : '/' + hash;
}

export function navigate(path) {
  if (getPath() === path) {
    renderNow();
  } else {
    location.hash = path;
  }
}

function renderNow() {
  const path = getPath();
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (e) {
      console.error('cleanup error', e);
    }
    currentCleanup = null;
  }
  const found = match(path) || match('/');
  const app = document.getElementById('page') || document.getElementById('app');
  app.textContent = '';
  const result = found.render(app, found.params || {});
  if (typeof result === 'function') currentCleanup = result;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  // подсветка активного пункта меню
  document.querySelectorAll('.nav a').forEach((a) => {
    const href = a.getAttribute('href')?.replace(/^#/, '') || '/';
    a.classList.toggle('current', href === path);
  });
}

export function startRouter() {
  window.addEventListener('hashchange', renderNow);
  renderNow();
}
