/* Scroll-driven visual introduction to decision trees.
   All numbers come from ml-math.js (window.MLM); all formulas are rendered with the vendored
   KaTeX. No other libraries, no build step. Every chapter is a pure function of
   (step, scroll progress, control values), so jumping straight to #chN renders correctly. */
(function () {
  'use strict';
  const ML = window.MLM;
  if (!ML) { console.error('ml-math.js did not load'); return; }

  /* ------------------------------------------------------------------ helpers */
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function T(parent, x, y, str, size, fill, o) {
    const t = el('text', Object.assign({ x: x, y: y, 'font-size': size, fill: fill || C.ink }, o || {}), parent);
    t.textContent = str;
    return t;
  }
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  /* staggered reveal: item i of n, driven by q in [0,1]; the first items are visible at q=0 */
  const rev = (q, i, n) => clamp((0.3 + q * 1.2) * (n + 1) - i, 0, 1);
  const show = (g, on) => { g.style.display = on ? '' : 'none'; };
  const f2 = (v) => v.toFixed(2);
  const f3 = (v) => v.toFixed(3);
  const pct = (v) => Math.round(v * 100) + '%';
  const MINUS = '−';
  /* controls stay in place (no layout jump); they are just disabled and dimmed when not relevant */
  function setOn(ids, enabled) {
    ids.forEach((id) => { $(id).disabled = !enabled; });
  }
  function ctlState(ctl, enabled) {
    ctl.classList.add('on');
    ctl.classList.toggle('off', !enabled);
    Array.prototype.forEach.call(ctl.querySelectorAll('input,button,select'), (n) => { n.disabled = !enabled; });
  }

  /* palette: blue circle = label 0, orange diamond = label 1, purple = the question / cut in focus,
     teal = fresh data, grey = neutral */
  const C = {
    ink: '#1d2733', muted: '#55636f', line: '#e5e1d8', card: '#ffffff', paper: '#fdfcfa',
    blue: '#1f6fd1', blueSoft: '#dbe8fa', orange: '#d9730d', orangeSoft: '#fbe6d0', orangeText: '#a85208',
    grey: '#7d8894', greySoft: '#e9e6dd', teal: '#0f8a8a', accent: '#6d5bd0', accentSoft: '#efecfb'
  };
  const LABEL = ['blue', 'orange'];
  const GLYPH = ['●', '◆'];

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
  function mathBox(parent, x, y, w, h, cls) {
    const fo = el('foreignObject', { x: x, y: y, width: w, height: h }, parent);
    const d = document.createElement('div');
    d.className = 'svgmath ' + (cls || '');
    fo.appendChild(d);
    d.fo = fo;
    return d;
  }

  /* ------------------------------------------------------------------ data (all from ml-math.js) */
  const D = ML.makeDataset(42), NZ = ML.makeNoisy(42), FR = ML.makeFresh(1001), LINE = ML.makeLine();
  const IDX = D.X.map((_, i) => i);
  const CT = {}, NT = {}, CTR = {}, NTR = {}, NFR = {};
  for (let d = 1; d <= 8; d++) {
    CT[d] = ML.buildTree(D.X, D.y, { maxDepth: d });
    NT[d] = ML.buildTree(NZ.X, NZ.y, { maxDepth: d });
    CTR[d] = ML.accuracy(CT[d], D.X, D.y);
    NTR[d] = ML.accuracy(NT[d], NZ.X, NZ.y);
    NFR[d] = ML.accuracy(NT[d], FR.X, FR.y);
  }
  const ROOT = ML.bestSplit(D.X, D.y, IDX, 'gini');
  const BEST_H = ML.bestSplit(D.X, D.y, IDX, 'gini', [1]);
  const Q5 = ML.splitStats(D.X, D.y, IDX, 0, 5, 'gini');
  const LIMIT = 3, SHALLOW = 2, DEEP = 8, NMINI = 5;
  const T2 = CT[2], T3 = CT[LIMIT];
  const WALK = ML.predict(T2, ML.PROBE);
  const NODE_ROOT = CT[2], NODE_LEFT = CT[2].left, NODE_RIGHT = CT[2].right;
  const STOP_LEAF = ML.treeNodes(T3).filter((n) => n.leaf && n.reason === 'depth')[0] || { counts: [0, 0] };
  let BEST_DEPTH = 1;
  for (let d = 2; d <= 8; d++) if (NFR[d] > NFR[BEST_DEPTH] + 1e-12) BEST_DEPTH = d;
  const DEPTH_FULL = ML.treeDepth(CT[8]), LEAVES_FULL = ML.leafCount(CT[8]);
  const FOREST = ML.trainForest(NZ.X, NZ.y, { seed: 7, nTrees: 25, maxDepth: 8, maxFeatures: 1 });
  const FOREST_FRESH = ML.forestAccuracy(FOREST, FR.X, FR.y);
  const ADA = ML.adaboostTrain1D(LINE.xs, LINE.ys, 20), ROUNDS = ADA.history.length;
  const pBlue = NODE_ROOT.counts[0] / NODE_ROOT.n, pOrange = NODE_ROOT.counts[1] / NODE_ROOT.n;

  const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const cap1 = (w) => w.charAt(0).toUpperCase() + w.slice(1);

  /* ------------------------------------------------------------------ prose placeholders {{key}} */
  function val(spec) {
    const a = spec.trim().split(/\s+/);
    const key = a[0].replace(/^t:/, '');
    let out;
    switch (key) {
      case 'n': out = String(D.n); break;
      case 'nBlue': out = String(NODE_ROOT.counts[0]); break;
      case 'nOrange': out = String(NODE_ROOT.counts[1]); break;
      case 'q5lb': out = String(Q5.leftCounts[0]); break;
      case 'q5lo': out = String(Q5.leftCounts[1]); break;
      case 'q5rb': out = String(Q5.rightCounts[0]); break;
      case 'q5ro': out = String(Q5.rightCounts[1]); break;
      case 'gainV': out = f3(ROOT.gain); break;
      case 'gainH': out = f3(BEST_H.gain); break;
      case 'rootThr': out = f2(NODE_ROOT.threshold); break;
      case 'leftThr': out = f2(NODE_LEFT.threshold); break;
      case 'rootGain': out = f3(NODE_ROOT.gain); break;
      case 'ncand': out = String(ML.scanSplits(D.X, D.y, IDX, 'gini', 0).length); break;
      case 'probeX': out = ML.PROBE[0].toFixed(1); break;
      case 'probeY': out = 'feature 2 = ' + ML.PROBE[1].toFixed(1); break;
      case 'leafO': out = String(WALK.leaf.counts[1]); break;
      case 'rootG': out = f2(NODE_ROOT.impurity); break;
      case 'leftG': out = f2(NODE_LEFT.impurity); break;
      case 'leftB': out = String(NODE_LEFT.counts[0]); break;
      case 'leftO': out = String(NODE_LEFT.counts[1]); break;
      case 'pB': out = f2(pBlue); break;
      case 'pO': out = f2(pOrange); break;
      case 'rootH': out = f2(ML.entropy(NODE_ROOT.counts)); break;
      case 'stopB': out = String(STOP_LEAF.counts[0]); break;
      case 'stopO': out = String(STOP_LEAF.counts[1]); break;
      case 'acc1': out = pct(CTR[1]); break;
      case 'acc2': out = pct(CTR[2]); break;
      case 'acc4': out = pct(CTR[DEPTH_FULL]); break;
      case 'depthFull': out = String(DEPTH_FULL); break;
      case 'leavesFull': out = String(LEAVES_FULL); break;
      case 'shTrain': out = pct(NTR[2]); break;
      case 'deepTrain': out = pct(NTR[8]); break;
      case 'leavesDeep': out = String(ML.leafCount(NT[8])); break;
      case 'leavesShallow': out = String(ML.leafCount(NT[2])); break;
      case 'nFresh': out = String(FR.n); break;
      case 'deepFresh': out = pct(NFR[8]); break;
      case 'shFresh': out = pct(NFR[2]); break;
      case 'bestDepth': out = String(BEST_DEPTH); break;
      case 'bestFresh': out = pct(NFR[BEST_DEPTH]); break;
      case 'oob': out = pct(ML.outOfBagChance(NZ.n)); break;
      case 'nTrees': out = String(FOREST.trees.length); break;
      case 'forestFresh': out = pct(FOREST_FRESH); break;
      case 'wrong1': out = String(ADA.history[0].wrong.length); break;
      case 'eps1': out = f2(ADA.history[0].err); break;
      case 'alpha1': out = f2(ADA.history[0].alpha); break;
      case 'rounds': out = String(ROUNDS); break;
      case 'limit': out = NUMW[LIMIT]; break;
      case 'shDepth': out = String(SHALLOW); break;
      case 'deepDepth': out = String(DEEP); break;
      case 'nNoisy': out = NUMW[NZ.noisy.length]; break;
      case 'nMini': out = NUMW[NMINI]; break;
      case 'NMini': out = cap1(NUMW[NMINI]); break;
      case 'NOut': out = cap1(NUMW[LINE.outliers.length]); break;
      default: console.warn('unknown placeholder', spec); out = '?';
    }
    return out;
  }
  function fillPlaceholders() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.indexOf('{{') >= 0 && !/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => { n.nodeValue = n.nodeValue.replace(/\{\{([^}]+)\}\}/g, (m, s) => val(s)); });
  }
  fillPlaceholders();
  renderMath(document.body);

  /* predict-then-reveal boxes */
  const predictHooks = {};
  Array.prototype.forEach.call(document.querySelectorAll('.predict'), (box) => {
    const rv = box.querySelector('.reveal');
    const chId = box.closest('section').id;
    Array.prototype.forEach.call(box.querySelectorAll('button'), (b) => {
      b.addEventListener('click', () => {
        Array.prototype.forEach.call(box.querySelectorAll('button'), (o) => o.classList.toggle('picked', o === b));
        rv.hidden = false;
        if (predictHooks[chId]) predictHooks[chId]();
      });
    });
  });

  /* ------------------------------------------------------------------ tooltips */
  const tip = $('tip');
  let tipT = 0;
  function tipMove(e) {
    tip.style.left = Math.max(6, Math.min(e.clientX + 14, window.innerWidth - 250)) + 'px';
    tip.style.top = Math.min(e.clientY + 16, window.innerHeight - 90) + 'px';
  }
  function tipShow(html, e) { tip.innerHTML = html; tip.classList.add('on'); tipMove(e); }
  function tipHide() { tip.classList.remove('on'); }
  function bindTip(node, fn) {
    node.classList.add('hit');
    node.addEventListener('pointerenter', (e) => tipShow(fn(), e));
    node.addEventListener('pointermove', tipMove);
    node.addEventListener('pointerleave', tipHide);
    node.addEventListener('click', (e) => { tipShow(fn(), e); clearTimeout(tipT); tipT = setTimeout(tipHide, 2800); });
  }
  window.addEventListener('scroll', tipHide, { passive: true });
  const countsHtml = (c) => c[0] + ' blue · ' + c[1] + ' orange';
  function exTip(d, i) {
    return '<b>Example ' + (i + 1) + '</b><br>feature 1 = ' + d.X[i][0].toFixed(1) + ', feature 2 = ' + d.X[i][1].toFixed(1) +
      '<br>label: ' + LABEL[d.y[i]];
  }
  function nodeTip(n) {
    const q = n.leaf ? 'Leaf: predicts <b>' + LABEL[n.prediction] + '</b>' : '<b>feature ' + (n.feature + 1) + ' ≤ ' + f2(n.threshold) + ' ?</b>';
    return q + '<br>' + countsHtml(n.counts) + '<br>Gini impurity ' + f2(n.impurity) +
      (n.leaf ? '<br>stopped: ' + { pure: 'pure node', depth: 'depth limit', small: 'too few examples', nogain: 'no useful question' }[n.reason] : '<br>gain of this question ' + f3(n.gain));
  }

  /* ------------------------------------------------------------------ shared drawing: glyphs, planes, trees, charts */
  const diamond = (r) => '0,' + (-r) + ' ' + r + ',0 0,' + r + ' ' + (-r) + ',0';
  /* label 0 = blue circle, label 1 = orange diamond (shape + colour); hollow = fresh data */
  function mkGlyph(parent, label, r, o) {
    o = o || {};
    const g = el('g', {}, parent);
    const col = label === 0 ? C.blue : C.orange;
    const shape = label === 0 ? el('circle', { r: r }, g) : el('polygon', { points: diamond(r * 1.32) }, g);
    g.shape = shape; g.col = col;
    paint(g, o.grey ? 'grey' : o.hollow ? 'hollow' : 'solid');
    return g;
  }
  function paint(g, mode) {
    const s = g.shape;
    if (mode === 'hollow') { s.setAttribute('fill', '#fff'); s.setAttribute('stroke', g.col); s.setAttribute('stroke-width', 1.5); }
    else { s.setAttribute('fill', mode === 'grey' ? C.grey : g.col); s.setAttribute('stroke', '#fff'); s.setAttribute('stroke-width', 1); }
  }
  const place = (g, x, y, s) => g.setAttribute('transform', 'translate(' + x + ',' + y + ')' + (s !== undefined && s !== 1 ? ' scale(' + s + ')' : ''));

  /* a square plane 0..10 x 0..10 */
  function makePlane(svg, x, y, s, M, o) {
    o = o || {};
    const g = el('g', {}, svg);
    el('rect', { x: x, y: y, width: s, height: s, fill: C.paper, stroke: C.line, rx: 6 }, g);
    const fs = M ? 10.5 : 11;
    for (let i = 0; i <= 10; i += 2) {
      if (i > 0 && i < 10) {
        el('line', { x1: x + i / 10 * s, y1: y, x2: x + i / 10 * s, y2: y + s, stroke: '#efede6' }, g);
        el('line', { x1: x, y1: y + s - i / 10 * s, x2: x + s, y2: y + s - i / 10 * s, stroke: '#efede6' }, g);
      }
      T(g, x + i / 10 * s, y + s + fs + 2, String(i), fs, C.muted, { 'text-anchor': 'middle', 'class': 'mono' });
      T(g, x - 4, y + s - i / 10 * s + fs * 0.35, String(i), fs, C.muted, { 'text-anchor': 'end', 'class': 'mono' });
    }
    if (!o.noTitles) {
      T(g, x + s / 2, y + s + fs * 2 + 5, 'feature 1', M ? 10.5 : 12, C.muted, { 'text-anchor': 'middle' });
      const yl = T(g, x - (M ? 20 : 26), y + s / 2, 'feature 2', M ? 10.5 : 12, C.muted, { 'text-anchor': 'middle' });
      yl.setAttribute('transform', 'rotate(-90 ' + (x - (M ? 20 : 26)) + ' ' + (y + s / 2) + ')');
    }
    return { g: g, x: x, y: y, s: s, sx: (v) => x + v / 10 * s, sy: (v) => y + s - v / 10 * s };
  }

  function plotPoints(parent, pl, d, r, o) {
    o = o || {};
    return d.X.map((p, i) => {
      const g = mkGlyph(parent, d.y[i], r, o);
      place(g, pl.sx(p[0]), pl.sy(p[1]));
      if (o.tip !== false) {
        el('circle', { r: r + 3, fill: 'transparent' }, g);
        bindTip(g, () => exTip(d, i));
      }
      return g;
    });
  }

  /* the cuts of a tree as lines on a plane (every cut spans only its own region) */
  function drawCuts(parent, tree, pl, o) {
    o = o || {};
    const lines = [];
    (function walk(n, b) {
      if (n.leaf) return;
      const t = n.threshold;
      let l;
      if (n.feature === 0) {
        l = el('line', { x1: pl.sx(t), x2: pl.sx(t), y1: pl.sy(b.y0), y2: pl.sy(b.y1) }, parent);
        walk(n.left, { x0: b.x0, x1: t, y0: b.y0, y1: b.y1 }); walk(n.right, { x0: t, x1: b.x1, y0: b.y0, y1: b.y1 });
      } else {
        l = el('line', { y1: pl.sy(t), y2: pl.sy(t), x1: pl.sx(b.x0), x2: pl.sx(b.x1) }, parent);
        walk(n.left, { x0: b.x0, x1: b.x1, y0: b.y0, y1: t }); walk(n.right, { x0: b.x0, x1: b.x1, y0: t, y1: b.y1 });
      }
      l.setAttribute('stroke', C.accent); l.setAttribute('stroke-width', o.w || 2.5); l.setAttribute('stroke-linecap', 'round');
      if (o.opacity != null) l.setAttribute('stroke-opacity', o.opacity);
      lines.push({ line: l, node: n });
    })(tree, { x0: 0, x1: 10, y0: 0, y1: 10 });
    return lines;
  }

  /* tinted rectangles for the leaves of a tree (blue = plain tint, orange = hatched) with a tooltip */
  function drawRegions(parent, tree, pl, M, o) {
    o = o || {};
    const rects = ML.partitionRects(tree, { x0: 0, x1: 10, y0: 0, y1: 10 });
    const svg = parent.ownerSVGElement;
    return rects.map((r) => {
      const col = r.pred === 0 ? C.blue : C.orange;
      const rc = el('rect', {
        x: pl.sx(r.x0), y: pl.sy(r.y1), width: Math.max(0.5, pl.sx(r.x1) - pl.sx(r.x0)), height: Math.max(0.5, pl.sy(r.y0) - pl.sy(r.y1)),
        fill: r.pred === 0 ? C.blue : hatch(svg), 'fill-opacity': r.pred === 0 ? (o.alpha != null ? o.alpha : 0.14) : 1, stroke: col, 'stroke-opacity': 0.35, 'stroke-width': 1
      }, parent);
      bindTip(rc, () => '<b>Region: predicts ' + LABEL[r.pred] + '</b><br>' + countsHtml(r.counts) + ' in training<br>Gini impurity ' + f2(ML.gini(r.counts)));
      return { rect: rc, r: r };
    });
  }

  /* region geometry shared by chapters 2, 4, 5, 6, 7: plane + a free area (tree or chart) + a readout panel.
     Desktop: plane on the left, free area on the right, readouts underneath.
     Mobile: plane on the left, free area on the right, readouts under the plane. */
  function areas(M) {
    if (!M) return { plane: { x: 38, y: 34, s: 300 }, free: { x: 360, y: 22, w: 272, h: 346 }, panel: { x: 16, y: 396, w: 608, h: 152 } };
    return { plane: { x: 32, y: 26, s: 136 }, free: { x: 178, y: 6, w: 198, h: 318 }, panel: { x: 6, y: 206, w: 168, h: 118 } };
  }

  /* text made of coloured pieces: strings are plain, [text, colour, bold] arrays are tspans */
  function setRich(t, parts) {
    while (t.firstChild) t.removeChild(t.firstChild);
    parts.forEach((p) => {
      if (typeof p === 'string') t.appendChild(document.createTextNode(p));
      else { const s = el('tspan', { fill: p[1] }, t); if (p[2]) s.setAttribute('font-weight', 700); s.textContent = p[0]; }
    });
  }
  const CNT = (c) => [[c[0] + ' ●', C.blue, 1], ' · ', [c[1] + ' ◆', C.orangeText, 1]];
  /* n readout lines inside the panel area */
  function readout(parent, A, M, n) {
    const fs = M ? 10.5 : 13, dy = M ? 16 : 26;
    return [...Array(n).keys()].map((i) => T(parent, A.panel.x, A.panel.y + (M ? 12 : 18) + i * dy, '', fs, C.ink));
  }

  /* orange regions get a hatch as well as a tint, so the two labels never depend on colour alone */
  function hatch(svg) {
    if (!svg._hatch) {
      const id = 'hatch-' + svg.id;
      const defs = el('defs', {}, svg);
      const pat = el('pattern', { id: id, width: 7, height: 7, patternTransform: 'rotate(45)', patternUnits: 'userSpaceOnUse' }, defs);
      el('rect', { width: 7, height: 7, fill: C.orange, 'fill-opacity': 0.1 }, pat);
      el('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: C.orange, 'stroke-width': 1.6, 'stroke-opacity': 0.55 }, pat);
      svg._hatch = 'url(#' + id + ')';
    }
    return svg._hatch;
  }

  /* a tree drawn from the layout in ml-math.js; returns the node and edge elements.
     Desktop nodes: question (2 lines), count bar, counts. Mobile leaves show only a shape and the counts. */
  function drawTree(parent, tree, R, M, o) {
    o = o || {};
    const NWI = M ? 62 : 74, NWL = M ? 36 : 60, NH = M ? 47 : 54;
    const depth = Math.max(1, ML.treeDepth(tree));
    const levelH = Math.min(M ? 64 : 84, (R.h - NH - 22) / depth);
    ML.layoutTree(tree, R.x + NWL / 2 + 1, R.x + R.w - NWL / 2 - 1, R.y + NH / 2 + 3, levelH);
    const edgeG = el('g', {}, parent), nodeG = el('g', {}, parent), out = { nodes: {}, edges: {} };
    const fs = M ? 10 : 11.5, fsc = M ? 10 : 11;
    ML.treeNodes(tree).forEach((n) => {
      if (n.leaf) return;
      [[n.left, 'yes'], [n.right, 'no']].forEach((pair) => {
        const c = pair[0], yes = pair[1] === 'yes';
        const y1 = n.py + NH / 2, y2 = c.py - NH / 2;
        const line = el('line', {
          x1: n.px, y1: y1, x2: c.px, y2: y2, stroke: C.grey, 'stroke-width': 2, 'stroke-dasharray': yes ? 'none' : '5 4', 'stroke-linecap': 'round'
        }, edgeG);
        const lab = T(edgeG, (n.px + c.px) / 2 + (yes ? -4 : 4), (y1 + y2) / 2 + 3, pair[1], M ? 10 : 11, C.muted, { 'text-anchor': yes ? 'end' : 'start', 'font-style': 'italic' });
        out.edges[c.id] = { line: line, label: lab, parent: n, child: c };
      });
    });
    ML.treeNodes(tree).forEach((n) => {
      const w = n.leaf ? NWL : NWI;
      const g = el('g', {}, nodeG);
      const rect = el('rect', { x: n.px - w / 2, y: n.py - NH / 2, width: w, height: NH, rx: 8, fill: '#fff', stroke: C.ink, 'stroke-width': 1.6 }, g);
      const top = n.py - NH / 2;
      if (n.leaf) {
        if (M) {
          const gl = mkGlyph(g, n.prediction, 5.5); place(gl, n.px, top + 13);
        } else {
          T(g, n.px, top + 17, GLYPH[n.prediction] + ' ' + LABEL[n.prediction], fs, n.prediction === 0 ? C.blue : C.orangeText, { 'text-anchor': 'middle', 'font-weight': 700 });
        }
      } else {
        T(g, n.px, top + (M ? 11 : 16), 'feature ' + (n.feature + 1), fs, C.ink, { 'text-anchor': 'middle', 'font-weight': 700 });
        T(g, n.px, top + (M ? 22 : 30), '≤ ' + f2(n.threshold), fs, C.ink, { 'text-anchor': 'middle' });
      }
      const bw = w - 12, bx = n.px - bw / 2, by = top + (M ? 27 : 33);
      const wb = bw * n.counts[0] / n.n;
      el('rect', { x: bx, y: by, width: Math.max(0, wb), height: M ? 5 : 6, fill: C.blue }, g);
      el('rect', { x: bx + wb, y: by, width: Math.max(0, bw - wb), height: M ? 5 : 6, fill: C.orange }, g);
      const ct = T(g, n.px, top + NH - (M ? 4 : 5), '', fsc, C.ink, { 'text-anchor': 'middle' });
      [[String(n.counts[0]), C.blue], [M ? '·' : ' · ', C.muted], [String(n.counts[1]), C.orangeText]].forEach((p) => {
        const ts = el('tspan', { fill: p[1], 'font-weight': 700 }, ct); ts.textContent = p[0];
      });
      bindTip(g, () => nodeTip(n));
      out.nodes[n.id] = { g: g, rect: rect, node: n, w: w, h: NH };
    });
    out.NH = NH;
    return out;
  }
  function styleNode(tn, on, dim) {
    tn.rect.setAttribute('stroke', on ? C.accent : C.ink);
    tn.rect.setAttribute('stroke-width', on ? 3.4 : 1.6);
    tn.rect.setAttribute('fill', on ? C.accentSoft : '#fff');
    tn.g.setAttribute('opacity', dim ? 0.3 : 1);
  }
  function styleEdge(te, on, dim) {
    te.line.setAttribute('stroke', on ? C.accent : C.grey);
    te.line.setAttribute('stroke-width', on ? 4 : 2);
    te.label.setAttribute('fill', on ? C.accent : C.muted);
    te.line.setAttribute('opacity', dim ? 0.3 : 1);
    te.label.setAttribute('opacity', dim ? 0.3 : 1);
  }

  /* a small line chart frame: returns scale functions */
  function makeChart(parent, x, y, w, h, xd, yd, M, o) {
    o = o || {};
    const g = el('g', {}, parent);
    const fs = M ? 10.5 : 11;
    el('rect', { x: x, y: y, width: w, height: h, fill: C.paper, stroke: C.line, rx: 4 }, g);
    const sx = (v) => x + (v - xd[0]) / (xd[1] - xd[0]) * w, sy = (v) => y + h - (v - yd[0]) / (yd[1] - yd[0]) * h;
    (o.yticks || []).forEach((t) => {
      el('line', { x1: x, x2: x + w, y1: sy(t), y2: sy(t), stroke: '#efede6' }, g);
      T(g, x - 4, sy(t) + fs * 0.35, o.yfmt ? o.yfmt(t) : String(t), fs, C.muted, { 'text-anchor': 'end', 'class': 'mono' });
    });
    (o.xticks || []).forEach((t) => {
      T(g, sx(t), y + h + fs + 2, o.xfmt ? o.xfmt(t) : String(t), fs, C.muted, { 'text-anchor': 'middle', 'class': 'mono' });
    });
    if (o.xlabel) T(g, x + w / 2, y + h + fs * 2 + 5, o.xlabel, M ? 10.5 : 12, C.muted, { 'text-anchor': 'middle' });
    if (o.ylabel) {
      const yl = T(g, x - (o.ylabelDx || (M ? 26 : 34)), y + h / 2, o.ylabel, M ? 10.5 : 12, C.muted, { 'text-anchor': 'middle' });
      yl.setAttribute('transform', 'rotate(-90 ' + (x - (o.ylabelDx || (M ? 26 : 34))) + ' ' + (y + h / 2) + ')');
    }
    return { g: g, sx: sx, sy: sy, x: x, y: y, w: w, h: h };
  }
  const poly = (pts) => pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

  /* a bag of dots: n glyphs on a sunflower spiral inside a circle (shuffled labels) */
  function bagLayout(counts, R, seed) {
    const labels = [];
    for (let k = 0; k < counts[0]; k++) labels.push(0);
    for (let k = 0; k < counts[1]; k++) labels.push(1);
    const rng = ML.mulberry32(seed);
    for (let i = labels.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = labels[i]; labels[i] = labels[j]; labels[j] = t; }
    const n = labels.length;
    return labels.map((l, i) => {
      const rr = R * 0.86 * Math.sqrt((i + 0.5) / n), a = i * 2.39996323;
      return { label: l, x: Math.cos(a) * rr, y: Math.sin(a) * rr };
    });
  }

  /* the bag of chapter 3: the labels of the whole set in a fixed shuffle (positions are scaled per figure) */
  const BAG = bagLayout(NODE_ROOT.counts, 1, 11);

  /* ------------------------------------------------------------------ scroll engine */
  const mq = window.matchMedia('(max-width: 920px)');
  const chapters = [];
  function register(id, build) {
    const chEl = $(id);
    const n = id.replace('ch', '');
    chapters.push({
      el: chEl, id: id, build: build,
      svg: $('viz' + n), cap: $('cap' + n), ctl: $('ctl' + n),
      steps: Array.prototype.slice.call(chEl.querySelectorAll('.step')),
      inst: null, stage: -1, p: -1, q: 0, capHtml: null
    });
  }
  function redraw(id) {
    const ch = chapters.filter((c) => c.id === id)[0];
    if (ch) draw(ch, Math.max(ch.stage, 0), ch.p, ch.q, true);
  }

  function buildChapter(ch) {
    const M = mq.matches;
    const W = M ? 380 : 640, H = M ? 330 : 560;
    ch.svg.innerHTML = '';
    ch.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    ch.capHtml = null;
    const C0 = {
      svg: ch.svg, W: W, H: H, M: M, ctl: ch.ctl,
      cap: function (html) {
        if (html === ch.capHtml) return;
        ch.capHtml = html; ch.cap.innerHTML = html; renderMath(ch.cap);
      }
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

  function draw(ch, stage, p, q, force) {
    if (!ch.inst || ch.inst.M !== mq.matches) { buildChapter(ch); force = true; }
    const changed = ch.stage !== stage || force;
    if (!changed && Math.abs(p - ch.p) < 0.003) return;
    ch.stage = stage; ch.p = p; ch.q = q;
    if (ch.inst.failed) return;
    try { ch.inst.render(stage, p, q, changed); } catch (e) {
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
    chapters.forEach((ch) => {
      const r = ch.el.getBoundingClientRect();
      const near = r.bottom > -vh * 0.5 && r.top < vh * 1.5;
      if (!near && ch.inst) return;
      // on narrow screens the figure is pinned to the top, so a step "arrives" lower on the screen
      const trig = mq.matches ? 0.6 : 0.5;
      let lastAbove = -1;
      ch.steps.forEach((s, si) => { if (s.getBoundingClientRect().top <= vh * trig) lastAbove = si; });
      const best = clamp(lastAbove, 0, ch.steps.length - 1);
      const r0 = ch.steps[best].getBoundingClientRect();
      const bp = clamp((vh - r0.top) / vh, 0, 1);
      const q = clamp((bp - trig) / (1 - trig), 0, 1);
      ch.steps.forEach((s, si) => {
        const rr = s.getBoundingClientRect();
        s.classList.toggle('active', si === best || (rr.top < vh && rr.bottom > 0));
      });
      draw(ch, best, bp, q, false);
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

  /* per-chapter control state; a step change resets "manual" so the scene follows the scroll again */
  const S = {
    ch3: { n: 0, dis: 0, last: null, rng: ML.mulberry32(5), rev: false },
    ch4: { f: 0, t: 5, manual: false, stage: -1 },
    ch5: { d: 1, manual: false, stage: -1 },
    ch6: { d: 2, manual: false, stage: -1, rev: false },
    ch7: { seed: 3, k: FOREST.trees.length },
    ch8: { r: 1, manual: false, stage: -1 }
  };

  /* ============================================================
     Chapter 1 - the data
     ============================================================ */
  register('ch1', function (C0) {
    const svg = C0.svg, W = C0.W, M = C0.M;
    const px = M ? 34 : 62, py = M ? 46 : 62, ps = M ? 244 : 424;
    const pl = makePlane(svg, px, py, ps, M);
    const cutG = el('g', {}, svg), ptG = el('g', {}, svg), topG = el('g', {}, svg);
    const pts = plotPoints(ptG, pl, D, M ? 3.8 : 5.4, { grey: true });
    const fs = M ? 11 : 12.5;
    /* the legend sits to the right of the plane */
    const lg = el('g', { 'class': 'anim' }, svg);
    const lx = px + ps + (M ? 12 : 18);
    const g1 = mkGlyph(lg, 0, 5), g2 = mkGlyph(lg, 1, 5);
    place(g1, lx + 5, py + 12); place(g2, lx + 5, py + 34);
    T(lg, lx + 16, py + 16, 'blue', fs, C.blue, { 'font-weight': 700 });
    T(lg, lx + 16, py + 38, 'orange', fs, C.orangeText, { 'font-weight': 700 });
    /* stage 2: a vertical question at 5 with counts on both sides */
    const q5 = el('g', {}, cutG);
    el('line', { x1: pl.sx(5), x2: pl.sx(5), y1: pl.sy(0), y2: pl.sy(10), stroke: C.accent, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, q5);
    const qG = el('g', {}, topG);
    const qL = T(qG, pl.sx(5) - 6, py - 8, '', fs, C.ink, { 'text-anchor': 'end' });
    const qR = T(qG, pl.sx(5) + 6, py - 8, '', fs, C.ink);
    setRich(qL, ['left: ', CNT(Q5.leftCounts)[0], ' · ', CNT(Q5.leftCounts)[2]]);
    setRich(qR, ['right: ', CNT(Q5.rightCounts)[0], ' · ', CNT(Q5.rightCounts)[2]]);
    T(qG, pl.sx(5), py - (M ? 24 : 28), 'Is feature 1 ≤ 5 ?', fs, C.accent, { 'text-anchor': 'middle', 'font-weight': 700 });
    /* stage 3: two candidate cuts, A (vertical) and B (horizontal) */
    const ab = el('g', {}, cutG), abBadges = el('g', {}, topG);
    el('line', { x1: pl.sx(ROOT.threshold), x2: pl.sx(ROOT.threshold), y1: pl.sy(0), y2: pl.sy(10), stroke: C.accent, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, ab);
    el('line', { x1: pl.sx(0), x2: pl.sx(10), y1: pl.sy(BEST_H.threshold), y2: pl.sy(BEST_H.threshold), stroke: C.accent, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, ab);
    const badge = (x, y, ch) => {
      el('circle', { cx: x, cy: y, r: M ? 9 : 11, fill: C.accent }, abBadges);
      T(abBadges, x, y + (M ? 4 : 5), ch, M ? 12 : 14, '#fff', { 'text-anchor': 'middle', 'font-weight': 800 });
    };
    badge(pl.sx(ROOT.threshold), py - (M ? 12 : 15), 'A');
    badge(px + ps + (M ? 14 : 18), pl.sy(BEST_H.threshold), 'B');
    const caps = [
      D.n + ' examples, two measurements each, so each one is a point. Hover or tap a point.',
      'The label is the answer: a blue circle or an orange diamond.',
      'A question is a cut. Counts of each label on each side of “feature 1 ≤ 5”.',
      'Candidate A is a vertical cut, candidate B a horizontal one. Which is better?'
    ];
    return {
      render: function (stage, p, q) {
        C0.ctl.classList.remove('on');
        pts.forEach((g, i) => {
          place(g, pl.sx(D.X[i][0]), pl.sy(D.X[i][1]), stage === 0 ? ease(clamp((0.55 + q * 0.9) * (D.n + 1) - i, 0, 1)) : 1);
          paint(g, stage >= 1 ? 'solid' : 'grey');
        });
        lg.setAttribute('opacity', stage >= 1 ? 1 : 0);
        show(q5, stage === 2); show(qG, stage === 2);
        show(ab, stage === 3); show(abBadges, stage === 3);
        C0.cap(caps[stage]);
      }
    };
  });

  /* ============================================================
     Chapter 2 - a tree is a flowchart (tree and plane side by side)
     ============================================================ */
  register('ch2', function (C0) {
    const svg = C0.svg, M = C0.M, A = areas(M);
    const pl = makePlane(svg, A.plane.x, A.plane.y, A.plane.s, M);
    const regionG = el('g', {}, svg), cutG = el('g', {}, svg), ptG = el('g', {}, svg), probeG = el('g', {}, svg);
    const shade = el('rect', { 'class': 'anim', fill: C.accent, 'fill-opacity': 0.18, stroke: C.accent, 'stroke-width': 2, 'stroke-dasharray': '5 4', width: 0, height: 0 }, regionG);
    drawCuts(cutG, T2, pl, { opacity: 0.55, w: 2 });
    plotPoints(ptG, pl, D, M ? 2.6 : 3.6);
    const tr = drawTree(svg, T2, A.free, M);
    const path = WALK.path;
    const cx = pl.sx(ML.PROBE[0]), cy = pl.sy(ML.PROBE[1]);
    const ring = el('circle', { cx: cx, cy: cy, r: M ? 8 : 10, fill: 'none', stroke: C.ink, 'stroke-width': 3 }, probeG);
    const dot = el('circle', { cx: cx, cy: cy, r: M ? 3 : 4, fill: C.ink }, probeG);
    const plab = T(probeG, A.plane.x + A.plane.s / 2, A.plane.y - (M ? 8 : 10), 'black ring = a new example', M ? 10.5 : 12, C.ink, { 'font-weight': 700, 'text-anchor': 'middle' });
    const panel = el('g', {}, svg);
    const L = readout(panel, A, M, 4);
    function region(k) {
      const b = { x0: 0, x1: 10, y0: 0, y1: 10 };
      for (let i = 0; i < k && i < path.length - 1; i++) {
        const n = path[i], left = path[i + 1] === n.left;
        if (n.feature === 0) { if (left) b.x1 = Math.min(b.x1, n.threshold); else b.x0 = Math.max(b.x0, n.threshold); }
        else { if (left) b.y1 = Math.min(b.y1, n.threshold); else b.y0 = Math.max(b.y0, n.threshold); }
      }
      return b;
    }
    function setRect(r, b) {
      r.setAttribute('x', pl.sx(b.x0)); r.setAttribute('y', pl.sy(b.y1));
      r.setAttribute('width', Math.max(0, pl.sx(b.x1) - pl.sx(b.x0))); r.setAttribute('height', Math.max(0, pl.sy(b.y0) - pl.sy(b.y1)));
    }
    const caps = [
      'The new example (black ring) must be labelled. Start at the root.',
      'Root: feature 1 = ' + ML.PROBE[0].toFixed(1) + ' ≤ ' + f2(path[0].threshold) + ': yes, go left.',
      'Next: feature 2 = ' + ML.PROBE[1].toFixed(1) + ' > ' + f2(path[1].threshold) + ': no, go right.',
      'A leaf: ' + path[2].counts[1] + ' orange, ' + path[2].counts[0] + ' blue in training. The tree says ' + LABEL[WALK.label] + '.'
    ];
    return {
      render: function (stage, p, q) {
        ML.treeNodes(T2).forEach((n) => {
          const pi = path.indexOf(n);
          styleNode(tr.nodes[n.id], pi !== -1 && pi <= stage, false);
          if (tr.edges[n.id]) styleEdge(tr.edges[n.id], pi !== -1 && pi <= stage, false);
        });
        if (stage >= 1) setRect(shade, region(Math.min(stage, 2))); else { shade.setAttribute('width', 0); shade.setAttribute('height', 0); }
        const appear = stage === 0 ? 0.55 + 0.45 * clamp(q / 0.4, 0, 1) : 1;
        ring.setAttribute('r', (M ? 8 : 10) * ease(appear)); ring.setAttribute('opacity', appear);
        dot.setAttribute('r', (M ? 3 : 4) * ease(appear)); plab.setAttribute('opacity', appear > 0.5 ? 1 : 0);
        const pr = ML.PROBE;
        L.forEach((t) => { t.textContent = ''; });
        if (stage >= 1) L[0].textContent = M ? '1. feature 1: ' + pr[0].toFixed(1) + ' ≤ ' + f2(path[0].threshold) + '? yes' : '1. feature 1 = ' + pr[0].toFixed(1) + ', at most ' + f2(path[0].threshold) + '?  yes, go left';
        if (stage >= 2) L[1].textContent = M ? '2. feature 2: ' + pr[1].toFixed(1) + ' ≤ ' + f2(path[1].threshold) + '? no' : '2. feature 2 = ' + pr[1].toFixed(1) + ', at most ' + f2(path[1].threshold) + '?  no, go right';
        if (stage >= 3) setRich(L[2], ['3. leaf: ', CNT(path[2].counts)[0], ' · ', CNT(path[2].counts)[2], ' → ', [GLYPH[WALK.label] + ' ' + LABEL[WALK.label], C.orangeText, 1]]);
        C0.ctl.classList.remove('on');
        C0.cap(caps[stage]);
      }
    };
  });

  /* ============================================================
     Chapter 3 - how mixed is a node? (Gini, then entropy)
     ============================================================ */
  register('ch3', function (C0) {
    const svg = C0.svg, W = C0.W, M = C0.M, st = S.ch3;
    const fs = M ? 11 : 12.5;
    const NODES = [['the whole set', NODE_ROOT], ['the left part', NODE_LEFT], ['the right part', NODE_RIGHT]];
    /* ---- stage 0: the bag and the two picks */
    const bagG = el('g', {}, svg);
    const R0 = M ? 84 : 150, bx = M ? 96 : 180, by = M ? 156 : 280;
    el('circle', { cx: bx, cy: by, r: R0, fill: C.paper, stroke: C.line, 'stroke-width': 2 }, bagG);
    T(bagG, bx, by - R0 - 10, 'the bag: all ' + D.n + ' examples', fs, C.muted, { 'text-anchor': 'middle', 'font-weight': 700 });
    const lay = BAG.map((o) => ({ label: o.label, x: o.x * R0, y: o.y * R0 }));
    lay.forEach((o) => { const g = mkGlyph(bagG, o.label, M ? 4.2 : 6.5); place(g, bx + o.x, by + o.y); });
    const rings = [0, 1].map((k) => {
      const g = el('g', {}, bagG);
      el('circle', { r: M ? 9 : 12, fill: 'none', stroke: C.ink, 'stroke-width': 3 }, g);
      T(g, 0, M ? -12 : -16, String(k + 1), fs, C.ink, { 'text-anchor': 'middle', 'font-weight': 800, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 3 });
      return g;
    });
    const rx = M ? 196 : 372, barW = (M ? 380 : 640) - rx - (M ? 12 : 16);
    const ry = M ? 70 : 130, dy = M ? 20 : 30;
    const readG = el('g', {}, bagG);
    const t1 = T(readG, rx, ry, '', fs + 1, C.ink, { 'font-weight': 700 });
    const t2 = T(readG, rx, ry + dy, '', fs, C.ink);
    const t3 = T(readG, rx, ry + 2 * dy, '', fs, C.ink);
    T(readG, rx, ry + 3.4 * dy, 'share of tries that disagreed', fs - 0.5, C.muted, { 'font-weight': 700 });
    const by0 = ry + 3.4 * dy + (M ? 10 : 14);
    el('rect', { x: rx, y: by0, width: barW, height: 14, rx: 7, fill: C.greySoft }, readG);
    const barR = el('rect', { x: rx, y: by0, width: 0, height: 14, rx: 7, fill: C.accent }, readG);
    const exX = rx + NODE_ROOT.impurity * barW;
    el('line', { x1: exX, x2: exX, y1: by0 - 6, y2: by0 + 20, stroke: C.ink, 'stroke-width': 3 }, readG);
    T(readG, rx, by0 + 34, '0', fs - 1, C.muted); T(readG, rx + barW, by0 + 34, '1', fs - 1, C.muted, { 'text-anchor': 'end' });
    T(readG, exX, by0 + (M ? 46 : 50), 'Gini ' + f2(NODE_ROOT.impurity), fs - 0.5, C.ink, { 'text-anchor': 'middle', 'font-weight': 700 });
    /* ---- stage 1: three nodes side by side */
    const nodesG = el('g', {}, svg);
    const nx = M ? [62, 190, 318] : [112, 320, 528], nrad = NODES.map((o) => (M ? 52 : 98) * Math.sqrt(o[1].n / D.n)), ny = M ? 84 : 190;
    const gLabels = NODES.map((o, i) => {
      const g = el('g', {}, nodesG);
      el('circle', { cx: nx[i], cy: ny, r: nrad[i], fill: C.paper, stroke: C.line, 'stroke-width': 2 }, g);
      bagLayout(o[1].counts, nrad[i], 20 + i).forEach((d) => { const gl = mkGlyph(g, d.label, M ? 3.4 : 5.2); place(gl, nx[i] + d.x, ny + d.y); });
      T(g, nx[i], ny + nrad[i] + (M ? 15 : 22), o[0], fs, C.ink, { 'text-anchor': 'middle', 'font-weight': 700 });
      const ct = T(g, nx[i], ny + nrad[i] + (M ? 29 : 42), '', fs, C.ink, { 'text-anchor': 'middle' });
      setRich(ct, [CNT(o[1].counts)[0], ' · ', CNT(o[1].counts)[2]]);
      return T(g, nx[i], ny + nrad[i] + (M ? 47 : 66), '', M ? 12.5 : 16, C.accent, { 'text-anchor': 'middle', 'font-weight': 800 });
    });
    const fb = mathBox(nodesG, M ? 10 : 70, M ? 212 : 400, M ? 360 : 500, 40, 'c');
    setTex(fb, 'G=1-\\big(' + f2(pBlue) + '^2+' + f2(pOrange) + '^2\\big)=' + f2(NODE_ROOT.impurity));
    T(nodesG, M ? 190 : 320, M ? 206 : 392, 'whole set:', fs - 0.5, C.muted, { 'text-anchor': 'middle' });
    /* ---- stages 2 and 3: curves */
    const cvG = el('g', {}, svg);
    const cx0 = M ? 46 : 70, cy0 = M ? 18 : 36, cw = M ? 316 : 530, chh = M ? 236 : 400;
    const ch = makeChart(cvG, cx0, cy0, cw, chh, [0, 1], [0, 1], M, {
      xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [0, 0.5, 1], xlabel: 'share of blue in the node', ylabel: 'mixed-up score', xfmt: (v) => String(v), yfmt: (v) => String(v)
    });
    const gP = [], hP = [];
    for (let i = 0; i <= 80; i++) { const pp = i / 80; gP.push([ch.sx(pp), ch.sy(ML.giniProbs([pp, 1 - pp]))]); hP.push([ch.sx(pp), ch.sy(ML.entropyProbs([pp, 1 - pp]))]); }
    el('polyline', { points: poly(gP), fill: 'none', stroke: C.accent, 'stroke-width': 3 }, cvG);
    const hLine = el('polyline', { points: poly(hP), fill: 'none', stroke: C.ink, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, cvG);
    const lgx = ch.sx(0.27), lgy = ch.sy(0.27);
    el('line', { x1: lgx, x2: lgx + 26, y1: lgy - 4, y2: lgy - 4, stroke: C.accent, 'stroke-width': 3 }, cvG);
    T(cvG, lgx + 32, lgy, 'Gini impurity', fs, C.accent, { 'font-weight': 700 });
    const hLeg = el('g', {}, cvG);
    el('line', { x1: lgx, x2: lgx + 26, y1: lgy + (M ? 16 : 20), y2: lgy + (M ? 16 : 20), stroke: C.ink, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }, hLeg);
    T(hLeg, lgx + 32, lgy + (M ? 20 : 24), 'entropy, in bits', fs, C.ink, { 'font-weight': 700 });
    const marks = NODES.map((o, i) => {
      const pp = o[1].counts[0] / o[1].n, g = el('g', {}, cvG);
      const gv = ML.gini(o[1].counts), hv = ML.entropy(o[1].counts);
      el('circle', { cx: ch.sx(pp), cy: ch.sy(gv), r: M ? 5 : 6.5, fill: '#fff', stroke: C.accent, 'stroke-width': 3 }, g);
      const hm = el('circle', { cx: ch.sx(pp), cy: ch.sy(hv), r: M ? 4 : 5, fill: C.ink }, g);
      const lab = ['whole set', 'left part', 'right part'][i];
      const lx = ch.sx(pp) + (i === 2 ? -10 : i === 0 ? 10 : 0), anchor = i === 2 ? 'end' : i === 0 ? 'start' : 'middle';
      const ly = ch.sy(gv) + (i === 1 ? -(M ? 11 : 13) : i === 2 ? -(M ? 6 : 8) : (M ? 4 : 5));
      T(g, lx, ly, lab + ' ' + f2(gv), fs - 0.5, C.accent, { 'text-anchor': anchor, 'font-weight': 700, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 3 });
      const ht = T(g, ch.sx(pp) + (i === 2 ? -10 : i === 0 ? 10 : 0), ch.sy(hv) + (i === 2 ? -(M ? 22 : 28) : -(M ? 9 : 11)), f2(hv) + ' bits', fs - 0.5, C.ink, { 'text-anchor': anchor, 'font-weight': 700, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 3 });
      return { g: g, hm: hm, ht: ht };
    });
    const caps = [
      'Pick two at random (putting the first back): how often do the labels disagree?',
      'Three nodes, compared by how mixed up they are.',
      'Gini impurity against the share of blue: 0 when pure, 0.5 for a coin flip.',
      'Entropy (dashed) has the same hill shape, in bits. Both rulers pick similar questions.'
    ];
    return {
      render: function (stage, p, q) {
        const s0 = stage === 0;
        show(bagG, s0); show(nodesG, stage === 1); show(cvG, stage >= 2);
        const hv = stage === 3;
        hLine.style.display = hLeg.style.display = hv ? '' : 'none';
        marks.forEach((m) => { m.hm.style.display = m.ht.style.display = hv ? '' : 'none'; });
        ctlState(C0.ctl, s0);
        if (s0) {
          rings.forEach((r, k) => {
            if (st.last) { const o = lay[st.last[k]]; r.setAttribute('transform', 'translate(' + (bx + o.x) + ',' + (by + o.y) + ')'); r.style.display = ''; }
            else r.style.display = 'none';
          });
          const frac = st.n ? st.dis / st.n : 0;
          t1.textContent = st.n ? 'tries so far: ' + st.n : 'press “Pick two”';
          t2.textContent = st.n ? 'disagreed: ' + st.dis + ' (' + pct(frac) + ')' : '';
          t3.textContent = st.last ? 'last pair: ' + (st.last[2] ? 'disagree' : 'agree') : '';
          barR.setAttribute('width', frac * barW);
        }
        gLabels.forEach((gv, i) => { gv.textContent = (S.ch3.rev || stage >= 2) ? 'Gini ' + f2(NODES[i][1].impurity) : 'Gini ?'; });
        C0.cap(caps[stage]);
      }
    };
  });
  predictHooks.ch3 = () => { S.ch3.rev = true; redraw('ch3'); };
  (function wireCh3() {
    function pick(k) {
      const st = S.ch3;
      for (let a = 0; a < k; a++) {
        /* two draws, the first one put back before the second */
        const i = Math.floor(st.rng() * BAG.length), j = Math.floor(st.rng() * BAG.length);
        const dis = BAG[i].label !== BAG[j].label;
        st.n++; if (dis) st.dis++;
        st.last = [i, j, dis];
      }
      redraw('ch3');
    }
    $('pick1').addEventListener('click', () => pick(1));
    $('pick100').addEventListener('click', () => pick(100));
    $('pickReset').addEventListener('click', () => { S.ch3.n = 0; S.ch3.dis = 0; S.ch3.last = null; redraw('ch3'); });
  })();

  /* ============================================================
     Chapter 4 - finding the best question; tree and plane grow together
     ============================================================ */
  register('ch4', function (C0) {
    const svg = C0.svg, M = C0.M, A = areas(M), st = S.ch4;
    const fs = M ? 11 : 12.5;
    const pl = makePlane(svg, A.plane.x, A.plane.y, A.plane.s, M);
    const regionG = el('g', {}, svg), cutG = el('g', {}, svg), ptG = el('g', {}, svg), candG = el('g', {}, svg);
    plotPoints(ptG, pl, D, M ? 2.8 : 4);
    const cand = el('line', { stroke: C.accent, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, candG);
    const scanCache = [ML.scanSplits(D.X, D.y, IDX, 'gini', 0), ML.scanSplits(D.X, D.y, IDX, 'gini', 1)];
    const bestOf = scanCache.map((s) => s.reduce((a, b) => (b.gain > a.gain ? b : a)));
    /* the gain curve lives in the free area (stage 0) */
    const gg = el('g', {}, svg);
    const chx = A.free.x + (M ? 36 : 44), chy = A.free.y + (M ? 24 : 34), chw = A.free.w - (M ? 46 : 58), chh = M ? 190 : A.free.h - 120;
    const ch = makeChart(gg, chx, chy, chw, chh, [0, 10], [0, 0.2], M, {
      xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 0.1, 0.2], xlabel: 'where the cut is', ylabel: 'gain', yfmt: (v) => String(v), ylabelDx: M ? 28 : 34
    });
    T(gg, chx + chw / 2, chy - (M ? 7 : 10), 'gain of every possible cut', fs - 0.5, C.muted, { 'text-anchor': 'middle', 'font-weight': 700 });
    const curve = el('polyline', { fill: 'none', stroke: C.accent, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, gg);
    const bestMark = el('g', {}, gg);
    el('polygon', { points: '0,-8 2.4,-2.5 8,-2.5 3.6,1 5.2,7 0,3.5 -5.2,7 -3.6,1 -8,-2.5 -2.4,-2.5', fill: C.ink }, bestMark);
    const bestLab = T(gg, 0, 0, 'best', fs - 1, C.ink, { 'font-weight': 700, 'text-anchor': 'middle' });
    const curMark = el('circle', { r: M ? 5 : 6.5, fill: C.accent, stroke: '#fff', 'stroke-width': 2 }, gg);
    /* tree stages */
    const treeG = el('g', {}, svg);
    const trees = {};
    [1, 2, 3].forEach((d) => { const g = el('g', {}, treeG); trees[d] = { g: g, tr: drawTree(g, CT[d], A.free, M) }; });
    const stopTags = [];
    ML.treeNodes(CT[3]).forEach((n) => { /* labels under the leaves of the depth-3 tree */
      if (!n.leaf) return;
      const tn = trees[3].tr.nodes[n.id];
      stopTags.push(T(trees[3].g, n.px, n.py + tn.h / 2 + (M ? 12 : 14), n.reason === 'pure' ? '✓ pure' : (M ? '■ limit' : '■ depth limit'), M ? 10 : 11, n.reason === 'pure' ? C.muted : C.accent, { 'text-anchor': 'middle', 'font-weight': 700 }));
    });
    /* readout panel */
    const panel = el('g', {}, svg);
    const L = readout(panel, A, M, 5);
    const regDyn = el('g', {}, regionG), cutDyn = el('g', {}, cutG);
    let shownDepth = -1;
    const caps = [
      'Drag the cut: counts, impurity and gain update live. The star marks the best cut on this feature.',
      'The best cut becomes the root: one new node in the tree, one new cut on the plane.',
      'The same search, on the left side only: the tree and the plane grow together.',
      'Pure leaves stop; the depth limit stops the rest.'
    ];
    return {
      render: function (stage, p, q, changed) {
        if (changed && st.stage !== stage) { st.stage = stage; st.manual = false; }
        const s0 = stage === 0;
        ctlState(C0.ctl, s0);
        show(gg, s0); show(candG, s0); show(treeG, !s0);
        L.forEach((t) => { t.textContent = ''; t.setAttribute('font-weight', 400); });
        if (s0) {
          const sc = scanCache[st.f], bs = bestOf[st.f];
          const lo = sc[0].threshold, hi = sc[sc.length - 1].threshold;
          if (!st.manual) st.t = lo + ease(clamp(q * 1.15, 0, 1)) * (hi - lo);
          st.t = clamp(st.t, lo, hi);
          $('thrRange').min = lo; $('thrRange').max = hi;
          const c = ML.splitStats(D.X, D.y, IDX, st.f, st.t, 'gini');
          if (st.f === 0) { cand.setAttribute('x1', pl.sx(st.t)); cand.setAttribute('x2', pl.sx(st.t)); cand.setAttribute('y1', pl.sy(0)); cand.setAttribute('y2', pl.sy(10)); }
          else { cand.setAttribute('y1', pl.sy(st.t)); cand.setAttribute('y2', pl.sy(st.t)); cand.setAttribute('x1', pl.sx(0)); cand.setAttribute('x2', pl.sx(10)); }
          curve.setAttribute('points', poly(sc.map((s) => [ch.sx(s.threshold), ch.sy(s.gain)])));
          curMark.setAttribute('cx', ch.sx(st.t)); curMark.setAttribute('cy', ch.sy(c.gain));
          bestMark.setAttribute('transform', 'translate(' + ch.sx(bs.threshold) + ',' + ch.sy(bs.gain) + ')');
          bestLab.setAttribute('x', clamp(ch.sx(bs.threshold), chx + 16, chx + chw - 16)); bestLab.setAttribute('y', ch.sy(bs.gain) - 12);
          L[0].textContent = 'cut: feature ' + (st.f + 1) + ' ≤ ' + f2(st.t);
          setRich(L[1], [M ? 'yes: ' : 'yes side: ', CNT(c.leftCounts)[0], ' · ', CNT(c.leftCounts)[2], '  G ' + f2(c.leftImpurity)]);
          setRich(L[2], [M ? 'no: ' : 'no side: ', CNT(c.rightCounts)[0], ' · ', CNT(c.rightCounts)[2], '  G ' + f2(c.rightImpurity)]);
          L[3].textContent = M ? 'G before ' + f2(c.parentImpurity) + ', after ' + f2(c.weightedImpurity) : 'Gini before the cut ' + f2(c.parentImpurity) + ', after (weighted) ' + f2(c.weightedImpurity);
          L[4].textContent = 'gain ' + f3(Math.max(0, c.gain)) + (Math.abs(c.gain - bs.gain) < 0.004 ? (M ? ' ← best' : '   ← about the best') : (M ? ' (best ' + f3(bs.gain) + ')' : '   (best on this feature: ' + f3(bs.gain) + ')'));
          L[4].setAttribute('font-weight', 700);
          $('thrRange').value = st.t; $('featSel').value = String(st.f);
          $('thrOut').textContent = f2(st.t);
          regDyn.innerHTML = ''; cutDyn.innerHTML = '';
          shownDepth = -1;
        } else {
          const d = stage, tree = CT[d];
          [1, 2, 3].forEach((k) => show(trees[k].g, k === d));
          stopTags.forEach((t) => { t.style.display = stage === 3 ? '' : 'none'; });
          if (shownDepth !== d) {
            shownDepth = d;
            regDyn.innerHTML = ''; cutDyn.innerHTML = '';
            drawRegions(regDyn, tree, pl, M, { alpha: 0.13 });
            drawCuts(cutDyn, tree, pl, { w: 3 });
          }
          const tr = trees[d].tr;
          ML.treeNodes(tree).forEach((n) => {
            const focus = (stage === 1 && n === tree) || (stage === 2 && n === tree.left);
            styleNode(tr.nodes[n.id], focus, false);
            if (tr.edges[n.id]) styleEdge(tr.edges[n.id], false, false);
          });
          if (stage === 1) {
            L[0].textContent = 'root: feature 1 ≤ ' + f2(tree.threshold); L[0].setAttribute('font-weight', 700);
            L[1].textContent = 'gain ' + f3(tree.gain) + ' (the best of all)';
            setRich(L[2], ['left: ', CNT(tree.left.counts)[0], ' · ', CNT(tree.left.counts)[2]]);
            setRich(L[3], ['right: ', CNT(tree.right.counts)[0], ' · ', CNT(tree.right.counts)[2], '  pure']);
          } else if (stage === 2) {
            L[0].textContent = 'left side, next question:'; L[0].setAttribute('font-weight', 700);
            L[1].textContent = 'feature 2 ≤ ' + f2(tree.left.threshold);
            L[2].textContent = 'gain ' + f3(tree.left.gain) + ' on ' + tree.left.n + ' examples';
            L[3].textContent = M ? 'right side: pure, a leaf' : 'the right side is pure: a leaf';
          } else {
            L[0].textContent = 'stop when the node is pure,'; L[0].setAttribute('font-weight', 700);
            if (M) setRich(L[1], [['■ limit', C.accent, 1], ': depth ' + LIMIT + ' reached,']); else L[1].textContent = 'or at the depth limit (' + LIMIT + '),';
            L[2].textContent = 'or when too few are left.';
            L[3].textContent = ML.leafCount(tree) + ' leaves, ' + pct(CTR[3]) + ' of training right';
          }
        }
        C0.cap(caps[stage]);
      }
    };
  });
  $('featSel').addEventListener('change', (e) => { S.ch4.f = +e.target.value; S.ch4.manual = true; redraw('ch4'); });
  $('thrRange').addEventListener('input', (e) => { S.ch4.t = +e.target.value; S.ch4.manual = true; redraw('ch4'); });
  $('thrBest').addEventListener('click', () => {
    const sc = ML.scanSplits(D.X, D.y, IDX, 'gini', S.ch4.f);
    S.ch4.t = sc.reduce((a, b) => (b.gain > a.gain ? b : a)).threshold; S.ch4.manual = true; redraw('ch4');
  });

  /* ============================================================
     Chapter 5 - decision boundaries: depth slider, plane and tree side by side
     ============================================================ */
  register('ch5', function (C0) {
    const svg = C0.svg, M = C0.M, A = areas(M), st = S.ch5;
    const pl = makePlane(svg, A.plane.x, A.plane.y, A.plane.s, M);
    const regionG = el('g', {}, svg), cutG = el('g', {}, svg), ptG = el('g', {}, svg), treeG = el('g', {}, svg);
    plotPoints(ptG, pl, D, M ? 2.8 : 4);
    const panel = el('g', {}, svg);
    const L = readout(panel, A, M, 4);
    let shown = -1;
    const stepDepth = [1, 2, 4, 8];
    const caps = [
      'Each region is coloured by the majority label of its examples (hatched = orange).',
      'The second question cuts one region again.',
      'Every cut is horizontal or vertical: one feature per question.',
      'Drag the depth: from depth ' + DEPTH_FULL + ' on, nothing changes (every region is pure).'
    ];
    return {
      render: function (stage, p, q, changed) {
        if (changed && st.stage !== stage) { st.stage = stage; st.manual = false; st.d = stepDepth[stage]; }
        const d = st.d, tree = CT[d];
        ctlState(C0.ctl, true);
        $('depthRange5').value = d; $('depthOut5').textContent = String(d);
        if (shown !== d) {
          shown = d;
          regionG.innerHTML = ''; cutG.innerHTML = ''; treeG.innerHTML = '';
          drawRegions(regionG, tree, pl, M);
          drawCuts(cutG, tree, pl, { w: 3 });
          drawTree(treeG, tree, A.free, M);
        }
        L.forEach((t) => { t.textContent = ''; t.setAttribute('font-weight', 400); });
        L[0].textContent = 'depth ' + d + ': ' + ML.leafCount(tree) + ' regions'; L[0].setAttribute('font-weight', 700);
        L[1].textContent = (M ? 'right: ' : 'training examples right: ') + pct(CTR[d]);
        if (d > DEPTH_FULL) L[2].textContent = M ? 'stopped at depth ' + ML.treeDepth(tree) : 'the tree stopped at depth ' + ML.treeDepth(tree) + ': every region is pure';
        if (d > DEPTH_FULL && M) L[3].textContent = 'every region is pure';
        if (stage === 2) L[M ? 2 : 3].textContent = 'all cuts are axis-parallel';
        C0.cap(caps[stage]);
      }
    };
  });
  $('depthRange5').addEventListener('input', (e) => { S.ch5.d = +e.target.value; S.ch5.manual = true; redraw('ch5'); });

  /* ============================================================
     Chapter 6 - overfitting: noisy data, depth slider, train against fresh accuracy
     ============================================================ */
  register('ch6', function (C0) {
    const svg = C0.svg, M = C0.M, A = areas(M), st = S.ch6;
    const fs = M ? 11 : 12.5;
    const pl = makePlane(svg, A.plane.x, A.plane.y, A.plane.s, M);
    const regionG = el('g', {}, svg), freshG = el('g', {}, svg), ptG = el('g', {}, svg), ringG = el('g', {}, svg);
    plotPoints(ptG, pl, NZ, M ? 2.8 : 4);
    NZ.noisy.forEach((i) => {
      el('circle', { cx: pl.sx(NZ.X[i][0]), cy: pl.sy(NZ.X[i][1]), r: M ? 6.5 : 9, fill: 'none', stroke: C.accent, 'stroke-width': M ? 2 : 2.5 }, ringG);
    });
    plotPoints(freshG, pl, FR, M ? 1.7 : 2.6, { hollow: true, tip: false });
    Array.prototype.forEach.call(freshG.children, (g) => { g.setAttribute('opacity', 0.85); g.style.pointerEvents = 'none'; });
    /* chart of accuracy against depth, in the free area */
    const gg = el('g', {}, svg);
    const chx = A.free.x + (M ? 50 : 52), chy = A.free.y + (M ? 24 : 34), chw = A.free.w - (M ? 60 : 66), chh = M ? 190 : A.free.h - 110;
    const ch = makeChart(gg, chx, chy, chw, chh, [0.7, 8.3], [0.6, 1], M, {
      xticks: [1, 2, 3, 4, 5, 6, 7, 8], yticks: [0.6, 0.8, 1], xlabel: 'tree depth', ylabel: 'examples right', yfmt: (v) => Math.round(v * 100) + '%', ylabelDx: M ? 40 : 42
    });
    T(gg, chx + chw / 2, chy - (M ? 7 : 10), 'accuracy against depth', fs - 0.5, C.muted, { 'text-anchor': 'middle', 'font-weight': 700 });
    const trainL = el('polyline', { fill: 'none', stroke: C.ink, 'stroke-width': 2.5 }, gg);
    const freshL = el('polyline', { fill: 'none', stroke: C.teal, 'stroke-width': 2.5 }, gg);
    trainL.setAttribute('points', poly([1, 2, 3, 4, 5, 6, 7, 8].map((d) => [ch.sx(d), ch.sy(NTR[d])])));
    freshL.setAttribute('points', poly([1, 2, 3, 4, 5, 6, 7, 8].map((d) => [ch.sx(d), ch.sy(NFR[d])])));
    const trainM = [], freshM = [];
    for (let d = 1; d <= 8; d++) {
      trainM.push(el('circle', { cx: ch.sx(d), cy: ch.sy(NTR[d]), r: M ? 3.4 : 4, fill: C.ink }, gg));
      const s = M ? 3.2 : 3.8;
      freshM.push(el('rect', { x: ch.sx(d) - s, y: ch.sy(NFR[d]) - s, width: 2 * s, height: 2 * s, fill: C.teal }, gg));
    }
    const curV = el('line', { y1: chy, y2: chy + chh, stroke: C.accent, 'stroke-width': 2.5, 'stroke-dasharray': '5 4' }, gg);
    const legX = chx + chw - (M ? 62 : 74), legY = chy + chh - (M ? 30 : 38);
    const trainLab = el('g', {}, gg), freshLab = el('g', {}, gg);
    el('circle', { cx: legX, cy: legY, r: M ? 3.4 : 4, fill: C.ink }, trainLab);
    T(trainLab, legX + 9, legY + 4, 'training', fs - 0.5, C.ink, { 'font-weight': 700 });
    el('rect', { x: legX - (M ? 3.2 : 3.8), y: legY + (M ? 12 : 15) - (M ? 3.2 : 3.8), width: M ? 6.4 : 7.6, height: M ? 6.4 : 7.6, fill: C.teal }, freshLab);
    T(freshLab, legX + 9, legY + (M ? 16 : 19), 'fresh', fs - 0.5, C.teal, { 'font-weight': 700 });
    const bestMk = el('g', {}, gg);
    el('circle', { cx: ch.sx(BEST_DEPTH), cy: ch.sy(NFR[BEST_DEPTH]), r: M ? 8 : 10, fill: 'none', stroke: C.teal, 'stroke-width': 2.5 }, bestMk);
    T(bestMk, ch.sx(BEST_DEPTH), ch.sy(NFR[BEST_DEPTH]) - (M ? 12 : 15), 'best', fs - 0.5, C.teal, { 'text-anchor': 'middle', 'font-weight': 700 });
    const panel = el('g', {}, svg);
    const L = readout(panel, A, M, 4);
    let shown = -1;
    const stepDepth = [SHALLOW, DEEP, DEEP, BEST_DEPTH];
    const caps = [
      cap1(NUMW[NZ.noisy.length]) + ' ringed examples contradict their neighbourhood. A shallow tree ignores them.',
      'The deep tree carves islands around the ringed examples: it memorises the noise.',
      'Hollow shapes are fresh examples the trees never saw.',
      'Training accuracy only rises with depth; fresh accuracy peaks, then falls.'
    ];
    return {
      render: function (stage, p, q, changed) {
        if (changed && st.stage !== stage) { st.stage = stage; st.manual = false; st.d = stepDepth[stage]; }
        const d = st.d, tree = NT[d];
        ctlState(C0.ctl, true);
        $('depthRange6').value = d; $('depthOut6').textContent = String(d);
        if (shown !== d) {
          shown = d;
          regionG.innerHTML = '';
          drawRegions(regionG, tree, pl, M, { alpha: 0.13 });
        }
        const visFresh = stage >= 2 && (st.rev || stage === 3), visTrain = stage >= 1;
        show(freshG, stage >= 2);
        trainL.style.display = trainLab.style.display = visTrain ? '' : 'none';
        freshL.style.display = freshLab.style.display = visFresh ? '' : 'none';
        trainM.forEach((c) => { c.style.display = visTrain ? '' : 'none'; });
        freshM.forEach((c) => { c.style.display = visFresh ? '' : 'none'; });
        show(bestMk, stage === 3);
        curV.setAttribute('x1', ch.sx(d)); curV.setAttribute('x2', ch.sx(d));
        L.forEach((t) => { t.textContent = ''; t.setAttribute('font-weight', 400); });
        L[0].textContent = 'depth ' + d + ': ' + ML.leafCount(tree) + ' regions'; L[0].setAttribute('font-weight', 700);
        L[1].textContent = (M ? 'training: ' : 'training examples right: ') + pct(NTR[d]);
        L[2].textContent = visFresh ? (M ? 'fresh: ' : 'fresh examples right: ') + pct(NFR[d]) : (stage >= 2 ? (M ? 'fresh: ? (guess first)' : 'fresh examples right: ? (guess first)') : '');
        if (visFresh && stage === 3 && d === BEST_DEPTH) L[3].textContent = '← the sweet spot';
        C0.cap(caps[stage]);
      }
    };
  });
  $('depthRange6').addEventListener('input', (e) => { S.ch6.d = +e.target.value; S.ch6.manual = true; redraw('ch6'); });
  predictHooks.ch6 = () => { S.ch6.rev = true; redraw('ch6'); };

  /* ============================================================
     Chapter 7 - random forest (optional)
     ============================================================ */
  register('ch7', function (C0) {
    const svg = C0.svg, M = C0.M, A = areas(M);
    const fs = M ? 11 : 12.5;
    const pl = makePlane(svg, A.plane.x, A.plane.y, A.plane.s, M);
    const voteG = el('g', {}, svg), cutG = el('g', {}, svg), ptG = el('g', {}, svg);
    const pts = plotPoints(ptG, pl, NZ, M ? 2.8 : 4);
    /* vote map cells */
    const GN = M ? 20 : 30, cells = [];
    for (let gx = 0; gx < GN; gx++) for (let gy = 0; gy < GN; gy++) {
      const c = [(gx + 0.5) / GN * 10, (gy + 0.5) / GN * 10];
      cells.push({ el: el('rect', { x: pl.sx(gx / GN * 10), y: pl.sy((gy + 1) / GN * 10), width: pl.s / GN + 0.4, height: pl.s / GN + 0.4, 'fill-opacity': 0 }, voteG), votes: FOREST.trees.map((t) => ML.predict(t, c).label) });
    }
    const freshAccK = [];
    for (let k = 1; k <= FOREST.trees.length; k++) freshAccK.push(ML.forestAccuracy({ trees: FOREST.trees.slice(0, k) }, FR.X, FR.y));
    const histG = el('g', {}, svg), miniG = el('g', {}, svg), accG = el('g', {}, svg);
    const panel = el('g', {}, svg);
    const L = readout(panel, A, M, 4);
    /* stage 0: how often was each example drawn */
    const histBars = [];
    const hx = A.free.x + (M ? 34 : 36), hy = A.free.y + (M ? 24 : 34), hw = A.free.w - (M ? 46 : 52), hh = M ? 170 : A.free.h - 130;
    const hch = makeChart(histG, hx, hy, hw, hh, [-0.5, 4.5], [0, 30], M, { xticks: [0, 1, 2, 3, 4], xfmt: (v) => (v === 4 ? '4+' : String(v)), yticks: [0, 10, 20, 30], xlabel: 'times drawn', ylabel: 'examples', ylabelDx: M ? 26 : 30 });
    T(histG, hx + hw / 2, hy - (M ? 7 : 10), M ? 'draws per example' : 'how often each example was drawn', fs - 0.5, C.muted, { 'text-anchor': 'middle', 'font-weight': 700 });
    for (let k = 0; k < 5; k++) histBars.push({ r: el('rect', { fill: k === 0 ? C.grey : C.blue }, histG), t: T(histG, 0, 0, '', fs - 1, C.ink, { 'text-anchor': 'middle', 'font-weight': 700 }) });
    /* stage 1: five small planes with the boundary of each tree */
    const ncols = M ? 3 : 2, ms = M ? 58 : 84, mgapX = (A.free.w - ncols * ms) / (ncols - 1), mrow = ms + (M ? 34 : 40);
    FOREST.trees.slice(0, NMINI).forEach((tree, i) => {
      const x = A.free.x + (i % ncols) * (ms + mgapX), y = A.free.y + (M ? 22 : 26) + Math.floor(i / ncols) * mrow;
      const g = el('g', {}, miniG);
      const mp = makePlane(g, x, y, ms, M, { noTitles: true });
      mp.g.querySelectorAll('text').forEach((t) => t.remove());
      drawRegions(g, tree, mp, M, { alpha: 0.16 });
      T(g, x + ms / 2, y - 5, 'tree ' + (i + 1), fs - 1, C.muted, { 'text-anchor': 'middle', 'font-weight': 700 });
      T(g, x + ms / 2, y + ms + (M ? 13 : 16), pct(ML.accuracy(tree, FR.X, FR.y)) + ' fresh', fs - 1, C.teal, { 'text-anchor': 'middle', 'font-weight': 700 });
    });
    /* stage 2: fresh accuracy of the vote against the number of trees */
    const ax = A.free.x + (M ? 38 : 46), ay = A.free.y + (M ? 24 : 34), aw = A.free.w - (M ? 50 : 62), ah = M ? 170 : A.free.h - 130;
    const ach = makeChart(accG, ax, ay, aw, ah, [1, 25], [0.7, 1], M, { xticks: [1, 5, 10, 15, 20, 25], yticks: [0.7, 0.85, 1], yfmt: (v) => Math.round(v * 100) + '%', xlabel: 'trees in the forest', ylabel: 'fresh right', ylabelDx: M ? 36 : 42 });
    T(accG, ax + aw / 2, ay - (M ? 7 : 10), 'fresh accuracy of the vote', fs - 0.5, C.muted, { 'text-anchor': 'middle', 'font-weight': 700 });
    el('polyline', { points: poly(freshAccK.map((v, i) => [ach.sx(i + 1), ach.sy(v)])), fill: 'none', stroke: C.teal, 'stroke-width': 2.5 }, accG);
    el('line', { x1: ax, x2: ax + aw, y1: ach.sy(NFR[8]), y2: ach.sy(NFR[8]), stroke: C.ink, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, accG);
    T(accG, ax + aw - 3, ach.sy(NFR[8]) + (M ? 13 : 16), 'one deep tree', fs - 1, C.ink, { 'text-anchor': 'end', 'font-weight': 700 });
    const accMark = el('circle', { r: M ? 5 : 6.5, fill: C.teal, stroke: '#fff', 'stroke-width': 2 }, accG);
    const caps = [
      'Each tree gets its own bootstrap sample: some examples twice or more, some not at all.',
      cap1(NUMW[NMINI]) + ' trees from ' + NUMW[NMINI] + ' samples: similar, but not identical.',
      'Majority vote of the first k trees; shade = how one-sided the vote is.'
    ];
    return {
      render: function (stage, p, q, changed) {
        const rng = ML.mulberry32(100 + S.ch7.seed);
        const k = S.ch7.k;
        $('treesRange').value = k; $('treesOut').textContent = k + ' of ' + FOREST.trees.length;
        ctlState(C0.ctl, true);
        setOn(['bootBtn'], stage === 0); setOn(['treesRange'], stage === 2);
        show(histG, stage === 0); show(miniG, stage === 1); show(accG, stage === 2);
        show(voteG, stage === 2); show(cutG, stage === 1);
        L.forEach((t) => { t.textContent = ''; t.setAttribute('font-weight', 400); });
        if (stage === 0) {
          const bag = ML.bootstrap(NZ.n, rng), cnt = new Array(NZ.n).fill(0);
          bag.forEach((i) => { cnt[i]++; });
          pts.forEach((g, i) => {
            place(g, pl.sx(NZ.X[i][0]), pl.sy(NZ.X[i][1]), cnt[i] === 0 ? 0.9 : 0.8 + 0.45 * Math.min(cnt[i], 3));
            g.shape.setAttribute('fill-opacity', cnt[i] === 0 ? 0.3 : 1);
            g.shape.setAttribute('stroke', cnt[i] === 0 ? C.muted : '#fff');
            g.shape.setAttribute('stroke-dasharray', cnt[i] === 0 ? '2 2' : 'none');
            g.shape.setAttribute('stroke-width', cnt[i] === 0 ? 1.4 : 1);
          });
          const bins = [0, 0, 0, 0, 0];
          cnt.forEach((c) => { bins[Math.min(c, 4)]++; });
          const bw = hch.sx(0.4) - hch.sx(-0.4);
          bins.forEach((b, i) => {
            const r = histBars[i];
            r.r.setAttribute('x', hch.sx(i) - bw / 2); r.r.setAttribute('width', bw);
            r.r.setAttribute('y', hch.sy(b)); r.r.setAttribute('height', hch.sy(0) - hch.sy(b));
            r.t.setAttribute('x', hch.sx(i)); r.t.setAttribute('y', hch.sy(b) - 3); r.t.textContent = String(b);
          });
          L[0].textContent = NZ.n + ' draws with replacement'; L[0].setAttribute('font-weight', 700);
          L[1].textContent = (NZ.n - bins[0]) + ' different examples used';
          L[2].textContent = bins[0] + ' left out (' + pct(bins[0] / NZ.n) + ')';
          L[3].textContent = 'in the long run: ' + pct(ML.outOfBagChance(NZ.n));
        } else {
          pts.forEach((g, i) => {
            place(g, pl.sx(NZ.X[i][0]), pl.sy(NZ.X[i][1]), 1);
            g.shape.setAttribute('fill-opacity', 1); g.shape.setAttribute('stroke', '#fff'); g.shape.setAttribute('stroke-dasharray', 'none'); g.shape.setAttribute('stroke-width', 1);
          });
        }
        if (stage === 1) {
          cutG.innerHTML = '';
          FOREST.trees.slice(0, NMINI).forEach((tree) => drawCuts(cutG, tree, pl, { w: 1.6, opacity: 0.35 }));
          L[0].textContent = NUMW[NMINI] + ' trees, ' + NUMW[NMINI] + ' samples'; L[0].setAttribute('font-weight', 700);
          L[1].textContent = M ? 'one random feature per question' : 'each question looks at one random feature';
          L[2].textContent = M ? 'plane: all sets of cuts' : 'on the plane: all the sets of cuts at once';
        }
        if (stage === 2) {
          cells.forEach((c) => {
            let v1 = 0;
            for (let t = 0; t < k; t++) v1 += c.votes[t];
            const lab = v1 * 2 > k ? 1 : 0, strength = Math.abs(2 * v1 - k) / k;
            c.el.setAttribute('fill', lab === 1 ? hatch(svg) : C.blue);
            c.el.setAttribute('fill-opacity', lab === 1 ? 0.25 + 0.75 * strength : 0.08 + 0.3 * strength);
          });
          accMark.setAttribute('cx', ach.sx(k)); accMark.setAttribute('cy', ach.sy(freshAccK[k - 1]));
          L[0].textContent = k + ' tree' + (k > 1 ? 's' : '') + ' voting'; L[0].setAttribute('font-weight', 700);
          L[1].textContent = (M ? 'fresh right: ' : 'fresh examples right: ') + pct(freshAccK[k - 1]);
          L[2].textContent = 'one deep tree: ' + pct(NFR[8]);
        }
        C0.cap(caps[stage]);
      }
    };
  });
  $('bootBtn').addEventListener('click', () => { S.ch7.seed++; redraw('ch7'); });
  $('treesRange').addEventListener('input', (e) => { S.ch7.k = +e.target.value; redraw('ch7'); });

  /* ============================================================
     Chapter 8 - AdaBoost (going further)
     ============================================================ */
  register('ch8', function (C0) {
    const svg = C0.svg, W = C0.W, M = C0.M, st = S.ch8;
    const fs = M ? 11 : 12.5;
    const x0 = M ? 38 : 56, x1 = M ? 362 : 612;
    const ax = (v) => x0 + (v / 10) * (x1 - x0);
    const bandT = M ? 28 : 46, bandB = M ? 112 : 250, topY = bandT + (bandB - bandT) * 0.27, botY = bandT + (bandB - bandT) * 0.73;
    const bandG = el('g', {}, svg), lineG = el('g', {}, svg), ptG = el('g', {}, svg), infoG = el('g', {}, svg), fG = el('g', {}, svg);
    const bandL = el('rect', { y: bandT, height: bandB - bandT, 'fill-opacity': 0.14 }, bandG);
    const bandR = el('rect', { y: bandT, height: bandB - bandT, 'fill-opacity': 0.14 }, bandG);
    const bandLg = T(bandG, 0, 0, '', fs, C.ink, { 'font-weight': 700 }), bandRg = T(bandG, 0, 0, '', fs, C.ink, { 'font-weight': 700 });
    el('line', { x1: x0, x2: x1, y1: (topY + botY) / 2, y2: (topY + botY) / 2, stroke: C.line, 'stroke-width': 2 }, lineG);
    T(lineG, x0, bandT - 7, '+1 (orange diamonds)', fs, C.orangeText, { 'font-weight': 700 });
    T(lineG, x0, bandB + (M ? 28 : 34), '−1 (blue circles)', fs, C.blue, { 'font-weight': 700 });
    for (let i = 0; i <= 10; i += 2) T(lineG, ax(i), bandB + (M ? 14 : 17), String(i), fs - 0.5, C.muted, { 'text-anchor': 'middle', 'class': 'mono' });
    T(lineG, x1, bandB + (M ? 28 : 34), 'feature x', fs, C.muted, { 'text-anchor': 'end' });
    const stumpL = el('line', { y1: bandT, y2: bandB, stroke: C.accent, 'stroke-width': 3.5 }, lineG);
    let cur = null;
    const pts = LINE.xs.map((x, i) => {
      const g = mkGlyph(ptG, LINE.ys[i] === 1 ? 1 : 0, M ? 5 : 7);
      bindTip(g, () => '<b>Example ' + (i + 1) + '</b><br>x = ' + x.toFixed(1) + ', label ' + (LINE.ys[i] === 1 ? '+1' : '−1') + '<br>weight now: ' + (cur ? f3(cur[i]) : '—'));
      return g;
    });
    const ringE = LINE.xs.map(() => el('circle', { fill: 'none', stroke: C.accent, 'stroke-width': 2.5, r: 0 }, ptG));
    const info = mathBox(infoG, M ? 8 : 40, M ? 150 : 296, M ? 364 : 570, 34, 'c');
    /* F(x) chart */
    const fx = x0, fy = M ? 204 : 366, fw = x1 - x0, fh = M ? 80 : 128;
    const fch = makeChart(fG, fx, fy, fw, fh, [0, 10], [-1, 1], M, { xticks: [0, 2, 4, 6, 8, 10], yticks: [-1, 0, 1], xlabel: 'feature x', ylabel: 'total vote', yfmt: (v) => String(v), ylabelDx: M ? 26 : 34 });
    const fpos = el('path', { fill: C.orange, 'fill-opacity': 0.28, stroke: 'none' }, fG), fneg = el('path', { fill: C.blue, 'fill-opacity': 0.28, stroke: 'none' }, fG);
    const fLine = el('polyline', { fill: 'none', stroke: C.ink, 'stroke-width': 2.5 }, fG);
    el('line', { x1: fx, x2: fx + fw, y1: fch.sy(0), y2: fch.sy(0), stroke: C.muted, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, fG);
    T(fG, fx + 6, fch.sy(1) + (M ? 12 : 15), '+1 side', fs - 1, C.orangeText, { 'font-weight': 700 });
    T(fG, fx + 6, fch.sy(-1) - 5, '−1 side', fs - 1, C.blue, { 'font-weight': 700 });
    /* stages 1 and 2: the weight of every example as a bar, aligned with the points above */
    const wG = el('g', {}, svg);
    const wch = makeChart(wG, fx, fy, fw, fh, [0, 10], [0, 0.5], M, { xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 0.25, 0.5], xlabel: 'feature x', ylabel: 'weight', yfmt: (v) => Math.round(v * 100) + '%', ylabelDx: M ? 27 : 38 });
    const wBars = LINE.xs.map((x, i) => el('rect', { fill: LINE.ys[i] === 1 ? C.orange : C.blue, 'fill-opacity': 0.85, width: M ? 9 : 14 }, wG));
    const wTxt = T(wG, fx + fw - 4, fy + (M ? 12 : 16), '', fs - 0.5, C.ink, { 'text-anchor': 'end', 'font-weight': 700 });
    const caps = [
      'One feature on a line. ' + cap1(NUMW[LINE.outliers.length]) + ' ringed examples sit on the wrong side.',
      'Round 1: the best single question (a stump) and the examples it gets wrong (ringed).',
      'After the update the mistakes are heavier (bigger shapes).',
      ''
    ];
    return {
      render: function (stage, p, q, changed) {
        if (changed && st.stage !== stage) { st.stage = stage; st.manual = false; st.r = stage === 3 ? ROUNDS : 1; }
        const r = st.r, h = ADA.history[r - 1];
        ctlState(C0.ctl, stage >= 1);
        $('roundRange').max = ROUNDS; $('roundRange').value = r; $('roundOut').textContent = stage === 0 ? '—' : r + ' of ' + ROUNDS;
        const w = stage === 0 ? LINE.xs.map(() => 1 / LINE.n) : stage === 1 ? h.weightsBefore : h.weights;
        cur = w;
        pts.forEach((g, i) => { place(g, ax(LINE.xs[i]), LINE.ys[i] === 1 ? topY : botY, Math.sqrt(w[i] * LINE.n)); });
        ringE.forEach((c, i) => {
          const on = (stage === 0 && LINE.outliers.indexOf(i) !== -1) || (stage === 1 && h.wrong.indexOf(i) !== -1);
          c.setAttribute('cx', ax(LINE.xs[i])); c.setAttribute('cy', LINE.ys[i] === 1 ? topY : botY); c.setAttribute('r', on ? (M ? 11 : 15) : 0);
        });
        const showBand = stage >= 1 && stage < 3;
        show(bandG, showBand); stumpL.style.display = showBand ? '' : 'none';
        if (showBand) {
          const s = h.stump, tx = ax(s.threshold);
          stumpL.setAttribute('x1', tx); stumpL.setAttribute('x2', tx);
          const rightLab = s.polarity === 1 ? 1 : 0, leftLab = 1 - rightLab;
          bandL.setAttribute('x', x0); bandL.setAttribute('width', tx - x0); bandL.setAttribute('fill', leftLab === 1 ? C.orange : C.blue);
          bandR.setAttribute('x', tx); bandR.setAttribute('width', x1 - tx); bandR.setAttribute('fill', rightLab === 1 ? C.orange : C.blue);
          bandLg.setAttribute('x', x0 + 6); bandLg.setAttribute('y', bandB - 6); bandLg.textContent = 'stump says ' + GLYPH[leftLab] + ' ' + (leftLab ? '+1' : '−1');
          bandRg.setAttribute('x', x1 - 6); bandRg.setAttribute('y', bandB - 6); bandRg.setAttribute('text-anchor', 'end'); bandRg.textContent = 'stump says ' + GLYPH[rightLab] + ' ' + (rightLab ? '+1' : '−1');
        }
        show(infoG, stage >= 1); show(fG, stage === 3); show(wG, stage === 1 || stage === 2);
        if (stage === 1 || stage === 2) {
          const wr = new Set(h.wrong);
          wBars.forEach((b, i) => {
            const bh = wch.sy(0) - wch.sy(Math.min(w[i], 0.5));
            b.setAttribute('x', ax(LINE.xs[i]) - (M ? 4.5 : 7)); b.setAttribute('y', wch.sy(Math.min(w[i], 0.5))); b.setAttribute('height', bh);
            b.setAttribute('stroke', wr.has(i) ? C.accent : 'none'); b.setAttribute('stroke-width', wr.has(i) ? 2.5 : 0);
          });
          wTxt.textContent = stage === 1 ? 'weights before round ' + r : 'weights after round ' + r;
        }
        if (stage >= 1) setTex(info, '\\text{round }' + r + ':\\ \\varepsilon=' + f2(h.err) + ',\\ \\ \\alpha=\\tfrac12\\ln\\tfrac{1-\\varepsilon}{\\varepsilon}=' + f2(h.alpha));
        let cap = caps[stage];
        if (stage === 3) {
          const model = { stumps: ADA.stumps.slice(0, r) };
          let maxF = 1e-9; const Fs = [];
          for (let k = 0; k <= 200; k++) { const v = ML.adaboostF(model, k / 20); Fs.push([k / 20, v]); maxF = Math.max(maxF, Math.abs(v)); }
          const pts2 = Fs.map((o) => [fch.sx(o[0]), fch.sy(o[1] / maxF)]);
          fLine.setAttribute('points', poly(pts2));
          const zero = fch.sy(0);
          const area = (sign) => 'M ' + fx + ' ' + zero + ' ' + pts2.map((pp, k) => 'L ' + pp[0] + ' ' + (Fs[k][1] * sign > 0 ? pp[1] : zero)).join(' ') + ' L ' + (fx + fw) + ' ' + zero + ' Z';
          fpos.setAttribute('d', area(1)); fneg.setAttribute('d', area(-1));
          const errs = h.ensembleWrong.length;
          cap = errs === 0 ? 'After ' + r + ' round' + (r > 1 ? 's' : '') + ' no training example is wrong.' : 'After ' + r + ' round' + (r > 1 ? 's' : '') + ', ' + errs + ' of ' + LINE.n + ' examples are still wrong.';
        }
        C0.cap(cap);
      }
    };
  });
  $('roundRange').addEventListener('input', (e) => { S.ch8.r = +e.target.value; S.ch8.manual = true; redraw('ch8'); });

  /* ============================================================
     Chapter 9 - recap, and the way back to language
     ============================================================ */
  register('ch9', function (C0) {
    /* the recap text lives in ordinary HTML cards (normal flow, so it can never overlap);
       the svg above only carries a small flow diagram */
    const svg = C0.svg, W = C0.W, M = C0.M;
    const H9 = M ? 62 : 150;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H9);
    const items = [['text', 'a sentence'], ['numbers', 'measurements'], ['tree', 'questions'], ['language', 'the answer']];
    const cy = M ? 22 : 56, r = M ? 15 : 28, x0 = W * 0.13, dx = W * 0.245;
    items.forEach((it, i) => {
      const x = x0 + i * dx;
      if (i < 3) {
        el('line', { x1: x + r + 4, y1: cy, x2: x + dx - r - 12, y2: cy, stroke: C.grey, 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
        el('path', { d: 'M ' + (x + dx - r - 3) + ' ' + cy + ' l -9 -6 l 0 12 z', fill: C.grey }, svg);
      }
      el('circle', { cx: x, cy: cy, r: r, fill: i === 2 ? C.accent : '#fff', stroke: C.accent, 'stroke-width': 3 }, svg);
      T(svg, x, cy + (M ? 5 : 9), String(i + 1), M ? 15 : 26, i === 2 ? '#fff' : C.accent, { 'text-anchor': 'middle', 'font-weight': 800 });
      T(svg, x, cy + r + (M ? 15 : 24), it[0], M ? 11 : 16, C.ink, { 'text-anchor': 'middle', 'font-weight': 700 });
      if (!M) T(svg, x, cy + r + 44, it[1], 13, C.muted, { 'text-anchor': 'middle' });
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
    const recG = document.createElement('div'), nbG = document.createElement('div');
    recG.className = nbG.className = 'rgroup';
    recG.appendChild(card('', '1', 'Ask the question with the best gain', '\\text{feature }1\\le ' + f2(NODE_ROOT.threshold) + '\\ \\Rightarrow\\ \\text{gain}=' + f3(NODE_ROOT.gain), 'the cut that leaves both sides cleanest'));
    recG.appendChild(card('', '2', 'Repeat on each side', null, 'until pure, or the depth limit, or too few examples'));
    recG.appendChild(card('warn', '!', 'Do not go too deep', null, 'depth ' + BEST_DEPTH + ' scored ' + pct(NFR[BEST_DEPTH]) + ' on fresh examples; depth 8 only ' + pct(NFR[8])));
    nbG.appendChild(card('', '→', 'Text becomes numbers', null, 'vowel ratio, average word length, counts of clusters such as sch or th'));
    nbG.appendChild(card('good', '✓', 'Good fit for trees', null, 'small data, mixed kinds of measurements, and answers you must explain'));
    nbG.appendChild(card('warn', '!', 'Poor fit for trees', null, 'many tiny signals (every word of a text), where a forest or other models do better'));
    panel.appendChild(recG); panel.appendChild(nbG);
    const caps = ['The three ideas of this page.', 'From the toy plane to the language-identification exercise.'];
    return {
      render: function (stage) {
        C0.ctl.classList.remove('on');
        show(recG, stage === 0); show(nbG, stage === 1);
        C0.cap(caps[stage]);
      }
    };
  });

  update();
})();
