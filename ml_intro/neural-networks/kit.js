/* The shared kit for "From a Yes to a Network": drawing helpers, KaTeX helpers, tooltips, prose placeholders, predict boxes
   and the scroll engine. The chapter files (ch-*.js) call NNKIT.register(id, build); app.js boots everything.
   No libraries other than the vendored KaTeX, no build step. Every figure is a pure function of (step, scroll progress, user state):
   scrolling backwards simply redraws earlier states. */
(function () {
  'use strict';
  const NN = window.NNM;
  if (!NN) { console.error('nn-math.js did not load'); return; }
  const K = (window.NNKIT = {});

  /* ------------------------------------------------------------------ helpers */
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  /* T(parent, x, y, string, size, fill, { anchor, weight, op, rot, halo, italic }) */
  function T(parent, x, y, str, size, fill, o) {
    o = o || {};
    const a = { x: x, y: y, 'font-size': size, fill: fill || C.ink };
    if (o.anchor) a['text-anchor'] = o.anchor;
    if (o.weight) a['font-weight'] = o.weight;
    if (o.op !== undefined) a.opacity = o.op;
    if (o.italic) a['font-style'] = 'italic';
    if (o.rot) a.transform = 'rotate(-90 ' + x + ' ' + y + ')';
    if (o.halo) { a.stroke = '#fff'; a['stroke-width'] = 3.4; a['paint-order'] = 'stroke'; a['stroke-linejoin'] = 'round'; }
    const t = el('text', a, parent);
    t.textContent = str;
    return t;
  }
  const clear = (g) => { while (g.firstChild) g.removeChild(g.firstChild); };
  const clamp = (v, a, b) => Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function mix(c1, c2, t) {
    const a = hexRgb(c1), b = hexRgb(c2);
    t = clamp(t, 0, 1);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }
  /* staggered reveal: item i of n, driven by q in [0,1]; the first items are visible at q=0 */
  const rev = (q, i, n) => clamp((0.3 + q * 1.2) * (n + 1) - i, 0, 1);
  const MINUS = '−';
  const fmt = (v, d) => (v < 0 && Number(Math.abs(v).toFixed(d)) !== 0 ? MINUS : '') + Math.abs(v).toFixed(d);
  const fmtInt = (v) => Math.round(v).toLocaleString('en-US');
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* controls stay in place (no layout jump); they are just disabled and dimmed when not relevant */
  function ctlState(ctl, enabled) {
    ctl.classList.add('on');
    ctl.classList.toggle('off', !enabled);
    Array.prototype.forEach.call(ctl.querySelectorAll('input,button,select'), (n) => { n.disabled = !enabled; });
  }
  /* a control group inside a chapter's controls is shown only at the step(s) it belongs to: data-for="0 2" */
  function showGroups(ctl, stage) {
    Array.prototype.forEach.call(ctl.querySelectorAll('[data-for]'), (g) => {
      g.hidden = g.getAttribute('data-for').split(/\s+/).indexOf(String(stage)) < 0;
    });
  }

  /* palette: purple = focus / the thing you move, blue = positive / "yes", orange = negative / "no" / error,
     red = a mistake or blame flowing backwards, teal = the best or the final result, grey = background */
  const C = {
    ink: '#1d2733', muted: '#55636f', line: '#e5e1d8', card: '#ffffff', dot: '#46515e',
    blue: '#1f6fd1', blueSoft: '#dbe8fa', orange: '#d9730d', orangeSoft: '#fbe6d0', grey: '#7d8894',
    teal: '#0f8a8a', accent: '#6d5bd0', accentSoft: '#efecfb', red: '#b3261e', grid: '#ece9e1', axis: '#a9a396'
  };
  /* colours of the word groups in the last chapters (the word labels are always drawn too: colour is never the only cue) */
  const GROUP_COL = { animal: '#0f8a8a', food: '#d9730d', lodging: '#6d5bd0', adj: '#1f6fd1', verb: '#7d8894', other: '#a9a396' };

  /* ------------------------------------------------------------------ KaTeX */
  function renderMath(root) {
    if (typeof window.renderMathInElement === 'function') {
      try {
        window.renderMathInElement(root, {
          delimiters: [{ left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }],
          throwOnError: false
        });
      } catch (e) { console.error('KaTeX auto-render failed', e); }
    } else console.error('KaTeX auto-render is not available');
  }
  function setTex(node, src) {
    if (window.katex) {
      try { window.katex.render(src, node, { displayMode: false, throwOnError: false }); return; } catch (e) { console.error('KaTeX render failed', e); }
    }
    node.textContent = src;
  }
  function mathBox(parent, x, y, w, h, tex, cls, size) {
    const fo = el('foreignObject', { x: x, y: y, width: w, height: h }, parent);
    const d = document.createElement('div');
    d.className = 'svgmath ' + (cls || '');
    if (size) d.style.fontSize = size + 'px';
    fo.appendChild(d);
    setTex(d, tex);
    return d;
  }
  const tex = (s) => '\\(' + s + '\\)';

  /* ------------------------------------------------------------------ the shared data and user state */
  const F = NN.build();
  /* user state shared by all figures; bump() makes every near chapter redraw */
  const S = {
    pos: 3, neg: 2, y: 1, act: 'sigmoid', lam: 1, scores: NN.SOFTMAX_START.slice(), hid: 2, x1: 0.9, x2: -0.9,
    pair: '0-1', word: 'motel', rev: 0
  };
  K.NN = NN; K.F = F; K.S = S;

  /* ------------------------------------------------------------------ prose placeholders {{key args}} */
  const VALUES = NN.values(F);
  function val(spec) {
    const a = spec.trim().split(/\s+/);
    let isTex = false;
    if (a[0].indexOf('t:') === 0) { isTex = true; a[0] = a[0].slice(2); }
    const f = VALUES[a[0]];
    let out;
    if (typeof f === 'function') out = String(f.apply(null, a.slice(1)));
    else if (f !== undefined) out = String(f);
    else { console.warn('unknown placeholder', spec); out = '?'; }
    return isTex ? out.split(MINUS).join('-') : out;
  }
  K.fillPlaceholders = function () {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.indexOf('{{') >= 0 && !/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => { n.nodeValue = n.nodeValue.replace(/\{\{([^}]+)\}\}/g, (m, s) => val(s)); });
  };
  /* predict-then-reveal boxes */
  K.bindPredict = function () {
    Array.prototype.forEach.call(document.querySelectorAll('.predict'), (box) => {
      const rv = box.querySelector('.reveal');
      if (!rv) return;
      Array.prototype.forEach.call(box.querySelectorAll('button'), (b) => {
        b.addEventListener('click', () => {
          Array.prototype.forEach.call(box.querySelectorAll('button'), (o) => o.classList.toggle('picked', o === b));
          rv.hidden = false;
        });
      });
    });
  };

  /* ------------------------------------------------------------------ tooltips */
  const tip = document.getElementById('tip');
  let tipT = 0;
  function tipMove(e) {
    tip.style.left = Math.max(6, Math.min(e.clientX + 14, window.innerWidth - 250)) + 'px';
    tip.style.top = Math.min(e.clientY + 16, window.innerHeight - 80) + 'px';
  }
  function tipShow(html, e) { tip.innerHTML = html; tip.classList.add('on'); tipMove(e); }
  function tipHide() { tip.classList.remove('on'); }
  /* delegated: figures are redrawn often, so listeners live on the svg, not on the marks */
  function bindTips(svg) {
    const find = (e) => (e.target && e.target.closest ? e.target.closest('[data-tip]') : null);
    svg.addEventListener('pointerover', (e) => { const n = find(e); if (n) tipShow(n.getAttribute('data-tip'), e); });
    svg.addEventListener('pointermove', (e) => { if (tip.classList.contains('on')) { const n = find(e); if (n) tipMove(e); else tipHide(); } });
    svg.addEventListener('pointerout', (e) => { if (find(e)) tipHide(); });
    svg.addEventListener('click', (e) => { const n = find(e); if (n) { tipShow(n.getAttribute('data-tip'), e); clearTimeout(tipT); tipT = setTimeout(tipHide, 2800); } });
  }
  window.addEventListener('scroll', tipHide, { passive: true });

  /* ------------------------------------------------------------------ drawing kit */
  function lin(d0, d1, r0, r1) {
    const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
    f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
    f.r0 = r0; f.r1 = r1; f.d0 = d0; f.d1 = d1;
    return f;
  }
  function geo(C0) {
    const M = C0.M;
    return { W: C0.W, H: C0.H, M: M, fs: M ? 10.5 : 12, ft: M ? 11 : 13, dr: M ? 4.4 : 5.6,
      m: M ? { l: 40, r: 12, t: 14, b: 42 } : { l: 58, r: 22, t: 22, b: 56 } };
  }
  function clipRect(defs, id, x, y, w, h) {
    const cp = el('clipPath', { id: id }, defs);
    el('rect', { x: x, y: y, width: w, height: h }, cp);
  }
  /* axes: sx, sy are lin() scales; o = { xt, yt, xtitle, ytitle, xfmt, yfmt, ytx, grid } */
  function axes(g, G, sx, sy, o) {
    const x0 = Math.min(sx.r0, sx.r1), x1 = Math.max(sx.r0, sx.r1), yb = sy.r0, yt = sy.r1;
    (o.yt || []).forEach((v) => { if (o.grid !== false) el('line', { x1: x0, x2: x1, y1: sy(v), y2: sy(v), stroke: C.grid }, g); });
    el('line', { x1: x0, x2: x1, y1: yb, y2: yb, stroke: C.axis }, g);
    el('line', { x1: x0, x2: x0, y1: yb, y2: yt, stroke: C.axis }, g);
    (o.xt || []).forEach((v) => {
      el('line', { x1: sx(v), x2: sx(v), y1: yb, y2: yb + 4, stroke: C.axis }, g);
      T(g, sx(v), yb + G.fs + 6, o.xfmt ? o.xfmt(v) : String(v), G.fs, C.muted, { anchor: 'middle' });
    });
    (o.yt || []).forEach((v) => {
      el('line', { x1: x0 - 4, x2: x0, y1: sy(v), y2: sy(v), stroke: C.axis }, g);
      T(g, x0 - 7, sy(v) + G.fs * 0.35, o.yfmt ? o.yfmt(v) : String(v), G.fs, C.muted, { anchor: 'end' });
    });
    if (o.xtitle) T(g, (x0 + x1) / 2, yb + G.fs + G.ft + 10, o.xtitle, G.ft, C.muted, { anchor: 'middle' });
    if (o.ytitle) T(g, o.ytx !== undefined ? o.ytx : (G.M ? 11 : 16), (yb + yt) / 2, o.ytitle, G.ft, C.muted, { anchor: 'middle', rot: true });
  }
  const pathD = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
  function curvePts(sx, sy, fn, x0, x1, step) {
    const pts = [];
    for (let x = x0; x <= x1 + 1e-9; x += step) pts.push([sx(x), sy(fn(x))]);
    return pts;
  }
  /* a dot: circle for class 1 ("yes", blue) or diamond for class 0 ("no", orange), so colour is never the only cue */
  function dotAt(g, x, y, yes, r, tipHtml, op) {
    let n;
    if (!yes) {
      const d = r * 1.3;
      n = el('polygon', { points: x + ',' + (y - d) + ' ' + (x + d) + ',' + y + ' ' + x + ',' + (y + d) + ' ' + (x - d) + ',' + y, fill: C.orange, stroke: '#fff', 'stroke-width': 1.2 }, g);
    } else n = el('circle', { cx: x, cy: y, r: r, fill: C.blue, stroke: '#fff', 'stroke-width': 1.2 }, g);
    if (op !== undefined && op < 1) n.setAttribute('opacity', op);
    if (tipHtml) n.setAttribute('data-tip', tipHtml);
    return n;
  }
  /* a rounded label chip */
  function chip(g, x, y, w, h, fill, stroke, label, size, color, o) {
    o = o || {};
    el('rect', { x: x, y: y, width: w, height: h, rx: o.rx === undefined ? 7 : o.rx, fill: fill, stroke: stroke || 'none', 'stroke-width': o.sw || 1.5, opacity: o.op === undefined ? 1 : o.op }, g);
    if (label) T(g, x + w / 2, y + h / 2 + size * 0.35, label, size, color || C.ink, { anchor: 'middle', weight: o.weight, op: o.op });
  }
  function arrow(g, x1, y1, x2, y2, color, w, head, op) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = head || 7;
    const xe = x2 - Math.cos(a) * h * 0.6, ye = y2 - Math.sin(a) * h * 0.6;
    el('line', { x1: x1, y1: y1, x2: xe, y2: ye, stroke: color, 'stroke-width': w || 2, 'stroke-linecap': 'round', opacity: op === undefined ? 1 : op }, g);
    el('polygon', { points: x2 + ',' + y2 + ' ' + (x2 - h * Math.cos(a - 0.4)) + ',' + (y2 - h * Math.sin(a - 0.4)) + ' ' + (x2 - h * Math.cos(a + 0.4)) + ',' + (y2 - h * Math.sin(a + 0.4)), fill: color, opacity: op === undefined ? 1 : op }, g);
  }
  /* node positions of a layered network drawn inside box {x,y,w,h}: sizes = [6, 4, 3] -> [[{x,y}...], ...] */
  function netLayout(sizes, box) {
    return sizes.map((n, li) => {
      const x = box.x + (sizes.length === 1 ? box.w / 2 : (li / (sizes.length - 1)) * box.w);
      return Array.from({ length: n }, (v, k) => ({ x: x, y: box.y + (n === 1 ? box.h / 2 : (k / (n - 1)) * box.h) }));
    });
  }
  /* an image of a function over a square, painted once into a canvas: fn(x, y) -> 0..1 (blue = 1, orange = 0) */
  function mapImage(fn, lo, hi, n) {
    try {
      const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
      const cx = cv.getContext('2d'), im = cx.createImageData(n, n);
      const a = hexRgb('#f7c89b'), b = hexRgb('#9cc2f2'), mid = [250, 249, 246];
      for (let r = 0; r < n; r++) {
        const y = hi - ((r + 0.5) / n) * (hi - lo);
        for (let c = 0; c < n; c++) {
          const p = fn(lo + ((c + 0.5) / n) * (hi - lo), y), o = (r * n + c) * 4;
          const t = Math.abs(p - 0.5) * 2, col = p >= 0.5 ? b : a;
          for (let k = 0; k < 3; k++) im.data[o + k] = mid[k] + (col[k] - mid[k]) * (0.25 + 0.75 * t);
          im.data[o + 3] = 255;
        }
      }
      cx.putImageData(im, 0, 0);
      return cv.toDataURL();
    } catch (e) { console.error('map image failed', e); return null; }
  }

  /* ------------------------------------------------------------------ scroll engine */
  const mq = window.matchMedia('(max-width: 920px)');
  const chapters = [];
  function register(id, build) {
    const chEl = document.getElementById(id);
    if (!chEl) { console.error('no chapter element', id); return; }
    const n = id.replace('ch', '');
    const ch = {
      el: chEl, id: id, build: build,
      svg: document.getElementById('viz' + n), cap: document.getElementById('cap' + n), ctl: document.getElementById('ctl' + n),
      steps: Array.prototype.slice.call(chEl.querySelectorAll('.step')),
      inst: null, stage: -1, q: -1, rev: -1, capHtml: null
    };
    bindTips(ch.svg);
    chapters.push(ch);
  }
  function buildChapter(ch) {
    const M = mq.matches;
    const W = M ? 380 : 640, H = M ? 330 : 520;
    ch.svg.innerHTML = '';
    ch.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    ch.capHtml = null;
    const C0 = {
      svg: ch.svg, W: W, H: H, M: M, ctl: ch.ctl,
      cap: function (html) {
        if (html === ch.capHtml) return;
        ch.capHtml = html; ch.cap.innerHTML = html; renderMath(ch.cap);
      },
      redraw: function () { K.bump(); }
    };
    try {
      ch.inst = ch.build(C0);
      ch.inst.M = M;
    } catch (e) {
      console.error('Chapter ' + ch.id + ' failed to build', e);
      ch.inst = { M: M, render: function () {}, failed: true };
      T(ch.svg, 20, 40, 'This figure could not be drawn (see the console).', 14, C.orange);
    }
  }
  function draw(ch, stage, q, force) {
    if (!ch.inst || ch.inst.M !== mq.matches) { buildChapter(ch); force = true; }
    const changed = ch.stage !== stage || force || ch.rev !== S.rev;
    if (!changed && Math.abs(q - ch.q) < 0.004) return;
    ch.stage = stage; ch.q = q; ch.rev = S.rev;
    if (ch.inst.failed) return;
    try {
      showGroups(ch.ctl, stage);
      ch.inst.render(stage, q);
    } catch (e) { console.error('Chapter ' + ch.id + ', step ' + stage + ' failed to render', e); }
  }

  let ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  K.bump = function () { S.rev++; onScroll(); };
  const dotLinks = [];
  function update() {
    ticking = false;
    const vh = window.innerHeight;
    /* a step "arrives" at this line; on narrow screens the figure is pinned to the top, so it is lower */
    const trig = mq.matches ? 0.66 : 0.5;
    const A = vh * trig, span = vh * (mq.matches ? 0.3 : 0.45);
    chapters.forEach((ch) => {
      const r = ch.el.getBoundingClientRect();
      const near = r.bottom > -vh * 0.5 && r.top < vh * 1.5;
      if (!near && ch.inst) return;
      let lastAbove = -1;
      ch.steps.forEach((s, si) => { if (s.getBoundingClientRect().top <= A) lastAbove = si; });
      const best = clamp(lastAbove, 0, ch.steps.length - 1);
      const r0 = ch.steps[best].getBoundingClientRect();
      /* q = 0 when the step arrives, 1 after a further `span` of scrolling; reduced motion shows the finished state */
      const q = reducedMotion ? 1 : clamp((A - r0.top) / span, 0, 1);
      ch.steps.forEach((s, si) => {
        const rr = s.getBoundingClientRect();
        s.classList.toggle('active', si === best || (rr.top < vh && rr.bottom > 0));
      });
      draw(ch, best, q, false);
    });
    dotLinks.forEach((dl) => {
      const r = dl.el.getBoundingClientRect();
      dl.a.classList.toggle('on', r.top < vh * 0.5 && r.bottom > vh * 0.5);
    });
  }
  K.start = function () {
    const dotnav = document.getElementById('dotnav');
    document.querySelectorAll('.chapter').forEach((chEl) => {
      const a = document.createElement('a');
      a.href = '#' + chEl.id;
      const tag = chEl.querySelector('.tag');
      const label = tag ? tag.textContent : chEl.id;
      a.setAttribute('aria-label', label);
      a.innerHTML = '<span></span>';
      a.firstChild.textContent = label;
      dotnav.appendChild(a);
      dotLinks.push({ a: a, el: chEl });
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', onScroll);
    window.addEventListener('hashchange', onScroll);
    onScroll();
  };

  Object.assign(K, { el: el, T: T, clear: clear, clamp: clamp, lerp: lerp, ease: ease, mix: mix, rev: rev, fmt: fmt, fmtInt: fmtInt, MINUS: MINUS,
    reducedMotion: reducedMotion, ctlState: ctlState, C: C, GROUP_COL: GROUP_COL, renderMath: renderMath, setTex: setTex, mathBox: mathBox, tex: tex,
    lin: lin, geo: geo, clipRect: clipRect, axes: axes, pathD: pathD, curvePts: curvePts, dotAt: dotAt, chip: chip, arrow: arrow,
    netLayout: netLayout, mapImage: mapImage, register: register, tipShow: tipShow, tipHide: tipHide, hexRgb: hexRgb });
})();
