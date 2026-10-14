(function () {
  'use strict';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const active = new Set();
  function animate(el, frames, options) {
    if (!el || reduced()) return null;
    const a = el.animate(
      frames,
      Object.assign({ duration: 500, easing: 'cubic-bezier(.22,.7,.15,1)' }, options),
    );
    active.add(a);
    a.finished.catch(() => {}).finally(() => active.delete(a));
    return a;
  }
  function reveal(root = document) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-revealed');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }
  function flight(from, to, label) {
    if (reduced() || !from || !to) return;
    const a =
        typeof from.getBoundingClientRect === 'function' ? from.getBoundingClientRect() : from,
      b = to.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = 'data-flight';
    el.textContent = label;
    el.style.left = a.x + a.width / 2 + 'px';
    el.style.top = a.y + a.height / 2 + 'px';
    document.body.appendChild(el);
    const dx = b.x + b.width / 2 - a.x - a.width / 2,
      dy = b.y + b.height / 2 - a.y - a.height / 2;
    const anim = animate(
      el,
      [
        { transform: 'translate(-50%,-50%) scale(.8)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.15 },
        {
          transform: `translate(calc(-50% + ${dx * 0.45}px),calc(-50% + ${dy * 0.5 - 55}px)) scale(1)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.55)`,
          opacity: 0,
        },
      ],
      { duration: 1100 },
    );
    if (anim)
      anim.finished.then(
        () => {
          el.remove();
          pulse(to);
        },
        () => el.remove(),
      );
    else el.remove();
  }
  function pulse(el) {
    if (!el) return;
    const base = getComputedStyle(el).transform;
    animate(
      el,
      [
        { filter: 'brightness(1)', transform: base },
        {
          filter: 'brightness(1.35)',
          transform: (base === 'none' ? '' : base) + ' scale(1.055)',
          offset: 0.3,
        },
        { filter: 'brightness(1)', transform: base },
      ],
      { duration: 650 },
    );
  }
  function cancelFlights() {
    document.querySelectorAll('.data-flight').forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      el.remove();
    });
  }
  function scrollScene(root, callback) {
    let dirty = true,
      previous = -1,
      visible = null;
    const signal = new AbortController();
    addEventListener('scroll', () => (dirty = true), { passive: true, signal: signal.signal });
    addEventListener('resize', () => (dirty = true), { signal: signal.signal });
    return {
      tick() {
        if (!dirty) return;
        dirty = false;
        const r = root.getBoundingClientRect(),
          travel = Math.max(1, r.height - innerHeight),
          p = clamp(-r.top / travel);
        const nextVisible = r.bottom > 0 && r.top < innerHeight;
        if (p !== previous || visible !== nextVisible) {
          previous = p;
          visible = nextVisible;
          callback(p, visible);
        }
      },
      refresh() {
        dirty = true;
      },
      dispose() {
        signal.abort();
      },
    };
  }
  function details(root) {
    root.querySelectorAll('details').forEach((el) => {
      if (el.dataset.motionBound) return;
      el.dataset.motionBound = 'true';
      el.addEventListener('toggle', () => {
        if (el.open)
          animate(
            el,
            [
              { opacity: 0.5, transform: 'translateY(8px)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 300 },
          );
      });
    });
  }
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('motion-paused', document.hidden);
    active.forEach((a) => {
      if (document.hidden) a.pause();
      else a.play();
    });
  });
  addEventListener('pagehide', () => active.forEach((a) => a.cancel()));
  window.HUBU_MOTION = {
    clamp,
    ease,
    lerp,
    reduced,
    animate,
    reveal,
    flight,
    pulse,
    cancelFlights,
    scrollScene,
    details,
  };
})();
