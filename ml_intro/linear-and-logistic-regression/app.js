/* Scroll-driven visual introduction to linear and logistic regression ("From a Number to a Yes").
   All numbers come from lr-math.js (window.LRM); all formulas are rendered with the vendored KaTeX.
   No other libraries, no build step. Every figure is a pure function of (step, scroll progress, user state):
   scrolling backwards simply redraws earlier states. */
(function () {
  'use strict';
  const LR = window.LRM;
  if (!LR) { console.error('lr-math.js did not load'); return; }

  /* ------------------------------------------------------------------ helpers */
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function T(parent, x, y, str, size, fill, o) {
    o = o || {};
    const a = { x: x, y: y, 'font-size': size, fill: fill || C.ink };
    if (o.anchor) a['text-anchor'] = o.anchor;
    if (o.weight) a['font-weight'] = o.weight;
    if (o.op !== undefined) a.opacity = o.op;
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
  const fmtBig = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + ' million' : fmtInt(v));
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* controls stay in place (no layout jump); they are just disabled and dimmed when not relevant */
  function ctlState(ctl, enabled) {
    ctl.classList.add('on');
    ctl.classList.toggle('off', !enabled);
    Array.prototype.forEach.call(ctl.querySelectorAll('input,button,select'), (n) => { n.disabled = !enabled; });
  }

  /* palette: purple = your line, blue = the machine's line and the "yes" class, orange = error and the "no" class,
     red = a mistake, teal = the best possible */
  const C = {
    ink: '#1d2733', muted: '#55636f', line: '#e5e1d8', card: '#ffffff', dot: '#46515e',
    blue: '#1f6fd1', blueSoft: '#dbe8fa', orange: '#d9730d', orangeSoft: '#fbe6d0', grey: '#7d8894',
    teal: '#0f8a8a', accent: '#6d5bd0', red: '#b3261e', grid: '#ece9e1', axis: '#a9a396'
  };

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
  const eqTex = (b0, b1) => '\\hat y = ' + (b0 < 0 ? '-' : '') + Math.abs(b0).toFixed(1) + (b1 < 0 ? ' - ' : ' + ') + Math.abs(b1).toFixed(2) + '\\,x';

  /* ------------------------------------------------------------------ data (all from lr-math.js) */
  const F = LR.build();
  const E = LR.ESSAYS, N = F.n, LAB = F.labels, SP = LR.SPAM, NS_ = LR.N_SPAM;
  const OLS = F.ols, LG = F.logistic, SPM = F.spam;
  const GOOD = F.traj.good, SMALL = F.traj.small, LARGE = F.traj.large;
  const worstIdx = (function () {
    let wi = 0, wv = -1;
    E.x.forEach((x, i) => { const v = LR.logLossOne(LG.probs[i], LAB[i]); if (v > wv) { wv = v; wi = i; } });
    return wi;
  })();

  /* user state shared by all figures */
  const S = { line: { b0: LR.DEFAULT_LINE[0], b1: LR.DEFAULT_LINE[1] }, touched: false, lr: 'good', thr: 0.5, rev: 0 };
  const userMse = () => LR.mse(S.line.b0, S.line.b1, E.x, E.y);

  /* ------------------------------------------------------------------ prose placeholders {{key args}} */
  function val(spec) {
    const a = spec.trim().split(/\s+/);
    let isTex = false;
    if (a[0].indexOf('t:') === 0) { isTex = true; a[0] = a[0].slice(2); }
    let out;
    switch (a[0]) {
      case 'n': out = String(N); break;
      case 'snN': out = String(NS_); break;
      case 'pass': out = String(LR.PASS_MARK); break;
      case 'nRead': out = String(F.nReadable); break;
      case 'nNot': out = String(F.nNotReadable); break;
      case 'mse': out = String(Math.round(OLS.mse)); break;
      case 'b0': out = OLS.b0.toFixed(1); break;
      case 'b1': out = Math.abs(OLS.b1).toFixed(2); break;
      case 'b1r': out = Math.abs(OLS.b1).toFixed(1); break;
      case 'pred12': out = String(Math.round(LR.lineAt(OLS.b0, OLS.b1, 12))); break;
      case 'lossSmall': out = fmtInt(SMALL[SMALL.length - 1][2]); break;
      case 'smallSteps': out = String(SMALL.length - 1); break;
      case 'goodSteps': out = String(GOOD.length - 1); break;
      case 'll6': out = fmt(F.linOnLabels.at6, 2); break;
      case 'll28': out = fmt(F.linOnLabels.at28, 2); break;
      case 'lb0': out = LG.b0.toFixed(2); break;
      case 'lb1': out = Math.abs(LG.b1).toFixed(2); break;
      case 'lb1neg': out = fmt(LG.b1, 3); break;
      case 'bound': out = String(Math.round(LG.boundary)); break;
      case 'nCorrect': out = String(LG.nCorrect); break;
      case 'nMiss': out = String(LG.mistakes.length); break;
      case 'logloss': out = LG.logLoss.toFixed(2); break;
      case 'odds': out = LG.odds.toFixed(2); break;
      case 'oddsCut': out = Math.round((1 - LG.odds) * 100) + '%'; break;
      case 'snMin': out = WORDS[SPM.minCount] || String(SPM.minCount); break;
      case 'spamFa': out = String(SPM.confusionAt(Number(a[1])).fp); break;
      default: console.warn('unknown placeholder', spec); out = '?';
    }
    return isTex ? out.split(MINUS).join('-') : out;
  }
  (function fillPlaceholders() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.indexOf('{{') >= 0 && !/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => { n.nodeValue = n.nodeValue.replace(/\{\{([^}]+)\}\}/g, (m, s) => val(s)); });
  })();
  renderMath(document.body);

  /* predict-then-reveal boxes */
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
  const essayTip = (i, withModel) => {
    let s = '<b>Essay ' + (i + 1) + '</b> (made up)<br>' + E.x[i].toFixed(1) + ' words per sentence<br>teacher’s rating ' + E.y[i].toFixed(1);
    if (withModel) s += ' → ' + (LAB[i] ? 'readable' : 'not readable') + '<br>model: P(readable) = ' + LG.probs[i].toFixed(2);
    return s;
  };
  const spamTip = (i) => '<b>Email ' + (i + 1) + '</b> (made up)<br>“free” appears ' + SP.counts[i] + '×<br>' + (SP.labels[i] ? 'spam' : 'not spam') +
    '<br>model: P(spam) = ' + SPM.probs[i].toFixed(2);

  /* ------------------------------------------------------------------ drawing kit */
  function lin(d0, d1, r0, r1) {
    const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
    f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
    f.r0 = r0; f.r1 = r1; f.d0 = d0; f.d1 = d1;
    return f;
  }
  function geo(C0) {
    const M = C0.M;
    return { W: C0.W, H: C0.H, M: M, fs: M ? 10.5 : 12, ft: M ? 11 : 13, dr: M ? 4.8 : 6.2,
      m: M ? { l: 46, r: 12, t: 14, b: 46 } : { l: 68, r: 22, t: 22, b: 60 } };
  }
  function clipRect(defs, id, x, y, w, h) {
    const cp = el('clipPath', { id: id }, defs);
    el('rect', { x: x, y: y, width: w, height: h }, cp);
  }
  /* axes: sx, sy are lin() scales; o = { xt, yt, xtitle, ytitle, yfmt, ytx, grid } */
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
  /* a dot: circle (blue or ink) or diamond (orange), so colour is never the only cue */
  function dotAt(g, x, y, kind, r, tipHtml, op) {
    let n;
    if (kind === 'orange') {
      const d = r * 1.3;
      n = el('polygon', { points: x + ',' + (y - d) + ' ' + (x + d) + ',' + y + ' ' + x + ',' + (y + d) + ' ' + (x - d) + ',' + y, fill: C.orange, stroke: '#fff', 'stroke-width': 1.2 }, g);
    } else n = el('circle', { cx: x, cy: y, r: r, fill: kind === 'blue' ? C.blue : C.dot, stroke: '#fff', 'stroke-width': 1.2 }, g);
    if (op !== undefined && op < 1) n.setAttribute('opacity', op);
    if (tipHtml) n.setAttribute('data-tip', tipHtml);
    return n;
  }
  const ring = (g, x, y, r) => el('circle', { cx: x, cy: y, r: r + 4.5, fill: 'none', stroke: C.red, 'stroke-width': 2.2 }, g);
  const labKind = (i) => (LAB[i] ? 'blue' : 'orange');
  const spamKind = (i) => (SP.labels[i] ? 'orange' : 'blue');

  /* the essay plot used by chapters 1-3: x = words per sentence, y = rating */
  function essayFrame(G) {
    const m = G.m;
    return { sx: lin(5, 29, m.l, G.W - m.r), sy: lin(0, 105, G.H - m.b, m.t) };
  }
  const essayAxes = (g, G, f) => axes(g, G, f.sx, f.sy, {
    xt: [6, 10, 14, 18, 22, 26], yt: [0, 20, 40, 60, 80, 100],
    xtitle: 'average sentence length (words)', ytitle: G.M ? 'teacher’s rating (0–100)' : 'teacher’s readability rating (0–100)'
  });
  /* the label plot used by chapters 4-6: y = 0 / 1 with room above and below */
  const PY = [-0.45, 1.45];
  function labelFrame(G, yd) {
    const m = G.m, d = yd || PY;
    return { sx: lin(5, 29, m.l, G.W - m.r), sy: lin(d[0], d[1], G.H - m.b, m.t) };
  }
  const labelAxes = (g, G, f) => axes(g, G, f.sx, f.sy, {
    xt: [6, 10, 14, 18, 22, 26], yt: [0, 0.5, 1], yfmt: (v) => (v === 0 ? '0' : v === 1 ? '1' : '0.5'),
    xtitle: 'average sentence length (words)', ytitle: G.M ? 'readable? 1 = yes' : 'readable? (1 = yes, 0 = no)'
  });
  const lineSeg = (f, b0, b1, x0, x1) => 'M' + f.sx(x0).toFixed(1) + ',' + f.sy(b0 + b1 * x0).toFixed(1) + 'L' + f.sx(x1).toFixed(1) + ',' + f.sy(b0 + b1 * x1).toFixed(1);
  function curvePts(f, fn, x0, x1, step) {
    const pts = [];
    for (let x = x0; x <= x1 + 1e-9; x += step) pts.push([f.sx(x), f.sy(fn(x))]);
    return pts;
  }
  const probFn = (x) => LG.pAt(x);

  /* ------------------------------------------------------------------ scroll engine */
  const mq = window.matchMedia('(max-width: 920px)');
  const chapters = [];
  function register(id, build) {
    const chEl = document.getElementById(id);
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
      redraw: function () { draw(ch, ch.stage, ch.q, true); }
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
    try { ch.inst.render(stage, q); } catch (e) {
      console.error('Chapter ' + ch.id + ', step ' + stage + ' failed to render', e);
    }
  }

  const dotnav = document.getElementById('dotnav');
  const dotLinks = [];
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

  let ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
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
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', onScroll);
  window.addEventListener('hashchange', onScroll);

  /* ============================================================
     Chapter 1 - the data, and a line you draw yourself
     ============================================================ */
  register('ch1', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m;
    const f = essayFrame(G), sx = f.sx, sy = f.sy;
    const defs = el('defs', {}, svg);
    clipRect(defs, 'clip1', m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    const dyn = el('g', {}, svg);
    const hg = el('g', {}, svg);
    const endL = document.getElementById('endL'), endR = document.getElementById('endR');
    const XH = [8, 26];
    const ends = () => [LR.lineAt(S.line.b0, S.line.b1, XH[0]), LR.lineAt(S.line.b0, S.line.b1, XH[1])];
    function setEnd(i, y) {
      const e = ends(); e[i] = y;
      const b1 = (e[1] - e[0]) / (XH[1] - XH[0]);
      S.line = { b0: e[0] - b1 * XH[0], b1: b1 };
      S.touched = true; S.rev++;
      C0.redraw();
    }
    const svgY = (ev) => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse()).y;
    };
    const handles = [0, 1].map((i) => {
      const g = el('g', { class: 'handle', tabindex: 0, role: 'slider', 'aria-valuemin': 0, 'aria-valuemax': 100,
        'aria-label': i ? 'Right end of your line, at 26 words per sentence' : 'Left end of your line, at 8 words per sentence' }, hg);
      el('circle', { r: G.M ? 25 : 24, fill: 'transparent' }, g);
      el('circle', { r: G.M ? 12 : 11, fill: '#fff', stroke: C.accent, 'stroke-width': 3, class: 'hring' }, g);
      el('path', { d: 'M-4.5,-2H4.5M-4.5,2H4.5', stroke: C.accent, 'stroke-width': 1.5 }, g);
      /* touch-action does not apply to SVG children in every browser, so stop the page from scrolling
         when a finger starts on a handle (touches elsewhere on the figure still scroll the page) */
      g.addEventListener('touchstart', (ev) => ev.preventDefault(), { passive: false });
      g.addEventListener('touchmove', (ev) => ev.preventDefault(), { passive: false });
      g.addEventListener('pointerdown', (ev) => { ev.preventDefault(); g.setPointerCapture(ev.pointerId); g.dataset.drag = '1'; g.focus(); });
      g.addEventListener('pointermove', (ev) => { if (g.dataset.drag) setEnd(i, clamp(sy.inv(svgY(ev)), 0, 100)); });
      const stop = () => { delete g.dataset.drag; };
      g.addEventListener('pointerup', stop); g.addEventListener('pointercancel', stop);
      g.addEventListener('keydown', (ev) => {
        const step = ev.shiftKey ? 5 : 1;
        const d = ev.key === 'ArrowUp' || ev.key === 'ArrowRight' ? step : ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' ? -step
          : ev.key === 'PageUp' ? 10 : ev.key === 'PageDown' ? -10 : 0;
        if (d) { ev.preventDefault(); setEnd(i, clamp(ends()[i] + d, 0, 100)); }
      });
      return g;
    });
    endL.oninput = () => setEnd(0, +endL.value);
    endR.oninput = () => setEnd(1, +endR.value);
    document.getElementById('lineReset').onclick = () => {
      S.line = { b0: LR.DEFAULT_LINE[0], b1: LR.DEFAULT_LINE[1] }; S.touched = false; S.rev++; C0.redraw();
    };

    return {
      render: function (stage, q) {
        clear(dyn);
        axes(dyn, G, sx, sy, { xt: [6, 10, 14, 18, 22, 26], yt: [0, 20, 40, 60, 80, 100],
          xtitle: 'average sentence length (words)', ytitle: G.M ? 'teacher’s rating (0–100)' : 'teacher’s readability rating (0–100)' });
        const body = el('g', { 'clip-path': 'url(#clip1)' }, dyn);
        const dots = el('g', {}, dyn);
        const drawing = stage === 1;
        if (drawing) {
          const L = S.line;
          el('path', { d: lineSeg(f, L.b0, L.b1, 5, 29), fill: 'none', stroke: C.accent, 'stroke-width': 3.2,
            'stroke-dasharray': S.touched ? '' : '7 6', 'stroke-opacity': S.touched ? 1 : 0.7 }, body);
        }
        E.x.forEach((x, i) => {
          const v = drawing ? 1 : clamp(((q * 1.25 + 0.25) - (i / N) * 0.8) / 0.2, 0, 1);
          if (v > 0.01) dotAt(dots, sx(x), sy(E.y[i]) - (1 - ease(v)) * 22, 'ink', G.dr, essayTip(i, false), v);
        });
        hg.setAttribute('display', drawing ? 'inline' : 'none');
        ctlState(C0.ctl, drawing);
        if (drawing) {
          const e = ends();
          handles.forEach((g, i) => {
            const yy = clamp(e[i], 0, 100);
            g.setAttribute('transform', 'translate(' + sx(XH[i]).toFixed(1) + ',' + sy(yy).toFixed(1) + ')');
            g.setAttribute('aria-valuenow', Math.round(yy));
          });
          if (document.activeElement !== endL) endL.value = Math.round(clamp(e[0], 0, 100));
          if (document.activeElement !== endR) endR.value = Math.round(clamp(e[1], 0, 100));
          if (!S.touched) C0.cap('Drag the two handles (or the sliders) to draw your line. The dashed line is only a starter.');
          else C0.cap('Your line: ' + tex(eqTex(S.line.b0, S.line.b1)) + ' &middot; loss (mean squared error): <b>' + fmtInt(userMse()) + '</b> &middot; lower is better');
        } else {
          C0.cap(q < 0.45 ? 'Each dot is one made-up essay.' : N + ' made-up essays: average sentence length against a teacher’s readability rating.');
        }
      }
    };
  });

  /* ============================================================
     Chapter 2 - how wrong is a line?
     ============================================================ */
  register('ch2', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m;
    const f = essayFrame(G), sx = f.sx, sy = f.sy;
    const defs = el('defs', {}, svg);
    clipRect(defs, 'clip2', m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    const dyn = el('g', {}, svg);
    const ANCH = F.candidates.map((c) => [c.b0, c.b1]).concat([[OLS.b0, OLS.b1]]);
    const whose = () => (S.touched ? 'your line' : 'the starter line (go back and draw your own!)');

    return {
      render: function (stage, q) {
        clear(dyn);
        essayAxes(dyn, G, f);
        const body = el('g', { 'clip-path': 'url(#clip2)' }, dyn);
        const dots = el('g', {}, dyn);
        if (stage === 0) {
          const L = S.line, u = clamp(q / 0.65);
          const rr = (i) => clamp(u * 1.9 + 0.15 - i * 0.017, 0, 1);
          const sq = (i) => clamp(u * 1.9 - 0.55 - i * 0.017, 0, 1);
          E.x.forEach((x, i) => {
            const yd = sy(E.y[i]), yl = sy(LR.lineAt(L.b0, L.b1, x)), r = ease(rr(i)), s = ease(sq(i));
            const gap = Math.abs(yd - yl) * s;
            if (s > 0.01) el('rect', { x: sx(x), y: yd < yl ? yd : yd - gap, width: gap, height: gap, fill: C.orange, 'fill-opacity': 0.16, stroke: C.orange, 'stroke-opacity': 0.55, 'stroke-width': 1 }, body);
            if (r > 0.01) el('line', { x1: sx(x), x2: sx(x), y1: yd, y2: lerp(yd, yl, r), stroke: C.orange, 'stroke-width': 1.8 }, body);
          });
          el('path', { d: lineSeg(f, L.b0, L.b1, 5, 29), fill: 'none', stroke: C.accent, 'stroke-width': 3.2 }, body);
          E.x.forEach((x, i) => dotAt(dots, sx(x), sy(E.y[i]), 'ink', G.dr, essayTip(i, false)));
          const head = u < 0.3 ? 'Each gap between an essay and ' + whose() + ' is a residual.'
            : u < 0.75 ? 'Turn each gap into a square: squares cannot cancel out.' : 'Squares drawn for ' + whose() + '.';
          C0.cap(head + '<br>Average square (mean squared error): <b>' + fmtInt(userMse()) + '</b>');
        } else {
          const K = ANCH.length - 1, u = clamp(q / 0.9) * K;
          const k = Math.min(Math.floor(u), K - 1), t = ease(u - k);
          const b0 = lerp(ANCH[k][0], ANCH[k + 1][0], t), b1 = lerp(ANCH[k][1], ANCH[k + 1][1], t);
          const atBest = u >= K - 1e-9;
          for (let j = 0; j <= k; j++) el('path', { d: lineSeg(f, ANCH[j][0], ANCH[j][1], 5, 29), fill: 'none', stroke: C.grey, 'stroke-width': 1.6, 'stroke-opacity': 0.3 }, body);
          if (S.touched) el('path', { d: lineSeg(f, S.line.b0, S.line.b1, 5, 29), fill: 'none', stroke: C.accent, 'stroke-width': 2, 'stroke-dasharray': '6 5', 'stroke-opacity': 0.6 }, body);
          el('path', { d: lineSeg(f, b0, b1, 5, 29), fill: 'none', stroke: atBest ? C.teal : C.ink, 'stroke-width': 3.4 }, body);
          E.x.forEach((x, i) => dotAt(dots, sx(x), sy(E.y[i]), 'ink', G.dr, essayTip(i, false)));
          const cur = LR.mse(b0, b1, E.x, E.y);
          C0.cap(atBest ? 'The best line of all: loss <b>' + fmtInt(OLS.mse) + '</b>. The model must find it, blind.'
            : 'This line’s loss: <b>' + fmtInt(cur) + '</b> &middot; best possible: ' + fmtInt(OLS.mse) + (S.touched ? ' &middot; yours: ' + fmtInt(userMse()) : ''));
        }
      }
    };
  });

  /* ============================================================
     Chapter 3 - gradient descent, learning rate, the finished line
     ============================================================ */
  register('ch3', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m, M = G.M;
    const top = m.t + (M ? 22 : 26), bot = H - m.b;
    const PL = M ? [44, 176] : [68, 300], PR = M ? [222, 366] : [372, 616];
    const defs = el('defs', {}, svg);
    const full = essayFrame(G);
    clipRect(defs, 'clip3f', m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    clipRect(defs, 'clip3l', PL[0], top, PL[1] - PL[0], bot - top);
    clipRect(defs, 'clip3r', PR[0], top, PR[1] - PR[0], bot - top);
    const lf = { sx: lin(5, 29, PL[0], PL[1]), sy: lin(0, 105, bot, top) };
    const sb0 = lin(50, 145, PR[0], PR[1]), sb1 = lin(-4.8, 1.2, bot, top);
    const S0 = F.S, lmin = OLS.mse;
    /* the loss map: colour = loss on a log scale (yellow cold, red hot), drawn once into an image */
    let heatURL = null;
    try {
      const sc = 1.5, w = Math.round((PR[1] - PR[0]) * sc), h = Math.round((bot - top) * sc);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'), im = cx.createImageData(w, h), cap = Math.log(60);
      const c0 = hexRgb('#fff2b0'), c1 = hexRgb('#a81f1f');
      for (let py = 0; py < h; py++) {
        const b1 = sb1.inv(top + ((py + 0.5) / h) * (bot - top));
        for (let px = 0; px < w; px++) {
          const b0 = sb0.inv(PR[0] + ((px + 0.5) / w) * (PR[1] - PR[0]));
          const t = clamp(Math.log(LR.lossFromStats(S0, b0, b1) / lmin) / cap, 0, 1), o = (py * w + px) * 4;
          im.data[o] = c0[0] + (c1[0] - c0[0]) * t; im.data[o + 1] = c0[1] + (c1[1] - c0[1]) * t; im.data[o + 2] = c0[2] + (c1[2] - c0[2]) * t; im.data[o + 3] = 255;
        }
      }
      cx.putImageData(im, 0, 0);
      heatURL = cv.toDataURL();
    } catch (e) { console.error('loss map image failed', e); }
    const dyn = el('g', {}, svg);

    function leftPanel(g, line, extra) {
      axes(g, G, lf.sx, lf.sy, { xt: [10, 20], yt: [0, 50, 100], xtitle: M ? 'sentence length' : 'sentence length (words)', ytitle: 'rating', ytx: M ? 11 : 17 });
      T(g, (PL[0] + PL[1]) / 2, top - 8, M ? 'the line being tried' : 'the line being tried', G.ft, C.ink, { anchor: 'middle', weight: 600 });
      const cl = el('g', { 'clip-path': 'url(#clip3l)' }, g);
      if (extra) extra(cl);
      el('path', { d: lineSeg(lf, line[0], line[1], 5, 29), fill: 'none', stroke: line[2] || C.blue, 'stroke-width': 3.2 }, cl);
      E.x.forEach((x, i) => el('circle', { cx: lf.sx(x), cy: lf.sy(E.y[i]), r: G.dr * 0.6, fill: C.dot, 'fill-opacity': 0.5 }, cl));
    }
    function rightPanel(g) {
      T(g, (PR[0] + PR[1]) / 2, top - 8, M ? 'every possible line' : 'every possible line: colour = loss', G.ft, C.ink, { anchor: 'middle', weight: 600 });
      if (heatURL) el('image', { href: heatURL, x: PR[0], y: top, width: PR[1] - PR[0], height: bot - top, preserveAspectRatio: 'none' }, g);
      else el('rect', { x: PR[0], y: top, width: PR[1] - PR[0], height: bot - top, fill: '#f6e3a8' }, g);
      const cl = el('g', { 'clip-path': 'url(#clip3r)' }, g);
      F.ellipseLevels.forEach((lv) => {
        const pts = LR.lossEllipse(OLS, S0, lv, 120).map((p) => [sb0(p[0]), sb1(p[1])]);
        el('path', { d: pathD(pts) + 'Z', fill: 'none', stroke: '#fff', 'stroke-opacity': 0.65, 'stroke-width': 1 }, cl);
      });
      el('rect', { x: PR[0], y: top, width: PR[1] - PR[0], height: bot - top, fill: 'none', stroke: C.axis }, g);
      (M ? [60, 100, 140] : [60, 80, 100, 120, 140]).forEach((v) => {
        el('line', { x1: sb0(v), x2: sb0(v), y1: bot, y2: bot + 4, stroke: C.axis }, g);
        T(g, sb0(v), bot + G.fs + 6, String(v), G.fs, C.muted, { anchor: 'middle' });
      });
      [-4, -2, 0].forEach((v) => {
        el('line', { x1: PR[0] - 4, x2: PR[0], y1: sb1(v), y2: sb1(v), stroke: C.axis }, g);
        T(g, PR[0] - 7, sb1(v) + G.fs * 0.35, fmt(v, 0), G.fs, C.muted, { anchor: 'end' });
      });
      mathBox(g, PR[0], bot + G.fs + G.ft + 10 - 12, PR[1] - PR[0], 20, '\\beta_0\\ \\text{(start height)}', 'c', G.ft);
      /* y title for the map: slope, written at the top-left corner inside the panel */
      const yb = mathBox(g, PR[0] + 4, top + 2, 90, 20, '\\beta_1\\ \\text{(slope)}', '', G.ft - 1);
      yb.style.textShadow = '0 0 3px #fff, 0 0 3px #fff';
    }
    function marks(g, withStart) {
      const cl = el('g', { 'clip-path': 'url(#clip3r)' }, g);
      el('path', { d: 'M-6,-6L6,6M-6,6L6,-6', transform: 'translate(' + sb0(OLS.b0) + ',' + sb1(OLS.b1) + ')', stroke: '#fff', 'stroke-width': 3.4, fill: 'none' }, cl);
      el('path', { d: 'M-6,-6L6,6M-6,6L6,-6', transform: 'translate(' + sb0(OLS.b0) + ',' + sb1(OLS.b1) + ')', stroke: C.teal, 'stroke-width': 1.8, fill: 'none' }, cl);
      T(g, sb0(OLS.b0) + 8, sb1(OLS.b1) + (M ? 16 : 18), 'best', G.fs, C.ink, { halo: true, weight: 600 });
      if (withStart) {
        el('circle', { cx: sb0(F.traj.good[0][0]), cy: sb1(F.traj.good[0][1]), r: 4, fill: 'none', stroke: '#fff', 'stroke-width': 2 }, cl);
        T(g, sb0(F.traj.good[0][0]) - 6, sb1(F.traj.good[0][1]) - 8, 'start', G.fs, C.ink, { halo: true, weight: 600, anchor: 'end' });
      }
    }
    const dotsFull = (g, tipOn) => E.x.forEach((x, i) => dotAt(g, full.sx(x), full.sy(E.y[i]), 'ink', G.dr, tipOn ? essayTip(i, false) : null));

    /* stage 2: loss against step number, on a log axis */
    const YMIN = 30, YMAX = 1e6;
    const slog = lin(Math.log10(YMIN), Math.log10(YMAX), H - m.b, m.t), syL = (v) => slog(Math.log10(v));
    const sxS = lin(0, 60, m.l, W - m.r);
    const REG = {
      small: { color: C.grey, name: 'too small', traj: SMALL, alpha: LR.ALPHAS.small },
      good: { color: C.blue, name: 'just right', traj: GOOD, alpha: LR.ALPHAS.good },
      large: { color: C.orange, name: 'too big', traj: LARGE, alpha: LR.ALPHAS.large }
    };
    const aTxt = (a) => 'α = ' + String(Number(a.toPrecision(2)));
    Array.prototype.forEach.call(C0.ctl.querySelectorAll('button'), (b) => {
      b.onclick = () => {
        S.lr = b.getAttribute('data-lr'); S.rev++;
        Array.prototype.forEach.call(C0.ctl.querySelectorAll('button'), (o) => o.setAttribute('aria-pressed', String(o === b)));
        C0.redraw();
      };
    });

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlState(C0.ctl, stage === 2);
        Array.prototype.forEach.call(C0.ctl.querySelectorAll('button'), (b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-lr') === S.lr)));
        if (stage === 0 || stage === 1) {
          const T0 = GOOD;
          if (stage === 0) {
            const u = clamp(q / 0.85) * (T0.length - 1), k = Math.min(Math.floor(u), T0.length - 2), t = u - k;
            const b0 = lerp(T0[k][0], T0[k + 1][0], t), b1 = lerp(T0[k][1], T0[k + 1][1], t), loss = lerp(T0[k][2], T0[k + 1][2], t);
            leftPanel(dyn, [b0, b1]);
            const gR = el('g', {}, dyn); rightPanel(gR);
            const cl = el('g', { 'clip-path': 'url(#clip3r)' }, dyn);
            const trail = T0.slice(0, k + 1).map((r) => [sb0(r[0]), sb1(r[1])]); trail.push([sb0(b0), sb1(b1)]);
            el('path', { d: pathD(trail), fill: 'none', stroke: C.ink, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, cl);
            marks(dyn, true);
            el('circle', { cx: sb0(b0), cy: sb1(b1), r: M ? 5.5 : 7, fill: C.ink, stroke: '#fff', 'stroke-width': 1.8 }, cl);
            C0.cap(u >= T0.length - 1.001
              ? 'Arrived: loss <b>' + fmtInt(loss) + '</b>, almost the best possible (' + fmtInt(OLS.mse) + '). Colour = loss: yellow low, red high.'
              : 'Loss now: <b>' + fmtInt(loss) + '</b> (mean squared error) &mdash; feel the slope, step downhill, repeat.<br>Colour = loss: yellow low, red high.');
          } else {
            const vp = LR.valleyPoint(OLS, S0, 2, +1), vm = LR.valleyPoint(OLS, S0, 2, -1);
            const s = Math.sin(2 * Math.PI * (q - 0.1));
            const b0 = OLS.b0 + s * (vp.b0 - OLS.b0), b1 = OLS.b1 + s * (vp.b1 - OLS.b1);
            const loss = LR.mse(b0, b1, E.x, E.y);
            leftPanel(dyn, [b0, b1, C.accent], (cl) => el('path', { d: lineSeg(lf, OLS.b0, OLS.b1, 5, 29), fill: 'none', stroke: C.teal, 'stroke-width': 2, 'stroke-dasharray': '6 5' }, cl));
            const gR = el('g', {}, dyn); rightPanel(gR);
            const cl = el('g', { 'clip-path': 'url(#clip3r)' }, dyn);
            el('path', { d: pathD(GOOD.map((r) => [sb0(r[0]), sb1(r[1])])), fill: 'none', stroke: C.ink, 'stroke-opacity': 0.35, 'stroke-width': 1.6 }, cl);
            const fa = LR.valleyPoint(OLS, S0, 9, +1), fb = LR.valleyPoint(OLS, S0, 9, -1);
            el('path', { d: pathD([[sb0(fa.b0), sb1(fa.b1)], [sb0(fb.b0), sb1(fb.b1)]]), stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '3 4', fill: 'none' }, cl);
            marks(dyn, false);
            el('circle', { cx: sb0(b0), cy: sb1(b1), r: M ? 5.5 : 7, fill: C.accent, stroke: '#fff', 'stroke-width': 1.8 }, cl);
            C0.cap('Along the valley floor: start height <b>' + b0.toFixed(0) + '</b>, slope <b>' + fmt(b1, 2) + '</b> &rarr; loss <b>' + fmtInt(loss) +
              '</b> (best: ' + fmtInt(OLS.mse) + '). The line only pivots.');
          }
        } else if (stage === 2) {
          axes(dyn, G, sxS, lin(0, 1, H - m.b, m.t), { xt: [0, 20, 40, 60], yt: [], xtitle: 'training step', ytitle: M ? 'loss (log scale)' : 'loss (mean squared error, log scale)' });
          [100, 1000, 10000, 100000, 1000000].forEach((v) => {
            el('line', { x1: m.l, x2: W - m.r, y1: syL(v), y2: syL(v), stroke: C.grid }, dyn);
            T(dyn, m.l - 7, syL(v) + G.fs * 0.35, v >= 1e6 ? '1M' : v >= 1000 ? v / 1000 + 'k' : String(v), G.fs, C.muted, { anchor: 'end' });
          });
          const cl = el('g', { 'clip-path': 'url(#clip3f)' }, dyn);
          el('line', { x1: m.l, x2: W - m.r, y1: syL(OLS.mse), y2: syL(OLS.mse), stroke: C.teal, 'stroke-dasharray': '5 5', 'stroke-width': 1.6 }, cl);
          T(dyn, W - m.r - 4, syL(OLS.mse) - 6, 'best possible: ' + fmtInt(OLS.mse), G.fs, C.teal, { anchor: 'end', halo: true, weight: 600 });
          const stepNow = clamp(q / 0.8) * 59;
          ['small', 'large', 'good'].forEach((key) => {
            const R = REG[key], sel = S.lr === key, tr = R.traj;
            const pts = [];
            let exit = null;
            const last = Math.min(Math.floor(stepNow), tr.length - 1);
            for (let i = 0; i <= last; i++) {
              const v = tr[i][2];
              if (v > YMAX) { if (pts.length) { const pv = tr[i - 1][2], tt = (Math.log(YMAX) - Math.log(pv)) / (Math.log(v) - Math.log(pv)); exit = [sxS(i - 1 + tt), syL(YMAX)]; pts.push(exit); } break; }
              pts.push([sxS(i), syL(v)]);
            }
            if (!pts.length) return;
            el('path', { d: pathD(pts), fill: 'none', stroke: R.color, 'stroke-width': sel ? 4 : 2.2, 'stroke-opacity': sel ? 1 : 0.55, 'stroke-linejoin': 'round' }, cl);
            const end = pts[pts.length - 1], full = stepNow >= tr.length - 1 - 1e-9 || exit;
            const lbl = R.name + ': ' + aTxt(R.alpha);
            if (key === 'large' && exit) {
              T(dyn, end[0] + 8, end[1] + (M ? 16 : 18), lbl, G.fs, C.orange, { halo: true, weight: 700 });
              T(dyn, end[0], Math.max(end[1] - 8, G.fs + 3), '▲', G.fs, C.orange, { anchor: 'middle' });
            } else if (key === 'small') {
              if (pts.length > 8) T(dyn, end[0], end[1] - 9, lbl, G.fs, C.muted, { anchor: 'end', halo: true, weight: 700 });
            } else if (key === 'good' && full) {
              T(dyn, end[0] + 8, end[1] + (M ? 14 : 16), lbl, G.fs, C.blue, { halo: true, weight: 700 });
            }
            if (sel) el('circle', { cx: end[0], cy: end[1], r: M ? 5 : 6.5, fill: R.color, stroke: '#fff', 'stroke-width': 1.8 }, cl);
          });
          const R = REG[S.lr], tr = R.traj, ix = Math.min(Math.round(stepNow), tr.length - 1);
          const now = tr[ix][2];
          const msg = S.lr === 'small' ? 'Too small (' + aTxt(R.alpha) + '): crawls. After ' + ix + ' steps the loss is ' + fmtInt(now) + '.'
            : S.lr === 'good' ? 'Just right (' + aTxt(R.alpha) + '): a calm descent. Loss after ' + ix + ' steps: ' + fmtInt(now) + '.'
            : 'Too big (' + aTxt(R.alpha) + '): each step overshoots the valley. Loss after ' + ix + ' steps: ' + fmtBig(now) + '.';
          C0.cap(msg + '<br>The step sizes refer to the rescaled problem.');
        } else {
          essayAxes(dyn, G, full);
          const body = el('g', { 'clip-path': 'url(#clip3f)' }, dyn);
          if (S.touched) el('path', { d: lineSeg(full, S.line.b0, S.line.b1, 5, 29), fill: 'none', stroke: C.accent, 'stroke-width': 2, 'stroke-dasharray': '6 5', 'stroke-opacity': 0.6 }, body);
          el('path', { d: lineSeg(full, OLS.b0, OLS.b1, 5, 29), fill: 'none', stroke: C.blue, 'stroke-width': 3.4 }, body);
          const yAt = (x) => LR.lineAt(OLS.b0, OLS.b1, x);
          const st = ease(clamp((q - 0.1) / 0.35));
          if (st > 0) {
            const x0 = 14, n = 5, shown = Math.max(1, Math.floor(st * n + 0.001)), pts = [[full.sx(x0), full.sy(yAt(x0))]];
            for (let k = 0; k < shown; k++) {
              pts.push([full.sx(x0 + k + 1), full.sy(yAt(x0 + k))]);
              pts.push([full.sx(x0 + k + 1), full.sy(yAt(x0 + k + 1))]);
            }
            el('path', { d: pathD(pts), fill: 'none', stroke: C.orange, 'stroke-width': 2.4, 'stroke-linejoin': 'miter' }, body);
            T(dyn, full.sx(x0 + 2.5), full.sy(yAt(x0)) - (M ? 24 : 30), 'each extra word:', G.fs, C.orange, { anchor: 'middle', halo: true, weight: 700 });
            T(dyn, full.sx(x0 + 2.5), full.sy(yAt(x0)) - (M ? 11 : 14), fmt(OLS.b1, 2) + ' points', G.fs, C.orange, { anchor: 'middle', halo: true, weight: 700 });
          }
          dotsFull(dyn, true);
          const nv = ease(clamp((q - 0.4) / 0.4));
          if (nv > 0) {
            const px = full.sx(12), py0 = full.sy(0), pyT = full.sy(yAt(12)), py = lerp(py0, pyT, nv);
            el('line', { x1: px, x2: px, y1: py0, y2: py, stroke: C.ink, 'stroke-dasharray': '4 4', 'stroke-width': 1.6 }, dyn);
            el('circle', { cx: px, cy: py, r: G.dr + 1.5, fill: '#fff', stroke: C.blue, 'stroke-width': 3 }, dyn);
            if (nv > 0.9) T(dyn, px + 10, full.sy(14), 'new essay, 12 words: ŷ ≈ ' + Math.round(yAt(12)), G.ft, C.blue, { halo: true, weight: 700 });
          }
          const head = q < 0.1 ? 'The finished line: ' + tex(eqTex(OLS.b0, OLS.b1)) : q < 0.5 ? 'Each extra word per sentence lowers the prediction by about ' + Math.abs(OLS.b1).toFixed(1) + ' points.'
            : 'A new essay with 12-word sentences: ' + tex('\\hat y \\approx ' + Math.round(yAt(12)));
          C0.cap(head + '<br>Loss of this line: <b>' + fmtInt(OLS.mse) + '</b>' + (S.touched ? ' &middot; your line: ' + fmtInt(userMse()) : ''));
        }
      }
    };
  });

  /* ============================================================
     Chapter 4 - the pivot to yes/no, and why the number machine fails
     ============================================================ */
  register('ch4', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m;
    const fe = essayFrame(G), fl = labelFrame(G);
    const defs = el('defs', {}, svg);
    clipRect(defs, 'clip4', m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    const dyn = el('g', {}, svg);
    function bands(g, op) {
      const x0 = m.l, w = W - m.r - m.l;
      el('rect', { x: x0, y: fl.sy(1.0), width: w, height: fl.sy(0.5) - fl.sy(1.0), fill: C.blue, 'fill-opacity': 0.06 * op }, g);
      el('rect', { x: x0, y: fl.sy(0.5), width: w, height: fl.sy(0) - fl.sy(0.5), fill: C.orange, 'fill-opacity': 0.07 * op }, g);
      T(g, W - m.r - 6, fl.sy(1) - 8, G.M ? 'readable (1)' : 'readable (yes = 1)', G.fs, C.blue, { anchor: 'end', op: op, weight: 600 });
      T(g, m.l + 6, fl.sy(0) + G.fs + 6, G.M ? 'not readable (0)' : 'not readable (no = 0)', G.fs, '#8a4a07', { op: op, weight: 600 });
    }
    return {
      render: function (stage, q) {
        clear(dyn);
        if (stage === 0) {
          const u = clamp(q / 0.7);
          const gS = el('g', { opacity: 1 - clamp((u - 0.2) / 0.12) }, dyn);
          axes(gS, G, fe.sx, fe.sy, { xt: [6, 10, 14, 18, 22, 26], yt: [0, 20, 40, 60, 80, 100], xtitle: 'average sentence length (words)', ytitle: G.M ? 'teacher’s rating (0–100)' : 'teacher’s readability rating (0–100)' });
          el('line', { x1: m.l, x2: W - m.r, y1: fe.sy(LR.PASS_MARK), y2: fe.sy(LR.PASS_MARK), stroke: C.red, 'stroke-dasharray': '6 5', 'stroke-width': 1.8 }, gS);
          T(gS, W - m.r - 6, fe.sy(LR.PASS_MARK) - 7, 'pass mark: ' + LR.PASS_MARK, G.fs, C.red, { anchor: 'end', weight: 700, halo: true });
          const gL = el('g', { opacity: clamp((u - 0.3) / 0.12) }, dyn);
          axes(gL, G, fl.sx, fl.sy, { xt: [6, 10, 14, 18, 22, 26], yt: [0, 0.5, 1], yfmt: (v) => (v === 0 ? '0' : v === 1 ? '1' : '0.5'), xtitle: 'average sentence length (words)', ytitle: G.M ? 'readable? 1 = yes' : 'readable? (1 = yes, 0 = no)', grid: false });
          bands(gL, 1);
          const dots = el('g', {}, dyn);
          E.x.forEach((x, i) => {
            const t = ease(clamp(u * 1.5 - (i / N) * 0.5));
            const y = lerp(fe.sy(E.y[i]), fl.sy(LAB[i]), t);
            dotAt(dots, fe.sx(x), y, t > 0.5 ? labKind(i) : 'ink', G.dr, essayTip(i, false));
          });
          C0.cap(u < 0.35 ? 'Same essays, new question: is the rating at least ' + LR.PASS_MARK + '?'
            : u < 0.95 ? 'Each dot slides to its answer: 1 = readable, 0 = not.'
              : F.nReadable + ' readable (blue circles), ' + F.nNotReadable + ' not readable (orange diamonds). The rating is gone; only the label remains.');
        } else {
          axes(dyn, G, fl.sx, fl.sy, { xt: [6, 10, 14, 18, 22, 26], yt: [0, 0.5, 1], yfmt: (v) => (v === 0 ? '0' : v === 1 ? '1' : '0.5'), xtitle: 'average sentence length (words)', ytitle: G.M ? 'readable? 1 = yes' : 'readable? (1 = yes, 0 = no)', grid: false });
          bands(dyn, 1);
          el('rect', { x: m.l, y: fl.sy(1), width: W - m.r - m.l, height: fl.sy(0) - fl.sy(1), fill: 'none', stroke: C.grey, 'stroke-dasharray': '2 4' }, dyn);
          const L = F.linOnLabels, u = clamp(0.35 + q);
          const body = el('g', { 'clip-path': 'url(#clip4)' }, dyn);
          const xe = 5 + 24 * u;
          const xa = (1 - L.b0) / L.b1, xb = (0 - L.b0) / L.b1; /* where the line crosses 1 and 0 */
          const segs = [[5, Math.min(xa, xe), C.red], [xa, Math.min(xb, xe), C.grey], [xb, xe, C.red]];
          segs.forEach((s) => { if (s[1] > s[0] + 1e-6) el('path', { d: lineSeg(fl, L.b0, L.b1, s[0], s[1]), fill: 'none', stroke: s[2], 'stroke-width': 3.4, 'stroke-linecap': 'round' }, body); });
          const dots = el('g', {}, dyn);
          E.x.forEach((x, i) => dotAt(dots, fl.sx(x), fl.sy(LAB[i]), labKind(i), G.dr, essayTip(i, false)));
          if (u > 0.4) {
            T(dyn, fl.sx(6) + 8, fl.sy(L.at6) - 9, fmt(L.at6, 2) + '?!', G.ft, C.red, { weight: 700, halo: true });
            if (u > 0.9) T(dyn, fl.sx(28) - 4, fl.sy(L.at28) - 9, fmt(L.at28, 2) + '?!', G.ft, C.red, { weight: 700, halo: true, anchor: 'end' });
          }
          C0.cap(u < 0.4 ? 'Fit the line machine to the 1s and 0s: it still answers with a number.'
            : 'The line says <b>' + fmt(L.at6, 2) + '</b> at 6 words and <b>' + fmt(L.at28, 2) + '</b> at 28. Red = outside 0 to 1: not a probability.');
        }
      }
    };
  });

  /* ============================================================
     Chapter 5 - squish, decide, penalty, odds
     ============================================================ */
  register('ch5', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m, M = G.M;
    const PYC = [-0.2, 1.2];
    const fl = labelFrame(G, PYC);
    const defs = el('defs', {}, svg);
    clipRect(defs, 'clip5', m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    const top = m.t + (M ? 22 : 26), bot = H - m.b;
    const PL = M ? [44, 190] : [68, 318], PR = M ? [212, 366] : [352, 616];
    clipRect(defs, 'clip5l', PL[0], top, PL[1] - PL[0], bot - top);
    clipRect(defs, 'clip5r', PR[0], top, PR[1] - PR[0], bot - top);
    const dyn = el('g', {}, svg);
    const yAxisL = [0, 0.5, 1], yf = (v) => (v === 0 ? '0' : v === 1 ? '1' : '0.5');

    function squish(q) {
      const sxl = lin(5, 29, PL[0], PL[1]), szl = lin(-7, 5, bot, top);
      const sxr = lin(0, 1, PR[0], PR[1]);
      axes(dyn, G, sxl, szl, { xt: [10, 20], yt: [-6, -3, 0, 3], yfmt: (v) => fmt(v, 0), xtitle: M ? 'sentence length' : 'sentence length (words)', ytitle: 'z (evidence)', ytx: M ? 10 : 16 });
      T(dyn, (PL[0] + PL[1]) / 2, top - 8, 'the line’s score z', G.ft, C.ink, { anchor: 'middle', weight: 600 });
      el('line', { x1: PR[0], x2: PR[1], y1: bot, y2: bot, stroke: C.axis }, dyn);
      el('line', { x1: PR[0], x2: PR[0], y1: bot, y2: top, stroke: C.axis }, dyn);
      [0, 0.5, 1].forEach((v) => {
        el('line', { x1: sxr(v), x2: sxr(v), y1: bot, y2: bot + 4, stroke: C.axis }, dyn);
        T(dyn, sxr(v), bot + G.fs + 6, v === 0 ? '0' : v === 1 ? '1' : '0.5', G.fs, C.muted, { anchor: 'middle' });
      });
      T(dyn, (PR[0] + PR[1]) / 2, bot + G.fs + G.ft + 10, M ? 'P(readable)' : 'squashed: P(readable)', G.ft, C.muted, { anchor: 'middle' });
      T(dyn, (PR[0] + PR[1]) / 2, top - 8, 'the S-curve σ', G.ft, C.ink, { anchor: 'middle', weight: 600 });
      el('line', { x1: PL[0], x2: PR[1], y1: szl(0), y2: szl(0), stroke: C.grey, 'stroke-dasharray': '4 4' }, dyn);
      T(dyn, PL[1] - 4, szl(0) - 5, 'z = 0', G.fs, C.muted, { anchor: 'end', halo: true });
      const cl = el('g', { 'clip-path': 'url(#clip5l)' }, dyn);
      el('path', { d: pathD([[sxl(5), szl(LG.zAt(5))], [sxl(29), szl(LG.zAt(29))]]), fill: 'none', stroke: C.blue, 'stroke-width': 3.2 }, cl);
      const cr = el('g', { 'clip-path': 'url(#clip5r)' }, dyn);
      const sc = []; for (let z = -7; z <= 5.001; z += 0.2) sc.push([sxr(LR.sigmoid(z)), szl(z)]);
      el('path', { d: pathD(sc), fill: 'none', stroke: C.blue, 'stroke-width': 3.2 }, cr);
      [6, 10, 15.2, 20, 28].forEach((x) => {
        const z = LG.zAt(x);
        el('circle', { cx: sxl(x), cy: szl(z), r: 3.2, fill: C.accent, 'fill-opacity': 0.35 }, dyn);
        el('circle', { cx: sxr(LR.sigmoid(z)), cy: szl(z), r: 3.2, fill: C.accent, 'fill-opacity': 0.35 }, dyn);
      });
      const xp = 6 + 22 * clamp(q / 0.9), z = LG.zAt(xp), p = LR.sigmoid(z);
      el('line', { x1: sxl(xp), x2: sxr(p), y1: szl(z), y2: szl(z), stroke: C.accent, 'stroke-width': 1.8, 'stroke-dasharray': '5 4' }, dyn);
      el('line', { x1: sxr(p), x2: sxr(p), y1: szl(z), y2: bot, stroke: C.accent, 'stroke-width': 1.4, 'stroke-dasharray': '2 3' }, dyn);
      el('circle', { cx: sxl(xp), cy: szl(z), r: G.dr, fill: C.accent, stroke: '#fff', 'stroke-width': 1.8 }, dyn);
      el('circle', { cx: sxr(p), cy: szl(z), r: G.dr, fill: C.accent, stroke: '#fff', 'stroke-width': 1.8 }, dyn);
      C0.cap('A ' + xp.toFixed(0) + '-word essay: score z = <b>' + fmt(z, 1) + '</b> &rarr; squashed to P(readable) = <b>' + p.toFixed(2) + '</b>');
    }

    function curveView(g, o) {
      axes(g, G, fl.sx, fl.sy, { xt: [6, 10, 14, 18, 22, 26], yt: yAxisL, yfmt: yf, xtitle: 'average sentence length (words)', ytitle: M ? 'P(readable)' : 'probability of readable', grid: true });
      return el('g', { 'clip-path': 'url(#clip5)' }, g);
    }

    return {
      render: function (stage, q) {
        clear(dyn);
        if (stage === 0) { squish(q); return; }
        if (stage === 1) {
          const body = curveView(dyn);
          const bx = fl.sx(LG.boundary);
          const ob = ease(clamp((q - 0.2) / 0.3)), ot = ease(clamp(q / 0.3)), om = ease(clamp((q - 0.45) / 0.3));
          el('rect', { x: m.l, y: m.t, width: bx - m.l, height: H - m.t - m.b, fill: C.blue, 'fill-opacity': 0.06 * ob }, body);
          el('rect', { x: bx, y: m.t, width: W - m.r - bx, height: H - m.t - m.b, fill: C.orange, 'fill-opacity': 0.07 * ob }, body);
          if (ob > 0.5) {
            T(dyn, bx - 6, m.t + G.fs + 4, 'say yes', G.fs, C.blue, { anchor: 'end', weight: 700 });
            T(dyn, bx + 6, m.t + G.fs + 4, 'say no', G.fs, '#8a4a07', { weight: 700 });
          }
          el('line', { x1: m.l, x2: W - m.r, y1: fl.sy(0.5), y2: fl.sy(0.5), stroke: C.red, 'stroke-dasharray': '6 5', 'stroke-width': 1.8, opacity: ot }, body);
          if (ot > 0.5) T(dyn, W - m.r - 6, fl.sy(0.5) - 7, 'threshold 0.5', G.fs, C.red, { anchor: 'end', weight: 700, halo: true });
          el('line', { x1: bx, x2: bx, y1: fl.sy(0), y2: fl.sy(1), stroke: C.accent, 'stroke-dasharray': '6 5', 'stroke-width': 1.8, opacity: ob }, body);
          if (ob > 0.5) T(dyn, bx + 6, fl.sy(0.5) + (M ? 26 : 30), M ? 'boundary: ' + LG.boundary.toFixed(1) : 'decision boundary: ' + LG.boundary.toFixed(1) + ' words', G.fs, C.accent, { weight: 700, halo: true });
          el('path', { d: pathD(curvePts(fl, probFn, 5, 29, 0.25)), fill: 'none', stroke: C.blue, 'stroke-width': 3.4 }, body);
          E.x.forEach((x, i) => dotAt(dyn, fl.sx(x), fl.sy(LAB[i]), labKind(i), G.dr, essayTip(i, true)));
          if (om > 0.01) LG.mistakes.forEach((i) => { const r = ring(dyn, fl.sx(E.x[i]), fl.sy(LAB[i]), G.dr); r.setAttribute('opacity', om); });
          C0.cap(q < 0.3 ? 'Every essay gets P(readable) from the S-curve.' : q < 0.6 ? 'Threshold 0.5: above it say yes, below it say no. The curve crosses it at ' + LG.boundary.toFixed(1) + ' words.'
            : '<b>' + LG.nCorrect + ' of ' + N + '</b> correct. Red rings: the ' + LG.mistakes.length + ' mistakes. Blue circle = readable, orange diamond = not.');
          return;
        }
        if (stage === 2) {
          const sxp = lin(0, 1, m.l, W - m.r), syp = lin(0, 3.6, H - m.b, m.t);
          axes(dyn, G, sxp, syp, { xt: [0, 0.25, 0.5, 0.75, 1], yt: [0, 1, 2, 3], xfmt: (v) => String(v), xtitle: M ? 'P given to the right answer' : 'probability the model gave to the right answer', ytitle: M ? 'penalty' : 'penalty = −ln(p)' });
          const cl = el('g', { 'clip-path': 'url(#clip5)' }, dyn);
          const pts = []; for (let p = 0.03; p <= 1.0001; p += 0.01) pts.push([sxp(p), syp(-Math.log(p))]);
          el('path', { d: pathD(pts), fill: 'none', stroke: C.ink, 'stroke-width': 2.4 }, cl);
          el('line', { x1: m.l, x2: W - m.r, y1: syp(LG.logLoss), y2: syp(LG.logLoss), stroke: C.teal, 'stroke-dasharray': '5 5', 'stroke-width': 1.6 }, cl);
          T(dyn, W - m.r - 4, syp(LG.logLoss) - 6, 'average = ' + LG.logLoss.toFixed(2), G.fs, C.teal, { anchor: 'end', weight: 700, halo: true });
          const pEx = 0.9, vEx = -Math.log(pEx);
          el('circle', { cx: sxp(pEx), cy: syp(vEx), r: G.dr + 1.5, fill: '#fff', stroke: C.accent, 'stroke-width': 2.6 }, dyn);
          el('line', { x1: sxp(pEx), y1: syp(vEx) - G.dr - 3, x2: sxp(pEx), y2: syp(0.9) - (M ? 34 : 40), stroke: C.accent, 'stroke-width': 1.2 }, dyn);
          T(dyn, sxp(pEx), syp(0.9) - (M ? 38 : 45), M ? 'right, p = 0.9: penalty 0.11' : 'right and fairly sure (p = 0.9): penalty ' + vEx.toFixed(2), G.fs, C.accent, { anchor: 'end', weight: 700, halo: true });
          E.x.forEach((x, i) => {
            const pr = LAB[i] ? LG.probs[i] : 1 - LG.probs[i], pen = LR.logLossOne(LG.probs[i], LAB[i]);
            const v = rev(q, i, N);
            if (v < 0.02) return;
            dotAt(dyn, sxp(pr), syp(pen), labKind(i), G.dr * 0.85, essayTip(i, true), v);
            if (pr < 0.5) ring(dyn, sxp(pr), syp(pen), G.dr * 0.85).setAttribute('opacity', v);
          });
          const wp = LAB[worstIdx] ? LG.probs[worstIdx] : 1 - LG.probs[worstIdx], wv = LR.logLossOne(LG.probs[worstIdx], LAB[worstIdx]);
          if (q > 0.7) T(dyn, sxp(wp) + 12, syp(wv) + (M ? 3 : 4), 'sure and wrong: ' + wv.toFixed(1), G.fs, C.red, { weight: 700, halo: true });
          C0.cap('Each dot is one essay. Right and sure: tiny penalty. Wrong and sure: tall bar. Average penalty (log-loss): <b>' + LG.logLoss.toFixed(2) + '</b>.');
          return;
        }
        /* stage 3: odds */
        const body = curveView(dyn);
        el('path', { d: pathD(curvePts(fl, probFn, 5, 29, 0.25)), fill: 'none', stroke: C.blue, 'stroke-width': 3.4 }, body);
        const odds = (x) => LG.pAt(x) / (1 - LG.pAt(x));
        const x1 = 12, x2 = 13, o2 = ease(clamp((q - 0.15) / 0.3)), ob = ease(clamp((q - 0.4) / 0.4));
        [[x1, 1], [x2, o2]].forEach((a) => {
          if (a[1] <= 0) return;
          const p = LG.pAt(a[0]);
          el('line', { x1: fl.sx(a[0]), x2: fl.sx(a[0]), y1: fl.sy(0), y2: fl.sy(p), stroke: C.accent, 'stroke-dasharray': '4 4', 'stroke-width': 1.6, opacity: a[1] }, dyn);
          el('circle', { cx: fl.sx(a[0]), cy: fl.sy(p), r: G.dr + 1, fill: '#fff', stroke: C.accent, 'stroke-width': 2.8, opacity: a[1] }, dyn);
        });
        const bx0 = fl.sx(19.5), unit = M ? 22 : 38, by1 = fl.sy(0.92), by2 = fl.sy(0.74), bh = M ? 13 : 18;
        T(dyn, bx0, by1 - 6, '12 words: odds ' + odds(x1).toFixed(1) + ' to 1', G.fs, C.accent, { weight: 700 });
        el('rect', { x: bx0, y: by1, width: odds(x1) * unit, height: bh, fill: C.accent, 'fill-opacity': 0.85 }, dyn);
        if (ob > 0) {
          T(dyn, bx0, by2 - 6, '13 words: odds ' + odds(x2).toFixed(1) + ' to 1', G.fs, C.accent, { weight: 700, op: ob });
          el('rect', { x: bx0, y: by2, width: odds(x2) * unit * ob + odds(x1) * unit * (1 - ob), height: bh, fill: C.accent, 'fill-opacity': 0.55 }, dyn);
          if (ob > 0.9) T(dyn, bx0 + odds(x2) * unit + 8, by2 + bh - 3, '× ' + LG.odds.toFixed(2), G.ft, C.accent, { weight: 700 });
        }
        C0.cap('One more word: the odds of “readable” shrink to <b>' + LG.odds.toFixed(2) + '</b> of what they were (a cut of ' + Math.round((1 - LG.odds) * 100) + '%).');
      }
    };
  });

  /* ============================================================
     Chapter 6 - spam, and the two lenses
     ============================================================ */
  register('ch6', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m, M = G.M;
    const defs = el('defs', {}, svg);
    clipRect(defs, 'clip6', m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    const top = m.t + (M ? 22 : 26), bot = H - (M ? 74 : 96);
    const PL = M ? [44, 176] : [68, 300], PR = M ? [222, 366] : [372, 616];
    clipRect(defs, 'clip6l', PL[0], top, PL[1] - PL[0], bot - top);
    clipRect(defs, 'clip6r', PR[0], top, PR[1] - PR[0], bot - top);
    const dyn = el('g', {}, svg);
    const thrOut = document.getElementById('thrOut'), thr = document.getElementById('thr');
    thr.oninput = () => { S.thr = +thr.value; S.rev++; C0.redraw(); };
    /* spam dots stacked when they coincide */
    const jitter = (function () {
      const groups = {}, y = new Array(NS_).fill(0);
      SP.counts.forEach((c, i) => { const k = c + '-' + SP.labels[i]; (groups[k] = groups[k] || []).push(i); });
      Object.keys(groups).forEach((k) => groups[k].forEach((i, j) => { y[i] = (j - (groups[k].length - 1) / 2) * (M ? 8 : 10.5); }));
      return y;
    })();

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlState(C0.ctl, stage === 0);
        C0.ctl.style.visibility = stage === 0 ? 'visible' : 'hidden';
        thr.value = S.thr; thrOut.textContent = S.thr.toFixed(2);
        if (stage === 0) {
          const sxs = lin(-0.6, 9.6, m.l, W - m.r), sys = lin(-0.2, 1.2, H - m.b, m.t);
          axes(dyn, G, sxs, sys, { xt: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], yt: [0, 0.5, 1], yfmt: (v) => (v === 0 ? '0' : v === 1 ? '1' : '0.5'),
            xtitle: 'times “free” appears in the email', ytitle: M ? 'P(spam)' : 'probability of spam' });
          const body = el('g', { 'clip-path': 'url(#clip6)' }, dyn);
          const t = S.thr, cstar = (LR.logit(t) - SPM.b0) / SPM.b1;
          el('rect', { x: sxs(cstar), y: m.t, width: Math.max(0, W - m.r - sxs(cstar)), height: H - m.t - m.b, fill: C.orange, 'fill-opacity': 0.08 }, body);
          el('line', { x1: sxs(cstar), x2: sxs(cstar), y1: sys(1.2), y2: sys(-0.2), stroke: C.orange, 'stroke-dasharray': '5 4', 'stroke-width': 1.6 }, body);
          T(dyn, Math.min(sxs(cstar) + 6, W - m.r - 80), m.t + G.fs + 3, 'flagged as spam →', G.fs, '#8a4a07', { weight: 700 });
          el('line', { x1: m.l, x2: W - m.r, y1: sys(t), y2: sys(t), stroke: C.red, 'stroke-dasharray': '6 5', 'stroke-width': 1.8 }, body);
          T(dyn, m.l + 6, sys(t) - 7, 'threshold ' + t.toFixed(2), G.fs, C.red, { weight: 700, halo: true });
          const pts = []; for (let c = -0.5; c <= 9.5001; c += 0.1) pts.push([sxs(c), sys(SPM.pAt(c))]);
          el('path', { d: pathD(pts), fill: 'none', stroke: C.blue, 'stroke-width': 3.2 }, body);
          const bad = SPM.mistakesAt(t);
          SP.counts.forEach((c, i) => {
            const y = sys(SP.labels[i]) + jitter[i];
            dotAt(dyn, sxs(c), y, spamKind(i), G.dr, spamTip(i));
            if (bad.indexOf(i) >= 0) ring(dyn, sxs(c), y, G.dr);
          });
          const cm = SPM.confusionAt(t);
          C0.cap('Threshold <b>' + t.toFixed(2) + '</b> &middot; caught <b>' + cm.tp + '</b> of ' + SPM.nSpam + ' spam &middot; missed <b>' + cm.fn +
            '</b> &middot; false alarms <b>' + cm.fp + '</b> of ' + SPM.nOk + ' real<span class="lg"><br>Orange diamond = spam, blue circle = real email, red ring = mistake. Counts are whole numbers, so the result changes in jumps.</span>');
        } else {
          const u1 = ease(clamp(q / 0.5)), u2 = ease(clamp((q - 0.3) / 0.5));
          const sxl = lin(5, 29, PL[0], PL[1]), syl = lin(0, 105, bot, top);
          const sxr = lin(5, 29, PR[0], PR[1]), syr = lin(-0.1, 1.1, bot, top);
          const gL = el('g', {}, dyn), gR = el('g', {}, dyn);
          axes(gL, G, sxl, syl, { xt: [10, 20], yt: [0, 50, 100], xtitle: M ? 'sentence length' : 'sentence length (words)', ytitle: 'rating', ytx: M ? 11 : 17 });
          axes(gR, G, sxr, syr, { xt: [10, 20], yt: [0, 1], xtitle: M ? 'sentence length' : 'sentence length (words)', ytitle: 'P(readable)', ytx: PR[0] - (M ? 26 : 34) });
          T(gL, (PL[0] + PL[1]) / 2, top - 8, 'the number machine', G.ft, C.ink, { anchor: 'middle', weight: 600 });
          T(gR, (PR[0] + PR[1]) / 2, top - 8, 'the probability machine', G.ft, C.ink, { anchor: 'middle', weight: 600 });
          const dL = el('g', { opacity: 0.75 + 0.25 * u1 }, gL), dR = el('g', { opacity: 0.75 + 0.25 * u2 }, gR);
          const cl = el('g', { 'clip-path': 'url(#clip6l)' }, dL);
          el('path', { d: pathD([[sxl(5), syl(LR.lineAt(OLS.b0, OLS.b1, 5))], [sxl(29), syl(LR.lineAt(OLS.b0, OLS.b1, 29))]]), fill: 'none', stroke: C.blue, 'stroke-width': 3.2 }, cl);
          E.x.forEach((x, i) => el('circle', { cx: sxl(x), cy: syl(E.y[i]), r: G.dr * 0.6, fill: C.dot, 'fill-opacity': 0.5 }, cl));
          const yp = LR.lineAt(OLS.b0, OLS.b1, 12);
          el('circle', { cx: sxl(12), cy: syl(yp), r: G.dr, fill: '#fff', stroke: C.blue, 'stroke-width': 3 }, dL);
          T(dL, sxl(12) + 10, syl(yp) - 9, 'ŷ ≈ ' + Math.round(yp), G.ft, C.blue, { weight: 700, halo: true });
          const cr = el('g', { 'clip-path': 'url(#clip6r)' }, dR);
          el('path', { d: pathD(curvePts({ sx: sxr, sy: syr }, probFn, 5, 29, 0.25)), fill: 'none', stroke: C.blue, 'stroke-width': 3.2 }, cr);
          E.x.forEach((x, i) => el('circle', { cx: sxr(x), cy: syr(LAB[i]), r: G.dr * 0.6, fill: LAB[i] ? C.blue : C.orange, 'fill-opacity': 0.55 }, cr));
          const pp = LG.pAt(8);
          el('circle', { cx: sxr(8), cy: syr(pp), r: G.dr, fill: '#fff', stroke: C.blue, 'stroke-width': 3 }, dR);
          T(dR, sxr(8) + 10, syr(pp) + (M ? 16 : 20), 'P ≈ ' + pp.toFixed(2), G.ft, C.blue, { weight: 700, halo: true });
          const eqY = bot + G.fs + G.ft + 22;
          mathBox(gL, PL[0], eqY, PL[1] - PL[0], 24, '\\hat y=\\beta_0+\\beta_1x', 'c', G.ft + 1);
          mathBox(gR, PR[0], eqY, PR[1] - PR[0], 24, 'P=\\sigma(\\beta_0+\\beta_1x)', 'c', G.ft + 1);
          C0.cap('Linear regression: features in, a <b>number</b> out. Logistic regression: the same weighted sum, wrapped in σ, a <b>probability</b> out.');
        }
      }
    };
  });

  update();
})();
