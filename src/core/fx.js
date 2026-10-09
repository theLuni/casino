/* Фоновый слой: мягкие bokeh-частицы (золото/фиолет), лёгкий дрейф.
   Canvas на весь экран, pointer-events: none, учитывает devicePixelRatio. */

import { TAU } from './util.js';

export function startBgFx() {
  const canvas = document.getElementById('bgfx');
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;

  const COLORS = ['245,197,66', '139,92,246', '167,139,250'];

  const dots = Array.from({ length: 34 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 14 + Math.random() * 60,
    c: COLORS[(Math.random() * COLORS.length) | 0],
    a: 0.028 + Math.random() * 0.05,
    vx: (Math.random() - 0.5) * 0.012,
    vy: (Math.random() - 0.5) * 0.008,
    ph: Math.random() * TAU,
    sp: 0.3 + Math.random() * 0.7,
  }));

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  let raf = 0;
  let last = performance.now();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(50, now - last);
    last = now;
    ctx.clearRect(0, 0, w, h);
    const k = dt / 1000;
    for (const d of dots) {
      d.x += d.vx * k * 8;
      d.y += d.vy * k * 8;
      if (d.x < -0.1) d.x = 1.1;
      if (d.x > 1.1) d.x = -0.1;
      if (d.y < -0.1) d.y = 1.1;
      if (d.y > 1.1) d.y = -0.1;
      const tw = 0.65 + 0.35 * Math.sin(now * 0.001 * d.sp + d.ph);
      const x = d.x * w;
      const y = d.y * h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, d.r);
      g.addColorStop(0, `rgba(${d.c}, ${(d.a * tw).toFixed(3)})`);
      g.addColorStop(1, `rgba(${d.c}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, d.r, 0, TAU);
      ctx.fill();
    }
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
  };
}
