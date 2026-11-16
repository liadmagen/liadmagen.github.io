/* Scroll-driven visual introduction to feature scaling and generalization ("Fair Scales, Honest Models").
   All numbers come from sg-math.js (window.SGM); all formulas are rendered with the vendored KaTeX.
   No other libraries, no build step. Every figure is a pure function of (step, scroll progress, user state):
   scrolling backwards simply redraws earlier states. */
(function () {
  'use strict';
  const SG = window.SGM;
  if (!SG) { console.error('sg-math.js did not load'); return; }

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
  const MINUS = '−';
  const fmt = (v, d) => (v < 0 && Number(Math.abs(v).toFixed(d)) !== 0 ? MINUS : '') + Math.abs(v).toFixed(d);
  const fmtInt = (v) => Math.round(v).toLocaleString('en-US');
  /* an error value (a mean squared error): enough digits to compare, never scientific notation */
  const fe = (v) => (v >= 100 ? fmtInt(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  const pc = (v) => Math.round(v * 100) + '%';
  /* lambda for display: 0, or a plain decimal */
  const fLam = (v) => (v === 0 ? '0' : v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v >= 0.01 ? String(+v.toPrecision(2)) : v.toFixed(5).replace(/0+$/, ''));
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* controls stay in place (no layout jump); they are just disabled and dimmed when not relevant */
  function ctlOn(ctl) { ctl.classList.add('on'); }
  function grpState(grp, visible, enabled) {
    grp.hidden = !visible;
    Array.prototype.forEach.call(grp.querySelectorAll('input,button,select'), (n) => { n.disabled = !enabled; });
    grp.classList.toggle('off', visible && !enabled);
  }
  const $ = (id) => document.getElementById(id);

  /* palette: blue / orange = the two clusters (people) or training / fresh essays (essays); purple = what you control or pick;
     teal = the best; red = a mistake; green / rose = height / weight in chapter 2 */
  const C = {
    ink: '#1d2733', muted: '#55636f', line: '#e5e1d8', card: '#ffffff', dot: '#46515e', model: '#1d2733',
    blue: '#1f6fd1', blueSoft: '#dbe8fa', orange: '#d9730d', orangeSoft: '#fbe6d0', grey: '#7d8894',
    teal: '#0f8a8a', accent: '#6d5bd0', accentSoft: '#e9e5fa', red: '#b3261e', grid: '#ece9e1', axis: '#a9a396',
    hgt: '#2b8a3e', wgt: '#b0457a'
  };
  const CL = [C.blue, C.orange]; /* cluster / group colours: 0 = the A side (blue), 1 = the B side (orange) */

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

  /* ------------------------------------------------------------------ data (all from sg-math.js) */
  const P = SG.PEOPLE, N = P.n, GN = SG.GROUP_NAMES;
  const RUNS = {
    raw: SG.runPeople('raw'), cm: SG.runPeople('raw', { height: 'cm' }), grams: SG.runPeople('raw', { height: 'cm', weight: 'g' }),
    minmax: SG.runPeople('minmax'), zscore: SG.runPeople('zscore')
  };
  const NEWP = SG.NEW_PERSON;
  const PAIR_EX = SG.closestPair(P, 0.10, 20), PAIR_X = SG.closestAcrossGroups(P);
  const grpIdx = (g) => P.group.map((v, i) => (v === g ? i : -1)).filter((i) => i >= 0);
  const rng2 = (a) => [Math.min.apply(null, a), Math.max.apply(null, a)];
  const HR = [0, 1].map((g) => rng2(grpIdx(g).map((i) => P.height[i])));
  const WR = [0, 1].map((g) => rng2(grpIdx(g).map((i) => P.weight[i])));
  const SQ = { minmax: SG.outlierSqueeze('minmax'), zscore: SG.outlierSqueeze('zscore') };
  const baseRows = SG.features(P);

  const ES = SG.ESSAYS, NTR = ES.train.x.length, NTE = ES.test.x.length;
  const DEG = SG.degreeSweep(ES.train, ES.test, 12);
  const RS = SG.lambdaSweep(ES.train, ES.test, 12, 'l2'), LS = SG.lambdaSweep(ES.train, ES.test, 12, 'l1');
  const BD = SG.bestIndex(DEG), BR = SG.bestIndex(RS), BL = SG.bestIndex(LS), NL = SG.LAMBDAS.length;
  const UL = SG.UNITS_LAMBDAS;

  /* user state shared by all figures */
  const S = {
    rev: 0, pair: [PAIR_EX.i, PAIR_EX.j], pickNext: 0, km: { manual: null }, unit: 'm',
    sc: 'zscore', scFrom: 'zscore', scT: -1e9, outlier: null,
    deg: null, l2: null, l1: null, toy: 0, u: 14
  };

  /* ------------------------------------------------------------------ prose placeholders {{key}} */
  function val(spec) {
    const a = spec.trim().split(/\s+/);
    let out;
    switch (a[0]) {
      case 'n': out = String(N); break;
      case 'nTrain': out = String(NTR); break;
      case 'nTest': out = String(NTE); break;
      case 'nU': out = String(SG.UNITS_DATA.n); break;
      case 'aMaxH': out = HR[0][1].toFixed(2); break;
      case 'bMinH': out = HR[1][0].toFixed(2); break;
      case 'exShare': out = String(+(SG.distanceShares([1.75, 85], [1.65, 65]).shares[1] * 100).toFixed(4)) + '%'; break;
      case 'xgDh': out = Math.abs(P.height[PAIR_X.i] - P.height[PAIR_X.j]).toFixed(2); break;
      case 'xgD': out = Math.sqrt(PAIR_X.d2).toFixed(1); break;
      case 'rawIter': out = String(RUNS.raw.iterations); break;
      case 'rawAgree': out = pc(RUNS.raw.agreement); break;
      case 'cmAgree': out = pc(RUNS.cm.agreement); break;
      case 'gAgree': out = pc(RUNS.grams.agreement); break;
      case 'mmAgree': out = pc(RUNS.minmax.agreement); break;
      case 'zAgree': out = pc(RUNS.zscore.agreement); break;
      case 'outW': out = String(SG.OUTLIER.weight); break;
      case 'mmKeep': out = pc(SQ.minmax.ratio); break;
      case 'zKeep': out = pc(SQ.zscore.ratio); break;
      case 'test12': out = fe(DEG[11].test); break;
      case 'test1': out = fe(DEG[0].test); break;
      case 'bestDeg': out = String(BD + 1); break;
      case 'testBest': out = fe(DEG[BD].test); break;
      case 'ridgeT0': out = fe(RS[0].test); break;
      case 'ridgeBest': out = fe(RS[BR].test); break;
      case 'ridgeEnd': out = fe(RS[NL - 2].test); break;
      case 'lassoKept': out = String(12 - LS[BL].zeros); break;
      case 'lassoZeros': out = String(LS[BL].zeros); break;
      case 'ridgeZeros': out = String(RS[BR].zeros); break;
      case 'fracKept': out = pc(SG.unitsRidge(0.25, 1, false).kept[1]); break;
      case 'pctKept': out = pc(SG.unitsRidge(0.25, 100, false).kept[1]); break;
      case 'stdKept': out = pc(SG.unitsRidge(0.25, 1, true).kept[1]); break;
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
  const personTip = (i, extra) => '<b>Person ' + (i + 1) + '</b> (made up)<br>' + P.height[i].toFixed(2) + ' m, ' + P.weight[i] + ' kg<br>true group ' + GN[P.group[i]] + (extra || '');
  const essayTip = (d, i, kind) => '<b>' + kind + ' essay</b> (made up)<br>' + d.x[i].toFixed(1) + ' words per sentence<br>teacher’s rating ' + d.y[i].toFixed(1);

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
  /* axes: sx, sy are lin() scales; o = { xt, yt, xtitle, ytitle, yfmt, xfmt, ytx, grid } */
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

  /* a person: circle for group A, diamond for group B (so colour is never the only cue) */
  function personMark(g, i, x, y, fill, r, tipHtml, op, extra, plain) {
    let n;
    if (P.group[i] === 1 && !plain) {
      const d = r * 1.3;
      n = el('polygon', { points: x + ',' + (y - d) + ' ' + (x + d) + ',' + y + ' ' + x + ',' + (y + d) + ' ' + (x - d) + ',' + y, fill: fill, stroke: '#fff', 'stroke-width': 1.2 }, g);
    } else n = el('circle', { cx: x, cy: y, r: r, fill: fill, stroke: '#fff', 'stroke-width': 1.2 }, g);
    if (op !== undefined && op < 1) n.setAttribute('opacity', op);
    if (tipHtml) n.setAttribute('data-tip', tipHtml);
    if (extra) for (const k in extra) n.setAttribute(k, extra[k]);
    return n;
  }
  const ring = (g, x, y, r, col) => el('circle', { cx: x, cy: y, r: r + 4.5, fill: 'none', stroke: col || C.red, 'stroke-width': 2.2 }, g);
  function star(g, x, y, r, fill, stroke) {
    const pts = [];
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; pts.push((x + rr * Math.cos(a)).toFixed(1) + ',' + (y + rr * Math.sin(a)).toFixed(1)); }
    return el('polygon', { points: pts.join(' '), fill: fill, stroke: stroke || C.accent, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
  }
  /* a cluster centre: a bold cross in the cluster colour with a white halo */
  function centreMark(g, x, y, col, s, op) {
    const d = 'M' + (x - s) + ',' + (y - s) + 'L' + (x + s) + ',' + (y + s) + 'M' + (x - s) + ',' + (y + s) + 'L' + (x + s) + ',' + (y - s);
    const gg = el('g', op !== undefined && op < 1 ? { opacity: op } : {}, g);
    el('path', { d: d, stroke: '#fff', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, gg);
    el('path', { d: d, stroke: col, 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round' }, gg);
  }
  /* the line of points equally far from two centres, cut to the window x0..x1, y0..y1 (in the clustering's own units) */
  function bisector(c0, c1, x0, x1, y0, y1) {
    const a = c1[0] - c0[0], b = c1[1] - c0[1], c = (c1[0] * c1[0] + c1[1] * c1[1] - c0[0] * c0[0] - c0[1] * c0[1]) / 2, pts = [];
    if (Math.abs(b) > 1e-12) [x0, x1].forEach((x) => { const y = (c - a * x) / b; if (y >= y0 - 1e-9 && y <= y1 + 1e-9) pts.push([x, y]); });
    if (Math.abs(a) > 1e-12) [y0, y1].forEach((y) => { const x = (c - b * y) / a; if (x >= x0 - 1e-9 && x <= x1 + 1e-9) pts.push([x, y]); });
    return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
  }

  /* the people plot used by chapters 1 to 3 (honest axes): x = height, y = body weight */
  const HX = [1.5, 1.98], WY = [40, 108];
  function peopleFrame(G, unit, x0, x1) {
    const m = G.m, f = unit === 'cm' ? 100 : 1;
    return { sx: lin(HX[0] * f, HX[1] * f, x0 === undefined ? m.l : x0, x1 === undefined ? G.W - m.r : x1), sy: lin(WY[0], WY[1], G.H - m.b, m.t) };
  }
  const peopleAxes = (g, G, f, unit, o) => axes(g, G, f.sx, f.sy, Object.assign({
    xt: unit === 'cm' ? [150, 160, 170, 180, 190] : [1.5, 1.6, 1.7, 1.8, 1.9], yt: [40, 60, 80, 100],
    xfmt: unit === 'cm' ? String : (v) => v.toFixed(1),
    xtitle: unit === 'cm' ? 'height (cm)' : 'height (m)', ytitle: G.M ? 'weight (kg)' : 'body weight (kg)'
  }, o || {}));

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

  /* draw all people on a plot. o.pos(i) -> [x, y]; o.fill(i) -> colour; o.op(i); o.wrong(i); o.pick: make clickable */
  function drawPeople(g, G, o) {
    for (let i = 0; i < N; i++) {
      const p = o.pos(i);
      const mk = personMark(g, i, p[0], p[1], o.fill(i), G.dr, o.tip ? o.tip(i) : personTip(i), o.op ? o.op(i) : 1, o.pick ? { 'data-pick': i, class: 'hit' } : null);
      if (o.wrong && o.wrong(i)) ring(g, p[0], p[1], G.dr, C.red);
      void mk;
    }
  }

  /* ============================================================
     Chapter 1 - the people, and two hidden groups
     ============================================================ */
  register('ch1', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m;
    const f = peopleFrame(G), sx = f.sx, sy = f.sy;
    const defs = el('defs', {}, svg);
    clipRect(defs, 'clip1', m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    const dyn = el('g', {}, svg);
    return {
      render: function (stage, q) {
        clear(dyn);
        peopleAxes(dyn, G, f, 'm');
        const grp = stage === 1, u = grp ? clamp(q * 2.2) : 0;
        /* range bars: heights do not overlap, weights do */
        if (grp) {
          const bars = el('g', { opacity: clamp((q - 0.15) / 0.4) }, dyn);
          const yA = sy(48.5), yB = sy(52.5), lw = G.M ? 4 : 5, rr = G.dr * 0.75;
          [[0, yA], [1, yB]].forEach((gy) => {
            const g0 = gy[0], yy = gy[1];
            el('line', { x1: sx(HR[g0][0]), x2: sx(HR[g0][1]), y1: yy, y2: yy, stroke: C.dot, 'stroke-width': lw, 'stroke-linecap': 'butt', opacity: 0.55 }, bars);
            [HR[g0][0], HR[g0][1]].forEach((hv) => {
              if (g0) el('polygon', { points: sx(hv) + ',' + (yy - rr * 1.3) + ' ' + (sx(hv) + rr * 1.3) + ',' + yy + ' ' + sx(hv) + ',' + (yy + rr * 1.3) + ' ' + (sx(hv) - rr * 1.3) + ',' + yy, fill: C.dot }, bars);
              else el('circle', { cx: sx(hv), cy: yy, r: rr, fill: C.dot }, bars);
            });
          });
          T(bars, sx(HR[0][0]) - 2, sy(43) + 2, 'heights: A and B do not overlap', G.fs, C.ink, { weight: 600 });
          const xA = sx(1.935), xB = sx(1.965);
          [[0, xA], [1, xB]].forEach((gx) => {
            const g0 = gx[0], xx = gx[1];
            el('line', { x1: xx, x2: xx, y1: sy(WR[g0][0]), y2: sy(WR[g0][1]), stroke: C.dot, 'stroke-width': lw, opacity: 0.55 }, bars);
            [WR[g0][0], WR[g0][1]].forEach((wv) => {
              if (g0) el('polygon', { points: xx + ',' + (sy(wv) - rr * 1.3) + ' ' + (xx + rr * 1.3) + ',' + sy(wv) + ' ' + xx + ',' + (sy(wv) + rr * 1.3) + ' ' + (xx - rr * 1.3) + ',' + sy(wv), fill: C.dot }, bars);
              else el('circle', { cx: xx, cy: sy(wv), r: rr, fill: C.dot }, bars);
            });
          });
          T(bars, (xA + xB) / 2, sy(104.5) - 2, 'weights', G.fs, C.ink, { anchor: 'middle', weight: 600 });
          T(bars, (xA + xB) / 2, sy(104.5) + G.fs + 1, 'overlap', G.fs, C.ink, { anchor: 'middle', weight: 600 });
        }
        const dots = el('g', {}, dyn);
        for (let i = 0; i < N; i++) {
          const v = grp ? 1 : clamp(((q * 1.25 + 0.25) - (i / N) * 0.8) / 0.2, 0, 1);
          if (v < 0.01) continue;
          const y = sy(P.weight[i]) - (grp ? 0 : (1 - ease(v)) * 22);
          const asDiamond = grp && P.group[i] === 1;
          personMark(dots, i, sx(P.height[i]), y, C.dot, G.dr * (asDiamond ? lerp(0.6, 1, u) : 1), personTip(i), v, null, !grp);
        }
        $('ctl1').classList.remove('on');
        C0.cap(!grp ? (q < 0.45 ? 'Each dot is one made-up person.' : N + ' made-up people: height against body weight.')
          : 'Circles: group A. Diamonds: group B. The groups are far apart in height and almost on top of each other in weight.');
      }
    };
  });

  /* ============================================================
     Chapter 2 - what "close" means
     ============================================================ */
  register('ch2', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m, M = G.M;
    const top = m.t + (M ? 20 : 26), bot = H - m.b;
    const PLx = M ? [40, 196] : [66, 336], PRx = M ? [222, 374] : [392, 612];
    const dyn = el('g', {}, svg);
    const pick = (i) => {
      if (S.pickNext === 0) { S.pair = [i, S.pair[1] === i ? S.pair[0] : S.pair[1]]; S.pickNext = 1; } else { S.pair = [S.pair[0] === i ? S.pair[1] : S.pair[0], i]; S.pickNext = 0; }
      S.rev++; C0.redraw();
    };
    C0.svg.addEventListener('click', (ev) => {
      const n = ev.target && ev.target.closest ? ev.target.closest('[data-pick]') : null;
      if (n) pick(+n.getAttribute('data-pick'));
    });
    const setPair = (a, b) => { S.pair = [a, b]; S.pickNext = 0; S.rev++; C0.redraw(); };
    $('pairEx').onclick = () => setPair(PAIR_EX.i, PAIR_EX.j);
    $('pairX').onclick = () => setPair(PAIR_X.i, PAIR_X.j);
    $('pairRnd').onclick = () => {
      let a = Math.floor(Math.random() * N), b = Math.floor(Math.random() * N);
      while (b === a) b = Math.floor(Math.random() * N);
      setPair(a, b);
    };
    const sqTxt = (v) => (v < 1 ? String(+v.toPrecision(2)) : fmtInt(v));
    const shTxt = (v) => String(+v.toFixed(4)) + '%';

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlOn(C0.ctl);
        grpState(C0.ctl, true, true);
        const [a, b] = S.pair;
        const pa = [P.height[a], P.weight[a]], pb = [P.height[b], P.weight[b]];
        const ds = SG.distanceShares(pa, pb), dh = Math.abs(pa[0] - pb[0]), dw = Math.abs(pa[1] - pb[1]);
        const sel = (i) => i === a || i === b;
        if (stage === 0) {
          /* left: the scatter with the two picked people and the right triangle of their gaps */
          const f = { sx: lin(HX[0], HX[1], PLx[0], PLx[1]), sy: lin(WY[0], WY[1], bot, top) };
          axes(dyn, G, f.sx, f.sy, { xt: [1.6, 1.8], yt: [50, 75, 100], xfmt: (v) => v.toFixed(1), xtitle: 'height (m)', ytitle: 'weight (kg)', ytx: M ? 11 : 17 });
          T(dyn, (PLx[0] + PLx[1]) / 2, top - 8, 'pick two people', G.ft, C.ink, { anchor: 'middle', weight: 600 });
          const xa = f.sx(pa[0]), ya = f.sy(pa[1]), xb = f.sx(pb[0]), yb = f.sy(pb[1]);
          el('line', { x1: xa, y1: ya, x2: xb, y2: yb, stroke: C.accent, 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }, dyn);
          el('line', { x1: xa, y1: ya, x2: xb, y2: ya, stroke: C.hgt, 'stroke-width': 3.2 }, dyn);
          el('line', { x1: xb, y1: ya, x2: xb, y2: yb, stroke: C.wgt, 'stroke-width': 3.2 }, dyn);
          const dg = el('g', {}, dyn);
          drawPeople(dg, G, { pos: (i) => [f.sx(P.height[i]), f.sy(P.weight[i])], fill: (i) => (sel(i) ? C.accent : C.dot), pick: true,
            op: (i) => (sel(i) ? 1 : 0.55), tip: (i) => personTip(i, '<br>click to pick') });
          [[a, '1'], [b, '2']].forEach((p) => {
            const x = f.sx(P.height[p[0]]), y = f.sy(P.weight[p[0]]);
            ring(dg, x, y, G.dr, C.accent);
            const bx = x + G.dr + 11, by = y - G.dr - 9;
            el('circle', { cx: bx, cy: by, r: G.M ? 7 : 8.5, fill: '#fff', stroke: C.accent, 'stroke-width': 1.8 }, dg);
            T(dg, bx, by + G.fs * 0.36, p[1], G.fs, C.accent, { anchor: 'middle', weight: 800 });
          });
          /* right: how much each gap adds to the squared distance */
          T(dyn, (PRx[0] + PRx[1]) / 2, top - 8, M ? 'share of squared distance' : 'share of the squared distance', G.ft, C.ink, { anchor: 'middle', weight: 600 });
          const bb = bot - (M ? 40 : 44), bt = top + 14, bw = (PRx[1] - PRx[0]) * 0.28;
          const cx = [PRx[0] + (PRx[1] - PRx[0]) * 0.25, PRx[0] + (PRx[1] - PRx[0]) * 0.75];
          el('line', { x1: PRx[0], x2: PRx[1], y1: bb, y2: bb, stroke: C.axis }, dyn);
          const sh = [ds.shares[0] * 100, ds.shares[1] * 100], col = [C.hgt, C.wgt], gap = [dh.toFixed(2) + ' m', fmtInt(dw) + ' kg'], sqv = [dh * dh, dw * dw], nm = ['height', 'weight'];
          [0, 1].forEach((k) => {
            const h = Math.max(1.5, (bb - bt) * sh[k] / 100);
            el('rect', { x: cx[k] - bw / 2, y: bb - h, width: bw, height: h, fill: col[k], 'fill-opacity': 0.85 }, dyn);
            T(dyn, cx[k], bb - h - 5, shTxt(sh[k]), G.fs, C.ink, { anchor: 'middle', weight: 700 });
            T(dyn, cx[k], bb + G.fs + 4, nm[k], G.fs, col[k], { anchor: 'middle', weight: 700 });
            T(dyn, cx[k], bb + 2 * G.fs + 6, 'gap ' + gap[k], G.fs, C.muted, { anchor: 'middle' });
            T(dyn, cx[k], bb + 3 * G.fs + 8, 'squared ' + sqTxt(sqv[k]), G.fs, C.muted, { anchor: 'middle' });
          });
          T(dyn, (PRx[0] + PRx[1]) / 2, bot + G.fs + 8, (M ? '' : 'distance = ') + '√(' + sqTxt(sqv[0]) + ' + ' + sqTxt(sqv[1]) + ') = ' + ds.distance.toFixed(1), G.fs, C.ink, { anchor: 'middle', weight: 600 });
          C0.cap('People <b>1</b> and <b>2</b>: the height gap adds <b>' + shTxt(sh[0]) + '</b> of the squared distance, the weight gap <b>' + shTxt(sh[1]) + '</b>.');
        } else {
          /* the same people, drawn with equal scales: height collapses */
          const plotW = W - m.l - m.r, plotH = H - m.t - m.b;
          const t = ease(clamp(q / 0.7));
          const ppuY = plotH / (WY[1] - WY[0]), ppuHonest = plotW / (HX[1] - HX[0]);
          const ppuX = Math.exp(lerp(Math.log(ppuHonest), Math.log(ppuY), t));
          const cxd = 1.74, cxp = m.l + plotW / 2, sy = lin(WY[0], WY[1], H - m.b, m.t);
          const px = (h) => cxp + (h - cxd) * ppuX;
          el('rect', { x: m.l, y: m.t, width: plotW, height: plotH, fill: 'none', stroke: C.axis }, dyn);
          [40, 60, 80, 100].forEach((v) => {
            el('line', { x1: m.l, x2: m.l + plotW, y1: sy(v), y2: sy(v), stroke: C.grid }, dyn);
            el('line', { x1: m.l - 4, x2: m.l, y1: sy(v), y2: sy(v), stroke: C.axis }, dyn);
            T(dyn, m.l - 7, sy(v) + G.fs * 0.35, String(v), G.fs, C.muted, { anchor: 'end' });
          });
          T(dyn, M ? 11 : 16, (m.t + H - m.b) / 2, M ? 'weight (kg)' : 'body weight (kg)', G.ft, C.muted, { anchor: 'middle', rot: true });
          const ticks = [1.5, 1.6, 1.7, 1.8, 1.9], room = Math.abs(px(1.6) - px(1.5));
          if (room >= (M ? 26 : 30)) ticks.forEach((v) => {
            el('line', { x1: px(v), x2: px(v), y1: H - m.b, y2: H - m.b + 4, stroke: C.axis }, dyn);
            T(dyn, px(v), H - m.b + G.fs + 6, v.toFixed(1), G.fs, C.muted, { anchor: 'middle' });
          });
          else T(dyn, cxp, H - m.b + G.fs + 6, 'height: all of 1.57 to 1.90 m fits in this sliver', G.fs, C.ink, { anchor: 'middle', weight: 600 });
          T(dyn, m.l + plotW / 2, H - m.b + G.fs + G.ft + 10, t < 0.5 ? 'height (m), honest axes' : 'height (m), same scale as weight: 1 unit = 1 unit', G.ft, C.muted, { anchor: 'middle' });
          const xa = px(pa[0]), ya = sy(pa[1]), xb = px(pb[0]), yb = sy(pb[1]);
          el('line', { x1: xa, y1: ya, x2: xb, y2: yb, stroke: C.accent, 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }, dyn);
          const dg = el('g', {}, dyn);
          drawPeople(dg, G, { pos: (i) => [px(P.height[i]), sy(P.weight[i])], fill: (i) => (sel(i) ? C.accent : C.dot), op: (i) => (sel(i) ? 1 : 0.7) });
          [a, b].forEach((i) => ring(dg, px(P.height[i]), sy(P.weight[i]), G.dr, C.accent));
          C0.cap(t < 0.15 ? 'Honest axes: 1 m of height gets as much room as 68 kg of weight. Keep scrolling.'
            : t < 0.9 ? 'Squeezing the height axis to the same scale as the weight axis&hellip;'
            : 'Equal scales: <b>this is what k-means sees</b>, almost a single vertical line. Heights hardly matter.');
        }
      }
    };
  });

  /* ============================================================
     Chapter 3 - k-means on raw units
     ============================================================ */
  register('ch3', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m;
    const defs = el('defs', {}, svg);
    clipRect(defs, 'clip3', m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    const dyn = el('g', {}, svg);
    const run0 = RUNS.raw, PH = 2 * run0.iterations;
    /* integer phase p: 0 = start; odd 2k-1 = "assign" of round k; even 2k = "move" of round k */
    const at = (run, p) => {
      if (p <= 0) return { assign: null, centres: run.steps[0].centres };
      const k = Math.ceil(p / 2);
      return { assign: run.steps[k].assign, centres: p % 2 ? run.steps[k - 1].centres : run.steps[k].centres };
    };
    let lastPh = 0;
    $('kmNext').onclick = () => { S.km.manual = Math.min(PH, Math.round(S.km.manual === null ? lastPh : S.km.manual) + 1); S.rev++; C0.redraw(); };
    $('kmBack').onclick = () => { S.km.manual = Math.max(0, Math.round(S.km.manual === null ? lastPh : S.km.manual) - 1); S.rev++; C0.redraw(); };
    $('kmAuto').onclick = () => { S.km.manual = null; S.rev++; C0.redraw(); };
    Array.prototype.forEach.call($('grpUnit').querySelectorAll('button'), (b) => {
      b.onclick = () => { S.unit = b.getAttribute('data-unit'); S.rev++; C0.redraw(); };
    });

    function clusterView(g, run, unit, o) {
      const f = peopleFrame(G, unit);
      peopleAxes(g, G, f, unit);
      const cl = el('g', { 'clip-path': 'url(#clip3)' }, g);
      const xr = [f.sx.d0, f.sx.d1];
      if (o.bis) {
        const bl = bisector(o.centres[0], o.centres[1], xr[0], xr[1], WY[0], WY[1]);
        if (bl) el('line', { x1: f.sx(bl[0][0]), y1: f.sy(bl[0][1]), x2: f.sx(bl[1][0]), y2: f.sy(bl[1][1]), stroke: C.ink, 'stroke-width': 1.8, 'stroke-dasharray': '7 5', opacity: o.bis }, cl);
      }
      if (o.links) o.centres.forEach((c, k) => {
        for (let i = 0; i < N; i++) if (o.assign && o.assign[i] === k) el('line', { x1: f.sx(run.rawRows[i][0]), y1: f.sy(run.rawRows[i][1]), x2: f.sx(c[0]), y2: f.sy(c[1]), stroke: CL[k], 'stroke-width': 1, opacity: 0.28 }, cl);
      });
      const dg = el('g', {}, g);
      drawPeople(dg, G, { pos: (i) => [f.sx(run.rawRows[i][0]), f.sy(run.rawRows[i][1])], fill: o.fill, wrong: o.wrong,
        tip: (i) => personTip(i, o.assign ? '<br>k-means cluster: ' + (o.assign[i] === 0 ? 'blue' : 'orange') + (o.assign[i] === P.group[i] ? '' : ' (not its true group)') : '') });
      o.centres.forEach((c, k) => centreMark(g, f.sx(c[0]), f.sy(c[1]), CL[k], G.M ? 6 : 8, o.cop));
      return f;
    }

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlOn(C0.ctl);
        grpState($('grpKm'), stage < 2, stage === 0);
        grpState($('grpUnit'), stage === 2, true);
        Array.prototype.forEach.call($('grpUnit').querySelectorAll('button'), (b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-unit') === S.unit)));
        if (stage === 0) {
          const ph = S.km.manual !== null ? S.km.manual : clamp(q / 0.92) * PH;
          lastPh = ph;
          const p0 = Math.min(PH, Math.floor(ph + 1e-9)), p1 = Math.min(PH, p0 + 1), f = ph - p0;
          const A = at(run0, p0), B = at(run0, p1);
          const moving = p1 !== p0 && f > 1e-6, assignPhase = moving && p1 % 2 === 1, movePhase = moving && p1 % 2 === 0;
          const centres = movePhase ? A.centres.map((c, k) => [lerp(c[0], B.centres[k][0], ease(f)), lerp(c[1], B.centres[k][1], ease(f))]) : A.centres;
          const colAt = (as, i) => (as ? CL[as[i]] : C.dot);
          const shown = assignPhase ? B : A;
          clusterView(dyn, run0, 'm', {
            centres: centres, assign: shown.assign, bis: shown.assign ? 0.7 : 0,
            links: !!shown.assign && !movePhase && (p0 % 2 === 1 || (assignPhase && f > 0.5)),
            fill: (i) => (assignPhase ? mix(colAt(A.assign, i), colAt(B.assign, i), ease(f)) : colAt(A.assign, i)),
            wrong: null, cop: 1
          });
          const pr = Math.round(ph);
          const k = Math.ceil(pr / 2);
          C0.cap(pr === 0 ? 'Start: a centre (cross) on each of two people.'
            : pr >= PH ? 'Round ' + run0.iterations + ': nothing changes any more. k-means has converged.'
            : pr % 2 ? 'Round ' + k + ' &middot; assign: every person joins the nearest centre.' : 'Round ' + k + ' &middot; move: each centre goes to the average of its people.');
          const o = $('kmOut'); if (o) o.textContent = 'step ' + pr + ' of ' + PH;
          $('kmBack').disabled = pr <= 0; $('kmNext').disabled = pr >= PH; $('kmAuto').disabled = S.km.manual === null;
        } else {
          const unit = stage === 2 ? S.unit : 'm', run = unit === 'cm' ? RUNS.cm : RUNS.raw;
          clusterView(dyn, run, unit, { centres: run.centres, assign: run.assign, bis: 1, fill: (i) => CL[run.assign[i]], wrong: (i) => run.wrong.indexOf(i) >= 0, cop: 1 });
          const txt = (G.M ? 'matches true groups: ' : 'matches the true groups: ') + pc(run.agreement) + ' (' + run.hit + ' of ' + N + ')';
          const bx = el('rect', { x: m.l + 8, y: m.t + 6, width: G.M ? 236 : 276, height: G.M ? 22 : 26, rx: 6, fill: '#fff', 'fill-opacity': 0.92, stroke: run.agreement > 0.9 ? C.teal : C.red, 'stroke-width': 1.6 }, dyn);
          void bx;
          T(dyn, m.l + 16, m.t + (G.M ? 21 : 24), txt, G.fs + 0.5, run.agreement > 0.9 ? C.teal : C.red, { weight: 700 });
          if (stage === 1) C0.cap('<b class="legend-b">Blue</b> and <b class="legend-o">orange</b>: the two clusters. Circle or diamond: the true group. <span style="color:#b3261e">Red rings</span>: wrong. Dashed line: where k-means cuts.');
          else C0.cap(unit === 'cm' ? 'Height in <b>centimetres</b>: the height gap now counts, and the cut is vertical. Same 40 people, new answer.' : 'Height in <b>metres</b>: the cut is nearly flat, a split by weight. Press the other button.');
        }
      }
    };
  });

  /* ============================================================
     Chapter 4 - scaling fixes it
     ============================================================ */
  const mmS = RUNS.minmax.scaler, zS = RUNS.zscore.scaler;
  const VIEW = {
    raw: { run: RUNS.raw, off: [0, 0], scl: [1, 1], win: { cx: 1.74, cy: 74, span: 68 }, tk: { x: [1.6, 1.7, 1.8, 1.9], y: [50, 70, 90] }, xf: (v) => v.toFixed(1), yf: String, name: ['height (m)', 'weight (kg)'], short: 'raw units' },
    minmax: { run: RUNS.minmax, off: mmS.min, scl: [mmS.max[0] - mmS.min[0], mmS.max[1] - mmS.min[1]], win: { cx: 0.5, cy: 0.5, span: 1.4 }, tk: { x: [0, 0.5, 1], y: [0, 0.5, 1] }, xf: (v) => String(v), name: ['height, min–max', 'weight, min–max'], short: 'min–max' },
    zscore: { run: RUNS.zscore, off: zS.mean, scl: zS.std, win: { cx: 0, cy: 0, span: 6.2 }, tk: { x: [-2, 0, 2], y: [-2, 0, 2] }, xf: (v) => fmt(v, 0), name: ['height, z-score', 'weight, z-score'], short: 'z-score' }
  };
  const toSpace = (v, raw, k) => (raw - v.off[k]) / v.scl[k];
  const newRow = (name) => SG.assignNew(NEWP, VIEW[name].run);

  register('ch4', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m, M = G.M;
    const defs = el('defs', {}, svg);
    clipRect(defs, 'clip4', m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    const dyn = el('g', {}, svg);
    const plotW = W - m.l - m.r, plotH = H - m.t - m.b, pcx = m.l + plotW / 2, pcy = m.t + plotH / 2;
    let animPending = false;
    Array.prototype.forEach.call($('grpScale').querySelectorAll('button'), (b) => {
      b.onclick = () => {
        const to = b.getAttribute('data-sc');
        if (to === S.sc) return;
        S.scFrom = S.sc; S.sc = to; S.scT = reducedMotion ? -1e9 : performance.now(); S.rev++; C0.redraw();
      };
    });
    $('outBtn').onclick = () => {
      const cur = S.outlier === null ? $('outBtn').getAttribute('aria-pressed') === 'true' : S.outlier;
      S.outlier = !cur; S.rev++; C0.redraw();
    };

    /* the equal-scale view, from method A to method B (t in 0..1); o.rev = how far the cluster colours are revealed */
    function scatter(A, B, t, o) {
      const vA = VIEW[A], vB = VIEW[B];
      const cx = lerp(vA.win.cx, vB.win.cx, t), cy = lerp(vA.win.cy, vB.win.cy, t), span = Math.exp(lerp(Math.log(vA.win.span), Math.log(vB.win.span), t));
      const ppu = plotH / span;
      const pxX = (v) => pcx + (v - cx) * ppu, pyY = (v) => pcy - (v - cy) * ppu;
      const g = dyn;
      el('rect', { x: m.l, y: m.t, width: plotW, height: plotH, fill: 'none', stroke: C.axis }, g);
      /* tick families of both methods, cross-fading */
      [[A, vA, 1 - t], [B, vB, t]].forEach((fam, fi) => {
        if (A === B && fi === 0) return;
        const nm = fam[0], v = fam[1], w = 1;
        if (A !== B && (fi === 0) !== (t < 0.5)) return; /* the labels switch from the old numbers to the new ones half way, without overlapping */
        const pos = (raw, k) => lerp(toSpace(vA, raw, k), toSpace(vB, raw, k), t);
        const tx = v.tk.x.map((s) => pos(s * v.scl[0] + v.off[0], 0)), ty = v.tk.y.map((s) => pos(s * v.scl[1] + v.off[1], 1));
        const gy = el('g', { opacity: w }, g);
        ty.forEach((p, k) => {
          const y = pyY(p);
          if (y < m.t + 2 || y > m.t + plotH - 2) return;
          el('line', { x1: m.l - 4, x2: m.l, y1: y, y2: y, stroke: C.axis }, gy);
          T(gy, m.l - 7, y + G.fs * 0.35, (v.yf || v.xf)(v.tk.y[k]), G.fs, C.muted, { anchor: 'end' });
        });
        const room = tx.length > 1 ? Math.abs(pxX(tx[1]) - pxX(tx[0])) : 99;
        void nm;
        if (room >= (M ? 22 : 28)) tx.forEach((p, k) => {
          const x = pxX(p);
          if (x < m.l + 2 || x > m.l + plotW - 2) return;
          el('line', { x1: x, x2: x, y1: m.t + plotH, y2: m.t + plotH + 4, stroke: C.axis }, gy);
          T(gy, x, m.t + plotH + G.fs + 6, v.xf(v.tk.x[k]), G.fs, C.muted, { anchor: 'middle' });
        });
        else if (nm === 'raw') T(gy, pcx, m.t + plotH + G.fs + 6, 'all heights, 1.57 to 1.90 m, fit in this sliver', G.fs, C.ink, { anchor: 'middle', weight: 600 });
        T(gy, pcx, H - 5, v.name[0] + ' (equal scales)', G.ft, C.muted, { anchor: 'middle' });
        T(gy, M ? 11 : 16, pcy, v.name[1], G.ft, C.muted, { anchor: 'middle', rot: true });
      });
      const rowsA = vA.run.rows, rowsB = vB.run.rows;
      const pos = (i) => [pxX(lerp(rowsA[i][0], rowsB[i][0], t)), pyY(lerp(rowsA[i][1], rowsB[i][1], t))];
      const cl = el('g', { 'clip-path': 'url(#clip4)' }, g);
      if (o.bis && t >= 0.999) {
        const c = vB.run.centres, x0 = cx - plotW / 2 / ppu, x1 = cx + plotW / 2 / ppu, y0 = cy - span / 2, y1 = cy + span / 2;
        const bl = bisector(c[0], c[1], x0, x1, y0, y1);
        if (bl) el('line', { x1: pxX(bl[0][0]), y1: pyY(bl[0][1]), x2: pxX(bl[1][0]), y2: pyY(bl[1][1]), stroke: C.ink, 'stroke-width': 1.8, 'stroke-dasharray': '7 5', opacity: o.rev }, cl);
      }
      const dg = el('g', {}, g);
      const colOf = (i) => (o.always ? mix(CL[vA.run.assign[i]], CL[vB.run.assign[i]], t) : mix(C.dot, CL[vB.run.assign[i]], o.rev));
      drawPeople(dg, G, { pos: pos, fill: colOf, wrong: (i) => t > 0.999 && o.rev > 0.9 && vB.run.wrong.indexOf(i) >= 0,
        tip: (i) => personTip(i, '<br>scaled (' + vB.short + '): ' + fmt(rowsB[i][0], 2) + ', ' + fmt(rowsB[i][1], 2) + '<br>cluster: ' + (vB.run.assign[i] === 0 ? 'blue' : 'orange')) });
      const cOp = o.always ? 1 : o.rev;
      if (cOp > 0.02) vB.run.centres.forEach((c, k) => {
        const cA = vA.run.centres[k];
        centreMark(g, pxX(lerp(cA[0], c[0], t)), pyY(lerp(cA[1], c[1], t)), CL[k], M ? 6 : 8, cOp);
      });
      if (o.newp) {
        const a = newRow(A), b = newRow(B), xs = pxX(lerp(a.row[0], b.row[0], t)), ys = pyY(lerp(a.row[1], b.row[1], t));
        const inside = xs > m.l && xs < m.l + plotW && ys > m.t && ys < m.t + plotH;
        if (inside) {
          const s = star(g, xs, ys, M ? 10 : 12, CL[t < 0.5 ? a.cluster : b.cluster]);
          s.setAttribute('data-tip', '<b>A new person</b> (made up)<br>' + NEWP.height.toFixed(2) + ' m, ' + NEWP.weight + ' kg, truly group ' + GN[NEWP.group] +
            '<br>scaled with the training numbers<br>joins the ' + (b.cluster === 0 ? 'blue' : 'orange') + ' cluster' + (b.cluster === NEWP.group ? '' : ' (wrong)'));
          T(g, xs + (M ? 12 : 14), ys - (M ? 9 : 11), 'new', G.fs, C.accent, { weight: 800, halo: true });
        }
      }
    }

    /* stage 3: one extreme value and everybody else's weight, after scaling */
    function strips(oo) {
      const g = dyn, x0 = m.l + 8, x1 = W - m.r - 8, half = plotH / 2, amp = M ? 22 : 48;
      const kinds = ['minmax', 'zscore'], rg = [[-0.08, 1.08], [-2.7, 6.4]];
      const caps = [];
      kinds.forEach((kd, r) => {
        const sq = SQ[kd], sc = lin(rg[r][0], rg[r][1], x0, x1), y0 = m.t + r * half, yy = y0 + (M ? 18 : 24) + amp;
        const before = baseRows.map((row) => sq.scalerBase.apply(row)[1]), after = baseRows.map((row) => sq.scalerAll.apply(row)[1]);
        T(g, x0, y0 + (M ? 12 : 14), (kd === 'minmax' ? 'min–max' : 'z-score') + ': body weight after scaling', G.ft, C.ink, { weight: 700 });
        el('line', { x1: x0, x2: x1, y1: yy + amp + 6, y2: yy + amp + 6, stroke: C.axis }, g);
        (kd === 'minmax' ? [0, 0.5, 1] : [-2, 0, 2, 4]).forEach((tv) => {
          el('line', { x1: sc(tv), x2: sc(tv), y1: yy + amp + 6, y2: yy + amp + 10, stroke: C.axis }, g);
          T(g, sc(tv), yy + amp + 10 + G.fs + 2, fmt(tv, kd === 'minmax' ? 1 : 0), G.fs, C.muted, { anchor: 'middle' });
        });
        const sd = (arr) => SG.std(arr);
        const spread = lerp(sd(before), sd(after), oo);
        const mu = lerp(SG.mean(before), SG.mean(after), oo);
        for (let i = 0; i < N; i++) {
          const jit = (((i * 0.618) % 1) - 0.5) * 2 * amp * 0.9;
          personMark(g, i, sc(lerp(before[i], after[i], oo)), yy + jit, C.dot, G.dr * 0.8, personTip(i, '<br>scaled weight: ' + fmt(lerp(before[i], after[i], oo), 2)), 0.85);
        }
        if (oo > 0.02) {
          const ov = sq.outlierValue, sg = star(g, sc(ov), yy, M ? 9 : 11, C.accentSoft);
          sg.setAttribute('opacity', clamp(oo * 1.5)); sg.setAttribute('data-tip', '<b>One extreme person</b> (a typing slip)<br>' + SG.OUTLIER.weight + ' kg<br>scaled value ' + fmt(ov, 2));
          if (oo >= 0.95) T(g, sc(ov), yy - (M ? 9 : 11) - 9, SG.OUTLIER.weight + ' kg', G.fs, C.accent, { anchor: 'middle', weight: 800, halo: true });
        }
        /* the spread of everybody else: a bar from mean - std to mean + std */
        el('line', { x1: sc(mu - spread), x2: sc(mu + spread), y1: yy + amp + 20 + G.fs, y2: yy + amp + 20 + G.fs, stroke: C.teal, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
        T(g, Math.min(x1 - 4, Math.max(x0 + 4, sc(mu + spread) + 8)) , yy + amp + 24 + G.fs, 'spread ' + spread.toFixed(2), G.fs, C.teal, { weight: 700, anchor: sc(mu + spread) > x1 - 80 ? 'end' : 'start' });
        caps.push((kd === 'minmax' ? 'min–max' : 'z-score') + ' ' + pc(spread / sd(before)));
      });
      return caps;
    }

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlOn(C0.ctl);
        const showScale = stage < 3;
        let tween = 1;
        if (stage === 2) {
          tween = clamp((performance.now() - S.scT) / 700, 0, 1);
          if (tween < 1 && !animPending) { animPending = true; requestAnimationFrame(() => { animPending = false; C0.redraw(); }); }
        }
        grpState($('grpScale'), showScale, stage === 2);
        grpState($('grpOut'), stage === 3, true);
        Array.prototype.forEach.call($('grpScale').querySelectorAll('button'), (b) => {
          const cur = stage === 2 ? S.sc : (stage === 0 ? 'minmax' : 'zscore');
          b.setAttribute('aria-pressed', String(b.getAttribute('data-sc') === cur));
        });
        if (stage === 0 || stage === 1) {
          const B = stage === 0 ? 'minmax' : 'zscore', t = ease(clamp(q / 0.55)), rev = clamp((q - 0.62) / 0.3);
          scatter('raw', B, t, { rev: rev, bis: true });
          const run = VIEW[B].run;
          C0.cap(t < 0.05 ? 'Raw units on equal scales: the thin vertical line of chapter 2.'
            : t < 0.99 ? 'Every person slides to a new position: ' + (B === 'minmax' ? 'each feature stretched to run from 0 to 1.' : 'each feature re-centred on 0, measured in typical spreads.')
            : rev < 0.5 ? 'Both features now use the same room.'
            : 'k-means on the ' + VIEW[B].short + ' numbers: <b>' + pc(run.agreement) + '</b> match the true groups. The cut is nearly vertical: a split by height.');
        } else if (stage === 2) {
          const t = ease(tween), fromName = tween < 1 ? S.scFrom : S.sc;
          scatter(fromName, S.sc, tween < 1 ? t : 1, { rev: 1, bis: true, always: true, newp: true });
          const run = VIEW[S.sc].run, nw = newRow(S.sc);
          C0.cap('<b>' + VIEW[S.sc].short + '</b>: ' + pc(run.agreement) + ' match the true groups. The star (truly group ' + GN[NEWP.group] + ') joins the ' + (nw.cluster === 0 ? '<b class="legend-b">blue</b>' : '<b class="legend-o">orange</b>') +
            ' cluster' + (nw.cluster === NEWP.group ? ', correctly.' : ', wrongly: raw units judge it by weight.'));
        } else {
          const auto = S.outlier === null;
          const o = auto ? ease(clamp((q - 0.2) / 0.4)) : (S.outlier ? 1 : 0);
          $('outBtn').setAttribute('aria-pressed', String(o >= 0.5));
          const caps = strips(o);
          C0.cap(o < 0.05 ? 'Everybody’s weight on two scales. Add the extreme person with the button or by scrolling.'
            : 'Teal bar: how widely everybody else is spread. It keeps <b>' + caps[0] + '</b>; <b>' + caps[1] + '</b> of its old width.');
        }
      }
    };
  });

  /* ============================================================
     Chapters 5 to 7 - generalization, ridge, lasso
     ============================================================ */
  /* the essay plot: x = words per sentence, y = rating */
  const EX = [5, 28], EY = [-12, 112];
  const curveY = (model, x) => clamp(model.predict(x), -60, 170);
  function curvePts(model, sx, sy) {
    const pts = [];
    for (let x = 5.5; x <= 27.6; x += 0.25) pts.push([sx(x), sy(curveY(model, x))]);
    return pts;
  }
  function essayDots(g, sx, sy, G, o) {
    ES.train.x.forEach((x, i) => {
      const c = el('circle', { cx: sx(x), cy: sy(ES.train.y[i]), r: G.dr, fill: C.blue, stroke: '#fff', 'stroke-width': 1.2, 'data-tip': essayTip(ES.train, i, 'Training') }, g);
      void c;
    });
    if (o.test) ES.test.x.forEach((x, i) => {
      const d = G.dr * 1.15, cx = sx(x), cy = sy(ES.test.y[i]);
      el('polygon', { points: cx + ',' + (cy - d) + ' ' + (cx + d) + ',' + cy + ' ' + cx + ',' + (cy + d) + ' ' + (cx - d) + ',' + cy, fill: '#fff', stroke: C.orange, 'stroke-width': 2, 'data-tip': essayTip(ES.test, i, 'Fresh') }, g);
    });
  }
  const lamIdx = (v) => (v <= 0 ? 0 : Math.round(1 + (Math.log10(v) + 5) * 8));
  /* a log-scale line chart of train and test error: x by index, y = error (log10) */
  function errChart(g, G, fr, series, mark, best, o) {
    const { sx, sy } = fr, x0 = sx.r0, x1 = sx.r1;
    [1, 10, 100, 1000].forEach((v) => {
      el('line', { x1: x0, x2: x1, y1: sy(Math.log10(v)), y2: sy(Math.log10(v)), stroke: C.grid }, g);
      el('line', { x1: x0 - 4, x2: x0, y1: sy(Math.log10(v)), y2: sy(Math.log10(v)), stroke: C.axis }, g);
      T(g, x0 - 7, sy(Math.log10(v)) + G.fs * 0.35, fmtInt(v), G.fs, C.muted, { anchor: 'end' });
    });
    el('line', { x1: x0, x2: x1, y1: sy.r0, y2: sy.r0, stroke: C.axis }, g);
    el('line', { x1: x0, x2: x0, y1: sy.r0, y2: sy.r1, stroke: C.axis }, g);
    o.xticks.forEach((tk) => {
      el('line', { x1: sx(tk[0]), x2: sx(tk[0]), y1: sy.r0, y2: sy.r0 + 4, stroke: C.axis }, g);
      T(g, sx(tk[0]), sy.r0 + G.fs + 6, tk[1], G.fs, C.muted, { anchor: 'middle' });
    });
    T(g, (x0 + x1) / 2, sy.r0 + G.fs + G.ft + 10, o.xtitle, G.ft, C.muted, { anchor: 'middle' });
    T(g, G.M ? 11 : 16, (sy.r0 + sy.r1) / 2, G.M ? 'error (log scale)' : 'average squared miss (log scale)', G.ft, C.muted, { anchor: 'middle', rot: true });
    series.forEach((s) => {
      el('path', { d: pathD(s.vals.map((v, k) => [sx(k), sy(Math.log10(clamp(v, 0.1, 5000)))])), fill: 'none', stroke: s.color, 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, g);
      s.vals.forEach((v, k) => {
        if (!o.dots && k !== mark) return;
        const x = sx(k), y = sy(Math.log10(clamp(v, 0.1, 5000))), r = k === mark ? G.dr * 1.15 : G.dr * 0.8;
        const tp = '<b>' + s.name + '</b><br>' + o.tipLabel(k) + '<br>average squared miss ' + fe(v);
        if (s.shape === 'dia') el('polygon', { points: x + ',' + (y - r * 1.3) + ' ' + (x + r * 1.3) + ',' + y + ' ' + x + ',' + (y + r * 1.3) + ' ' + (x - r * 1.3) + ',' + y, fill: '#fff', stroke: s.color, 'stroke-width': 2, 'data-tip': tp }, g);
        else el('circle', { cx: x, cy: y, r: r, fill: s.color, stroke: '#fff', 'stroke-width': 1.2, 'data-tip': tp }, g);
      });
    });
    el('line', { x1: sx(mark), x2: sx(mark), y1: sy.r1, y2: sy.r0, stroke: C.accent, 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }, g);
    if (best !== null && best !== undefined) {
      const sb = series[1].vals[best], bx = sx(best), by = sy(Math.log10(clamp(sb, 0.1, 5000)));
      el('circle', { cx: bx, cy: by, r: G.dr * 1.9, fill: 'none', stroke: C.teal, 'stroke-width': 2.4 }, g);
      T(g, bx, by + G.dr * 1.9 + G.fs + 3, 'best on new data', G.fs, C.teal, { anchor: 'middle', weight: 700, halo: true });
    }
  }

  /* slider helpers: the slider follows the page until the user touches it */
  function sliderSync(inp, out, value, text) {
    if (document.activeElement !== inp) inp.value = String(value);
    inp.setAttribute('aria-valuetext', text);
    if (out) out.textContent = text;
  }

  /* ---------------- chapter 5 */
  register('ch5', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m, M = G.M;
    const defs = el('defs', {}, svg);
    clipRect(defs, 'clip5', m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    const dyn = el('g', {}, svg);
    const sx = lin(EX[0], EX[1], m.l, W - m.r), sy = lin(EY[0], EY[1], H - m.b, m.t);
    const deg = $('deg'), degOut = $('degOut'), auto = $('degAuto');
    deg.oninput = () => { S.deg = +deg.value; S.rev++; C0.redraw(); };
    auto.onclick = () => { S.deg = null; S.rev++; C0.redraw(); };
    const fr = { sx: lin(0, 11, m.l + 10, W - m.r - 8), sy: lin(Math.log10(0.1), Math.log10(5000), H - m.b, m.t) };
    return {
      render: function (stage, q) {
        clear(dyn);
        ctlOn(C0.ctl);
        const d = S.deg !== null ? S.deg : (stage === 1 ? 12 : 1 + Math.round(11 * ease(clamp(q / 0.9))));
        const row = DEG[d - 1], model = row.model;
        grpState(C0.ctl, true, true);
        auto.disabled = S.deg === null;
        sliderSync(deg, degOut, d, 'degree ' + d);
        if (stage < 2) {
          axes(dyn, G, sx, sy, { xt: [8, 12, 16, 20, 24, 28], yt: [0, 25, 50, 75, 100], xtitle: 'average sentence length (words)', ytitle: M ? 'rating (0–100)' : 'teacher’s readability rating (0–100)' });
          const cl = el('g', { 'clip-path': 'url(#clip5)' }, dyn);
          essayDots(cl, sx, sy, G, { test: stage === 1 });
          el('path', { d: pathD(curvePts(model, sx, sy)), fill: 'none', stroke: C.model, 'stroke-width': 3.2, 'stroke-linejoin': 'round' }, cl);
          const ty = m.t + G.fs + 4, tx = m.l + (W - m.l - m.r) * (M ? 0.3 : 0.36);
          T(dyn, tx, ty, 'degree ' + d, G.ft, C.ink, { weight: 700, halo: true });
          T(dyn, tx, ty + G.fs + 4, 'training error ' + fe(row.train), G.fs, C.blue, { weight: 700, halo: true });
          if (stage === 1) T(dyn, tx, ty + 2 * (G.fs + 4), 'test error ' + fe(row.test), G.fs, C.orange, { weight: 700, halo: true });
          C0.cap(stage === 0 ? 'Degree <b>' + d + '</b>: the curve ' + (d < 3 ? 'is too stiff to follow the dots.' : d < 9 ? 'follows the dots.' : 'hugs every dot, even the odd ones.')
            : 'Degree <b>' + d + '</b>. <b class="legend-b">Blue</b>: the training essays. <b class="legend-o">Orange diamonds</b>: fresh essays. Test error ' + fe(row.test) + ' against training error ' + fe(row.train) + '.');
        } else {
          errChart(dyn, G, fr, [
            { name: 'training error', vals: DEG.map((r) => r.train), color: C.blue, shape: 'dot' },
            { name: 'test error', vals: DEG.map((r) => r.test), color: C.orange, shape: 'dia' }
          ], d - 1, BD, { dots: true, xticks: [[0, '1'], [2, '3'], [5, '6'], [8, '9'], [11, '12']], xtitle: 'degree: how bendy the curve may be', tipLabel: (k) => 'degree ' + (k + 1) });
          T(dyn, fr.sx(0) + 6, m.t + G.fs + 2, 'too simple: underfits', G.fs, C.muted, { weight: 600 });
          T(dyn, fr.sx(11) - 8, fr.sy(Math.log10(14)), 'too bendy: overfits', G.fs, C.muted, { weight: 600, anchor: 'end' });
          T(dyn, fr.sx(4.4), fr.sy(Math.log10(DEG[4].train)) + G.fs + 12, 'training error', G.fs, C.blue, { weight: 700 });
          T(dyn, fr.sx(11) - 12, fr.sy(Math.log10(DEG[11].test)) + 4, 'test error', G.fs, C.orange, { weight: 700, anchor: 'end', halo: true });
          C0.cap('Degree <b>' + d + '</b>: training error ' + fe(row.train) + ', test error ' + fe(row.test) + '. Lower is better; the log scale shows both the tiny and the huge.');
        }
      }
    };
  });

  /* ---------------- chapters 6 and 7: the fit with a penalty, and its coefficients */
  function penaltyPanels(C0, tag) {
    const G = geo(C0), W = G.W, H = G.H, m = G.m, M = G.M;
    const top = m.t + (M ? 22 : 26), bot = H - m.b;
    const PL = M ? [40, 200] : [66, 336], PR = M ? [236, 368] : [392, 616];
    const defs = el('defs', {}, C0.svg);
    clipRect(defs, tag + 'L', PL[0], top, PL[1] - PL[0], bot - top);
    clipRect(defs, tag + 'R', PR[0], top, PR[1] - PR[0], bot - top);
    return { G: G, W: W, H: H, m: m, M: M, top: top, bot: bot, PL: PL, PR: PR, tag: tag,
      fx: { sx: lin(EX[0], EX[1], PL[0], PL[1]), sy: lin(EY[0], EY[1], bot, top) } };
  }
  const BAR = 30;
  function drawFit(g, pn, row) {
    const { G, M, top, bot, PL, fx } = pn;
    axes(g, G, fx.sx, fx.sy, { xt: [10, 20], yt: [0, 50, 100], xtitle: M ? 'sentence length' : 'sentence length (words)', ytitle: 'rating', ytx: M ? 11 : 17 });
    T(g, (PL[0] + PL[1]) / 2, top - 8, 'the curve', G.ft, C.ink, { anchor: 'middle', weight: 600 });
    const cl = el('g', { 'clip-path': 'url(#' + pn.tag + 'L)' }, g);
    essayDots(cl, fx.sx, fx.sy, G, { test: true });
    el('path', { d: pathD(curvePts(row.model, fx.sx, fx.sy)), fill: 'none', stroke: C.model, 'stroke-width': 3, 'stroke-linejoin': 'round' }, cl);
  }
  function drawBars(g, pn, row, title) {
    const { G, M, top, bot, PR } = pn;
    const bx = lin(0.5, 12.5, PR[0], PR[1]), by = lin(-BAR, BAR, bot, top), bw = (PR[1] - PR[0]) / 12 * (M ? 0.66 : 0.62);
    T(g, (PR[0] + PR[1]) / 2, top - 8, title, G.ft, C.ink, { anchor: 'middle', weight: 600 });
    [-20, 0, 20].forEach((v) => {
      el('line', { x1: PR[0], x2: PR[1], y1: by(v), y2: by(v), stroke: v === 0 ? C.axis : C.grid }, g);
      T(g, PR[0] - 5, by(v) + G.fs * 0.35, fmt(v, 0), G.fs, C.muted, { anchor: 'end' });
    });
    el('line', { x1: PR[0], x2: PR[0], y1: bot, y2: top, stroke: C.axis }, g);
    const cl = el('g', { 'clip-path': 'url(#' + pn.tag + 'R)' }, g);
    row.w.forEach((v, k) => {
      const x = bx(k + 1), tp = '<b>term ' + (k + 1) + '</b> (the ' + (k + 1 === 1 ? 'sentence length itself' : 'sentence length to the power ' + (k + 1)) + ')<br>coefficient ' + (v === 0 ? '<b>exactly 0</b>' : fmt(v, 2));
      if (v === 0) {
        el('line', { x1: x - bw / 2, x2: x + bw / 2, y1: by(0), y2: by(0), stroke: C.red, 'stroke-width': 3 }, cl);
        el('rect', { x: x - bw / 2 - 1, y: by(0) - 12, width: bw + 2, height: 24, fill: 'transparent', 'data-tip': tp }, cl);
        T(g, x, by(0) - 7, '0', G.fs, C.red, { anchor: 'middle', weight: 800 });
      } else {
        const vv = clamp(v, -BAR, BAR), y1 = by(vv), y0 = by(0);
        el('rect', { x: x - bw / 2, y: Math.min(y0, y1), width: bw, height: Math.max(1.2, Math.abs(y1 - y0)), fill: C.accent, 'data-tip': tp }, cl);
        if (Math.abs(v) > BAR && !M) {
          const lab = Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'k' : String(Math.round(Math.abs(v)));
          if (v > 0) T(g, x + 4, top + 3, lab, G.fs - 1, '#fff', { anchor: 'end', rot: true, weight: 700 });
          else T(g, x + 4, bot - 3, lab, G.fs - 1, '#fff', { rot: true, weight: 700 });
        }
      }
    });
    [1, 4, 8, 12].forEach((k) => T(g, bx(k), bot + G.fs + 6, String(k), G.fs, C.muted, { anchor: 'middle' }));
    T(g, (PR[0] + PR[1]) / 2, bot + G.fs + G.ft + 10, M ? 'term (power of x)' : 'term: x, x², … x¹²', G.ft, C.muted, { anchor: 'middle' });
  }
  const bigW = (row) => Math.max.apply(null, row.w.map(Math.abs));
  const lamText = (i) => (i === 0 ? 'λ = 0 (no penalty)' : 'λ = ' + fLam(SG.LAMBDAS[i]));

  register('ch6', function (C0) {
    const pn = penaltyPanels(C0, 'c6'), G = pn.G, W = pn.W, H = pn.H, m = pn.m, M = pn.M;
    const dyn = el('g', {}, C0.svg);
    const inp = $('lam2'), out = $('lam2Out'), auto = $('lam2Auto');
    inp.oninput = () => { S.l2 = +inp.value; S.rev++; C0.redraw(); };
    auto.onclick = () => { S.l2 = null; S.rev++; C0.redraw(); };
    const fr = { sx: lin(0, NL - 1, m.l + 10, W - m.r - 8), sy: lin(Math.log10(0.1), Math.log10(5000), H - m.b, m.t) };
    return {
      render: function (stage, q) {
        clear(dyn);
        ctlOn(C0.ctl); grpState(C0.ctl, true, true);
        const idx = S.l2 !== null ? S.l2 : (stage === 0 ? Math.round(BR * ease(clamp(q / 0.85))) : Math.round((NL - 1) * ease(clamp(q / 0.9))));
        const row = RS[idx];
        auto.disabled = S.l2 === null;
        sliderSync(inp, out, idx, lamText(idx));
        if (stage === 0) {
          drawFit(dyn, pn, row); drawBars(dyn, pn, row, M ? 'coefficients' : 'the 12 coefficients');
          C0.cap('L2 penalty, ' + lamText(idx) + ': training error ' + fe(row.train) + ', test error ' + fe(row.test) + '. Largest coefficient ' + fmtInt(bigW(row)) + (bigW(row) > BAR ? ' (bars are cut at ±30)' : '') + '. None is exactly 0.');
        } else {
          errChart(dyn, G, fr, [
            { name: 'training error', vals: RS.map((r) => r.train), color: C.blue, shape: 'dot' },
            { name: 'test error', vals: RS.map((r) => r.test), color: C.orange, shape: 'dia' }
          ], idx, BR, { dots: false, xticks: [[0, '0'], [9, '0.0001'], [25, '0.01'], [41, '1'], [57, '100']], xtitle: 'penalty λ (log scale)', tipLabel: (k) => lamText(k) });
          T(dyn, fr.sx(0) + 8, m.t + G.fs + 2, 'memorising', G.fs, C.muted, { weight: 600 });
          T(dyn, fr.sx(NL - 1) - 6, m.t + G.fs + 2, 'too much penalty: underfits', G.fs, C.muted, { weight: 600, anchor: 'end' });
          T(dyn, fr.sx(NL - 1) - 14, fr.sy(Math.log10(RS[NL - 1].train)) + G.fs + 6, 'training', G.fs, C.blue, { weight: 700, anchor: 'end', halo: true });
          T(dyn, fr.sx(NL - 1) - 14, fr.sy(Math.log10(RS[NL - 1].test)) - 8, 'test', G.fs, C.orange, { weight: 700, anchor: 'end', halo: true });
          C0.cap(lamText(idx) + ': training error ' + fe(row.train) + ', test error ' + fe(row.test) + '. Best test error ' + fe(RS[BR].test) + ' at λ = ' + fLam(SG.LAMBDAS[BR]) + '.');
        }
      }
    };
  });

  /* coefficient paths against lambda: one line per term */
  function pathPanel(g, pn, sweep, which, idx, title) {
    const { G, M, top, bot } = pn, P0 = which ? pn.PR : pn.PL;
    const PI0 = 25, sx = lin(PI0, NL - 1, P0[0], P0[1]), sy = lin(-BAR, BAR, bot, top);
    T(g, (P0[0] + P0[1]) / 2, top - 8, title, G.ft, C.ink, { anchor: 'middle', weight: 600 });
    [-20, 0, 20].forEach((v) => {
      el('line', { x1: P0[0], x2: P0[1], y1: sy(v), y2: sy(v), stroke: v === 0 ? C.axis : C.grid }, g);
      if (!which || true) T(g, P0[0] - 5, sy(v) + G.fs * 0.35, fmt(v, 0), G.fs, C.muted, { anchor: 'end' });
    });
    el('line', { x1: P0[0], x2: P0[0], y1: bot, y2: top, stroke: C.axis }, g);
    [[25, '0.01'], [41, '1'], [57, '100']].forEach((tk) => {
      el('line', { x1: sx(tk[0]), x2: sx(tk[0]), y1: bot, y2: bot + 4, stroke: C.axis }, g);
      T(g, sx(tk[0]), bot + G.fs + 6, tk[1], G.fs, C.muted, { anchor: tk[0] === 25 ? 'start' : tk[0] === 57 ? 'end' : 'middle' });
    });
    T(g, (P0[0] + P0[1]) / 2, bot + G.fs + G.ft + 10, M ? 'penalty λ' : 'penalty λ (log scale)', G.ft, C.muted, { anchor: 'middle' });
    const clipId = pn.tag + (which ? 'R' : 'L');
    const cl = el('g', { 'clip-path': 'url(#' + clipId + ')' }, g);
    for (let j = 0; j < 12; j++) {
      const d = pathD(sweep.slice(PI0).map((r, k) => [sx(k + PI0), sy(clamp(r.w[j], -BAR, BAR))]));
      el('path', { d: d, fill: 'none', stroke: C.accent, 'stroke-width': 1.8, opacity: 0.7, 'stroke-linejoin': 'round' }, cl);
      el('path', { d: d, fill: 'none', stroke: 'transparent', 'stroke-width': 9, 'data-tip': '<b>term ' + (j + 1) + '</b><br>' + (which ? 'L1' : 'L2') + ' path' }, cl);
    }
    el('line', { x1: sx(Math.max(idx, PI0)), x2: sx(Math.max(idx, PI0)), y1: top, y2: bot, stroke: C.ink, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
    const z = sweep[idx].zeros;
    T(g, P0[0] + 6, top + G.fs + 3, 'exact zeros here: ' + z + ' of 12', G.fs, z ? C.red : C.muted, { weight: 700, halo: true });
  }

  /* the two-coefficient picture */
  const TOYR = [-0.6, 3.2];
  function toyPanel(g, pn, kind, idx) {
    const { G, M, top, bot, W, m } = pn;
    const side = Math.min((W - m.l - m.r - (M ? 18 : 40)) / 2, bot - top - 6), px0 = kind === 'l1' ? m.l + (M ? 2 : 0) : W - m.r - side, py1 = (top + bot) / 2 + side / 2 + (M ? 6 : 10);
    const x0 = px0, x1 = px0 + side;
    const sx = lin(TOYR[0], TOYR[1], px0, px0 + side), sy = lin(TOYR[0] - 0.6, TOYR[1] - 0.6, py1, py1 - side);
    const lam = SG.TOY_LAMBDAS[idx], w = SG.toySolve(kind, lam), ws = SG.TOY.star;
    const id = pn.tag + kind;
    clipRect(el('defs', {}, g), id, px0, py1 - side, side, side);
    el('rect', { x: px0, y: py1 - side, width: side, height: side, fill: '#fff', stroke: C.axis }, g);
    el('line', { x1: px0, x2: px0 + side, y1: sy(0), y2: sy(0), stroke: C.axis }, g);
    el('line', { x1: sx(0), x2: sx(0), y1: py1, y2: py1 - side, stroke: C.axis }, g);
    T(g, (x0 + x1) / 2, py1 - side - 7, kind === 'l1' ? 'L1: a diamond' : 'L2: a circle', G.ft, C.ink, { anchor: 'middle', weight: 700 });
    T(g, px0 + side - 3, sy(0) - 4, 'w₁', G.fs, C.muted, { anchor: 'end' });
    T(g, sx(0) + 4, py1 - side + G.fs + 1, 'w₂', G.fs, C.muted);
    const cl = el('g', { 'clip-path': 'url(#' + id + ')' }, g);
    /* the allowed region */
    if (lam > 0) {
      if (kind === 'l1') {
        const t = Math.abs(w[0]) + Math.abs(w[1]);
        el('polygon', { points: [[t, 0], [0, t], [-t, 0], [0, -t]].map((p) => sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1)).join(' '), fill: C.accentSoft, stroke: C.accent, 'stroke-width': 2.2 }, cl);
      } else {
        const r = Math.hypot(w[0], w[1]);
        el('ellipse', { cx: sx(0), cy: sy(0), rx: r * (sx(1) - sx(0)), ry: r * (sy(0) - sy(1)), fill: C.accentSoft, stroke: C.accent, 'stroke-width': 2.2 }, cl);
      }
    }
    /* loss rings around the unpenalized best answer: A = L L', ring = { ws + L^-T sqrt(level) (cos, sin) } */
    const A = SG.TOY.A, l11 = Math.sqrt(A[0][0]), l21 = A[1][0] / l11, l22 = Math.sqrt(A[1][1] - l21 * l21);
    const ringPts = (level) => Array.from({ length: 61 }, (_, k) => {
      const a = (k / 60) * 2 * Math.PI, c = Math.cos(a) * Math.sqrt(level), s = Math.sin(a) * Math.sqrt(level);
      /* solve L' d = (c, s): L' = [[l11, l21], [0, l22]] */
      const d2 = s / l22, d1 = (c - l21 * d2) / l11;
      return [sx(ws[0] + d1), sy(ws[1] + d2)];
    });
    const lw = SG.toyLoss(w);
    [0.5, 1.6, 3.2].forEach((lv) => { if (Math.abs(lv - lw) > 0.25) el('path', { d: pathD(ringPts(lv)) + 'Z', fill: 'none', stroke: C.grey, 'stroke-width': 1.2, opacity: 0.8 }, cl); });
    if (lw > 1e-6) el('path', { d: pathD(ringPts(lw)) + 'Z', fill: 'none', stroke: C.orange, 'stroke-width': 2.2 }, cl);
    /* unpenalized best, and the answer under the penalty */
    const dot = el('circle', { cx: sx(w[0]), cy: sy(w[1]), r: G.dr, fill: C.ink, stroke: '#fff', 'stroke-width': 1.6 }, g);
    const cx0 = 'translate(' + sx(ws[0]) + ',' + sy(ws[1]) + ')';
    el('path', { d: 'M-7,-7L7,7M-7,7L7,-7', transform: cx0, stroke: '#fff', 'stroke-width': 5, fill: 'none' }, g);
    el('path', { d: 'M-7,-7L7,7M-7,7L7,-7', transform: cx0, stroke: C.teal, 'stroke-width': 2.6, fill: 'none' }, g);
    dot.setAttribute('data-tip', '<b>' + (kind === 'l1' ? 'L1' : 'L2') + ' answer</b><br>w₁ = ' + fmt(w[0], 2) + '<br>w₂ = ' + (w[1] === 0 ? '<b>exactly 0</b>' : fmt(w[1], 2)));
    if (w[1] === 0 && lam > 0) T(g, sx(w[0]) + 3, sy(0) + G.fs + 6, 'w₂ = 0', G.fs, C.red, { weight: 800, halo: true, anchor: w[0] > (TOYR[0] + TOYR[1]) / 2 + 0.6 ? 'middle' : 'start' });
    return w;
  }

  register('ch7', function (C0) {
    const pn = penaltyPanels(C0, 'c7'), G = pn.G, m = pn.m, M = pn.M;
    const dyn = el('g', {}, C0.svg);
    const inp = $('lam1'), out = $('lam1Out'), auto = $('lam1Auto'), toy = $('toyLam'), toyOut = $('toyOut');
    inp.oninput = () => { S.l1 = +inp.value; S.rev++; C0.redraw(); };
    auto.onclick = () => { S.l1 = null; S.rev++; C0.redraw(); };
    toy.oninput = () => { S.toy = +toy.value; S.rev++; C0.redraw(); };
    return {
      render: function (stage, q) {
        clear(dyn);
        ctlOn(C0.ctl);
        grpState($('grpLam1'), stage < 2, true);
        grpState($('grpToy'), stage === 2, true);
        const idx = S.l1 !== null ? S.l1 : (stage === 0 ? Math.round(BL * ease(clamp(q / 0.85))) : stage === 1 ? Math.round(BL * ease(clamp(q / 0.85))) : BL);
        auto.disabled = S.l1 === null;
        sliderSync(inp, out, idx, lamText(idx));
        if (stage === 0) {
          const row = LS[idx];
          drawFit(dyn, pn, row); drawBars(dyn, pn, row, M ? 'coefficients' : 'the 12 coefficients');
          C0.cap('L1 penalty, ' + lamText(idx) + ': <b>' + row.zeros + '</b> of 12 coefficients are exactly 0 (red). Training error ' + fe(row.train) + ', test error ' + fe(row.test) + '.');
        } else if (stage === 1) {
          pathPanel(dyn, pn, RS, 0, idx, 'L2 (ridge) paths');
          pathPanel(dyn, pn, LS, 1, idx, 'L1 (lasso) paths');
          C0.cap('One line per coefficient, ' + lamText(idx) + ' (dashed). L2: ' + RS[idx].zeros + ' exact zeros. L1: <b>' + LS[idx].zeros + '</b> exact zeros, and more as λ grows.');
        } else {
          const ti = S.toy;
          const w1 = toyPanel(dyn, pn, 'l1', ti);
          const w2 = toyPanel(dyn, pn, 'l2', ti);
          sliderSync(toy, toyOut, ti, 'penalty ' + (ti === 0 ? 'off' : (SG.TOY_LAMBDAS[ti]).toFixed(1)));
          C0.cap((ti === 0 ? 'No penalty: both answers sit on the best fit (teal cross).' : 'Rings: equal loss. The answer is where the first ring touches the purple region.') +
            ' L1: w₂ = ' + (w1[1] === 0 ? '<b>0 exactly</b>' : fmt(w1[1], 2)) + '. L2: w₂ = ' + fmt(w2[1], 2) + '.');
        }
        void m; void G;
      }
    };
  });

  /* ============================================================
     Chapter 8 - why scaling matters for penalties too
     ============================================================ */
  register('ch8', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, m = G.m, M = G.M;
    const dyn = el('g', {}, svg);
    const inp = $('lam8'), out = $('lam8Out');
    inp.oninput = () => { S.u = +inp.value; S.rev++; C0.redraw(); };
    const groups = [
      { title: ['rare words as', 'a fraction (0–0.3)'], f: 1, std: false },
      { title: ['rare words as', 'a percent (0–30)'], f: 100, std: false },
      { title: ['both features', 'standardized'], f: 1, std: true }
    ];
    const names = ['length', 'rare'];
    return {
      render: function (stage, q) {
        clear(dyn);
        ctlOn(C0.ctl); grpState(C0.ctl, true, true);
        const lam = UL[S.u];
        sliderSync(inp, out, S.u, 'λ = ' + fLam(lam));
        const top = m.t + (M ? 34 : 46), bot = H - m.b - (M ? 22 : 34), left = m.l - (M ? 4 : 0), right = W - m.r;
        const sy = lin(0, 100, bot, top);
        [0, 25, 50, 75, 100].forEach((v) => {
          el('line', { x1: left, x2: right, y1: sy(v), y2: sy(v), stroke: v === 0 ? C.axis : C.grid }, dyn);
          T(dyn, left - 6, sy(v) + G.fs * 0.35, v + '%', G.fs, C.muted, { anchor: 'end' });
        });
        T(dyn, M ? 11 : 16, (top + bot) / 2, M ? 'coefficient kept' : 'share of the coefficient that survives', G.ft, C.muted, { anchor: 'middle', rot: true });
        T(dyn, (left + right) / 2, m.t + 12, 'ridge penalty ' + fLam(lam) + ': how much of each coefficient is left?', G.ft, C.ink, { anchor: 'middle', weight: 600 });
        const gw = (right - left) / 3, cols = [C.dot, C.accent];
        groups.forEach((gr, gi) => {
          const op = stage === 0 && gi === 2 ? 0.18 : 1;
          const res = SG.unitsRidge(lam, gr.f, gr.std), gx = left + gi * gw, bw = gw * 0.24;
          const gg = el('g', { opacity: op }, dyn);
          [0, 1].forEach((k) => {
            const cx = gx + gw * (k ? 0.68 : 0.32), kept = clamp(res.kept[k] * 100, 0, 100);
            const tp = '<b>' + (k ? 'rare-word share' : 'sentence length') + '</b><br>' + gr.title.join(' ') + '<br>unpenalized coefficient ' + (Math.abs(res.w0[k]) < 1 ? res.w0[k].toPrecision(3) : fmt(res.w0[k], 1)) + '<br>with the penalty ' + (Math.abs(res.w[k]) < 1 ? res.w[k].toPrecision(3) : fmt(res.w[k], 1));
            el('rect', { x: cx - bw / 2, y: sy(kept), width: bw, height: Math.max(1.5, bot - sy(kept)), fill: cols[k], 'data-tip': tp }, gg);
            T(gg, cx, sy(kept) - 5, kept < 10 ? kept.toFixed(1) + '%' : Math.round(kept) + '%', G.fs, C.ink, { anchor: 'middle', weight: 700 });
            T(gg, cx, bot + G.fs + 4, names[k], G.fs, k ? C.accent : C.ink, { anchor: 'middle', weight: 700 });
          });
          gr.title.forEach((ln, li) => T(gg, gx + gw / 2, bot + 2 * G.fs + 8 + li * (G.fs + 2), ln, G.fs, C.muted, { anchor: 'middle' }));
          if (gi > 0) el('line', { x1: gx, x2: gx, y1: top, y2: H - m.b + 6, stroke: C.line }, dyn);
        });
        const kp = groups.map((gr) => SG.unitsRidge(lam, gr.f, gr.std).kept[1]);
        C0.cap(stage === 0 ? '<b>Same facts, different units, different punishment.</b> At λ = ' + fLam(lam) + ': as a fraction the rare-word coefficient keeps ' + pc(kp[0]) + ', as a percent ' + pc(kp[1]) + '.'
          : 'At λ = ' + fLam(lam) + ': fraction ' + pc(kp[0]) + ', percent ' + pc(kp[1]) + ', standardized ' + pc(kp[2]) + ' for both features. Standardizing makes the penalty fair.');
      }
    };
  });

  /* ============================================================
     Chapter 9 - recap
     ============================================================ */
  register('ch9', function (C0) {
    /* the text lives in ordinary HTML cards (normal flow, so it can never overlap); the svg above carries a small route diagram */
    const svg = C0.svg, W = C0.W, M = C0.M;
    const H9 = M ? 62 : 150;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H9);
    const items = [['scale', 'features'], ['fit', 'a model'], ['test', 'on new data'], ['penalize', 'if it memorises']];
    const cy = M ? 22 : 56, r = M ? 15 : 28, x0 = W * 0.13, dx = W * 0.245;
    items.forEach((it, i) => {
      const x = x0 + i * dx;
      if (i < 3) {
        el('line', { x1: x + r + 4, y1: cy, x2: x + dx - r - 12, y2: cy, stroke: C.grey, 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
        el('path', { d: 'M ' + (x + dx - r - 3) + ' ' + cy + ' l -9 -6 l 0 12 z', fill: C.grey }, svg);
      }
      el('circle', { cx: x, cy: cy, r: r, fill: i === 2 ? C.accent : '#fff', stroke: C.accent, 'stroke-width': 3 }, svg);
      T(svg, x, cy + (M ? 5 : 9), String(i + 1), M ? 15 : 26, i === 2 ? '#fff' : C.accent, { anchor: 'middle', weight: 800 });
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
    g0.appendChild(card('', 'S', 'Feature scaling', null, 'the umbrella: put features on comparable ranges, so no unit decides by accident'));
    g0.appendChild(card('good', 'N', 'Normalization (min–max)', 'x\'=\\dfrac{x-\\min}{\\max-\\min}', 'squeezes into 0 to 1; one extreme value squeezes everyone else'));
    g0.appendChild(card('good', 'Z', 'Standardization (z-score)', 'z=\\dfrac{x-\\text{mean}}{\\text{std}}', 'average 0, spread 1; outliers hurt less. Numbers from training data only'));
    g1.appendChild(card('good', 'G', 'Generalization: the goal', null, 'doing well on new data. Failing it: underfitting (too simple) or overfitting (memorising)'));
    g1.appendChild(card('', 'R', 'Regularization: one tool', '\\text{loss}=\\text{error}+\\lambda\\times\\text{penalty}', 'make complexity cost something'));
    g1.appendChild(card('', '2', 'L2 (ridge): sum of squares', null, 'shrinks every coefficient smoothly, none exactly 0'));
    g1.appendChild(card('warn', '1', 'L1 (lasso): sum of absolute values', null, 'switches some coefficients to exactly 0: feature selection'));
    g2.appendChild(card('', 'V', 'Document vectors', null, 'TF-IDF vectors are often scaled to length 1, so cosine similarity compares direction, not text length'));
    g2.appendChild(card('good', 'K', 'Before the model', null, 'scale features before k-means, SVMs and logistic regression; decision trees do not need it'));
    g2.appendChild(card('warn', 'C', 'Inside every classifier', null, 'scikit-learn\'s LogisticRegression is regularized by default; its C is 1/λ, so a bigger C means a weaker penalty'));
    const groups = [g0, g1, g2], caps = ['Scaling in three words.', 'Goal and tools.', 'In language technology.'];
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
