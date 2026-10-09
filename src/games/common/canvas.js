/* Привязка canvas к размерам с учётом devicePixelRatio. */

export function attachCanvas(canvas, onResize) {
  const ctx = canvas.getContext('2d');
  let w = 1;
  let h = 1;
  let dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    w = Math.max(40, rect.width);
    h = Math.max(40, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (onResize) onResize(w, h);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    ctx,
    get w() {
      return w;
    },
    get h() {
      return h;
    },
    get dpr() {
      return dpr;
    },
    resize,
    disconnect() {
      ro.disconnect();
    },
  };
}
