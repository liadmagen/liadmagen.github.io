/* Scroll-driven visual introduction to support vector machines and the kernel trick ("The Widest Street").
   All numbers come from svm-math.js (window.SVMM); all formulas are rendered with the vendored KaTeX.
   No other libraries, no build step. Every figure is a pure function of (step, scroll progress, user state):
   scrolling backwards simply redraws earlier states. The 3-D scene of chapter 5 is projected by hand (no 3-D library). */
(function () {
  'use strict';
  const SV = window.SVMM;
  if (!SV) { console.error('svm-math.js did not load'); return; }

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
  const MINUS = '−';
  const fmt = (v, d) => (v < 0 && Number(Math.abs(v).toFixed(d)) !== 0 ? MINUS : '') + Math.abs(v).toFixed(d);
  const f2 = (v) => fmt(v, 2);
  const n2 = (v) => { const s = String(+Math.abs(v).toFixed(2)); return (v < 0 && +s !== 0 ? MINUS : '') + s; }; /* up to 2 decimals, no trailing zeros */
  const pc = (v) => (Math.round(v * 1000) / 10) + '%';
  const pc0 = (v) => Math.round(v * 100) + '%';
  const fC = (v) => String(+v.toPrecision(3));
  const fG = (v) => (v >= 10 ? String(+v.toPrecision(3)) : v >= 1 ? v.toFixed(1) : String(+v.toPrecision(2)));
  const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* controls stay in place (no layout jump); they are just disabled and dimmed when not relevant */
  function ctlOn(ctl) { ctl.classList.add('on'); }
  function grpState(grp, visible, enabled) {
    grp.hidden = !visible;
    Array.prototype.forEach.call(grp.querySelectorAll('input,button,select'), (n) => { n.disabled = !enabled; });
    grp.classList.toggle('off', visible && !enabled);
  }
  const $ = (id) => document.getElementById(id);
  const wrapPi = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

  /* palette: blue circles = group A, orange diamonds = group B; teal = the best (widest street, separating sheet);
     purple = what you control or pick; red = a mistake; grey = other candidates; ink = the model's own mark (support-vector rings) */
  const C = {
    ink: '#1d2733', muted: '#55636f', line: '#e5e1d8', card: '#ffffff', dot: '#46515e',
    blue: '#1f6fd1', blueSoft: '#dbe8fa', orange: '#d9730d', orangeSoft: '#fbe6d0', grey: '#7d8894',
    teal: '#0f8a8a', tealSoft: '#d6eded', accent: '#6d5bd0', accentSoft: '#e9e5fa', red: '#b3261e', grid: '#ece9e1', axis: '#a9a396'
  };
  const CL = (lab) => (lab === 1 ? C.blue : C.orange);

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

  /* ------------------------------------------------------------------ data (all from svm-math.js) */
  const D = SV.DATA, SEP = D.separable, OVL = D.overlap, RING = D.rings, MOON = D.moons;
  const FRESH = SV.FRESH_N;
  const HARD = SV.fit(SEP.X, SEP.y, SV.HARD);
  const T0 = Math.atan2(HARD.w[1], HARD.w[0]), OFF0 = -HARD.b / HARD.norm; /* direction and offset of the widest street */
  const LETTERS = 'abcde';
  /* five lines that all separate group A from group B: four tilted ones, and the SVM's (which sits at letter d) */
  const CANDS = SV.candidateLines(SEP, { t: T0 });
  const LINES = [CANDS[0], CANDS[3], CANDS[1], { t: T0, offset: OFF0, margin: HARD.margin, widest: true }, CANDS[2]].map((l, k) => ({
    t: l.t, c: l.offset, margin: l.margin, widest: !!l.widest, label: LETTERS[k], n: SV.dirOf(l.t),
    train: SV.lineAccuracy(l.t, l.offset, SEP), fresh: SV.lineAccuracy(l.t, l.offset, SEP.fresh)
  }));
  const WIDEST = LINES.findIndex((l) => l.widest);
  const WORST = LINES.reduce((b, l, k) => (l.fresh < LINES[b].fresh ? k : b), 0);
  const candFresh = LINES.filter((l) => !l.widest).map((l) => l.fresh);
  /* street width at every tilt, for the strip chart in chapter 1 */
  const TILTS = Array.from({ length: 141 }, (_, k) => -70 + k);
  const TILT_GAP = TILTS.map((d) => SV.streetAt(SEP, T0 + rad(d)));
  const FAR = SV.farthestNonSV(HARD, SEP), MOVE_SV = HARD.sv.find((i) => SEP.y[i] === 1), MOVE_BY = SV.MOVE_BY;
  const FAR_FIT = (() => { const idx = SEP.X.map((_, i) => i).filter((i) => i !== FAR); return SV.fit(idx.map((i) => SEP.X[i]), idx.map((i) => SEP.y[i]), SV.HARD); })();
  const MOVED_X = SV.moveTowardStreet(SEP, HARD, MOVE_SV, MOVE_BY), MOVED_FIT = SV.fit(MOVED_X, SEP.y, SV.HARD);
  const SOFT = SV.softSweep('overlap'), NC = SOFT.length, C_STRICT = 14, C_ONE = SV.C_VALUES.indexOf(1);
  const OVL_HARD = SV.fit(OVL.X, OVL.y, SV.HARD);
  const OVL_HARD_ERR = SV.wrongIndices(OVL_HARD, OVL.X, OVL.y).length;
  const LIN4 = SV.fit(RING.X, RING.y, { kernel: SV.LINEAR, C: 1 });
  const LIN4_TRAIN = LIN4.accuracy(RING.X, RING.y), LIN4_FRESH = LIN4.accuracy(RING.fresh.X, RING.fresh.y);
  const BEST_LINE = SV.bestLine(RING);
  const bothLine = (d) => {
    const a = SV.lineAtAngle(RING, rad(d)), b = SV.lineAtAngle(RING, rad(d) + Math.PI);
    return a.acc >= b.acc ? a : b;
  };
  const ANG_ACC = Array.from({ length: 180 }, (_, d) => bothLine(d).acc);
  const LP = SV.liftPlane(RING);
  const LIFTED = RING.X.map(SV.lift);
  const ZTOP = Math.max(LP.minB, Math.max.apply(null, LIFTED.map((p) => p[2])), 2.4 * 2.4) + 0.3;
  const GAMMAS = SV.GAMMAS, NG = GAMMAS.length;
  const GS = { rings: SV.gammaSweep('rings', SV.RBF_C), moons: SV.gammaSweep('moons', SV.RBF_C) };
  const G_REF = 0.5; /* gamma of the RBF kernel in the first view of chapters 6 and 7 */
  const KER_RUN = {};
  ['rings', 'moons'].forEach((k) => { KER_RUN[k] = {}; Object.keys(SV.KERNELS).forEach((n) => { KER_RUN[k][n] = SV.kernelRun(k, SV.KERNELS[n], SV.RBF_C); }); });
  const BEST_G = SV.bestIndexBy(GS.moons, (r) => r.fresh), G_DEFAULT = GAMMAS.findIndex((g) => g >= 0.99); /* index of gamma = 1 */
  const MOON_LAST = GS.moons[NG - 1], MOON_FIRST = GS.moons[0];

  /* user state shared by all figures */
  const S = {
    rev: 0, pred: {},
    sel1: WORST, tilt1: null,
    ed: null,
    c3: null,
    ang4: null,
    cam: null, drop5: null,
    k6: 'rbf', ref6: { i: 0 }, pair6: 0, rnd6: null, g6: G_DEFAULT,
    ds7: 'moons', ker7: 'rbf', g7: null,
    snip: null
  };

  /* ------------------------------------------------------------------ prose placeholders {{key}} */
  function val(spec) {
    const a = spec.trim().split(/\s+/);
    let out;
    switch (a[0]) {
      case 'nSep': out = String(SEP.n); break;
      case 'nOvl': out = String(OVL.n); break;
      case 'nRing': out = String(RING.n); break;
      case 'nMoon': out = String(MOON.n); break;
      case 'nFresh': out = String(FRESH); break;
      case 'sepMargin': out = f2(HARD.margin); break;
      case 'svmFresh': out = pc0(LINES[WIDEST].fresh); break;
      case 'candMin': out = pc0(Math.min.apply(null, candFresh)); break;
      case 'candMax': out = pc0(Math.max.apply(null, candFresh)); break;
      case 'widestLetter': out = LINES[WIDEST].label; break;
      case 'sepNSV': out = String(HARD.nSV); break;
      case 'farMargin': out = f2(FAR_FIT.margin); break;
      case 'nFar': out = String(SEP.n - HARD.nSV); break;
      case 'moveBy': out = String(MOVE_BY); break;
      case 'movedMargin': out = f2(MOVED_FIT.margin); break;
      case 'hardC': out = String(SV.HARD_C); break;
      case 'ovlHardMargin': out = f2(OVL_HARD.margin); break;
      case 'ovlHardErr': out = String(OVL_HARD_ERR); break;
      case 'cBigC': out = fC(SV.C_VALUES[C_STRICT]); break;
      case 'cSmallC': out = fC(SV.C_VALUES[0]); break;
      case 'cBigMargin': out = f2(SOFT[C_STRICT].margin); break;
      case 'cSmallMargin': out = f2(SOFT[0].margin); break;
      case 'cBigNSV': out = String(SOFT[C_STRICT].nSV); break;
      case 'cSmallNSV': out = String(SOFT[0].nSV); break;
      case 'c1Fresh': out = pc0(SOFT[C_ONE].fresh); break;
      case 'linTrain': out = pc0(LIN4_TRAIN); break;
      case 'linFresh': out = pc0(LIN4_FRESH); break;
      case 'bestLine': out = pc0(BEST_LINE.acc); break;
      case 'zMaxA': out = f2(LP.maxA); break;
      case 'zMinB': out = f2(LP.minB); break;
      case 'liftC': out = f2(LP.c); break;
      case 'liftGap': out = f2(LP.gap); break;
      case 'liftRadius': out = f2(LP.radius); break;
      case 'ringP2': out = pc0(KER_RUN.rings.poly2.fresh); break;
      case 'moonP3': out = pc0(KER_RUN.moons.poly3.fresh); break;
      case 'moonLin': out = pc0(KER_RUN.moons.linear.fresh); break;
      case 'gBigSV': out = String(MOON_LAST.nSV); break;
      case 'gBestFresh': out = pc0(GS.moons[BEST_G].fresh); break;
      case 'gBigFresh': out = pc0(MOON_LAST.fresh); break;
      case 'gTinyTrain': out = pc0(MOON_FIRST.train); break;
      default: console.warn('unknown placeholder', spec); out = '?';
    }
    return out;
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
    const rv = box.querySelector('.reveal'), key = box.closest('section').id;
    if (!rv) return;
    Array.prototype.forEach.call(box.querySelectorAll('button'), (b) => {
      b.addEventListener('click', () => {
        Array.prototype.forEach.call(box.querySelectorAll('button'), (o) => o.classList.toggle('picked', o === b));
        rv.hidden = false;
        S.pred[key] = true; S.rev++;
        redrawAll();
      });
    });
  });

  /* ------------------------------------------------------------------ tooltips */
  const tip = $('tip');
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
  const grpName = (lab) => (lab === 1 ? 'A (circle)' : 'B (diamond)');
  const dotTip = (d, i, extra, kind) => '<b>' + (kind || 'Dot') + ' ' + (i + 1) + '</b> (made up)<br>group ' + grpName(d.y[i]) + '<br>feature 1 = ' + f2(d.X[i][0]) + ', feature 2 = ' + f2(d.X[i][1]) + (extra || '');
  const svTip = (m, i) => '<br>' + (m.sv.indexOf(i) >= 0 ? '<b>support vector</b> (weight ' + m.alpha[i].toFixed(3) + ')' : 'not a support vector (weight 0)');

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
      m: M ? { l: 34, r: 10, t: 10, b: 34 } : { l: 52, r: 14, t: 16, b: 44 } };
  }
  /* an equal-scale 2-D frame: one unit across is one unit up, so a street looks as wide as it is.
     o.top / o.bottom reserve extra room (text above, strips below). */
  function frame(G, dom, o) {
    o = o || {};
    const m = G.m, x0 = m.l, y0 = m.t + (o.top || 0), w = G.W - m.l - m.r, h = G.H - m.t - m.b - (o.top || 0) - (o.bottom || 0);
    const sc = Math.min(w / (dom.x[1] - dom.x[0]), h / (dom.y[1] - dom.y[0]));
    const rw = sc * (dom.x[1] - dom.x[0]), rh = sc * (dom.y[1] - dom.y[0]);
    const rx = x0 + (w - rw) / 2, ry = y0 + (h - rh) / 2;
    return {
      sx: (v) => rx + (v - dom.x[0]) * sc, sy: (v) => ry + rh - (v - dom.y[0]) * sc,
      ix: (p) => dom.x[0] + (p - rx) / sc, iy: (p) => dom.y[0] + (ry + rh - p) / sc,
      rect: { x: rx, y: ry, w: rw, h: rh }, sc: sc, dom: dom, box: [dom.x, dom.y]
    };
  }
  function frameAxes(g, G, fr, o) {
    o = o || {};
    const r = fr.rect, tk = o.ticks || [-2, 0, 2];
    tk.forEach((v) => {
      if (v > fr.dom.x[0] && v < fr.dom.x[1]) {
        el('line', { x1: fr.sx(v), x2: fr.sx(v), y1: r.y, y2: r.y + r.h, stroke: v === 0 ? C.axis : C.grid }, g);
        T(g, fr.sx(v), r.y + r.h + G.fs + 4, fmt(v, 0), G.fs, C.muted, { anchor: 'middle' });
      }
      if (v > fr.dom.y[0] && v < fr.dom.y[1]) {
        el('line', { x1: r.x, x2: r.x + r.w, y1: fr.sy(v), y2: fr.sy(v), stroke: v === 0 ? C.axis : C.grid }, g);
        T(g, r.x - 6, fr.sy(v) + G.fs * 0.35, fmt(v, 0), G.fs, C.muted, { anchor: 'end' });
      }
    });
    el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, fill: 'none', stroke: C.axis }, g);
    if (o.titles !== false) {
      if (o.xtitle !== false) T(g, r.x + r.w / 2, r.y + r.h + G.fs + G.ft + 8, 'feature 1', G.ft, C.muted, { anchor: 'middle' });
      T(g, G.M ? 10 : 15, r.y + r.h / 2, 'feature 2', G.ft, C.muted, { anchor: 'middle', rot: true });
    }
  }
  function clipG(parent, id, fr) {
    const defs = el('defs', {}, parent), cp = el('clipPath', { id: id }, defs);
    el('rect', { x: fr.rect.x, y: fr.rect.y, width: fr.rect.w, height: fr.rect.h }, cp);
    return el('g', { 'clip-path': 'url(#' + id + ')' }, parent);
  }
  const pathD = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');

  /* a dot: circle for group A, diamond for group B (so colour is never the only cue) */
  function dotMark(g, x, y, lab, r, o) {
    o = o || {};
    let n;
    const fill = o.hollow ? '#fff' : CL(lab), stroke = o.hollow ? CL(lab) : '#fff', sw = o.hollow ? 1.7 : 1.2;
    if (lab === -1) {
      const d = r * 1.3;
      n = el('polygon', { points: x + ',' + (y - d) + ' ' + (x + d) + ',' + y + ' ' + x + ',' + (y + d) + ' ' + (x - d) + ',' + y, fill: fill, stroke: stroke, 'stroke-width': sw }, g);
    } else n = el('circle', { cx: x, cy: y, r: r, fill: fill, stroke: stroke, 'stroke-width': sw }, g);
    if (o.op !== undefined && o.op < 1) n.setAttribute('opacity', o.op);
    if (o.tip) n.setAttribute('data-tip', o.tip);
    if (o.cls) n.setAttribute('class', o.cls);
    return n;
  }
  const ringMark = (g, x, y, r, col, extra) => el('circle', { cx: x, cy: y, r: r + (extra || 4.5), fill: 'none', stroke: col || C.ink, 'stroke-width': 2.2 }, g);
  /* the shaded street: a band of half-width `half` around the line n.x = c, with dashed edges and a solid centre */
  function streetBand(g, fr, n, c, half, o) {
    const u = [-n[1], n[0]], L = 40;
    const P = (s, k) => [fr.sx(c * n[0] + s * u[0] + k * n[0]), fr.sy(c * n[1] + s * u[1] + k * n[1])];
    const str = (pts) => pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    if (half > 0 && o.fill) el('polygon', { points: str([P(-L, -half), P(L, -half), P(L, half), P(-L, half)]), fill: o.fill, 'fill-opacity': o.fop === undefined ? 1 : o.fop }, g);
    if (half > 0 && o.edge) [-half, half].forEach((k) => {
      const a = P(-L, k), b = P(L, k);
      el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: o.edge, 'stroke-width': o.ew || 1.7, 'stroke-dasharray': o.dash || '7 5', opacity: o.op === undefined ? 1 : o.op }, g);
    });
    if (o.centre) {
      const a = P(-L, 0), b = P(L, 0);
      el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: o.centre, 'stroke-width': o.cw || 2.4, opacity: o.op === undefined ? 1 : o.op }, g);
    }
  }
  /* the stretch of the line n.x = c inside the box, as a range of the parameter s along the line */
  function lineSpan(n, c, box) {
    const u = [-n[1], n[0]]; let a = -1e9, b = 1e9;
    for (let k = 0; k < 2; k++) {
      const lo = box[k][0], hi = box[k][1], p0 = c * n[k], du = u[k];
      if (Math.abs(du) < 1e-9) { if (p0 < lo || p0 > hi) return null; } else {
        let s0 = (lo - p0) / du, s1 = (hi - p0) / du;
        if (s0 > s1) { const t = s0; s0 = s1; s1 = t; }
        a = Math.max(a, s0); b = Math.min(b, s1);
      }
    }
    return a < b ? { a: a, b: b, u: u } : null;
  }
  /* draw a letter in a small circle on a line's end, avoiding the labels already placed */
  function lineLabel(g, G, fr, n, c, letter, col, placed) {
    const sp = lineSpan(n, c, fr.box);
    if (!sp) return;
    const at = (s) => [fr.sx(c * n[0] + s * sp.u[0]), fr.sy(c * n[1] + s * sp.u[1])];
    const cands = [sp.b - 0.28, sp.a + 0.28].map(at).sort((p, q) => p[1] - q[1]);
    let pos = cands[0];
    if (placed.some((p) => Math.hypot(p[0] - pos[0], p[1] - pos[1]) < 17)) pos = cands[1];
    placed.push(pos);
    const r = G.M ? 7 : 8.5;
    el('circle', { cx: pos[0], cy: pos[1], r: r, fill: '#fff', stroke: col, 'stroke-width': 1.8 }, g);
    T(g, pos[0], pos[1] + G.fs * 0.35, letter, G.fs, col, { anchor: 'middle', weight: 800 });
  }
  function infoText(g, G, x, y, str, col, o) {
    o = o || {};
    T(g, x, y, str, o.size || G.fs + 0.5, col || C.ink, { weight: 700, halo: true, anchor: o.anchor });
  }
  /* a small curve under the figure: y against x, with the current x marked and the best x labelled */
  function strip(g, G, r, o) {
    const sx = lin(o.x0, o.x1, r.x, r.x + r.w), sy = lin(o.y0, o.y1, r.y + r.h, r.y);
    (o.yticks || []).forEach((v) => {
      el('line', { x1: r.x, x2: r.x + r.w, y1: sy(v), y2: sy(v), stroke: C.grid }, g);
      T(g, r.x - 5, sy(v) + G.fs * 0.35, o.yfmt ? o.yfmt(v) : String(v), G.fs, C.muted, { anchor: 'end' });
    });
    el('line', { x1: r.x, x2: r.x + r.w, y1: r.y + r.h, y2: r.y + r.h, stroke: C.axis }, g);
    el('line', { x1: r.x, x2: r.x, y1: r.y, y2: r.y + r.h, stroke: C.axis }, g);
    (o.xticks || []).forEach((v) => {
      el('line', { x1: sx(v), x2: sx(v), y1: r.y + r.h, y2: r.y + r.h + 4, stroke: C.axis }, g);
      T(g, sx(v), r.y + r.h + G.fs + 5, o.xfmt ? o.xfmt(v) : String(v), G.fs, C.muted, { anchor: 'middle' });
    });
    if (o.title) T(g, r.x, r.y - 5, o.title, G.fs, C.ink, { weight: 700 });
    /* the curve: segments where ok(i) is false are red and dashed */
    let seg = [], okState = null;
    const flush = () => { if (seg.length > 1) el('path', { d: pathD(seg), fill: 'none', stroke: okState ? C.dot : C.red, 'stroke-width': 2.4, 'stroke-dasharray': okState ? '' : '4 3', 'stroke-linejoin': 'round' }, g); };
    o.xs.forEach((x, i) => {
      const ok = o.ok ? o.ok(i) : true, p = [sx(x), sy(clamp(o.ys[i], o.y0, o.y1))];
      if (okState !== null && ok !== okState) { seg.push(p); flush(); seg = [p]; } else seg.push(p);
      okState = ok;
    });
    flush();
    if (o.cur !== undefined && o.cur !== null) {
      const cx = sx(clamp(o.cur, o.x0, o.x1)), cy = sy(clamp(o.curY, o.y0, o.y1));
      el('line', { x1: cx, x2: cx, y1: r.y, y2: r.y + r.h, stroke: C.accent, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, g);
      el('circle', { cx: cx, cy: cy, r: G.dr * 1.1, fill: C.accent, stroke: '#fff', 'stroke-width': 1.5 }, g);
    }
    if (o.best) {
      const bx = sx(o.best.x), by = sy(o.best.y);
      el('circle', { cx: bx, cy: by, r: G.dr * 1.5, fill: 'none', stroke: C.teal, 'stroke-width': 2.4 }, g);
      const lw = o.best.label.length * G.fs * 0.6 + 8, lx = Math.min(bx + G.dr * 1.5 + 6, r.x + r.w - lw);
      el('rect', { x: lx - 3, y: by - G.fs * 0.5 - 4, width: lw, height: G.fs + 6, rx: 4, fill: '#fff', 'fill-opacity': 0.92 }, g);
      T(g, lx, by + G.fs * 0.35, o.best.label, G.fs, '#0b5f5f', { anchor: 'start', weight: 700 });
    }
    return { sx: sx, sy: sy };
  }
  /* an offscreen canvas turned into an svg <image>: used for the colour maps */
  function canvasImage(g, rect, w, h, fn) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = fn(x, y), i = (y * w + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = c[3] === undefined ? 255 : c[3];
    }
    ctx.putImageData(img, 0, 0);
    const im = el('image', { x: rect.x, y: rect.y, width: rect.w, height: rect.h, preserveAspectRatio: 'none' }, g);
    im.setAttribute('href', cv.toDataURL());
    return im;
  }
  const BLUE = hexRgb(C.blue), ORANGE = hexRgb(C.orange), TEAL = hexRgb(C.teal), GREYC = hexRgb(C.grey);
  const mixRgb = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  const WHITE = [255, 255, 255];
  /* decision regions: tinted by the predicted group, fading to white on the street; a dark line where the decision flips */
  function decisionMap(g, fr, model) {
    const r = fr.rect, w = 120, h = Math.max(20, Math.round((w * r.h) / r.w));
    const vals = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) vals[y * w + x] = model.decision([fr.ix(r.x + ((x + 0.5) / w) * r.w), fr.iy(r.y + ((y + 0.5) / h) * r.h)]);
    return canvasImage(g, r, w, h, (x, y) => {
      const v = vals[y * w + x], edge = (x + 1 < w && (v >= 0) !== (vals[y * w + x + 1] >= 0)) || (y + 1 < h && (v >= 0) !== (vals[(y + 1) * w + x] >= 0));
      if (edge) return [29, 39, 51, 235];
      const c = mixRgb(WHITE, v >= 0 ? BLUE : ORANGE, clamp(Math.abs(v), 0, 1) * 0.5);
      return [c[0], c[1], c[2], 255];
    });
  }
  function svgPt(svg, e) {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, s = Math.min(r.width / vb.width, r.height / vb.height);
    return [(e.clientX - (r.left + (r.width - vb.width * s) / 2)) / s, (e.clientY - (r.top + (r.height - vb.height * s) / 2)) / s];
  }
  /* pointer dragging on an svg: o.start(p) returns true to begin; o.move(p, start); o.end() */
  function dragger(svg, o) {
    let on = false, st = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      const p = svgPt(svg, e);
      st = o.start(p, e);
      if (st) { on = true; try { svg.setPointerCapture(e.pointerId); } catch (_) { /* not all browsers */ } if (e.pointerType === 'mouse') e.preventDefault(); }
    });
    svg.addEventListener('pointermove', (e) => { if (on) o.move(svgPt(svg, e), st, e); });
    const end = () => { if (on) { on = false; if (o.end) o.end(); } };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  }
  function sliderSync(inp, out, value, text) {
    if (document.activeElement !== inp) inp.value = String(value);
    inp.setAttribute('aria-valuetext', text);
    if (out) out.textContent = text;
  }

  /* ------------------------------------------------------------------ scroll engine */
  const mq = window.matchMedia('(max-width: 920px)');
  const chapters = [];
  function register(id, build) {
    const chEl = $(id);
    const n = id.replace('ch', '');
    const ch = {
      el: chEl, id: id, build: build,
      svg: $('viz' + n), cap: $('cap' + n), ctl: $('ctl' + n),
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
  function redrawAll() { chapters.forEach((ch) => { if (ch.inst) draw(ch, ch.stage, ch.q, true); }); }

  const dotnav = $('dotnav');
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

  /* group views of data */
  const DOM_SEP = { x: [-4, 4], y: [-3.2, 3.2] };
  const DOM_OVL = { x: [-4.4, 4.4], y: [-3.5, 3.5] };
  const DOM_RING = { x: [-3.2, 3.2], y: [-2.6, 2.6] };
  const DOM_MOON = { x: [-3.9, 3.9], y: [-2.5, 2.5] };
  const DOMS = { rings: DOM_RING, moons: DOM_MOON };
  const domBox = (dom) => [dom.x, dom.y];

  /* draw a whole data set: o.fill / o.op / o.hollow per dot; o.sv = model whose support vectors get a ring; o.wrong = indices to mark red */
  function drawDots(g, G, fr, d, o) {
    o = o || {};
    for (let i = 0; i < d.n; i++) {
      if (o.skip && o.skip(i)) continue;
      const x = o.pos ? o.pos(i)[0] : d.X[i][0], y = o.pos ? o.pos(i)[1] : d.X[i][1];
      const op = o.op ? o.op(i) : 1;
      if (op < 0.02) continue;
      dotMark(g, fr.sx(x), fr.sy(y), d.y[i], o.r || G.dr, { op: op, tip: o.tip ? o.tip(i) : dotTip(d, i, o.model ? svTip(o.model, i) : '') });
      if (o.model && o.rings && o.model.sv.indexOf(i) >= 0) ringMark(g, fr.sx(x), fr.sy(y), o.r || G.dr, C.ink).setAttribute('opacity', op * o.rings);
      if (o.wrong && o.wrong.indexOf(i) >= 0) ringMark(g, fr.sx(x), fr.sy(y), o.r || G.dr, C.red, 8.5);
    }
  }
  const SVWORD = (n) => n + ' support vector' + (n === 1 ? '' : 's');

  /* ============================================================
     Chapter 1 - many lines, one widest street
     ============================================================ */
  register('ch1', function (C0) {
    const svg = C0.svg, G = geo(C0), M = G.M, W = G.W, H = G.H;
    const dyn = el('g', {}, svg);
    let stage = 0, fr = null;
    const stripH = M ? 84 : 118, rows = M ? 30 : 34;
    const sel = (k) => { S.sel1 = k; S.rev++; C0.redraw(); };
    Array.prototype.forEach.call($('grp1a').querySelectorAll('button'), (b) => { b.onclick = () => sel(+b.getAttribute('data-line')); });
    const tilt = $('tilt1');
    tilt.oninput = () => { S.tilt1 = rad(+tilt.value); S.rev++; C0.redraw(); };
    $('auto1').onclick = () => { S.tilt1 = null; S.rev++; C0.redraw(); };
    $('snap1').onclick = () => { S.tilt1 = 0; S.rev++; C0.redraw(); };
    const cen = [SV.mean(SEP.X.map((p) => p[0])), SV.mean(SEP.X.map((p) => p[1]))];
    dragger(svg, {
      start: (p) => {
        if (stage !== 2 || !fr) return null;
        const r = fr.rect;
        return p[0] > r.x - 10 && p[0] < r.x + r.w + 10 && p[1] > r.y - 10 && p[1] < r.y + r.h + 10 ? {} : null;
      },
      move: (p) => {
        const phi = Math.atan2(fr.iy(p[1]) - cen[1], fr.ix(p[0]) - cen[0]);
        let rel = wrapPi(phi + Math.PI / 2 - T0);
        if (rel > Math.PI / 2) rel -= Math.PI; else if (rel < -Math.PI / 2) rel += Math.PI;
        S.tilt1 = clamp(rel, rad(-70), rad(70)); S.rev++; C0.redraw();
      }
    });
    return {
      render: function (st, q) {
        stage = st;
        clear(dyn); ctlOn(C0.ctl);
        const revealed = !!S.pred.ch1;
        grpState($('grp1a'), st === 1, st === 1 && revealed);
        grpState($('grp1b'), st === 2, true);
        Array.prototype.forEach.call($('grp1a').querySelectorAll('button'), (b) => b.setAttribute('aria-pressed', String(+b.getAttribute('data-line') === S.sel1)));
        fr = frame(G, DOM_SEP, { bottom: st === 2 ? stripH : st === 1 ? rows : 0, top: 0 });
        frameAxes(dyn, G, fr, { xtitle: st !== 2 });
        const cl = clipG(dyn, 'clip1', fr);
        const placed = [];
        if (st === 0) {
          LINES.forEach((l, k) => {
            const op = clamp(q * 6 - k * 0.9);
            if (op < 0.02) return;
            const g = el('g', { opacity: op }, cl);
            streetBand(g, fr, l.n, l.c, 0, { centre: C.dot, cw: 2.2 });
          });
          drawDots(dyn, G, fr, SEP, {});
          LINES.forEach((l, k) => { const op = clamp(q * 6 - k * 0.9); if (op > 0.5) lineLabel(dyn, G, fr, l.n, l.c, l.label, C.dot, placed); });
          C0.cap(q < 0.15 ? 'Group A: blue circles. Group B: orange diamonds.' : 'Five straight lines. Each one has <b>every dot on the right side</b>: ' + pc0(1) + ' on the training dots.');
        } else if (st === 1) {
          LINES.forEach((l) => {
            const w = l.widest && revealed;
            streetBand(cl, fr, l.n, l.c, l.margin / 2, { fill: w ? C.teal : C.grey, fop: w ? 0.2 : 0.1, edge: w ? C.teal : C.grey, ew: w ? 2 : 1.2, op: w ? 1 : 0.75, dash: '5 4' });
          });
          if (revealed) for (let i = 0; i < SEP.fresh.n; i++) dotMark(dyn, fr.sx(SEP.fresh.X[i][0]), fr.sy(SEP.fresh.X[i][1]), SEP.fresh.y[i], G.dr * 0.62, { hollow: true, op: 0.85, tip: dotTip(SEP.fresh, i, '', 'Fresh dot') });
          const sl = LINES[S.sel1];
          const wrongs = revealed ? SEP.fresh.X.map((x, i) => ((x[0] * sl.n[0] + x[1] * sl.n[1] - sl.c >= 0 ? 1 : -1) !== SEP.fresh.y[i] ? i : -1)).filter((i) => i >= 0) : [];
          LINES.forEach((l, k) => {
            const chosen = revealed && k === S.sel1;
            streetBand(cl, fr, l.n, l.c, 0, { centre: chosen ? C.accent : (l.widest && revealed ? C.teal : C.dot), cw: chosen ? 3.4 : 2 });
          });
          drawDots(dyn, G, fr, SEP, {});
          wrongs.forEach((i) => ringMark(dyn, fr.sx(SEP.fresh.X[i][0]), fr.sy(SEP.fresh.X[i][1]), G.dr * 0.62, C.red, 5));
          LINES.forEach((l, k) => lineLabel(dyn, G, fr, l.n, l.c, l.label, revealed && k === S.sel1 ? C.accent : (l.widest && revealed ? C.teal : C.dot), placed));
          const y0 = G.H - 6 - G.fs - 5;
          T(dyn, fr.rect.x, y0, 'street width: ' + LINES.map((l) => l.label + ' ' + f2(l.margin)).join('  '), G.fs, C.ink, { weight: 600 });
          T(dyn, fr.rect.x, y0 + G.fs + 4, revealed ? 'right on ' + FRESH + ' fresh dots: ' + LINES.map((l) => l.label + ' ' + pc0(l.fresh)).join('  ') : 'Make your prediction in the card, then the fresh dots appear.', G.fs, revealed ? C.teal : C.muted, { weight: 600 });
          C0.cap(!revealed ? 'Each line with its own empty street. The widest street belongs to one of them.'
            : 'Hollow marks: ' + FRESH + ' fresh dots. <span style="color:#b3261e">Red rings</span>: line <b>' + LINES[S.sel1].label + '</b> gets ' + wrongs.length + ' of them wrong (' + pc0(LINES[S.sel1].fresh) + ' right). Pick another line below.');
        } else {
          const auto = S.tilt1 === null;
          const tl = auto ? rad(-65 + 130 * clamp(q / 0.9)) : S.tilt1, tdeg = Math.round(deg(tl));
          const s = SV.streetAt(SEP, T0 + tl), n = s.w;
          let wrong = [];
          if (s.separates) {
            streetBand(cl, fr, n, s.offset, s.gap / 2, { fill: C.accent, fop: 0.14, edge: C.accent, ew: 1.6, centre: C.accent, cw: 3 });
          } else {
            const lr = SV.lineAtAngle(SEP, T0 + tl);
            streetBand(cl, fr, n, lr.offset, 0, { centre: C.red, cw: 3 });
            wrong = SEP.X.map((x, i) => ((x[0] * n[0] + x[1] * n[1] - lr.offset >= 0 ? 1 : -1) !== SEP.y[i] ? i : -1)).filter((i) => i >= 0);
          }
          drawDots(dyn, G, fr, SEP, { wrong: wrong });
          const stripTop = G.H - G.m.b - stripH, sy0 = stripTop + 2 * G.fs + 20, sr = { x: fr.rect.x, y: sy0, w: fr.rect.w, h: G.H - 10 - G.fs - sy0 };
          const maxGap = HARD.margin;
          strip(dyn, G, sr, {
            x0: -70, x1: 70, y0: 0, y1: maxGap * 1.12, xs: TILTS, ys: TILT_GAP.map((s2) => Math.max(0, s2.gap)), ok: (i) => TILT_GAP[i].separates,
            xticks: [-60, -30, 0, 30, 60], xfmt: (v) => (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v) + '°', yticks: [0, 1, 2], yfmt: String,
            title: M ? 'street width at each tilt' : 'street width at each tilt (red dashes: no street fits)',
            cur: tdeg, curY: Math.max(0, s.gap), best: { x: 0, y: maxGap, label: 'widest ' + f2(maxGap) }
          });
          sliderSync(tilt, $('tilt1Out'), tdeg, (tdeg > 0 ? '+' : tdeg < 0 ? MINUS : '') + Math.abs(tdeg) + '°');
          $('auto1').disabled = auto; $('snap1').disabled = S.tilt1 === 0;
          if (s.separates) infoText(dyn, G, fr.rect.x + 8, fr.rect.y + G.fs + 6, 'street width ' + f2(s.gap), C.accent);
          else infoText(dyn, G, fr.rect.x + 8, fr.rect.y + G.fs + 6, 'no street: ' + wrong.length + ' wrong', C.red);
          C0.cap(s.separates ? 'Tilt <b>' + (tdeg > 0 ? '+' : tdeg < 0 ? MINUS : '') + Math.abs(tdeg) + '°</b>: the widest street that fits is <b>' + f2(s.gap) + '</b> wide. The best of all tilts is <b class="legend-t">' + f2(maxGap) + '</b>.'
            : 'Tilt <b>' + MINUS + Math.abs(tdeg) + '°</b>: no straight line at this angle can separate the groups. <span style="color:#b3261e">Red rings</span>: the dots it gets wrong.');
        }
      }
    };
  });

  /* ============================================================
     Chapter 2 - support vectors
     ============================================================ */
  function fitSub(X, y, removed) {
    const idx = X.map((_, i) => i).filter((i) => !removed.has(i));
    const m = SV.fit(idx.map((i) => X[i]), idx.map((i) => y[i]), SV.HARD);
    return { m: m, idx: idx, sv: m.sv.map((k) => idx[k]) };
  }
  const resetEdit = () => { S.ed = { X: SEP.X.map((p) => p.slice()), removed: new Set(), sel: HARD.sv[0] }; };
  resetEdit();
  register('ch2', function (C0) {
    const svg = C0.svg, G = geo(C0), M = G.M;
    const dyn = el('g', {}, svg);
    let stage = 0, fr = null;
    const STEP = 0.15;
    const move = (dx, dy) => { const e = S.ed, p = e.X[e.sel]; e.X[e.sel] = [clamp(p[0] + dx, DOM_SEP.x[0] + 0.1, DOM_SEP.x[1] - 0.1), clamp(p[1] + dy, DOM_SEP.y[0] + 0.1, DOM_SEP.y[1] - 0.1)]; S.rev++; C0.redraw(); };
    $('mvL2').onclick = () => move(-STEP, 0); $('mvR2').onclick = () => move(STEP, 0);
    $('mvU2').onclick = () => move(0, STEP); $('mvD2').onclick = () => move(0, -STEP);
    const cycle = (dir) => { const e = S.ed; e.sel = (e.sel + dir + SEP.n) % SEP.n; S.rev++; C0.redraw(); };
    $('prev2').onclick = () => cycle(-1); $('next2').onclick = () => cycle(1);
    $('reset2').onclick = () => { resetEdit(); S.rev++; C0.redraw(); };
    $('rm2').onclick = () => {
      const e = S.ed;
      if (e.removed.has(e.sel)) e.removed.delete(e.sel);
      else {
        const left = SEP.y.filter((_, i) => i !== e.sel && !e.removed.has(i));
        if (left.indexOf(1) < 0 || left.indexOf(-1) < 0) return; /* each group keeps at least one dot */
        e.removed.add(e.sel);
      }
      S.rev++; C0.redraw();
    };
    svg.addEventListener('keydown', (e) => {
      if (stage !== 3) return;
      const k = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, STEP], ArrowDown: [0, -STEP] }[e.key];
      if (k) { e.preventDefault(); move(k[0], k[1]); }
    });
    dragger(svg, {
      start: (p) => {
        if (stage !== 3 || !fr) return null;
        let best = -1, bd = 18;
        S.ed.X.forEach((x, i) => { const d = Math.hypot(fr.sx(x[0]) - p[0], fr.sy(x[1]) - p[1]); if (d < bd) { bd = d; best = i; } });
        if (best < 0) return null;
        S.ed.sel = best; S.rev++; C0.redraw();
        return { i: best };
      },
      move: (p, st) => {
        const e = S.ed;
        e.X[st.i] = [clamp(fr.ix(p[0]), DOM_SEP.x[0] + 0.1, DOM_SEP.x[1] - 0.1), clamp(fr.iy(p[1]), DOM_SEP.y[0] + 0.1, DOM_SEP.y[1] - 0.1)];
        S.rev++; C0.redraw();
      }
    });
    const modelBand = (g, m, o) => streetBand(g, fr, [m.w[0] / m.norm, m.w[1] / m.norm], -m.b / m.norm, 1 / m.norm, o);
    const TEAL_STREET = { fill: C.teal, fop: 0.16, edge: C.teal, centre: C.ink, cw: 2.4 };
    return {
      render: function (st, q) {
        stage = st;
        clear(dyn); ctlOn(C0.ctl);
        grpState(C0.ctl, true, st === 3);
        fr = frame(G, DOM_SEP, { top: M ? 0 : 6 });
        frameAxes(dyn, G, fr);
        const cl = clipG(dyn, 'clip2', fr);
        if (st === 0) {
          modelBand(cl, HARD, TEAL_STREET);
          drawDots(dyn, G, fr, SEP, { model: HARD, rings: ease(clamp(q * 2.5)) });
          infoText(dyn, G, fr.rect.x + 8, fr.rect.y + G.fs + 6, 'street ' + f2(HARD.margin) + ' · ' + SVWORD(HARD.nSV) + ' of ' + SEP.n + ' dots', C.teal);
          C0.cap(q < 0.2 ? 'The widest street between the two groups.' : '<b>Ringed dots</b> are the support vectors: the only dots touching the street.');
        } else if (st === 1) {
          const u = ease(clamp(q / 0.6)), gone = u >= 0.999;
          modelBand(cl, HARD, TEAL_STREET);
          drawDots(dyn, G, fr, SEP, { model: HARD, rings: 1, op: (i) => (i === FAR ? 1 - u : 1) });
          const fx = fr.sx(SEP.X[FAR][0]), fy = fr.sy(SEP.X[FAR][1]);
          if (u > 0.02) el('circle', { cx: fx, cy: fy, r: G.dr + 4, fill: 'none', stroke: C.grey, 'stroke-width': 1.6, 'stroke-dasharray': '3 3', opacity: u }, dyn);
          if (u > 0.95) T(dyn, fx + G.dr + 8, fy + 4, 'removed', G.fs, C.ink, { weight: 700, halo: true });
          infoText(dyn, G, fr.rect.x + 8, fr.rect.y + G.fs + 6, 'street ' + f2(HARD.margin) + (gone ? '  →  ' + f2(FAR_FIT.margin) + ' after removing it' : ''), C.teal);
          C0.cap(gone ? 'The farthest dot is gone and <b>the street did not move</b>. Same width, same support vectors.' : 'Taking away the dot that is farthest from the street&hellip;');
        } else if (st === 2) {
          const u = ease(clamp(q / 0.7)), X = SEP.X.map((p, i) => (i === MOVE_SV ? [lerp(p[0], MOVED_X[i][0], u), lerp(p[1], MOVED_X[i][1], u)] : p));
          const fit = SV.fit(X, SEP.y, SV.HARD);
          modelBand(cl, HARD, { edge: C.grey, centre: C.grey, cw: 1.6, dash: '5 4', ew: 1.4, op: 0.9 });
          modelBand(cl, fit, TEAL_STREET);
          drawDots(dyn, G, fr, { X: X, y: SEP.y, n: SEP.n, fresh: SEP.fresh }, { model: fit, rings: 1 });
          el('circle', { cx: fr.sx(SEP.X[MOVE_SV][0]), cy: fr.sy(SEP.X[MOVE_SV][1]), r: G.dr + 1, fill: 'none', stroke: C.grey, 'stroke-width': 1.4, 'stroke-dasharray': '3 3', opacity: u > 0.03 ? 1 : 0 }, dyn);
          infoText(dyn, G, fr.rect.x + 8, fr.rect.y + G.fs + 6, 'street ' + f2(HARD.margin) + '  →  ' + f2(fit.margin), C.teal);
          C0.cap(u < 0.05 ? 'One support vector, about to move toward the street.' : 'A support vector moved: <b>the street narrows and turns</b>. Dashed grey: where it was.');
        } else {
          const e = S.ed, fs = fitSub(e.X, SEP.y, e.removed), m = fs.m;
          const train = m.accuracy(fs.idx.map((i) => e.X[i]), fs.idx.map((i) => SEP.y[i]));
          const wrong = fs.idx.filter((i) => m.predict(e.X[i]) !== SEP.y[i]);
          modelBand(cl, m, { fill: C.teal, fop: 0.16, edge: C.teal, centre: C.ink, cw: 2.4 });
          const dd = { X: e.X, y: SEP.y, n: SEP.n, fresh: SEP.fresh };
          const pseudo = { sv: fs.sv, alpha: SEP.X.map((_, j) => (fs.idx.indexOf(j) >= 0 ? m.alpha[fs.idx.indexOf(j)] : 0)) };
          for (let i = 0; i < SEP.n; i++) {
            const x = fr.sx(e.X[i][0]), y = fr.sy(e.X[i][1]), rem = e.removed.has(i);
            dotMark(dyn, x, y, SEP.y[i], G.dr, { hollow: rem, op: rem ? 0.55 : 1, tip: dotTip(dd, i, rem ? '<br>removed' : svTip(pseudo, i)) });
            if (!rem && fs.sv.indexOf(i) >= 0) ringMark(dyn, x, y, G.dr, C.ink);
            if (wrong.indexOf(i) >= 0) ringMark(dyn, x, y, G.dr, C.red, 8.5);
            if (i === e.sel) {
              el('circle', { cx: x, cy: y, r: G.dr + 11, fill: 'none', stroke: C.accent, 'stroke-width': 2.4, 'stroke-dasharray': '4 3' }, dyn);
            }
          }
          infoText(dyn, G, fr.rect.x + 8, fr.rect.y + G.fs + 6, 'street ' + f2(m.margin) + ' · ' + SVWORD(m.nSV) + (train < 1 ? ' · ' + wrong.length + ' wrong' : ''), train < 1 ? C.red : C.teal);
          $('sel2').textContent = 'dot ' + (e.sel + 1) + (e.removed.has(e.sel) ? ' (removed)' : fs.sv.indexOf(e.sel) >= 0 ? ' · support vector' : '');
          $('rm2').textContent = e.removed.has(e.sel) ? 'Put it back' : 'Remove dot';
          C0.cap('Selected: <b style="color:#6d5bd0">dot ' + (e.sel + 1) + '</b> (dashed purple), group ' + (SEP.y[e.sel] === 1 ? 'A' : 'B') + (fs.sv.indexOf(e.sel) >= 0 ? ', a support vector' : ', not a support vector') + '. ' +
            (train < 1 ? '<span style="color:#b3261e">No straight street fits any more.</span>' : 'Drag a dot, or use the buttons or arrow keys.'));
        }
      }
    };
  });

  /* ============================================================
     Chapter 3 - the soft margin
     ============================================================ */
  register('ch3', function (C0) {
    const svg = C0.svg, G = geo(C0), M = G.M;
    const dyn = el('g', {}, svg);
    const inp = $('c3'), out = $('c3Out');
    inp.oninput = () => { S.c3 = +inp.value; S.rev++; C0.redraw(); };
    $('auto3').onclick = () => { S.c3 = null; S.rev++; C0.redraw(); };
    const cText = (i) => 'C = ' + fC(SV.C_VALUES[i]);
    return {
      render: function (st, q) {
        clear(dyn); ctlOn(C0.ctl);
        const idx = S.c3 !== null ? S.c3 : (st === 0 ? C_STRICT : st === 1 ? Math.round(C_STRICT * (1 - ease(clamp(q / 0.9)))) : C_ONE);
        grpState(C0.ctl, true, st > 0);
        $('auto3').disabled = st === 0 || S.c3 === null;
        sliderSync(inp, out, idx, cText(idx));
        if (st < 2) {
          const run = st === 0 ? { model: OVL_HARD, margin: OVL_HARD.margin, nSV: OVL_HARD.nSV, errors: SV.wrongIndices(OVL_HARD, OVL.X, OVL.y), fresh: OVL_HARD.accuracy(OVL.fresh.X, OVL.fresh.y), C: SV.HARD_C } : SOFT[idx];
          const m = run.model, fr = frame(G, DOM_OVL, { top: M ? 0 : 6 });
          frameAxes(dyn, G, fr);
          const cl = clipG(dyn, 'clip3', fr);
          streetBand(cl, fr, [m.w[0] / m.norm, m.w[1] / m.norm], -m.b / m.norm, 1 / m.norm, { fill: C.teal, fop: 0.16, edge: C.teal, centre: C.ink, cw: 2.4 });
          drawDots(dyn, G, fr, OVL, { model: m, rings: 1, wrong: run.errors });
          infoText(dyn, G, fr.rect.x + 8, fr.rect.y + G.fs + 6, 'C = ' + fC(run.C) + ' · street ' + f2(run.margin) + ' · ' + (M ? run.nSV + ' SV' : SVWORD(run.nSV)) + ' · ' + run.errors.length + ' wrong', C.teal);
          C0.cap(st === 0 ? 'Even with a very large C, the overlap leaves <span style="color:#b3261e">red rings</span>: dots on the wrong side of the street.'
            : '<b>' + cText(idx) + '</b>: street ' + f2(run.margin) + ' wide, ' + SVWORD(run.nSV) + ', ' + run.errors.length + ' wrong on the training dots, ' + pc0(run.fresh) + ' right on fresh dots.');
        } else {
          const G2 = G, m2 = G.m, r = { x: m2.l + 6, y: m2.t + (M ? 26 : 32), w: G.W - m2.l - m2.r - 12, h: G.H - m2.t - m2.b - (M ? 22 : 34) - (M ? 26 : 32) };
          const xs = SV.C_VALUES.map((_, i) => i);
          const sp = strip(dyn, G2, r, {
            x0: 0, x1: NC - 1, y0: 0.8, y1: 1.0, xs: xs, ys: SOFT.map((s) => s.train), xticks: [0, 4, 8, 12, 16], xfmt: (v) => fC(SV.C_VALUES[v]), yticks: [0.8, 0.9, 1.0], yfmt: (v) => Math.round(v * 100) + '%',
            title: M ? 'accuracy against C' : 'accuracy against C (log scale)', cur: idx, curY: SOFT[idx].train
          });
          el('path', { d: pathD(xs.map((x, i) => [sp.sx(x), sp.sy(clamp(SOFT[i].fresh, 0.8, 1))])), fill: 'none', stroke: C.orange, 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, dyn);
          xs.forEach((x, i) => {
            const cx = sp.sx(x), cy = sp.sy(clamp(SOFT[i].train, 0.8, 1)), fy = sp.sy(clamp(SOFT[i].fresh, 0.8, 1));
            el('circle', { cx: cx, cy: cy, r: G.dr * 0.7, fill: C.blue, stroke: '#fff', 'stroke-width': 1, 'data-tip': '<b>' + cText(i) + '</b><br>training ' + pc0(SOFT[i].train) + '<br>fresh ' + pc0(SOFT[i].fresh) + '<br>street ' + f2(SOFT[i].margin) + ', ' + SVWORD(SOFT[i].nSV) }, dyn);
            const d = G.dr * 0.85;
            el('polygon', { points: cx + ',' + (fy - d) + ' ' + (cx + d) + ',' + fy + ' ' + cx + ',' + (fy + d) + ' ' + (cx - d) + ',' + fy, fill: '#fff', stroke: C.orange, 'stroke-width': 1.8, 'data-tip': '<b>' + cText(i) + '</b><br>fresh ' + pc0(SOFT[i].fresh) }, dyn);
          });
          T(dyn, sp.sx(NC - 1) - 2, sp.sy(0.822), M ? 'strict' : 'larger C: strict, narrow street', G.fs, C.muted, { anchor: 'end', weight: 600 });
          T(dyn, sp.sx(0) + 4, sp.sy(0.822), M ? 'relaxed' : 'smaller C: relaxed, wide street', G.fs, C.muted, { weight: 600 });
          const lx = sp.sx(NC - 1) - 2, ly = sp.sy(0.88);
          T(dyn, lx, ly, 'training dots', G.fs, C.blue, { anchor: 'end', weight: 700 });
          T(dyn, lx, ly + G.fs + 4, 'fresh dots', G.fs, C.orange, { anchor: 'end', weight: 700 });
          T(dyn, r.x + r.w / 2, r.y + r.h + G.fs + G.ft + 8, M ? 'C' : 'C, the price of a mistake', G.ft, C.muted, { anchor: 'middle' });
          C0.cap('<b>' + cText(idx) + '</b>: ' + pc0(SOFT[idx].train) + ' on the ' + OVL.n + ' training dots, ' + pc0(SOFT[idx].fresh) + ' on ' + FRESH + ' fresh dots. Street ' + f2(SOFT[idx].margin) + ' wide.');
        }
      }
    };
  });

  /* ============================================================
     Chapter 4 - when no straight line works
     ============================================================ */
  register('ch4', function (C0) {
    const svg = C0.svg, G = geo(C0), M = G.M;
    const dyn = el('g', {}, svg);
    let stage = 0, fr = null;
    const stripH = M ? 84 : 118;
    const inp = $('ang4'), out = $('ang4Out');
    inp.oninput = () => { S.ang4 = +inp.value; S.rev++; C0.redraw(); };
    $('auto4').onclick = () => { S.ang4 = null; S.rev++; C0.redraw(); };
    dragger(svg, {
      start: (p) => {
        if (stage !== 2 || !fr) return null;
        const r = fr.rect;
        return p[0] > r.x - 10 && p[0] < r.x + r.w + 10 && p[1] > r.y - 10 && p[1] < r.y + r.h + 10 ? {} : null;
      },
      move: (p) => {
        const phi = Math.atan2(fr.iy(p[1]), fr.ix(p[0]));
        S.ang4 = ((Math.round(deg(phi + Math.PI / 2)) % 180) + 180) % 180; S.rev++; C0.redraw();
      }
    });
    return {
      render: function (st, q) {
        stage = st;
        clear(dyn); ctlOn(C0.ctl);
        grpState(C0.ctl, true, st === 2);
        fr = frame(G, DOM_RING, { top: M ? 0 : 6, bottom: st === 2 ? stripH : 0 });
        frameAxes(dyn, G, fr, { xtitle: st !== 2 });
        const cl = clipG(dyn, 'clip4', fr);
        const auto = S.ang4 === null, ang = auto ? Math.round(179 * clamp(q / 0.9)) : S.ang4;
        sliderSync(inp, out, ang, ang + '°');
        $('auto4').disabled = auto;
        if (st === 0) {
          drawDots(dyn, G, fr, RING, { op: (i) => clamp(((q * 1.4 + 0.1) - (i / RING.n) * 0.9) / 0.15) });
          C0.cap(q < 0.5 ? 'Group A: a cluster in the middle.' : '<b class="legend-b">Blue circles</b>: the cluster. <b class="legend-o">Orange diamonds</b>: the ring around it. Where would a straight line go?');
        } else if (st === 1) {
          streetBand(cl, fr, [LIN4.w[0] / LIN4.norm, LIN4.w[1] / LIN4.norm], -LIN4.b / LIN4.norm, 1 / LIN4.norm, { fill: C.teal, fop: 0.14, edge: C.teal, centre: C.ink, cw: 2.4 });
          const wrong = SV.wrongIndices(LIN4, RING.X, RING.y);
          drawDots(dyn, G, fr, RING, { wrong: wrong });
          infoText(dyn, G, fr.rect.x + 8, fr.rect.y + G.fs + 6, 'straight street: ' + pc0(LIN4_TRAIN) + ' right', C.red);
          C0.cap('The best straight street (an SVM with a linear kernel): <b>' + pc0(LIN4_TRAIN) + '</b> of the ' + RING.n + ' dots right. <span style="color:#b3261e">Red rings</span>: the ' + wrong.length + ' mistakes.');
        } else {
          const lr = bothLine(ang), n = SV.dirOf(lr.t);
          const wrong = RING.X.map((x, i) => ((x[0] * n[0] + x[1] * n[1] - lr.offset >= 0 ? 1 : -1) !== RING.y[i] ? i : -1)).filter((i) => i >= 0);
          streetBand(cl, fr, n, lr.offset, 0, { centre: C.accent, cw: 3 });
          drawDots(dyn, G, fr, RING, { wrong: wrong });
          const stripTop = G.H - G.m.b - stripH, sy0 = stripTop + 2 * G.fs + 20, sr = { x: fr.rect.x, y: sy0, w: fr.rect.w, h: G.H - 10 - G.fs - sy0 };
          strip(dyn, G, sr, {
            x0: 0, x1: 179, y0: 0.4, y1: 1.0, xs: ANG_ACC.map((_, d) => d), ys: ANG_ACC, xticks: [0, 45, 90, 135], xfmt: (v) => v + '°', yticks: [0.5, 0.75, 1.0], yfmt: (v) => Math.round(v * 100) + '%',
            title: M ? 'best accuracy at each angle' : 'accuracy of the best line at each angle',
            cur: ang, curY: ANG_ACC[ang], best: { x: ANG_ACC.indexOf(Math.max.apply(null, ANG_ACC)), y: BEST_LINE.acc, label: 'best ' + pc0(BEST_LINE.acc) }
          });
          infoText(dyn, G, fr.rect.x + 8, fr.rect.y + G.fs + 6, 'angle ' + ang + '° · ' + pc0(lr.acc) + ' right', lr.acc > 0.7 ? C.accent : C.red);
          C0.cap('Angle <b>' + ang + '°</b>: the line sits where it gets the most dots right, <b>' + pc0(lr.acc) + '</b> (' + wrong.length + ' wrong, red rings). Over all angles the best is ' + pc0(BEST_LINE.acc) + '.');
        }
      }
    };
  });

  /* ============================================================
     Chapter 5 - lift it (a hand-rolled 3-D scene)
     ============================================================ */
  const FL = 2.8, RB = 2.4, RH = FL * Math.SQRT2; /* floor half-size, bowl radius, radius of the floor's bounding circle */
  register('ch5', function (C0) {
    const svg = C0.svg, G = geo(C0), M = G.M, W = G.W, H = G.H;
    const dyn = el('g', {}, svg);
    let lastCam = { yaw: 0, el: Math.PI / 2 };
    const E0 = Math.PI / 2, E1 = rad(32), Y1 = rad(38);
    const camFor = (st, q) => {
      if (st === 0) { const k = ease(q); return { yaw: lerp(0, Y1, k), el: lerp(E0, E1, k) }; }
      if (st === 1) return { yaw: Y1, el: E1 };
      if (st === 2) { const k = ease(clamp((q - 0.45) / 0.55)); return { yaw: lerp(Y1, 0, k), el: lerp(E1, E0, k) }; }
      const k = ease(clamp(q / 0.7)); return { yaw: lerp(0, Y1, k), el: lerp(E0, E1, k) };
    };
    const rot = (dy, de) => { const c = S.cam || lastCam; S.cam = { yaw: c.yaw + dy, el: clamp(c.el + de, rad(5), E0) }; S.rev++; C0.redraw(); };
    $('rotL5').onclick = () => rot(-0.12, 0); $('rotR5').onclick = () => rot(0.12, 0);
    $('rotU5').onclick = () => rot(0, 0.1); $('rotD5').onclick = () => rot(0, -0.1);
    $('auto5').onclick = () => { S.cam = null; S.drop5 = null; S.rev++; C0.redraw(); };
    const drop = $('drop5');
    drop.oninput = () => { S.drop5 = +drop.value / 100; S.rev++; C0.redraw(); };
    svg.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[e.key];
      if (k) { e.preventDefault(); rot(k[0], k[1]); }
    });
    dragger(svg, {
      start: (p) => ({ x: p[0], y: p[1], yaw: (S.cam || lastCam).yaw, el: (S.cam || lastCam).el }),
      move: (p, st) => { S.cam = { yaw: st.yaw + (p[0] - st.x) * 0.012, el: clamp(st.el + (p[1] - st.y) * 0.009, rad(5), E0) }; S.rev++; C0.redraw(); }
    });
    return {
      render: function (st, q) {
        clear(dyn); ctlOn(C0.ctl);
        grpState($('grp5a'), true, true);
        grpState($('grp5b'), st === 3, true);
        $('auto5').disabled = S.cam === null && S.drop5 === null;
        const cam = S.cam || camFor(st, q);
        lastCam = cam;
        /* scene parameters from the step */
        let t = 1, planeA = 0, planeH = LP.c, circA = 0, dropV = 0;
        if (st === 0) { t = ease(q); }
        else if (st === 1) { planeA = ease(clamp(q / 0.7)); planeH = lerp(ZTOP, LP.c, planeA); circA = clamp((q - 0.6) / 0.3); }
        else { dropV = st === 2 ? ease(clamp(q / 0.55)) : (S.drop5 !== null ? S.drop5 : 1); planeA = 1 - dropV; circA = 1; }
        const circH = LP.c * (1 - dropV);
        sliderSync(drop, $('drop5Out'), Math.round(dropV * 100), dropV >= 0.99 ? 'on the floor' : dropV <= 0.01 ? 'on the sheet' : Math.round(dropV * 100) + '% down');
        /* projection: yaw about the vertical axis, then tilt by the elevation; orthographic */
        const cy_ = Math.cos(cam.yaw), sy_ = Math.sin(cam.yaw), ce = Math.cos(cam.el), se = Math.sin(cam.el);
        const vmin = -RH * se, vmax = ZTOP * ce + RH * se;
        const pl = G.m.l - (M ? 20 : 30), pr = G.W - G.m.r + (M ? 0 : 6), pt = G.m.t + 2, pb = G.H - 8;
        const s = Math.min((pr - pl) / (2 * RH), (pb - pt) / (vmax - vmin)), cx0 = (pl + pr) / 2, cyc = (pt + pb) / 2 + (s * (vmax + vmin)) / 2;
        const P3 = (x, y, z) => { const xr = x * cy_ - y * sy_, yr = x * sy_ + y * cy_; return { X: cx0 + s * xr, Y: cyc - s * (z * ce + yr * se), d: yr * ce - z * se }; };
        const pts = (arr) => arr.map((p) => p.X.toFixed(1) + ',' + p.Y.toFixed(1)).join(' ');
        /* floor with a grid and the two axes */
        el('polygon', { points: pts([P3(-FL, -FL, 0), P3(FL, -FL, 0), P3(FL, FL, 0), P3(-FL, FL, 0)]), fill: '#f3f1ea', stroke: C.axis, 'stroke-width': 1.2 }, dyn);
        for (let v = -2; v <= 2; v++) {
          const a = P3(v, -FL, 0), b = P3(v, FL, 0), c = P3(-FL, v, 0), d = P3(FL, v, 0);
          el('line', { x1: a.X, y1: a.Y, x2: b.X, y2: b.Y, stroke: v === 0 ? C.axis : '#e0dccf' }, dyn);
          el('line', { x1: c.X, y1: c.Y, x2: d.X, y2: d.Y, stroke: v === 0 ? C.axis : '#e0dccf' }, dyn);
        }
        const a1 = P3(FL + 0.3, 0, 0), a2 = P3(0, FL + 0.3, 0);
        T(dyn, a1.X, a1.Y + G.fs * 0.35, 'x₁', G.fs + 1, C.muted, { anchor: 'middle', weight: 700 });
        T(dyn, a2.X, a2.Y + G.fs * 0.35, 'x₂', G.fs + 1, C.muted, { anchor: 'middle', weight: 700 });
        /* the z axis, at a corner of the floor */
        const zb = P3(-FL, -FL, 0), zt = P3(-FL, -FL, 5.4);
        if (ce > 0.3) {
          el('line', { x1: zb.X, y1: zb.Y, x2: zt.X, y2: zt.Y, stroke: C.axis, 'stroke-width': 1.4 }, dyn);
          for (let v = 1; v <= 5; v++) { const p = P3(-FL, -FL, v); el('line', { x1: p.X - 3, y1: p.Y, x2: p.X + 3, y2: p.Y, stroke: C.axis }, dyn); if (v % 2 === 1 || !M) T(dyn, p.X - 6, p.Y + G.fs * 0.35, String(v), G.fs, C.muted, { anchor: 'end' }); }
          T(dyn, zt.X, zt.Y - 5, 'z', G.fs + 1, C.muted, { anchor: 'middle', weight: 700 });
        }
        /* the floor disc inside the dropped circle */
        const circ = (h) => Array.from({ length: 73 }, (_, k) => P3(LP.radius * Math.cos((k / 72) * 2 * Math.PI), LP.radius * Math.sin((k / 72) * 2 * Math.PI), h));
        if (dropV > 0.5) el('polygon', { points: pts(circ(0)), fill: C.teal, 'fill-opacity': 0.14 * clamp((dropV - 0.5) * 2), stroke: 'none' }, dyn);
        /* the bowl z = x1^2 + x2^2, as a wire frame that grows with the lift */
        if (t > 0.02) {
          [0.6, 1.2, 1.8, RB].forEach((r) => {
            const ring = Array.from({ length: 73 }, (_, k) => P3(r * Math.cos((k / 72) * 2 * Math.PI), r * Math.sin((k / 72) * 2 * Math.PI), t * r * r));
            el('polyline', { points: pts(ring), fill: 'none', stroke: C.grey, 'stroke-width': 1, opacity: 0.4 }, dyn);
          });
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * 2 * Math.PI, sp = Array.from({ length: 25 }, (_, j) => { const r = (j / 24) * RB; return P3(r * Math.cos(a), r * Math.sin(a), t * r * r); });
            el('polyline', { points: pts(sp), fill: 'none', stroke: C.grey, 'stroke-width': 1, opacity: 0.4 }, dyn);
          }
        }
        /* dots: shadows on the floor, stems, then the dots themselves, back to front around the sheet */
        const DOTS = RING.X.map((x, i) => ({ i: i, x: x[0], y: x[1], z: t * LIFTED[i][2], p: P3(x[0], x[1], t * LIFTED[i][2]), floor: P3(x[0], x[1], 0) }));
        if (t > 0.03) DOTS.forEach((o) => {
          el('line', { x1: o.floor.X, y1: o.floor.Y, x2: o.p.X, y2: o.p.Y, stroke: CL(RING.y[o.i]), 'stroke-width': 1, opacity: 0.3 }, dyn);
          el('circle', { cx: o.floor.X, cy: o.floor.Y, r: G.dr * 0.5, fill: 'none', stroke: CL(RING.y[o.i]), 'stroke-width': 1.2, opacity: 0.55 }, dyn);
        });
        const drawDot3 = (o) => {
          const lifted = t > 0.5;
          dotMark(dyn, o.p.X, o.p.Y, RING.y[o.i], G.dr, { tip: '<b>Dot ' + (o.i + 1) + '</b> (made up), group ' + grpName(RING.y[o.i]) + '<br>(x₁, x₂) = (' + f2(RING.X[o.i][0]) + ', ' + f2(RING.X[o.i][1]) + ')' + (lifted ? '<br>height z = ' + f2(LIFTED[o.i][2]) : '') });
        };
        /* a label on a white plate, so it stays readable whatever is behind it */
        const tag3 = (x, y, str) => {
          const w = str.length * G.fs * 0.62 + 8;
          el('rect', { x: x - w / 2, y: y - G.fs - 1, width: w, height: G.fs + 6, rx: 4, fill: '#fff', 'fill-opacity': 0.9 }, dyn);
          T(dyn, x, y, str, G.fs, '#0b5f5f', { anchor: 'middle', weight: 700 });
        };
        const far = (a, b) => b.p.d - a.p.d;
        const below = planeA > 0.02 ? DOTS.filter((o) => o.z <= planeH) : DOTS, above = planeA > 0.02 ? DOTS.filter((o) => o.z > planeH) : [];
        below.sort(far).forEach(drawDot3);
        /* the flat sheet z = c, and the circle where it cuts the bowl */
        if (planeA > 0.02) {
          const h = st === 1 ? planeH : LP.c;
          el('polygon', { points: pts([P3(-FL, -FL, h), P3(FL, -FL, h), P3(FL, FL, h), P3(-FL, FL, h)]), fill: C.teal, 'fill-opacity': 0.2 * planeA, stroke: C.teal, 'stroke-width': 1.6, 'stroke-opacity': planeA }, dyn);
          const lab = P3(FL, FL, h);
          tag3(lab.X, lab.Y - 6, 'flat sheet');
        }
        if (circA > 0.02) {
          el('polyline', { points: pts(circ(circH)), fill: 'none', stroke: C.teal, 'stroke-width': 3.4, opacity: circA, 'stroke-linejoin': 'round' }, dyn);
          if (dropV > 0.9) { const p = P3(LP.radius * Math.cos(0.8), LP.radius * Math.sin(0.8), 0); tag3(p.X + 4 + 20, p.Y - 7, 'circle'); }
        }
        above.sort(far).forEach(drawDot3);
        const view = Math.round(deg(cam.el));
        C0.cap(st === 0 ? (t < 0.05 ? 'Seen from above, the dots are the flat picture you know.' : 'Lifting each dot to the height <b>z = x₁² + x₂²</b>. Cluster: low. Ring: high. View from ' + view + '° above the floor.')
          : st === 1 ? (planeA < 0.2 ? 'The groups are at different heights now.' : 'A <b class="legend-t">flat sheet</b> at height ' + f2(LP.c) + ': the cluster below it, the ring above. No dot is on the wrong side.')
          : dropV < 0.05 ? 'The circle where the sheet cuts the bowl, at height ' + f2(LP.c) + '.'
          : dropV < 0.95 ? 'The circle slides down to the floor&hellip;'
          : cam.el > rad(80) ? 'Looking from above: the <b class="legend-t">circle</b> separates the cluster from the ring, in plain 2-D.' : 'The circle sits on the floor. Drag to rotate, or slide it back up.');
      }
    };
  });

  /* ============================================================
     Chapter 6 - the kernel trick
     ============================================================ */
  const REF_PTS = [RING.X[0], RING.X[1], [2.7, 1.9]];
  const PAIRS = [{ x: [1, 2], y: [3, 1] }, { x: [-1.5, 2], y: [2, 0.5] }];
  const rndPair = () => { const v = () => Math.round((Math.random() * 6 - 3) * 2) / 2; return { x: [v(), v()], y: [v(), v()] }; };
  register('ch6', function (C0) {
    const svg = C0.svg, G = geo(C0), M = G.M, W = G.W, H = G.H;
    const dyn = el('g', {}, svg);
    let stage = 0;
    const refPoint = () => (S.ref6.i !== undefined ? RING.X[S.ref6.i] : S.ref6.p);
    Array.prototype.forEach.call($('grp6a').querySelectorAll('button'), (b) => { b.onclick = () => { S.k6 = b.getAttribute('data-k'); S.rev++; C0.redraw(); }; });
    Array.prototype.forEach.call($('grp6a2').querySelectorAll('button'), (b) => { b.onclick = () => { const k = +b.getAttribute('data-ref'); S.ref6 = k < 2 ? { i: k } : { p: REF_PTS[2] }; S.rev++; C0.redraw(); }; });
    Array.prototype.forEach.call($('grp6b').querySelectorAll('button[data-pair]'), (b) => { b.onclick = () => { S.pair6 = +b.getAttribute('data-pair'); S.rev++; C0.redraw(); }; });
    $('pairRnd6').onclick = () => { S.rnd6 = rndPair(); S.pair6 = 2; S.rev++; C0.redraw(); };
    const gin = $('g6'), gout = $('g6Out');
    gin.oninput = () => { S.g6 = +gin.value; S.rev++; C0.redraw(); };
    svg.addEventListener('click', (e) => {
      if (stage !== 0) return;
      const n = e.target && e.target.closest ? e.target.closest('[data-pick]') : null;
      if (n) { S.ref6 = { i: +n.getAttribute('data-pick') }; S.rev++; C0.redraw(); }
    });
    const kval = (k, x, p) => (k === 'linear' ? SV.dot(x, p) : k === 'poly' ? Math.pow(SV.dot(x, p), 2) : Math.exp(-G_REF * SV.sqDist(x, p)));
    const kname = { linear: 'dot product', poly: 'squared dot product', rbf: 'RBF' };
    return {
      render: function (st, q) {
        stage = st;
        clear(dyn); ctlOn(C0.ctl);
        grpState($('grp6a'), st === 0, true); grpState($('grp6a2'), st === 0, true); grpState($('grp6b'), st === 1, true); grpState($('grp6c'), st === 2, true);
        Array.prototype.forEach.call($('grp6a').querySelectorAll('button'), (b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-k') === S.k6)));
        Array.prototype.forEach.call($('grp6a2').querySelectorAll('button'), (b) => { const k = +b.getAttribute('data-ref'); b.setAttribute('aria-pressed', String(k < 2 ? S.ref6.i === k : S.ref6.p !== undefined)); });
        Array.prototype.forEach.call($('grp6b').querySelectorAll('button[data-pair]'), (b) => b.setAttribute('aria-pressed', String(+b.getAttribute('data-pair') === S.pair6)));
        if (st === 0) {
          const fr = frame(G, DOM_RING, { top: M ? 0 : 6 }), r = fr.rect, p = refPoint(), k = S.k6;
          const w = 110, h = Math.max(20, Math.round((w * r.h) / r.w)), vals = new Float32Array(w * h);
          let vmax = 1e-9;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = kval(k, [fr.ix(r.x + ((x + 0.5) / w) * r.w), fr.iy(r.y + ((y + 0.5) / h) * r.h)], p); vals[y * w + x] = v; vmax = Math.max(vmax, Math.abs(v)); }
          canvasImage(dyn, r, w, h, (x, y) => {
            const v = vals[y * w + x] / vmax, c = v >= 0 ? mixRgb(WHITE, TEAL, v * 0.92) : mixRgb(WHITE, GREYC, -v * 0.8);
            return [c[0], c[1], c[2], 255];
          });
          frameAxes(dyn, G, fr);
          const pickable = (i) => i;
          for (let i = 0; i < RING.n; i++) {
            const mk = dotMark(dyn, fr.sx(RING.X[i][0]), fr.sy(RING.X[i][1]), RING.y[i], G.dr * 0.85, { cls: 'hit', tip: dotTip(RING, i, '<br>similarity to the reference: ' + f2(kval(k, RING.X[i], p)) + '<br>click to make it the reference') });
            mk.setAttribute('data-pick', pickable(i));
          }
          const cx = fr.sx(p[0]), cy = fr.sy(p[1]), s = G.M ? 7 : 9;
          const cross = 'M' + (cx - s) + ',' + (cy - s) + 'L' + (cx + s) + ',' + (cy + s) + 'M' + (cx - s) + ',' + (cy + s) + 'L' + (cx + s) + ',' + (cy - s);
          el('path', { d: cross, stroke: '#fff', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, dyn);
          el('path', { d: cross, stroke: C.accent, 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round' }, dyn);
          infoText(dyn, G, r.x + 8, r.y + G.fs + 6, 'similarity: ' + kname[k], C.ink);
          C0.cap(k === 'linear' ? '<b>Dot product</b>: large in the same direction from the centre as the cross, negative (grey) in the opposite one.'
            : k === 'poly' ? '<b>Squared dot product</b>: both ends of a direction count as similar, a first hint of a bowl.'
            : '<b>RBF</b>: a bump, dark close to the cross and fading far away.<span class="lg"> Click a dot to move the cross.</span>');
        } else if (st === 1) {
          const pr = S.pair6 === 2 && S.rnd6 ? S.rnd6 : PAIRS[Math.min(S.pair6, 1)], ki = SV.kernelIdentity(pr.x, pr.y);
          const pad = G.m.l - (M ? 12 : 30), bw = W - 2 * pad, fs = M ? 10.5 : 15, lh = fs + (M ? 7 : 11);
          const vec = (v) => '(' + v.map(n2).join(', ') + ')';
          T(dyn, W / 2, G.m.t + fs + 4, 'x = ' + vec(pr.x) + '     y = ' + vec(pr.y), fs + 1.5, C.ink, { anchor: 'middle', weight: 700 });
          const box = (y0, title, col, lines) => {
            const bh = lh * (lines.length + 1) + 14;
            el('rect', { x: pad, y: y0, width: bw, height: bh, rx: 10, fill: '#fff', stroke: col, 'stroke-width': 2 }, dyn);
            T(dyn, pad + 12, y0 + lh, title, fs, col, { weight: 800 });
            lines.forEach((ln, i) => T(dyn, pad + 12, y0 + lh * (i + 2), ln, fs, C.ink));
            return bh;
          };
          const y1 = G.m.t + fs + (M ? 14 : 24);
          const h1 = box(y1, 'Route 1: lift both dots to 3-D, then take the dot product', C.accent, [
            'φ(x) = ' + vec(ki.phiX), 'φ(y) = ' + vec(ki.phiY),
            'φ(x)·φ(y) = ' + ki.parts.map(n2).join(' + ') + ' = ' + n2(ki.rhs)]);
          const y2 = y1 + h1 + (M ? 10 : 18);
          const h2 = box(y2, 'Route 2: stay in 2-D, take the dot product, then square', C.teal, [
            'x·y = ' + [pr.x[0] * pr.y[0], pr.x[1] * pr.y[1]].map(n2).join(' + ') + ' = ' + n2(ki.dotXY),
            '(x·y)² = ' + n2(ki.dotXY) + '² = ' + n2(ki.lhs)]);
          const y3 = y2 + h2 + (M ? 14 : 26);
          el('rect', { x: pad, y: y3 - fs - 6, width: bw, height: fs + 14, rx: 8, fill: C.tealSoft, stroke: C.teal, 'stroke-width': 1.6 }, dyn);
          T(dyn, W / 2, y3 + 2, n2(ki.rhs) + '  =  ' + n2(ki.lhs) + '   the same number, without ever lifting', fs, C.teal, { anchor: 'middle', weight: 800 });
          C0.cap('Route 1 builds the lifted points; route 2 never does. Try another pair: the two routes always agree.');
        } else {
          const gm = GAMMAS[S.g6], r = { x: G.m.l + 6, y: G.m.t + (M ? 26 : 32), w: W - G.m.l - G.m.r - 12, h: H - G.m.t - G.m.b - (M ? 24 : 36) - (M ? 26 : 32) };
          sliderSync(gin, gout, S.g6, 'γ = ' + fG(gm));
          const ds = Array.from({ length: 81 }, (_, k) => k * 0.05), sp = strip(dyn, G, r, {
            x0: 0, x1: 4, y0: 0, y1: 1.02, xs: ds, ys: ds.map((d) => Math.exp(-gm * d * d)), xticks: [0, 1, 2, 3, 4], yticks: [0, 0.5, 1], yfmt: (v) => String(v),
            title: M ? 'similarity against distance' : 'RBF similarity against the distance between two dots'
          });
          [0.1, 1, 10].forEach((g0) => {
            const pts = ds.map((d) => [sp.sx(d), sp.sy(Math.exp(-g0 * d * d))]);
            el('path', { d: pathD(pts), fill: 'none', stroke: C.grey, 'stroke-width': 1.3, 'stroke-dasharray': '4 3', opacity: 0.7 }, dyn);
            T(dyn, sp.sx(g0 === 10 ? 0.45 : g0 === 1 ? 1.35 : 3.3), sp.sy(Math.exp(-g0 * (g0 === 10 ? 0.45 : g0 === 1 ? 1.35 : 3.3) ** 2)) - 6, 'γ = ' + g0, G.fs, C.muted, { anchor: 'start' });
          });
          el('path', { d: pathD(ds.map((d) => [sp.sx(d), sp.sy(Math.exp(-gm * d * d))])), fill: 'none', stroke: C.accent, 'stroke-width': 3.2, 'stroke-linejoin': 'round' }, dyn);
          [1, 2].forEach((d) => {
            const v = Math.exp(-gm * d * d), x = sp.sx(d), y = sp.sy(v);
            el('circle', { cx: x, cy: y, r: G.dr, fill: C.accent, stroke: '#fff', 'stroke-width': 1.5, 'data-tip': 'two dots ' + d + ' apart: similarity ' + f2(v) }, dyn);
            T(dyn, x + 8, y - 8, d + ' apart: ' + f2(v), G.fs, C.accent, { weight: 700, halo: true });
          });
          T(dyn, r.x + r.w / 2, r.y + r.h + G.fs + G.ft + 8, M ? 'distance between two dots' : 'distance between the two dots', G.ft, C.muted, { anchor: 'middle' });
          C0.cap('<b>γ = ' + fG(gm) + '</b>: dots 1 apart score ' + f2(Math.exp(-gm)) + ', dots 2 apart ' + f2(Math.exp(-4 * gm)) + '. A larger γ forgets faster.');
        }
      }
    };
  });

  /* ============================================================
     Chapter 7 - kernels side by side, and gamma
     ============================================================ */
  const RUNS7 = {};
  function run7(ds, kk, gi) {
    const key = ds + '|' + kk + '|' + gi;
    if (!RUNS7[key]) {
      if (kk === 'rbf-g') RUNS7[key] = GS[ds][gi];
      else RUNS7[key] = KER_RUN[ds][kk];
    }
    return RUNS7[key];
  }
  const KNAME = { linear: 'linear', poly2: 'polynomial, degree 2', poly3: 'polynomial, degree 3', rbf: 'RBF, γ = ' + G_REF };
  register('ch7', function (C0) {
    const svg = C0.svg, G = geo(C0), M = G.M, W = G.W;
    const dyn = el('g', {}, svg);
    Array.prototype.forEach.call($('grp7a').querySelectorAll('button'), (b) => { b.onclick = () => { S.ds7 = b.getAttribute('data-ds'); S.rev++; C0.redraw(); }; });
    Array.prototype.forEach.call($('grp7b').querySelectorAll('button'), (b) => { b.onclick = () => { S.ker7 = b.getAttribute('data-ker'); S.rev++; C0.redraw(); }; });
    const gin = $('g7'), gout = $('g7Out');
    gin.oninput = () => { S.g7 = +gin.value; S.rev++; C0.redraw(); };
    $('auto7').onclick = () => { S.g7 = null; S.rev++; C0.redraw(); };
    return {
      render: function (st, q) {
        clear(dyn); ctlOn(C0.ctl);
        grpState($('grp7a'), true, true); grpState($('grp7b'), st === 0, true); grpState($('grp7c'), st > 0, true);
        Array.prototype.forEach.call($('grp7a').querySelectorAll('button'), (b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-ds') === S.ds7)));
        Array.prototype.forEach.call($('grp7b').querySelectorAll('button'), (b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-ker') === S.ker7)));
        const ds = S.ds7, d = D[ds];
        const gi = S.g7 !== null ? S.g7 : (st === 1 ? Math.round(lerp(6, NG - 1, ease(clamp(q / 0.9)))) : st === 2 ? Math.round(lerp(0, NG - 1, ease(clamp(q / 0.9)))) : G_DEFAULT);
        $('auto7').disabled = S.g7 === null;
        sliderSync(gin, gout, gi, 'γ = ' + fG(GAMMAS[gi]));
        if (st < 2) {
          const fr = frame(G, DOMS[ds], { top: M ? 0 : 4 });
          const run = st === 0 ? run7(ds, S.ker7) : run7(ds, 'rbf-g', gi);
          decisionMap(dyn, fr, run.model);
          frameAxes(dyn, G, fr);
          for (let i = 0; i < d.n; i++) {
            const x = fr.sx(d.X[i][0]), y = fr.sy(d.X[i][1]);
            dotMark(dyn, x, y, d.y[i], G.dr * 0.9, { tip: dotTip(d, i, svTip(run.model, i)) });
            if (run.model.sv.indexOf(i) >= 0) ringMark(dyn, x, y, G.dr * 0.9, C.ink, 3.5);
          }
          const name = st === 0 ? KNAME[S.ker7] : 'RBF, γ = ' + fG(GAMMAS[gi]);
          infoText(dyn, G, fr.rect.x + 8, fr.rect.y + G.fs + 6, (ds === 'rings' ? 'rings' : 'moons') + ' · ' + name, C.ink);
          infoText(dyn, G, fr.rect.x + 8, fr.rect.y + 2 * G.fs + 11, 'training ' + pc0(run.train) + ' · fresh ' + pc0(run.fresh) + ' · ' + (M ? run.nSV + ' SV' : SVWORD(run.nSV)), run.fresh >= 0.95 ? C.teal : C.red);
          C0.cap(st === 0 ? '<b>' + KNAME[S.ker7] + '</b> on the ' + ds + ': ' + pc0(run.train) + ' of the ' + d.n + ' training dots, ' + pc0(run.fresh) + ' of ' + FRESH + ' fresh ones.<span class="lg"> Blue and orange areas: the predicted group. White: the street. Ringed: support vectors.</span>'
            : '<b>γ = ' + fG(GAMMAS[gi]) + '</b>: training ' + pc0(run.train) + ', fresh ' + pc0(run.fresh) + ', ' + SVWORD(run.nSV) + ' of ' + d.n + '. ' + (gi >= 14 ? 'Little islands around single dots.' : gi <= 2 ? 'Too smooth to follow the shape.' : 'A smooth boundary.'));
        } else {
          const sw = GS[ds], r = { x: G.m.l + 6, y: G.m.t + (M ? 26 : 32), w: W - G.m.l - G.m.r - 12, h: G.H - G.m.t - G.m.b - (M ? 24 : 36) - (M ? 26 : 32) };
          const xs = sw.map((_, i) => i);
          const sp = strip(dyn, G, r, {
            x0: 0, x1: NG - 1, y0: 0.4, y1: 1.0, xs: xs, ys: sw.map((s) => s.train), xticks: [0, 5, 10, 15, 20], xfmt: (v) => fG(GAMMAS[v]), yticks: [0.5, 0.75, 1.0], yfmt: (v) => Math.round(v * 100) + '%',
            title: M ? 'accuracy against γ' : 'accuracy against γ (log scale), ' + ds, cur: gi, curY: sw[gi].train
          });
          el('path', { d: pathD(xs.map((x, i) => [sp.sx(x), sp.sy(clamp(sw[i].fresh, 0.4, 1))])), fill: 'none', stroke: C.orange, 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, dyn);
          xs.forEach((x, i) => {
            const cx = sp.sx(x), cy = sp.sy(clamp(sw[i].train, 0.4, 1)), fy = sp.sy(clamp(sw[i].fresh, 0.4, 1)), dd = G.dr * 0.85;
            el('circle', { cx: cx, cy: cy, r: G.dr * 0.7, fill: C.blue, stroke: '#fff', 'stroke-width': 1, 'data-tip': '<b>γ = ' + fG(GAMMAS[i]) + '</b><br>training ' + pc0(sw[i].train) + '<br>fresh ' + pc0(sw[i].fresh) + '<br>' + SVWORD(sw[i].nSV) }, dyn);
            el('polygon', { points: cx + ',' + (fy - dd) + ' ' + (cx + dd) + ',' + fy + ' ' + cx + ',' + (fy + dd) + ' ' + (cx - dd) + ',' + fy, fill: '#fff', stroke: C.orange, 'stroke-width': 1.8, 'data-tip': '<b>γ = ' + fG(GAMMAS[i]) + '</b><br>fresh ' + pc0(sw[i].fresh) }, dyn);
          });
          const bi = SV.bestIndexBy(sw, (s) => s.fresh);
          T(dyn, sp.sx(NG - 1) - 2, sp.sy(0.43), M ? 'islands' : 'larger γ: islands, memorising', G.fs, C.muted, { anchor: 'end', weight: 600 });
          T(dyn, sp.sx(0) + 4, sp.sy(0.43), M ? 'too smooth' : 'smaller γ: too smooth', G.fs, C.muted, { weight: 600 });
          T(dyn, sp.sx(7), sp.sy(0.63), 'training dots', G.fs, C.blue, { weight: 700 });
          T(dyn, sp.sx(7), sp.sy(0.63) + G.fs + 4, 'fresh dots', G.fs, C.orange, { weight: 700 });
          T(dyn, r.x + r.w / 2, r.y + r.h + G.fs + G.ft + 8, M ? 'γ' : 'γ, how narrow each dot’s bump is', G.ft, C.muted, { anchor: 'middle' });
          C0.cap('<b>γ = ' + fG(GAMMAS[gi]) + '</b> on the ' + ds + ': training ' + pc0(sw[gi].train) + ', fresh ' + pc0(sw[gi].fresh) + '. Best fresh accuracy ' + pc0(sw[bi].fresh) + ' near γ = ' + fG(GAMMAS[bi]) + '.');
        }
      }
    };
  });

  /* ============================================================
     Chapter 8 - scikit-learn
     ============================================================ */
  register('ch8', function (C0) {
    const svg = C0.svg, M = C0.M, W = C0.W;
    const H8 = M ? 60 : 100;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H8);
    const snips = Array.prototype.slice.call(document.querySelectorAll('#pan8 .snip'));
    Array.prototype.forEach.call($('grp8').querySelectorAll('button[data-snip]'), (b) => { b.onclick = () => { S.snip = +b.getAttribute('data-snip'); S.rev++; C0.redraw(); }; });
    $('auto8').onclick = () => { S.snip = null; S.rev++; C0.redraw(); };
    snips.forEach((sn) => {
      const btn = sn.querySelector('.copy'), code = sn.querySelector('pre.code');
      btn.onclick = () => {
        const text = code.textContent;
        const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1600); };
        const fallback = () => {
          try {
            const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta);
            if (ok) done(); else btn.textContent = 'Select and copy by hand';
          } catch (e) { btn.textContent = 'Select and copy by hand'; }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
      };
    });
    const dyn = el('g', {}, svg);
    /* the four boxes of the pipeline in each snippet: [desktop label, mobile label] */
    const FLOW = [
      { boxes: [['X, y', 'X, y'], ['SVC, linear kernel', 'SVC'], ['support_vectors_', 'support'], ['predict', 'predict']], hi: [1, 2], cap: 'Snippet 1: fit an <code>SVC</code> and read the support vectors.' },
      { boxes: [['X (2 numbers)', 'X'], ['StandardScaler', 'scaler'], ['SVC (kernel, C, γ)', 'SVC'], ['score', 'score']], hi: [1, 2], cap: 'Snippet 2: scaler and SVM in one pipeline.' },
      { boxes: [['X_train', 'train'], ['Pipeline', 'pipe'], ['GridSearchCV', 'grid'], ['best_params_', 'best']], hi: [2], cap: 'Snippet 3: try every pair of C and γ, with cross-validation.' },
      { boxes: [['sentences', 'text'], ['TfidfVectorizer', 'TF-IDF'], ['LinearSVC', 'LinearSVC'], ['language', 'language']], hi: [1, 2], cap: 'Snippet 4: text to numbers to a straight street.' },
      { boxes: [['X', 'X'], ['gram(X, X)', 'gram'], ['SVC, precomputed', 'SVC'], ['score', 'score']], hi: [1, 2], cap: 'Snippet 5: you compute the similarity table, the SVM does the rest.' }
    ];
    return {
      render: function (st) {
        clear(dyn); ctlOn(C0.ctl);
        const cur = S.snip !== null ? S.snip : st;
        snips.forEach((sn, i) => { sn.hidden = i !== cur; });
        Array.prototype.forEach.call($('grp8').querySelectorAll('button[data-snip]'), (b) => b.setAttribute('aria-pressed', String(+b.getAttribute('data-snip') === cur)));
        $('auto8').disabled = S.snip === null;
        const f = FLOW[cur], n = 4, gap = M ? 14 : 26, bw = (W - 24 - gap * (n - 1)) / n, bh = M ? 36 : 60, y0 = (H8 - bh) / 2, fs = M ? 10 : 12;
        f.boxes.forEach((b, i) => {
          const x = 12 + i * (bw + gap), hi = f.hi.indexOf(i) >= 0;
          el('rect', { x: x, y: y0, width: bw, height: bh, rx: 9, fill: hi ? C.accentSoft : '#f1eee6', stroke: hi ? C.accent : C.axis, 'stroke-width': hi ? 2.4 : 1.4 }, dyn);
          T(dyn, x + bw / 2, y0 + bh / 2 + fs * 0.35, b[M ? 1 : 0], fs, hi ? C.accent : C.ink, { anchor: 'middle', weight: hi ? 700 : 500 });
          if (i < n - 1) {
            const ax = x + bw + 3;
            el('line', { x1: ax, y1: y0 + bh / 2, x2: ax + gap - 9, y2: y0 + bh / 2, stroke: C.grey, 'stroke-width': 2, 'stroke-linecap': 'round' }, dyn);
            el('path', { d: 'M ' + (ax + gap - 3) + ' ' + (y0 + bh / 2) + ' l -6 -4 l 0 8 z', fill: C.grey }, dyn);
          }
        });
        C0.cap(f.cap);
      }
    };
  });

  /* ============================================================
     Chapter 9 - recap
     ============================================================ */
  register('ch9', function (C0) {
    const svg = C0.svg, W = C0.W, M = C0.M;
    const H9 = M ? 62 : 150;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H9);
    const items = [['street', 'widest margin'], ['C', 'allow mistakes'], ['lift', 'with a kernel'], ['fresh', 'check on new data']];
    const cy = M ? 22 : 56, r = M ? 15 : 28, x0 = W * 0.13, dx = W * 0.245;
    items.forEach((it, i) => {
      const x = x0 + i * dx;
      if (i < 3) {
        el('line', { x1: x + r + 4, y1: cy, x2: x + dx - r - 12, y2: cy, stroke: C.grey, 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
        el('path', { d: 'M ' + (x + dx - r - 3) + ' ' + cy + ' l -9 -6 l 0 12 z', fill: C.grey }, svg);
      }
      el('circle', { cx: x, cy: cy, r: r, fill: i === 3 ? C.accent : '#fff', stroke: C.accent, 'stroke-width': 3 }, svg);
      T(svg, x, cy + (M ? 5 : 9), String(i + 1), M ? 15 : 26, i === 3 ? '#fff' : C.accent, { anchor: 'middle', weight: 800 });
      T(svg, x, cy + r + (M ? 15 : 24), it[0], M ? 11 : 16, C.ink, { anchor: 'middle', weight: 700 });
      if (!M) T(svg, x, cy + r + 44, it[1], 13, C.muted, { anchor: 'middle' });
    });
    const panel = $('pan9');
    panel.innerHTML = '';
    const card = (cls, badge, title, formulaTex, sub) => {
      const c = document.createElement('div'); c.className = 'rcard ' + cls;
      const b = document.createElement('span'); b.className = 'badge'; b.textContent = badge; c.appendChild(b);
      const t = document.createElement('div'); t.className = 'rtxt';
      const h = document.createElement('b'); h.textContent = title; t.appendChild(h);
      if (formulaTex) { const f = document.createElement('div'); f.className = 'rform'; setTex(f, formulaTex); t.appendChild(f); }
      if (sub) { const p = document.createElement('div'); p.className = 'rsub'; p.textContent = sub; t.appendChild(p); }
      c.appendChild(t);
      return c;
    };
    const mk = () => { const d = document.createElement('div'); d.className = 'rgroup'; panel.appendChild(d); return d; };
    const g0 = mk(), g1 = mk(), g2 = mk();
    g0.appendChild(card('good', 'M', 'Margin and support vectors', null, 'the widest empty street; only the few dots on its edge hold it'));
    g0.appendChild(card('', 'C', 'Soft margin: C', null, 'price of a mistake; smaller C: wider street, stronger regularization'));
    g0.appendChild(card('good', 'K', 'Kernel trick', null, 'a similarity score that acts as if the dots were lifted, without lifting them'));
    g0.appendChild(card('warn', 'γ', 'γ of the RBF kernel', null, 'how narrow each dot’s bump is; too large and the model memorises'));
    g1.appendChild(card('good', '+', 'Many features, sparse text', null, 'TF-IDF with a linear SVM was a strong text-classification baseline for years'));
    g1.appendChild(card('good', '+', 'Small and medium data sets', null, 'kernels such as RBF can draw curved boundaries'));
    g1.appendChild(card('warn', '−', 'Very many examples', null, 'kernel SVMs train in time that grows at least quadratically with the number of examples'));
    g1.appendChild(card('warn', '−', 'No probabilities by default', null, 'you get scores; probability=True adds Platt scaling and is slower'));
    g2.appendChild(card('good', '1', 'Scale the features', null, 'a StandardScaler inside a pipeline; an SVM measures distances'));
    g2.appendChild(card('', '2', 'Start simple', null, 'a linear street for text; RBF for small dense data'));
    g2.appendChild(card('', '3', 'Tune on validation, judge on fresh', null, 'cross-validate C and γ; touch the test data once'));
    g2.appendChild(card('warn', '4', 'Language technology', null, 'language identification, topic and sentiment labels, spam filtering'));
    const groups = [g0, g1, g2], caps = ['The big idea in four lines.', 'Strengths and limits.', 'Rules of thumb.'];
    return {
      render: function (stage) {
        $('ctl9').classList.remove('on');
        groups.forEach((g, i) => { g.hidden = i !== stage; });
        C0.cap(caps[stage]);
      }
    };
  });

  update();
})();
