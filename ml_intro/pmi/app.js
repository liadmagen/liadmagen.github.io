/* Scroll-driven visual introduction to PMI.
   All numbers come from pmi-math.js (window.PMIM); all formulas are rendered with the
   vendored KaTeX. No other libraries, no build step. */
(function () {
  'use strict';
  const PM = window.PMIM;
  if (!PM) { console.error('pmi-math.js did not load'); return; }

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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
  const show = (g, on) => { g.style.display = on ? '' : 'none'; };
  /* controls stay in place (no layout jump); they are just disabled and dimmed when not relevant */
  function ctlState(ctl, enabled) {
    ctl.classList.add('on');
    ctl.classList.toggle('off', !enabled);
    Array.prototype.forEach.call(ctl.querySelectorAll('input,button,select'), (n) => { n.disabled = !enabled; });
  }
  function sgn(v, d) {
    if (v === -Infinity) return MINUS + '∞';
    if (Number.isNaN(v)) return 'n/a';
    const s = Math.abs(v).toFixed(d === undefined ? 2 : d);
    return (v > 0 ? '+' : v < 0 && Number(s) !== 0 ? MINUS : '') + s;
  }
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* palette: blue = seen / more than chance, orange = less than chance, grey = chance */
  const C = {
    ink: '#1d2733', muted: '#55636f', line: '#e5e1d8', card: '#ffffff',
    blue: '#1f6fd1', blueSoft: '#dbe8fa', orange: '#d9730d', orangeSoft: '#fbe6d0',
    grey: '#7d8894', greySoft: '#e9e6dd', neutral: '#f4f2ec', teal: '#0f8a8a', accent: '#6d5bd0'
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
  function mathBox(parent, x, y, w, h, cls) {
    const fo = el('foreignObject', { x: x, y: y, width: w, height: h }, parent);
    const d = document.createElement('div');
    d.className = 'svgmath ' + (cls || '');
    fo.appendChild(d);
    return d;
  }

  /* ------------------------------------------------------------------ data (all from pmi-math.js) */
  const CO = PM.buildCooccurrence();
  const VOCAB = CO.vocab, F = CO.F, N = CO.N, IDX = CO.index;
  const RS = PM.rowSums(F);
  const PMI_M = PM.pmiMatrix(F);
  const PAIRS_P = PM.topPairs(F, VOCAB, 0, 'pmi');
  const PAIRS_C = PM.topPairs(F, VOCAB, 0, 'count');
  const MIN2 = PM.topPairs(F, VOCAB, 0, 'count', 2);
  const MI = PM.mutualInformation(F);
  const DIE = PM.dieExample();
  const stat = (a, b) => PM.pairStats(F, VOCAB, IDX[a], IDX[b]);
  const TS = stat('tea', 'strong'), TP = stat('tea', 'powerful'), TC = stat('tea', 'coffee');
  const SHUF_T = 300;
  const TR = (function () {
    const rng = PM.mulberry32(11), arrs = [], cnts = [];
    for (let t = 0; t < SHUF_T; t++) {
      const a = PM.shuffledPairs(F, rng);
      arrs.push(a); cnts.push(PM.countPairIn(a, IDX.tea, IDX.strong));
    }
    return { arrs: arrs, cnts: cnts };
  })();
  /* smoothing: the rarer word of the pair is the "context" word */
  function smoothed(a, b) {
    let x = IDX[a], y = IDX[b];
    if (RS[x] < RS[y]) { const t = x; x = y; y = t; }
    return PM.pmiSmoothed(F, x, y, 0.75);
  }
  const pairName = (p) => p.a + ' × ' + p.b;
  function pairTip(p) {
    return '<b>' + pairName(p) + '</b><br>seen ' + p.f + ' · expected ' + p.expected.toFixed(2) +
      '<br>PMI ' + (p.f > 0 ? sgn(p.pmi) + ' bits' : MINUS + '∞ (never seen)');
  }

  /* ------------------------------------------------------------------ prose placeholders {{key args}} */
  function val(spec) {
    let a = spec.trim().split(/\s+/);
    let tex = false;
    if (a[0].indexOf('t:') === 0) { tex = true; a[0] = a[0].slice(2); }
    let out;
    switch (a[0]) {
      case 'nsent': out = String(CO.nSentences); break;
      case 'nvocab': out = String(VOCAB.length); break;
      case 'win': out = String(CO.windowSize); break;
      case 'pairs': out = String(CO.pairs); break;
      case 'N': out = String(N); break;
      case 'cnt': out = String(RS[IDX[a[1]]]); break;
      case 'share': out = (RS[IDX[a[1]]] / N * 100).toFixed(1) + '%'; break;
      case 'count': out = String(stat(a[1], a[2]).f); break;
      case 'exp': out = stat(a[1], a[2]).expected.toFixed(2); break;
      case 'ratio': out = stat(a[1], a[2]).ratio.toFixed(2); break;
      case 'pmi': out = sgn(stat(a[1], a[2]).pmi); break;
      case 'smooth': out = sgn(smoothed(a[1], a[2])); break;
      case 'mi': out = MI.toFixed(2); break;
      case 'nmin2': out = String(MIN2.length); break;
      case 'dieratio': out = String(Math.round(DIE.ratio)); break;
      case 'diepmi': out = DIE.pmi.toFixed(2); break;
      case 'shuftrials': out = String(SHUF_T); break;
      case 'shufhit': {
        const n = TR.cnts.filter((c) => c >= TS.f).length;
        out = n === 0 ? 'none' : String(n); break;
      }
      case 'partners': {
        const w = a[1], k = Number(a[2]) || 3;
        out = PAIRS_C.filter((p) => p.a === w || p.b === w).slice(0, k)
          .map((p) => (p.a === w ? p.b : p.a) + ' ×' + p.f).join(', ');
        break;
      }
      default: console.warn('unknown placeholder', spec); out = '?';
    }
    return tex ? out.split(MINUS).join('-') : out;
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
  Array.prototype.forEach.call(document.querySelectorAll('.predict'), (box) => {
    const rv = box.querySelector('.reveal');
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
  function bindTip(node, fn) {
    node.classList.add('hit');
    node.addEventListener('pointerenter', (e) => tipShow(fn(), e));
    node.addEventListener('pointermove', tipMove);
    node.addEventListener('pointerleave', tipHide);
    node.addEventListener('click', (e) => { tipShow(fn(), e); clearTimeout(tipT); tipT = setTimeout(tipHide, 2800); });
  }
  window.addEventListener('scroll', tipHide, { passive: true });

  /* ------------------------------------------------------------------ colours for matrices */
  const PMI_ABS_MAX = 3.2;
  function pmiColor(v, hatch) {
    if (Number.isNaN(v)) return '#e3e0d6';
    if (v === -Infinity) return hatch;
    const t = Math.pow(clamp(Math.abs(v) / PMI_ABS_MAX, 0, 1), 0.8);
    return v > 0 ? mix(C.neutral, C.blue, t) : v < 0 ? mix(C.neutral, C.orange, t) : C.neutral;
  }
  function hatchDefs(svg, id) {
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: id, width: 7, height: 7, patternTransform: 'rotate(45)', patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: 7, height: 7, fill: '#f6f4ee' }, pat);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#aaa397', 'stroke-width': 1.6 }, pat);
  }

  /* ------------------------------------------------------------------ scroll engine */
  const mq = window.matchMedia('(max-width: 920px)');
  const chapters = [];
  function register(id, build) {
    const chEl = document.getElementById(id);
    const n = id.replace('ch', '');
    chapters.push({
      el: chEl, id: id, build: build,
      svg: document.getElementById('viz' + n), cap: document.getElementById('cap' + n), ctl: document.getElementById('ctl' + n),
      steps: Array.prototype.slice.call(chEl.querySelectorAll('.step')),
      inst: null, stage: -1, p: -1, q: 0, capHtml: null
    });
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
      },
      redraw: function () { draw(ch, ch.stage, ch.p, ch.q, true); }
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
    chapters.forEach((ch) => {
      const r = ch.el.getBoundingClientRect();
      const near = r.bottom > -vh * 0.5 && r.top < vh * 1.5;
      if (!near && ch.inst) return;
      // on narrow screens the figure is pinned to the top, so a step "arrives" lower on the screen
      const trig = mq.matches ? ({ ch3: 0.66, ch4: 0.68, ch6: 0.66, ch7: 0.7 }[ch.id] || 0.6) : 0.5;
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

  /* shared: heat-map geometry used by chapter 5 */
  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  /* ============================================================
     Chapter 1 - the corpus, the window, the tally
     ============================================================ */
  register('ch1', function (C0) {
    const svg = C0.svg, W = C0.W, H = C0.H, M = C0.M;
    const sents = PM.CORPUS.map(PM.tokenize), nS = sents.length;
    const demoText = 'she drinks strong tea every morning';
    const demo = PM.CORPUS.indexOf(demoText);
    const tracked = new Set(VOCAB);
    const VIS = M ? 6 : nS, rowH = M ? 25 : 21, fs = M ? 15 : 13.5, cw = fs * 0.602;
    const x0 = M ? 10 : 14, y0 = M ? 22 : 60;
    const wCol = 300;

    const listG = el('g', {}, svg), tallyG = el('g', {}, svg), zoomG = el('g', {}, svg);
    if (!M) T(listG, x0, 34, 'the corpus, one sentence per line', 13, C.muted, { 'font-weight': 700 });
    const rows = sents.map((toks, s) => {
      const g = el('g', { 'class': 'anim' }, listG);
      const hl = el('rect', { x: x0 - 6, y: -fs, width: wCol, height: rowH - 2, rx: 5, fill: C.blueSoft, opacity: 0 }, g);
      let off = 0;
      toks.forEach((t) => {
        const x = x0 + off * cw;
        if (tracked.has(t)) el('rect', { x: x - 2, y: -fs + 1, width: t.length * cw + 4, height: fs + 5, rx: 4, fill: C.blueSoft, stroke: '#b7d0f2' }, g);
        T(g, x, 0, t, fs, tracked.has(t) ? C.ink : '#68737e', { 'class': 'mono', 'font-weight': tracked.has(t) ? 700 : 400 });
        off += t.length + 1;
      });
      return { g: g, hl: hl };
    });
    const moreTxt = T(listG, x0, y0 + VIS * rowH + 4, '', 13, C.muted);

    /* tally */
    const partners = PAIRS_C.filter((p) => p.a === 'tea' || p.b === 'tea');
    const tx = M ? 10 : 346, ty0 = M ? y0 + VIS * rowH + 34 : 96;
    const trH = M ? 15 : 34, barX = tx + (M ? 120 : 150), barMax = (M ? 380 : 640) - tx - (M ? 120 : 150) - 44, bh = M ? 11 : 16, tfs = M ? 13 : 14;
    const tTitle = T(tallyG, tx, ty0 - (M ? 14 : 30), '', M ? 13 : 14, C.ink, { 'font-weight': 700 });
    const maxC = partners[0].f;
    const tRows = partners.map((p, k) => {
      const w = p.a === 'tea' ? p.b : p.a, y = ty0 + k * trH;
      T(tallyG, tx, y + bh - 2, 'tea × ' + w, tfs, C.ink);
      const bar = el('rect', { x: barX, y: y, width: 0, height: bh, rx: 3, fill: C.blue }, tallyG);
      const num = T(tallyG, barX + 6, y + bh - 2, '0', tfs, C.ink, { 'class': 'mono', 'font-weight': 700 });
      return { w: w, bar: bar, num: num };
    });

    /* zoom card (step 2): one sentence up close */
    const bigFs = M ? 15.5 : 23, bcw = bigFs * 0.602;
    const cardY = M ? 8 : 46, cardH = H - cardY - 10;
    el('rect', { x: 8, y: cardY, width: W - 16, height: cardH, rx: 12, fill: C.card, stroke: C.line }, zoomG);
    T(zoomG, W / 2, cardY + 28, 'one sentence, up close', M ? 13 : 14, C.muted, { 'text-anchor': 'middle', 'font-weight': 700 });
    const dToks = sents[demo], total = demoText.length, sx = (W - total * bcw) / 2, yb = cardY + (M ? 150 : 170);
    const dPos = [];
    let doff = 0;
    dToks.forEach((t, i) => { dPos.push({ x: sx + doff * bcw, w: t.length * bcw }); doff += t.length + 1; });
    const dyn = el('g', {}, zoomG);
    dToks.forEach((t, i) => {
      if (tracked.has(t)) el('rect', { x: dPos[i].x - 3, y: yb - bigFs, width: dPos[i].w + 6, height: bigFs + 9, rx: 5, fill: C.blueSoft, stroke: '#b7d0f2' }, zoomG);
      T(zoomG, dPos[i].x, yb, t, bigFs, tracked.has(t) ? C.ink : '#68737e', { 'class': 'mono', 'font-weight': tracked.has(t) ? 700 : 400 });
    });
    const dEvents = PM.pairEvents([demoText], CO.windowSize).sort((a, b) => a.i - b.i || a.j - b.j);
    const dTracked = []; dToks.forEach((t, i) => { if (tracked.has(t)) dTracked.push(i); });

    function drawZoom(k) {
      dyn.innerHTML = '';
      const win = CO.windowSize;
      const focus = dTracked[k];
      if (k >= 0 && focus + 1 < dToks.length) {
        const last = Math.min(dToks.length - 1, focus + win);
        el('rect', { x: dPos[focus + 1].x - 5, y: yb - bigFs - 3, width: dPos[last].x + dPos[last].w - dPos[focus + 1].x + 10, height: bigFs + 16, rx: 6, fill: C.accent, 'fill-opacity': 0.1, stroke: C.accent, 'stroke-dasharray': '5 4' }, dyn);
      }
      if (k >= 0) el('rect', { x: dPos[focus].x - 3, y: yb + 9, width: dPos[focus].w + 6, height: 4, rx: 2, fill: C.accent }, dyn);
      const shown = dEvents.filter((e) => k >= 0 && e.i <= focus);
      shown.forEach((e) => {
        const xa = dPos[e.i].x + dPos[e.i].w / 2, xb = dPos[e.j].x + dPos[e.j].w / 2, h = 22 * (e.j - e.i) + 14;
        const cur = e.i === focus;
        el('path', { d: 'M ' + xa + ' ' + (yb - bigFs - 6) + ' Q ' + (xa + xb) / 2 + ' ' + (yb - bigFs - 6 - h * 2) + ' ' + xb + ' ' + (yb - bigFs - 6), fill: 'none', stroke: C.blue, 'stroke-width': cur ? 3.5 : 2, 'stroke-opacity': cur ? 1 : 0.4, 'stroke-linecap': 'round' }, dyn);
      });
      const ly = yb + (M ? 46 : 70);
      T(dyn, W / 2, ly, shown.length ? 'pairs found so far' : 'pairs found so far: none yet', M ? 13 : 14, C.muted, { 'text-anchor': 'middle' });
      shown.forEach((e, i) => {
        T(dyn, W / 2, ly + (M ? 22 : 28) * (i + 1), dToks[e.i] + ' – ' + dToks[e.j], M ? 15 : 18, C.blue, { 'text-anchor': 'middle', 'font-weight': 700 });
      });
    }

    function tally(done) {
      const counts = {}; let all = 0;
      CO.events.forEach((e) => {
        if (e.s >= done) return;
        all++;
        const a = VOCAB[e.wi], b = VOCAB[e.wj];
        if (a === 'tea') counts[b] = (counts[b] || 0) + 1; else if (b === 'tea') counts[a] = (counts[a] || 0) + 1;
      });
      tRows.forEach((r) => {
        const c = counts[r.w] || 0;
        r.bar.setAttribute('width', c / maxC * barMax);
        r.num.setAttribute('x', barX + 6 + c / maxC * barMax);
        r.num.textContent = String(c);
      });
      tTitle.textContent = 'pairs counted so far: ' + all + ' of ' + CO.pairs;
    }

    const caps = [
      'Highlighted words are the ones we follow. Grey words are filler: never counted, but they take up room.',
      'The dashed box is the window: the next ' + CO.windowSize + ' words. Each followed word inside it forms a pair (an arc).',
      'Bars: how often each word is paired with <i>tea</i>, updating as the sweep moves down the corpus.',
      'Final tally of pairs with <i>tea</i>. Total pairs in the corpus: ' + CO.pairs + '.'
    ];
    return {
      render: function (stage, p, q) {
        C0.ctl.classList.remove('on');
        show(zoomG, stage === 1); show(listG, stage !== 1);
        let done = 0, cur = -1, k = -1;
        if (stage === 1) { k = Math.min(dTracked.length - 1, Math.floor(q * dTracked.length * 0.999)); drawZoom(k); }
        if (stage === 2) { done = Math.ceil(q * nS); cur = done - 1; }
        if (stage === 3) done = nS;
        show(tallyG, stage >= 2);
        tally(done);
        const start = M ? clamp((cur >= 0 ? cur : 0) - 3, 0, nS - VIS) : 0;
        rows.forEach((r, s) => {
          const vis = s >= start && s < start + VIS;
          r.g.setAttribute('transform', 'translate(0,' + (y0 + (s - start) * rowH) + ')');
          r.g.setAttribute('opacity', vis ? (stage === 2 && s > cur ? 0.75 : 1) : 0);
          r.g.style.display = vis ? '' : 'none';
          r.hl.setAttribute('opacity', s === cur ? 1 : 0);
        });
        moreTxt.textContent = M && start + VIS < nS ? '… ' + (nS - start - VIS) + ' more sentences' : '';
        C0.cap(caps[stage]);
      }
    };
  });

  /* ============================================================
     Chapter 2 - counting is not enough: the tea constellation
     ============================================================ */
  register('ch2', function (C0) {
    const svg = C0.svg, W = C0.W, H = C0.H, M = C0.M;
    const cx = W / 2, cy = M ? 160 : 285, R = M ? 100 : 195;
    const parts = PAIRS_C.filter((p) => p.a === 'tea' || p.b === 'tea');
    const n = parts.length;
    const spokeG = el('g', {}, svg), nodeG = el('g', {}, svg);
    const kW = M ? 1.5 : 2.2;
    const nodes = parts.map((pr, i) => {
      const w = pr.a === 'tea' ? pr.b : pr.a;
      const ang = (-90 + i * 360 / n) * Math.PI / 180;
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const nx = cx + R * ux, ny = cy + R * uy;
      const line = el('line', { x1: cx, y1: cy, x2: nx, y2: ny, stroke: C.blue, 'stroke-opacity': 0.75, 'stroke-linecap': 'round' }, spokeG);
      const g = el('g', {}, nodeG);
      const circ = el('circle', { cx: nx, cy: ny, r: 16, fill: '#fff', stroke: C.blue, 'stroke-width': 2.5 }, g);
      const lab = T(g, nx, ny, w, M ? 13 : 14, C.ink, { 'text-anchor': 'middle', 'font-weight': 700 });
      const cnt = T(spokeG, cx + (nx - cx) * 0.52, cy + (ny - cy) * 0.52 + 5, '×' + pr.f, M ? 14 : 16, C.blue, { 'text-anchor': 'middle', 'font-weight': 800, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 5, 'class': 'mono' });
      const nd = { pr: pr, w: w, ux: ux, uy: uy, nx: nx, ny: ny, line: line, g: g, circ: circ, lab: lab, cnt: cnt, c: RS[IDX[w]] };
      bindTip(g, () => pairTip(pr));
      return nd;
    });
    const cg = el('g', {}, svg);
    const hub = el('circle', { cx: cx, cy: cy, r: 24, fill: '#efecfb', stroke: C.accent, 'stroke-width': 3 }, cg);
    const hubLab = T(cg, cx, cy + 5, 'tea', 18, C.accent, { 'text-anchor': 'middle', 'font-weight': 800 });
    const hubCnt = T(cg, cx, cy + 20, '', 13, C.accent, { 'text-anchor': 'middle', 'font-weight': 700 });
    const radius = (c) => 7 + 4.1 * Math.sqrt(c);
    const caps = [
      'Line thickness and the number on it: how often each word is paired with <i>tea</i>. Hover for details.',
      'Circle size: count(<i>x</i>), the number of pairs a word takes part in. Frequent words are big.'
    ];
    return {
      render: function (stage, p, q) {
        C0.ctl.classList.remove('on');
        nodes.forEach((nd, i) => {
          const local = stage === 0 ? rev(q, i, n) : 1;
          const r = stage === 1 ? radius(nd.c) : 17;
          nd.g.setAttribute('opacity', local);
          nd.line.setAttribute('stroke-width', (2 + nd.pr.f * kW) * local);
          nd.cnt.setAttribute('opacity', local > 0.6 ? 1 : 0);
          nd.circ.setAttribute('r', r);
          // word label sits outside the circle
          const off = r + (M ? 14 : 16);
          nd.lab.setAttribute('y', nd.ny + nd.uy * off + 4);
          nd.lab.textContent = stage === 1 ? nd.w + ' · ' + nd.c : nd.w;
          nd.lab.setAttribute('text-anchor', Math.abs(nd.ux) > 0.5 ? (nd.ux > 0 ? 'start' : 'end') : 'middle');
          nd.lab.setAttribute('x', nd.nx + nd.ux * (Math.abs(nd.ux) > 0.5 ? r + 6 : 0));
        });
        hub.setAttribute('r', stage === 1 ? radius(RS[IDX.tea]) : 24);
        hubLab.setAttribute('y', stage === 1 ? cy - 2 : cy + 5); hubLab.textContent = 'tea';
        hubCnt.textContent = stage === 1 ? String(RS[IDX.tea]) : '';
        C0.cap(caps[stage]);
      }
    };
  });

  /* ============================================================
     Chapter 3 - what would chance give?
     ============================================================ */
  register('ch3', function (C0) {
    const svg = C0.svg, W = C0.W, H = C0.H, M = C0.M;
    const TEA = IDX.tea, STR = IDX.strong;
    const wordFill = (w) => (w === TEA ? C.accent : w === STR ? C.teal : C.greySoft);
    const cols = 9, cardW = M ? 34 : 58, cardH = M ? 22 : 30, gap = M ? 4 : 8;
    const gx0 = (W - (cols * (cardW + gap) - gap)) / 2, gy0 = M ? 14 : 58;
    const observed = CO.events.map((e) => [e.wi, e.wj]);
    const cardsG = el('g', { 'class': 'anim' }, svg);
    const cards = observed.map((_, k) => {
      const x = gx0 + (k % cols) * (cardW + gap), y = gy0 + Math.floor(k / cols) * (cardH + gap);
      const rect = el('rect', { x: x, y: y, width: cardW, height: cardH, rx: 6, fill: '#fff', stroke: C.line, 'stroke-width': 1.5 }, cardsG);
      const s = M ? 10 : 15, py = y + (cardH - s) / 2;
      const a = el('rect', { x: x + cardW / 2 - s - 3, y: py, width: s, height: s, rx: 3, stroke: '#c9c3b6' }, cardsG);
      const b = el('rect', { x: x + cardW / 2 + 3, y: py, width: s, height: s, rx: 3, stroke: '#c9c3b6' }, cardsG);
      return { rect: rect, a: a, b: b };
    });
    const rowsN = Math.ceil(observed.length / cols), cardsBottom = gy0 + rowsN * (cardH + gap);
    function setCards(arr) {
      cards.forEach((c, k) => {
        const pr = arr[k];
        c.a.setAttribute('fill', wordFill(pr[0])); c.b.setAttribute('fill', wordFill(pr[1]));
        const hit = (pr[0] === TEA && pr[1] === STR) || (pr[0] === STR && pr[1] === TEA);
        c.rect.setAttribute('stroke', hit ? C.blue : C.line);
        c.rect.setAttribute('stroke-width', hit ? 3 : 1.5);
        c.rect.setAttribute('fill', hit ? C.blueSoft : '#fff');
      });
    }
    /* legend + info line under the cards */
    const info = T(svg, W / 2, cardsBottom + (M ? 14 : 24), '', M ? 13 : 15, C.ink, { 'text-anchor': 'middle', 'font-weight': 700 });
    const legG = el('g', {}, svg), ly = cardsBottom + (M ? 30 : 48);
    [['tea', C.accent], ['strong', C.teal], ['any other word', C.greySoft]].forEach((it, i) => {
      const lx = W / 2 + (i - 1) * (M ? 105 : 150) - (M ? 38 : 50);
      el('rect', { x: lx, y: ly - 11, width: 13, height: 13, rx: 3, fill: it[1], stroke: '#c9c3b6' }, legG);
      T(legG, lx + 19, ly, it[0], M ? 12 : 13, C.muted);
    });

    /* histogram of shuffles */
    const histG = el('g', {}, svg);
    const hx0 = M ? 36 : 70, hx1 = W - (M ? 16 : 40), hBase = H - (M ? 40 : 66), hTop = M ? ly + 24 : ly + 36;
    const BINS = 9, bw = (hx1 - hx0) / BINS;
    el('line', { x1: hx0, y1: hBase, x2: hx1, y2: hBase, stroke: C.muted, 'stroke-width': 1.5 }, histG);
    const bars = [];
    for (let b = 0; b < BINS; b++) {
      bars.push(el('rect', { x: hx0 + b * bw + 3, y: hBase, width: bw - 6, height: 0, rx: 3, fill: C.grey, 'fill-opacity': 0.75 }, histG));
      T(histG, hx0 + b * bw + bw / 2, hBase + (M ? 15 : 18), String(b), M ? 13 : 14, C.muted, { 'text-anchor': 'middle', 'class': 'mono' });
    }
    T(histG, (hx0 + hx1) / 2, hBase + (M ? 32 : 40), 'tea + strong pairs in one shuffle', M ? 12 : 13, C.muted, { 'text-anchor': 'middle' });
    const hCount = T(histG, hx0, hTop - 22, '', 14, C.ink, { 'font-weight': 700 });
    const xAt = (v) => hx0 + (v + 0.5) * bw;
    const expLine = el('line', { x1: 0, y1: hTop + 8, x2: 0, y2: hBase, stroke: C.ink, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, histG);
    const expLab = T(histG, 0, hTop + 4, '', M ? 12 : 13, C.ink, { 'text-anchor': 'middle', 'font-weight': 700 });
    const obsLine = el('line', { x1: xAt(TS.f), y1: hTop + 8, x2: xAt(TS.f), y2: hBase, stroke: C.blue, 'stroke-width': 3 }, histG);
    const obsLab = T(histG, xAt(TS.f), hTop + 4, 'seen: ' + TS.f, M ? 12.5 : 14, C.blue, { 'text-anchor': 'middle', 'font-weight': 800 });
    const histMax = (() => { const h = new Array(BINS).fill(0); TR.cnts.forEach((c) => { if (c < BINS) h[c]++; }); return Math.max.apply(null, h); })();

    /* observed vs expected bars (steps 4) */
    const barG = el('g', {}, svg);
    const bRows = [TS, TP, TC];
    const bx = M ? 14 : 40, bwMax = W - bx - (M ? 70 : 110), bTop = M ? 36 : 76, bBlock = M ? 88 : 140, bhh = M ? 20 : 30;
    const bScale = bwMax / (TS.f * 1.05);
    const bEls = bRows.map((pr, k) => {
      const y = bTop + k * bBlock;
      T(barG, bx, y, pr.a + ' × ' + pr.b, M ? 14 : 17, C.ink, { 'font-weight': 700 });
      el('rect', { x: bx, y: y + 10, width: pr.f * bScale, height: bhh, rx: 5, fill: C.blue }, barG);
      T(barG, bx + pr.f * bScale + 8, y + 10 + bhh * 0.72, 'seen ' + pr.f, M ? 13 : 15, C.ink, { 'class': 'mono', 'font-weight': 700 });
      const e = el('rect', { x: bx, y: y + 14 + bhh, width: pr.expected * bScale, height: bhh, rx: 5, fill: C.grey, 'fill-opacity': 0.55 }, barG);
      T(barG, bx + pr.expected * bScale + 8, y + 14 + bhh * 1.72, 'chance ' + pr.expected.toFixed(2), M ? 13 : 15, C.muted, { 'class': 'mono' });
      const more = pr.ratio >= 1;
      T(barG, W - 10, y, '×' + pr.ratio.toFixed(2) + (more ? ' · more than chance' : ' · less than chance'), M ? 12.5 : 16, more ? C.blue : C.orange, { 'text-anchor': 'end', 'font-weight': 800 });
    });

    /* state: arrangement shown + user's extra shuffles */
    const extraRng = PM.mulberry32(2024), extra = [];
    let extraArr = null;
    const btn = document.getElementById('shufBtn');
    if (btn) btn.onclick = () => {
      extraArr = PM.shuffledPairs(F, extraRng);
      extra.push(PM.countPairIn(extraArr, TEA, STR));
      C0.redraw();
    };
    const caps = [
      'Every pair is a card with two ends. Purple = <i>tea</i>, teal = <i>strong</i>. Blue-outlined cards pair the two.',
      'Cards re-dealt at random. The grey bars count how many <i>tea</i> + <i>strong</i> cards each shuffle produced.',
      'Dashed line: the expected count \\(\\tfrac{16\\cdot 11}{68}\\). Blue line: what the corpus actually shows.',
      'Blue: seen. Grey: expected by chance. The ratio says how many times more (or less) than chance.'
    ];
    return {
      render: function (stage, p, q) {
        ctlState(C0.ctl, stage === 1 || stage === 2);
        show(cardsG, stage !== 3); show(info, stage !== 3); show(legG, stage !== 3);
        show(barG, stage === 3); show(histG, stage === 1 || stage === 2);
        const inShuffle = stage === 1;
        let t = stage === 1 ? Math.max(1, Math.floor(q * SHUF_T)) : SHUF_T;
        if (stage === 0 || stage === 3) {
          setCards(observed);
          info.textContent = stage === 0 ? N + ' ends: tea fills ' + RS[TEA] + ', strong fills ' + RS[STR] : '';
        } else if (stage === 2) {
          setCards(observed);
          info.textContent = 'what the corpus shows: ' + TS.f + ' tea + strong cards';
        } else {
          const arr = extra.length ? extraArr : TR.arrs[t - 1];
          setCards(arr);
          info.textContent = 'this shuffle: ' + PM.countPairIn(arr, TEA, STR) + ' tea + strong cards' + (M ? ' · ' + (t + extra.length) + ' shuffles' : '');
        }
        // histogram
        const h = new Array(BINS).fill(0);
        for (let i = 0; i < t; i++) if (TR.cnts[i] < BINS) h[TR.cnts[i]]++;
        extra.forEach((c) => { if (c < BINS) h[c]++; });
        const hm = Math.max(Math.max.apply(null, h), 1, inShuffle ? 0 : histMax);
        const maxH = hBase - hTop - 28;
        h.forEach((c, b) => {
          const hh = c / hm * maxH;
          bars[b].setAttribute('y', hBase - hh); bars[b].setAttribute('height', hh);
        });
        hCount.textContent = M ? '' : 'shuffles so far: ' + (t + extra.length);
        const ex = xAt(TS.expected);
        expLine.setAttribute('x1', ex); expLine.setAttribute('x2', ex);
        expLab.setAttribute('x', ex);
        expLab.textContent = 'chance ≈ ' + TS.expected.toFixed(2);
        const showMarks = stage === 2;
        expLine.setAttribute('opacity', showMarks ? 1 : 0); expLab.setAttribute('opacity', showMarks ? 1 : 0);
        obsLine.setAttribute('opacity', showMarks ? 1 : 0); obsLab.setAttribute('opacity', showMarks ? 1 : 0);
        C0.cap(caps[stage]);
      }
    };
  });

  /* ============================================================
     Chapter 4 - from ratio to bits
     ============================================================ */
  register('ch4', function (C0) {
    const svg = C0.svg, W = C0.W, H = C0.H, M = C0.M;
    const state = { bits: 1 };
    const lopG = el('g', {}, svg), logG = el('g', {}, svg), dieG = el('g', {}, svg);
    const chip = mathBox(svg, 10, M ? 8 : 18, W - 20, 44, 'big c');
    const fsL = M ? 13 : 15;

    /* step 1: linear ratio axis */
    const lx0 = M ? 24 : 60, lx1 = W - (M ? 24 : 60), ly = M ? 160 : 270;
    const lx = (r) => lx0 + r / 4 * (lx1 - lx0);
    el('line', { x1: lx0, y1: ly, x2: lx1, y2: ly, stroke: C.muted, 'stroke-width': 2 }, lopG);
    for (let r = 0; r <= 4; r++) {
      el('line', { x1: lx(r), y1: ly - 6, x2: lx(r), y2: ly + 6, stroke: C.muted, 'stroke-width': 2 }, lopG);
      T(lopG, lx(r), ly + 28, String(r), fsL + 1, C.muted, { 'text-anchor': 'middle', 'class': 'mono' });
    }
    T(lopG, (lx0 + lx1) / 2, ly + 56, 'ratio = seen ÷ expected (ordinary scale)', fsL, C.muted, { 'text-anchor': 'middle' });
    el('line', { x1: lx(1), y1: ly - 100, x2: lx(1), y2: ly, stroke: C.grey, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, lopG);
    T(lopG, lx(1), ly - 108, 'chance (ratio 1)', fsL, C.muted, { 'text-anchor': 'middle' });
    [[0.5, C.orange, 'half as often', ly - 60, '½'], [2, C.blue, 'twice as often', ly - 60, '2']].forEach((it) => {
      el('circle', { cx: lx(it[0]), cy: ly, r: 9, fill: it[1] }, lopG);
      const a = lx(1), b = lx(it[0]);
      el('path', { d: 'M ' + a + ' ' + it[3] + ' L ' + b + ' ' + it[3], stroke: it[1], 'stroke-width': 4, 'stroke-linecap': 'round' }, lopG);
      const left = it[0] < 1, tx2 = left ? a - 8 : a + 8, anc = left ? 'end' : 'start';
      T(lopG, tx2, it[3] - 12, it[2], fsL, it[1], { 'text-anchor': anc, 'font-weight': 700 });
      T(lopG, tx2, it[3] + 22, 'distance ' + (left ? '½' : '1'), fsL, it[1], { 'text-anchor': anc });
    });

    /* steps 2-4: bits axis with ratio ticks */
    const bx0 = M ? 22 : 50, bx1 = W - (M ? 22 : 50), by = M ? 200 : 300;
    const bx = (b) => bx0 + (clamp(b, -3.2, 3.2) + 3.2) / 6.4 * (bx1 - bx0);
    el('line', { x1: bx0, y1: by, x2: bx1, y2: by, stroke: C.muted, 'stroke-width': 3 }, logG);
    el('line', { x1: bx(0), y1: by - 70, x2: bx(0), y2: by + 8, stroke: C.grey, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, logG);
    const ratioTxt = ['⅛', '¼', '½', '1', '2', '4', '8'];
    for (let b = -3; b <= 3; b++) {
      el('line', { x1: bx(b), y1: by - 6, x2: bx(b), y2: by + 6, stroke: C.muted, 'stroke-width': 2 }, logG);
      T(logG, bx(b), by + 28, (b > 0 ? '+' : b < 0 ? MINUS : '') + Math.abs(b), fsL, C.ink, { 'text-anchor': 'middle', 'class': 'mono' });
      T(logG, bx(b), by - 14, '×' + ratioTxt[b + 3], fsL, C.muted, { 'text-anchor': 'middle' });
    }
    T(logG, bx0 - 2, by + 52, 'bits = log₂ of the ratio', fsL, C.muted);
    T(logG, bx0, by + 82, '← less than chance', fsL, C.orange, { 'font-weight': 700 });
    T(logG, bx1, by + 82, 'more than chance →', fsL, C.blue, { 'font-weight': 700, 'text-anchor': 'end' });
    const handle = el('g', {}, logG);
    el('line', { x1: 0, y1: -46, x2: 0, y2: 0, stroke: C.accent, 'stroke-width': 3 }, handle);
    el('circle', { cx: 0, cy: 0, r: 11, fill: C.accent, stroke: '#fff', 'stroke-width': 3 }, handle);
    const handleLab = T(handle, 0, -54, '', fsL + 1, C.accent, { 'text-anchor': 'middle', 'font-weight': 800 });
    /* markers for the two example pairs */
    const marks = el('g', {}, logG);
    [[TS, C.blue], [TP, C.orange]].forEach((it, i) => {
      const pr = it[0], x = bx(pr.pmi), yy = by - 44 - i * 0;
      el('circle', { cx: x, cy: by, r: 10, fill: it[1], stroke: '#fff', 'stroke-width': 2 }, marks);
      el('line', { x1: x, y1: by - 10, x2: x, y2: by - (M ? 50 : 70) - i * (M ? 22 : 30), stroke: it[1], 'stroke-width': 2 }, marks);
      T(marks, x, by - (M ? 56 : 76) - i * (M ? 22 : 30), pr.a + ' × ' + pr.b + '  ' + sgn(pr.pmi) + ' bits', fsL, it[1], { 'text-anchor': 'middle', 'font-weight': 800 });
    });

    /* die panel */
    const dTop = M ? 66 : 82;
    el('rect', { x: M ? 18 : 60, y: dTop, width: 56, height: 56, rx: 11, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, dieG);
    [[-14, -14], [14, -14], [0, 0], [-14, 14], [14, 14]].forEach((o) => el('circle', { cx: (M ? 46 : 88) + o[0] * 0.8, cy: dTop + 28 + o[1] * 0.8, r: 5, fill: C.ink }, dieG));
    const pb0 = M ? 94 : 150, pbMax = W - pb0 - (M ? 12 : 40);
    [[DIE.p5, 'chance of a 5: 1 in 6', C.grey, 0], [DIE.p5GivenGt4, 'chance of a 5 if the result is above 4: 1 in 2', C.blue, 1]].forEach((it) => {
      const yy = dTop + it[3] * (M ? 34 : 38);
      el('rect', { x: pb0, y: yy, width: it[0] / 0.5 * pbMax * 0.6, height: M ? 14 : 18, rx: 4, fill: it[2], 'fill-opacity': 0.8 }, dieG);
      T(dieG, pb0, yy - 4, it[1], M ? 11.5 : 13, C.ink);
    });
    T(dieG, W / 2, dTop + (M ? 76 : 86), '×' + Math.round(DIE.ratio) + ' likelier', M ? 15 : 18, C.blue, { 'text-anchor': 'middle', 'font-weight': 800 });
    const dieMark = el('g', {}, logG);
    el('circle', { cx: bx(DIE.pmi), cy: by, r: 10, fill: C.blue, stroke: '#fff', 'stroke-width': 2 }, dieMark);
    T(dieMark, bx(DIE.pmi), by - 42, sgn(DIE.pmi) + ' bits', fsL + 1, C.blue, { 'text-anchor': 'middle', 'font-weight': 800 });

    const range = document.getElementById('bitsRange'), out = document.getElementById('bitsOut');
    function setBits(b) { state.bits = clamp(b, -3, 3); range.value = state.bits; C0.redraw(); }
    range.oninput = () => setBits(Number(range.value));
    Array.prototype.forEach.call(C0.ctl.querySelectorAll('button[data-bits]'), (b) => {
      b.onclick = () => setBits(Number(b.getAttribute('data-bits')));
    });
    const caps = [
      'On the ordinary scale, ×2 and ×½ are not equally far from 1, although they are equally strong.',
      'Each step of one bit doubles (to the right) or halves (to the left) the ratio. Drag the handle.',
      'PMI in bits for two pairs of the corpus. Right of the dashed line: more than chance. Left: less.',
      'A die: the 5 becomes three times likelier, \\(\\log_2 3\\) bits.'
    ];
    let lastChip = '';
    return {
      render: function (stage, p, q) {
        ctlState(C0.ctl, stage === 1);
        show(lopG, stage === 0); show(logG, stage >= 1); show(dieG, stage === 3);
        show(handle, stage === 1); show(marks, stage === 2); show(dieMark, stage === 3);
        let src = '';
        if (stage === 0) src = '\\log_2 2 = 1 \\qquad \\log_2 \\tfrac12 = -1';
        else if (stage === 1) {
          const b = state.bits, r = Math.pow(2, b);
          handle.setAttribute('transform', 'translate(' + bx(b) + ',' + by + ')');
          handleLab.textContent = sgn(b, 2) + ' bits';
          out.textContent = '×' + (r >= 1 ? r.toFixed(2) : r.toFixed(3));
          src = '\\log_2 ' + r.toFixed(r >= 1 ? 2 : 3) + ' = ' + b.toFixed(2).replace(MINUS, '-');
        } else if (stage === 2) src = '\\mathrm{PMI}=\\log_2\\dfrac{\\text{seen}}{\\text{expected}}';
        else src = '\\log_2\\dfrac{1/2}{1/6}=\\log_2 3 \\approx ' + DIE.pmi.toFixed(2);
        if (src !== lastChip) { lastChip = src; setTex(chip, src); }
        C0.cap(caps[stage]);
      }
    };
  });

  /* ============================================================
     Chapter 5 - count versus PMI: slope chart and heatmap
     ============================================================ */
  register('ch5', function (C0) {
    const svg = C0.svg, W = C0.W, H = C0.H, M = C0.M;
    hatchDefs(svg, 'hatch5');
    const slopeG = el('g', {}, svg), matG = el('g', {}, svg);

    /* ---- slope chart */
    const L = MIN2.slice().sort((a, b) => b.f - a.f || (a.a + a.b < b.a + b.b ? -1 : 1));
    const R = MIN2.slice().sort((a, b) => b.pmi - a.pmi);
    const n = L.length, rowH = M ? 34 : 46, sy0 = M ? 62 : 104;
    const xl = M ? 134 : 250, xr = M ? 216 : 392;
    T(slopeG, xl, M ? 22 : 40, 'by count', M ? 14 : 16, C.ink, { 'text-anchor': 'end', 'font-weight': 800 });
    T(slopeG, xr, M ? 22 : 40, 'by PMI', M ? 14 : 16, C.ink, { 'text-anchor': 'end', 'font-weight': 800, 'class': 'rtitle' });
    T(slopeG, xl, M ? 40 : 62, 'seen', M ? 12 : 13, C.muted, { 'text-anchor': 'end' });
    const rTitle2 = T(slopeG, xr, M ? 40 : 62, 'bits', M ? 12 : 13, C.muted, { 'text-anchor': 'end' });
    const items = L.map((pr, i) => {
      const iR = R.indexOf(pr);
      const g = el('g', {}, slopeG);
      const line = el('line', { x1: xl + 12, y1: 0, x2: xr - 12, y2: 0, 'stroke-linecap': 'round' }, g);
      const dl = el('circle', { cx: xl + 6, cy: 0, r: M ? 10 : 12, fill: C.blue }, g);
      const cl = T(g, xl + 6, 0, String(pr.f), M ? 12 : 14, '#fff', { 'text-anchor': 'middle', 'font-weight': 800, 'class': 'mono' });
      const nl = T(g, xl - (M ? 16 : 22), 0, pr.a + ' × ' + pr.b, M ? 11.5 : 15, C.ink, { 'text-anchor': 'end' });
      const dr = el('circle', { cx: xr + 6, cy: 0, r: M ? 8 : 9, fill: pr.pmi >= 0 ? C.blue : C.orange }, g);
      const nr = T(g, xr + (M ? 20 : 24), 0, pr.a + ' × ' + pr.b, M ? 11.5 : 15, C.ink);
      const vr = T(g, xr + (M ? 20 : 24), 0, sgn(pr.pmi), M ? 12 : 14, pr.pmi >= 0 ? C.blue : C.orange, { 'font-weight': 800, 'class': 'mono' });
      bindTip(g, () => pairTip(pr));
      return { pr: pr, iL: i, iR: iR, g: g, line: line, dl: dl, cl: cl, nl: nl, dr: dr, nr: nr, vr: vr };
    });
    const hiTC = pairKey('tea', 'coffee'), hiPC = pairKey('powerful', 'computer');

    /* ---- heatmap */
    const words = M ? ['tea', 'coffee', 'strong', 'powerful', 'engine', 'storm'] : VOCAB;
    const GV = words.length, cell = M ? 38 : 42, GX = M ? 88 : 112, GY = M ? 60 : 88;
    const fsC = M ? 11.5 : 12, fsW = M ? 12.5 : 13.5;
    words.forEach((w, i) => {
      T(matG, GX - 8, GY + i * cell + cell / 2 + 4, w, fsW, C.ink, { 'text-anchor': 'end' });
      const t = T(matG, GX + i * cell + cell / 2, GY - 8, w, fsW, C.ink, { 'text-anchor': 'start' });
      t.setAttribute('transform', 'rotate(' + (M ? -42 : -58) + ' ' + (GX + i * cell + cell / 2) + ' ' + (GY - 8) + ')');
    });
    for (let i = 0; i < GV; i++) for (let j = 0; j < GV; j++) {
      const a = words[i], b = words[j], v = PMI_M[IDX[a]][IDX[b]];
      const g = el('g', {}, matG);
      el('rect', { x: GX + j * cell, y: GY + i * cell, width: cell - 2, height: cell - 2, rx: 4, fill: pmiColor(v, 'url(#hatch5)') }, g);
      if (Number.isNaN(v)) T(g, GX + j * cell + cell / 2 - 1, GY + i * cell + cell / 2 + 4, '–', fsC, C.muted, { 'text-anchor': 'middle' });
      else if (v !== -Infinity) {
        const t = Math.pow(clamp(Math.abs(v) / PMI_ABS_MAX, 0, 1), 0.8);
        T(g, GX + j * cell + cell / 2 - 1, GY + i * cell + cell / 2 + 4, sgn(v, M ? 1 : 2), fsC, t > 0.55 ? '#fff' : C.ink, { 'text-anchor': 'middle', 'class': 'mono', 'font-weight': 600 });
      }
      bindTip(g, () => (i === j ? '<b>' + a + '</b> with itself: not defined' : pairTip(stat(a, b))));
    }
    const lgY = GY + GV * cell + (M ? 6 : 12), lgW = GV * cell - 2;
    for (let s = 0; s < 48; s++) {
      el('rect', { x: GX + s / 48 * lgW, y: lgY, width: lgW / 48 + 1, height: 10, fill: pmiColor(-PMI_ABS_MAX + s / 47 * 2 * PMI_ABS_MAX) }, matG);
    }
    T(matG, GX, lgY + 24, MINUS + (M ? ' less' : ' less than chance'), M ? 11.5 : 12.5, C.orange, { 'font-weight': 700 });
    T(matG, GX + lgW / 2, lgY + 24, '0', M ? 11.5 : 12.5, C.muted, { 'text-anchor': 'middle' });
    T(matG, GX + lgW, lgY + 24, (M ? '+ more' : '+ more than chance'), M ? 11.5 : 12.5, C.blue, { 'text-anchor': 'end', 'font-weight': 700 });

    const caps = [
      'Pairs seen at least twice, sorted by how often they were seen. The circle holds the count.',
      'Lines connect each pair’s count rank to its PMI rank. Blue lines: the pair rises. Orange: it sinks.',
      'Highlighted: both pairs have count ' + TC.f + ', but their PMI ranks are far apart.',
      'PMI in bits for every pair of words. Hover or tap a cell for the numbers.'
    ];
    return {
      render: function (stage, p, q) {
        C0.ctl.classList.remove('on');
        show(slopeG, stage !== 3); show(matG, stage === 3);
        const e = stage === 0 ? 0 : stage === 1 ? ease(clamp(q * 2.2, 0, 1)) : 1;
        items.forEach((it) => {
          const yL = sy0 + it.iL * rowH, yR = sy0 + (it.iL + (it.iR - it.iL) * e) * rowH;
          const hi = pairKey(it.pr.a, it.pr.b) === hiTC || pairKey(it.pr.a, it.pr.b) === hiPC;
          const dim = stage === 2 && !hi;
          const col = it.iR < it.iL ? C.blue : it.iR > it.iL ? C.orange : C.grey;
          it.g.setAttribute('opacity', 1);
          it.dl.setAttribute('fill', dim ? '#d3e1f4' : C.blue); it.cl.setAttribute('fill', dim ? C.ink : '#fff');
          it.dr.setAttribute('fill', dim ? (it.pr.pmi >= 0 ? '#d3e1f4' : '#f6dcc2') : (it.pr.pmi >= 0 ? C.blue : C.orange));
          [it.nl, it.nr].forEach((n2) => n2.setAttribute('fill', dim ? C.muted : C.ink));
          it.vr.setAttribute('fill', dim ? C.muted : (it.pr.pmi >= 0 ? C.blue : C.orange));
          it.line.setAttribute('x1', xl + 12); it.line.setAttribute('y1', yL);
          it.line.setAttribute('x2', xr - 12); it.line.setAttribute('y2', yR);
          it.line.setAttribute('stroke', col);
          it.line.setAttribute('stroke-width', stage === 2 && hi ? 6 : 3);
          it.line.setAttribute('opacity', stage === 0 ? 0 : dim ? 0.25 : 0.85);
          it.dl.setAttribute('cy', yL); it.cl.setAttribute('y', yL + 4.5); it.nl.setAttribute('y', yL + 4.5);
          const showR = stage >= 1 ? clamp((e - 0.6) / 0.4, 0, 1) : 0;
          [it.dr, it.nr, it.vr].forEach((n2) => n2.setAttribute('opacity', showR));
          it.dr.setAttribute('cy', yR);
          if (M) { it.nr.setAttribute('y', yR - 2); it.vr.setAttribute('y', yR + 12); } else {
            it.nr.setAttribute('y', yR + 5); it.vr.setAttribute('y', yR + 5);
            it.vr.setAttribute('x', xr + 24 + 160);
          }
        });
        C0.cap(caps[stage]);
      }
    };
  });

  /* ============================================================
     Chapter 6 - when PMI misleads
     ============================================================ */
  register('ch6', function (C0) {
    const svg = C0.svg, W = C0.W, H = C0.H, M = C0.M;
    hatchDefs(svg, 'hatch6');
    const fsR = M ? 11.5 : 13.5;
    const zeroX = M ? 168 : 296, scale = M ? 36 : 62, labelX = M ? 122 : 214, rowH = M ? 29 : 26, top = M ? 40 : 64;
    const maxRows = M ? 9 : 18;
    /* rows: every observed pair + the never-seen storm x tea */
    const neverPair = PM.pairStats(F, VOCAB, IDX.storm, IDX.tea);
    const all = PAIRS_P.slice();
    const rows = all.concat([neverPair]).map((pr) => {
      const g = el('g', { 'class': 'anim' }, svg);
      const isNever = pr.f === 0;
      const band = el('rect', { x: 4, y: -rowH * 0.7, width: W - 8, height: rowH - 2, rx: 6, fill: C.blueSoft, opacity: 0 }, g);
      T(g, labelX, 4, pairName(pr), fsR, C.ink, { 'text-anchor': 'end' });
      const bar = el('rect', { x: zeroX, y: -9, width: 0, height: 18, rx: 4, fill: isNever ? 'url(#hatch6)' : pr.pmi >= 0 ? C.blue : C.orange }, g);
      if (isNever) { bar.setAttribute('x', zeroX - 50); bar.setAttribute('width', 50); bar.setAttribute('stroke', '#aaa397'); }
      const v = T(g, zeroX, 4, '', fsR, C.ink, { 'class': 'mono', 'font-weight': 700 });
      const cnt = T(g, W - 8, 4, (M ? '' : 'seen ') + pr.f + '×', fsR, pr.f <= 1 ? C.orange : C.muted, { 'text-anchor': 'end', 'font-weight': pr.f <= 1 ? 800 : 400 });
      const dia = el('path', { d: 'M 0 -7 L 7 0 L 0 7 L -7 0 Z', fill: C.ink, stroke: '#fff', 'stroke-width': 1.5 }, g);
      const sm = isNever ? -Infinity : smoothed(pr.a, pr.b);
      bindTip(g, () => pairTip(pr) + (isNever ? '' : '<br>smoothed PMI ' + sgn(sm) + ' bits'));
      return { pr: pr, g: g, band: band, bar: bar, v: v, cnt: cnt, dia: dia, sm: sm, never: isNever };
    });
    el('line', { x1: zeroX, y1: top - 20, x2: zeroX, y2: H - 10, stroke: C.ink, 'stroke-width': 2 }, svg);
    T(svg, labelX, M ? 20 : 38, 'pair', fsR, C.muted, { 'text-anchor': 'end', 'font-weight': 700 });
    T(svg, zeroX + 6, M ? 20 : 38, 'PMI, bits', fsR, C.muted, { 'font-weight': 700 });
    const hdrCnt = T(svg, W - 8, M ? 20 : 38, M ? 'seen' : 'times seen', fsR, C.muted, { 'text-anchor': 'end', 'font-weight': 700 });
    const toggle = document.getElementById('minToggle');
    const st = { minOn: false, stage: -1 };
    toggle.onchange = () => { st.minOn = toggle.checked; C0.redraw(); };

    const curated = [pairKey('powerful', 'storm'), pairKey('tea', 'strong'), pairKey('tea', 'bitter'), pairKey('tea', 'powerful'), pairKey('storm', 'tea')];
    const caps = [
      'Pairs ranked by PMI. The right-hand column shows how often each was actually seen: the top ones were seen once.',
      'Ranked by PMI. With the minimum-count filter on, one-off pairs disappear from the list.',
      'Bars flatten onto zero: negative PMI and never-seen pairs (hatched, \\(-\\infty\\)) become 0 in PPMI.',
      'The diamond marks PMI after smoothing. The rarer word of each pair is treated as the context word.'
    ];
    return {
      render: function (stage, p, q, changed) {
        ctlState(C0.ctl, stage === 1);
        if (changed && st.stage !== stage) {
          st.stage = stage;
          st.minOn = stage === 1;
        }
        toggle.checked = st.minOn;
        let list;
        if (stage === 2) list = rows.filter((r) => curated.indexOf(pairKey(r.pr.a, r.pr.b)) >= 0)
          .sort((a, b) => curated.indexOf(pairKey(a.pr.a, a.pr.b)) - curated.indexOf(pairKey(b.pr.a, b.pr.b)));
        else {
          list = rows.filter((r) => !r.never && (stage === 1 && st.minOn ? r.pr.f >= 2 : true)).slice(0, maxRows);
        }
        const flat = stage === 2 ? ease(clamp((q - 0.35) / 0.5, 0, 1)) : 0;
        rows.forEach((r) => {
          const k = list.indexOf(r);
          const vis = k >= 0;
          r.g.setAttribute('opacity', vis ? 1 : 0);
          r.g.style.pointerEvents = vis ? 'auto' : 'none';
          r.g.setAttribute('transform', 'translate(0,' + (top + (vis ? k : list.length) * rowH) + ')');
          r.band.setAttribute('opacity', stage === 0 && k === 0 ? 1 : 0);
          if (r.never) {
            r.v.textContent = flat > 0.5 ? '0' : MINUS + '∞';
            r.v.setAttribute('x', zeroX + 6);
            r.bar.setAttribute('opacity', 1 - flat);
          } else {
            const v0 = r.pr.pmi, vShow = v0 < 0 ? v0 * (1 - flat) : v0;
            const w = Math.abs(vShow) * scale;
            r.bar.setAttribute('x', vShow >= 0 ? zeroX : zeroX - w);
            r.bar.setAttribute('width', w);
            r.bar.setAttribute('fill', v0 >= 0 ? C.blue : (flat > 0.5 ? C.grey : C.orange));
            r.v.textContent = flat > 0.5 && v0 < 0 ? '0' : sgn(v0) + (stage === 3 ? ' → ' + sgn(r.sm) : '');
            r.v.setAttribute('x', stage === 3 ? W - 8 : (vShow >= 0 ? zeroX + w + 6 : zeroX + 6));
            r.v.setAttribute('text-anchor', stage === 3 ? 'end' : 'start');
            r.dia.setAttribute('opacity', stage === 3 ? 1 : 0);
            r.dia.setAttribute('transform', 'translate(' + (zeroX + clamp(r.sm, -3, 3.5) * scale) + ',0)');
          }
          if (r.never) r.dia.setAttribute('opacity', 0);
        });
        rows.forEach((r) => r.cnt.setAttribute('opacity', stage === 3 ? 0 : 1));
        hdrCnt.textContent = stage === 3 ? (M ? 'plain → smoothed' : 'plain → smoothed PMI') : (M ? 'seen' : 'times seen');
        C0.cap(caps[stage]);
      }
    };
  });

  /* ============================================================
     Chapter 7 - playground
     ============================================================ */
  register('ch7', function (C0) {
    const svg = C0.svg, W = C0.W, H = C0.H, M = C0.M;
    const selX = document.getElementById('pgX'), selY = document.getElementById('pgY');
    const rng = document.getElementById('pgW'), rOut = document.getElementById('pgWout');
    const inp = document.getElementById('pgS');
    const pg = window.__pgState || (window.__pgState = { x: 'tea', y: 'strong', w: 3, corpus: PM.CORPUS.slice() });
    if (!selX.options.length) VOCAB.forEach((w) => {
      selX.appendChild(new Option(w, w)); selY.appendChild(new Option(w, w));
    });
    selX.value = pg.x; selY.value = pg.y; rng.value = pg.w; rOut.textContent = pg.w;
    let msg = '';
    const fsB = M ? 13 : 16;
    const title = T(svg, W / 2, M ? 30 : 46, '', M ? 20 : 28, C.ink, { 'text-anchor': 'middle', 'font-weight': 800 });
    const sub = T(svg, W / 2, M ? 48 : 70, '', M ? 12 : 14, C.muted, { 'text-anchor': 'middle' });
    const bx = M ? 12 : 40, bMax = W - bx - (M ? 90 : 130), by1 = M ? 62 : 100, bhh = M ? 18 : 32;
    T(svg, bx, by1 - 5, 'seen in the corpus', fsB - 1, C.muted);
    T(svg, bx, by1 + bhh + (M ? 20 : 30), 'expected by chance', fsB - 1, C.muted);
    const barSeen = el('rect', { x: bx, y: by1, width: 0, height: bhh, rx: 6, fill: C.blue }, svg);
    const barExp = el('rect', { x: bx, y: by1 + bhh + (M ? 24 : 38), width: 0, height: bhh, rx: 6, fill: C.grey, 'fill-opacity': 0.55 }, svg);
    const vSeen = T(svg, bx, by1 + bhh * 0.72, '', fsB, C.ink, { 'class': 'mono', 'font-weight': 800 });
    const vExp = T(svg, bx, by1 + bhh * 1.72 + (M ? 24 : 38), '', fsB, C.muted, { 'class': 'mono', 'font-weight': 700 });
    /* bits axis */
    const ax0 = M ? 24 : 60, ax1 = W - (M ? 24 : 60), ay = M ? 178 : 352;
    const ax = (b) => ax0 + (clamp(b, -4, 4) + 4) / 8 * (ax1 - ax0);
    el('line', { x1: ax0, y1: ay, x2: ax1, y2: ay, stroke: C.muted, 'stroke-width': 3 }, svg);
    el('line', { x1: ax(0), y1: ay - 34, x2: ax(0), y2: ay + 8, stroke: C.grey, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, svg);
    for (let b = -4; b <= 4; b += 2) {
      T(svg, ax(b), ay + 26, (b > 0 ? '+' : b < 0 ? MINUS : '') + Math.abs(b), M ? 12 : 13, C.muted, { 'text-anchor': 'middle', 'class': 'mono' });
      el('line', { x1: ax(b), y1: ay - 5, x2: ax(b), y2: ay + 5, stroke: C.muted, 'stroke-width': 2 }, svg);
    }
    T(svg, ax0, ay - 44, '← less than chance', M ? 12 : 13, C.orange, { 'font-weight': 700 });
    T(svg, ax1, ay - 44, 'more than chance →', M ? 12 : 13, C.blue, { 'font-weight': 700, 'text-anchor': 'end' });
    const marker = el('circle', { cx: ax0, cy: ay, r: 11, fill: C.accent, stroke: '#fff', 'stroke-width': 3 }, svg);
    const mLab = T(svg, ax0, ay - 16, '', M ? 14 : 16, C.accent, { 'text-anchor': 'middle', 'font-weight': 800 });
    const neverHatch = (hatchDefs(svg, 'hatch7'), el('rect', { x: ax0 - 6, y: ay - 9, width: 30, height: 18, rx: 4, fill: 'url(#hatch7)', stroke: '#aaa397' }, svg));
    const formula = mathBox(svg, 10, ay + (M ? 36 : 56), W - 20, 60, 'big c');
    const chips = [];
    ['seen', 'expected', 'ratio', 'PMI', 'PPMI'].forEach((lab, i) => {
      const cw2 = (W - 20) / 5, x = 10 + i * cw2, y = H - (M ? 52 : 70);
      el('rect', { x: x + 2, y: y, width: cw2 - 4, height: M ? 42 : 56, rx: 8, fill: C.neutral, stroke: C.line }, svg);
      T(svg, x + cw2 / 2, y + (M ? 14 : 18), lab, M ? 11 : 12.5, C.muted, { 'text-anchor': 'middle' });
      chips.push(T(svg, x + cw2 / 2, y + (M ? 33 : 43), '', M ? 13 : 17, C.ink, { 'text-anchor': 'middle', 'font-weight': 800, 'class': 'mono' }));
    });

    function recompute() {
      pg.co = PM.buildCooccurrence(pg.corpus, pg.w);
    }
    recompute();
    function refresh() {
      pg.x = selX.value; pg.y = selY.value; pg.w = Number(rng.value); rOut.textContent = pg.w;
      recompute(); C0.redraw();
    }
    selX.onchange = refresh; selY.onchange = refresh; rng.oninput = refresh;
    document.getElementById('pgAdd').onclick = () => {
      const s = inp.value.trim();
      if (!s) return;
      const toks = PM.tokenize(s);
      const hits = toks.filter((t) => VOCAB.indexOf(t) >= 0).length;
      pg.corpus.push(s); inp.value = '';
      msg = hits ? 'Added. ' + hits + ' of its words are followed.' : 'Added, but none of its words are among the ' + VOCAB.length + ' followed words, so nothing changes.';
      refresh();
    };
    document.getElementById('pgReset').onclick = () => { pg.corpus = PM.CORPUS.slice(); msg = 'Corpus reset.'; refresh(); };
    inp.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('pgAdd').click(); };

    return {
      render: function (stage) {
        C0.ctl.classList.add('on');
        const co = pg.co, i = co.index[pg.x], j = co.index[pg.y];
        title.textContent = pg.x + ' × ' + pg.y;
        sub.textContent = 'window ±' + pg.w + ' · ' + co.pairs + ' pairs · N = ' + co.N;
        const same = i === j;
        const s = PM.pairStats(co.F, co.vocab, i, j);
        const have = !same && co.N > 0;
        const maxV = Math.max(s.f, s.expected, 1) * 1.15;
        barSeen.setAttribute('width', have ? s.f / maxV * bMax : 0);
        barExp.setAttribute('width', have ? s.expected / maxV * bMax : 0);
        vSeen.setAttribute('x', bx + (have ? s.f / maxV * bMax : 0) + 8); vSeen.textContent = have ? String(s.f) : '';
        vExp.setAttribute('x', bx + (have ? s.expected / maxV * bMax : 0) + 8); vExp.textContent = have ? s.expected.toFixed(2) : '';
        const never = have && s.f === 0;
        marker.setAttribute('opacity', have && !never ? 1 : 0);
        mLab.setAttribute('opacity', have ? 1 : 0);
        neverHatch.setAttribute('opacity', never ? 1 : 0);
        if (have && !never) {
          marker.setAttribute('cx', ax(s.pmi)); mLab.setAttribute('x', ax(s.pmi)); mLab.textContent = sgn(s.pmi) + ' bits';
        } else if (never) { mLab.setAttribute('x', ax0 + 60); mLab.textContent = MINUS + '∞: never seen'; mLab.setAttribute('text-anchor', 'middle'); }
        if (!never) mLab.setAttribute('text-anchor', 'middle');
        let src = '';
        if (same) src = '\\text{pick two different words}';
        else if (co.N === 0) src = '\\text{no pairs in this corpus}';
        else if (never) src = '\\log_2\\dfrac{0}{' + s.expected.toFixed(2) + '} = -\\infty';
        else src = '\\mathrm{PMI}=\\log_2\\dfrac{' + s.f + '\\cdot ' + co.N + '}{' + s.ci + '\\cdot ' + s.cj + '}=' + s.pmi.toFixed(2).replace(MINUS, '-');
        setTex(formula, src);
        const vals = have ? [String(s.f), s.expected.toFixed(2), never ? '0' : s.ratio.toFixed(2), sgn(s.pmi), s.ppmi.toFixed(2)] : ['', '', '', '', ''];
        chips.forEach((c, k) => { c.textContent = vals[k]; });
        C0.cap(msg || 'Everything here is recomputed from the corpus each time you change a control.');
      }
    };
  });

  /* ============================================================
     Chapter 8 - going further (optional)
     ============================================================ */
  register('ch8', function (C0) {
    const svg = C0.svg, W = C0.W, H = C0.H, M = C0.M;
    const miG = el('g', {}, svg), mapG = el('g', {}, svg), pipeG = el('g', {}, svg);

    /* ---- MI as a running total of contributions */
    const items = PAIRS_C.map((pr) => ({ pr: pr, c: 2 * pr.pij * pr.pmi })).sort((a, b) => b.c - a.c);
    let cum = 0, maxCum = 0;
    items.forEach((it) => { it.s = cum; cum += it.c; it.e = cum; maxCum = Math.max(maxCum, cum); });
    const tx0 = M ? 14 : 40, tx1 = W - (M ? 14 : 40), ty = M ? 130 : 230, th = M ? 40 : 60;
    const tx = (v) => tx0 + v / maxCum * (tx1 - tx0);
    el('rect', { x: tx0, y: ty, width: tx1 - tx0, height: th, rx: 6, fill: C.neutral, stroke: C.line }, miG);
    const segs = items.map((it, k) => {
      const r = el('rect', { x: Math.min(tx(it.s), tx(it.e)), y: ty, width: Math.abs(tx(it.e) - tx(it.s)), height: th, rx: 2, fill: it.c >= 0 ? C.blue : C.orange, stroke: '#fff', 'stroke-width': 1.5 }, miG);
      bindTip(r, () => '<b>' + pairName(it.pr) + '</b><br>PMI ' + sgn(it.pr.pmi) + ' bits<br>contributes ' + sgn(it.c) + ' bits (pairs count both ways)');
      return r;
    });
    const runLab = T(miG, W / 2, M ? 70 : 110, '', M ? 34 : 54, C.accent, { 'text-anchor': 'middle', 'font-weight': 800, 'class': 'mono' });
    T(miG, W / 2, M ? 92 : 140, 'bits so far', M ? 13 : 15, C.muted, { 'text-anchor': 'middle' });
    const miLine = el('line', { x1: tx(MI), y1: ty - 10, x2: tx(MI), y2: ty + th + 14, stroke: C.ink, 'stroke-width': 3 }, miG);
    T(miG, tx(MI), ty + th + (M ? 32 : 38), 'MI = ' + MI.toFixed(2), M ? 14 : 17, C.ink, { 'text-anchor': M ? 'end' : 'middle', 'font-weight': 800 });
    T(miG, tx0, ty + th + (M ? 58 : 76), 'each block = one pair: how often it happens × its PMI', M ? 12 : 14, C.muted);
    T(miG, tx0, ty + th + (M ? 76 : 98), 'blue adds, orange subtracts', M ? 12 : 14, C.muted);

    /* ---- the real 2-D map from the SVD of the PPMI matrix */
    const emb = PM.embed(PM.ppmiMatrix(F), [0, 2]);
    const xs = emb.coords.map((c) => c[0]), ys = emb.coords.map((c) => c[1]);
    const mx0 = M ? 44 : 70, mx1 = W - (M ? 30 : 60), my0 = M ? 24 : 70, my1 = H - (M ? 74 : 110);
    const sx = (v) => mx0 + (v - Math.min.apply(null, xs)) / (Math.max.apply(null, xs) - Math.min.apply(null, xs)) * (mx1 - mx0);
    const sy = (v) => my1 - (v - Math.min.apply(null, ys)) / (Math.max.apply(null, ys) - Math.min.apply(null, ys)) * (my1 - my0);
    el('rect', { x: mx0 - 14, y: my0 - 14, width: mx1 - mx0 + 28, height: my1 - my0 + 28, rx: 10, fill: '#fcfbf8', stroke: C.line }, mapG);
    const pts = VOCAB.map((w, i) => ({ w: w, x: sx(xs[i]), y: sy(ys[i]) }));
    const small = pts.filter((q) => q.x < mx0 + (mx1 - mx0) * 0.3).sort((a, b) => a.y - b.y);
    let prevLy = -1e9;
    small.forEach((q) => { q.lx = q.x + 12; q.ly = Math.max(q.y + 4, prevLy + (M ? 14 : 17)); prevLy = q.ly; q.anchor = 'start'; });
    pts.filter((q) => small.indexOf(q) < 0).sort((a, b) => a.x - b.x).forEach((q, k) => {
      q.lx = q.x; q.ly = q.y + (k % 2 === 0 ? -14 : 24); q.anchor = 'middle';
    });
    const focusW = (w) => w === 'tea' || w === 'strong';
    const ts = pts.filter((q) => q.w === 'tea')[0], st2 = pts.filter((q) => q.w === 'strong')[0];
    el('line', { x1: ts.x, y1: ts.y, x2: st2.x, y2: st2.y, stroke: C.accent, 'stroke-width': 3, 'stroke-dasharray': '6 4' }, mapG);
    pts.forEach((q) => {
      el('circle', { cx: q.x, cy: q.y, r: M ? 7 : 8, fill: focusW(q.w) ? C.accent : C.ink, 'fill-opacity': 0.88, stroke: '#fff', 'stroke-width': 2 }, mapG);
      T(mapG, q.lx, q.ly, q.w, M ? 13 : 15, focusW(q.w) ? C.accent : C.ink, { 'text-anchor': q.anchor, 'font-weight': focusW(q.w) ? 800 : 600 });
    });
    T(mapG, (mx0 + mx1) / 2, my1 + 34, 'direction of the powerful group →', M ? 12.5 : 14, C.muted, { 'text-anchor': 'middle' });
    const yl = T(mapG, mx0 - 24, (my0 + my1) / 2, 'direction of the tea group →', M ? 12.5 : 14, C.muted, { 'text-anchor': 'middle' });
    yl.setAttribute('transform', 'rotate(-90 ' + (mx0 - 20) + ' ' + (my0 + my1) / 2 + ')');
    T(mapG, W / 2, H - (M ? 22 : 40), 'toy corpus, ten words: real embeddings use millions of words', M ? 12 : 14, C.ink, { 'text-anchor': 'middle', 'font-weight': 700 });
    T(mapG, W / 2, H - (M ? 6 : 18), 'and hundreds of directions', M ? 12 : 14, C.muted, { 'text-anchor': 'middle' });

    /* ---- pipeline */
    const boxes = [
      { t: 'corpus', f: '', kind: 'text' },
      { t: 'counts', f: '\\text{count}(x,y)', kind: 'F' },
      { t: 'PMI → PPMI', f: '\\max(\\mathrm{PMI},0)', kind: 'P' },
      { t: 'word vectors', f: '\\mathrm{PMI}-\\log k', kind: 'E' }
    ];
    const bw2 = M ? 160 : 128, bh2 = M ? 132 : 200, pipeBoxes = [];
    boxes.forEach((b, i) => {
      const bx2 = M ? 10 + (i % 2) * (bw2 + 20) : (W - 4 * bw2 - 3 * 18) / 2 + i * (bw2 + 18), by2 = M ? 12 + Math.floor(i / 2) * (bh2 + 16) : 170;
      const g = el('g', {}, pipeG);
      const r = el('rect', { x: bx2, y: by2, width: bw2, height: bh2, rx: 10, fill: C.card, stroke: C.line, 'stroke-width': 1.5 }, g);
      T(g, bx2 + bw2 / 2, by2 + 22, b.t, M ? 13 : 15, C.ink, { 'text-anchor': 'middle', 'font-weight': 800 });
      const mini = el('g', {}, g);
      const cs = M ? 6.5 : 9.5, gx = bx2 + (bw2 - 10 * cs) / 2, gy = by2 + (M ? 34 : 40);
      if (b.kind === 'text') {
        PM.CORPUS.slice(0, M ? 5 : 8).forEach((s, k) => T(mini, bx2 + 10, gy + 8 + k * (M ? 14 : 17), s.length > 17 ? s.slice(0, 16) + '…' : s, M ? 11 : 12, C.muted, { 'class': 'mono' }));
      } else if (b.kind === 'F' || b.kind === 'P') {
        const maxF = Math.max.apply(null, F.map((r2) => Math.max.apply(null, r2)));
        for (let a = 0; a < 10; a++) for (let c = 0; c < 10; c++) {
          const fill = b.kind === 'F' ? mix('#f4f2ec', C.blue, Math.pow(F[a][c] / maxF, 0.65)) : mix(C.neutral, C.blue, Math.pow(PM.ppmi(PMI_M[a][c]) / PMI_ABS_MAX, 0.8));
          el('rect', { x: gx + c * cs, y: gy + a * cs, width: cs - 1, height: cs - 1, fill: fill }, mini);
        }
      } else {
        const ex = PM.embed(PM.ppmiMatrix(F), [0, 2]).coords;
        const exs = ex.map((c) => c[0]), eys = ex.map((c) => c[1]);
        const nx = (v) => bx2 + 14 + (v - Math.min.apply(null, exs)) / (Math.max.apply(null, exs) - Math.min.apply(null, exs)) * (bw2 - 28);
        const ny = (v) => gy + 6 + (1 - (v - Math.min.apply(null, eys)) / (Math.max.apply(null, eys) - Math.min.apply(null, eys))) * (M ? 52 : 84);
        ex.forEach((c, k) => el('circle', { cx: nx(c[0]), cy: ny(c[1]), r: 4.5, fill: VOCAB[k] === 'tea' || VOCAB[k] === 'strong' ? C.accent : C.ink, 'fill-opacity': 0.85 }, mini));
      }
      const fb = mathBox(g, bx2 + 4, by2 + bh2 - (M ? 30 : 38), bw2 - 8, 30, 'c');
      if (b.f) setTex(fb, b.f);
      pipeBoxes.push(r);
    });
    const caps = [
      'Each block is one pair; widths add up to the mutual information of the corpus.',
      'A real 2-D picture of the ten words, computed from the PPMI matrix. The words fall into two groups.',
      'The pipeline behind word vectors: counts, then PMI, then compressed vectors. word2vec factorizes a PMI matrix shifted by \\(\\log k\\).',
      'The same pipeline as code. The Python reproduces the counts, expected values and PMI of this page.'
    ];
    return {
      render: function (stage, p, q) {
        C0.ctl.classList.remove('on');
        show(miG, stage === 0); show(mapG, stage === 1); show(pipeG, stage >= 2);
        const k = stage === 0 ? Math.max(1, Math.ceil(q * items.length)) : items.length;
        segs.forEach((s, i) => s.setAttribute('opacity', i < k ? 1 : 0));
        runLab.textContent = (k > 0 ? sgn(items[k - 1].e) : '0.00').replace('+', '');
        pipeBoxes.forEach((r, i) => {
          const on = (stage === 2 && i === 3) || (stage === 3 && (i === 1 || i === 2));
          r.setAttribute('stroke', on ? C.accent : C.line); r.setAttribute('stroke-width', on ? 4 : 1.5);
        });
        C0.cap(caps[stage]);
      }
    };
  });

  /* ============================================================
     Chapter 9 - recap
     ============================================================ */
  register('ch9', function (C0) {
    const svg = C0.svg, W = C0.W, H = C0.H, M = C0.M;
    const recG = el('g', {}, svg), advG = el('g', {}, svg);
    const ch = M ? 88 : 130, gapY = M ? 12 : 22, y0 = M ? 14 : 40;
    const recipe = [
      ['1', 'Count', '\\text{count}(\\text{tea},\\text{strong}) = ' + TS.f],
      ['2', 'Compare with chance', '\\text{expected}=\\dfrac{' + TS.ci + '\\cdot ' + TS.cj + '}{' + N + '}\\approx ' + TS.expected.toFixed(2)],
      ['3', 'Take the logarithm', '\\mathrm{PMI}=\\log_2\\dfrac{' + TS.f + '}{' + TS.expected.toFixed(2) + '}\\approx ' + TS.pmi.toFixed(2).replace(MINUS, '-')]
    ];
    recipe.forEach((r, i) => {
      const y = y0 + i * (ch + gapY);
      el('rect', { x: 10, y: y, width: W - 20, height: ch, rx: 12, fill: C.card, stroke: C.line }, recG);
      el('circle', { cx: 38, cy: y + (M ? 24 : 34), r: M ? 14 : 18, fill: C.accent }, recG);
      T(recG, 38, y + (M ? 29 : 40), r[0], M ? 16 : 20, '#fff', { 'text-anchor': 'middle', 'font-weight': 800 });
      T(recG, 66 + (M ? 0 : 6), y + (M ? 30 : 40), r[1], M ? 15 : 20, C.ink, { 'font-weight': 800 });
      setTex(mathBox(recG, 20, y + (M ? 40 : 56), W - 40, ch - (M ? 42 : 60), 'big c'), r[2]);
    });
    const cards = [
      ['A high score and a decent count', 'a candidate for your glossary', C.blue, '✓'],
      ['A high score on 1–2 sightings', 'be suspicious (one-off pairs)', C.orange, '!'],
      ['A negative score on a small count', 'unreliable: look at more text', C.grey, '?']
    ];
    cards.forEach((c, i) => {
      const y = y0 + i * (ch + gapY);
      el('rect', { x: 10, y: y, width: W - 20, height: ch, rx: 12, fill: C.card, stroke: c[2], 'stroke-width': 2 }, advG);
      el('circle', { cx: 40, cy: y + ch / 2, r: M ? 16 : 22, fill: c[2] }, advG);
      T(advG, 40, y + ch / 2 + (M ? 6 : 8), c[3], M ? 18 : 26, '#fff', { 'text-anchor': 'middle', 'font-weight': 800 });
      T(advG, 74, y + ch / 2 - 4, c[0], M ? 14 : 19, C.ink, { 'font-weight': 800 });
      T(advG, 74, y + ch / 2 + (M ? 18 : 26), c[1], M ? 13 : 17, C.muted);
    });
    const caps = [
      'The three moves, with the numbers for <i>tea</i> and <i>strong</i>.',
      'How to read an association score in a corpus tool.'
    ];
    return {
      render: function (stage) {
        C0.ctl.classList.remove('on');
        show(recG, stage === 0); show(advG, stage === 1);
        C0.cap(caps[stage]);
      }
    };
  });

  update();
})();
