/* Scroll-driven visualizations for the PMI tutorial.
   All math comes from pmi-math.js (window.PMIM). No external libraries. */
(function () {
  'use strict';
  var PMI = window.PMIM;
  if (!PMI) return;

  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, str, attrs) {
    var t = el('text', attrs || {}, parent);
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.textContent = str;
    return t;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(c1, c2, t) {
    var a = hexRgb(c1), b = hexRgb(c2);
    t = clamp(t, 0, 1);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }

  /* KaTeX rendering with plain-text fallback (works offline without the CDN) */
  function setMath(d, tex, fallback) {
    if (window.katex) {
      try { window.katex.render(tex, d, { displayMode: false, throwOnError: false }); return; } catch (e) { /* fall through */ }
    }
    d.textContent = fallback;
    d.classList.add('nomath');
  }
  function mathBox(svg, x, y, w, h, cls) {
    var fo = el('foreignObject', { x: x, y: y, width: w, height: h }, svg);
    var d = document.createElement('div');
    d.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    d.className = 'math' + (cls ? ' ' + cls : '');
    fo.appendChild(d);
    return d;
  }
  function renderStaticMath() {
    var nodes = document.querySelectorAll('.formula');
    Array.prototype.forEach.call(nodes, function (n) {
      var tex = n.textContent.trim();
      if (window.katex && window.renderMathInElement) {
        try {
          window.renderMathInElement(n, {
            delimiters: [{ left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }],
            throwOnError: false
          });
          return;
        } catch (e) { /* fall through to fallback */ }
      }
      n.textContent = n.getAttribute('data-fallback') || tex.replace(/\\\(|\\\)/g, '');
      n.classList.add('nomath');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderStaticMath);
  else renderStaticMath();

  var C = {
    blue: '#2f6fed', orange: '#f08a1d', ink: '#1d2733', muted: '#5b6b7c',
    blueSoft: 'rgba(47,111,237,0.12)', orangeSoft: 'rgba(240,138,29,0.12)',
    line: '#e5e1d8', green: '#1f9d63', red: '#d64545', accent: '#6d5bd0',
    neutral: '#f4f2ec', card: '#fdfcfa'
  };

  /* ---------- data: everything computed live from the toy corpus ---------- */
  var CO = PMI.buildCooccurrence();
  var VOCAB = CO.vocab, F = CO.F, N = CO.N, IDX = CO.index;
  var RS = PMI.rowSums(F), CS = PMI.colSums(F);
  var PMI_M = PMI.pmiMatrix(F), PPMI_M = PMI.ppmiMatrix(F);
  var MI = PMI.mutualInformation(F);
  var PAIRS = PMI.topPairs(F, VOCAB, 0, 'count');   // all observed unordered pairs, by count desc
  var PAIRS_PMI = PMI.topPairs(F, VOCAB, 0, 'pmi'); // same, by pmi desc
  var DIE = PMI.dieExample();
  var teaPartners = PAIRS.filter(function (p) { return p.a === 'tea' || p.b === 'tea'; });

  function countColor(f, maxF) {
    if (f <= 0) return '#f7f5ef';
    return mix('#f7f5ef', C.blue, Math.pow(f / maxF, 0.65));
  }
  var PMI_ABS_MAX = 3.2;
  function pmiColor(v, hatched) {
    if (v === -Infinity) return hatched || mix(C.neutral, C.red, 0.25);
    var t = Math.pow(clamp(Math.abs(v) / PMI_ABS_MAX, 0, 1), 0.8);
    if (v > 0) return mix(C.neutral, C.blue, t);
    if (v < 0) return mix(C.neutral, C.red, t);
    return C.neutral;
  }

  /* ---------- scrollytelling engine ---------- */
  var chapters = [];
  function register(chapterEl, svgId, captionId, scenes) {
    chapters.push({
      el: chapterEl,
      svg: document.getElementById(svgId),
      caption: document.getElementById(captionId),
      steps: Array.prototype.slice.call(chapterEl.querySelectorAll('.step')),
      scenes: scenes
    });
  }

  var dotnav = document.getElementById('dotnav');
  var dotLinks = [];
  document.querySelectorAll('.chapter').forEach(function (chEl) {
    var a = document.createElement('a');
    a.href = '#' + chEl.id;
    var tag = chEl.querySelector('.tag');
    a.innerHTML = '<span>' + (tag ? tag.textContent : chEl.id) + '</span>';
    dotnav.appendChild(a);
    dotLinks.push({ a: a, el: chEl });
  });

  var active = [];
  var ticking = false;

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  function update() {
    ticking = false;
    var vh = window.innerHeight;
    var center = vh * 0.5;
    chapters.forEach(function (ch, ci) {
      if (!active[ci]) active[ci] = { idx: -1, p: 0 };
      // Activation line: the middle of the viewport. A box's scene starts only
      // when the box itself has travelled up to the middle of the screen - never
      // while it is still in the lower half of the viewport.
      var trigger = vh * 0.5;
      var lastAbove = -1;
      ch.steps.forEach(function (s, si) {
        if (s.getBoundingClientRect().top <= trigger) lastAbove = si;
      });
      var best = clamp(lastAbove, 0, ch.steps.length - 1);
      var r0 = ch.steps[best].getBoundingClientRect();
      // progress of the active box while it is on its way up:
      // 0 when it enters at the bottom of the viewport, 1 when it reaches the top
      var bp = clamp((vh - r0.top) / vh, 0, 1);
      var changed = active[ci].idx !== best;
      active[ci] = { idx: best, p: bp };
      ch.steps.forEach(function (s, si) {
        var rr = s.getBoundingClientRect();
        // the scene follows `best`, but every box that is still on screen stays
        // fully readable - dim only boxes that have already left the viewport
        s.classList.toggle('active', si === best || (rr.top < vh && rr.bottom > 0));
      });
      var r = ch.el.getBoundingClientRect();
      dotLinks.forEach(function (dl) {
        if (dl.el === ch.el) dl.a.classList.toggle('on', r.top < center && r.bottom > center);
      });
      var scene = ch.scenes[ch.steps[best].dataset.scene];
      if (scene) scene.render(ch.svg, bp, ch.caption, changed);
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* small shared widgets */
  function panel(svg, x, y, w, h, title) {
    var g = el('g', {}, svg);
    el('rect', { x: x, y: y, width: w, height: h, rx: 10, fill: C.card, stroke: C.line }, g);
    if (title) txt(g, x + w / 2, y + 18, title, { 'font-size': 12, fill: C.muted, 'text-anchor': 'middle', 'font-weight': 700 });
    return g;
  }
  function hatchDefs(svg, id, color) {
    var defs = el('defs', {}, svg);
    var pat = el('pattern', { id: id, width: 7, height: 7, patternTransform: 'rotate(45)', patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: 7, height: 7, fill: '#faf3f3' }, pat);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: color, 'stroke-width': 1.6 }, pat);
    return pat;
  }
  /* shared 10x10 heatmap geometry for ch2 / ch6 */
  var GX = 118, GY = 66, CELL = 42, GV = VOCAB.length;
  function gridXY(i, j) { return [GX + j * CELL, GY + i * CELL]; }
  function heatLabels(svg, g) {
    for (var i = 0; i < GV; i++) {
      txt(g, GX - 8, GY + i * CELL + CELL / 2 + 3.5, VOCAB[i], { 'font-size': 10, fill: C.muted, 'text-anchor': 'end' });
      var t = txt(g, GX + i * CELL + CELL / 2, GY - 8, VOCAB[i], { 'font-size': 10, fill: C.muted, 'text-anchor': 'start' });
      t.setAttribute('transform', 'rotate(-38 ' + (GX + i * CELL + CELL / 2) + ' ' + (GY - 8) + ')');
    }
  }

  /* ============================================================
     Chapter 1 - collocations: constellation around "tea"
     ============================================================ */
  register(document.getElementById('ch1'), 'viz1', 'cap1', {
    pairs: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 0, changed); } },
    counts: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 1, changed); } },
    rare: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 2, changed); } },
    baseline: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 3, changed); } }
  });

  function ch1render(svg, p, cap, stage, changed) {
    var st = svg._ch1;
    if (!st) {
      svg.innerHTML = '';
      var cx = 300, cy = 292, R = 196;
      var parts = teaPartners; // [{a,b,f,...}] with tea
      var spokes = el('g', {}, svg);
      var expG = el('g', { opacity: 0 }, svg);
      var nodes = el('g', {}, svg);
      var spokeEls = [], expEls = [], nodeEls = [];
      parts.forEach(function (pr, i) {
        var w = pr.a === 'tea' ? pr.b : pr.a;
        var ang = (-90 + i * 360 / parts.length) * Math.PI / 180;
        var nx = cx + R * Math.cos(ang), ny = cy + R * Math.sin(ang);
        var exp = PMI.expectedCount(F, IDX.tea, IDX[w]);
        expEls.push(el('line', {
          x1: cx, y1: cy, x2: nx, y2: ny, stroke: C.muted, 'stroke-width': 1 + exp * 1.8,
          'stroke-dasharray': '5 5', opacity: 0.55, 'class': 'anim'
        }, expG));
        spokeEls.push(el('line', {
          x1: cx, y1: cy, x2: nx, y2: ny, stroke: '#b9b2a4', 'stroke-width': 0,
          'stroke-linecap': 'round', 'class': 'anim'
        }, spokes));
        var g = el('g', { opacity: 0, 'class': 'anim' }, nodes);
        el('circle', { cx: nx, cy: ny, r: 30, fill: '#fff', stroke: C.line, 'stroke-width': 2 }, g);
        txt(g, nx, ny + 4, w, { 'font-size': 13, 'text-anchor': 'middle', 'font-weight': 700, fill: C.ink });
        txt(g, nx, ny + 48, '×' + pr.f, { 'font-size': 11, 'text-anchor': 'middle', fill: C.muted, 'font-family': 'ui-monospace,monospace' });
        nodeEls.push({ g: g, w: w, f: pr.f, exp: exp });
      });
      var cg = el('g', {}, svg);
      el('circle', { cx: cx, cy: cy, r: 46, fill: '#efecfb', stroke: C.accent, 'stroke-width': 3 }, cg);
      txt(cg, cx, cy + 6, 'tea', { 'font-size': 20, 'text-anchor': 'middle', 'font-weight': 800, fill: C.accent });
      txt(svg, cx, cy - 66, 'co-occurrence counts, window ±3', { 'font-size': 12, 'text-anchor': 'middle', fill: C.muted });
      var chip = mathBox(svg, 150, 18, 340, 30, 'midmath');
      st = svg._ch1 = { spokes: spokeEls, expEls: expEls, expG: expG, nodeEls: nodeEls, chip: chip, stage: -1, parts: parts };
    }
    var n = st.parts.length;
    // entrance happens once, on the first step's scroll progress (local below);
    // later steps keep everything fully drawn and only recolor / add overlays
    st.spokes.forEach(function (s, i) {
      var local = stage === 0 ? clamp(p * n * 1.25 - i, 0, 1) : 1;
      var hl = stage === 1 && st.parts[i].a + st.parts[i].b === 'teastrong' ? C.accent
        : stage === 2 && (st.parts[i].a + st.parts[i].b === 'teapowerful') ? C.red : '#b9b2a4';
      s.setAttribute('stroke-width', (2 + st.parts[i].f * 1.7) * ease(local));
      s.setAttribute('stroke', hl);
    });
    st.nodeEls.forEach(function (ne, i) {
      var local = stage === 0 ? clamp(p * n * 1.25 - i, 0, 1) : 1;
      ne.g.setAttribute('opacity', ease(local));
      var ring = stage === 1 && ne.w === 'strong' ? C.accent : stage === 2 && ne.w === 'powerful' ? C.red : C.line;
      ne.g.firstChild.setAttribute('stroke', ring);
      ne.g.firstChild.setAttribute('stroke-width', ring === C.line ? 2 : 4);
    });
    st.expG.setAttribute('opacity', stage === 3 ? 1 : 0);
    if (stage !== st.stage) {
      st.stage = stage;
      if (stage === 1) setMath(st.chip, '\\text{strong} \\times \\text{tea} = ' + st.nodeEls.find(function (x) { return x.w === 'strong'; }).f, 'strong x tea = 7');
      else if (stage === 2) setMath(st.chip, '\\text{powerful} \\times \\text{tea} = ' + st.nodeEls.find(function (x) { return x.w === 'powerful'; }).f, 'powerful x tea = 1');
      else if (stage === 3) setMath(st.chip, '\\text{dashed} = \\text{expected under independence} = f_i f_j / N', 'dashed = expected under independence = f_i*f_j/N');
      else setMath(st.chip, '\\text{count}(x, y) = f_{xy}', 'count(x, y) = f_xy');
    }
    cap.textContent = [
      'Toy corpus (21 sentences), counted live: which words appear near "tea"?',
      'Spoke thickness = co-occurrence count. strong x tea = 7, coffee x 3, morning x 3 ...',
      'powerful x tea happens only ONCE - but powerful also pairs with engine (x3) and computer (x3).',
      'Dashed spokes = counts expected by CHANCE (f_i*f_j/N). strong is frequent, so some counts are just frequency - we need the obs/exp ratio.'
    ][stage];
  }

  /* ============================================================
     Chapter 2 - counts -> probabilities: the F heatmap
     ============================================================ */
  var MAXF = Math.max.apply(null, F.map(function (r) { return Math.max.apply(null, r); }));

  register(document.getElementById('ch2'), 'viz2', 'cap2', {
    matrix: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 0, changed); } },
    marginals: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 1, changed); } },
    joint: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 2, changed); } },
    total: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 3, changed); } }
  });

  function ch2render(svg, p, cap, stage, changed) {
    var st = svg._ch2;
    if (!st) {
      svg.innerHTML = '';
      var cells = el('g', {}, svg);
      var cellEls = [];
      for (var i = 0; i < GV; i++) for (var j = 0; j < GV; j++) {
        var xy = gridXY(i, j);
        cellEls.push(el('rect', {
          x: xy[0], y: xy[1], width: CELL - 2, height: CELL - 2, rx: 4,
          fill: countColor(F[i][j], MAXF), stroke: '#fff', 'stroke-width': 1, opacity: 0
        }, cells));
      }
      var textG = el('g', {}, svg);
      var margG = el('g', { opacity: 0 }, svg);
      var margBars = [];
      var maxRS = Math.max.apply(null, RS);
      for (var k = 0; k < GV; k++) {
        margBars.push(el('rect', { x: GX + GV * CELL + 8, y: GY + k * CELL + 6, width: 0, height: CELL - 12, rx: 3, fill: C.accent, opacity: 0.85, 'class': 'anim' }, margG));
        margBars.push(el('rect', { x: GX + k * CELL + 6, y: GY + GV * CELL + 8, width: CELL - 12, height: 0, rx: 3, fill: C.orange, opacity: 0.85, 'class': 'anim' }, margG));
      }
      txt(margG, GX + GV * CELL + 8, GY - 8, 'f_i*', { 'font-size': 10, fill: C.accent, 'font-weight': 700 });
      txt(margG, GX + GV * CELL / 2, GY + GV * CELL + 34, 'p*_j', { 'font-size': 10, fill: C.orange, 'font-weight': 700, 'text-anchor': 'middle' });
      var lg = el('g', {}, svg);
      heatLabels(svg, lg);
      var title = mathBox(svg, 150, 8, 340, 30, 'midmath');
      var nchip = mathBox(svg, 430, 500, 190, 34, 'bigmath');
      st = svg._ch2 = { cellEls: cellEls, textG: textG, margG: margG, margBars: margBars, title: title, nchip: nchip, stage: -1, maxRS: maxRS };
    }
    var total = GV * GV;
    st.cellEls.forEach(function (c, k) {
      var i = Math.floor(k / GV), j = k % GV;
      var local = stage === 0 ? clamp(p * total * 1.15 - k, 0, 1) : 1; // entrance once, on step 0
      c.setAttribute('opacity', ease(local));
    });
    // text layer rebuilt only when the stage changes
    if (st.stage !== stage) {
      st.stage = stage;
      st.textG.innerHTML = '';
      for (var i = 0; i < GV; i++) for (var j = 0; j < GV; j++) {
        if (F[i][j] <= 0) continue;
        var xy = gridXY(i, j);
        var label = stage >= 2 ? String(Math.round(F[i][j] / N * 1000)) : String(F[i][j]);
        txt(st.textG, xy[0] + CELL / 2 - 1, xy[1] + CELL / 2 + 4, label, {
          'font-size': F[i][j] >= 3 || stage >= 2 ? 10 : 8.5, 'text-anchor': 'middle',
          fill: F[i][j] / MAXF > 0.45 ? '#fff' : C.ink, 'font-family': 'ui-monospace,monospace'
        });
      }
      if (stage === 0) setMath(st.title, 'F = \\text{co-occurrence counts } f_{ij}', 'F = co-occurrence counts f_ij');
      if (stage === 1) setMath(st.title, 'f_{i*} = \\textstyle\\sum_j f_{ij},\\ \\ f_{*j} = \\textstyle\\sum_i f_{ij}', 'f_i* = sum_j f_ij,  f_*j = sum_i f_ij');
      if (stage === 2) setMath(st.title, 'p_{ij} = f_{ij} / N \\ \\text{(cells show per-mille)}', 'p_ij = f_ij / N  (cells show per-mille)');
      if (stage === 3) setMath(st.title, '\\textstyle\\sum_{ij} p_{ij} = 1', 'sum p_ij = 1');
      if (stage === 3) setMath(st.nchip, 'N = ' + N, 'N = ' + N);
      else setMath(st.nchip, '', '');
    }
    st.margG.setAttribute('opacity', stage >= 1 ? 1 : 0);
    if (stage >= 1) {
      for (var k = 0; k < GV; k++) {
        st.margBars[k * 2].setAttribute('width', RS[k] / st.maxRS * 56);
        st.margBars[k * 2 + 1].setAttribute('height', CS[k] / st.maxRS * 56);
      }
    }
    cap.textContent = [
      'The co-occurrence matrix F: cell (i,j) = count f_ij. Darker = more often together. N = ' + N + ' total.',
      'Marginals on the edges: row sums f_i* (purple), column sums p_*j (orange). tea is the most connected word.',
      'Divide every cell by N: p_ij = f_ij/N. Cells now show per-mille - a proper joint distribution.',
      'All probabilities sum to 1. With p(x,y), p(x), p(y) we have everything PMI needs.'
    ][stage];
  }

  /* ============================================================
     Chapter 3 - independence baseline: contingency + obs/exp bars
     ============================================================ */
  register(document.getElementById('ch3'), 'viz3', 'cap3', {
    table: { render: function (svg, p, cap, changed) { ch3render(svg, p, cap, 0, changed); } },
    expected: { render: function (svg, p, cap, changed) { ch3render(svg, p, cap, 1, changed); } },
    repulsion: { render: function (svg, p, cap, changed) { ch3render(svg, p, cap, 2, changed); } },
    ratio: { render: function (svg, p, cap, changed) { ch3render(svg, p, cap, 3, changed); } }
  });

  function ch3render(svg, p, cap, stage, changed) {
    var st = svg._ch3;
    if (!st) {
      svg.innerHTML = '';
      var tabG = el('g', {}, svg);
      var barG = el('g', {}, svg);
      var ratioG = el('g', { opacity: 0 }, svg);
      var chip = mathBox(svg, 60, 14, 520, 30, 'midmath');
      // ratio number line (stage 3), built once
      var rx0 = 350, rx1 = 605, ry = 330;
      var vMin = -3.2, vMax = 3.5;
      function rx(v) { return rx0 + (clamp(v, vMin, vMax) - vMin) / (vMax - vMin) * (rx1 - rx0); }
      el('line', { x1: rx0, y1: ry, x2: rx1, y2: ry, stroke: C.line, 'stroke-width': 3 }, ratioG);
      el('line', { x1: rx(0), y1: ry - 90, x2: rx(0), y2: ry + 12, stroke: C.muted, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, ratioG);
      txt(ratioG, rx(0), ry - 96, 'ratio = 1 (independence)', { 'font-size': 10, fill: C.muted, 'text-anchor': 'middle' });
      for (var v = -3; v <= 3; v++) {
        el('line', { x1: rx(v), y1: ry - 5, x2: rx(v), y2: ry + 5, stroke: C.muted, 'stroke-width': 1.5 }, ratioG);
        txt(ratioG, rx(v), ry + 20, (v > 0 ? '+' : '') + v, { 'font-size': 9, fill: C.muted, 'text-anchor': 'middle', 'font-family': 'ui-monospace,monospace' });
      }
      txt(ratioG, rx0, ry + 40, 'log2(obs/exp) = PMI, bits ->', { 'font-size': 10, fill: C.muted });
      var rng = PMI.mulberry32(31);
      st = svg._ch3 = { tabG: tabG, barG: barG, ratioG: ratioG, chip: chip, rx: rx, ry: ry, stage: -1, dotEls: [], rng: rng, pair: null };
      PAIRS_PMI.forEach(function (pr, i) {
        var d = el('circle', { cx: rx(pr.pmi), cy: ry - 26 - (i % 5) * 13, r: 5.5, fill: pr.pmi > 0 ? C.blue : C.red, 'fill-opacity': 0.85, stroke: '#fff', 'stroke-width': 1.2 }, ratioG);
        st.dotEls.push(d);
      });
      txt(ratioG, rx1, ry - 96, 'association', { 'font-size': 10, fill: C.blue, 'text-anchor': 'end', 'font-weight': 700 });
      txt(ratioG, rx0, ry - 26 - 4 * 13 - 14, 'repulsion', { 'font-size': 10, fill: C.red, 'font-weight': 700 });
    }
    // left table + right bars are rebuilt only when the stage (hence the pair) changes
    if (st.stage !== stage) {
      st.stage = stage;
      var pair = stage <= 1
        ? { a: 'tea', b: 'strong' }
        : { a: 'tea', b: 'powerful' };
      st.pair = pair;
      var i = IDX[pair.a], j = IDX[pair.b];
      var ct = PMI.contingency(F, i, j);
      var exp = ct.fi * ct.fj / N;
      st.tabG.innerHTML = '';
      st.barG.innerHTML = '';
      var x0 = 36, y0 = 96, cw = 118, chh = 92;
      el('rect', { x: x0, y: y0, width: cw * 2 + 90, height: chh * 2 + 74, rx: 10, fill: C.card, stroke: C.line }, st.tabG);
      txt(st.tabG, x0 + cw + 45, y0 + 20, 'contingency table: ' + pair.a + ' × ' + pair.b, { 'font-size': 12, 'text-anchor': 'middle', 'font-weight': 700, fill: C.ink });
      // headers
      var hdr = [pair.a + ': yes', pair.a + ': no'];
      hdr.forEach(function (h, c) {
        txt(st.tabG, x0 + 45 + cw * c + cw / 2, y0 + 44, h, { 'font-size': 10.5, 'text-anchor': 'middle', fill: C.muted, 'font-weight': 700 });
      });
      [pair.b + ': yes', pair.b + ': no'].forEach(function (h, r) {
        txt(st.tabG, x0 + 45 - 6, y0 + 70 + chh * r + chh / 2, h, { 'font-size': 10.5, 'text-anchor': 'end', fill: C.muted, 'font-weight': 700 });
      });
      var cells = [
        { v: ct.a, x: 0, y: 0, lab: 'both' }, { v: ct.c, x: 1, y: 0, lab: pair.b + ' only' },
        { v: ct.b, x: 0, y: 1, lab: pair.a + ' only' }, { v: ct.d, x: 1, y: 1, lab: 'neither' }
      ];
      cells.forEach(function (c) {
        var cx = x0 + 45 + cw * c.x, cy = y0 + 56 + chh * c.y;
        el('rect', { x: cx + 3, y: cy + 3, width: cw - 6, height: chh - 6, rx: 8, fill: c.lab === 'both' ? C.blueSoft : '#f7f5ef', stroke: C.line }, st.tabG);
        txt(st.tabG, cx + cw / 2, cy + chh / 2 - 2, String(c.v), { 'font-size': 22, 'text-anchor': 'middle', 'font-weight': 800, fill: c.lab === 'both' ? C.blue : C.ink, 'font-family': 'ui-monospace,monospace' });
        txt(st.tabG, cx + cw / 2, cy + chh / 2 + 16, c.lab, { 'font-size': 9.5, 'text-anchor': 'middle', fill: C.muted });
      });
      // right bars: observed vs expected
      var bx = 350, bwMax = 240;
      var scale = Math.max(ct.a, exp) * 1.25;
      txt(st.barG, bx, 96, 'observed vs expected (independence)', { 'font-size': 12, 'font-weight': 700, fill: C.ink });
      function bar(y, label, val, color, show) {
        txt(st.barG, bx, y + 14, label, { 'font-size': 11, fill: C.muted });
        el('rect', { x: bx + 92, y: y, width: show ? val / scale * bwMax : 0, height: 20, rx: 5, fill: color, 'class': 'anim' }, st.barG);
        if (show) txt(st.barG, bx + 92 + val / scale * bwMax + 8, y + 14, val.toFixed(val < 10 ? 2 : 0), { 'font-size': 11, fill: C.ink, 'font-family': 'ui-monospace,monospace' });
      }
      bar(130, 'observed f', ct.a, C.blue, true);
      bar(178, 'expected E', exp, C.orange, stage >= 1);
      if (stage >= 1) {
        setMath(st.chip, 'E[f_{ij}] = \\tfrac{f_i f_j}{N} = \\tfrac{' + ct.fi + ' \\cdot ' + ct.fj + '}{' + N + '} \\approx ' + exp.toFixed(2) + ' \\quad \\text{vs observed } ' + ct.a, 'E[f_ij] = f_i*f_j/N = ' + ct.fi + '*' + ct.fj + '/' + N + ' = ' + exp.toFixed(2) + '  vs observed ' + ct.a);
      } else {
        setMath(st.chip, 'a = f_{' + pair.a + ',' + pair.b + '} = ' + ct.a + '\\ \\text{(both words co-occur)}', 'a = f_(' + pair.a + ',' + pair.b + ') = ' + ct.a + ' (both)');
      }
    }
    st.ratioG.setAttribute('opacity', stage === 3 ? 1 : 0);
    if (stage === 3) {
      setMath(st.chip, '\\text{ratio} = \\tfrac{\\text{observed}}{\\text{expected}} = \\tfrac{p(x,y)}{p(x)p(y)}, \\quad \\mathrm{PMI} = \\log_2 \\text{ratio}', 'ratio = observed/expected = p(x,y)/(p(x)p(y)),  PMI = log2(ratio)');
      st.dotEls.forEach(function (d, i) {
        var local = clamp(p * st.dotEls.length * 1.2 - i, 0, 1);
        d.setAttribute('r', 5.5 * ease(local));
      });
    }
    cap.textContent = [
      'Pair (tea, strong): a = 7 both, b = 4 strong-only, c = 9 tea-only, d = 48 neither. Cells sum to N = ' + N + '.',
      'Under independence we EXPECT E = f_i*f_j/N = 11*16/68 = 2.59. Observed 7 > expected: association!',
      'Pair (tea, powerful): observed 1 < expected 1.88 - the words REPEL (ratio < 1).',
      'Every pair gets a dot at log2(obs/exp) = its PMI. Right of the dashed line: association; left: repulsion.'
    ][stage];
  }

  /* ============================================================
     Chapter 4 - the PMI formula, massaged + die example + gauge
     ============================================================ */
  register(document.getElementById('ch4'), 'viz4', 'cap4', {
    def: { render: function (svg, p, cap, changed) { ch4render(svg, p, cap, 0, changed); } },
    cond1: { render: function (svg, p, cap, changed) { ch4render(svg, p, cap, 1, changed); } },
    cond2: { render: function (svg, p, cap, changed) { ch4render(svg, p, cap, 2, changed); } },
    die: { render: function (svg, p, cap, changed) { ch4render(svg, p, cap, 3, changed); } },
    gauge: { render: function (svg, p, cap, changed) { ch4render(svg, p, cap, 4, changed); } }
  });

  function ch4render(svg, p, cap, stage, changed) {
    var st = svg._ch4;
    if (!st) {
      svg.innerHTML = '';
      var f1 = mathBox(svg, 40, 26, 560, 46, 'bigmath');
      var f2 = mathBox(svg, 40, 80, 560, 34);
      // pills showing which of the 3 forms is active
      var pills = [];
      for (var k = 0; k < 3; k++) {
        var pr = el('rect', { x: 250 + k * 48, y: 122, width: 38, height: 10, rx: 5, fill: '#efede6', 'class': 'anim' }, svg);
        pills.push(pr);
      }
      // die face (stage 3)
      var dieG = el('g', { opacity: 0, 'class': 'anim' }, svg);
      el('rect', { x: 285, y: 160, width: 70, height: 70, rx: 12, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, dieG);
      [[305, 180], [335, 180], [320, 195], [305, 210], [335, 210]].forEach(function (pp) {
        el('circle', { cx: pp[0], cy: pp[1], r: 6, fill: C.ink }, dieG);
      });
      txt(dieG, 320, 252, 'rolled a 5', { 'font-size': 11, 'text-anchor': 'middle', fill: C.muted });
      // gauge (stages 3-4)
      var gG = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var gcx = 320, gcy = 452, GR = 158;
      var vMin = -3, vMax = 3.5;
      function gAng(v) { return (180 - (clamp(v, vMin, vMax) - vMin) / (vMax - vMin) * 180) * Math.PI / 180; }
      function gPt(v, r) { var a = gAng(v); return [gcx + r * Math.cos(a), gcy - r * Math.sin(a)]; }
      function arcPath(v1, v2, r) {
        var p1 = gPt(v1, r), p2 = gPt(v2, r);
        return 'M ' + p1[0] + ' ' + p1[1] + ' A ' + r + ' ' + r + ' 0 0 1 ' + p2[0] + ' ' + p2[1];
      }
      el('path', { d: arcPath(vMin, 0, GR), fill: 'none', stroke: 'rgba(214,69,69,0.25)', 'stroke-width': 16 }, gG);
      el('path', { d: arcPath(0, vMax, GR), fill: 'none', stroke: 'rgba(47,111,237,0.25)', 'stroke-width': 16 }, gG);
      el('path', { d: arcPath(vMin, vMax, GR), fill: 'none', stroke: '#efede6', 'stroke-width': 3 }, gG);
      for (var v = -3; v <= 3; v++) {
        var t1 = gPt(v, GR - 12), t2 = gPt(v, GR + 10);
        el('line', { x1: t1[0], y1: t1[1], x2: t2[0], y2: t2[1], stroke: C.muted, 'stroke-width': 1.5 }, gG);
        var lp = gPt(v, GR + 26);
        txt(gG, lp[0], lp[1] + 3, (v > 0 ? '+' : '') + v, { 'font-size': 10, fill: C.muted, 'text-anchor': 'middle', 'font-family': 'ui-monospace,monospace' });
      }
      txt(gG, gcx, gcy + 22, '0 = independence', { 'font-size': 11, 'text-anchor': 'middle', fill: C.muted });
      txt(gG, gcx - GR - 6, gcy - 6, 'repulsion', { 'font-size': 10, 'text-anchor': 'end', fill: C.red, 'font-weight': 700 });
      txt(gG, gcx + GR + 6, gcy - 6, 'association', { 'font-size': 10, fill: C.blue, 'font-weight': 700 });
      txt(gG, gcx, gcy - GR - 40, 'PMI in bits (log2 of the obs/exp ratio)', { 'font-size': 12, 'text-anchor': 'middle', fill: C.muted, 'font-weight': 700 });
      var needle = el('line', { x1: gcx, y1: gcy, x2: gcx, y2: gcy - GR, stroke: C.ink, 'stroke-width': 4, 'stroke-linecap': 'round', 'class': 'anim' }, gG);
      var ghost = el('line', { x1: gcx, y1: gcy, x2: gcx, y2: gcy - GR, stroke: C.red, 'stroke-width': 2.5, 'stroke-dasharray': '6 4', opacity: 0, 'class': 'anim' }, gG);
      el('circle', { cx: gcx, cy: gcy, r: 8, fill: C.ink }, gG);
      var needleLab = txt(gG, gcx, gcy - GR - 16, '', { 'font-size': 13, 'text-anchor': 'middle', 'font-weight': 800, fill: C.ink });
      st = svg._ch4 = { f1: f1, f2: f2, pills: pills, dieG: dieG, gG: gG, needle: needle, ghost: ghost, needleLab: needleLab, gPt: gPt, gcy: gcy, GR: GR, stage: -1 };
    }
    if (st.stage !== stage) {
      st.stage = stage;
      var texs = [
        ['\\mathrm{PMI}(x,y) = \\log_2 \\tfrac{p(x,y)}{p(x)\\,p(y)}', 'PMI(x,y) = log2( p(x,y) / (p(x) p(y)) )',
         '\\text{in counts: } \\log_2 \\tfrac{f(x,y)\\,N}{f(x)\\,f(y)}', 'in counts: log2( f(x,y)*N / (f(x)*f(y)) )'],
        ['\\mathrm{PMI}(x,y) = \\log_2 \\tfrac{p(x\\,|\\,y)}{p(x)}', 'PMI(x,y) = log2( p(x|y) / p(x) )',
         '\\text{chain rule: } p(x,y) = p(x\\,|\\,y)\\,p(y) \\text{ cancels one } p(y)', 'chain rule: p(x,y) = p(x|y) p(y) cancels one p(y)'],
        ['\\mathrm{PMI}(x,y) = \\log_2 \\tfrac{p(y\\,|\\,x)}{p(y)}', 'PMI(x,y) = log2( p(y|x) / p(y) )',
         '\\text{symmetric: } \\mathrm{PMI}(x,y) = \\mathrm{PMI}(y,x)', 'symmetric: PMI(x,y) = PMI(y,x)'],
        ['\\log_2 \\tfrac{1/2}{1/6} = \\log_2 3 \\approx \\mathbf{1.58}\\ \\text{bits}', 'log2( (1/2) / (1/6) ) = log2 3 = 1.58 bits',
         'P(\\text{5} \\mid \\text{result} > 4) = \\tfrac12 \\text{ vs } P(5) = \\tfrac16', 'P(5 | result>4) = 1/2  vs  P(5) = 1/6'],
        ['\\mathrm{PMI}(\\text{tea}, \\text{strong}) \\approx +1.44, \\quad \\mathrm{PMI}(\\text{tea}, \\text{powerful}) \\approx -0.91', 'PMI(tea,strong) = +1.44,  PMI(tea,powerful) = -0.91',
         '\\text{bits: each doubling of the ratio adds } 1 \\text{ bit}', 'bits: each doubling of the ratio adds 1 bit']
      ];
      setMath(st.f1, texs[stage][0], texs[stage][1]);
      setMath(st.f2, texs[stage][2], texs[stage][3]);
      st.pills.forEach(function (pr, k) {
        pr.setAttribute('fill', stage <= 2 && k === stage ? C.accent : '#efede6');
      });
    }
    st.dieG.setAttribute('opacity', stage === 3 ? clamp((p - 0.2) / 0.5, 0, 1) : 0);
    var showGauge = stage >= 3;
    st.gG.setAttribute('opacity', showGauge ? 1 : 0);
    if (showGauge) {
      var v = stage === 3 ? DIE.pmi * ease(clamp(p, 0, 1)) : PMI.pmi(F, IDX.tea, IDX.strong);
      var tip = st.gPt(v, st.GR - 4);
      st.needle.setAttribute('x2', tip[0]); st.needle.setAttribute('y2', tip[1]);
      st.needleLab.setAttribute('x', tip[0]); st.needleLab.setAttribute('y', tip[1] - 10);
      st.needleLab.textContent = (v > 0 ? '+' : '') + v.toFixed(2) + ' bits';
      if (stage === 4) {
        var vg = PMI.pmi(F, IDX.tea, IDX.powerful);
        var tipg = st.gPt(vg, st.GR - 4);
        st.ghost.setAttribute('x2', tipg[0]); st.ghost.setAttribute('y2', tipg[1]);
        st.ghost.setAttribute('opacity', clamp((p - 0.4) / 0.4, 0, 1));
      } else st.ghost.setAttribute('opacity', 0);
    }
    cap.textContent = [
      'PMI(x,y) = log2( p(x,y) / (p(x)p(y)) ) - the log of the obs/exp ratio.',
      'Massage: p(x,y) = p(x|y) p(y), so PMI = log2( p(x|y) / p(x) ): how much likelier is x GIVEN y?',
      'Symmetrically PMI = log2( p(y|x) / p(y) ). Same number - PMI(x,y) = PMI(y,x).',
      'Die: P(5 | result>4) = 1/2 but P(5) = 1/6, so PMI = log2(3) = +1.58 bits. Needle swings right.',
      'The gauge in bits: tea x strong = +1.44 (blue side), tea x powerful = -0.91 (red, dashed). 0 = independence.'
    ][stage];
  }

  /* ============================================================
     Chapter 5 - reading PMI values: bars + PPMI clipping
     ============================================================ */
  var ch5pairs = (function () {
    var top = PAIRS_PMI.slice(0, 7);
    var neg = PAIRS_PMI.filter(function (pr) { return pr.pmi < 0; });
    neg.forEach(function (pr) { if (top.indexOf(pr) === -1) top.push(pr); });
    top.sort(function (a, b) { return b.pmi - a.pmi; });
    return top.slice(0, 8);
  })();

  register(document.getElementById('ch5'), 'viz5', 'cap5', {
    bars: { render: function (svg, p, cap, changed) { ch5render(svg, p, cap, 0, changed); } },
    signs: { render: function (svg, p, cap, changed) { ch5render(svg, p, cap, 1, changed); } },
    rare: { render: function (svg, p, cap, changed) { ch5render(svg, p, cap, 2, changed); } },
    ppmi: { render: function (svg, p, cap, changed) { ch5render(svg, p, cap, 3, changed); } }
  });

  function ch5render(svg, p, cap, stage, changed) {
    var st = svg._ch5;
    if (!st) {
      svg.innerHTML = '';
      hatchDefs(svg, 'hatch5', C.red);
      var zeroX = 250, scale = 62; // px per bit
      var y0 = 88, bh = 28, gap = 18;
      var zonePos = el('rect', { x: zeroX, y: 70, width: 330, height: y0 - 70 + ch5pairs.length * (bh + gap), fill: 'rgba(47,111,237,0.05)', opacity: 0, 'class': 'anim' }, svg);
      var zoneNeg = el('rect', { x: 40, y: 70, width: zeroX - 40, height: y0 - 70 + ch5pairs.length * (bh + gap), fill: 'rgba(214,69,69,0.05)', opacity: 0, 'class': 'anim' }, svg);
      var barsG = el('g', {}, svg);
      var barEls = [], labEls = [], valEls = [];
      ch5pairs.forEach(function (pr, i) {
        var y = y0 + i * (bh + gap);
        txt(svg, zeroX - 10, y + bh / 2 + 4, pr.a + ' × ' + pr.b, { 'font-size': 11.5, 'text-anchor': 'end', fill: C.ink });
        barEls.push(el('rect', { x: zeroX, y: y, width: 0, height: bh, rx: 5, fill: pr.pmi > 0 ? C.blue : C.red, 'class': 'anim' }, barsG));
        valEls.push(txt(barsG, zeroX, y + bh / 2 + 4, '', { 'font-size': 11, 'font-family': 'ui-monospace,monospace', fill: C.muted }));
        labEls.push({ y: y, pr: pr });
      });
      // -inf hatched bar for the never-seen pair (stage 2 overlay)
      var infY = y0 + ch5pairs.length * (bh + gap);
      var infG = el('g', { opacity: 0, 'class': 'anim' }, svg);
      txt(infG, zeroX - 10, infY + bh / 2 + 4, 'storm × tea', { 'font-size': 11.5, 'text-anchor': 'end', fill: C.ink });
      var infBar = el('rect', { x: 40, y: infY, width: zeroX - 40, height: bh, rx: 5, fill: 'url(#hatch5)', stroke: C.red, 'stroke-width': 1.2 }, infG);
      txt(infG, 46, infY + bh / 2 + 4, 'f = 0  →  log(0) = −∞', { 'font-size': 11, fill: C.red, 'font-weight': 700 });
      // axis
      el('line', { x1: zeroX, y1: 66, x2: zeroX, y2: infY + bh + 10, stroke: C.ink, 'stroke-width': 2 }, svg);
      for (var v = -3; v <= 3; v++) {
        var x = zeroX + v * scale;
        el('line', { x1: x, y1: infY + bh + 5, x2: x, y2: infY + bh + 10, stroke: C.muted, 'stroke-width': 1.5 }, svg);
        txt(svg, x, infY + bh + 23, (v > 0 ? '+' : '') + v, { 'font-size': 9.5, 'text-anchor': 'middle', fill: C.muted, 'font-family': 'ui-monospace,monospace' });
      }
      txt(svg, zeroX, infY + bh + 40, 'PMI, bits (log2)', { 'font-size': 11, 'text-anchor': 'middle', fill: C.muted });
      var notePos = txt(svg, zeroX + 6, 60, '> 0 association', { 'font-size': 11, fill: C.blue, 'font-weight': 700, opacity: 0, 'class': 'anim' });
      var noteZero = txt(svg, zeroX, 44, '= 0 independence', { 'font-size': 10, 'text-anchor': 'middle', fill: C.muted, opacity: 0, 'class': 'anim' });
      var noteNeg = txt(svg, zeroX - 6, 60, '< 0 repulsion', { 'font-size': 11, 'text-anchor': 'end', fill: C.red, 'font-weight': 700, opacity: 0, 'class': 'anim' });
      var chip = mathBox(svg, 380, 14, 250, 30, 'midmath');
      st = svg._ch5 = { barEls: barEls, valEls: valEls, zeroX: zeroX, scale: scale, infG: infG, zonePos: zonePos, zoneNeg: zoneNeg, notePos: notePos, noteZero: noteZero, noteNeg: noteNeg, chip: chip, stage: -1 };
    }
    var n = ch5pairs.length;
    ch5pairs.forEach(function (pr, i) {
      var local = stage === 0 ? clamp(p * n * 1.25 - i, 0, 1) : 1; // bars grow in once, on step 0
      var val = stage === 3 ? Math.max(pr.pmi, 0) * ease(clamp((p - 0.15) / 0.6, 0, 1)) : pr.pmi;
      var w = Math.abs(val) * st.scale * local;
      var b = st.barEls[i];
      if (val >= 0) { b.setAttribute('x', st.zeroX); } else { b.setAttribute('x', st.zeroX - w); }
      b.setAttribute('width', w);
      b.setAttribute('fill', stage === 3 && pr.pmi < 0 ? '#b9b2a4' : (pr.pmi > 0 ? C.blue : C.red));
      var vv = st.valEls[i];
      var shown = stage === 3 && pr.pmi < 0 ? '0 (clipped)' : (pr.pmi > 0 ? '+' : '') + pr.pmi.toFixed(2);
      vv.textContent = shown;
      vv.setAttribute('x', val >= 0 ? st.zeroX + w + 6 : st.zeroX - w - 6);
      vv.setAttribute('text-anchor', val >= 0 ? 'start' : 'end');
    });
    st.infG.setAttribute('opacity', stage === 2 ? 1 : 0);
    var notes = stage === 1 ? 1 : 0;
    st.zonePos.setAttribute('opacity', notes); st.zoneNeg.setAttribute('opacity', notes);
    st.notePos.setAttribute('opacity', notes); st.noteZero.setAttribute('opacity', notes); st.noteNeg.setAttribute('opacity', notes);
    if (st.stage !== stage) {
      st.stage = stage;
      if (stage === 2) setMath(st.chip, '\\text{rare pair } f=1:\\ \\mathrm{PMI} = +3.09 \\text{ bits — inflated!}', 'rare pair f=1: PMI = +3.09 bits - inflated!');
      else if (stage === 3) setMath(st.chip, '\\mathrm{PPMI} = \\max(\\mathrm{PMI}, 0)', 'PPMI = max(PMI, 0)');
      else setMath(st.chip, '', '');
    }
    cap.textContent = [
      'One bar per observed pair, PMI in bits. The TOP bar (powerful x storm, +3.09) occurred only once...',
      'Signs: > 0 association, = 0 independence, < 0 repulsion. log2 => units are bits: +1 bit = twice as likely as chance.',
      'Caveat: rare events inflate PMI (small p(x) => big 1/p(x)), and f = 0 gives log(0) = -inf (hatched). Negatives on rare events are unreliable.',
      'PPMI = max(PMI, 0): red bars flatten onto the zero line. What survives is a non-negative association matrix.'
    ][stage];
  }

  /* ============================================================
     Chapter 6 - worked example: full PMI / PPMI heatmap
     ============================================================ */
  register(document.getElementById('ch6'), 'viz6', 'cap6', {
    heat: { render: function (svg, p, cap, changed) { ch6render(svg, p, cap, 0, changed); } },
    top: { render: function (svg, p, cap, changed) { ch6render(svg, p, cap, 1, changed); } },
    clipped: { render: function (svg, p, cap, changed) { ch6render(svg, p, cap, 2, changed); } },
    read: { render: function (svg, p, cap, changed) { ch6render(svg, p, cap, 3, changed); } }
  });

  function ch6render(svg, p, cap, stage, changed) {
    var st = svg._ch6;
    if (!st) {
      svg.innerHTML = '';
      hatchDefs(svg, 'hatch6', C.red);
      var cells = el('g', {}, svg);
      var cellEls = [];
      for (var i = 0; i < GV; i++) for (var j = 0; j < GV; j++) {
        var xy = gridXY(i, j);
        cellEls.push(el('rect', {
          x: xy[0], y: xy[1], width: CELL - 2, height: CELL - 2, rx: 4,
          fill: pmiColor(PMI_M[i][j], 'url(#hatch6)'), stroke: '#fff', 'stroke-width': 1, opacity: 0, 'class': 'anim'
        }, cells));
      }
      var textG = el('g', {}, svg);
      var lg = el('g', {}, svg);
      heatLabels(svg, lg);
      // legend
      var lx = GX, ly = GY + GV * CELL + 34, lw = GV * CELL;
      for (var s = 0; s < 60; s++) {
        var v = -PMI_ABS_MAX + (s / 59) * 2 * PMI_ABS_MAX;
        el('rect', { x: lx + s / 60 * lw, y: ly, width: lw / 60 + 1, height: 10, fill: pmiColor(v) }, lg);
      }
      txt(lg, lx, ly + 24, '−∞ / strongly negative', { 'font-size': 9.5, fill: C.red });
      txt(lg, lx + lw / 2, ly + 24, '0 (independence)', { 'font-size': 9.5, 'text-anchor': 'middle', fill: C.muted });
      txt(lg, lx + lw, ly + 24, '+3.2 bits association', { 'font-size': 9.5, 'text-anchor': 'end', fill: C.blue });
      var title = mathBox(svg, 130, 8, 380, 30, 'midmath');
      var chip = mathBox(svg, 400, 506, 230, 34, 'bigmath');
      st = svg._ch6 = { cellEls: cellEls, textG: textG, title: title, chip: chip, stage: -1 };
    }
    var total = GV * GV;
    st.cellEls.forEach(function (c, k) {
      var i = Math.floor(k / GV), j = k % GV;
      var local = stage === 0 ? clamp(p * total * 1.12 - k, 0, 1) : 1; // reveal once, on step 0
      c.setAttribute('opacity', ease(local));
      // stage 2 switches to PPMI colors; fill transition is CSS-animated via .anim
      c.setAttribute('fill', pmiColor(stage === 2 ? PPMI_M[i][j] : PMI_M[i][j], 'url(#hatch6)'));
    });
    if (st.stage !== stage) {
      st.stage = stage;
      st.textG.innerHTML = '';
      if (stage === 0) setMath(st.title, '\\mathrm{PMI}(x,y) = \\log_2 \\tfrac{f_{xy} N}{f_x f_y} \\text{, matrix view}', 'PMI(x,y) = log2( f_xy*N / (f_x*f_y) ), matrix view');
      if (stage === 1) {
        setMath(st.title, '\\text{strongest cells labeled (bits)}', 'strongest cells labeled (bits)');
        var top = PAIRS_PMI.slice(0, 4).concat(PAIRS_PMI.filter(function (pr) { return pr.a === 'tea' && pr.b === 'powerful'; }));
        top.forEach(function (pr) {
          var xy = gridXY(pr.i, pr.j);
          txt(st.textG, xy[0] + CELL / 2 - 1, xy[1] + CELL / 2 + 4, (pr.pmi > 0 ? '+' : '') + pr.pmi.toFixed(2), {
            'font-size': 9.5, 'text-anchor': 'middle', 'font-weight': 800,
            fill: Math.abs(pr.pmi) / PMI_ABS_MAX > 0.4 ? '#fff' : C.ink, 'font-family': 'ui-monospace,monospace'
          });
        });
      }
      if (stage === 2) setMath(st.title, '\\mathrm{PPMI} = \\max(\\mathrm{PMI}, 0): \\text{ red cells clipped to 0}', 'PPMI = max(PMI, 0): red cells clipped to 0');
      if (stage === 3) {
        setMath(st.title, '\\text{read the matrix}', 'read the matrix');
        setMath(st.chip, '\\mathrm{PMI}(\\text{tea},\\text{strong}) = +1.44', 'PMI(tea,strong) = +1.44 bits');
      } else setMath(st.chip, '', '');
    }
    cap.textContent = [
      'The full 10x10 PMI matrix computed live: red = repulsion, neutral = 0, blue = association (bits). Hatched = never co-occurred (-inf).',
      'Labeled cells: powerful x storm +3.09 (f=1, inflated), powerful x computer +2.67, powerful x engine +2.35, tea x strong +1.44; tea x powerful -0.91.',
      'PPMI view: every negative (and -inf) cell clipped to neutral. A sparse non-negative association matrix.',
      'PMI(tea, strong) = +1.44 bits; PPMI(tea, powerful) = 0. This term-term matrix is the classic alternative to tf-idf.'
    ][stage];
  }

  /* ============================================================
     Chapter 7 - PMI vs MI: event bubbles + running E[PMI]
     ============================================================ */
  var ch7pairs = PAIRS.slice(); // all observed pairs by count
  var ch7order = PAIRS.slice().sort(function (a, b) { return b.pij - a.pij; }); // consumption order

  register(document.getElementById('ch7'), 'viz7', 'cap7', {
    bubbles: { render: function (svg, p, cap, changed) { ch7render(svg, p, cap, 0, changed); } },
    expect: { render: function (svg, p, cap, changed) { ch7render(svg, p, cap, 1, changed); } },
    running: { render: function (svg, p, cap, changed) { ch7render(svg, p, cap, 2, changed); } },
    result: { render: function (svg, p, cap, changed) { ch7render(svg, p, cap, 3, changed); } }
  });

  function ch7render(svg, p, cap, stage, changed) {
    var st = svg._ch7;
    if (!st) {
      svg.innerHTML = '';
      var rng = PMI.mulberry32(77);
      var bubG = el('g', {}, svg);
      var panelG = el('g', {}, svg);
      el('rect', { x: 424, y: 84, width: 196, height: 380, rx: 10, fill: C.card, stroke: C.line }, panelG);
      txt(panelG, 522, 108, 'running  Σ p·PMI', { 'font-size': 12, 'text-anchor': 'middle', 'font-weight': 700, fill: C.ink });
      var readout = txt(panelG, 522, 160, '0.00', { 'font-size': 30, 'text-anchor': 'middle', 'font-weight': 800, fill: C.accent, 'font-family': 'ui-monospace,monospace' });
      txt(panelG, 522, 180, 'bits so far', { 'font-size': 10, 'text-anchor': 'middle', fill: C.muted });
      // track 0..MI
      el('rect', { x: 444, y: 210, width: 156, height: 14, rx: 7, fill: '#efede6', stroke: C.line }, panelG);
      var fill = el('rect', { x: 444, y: 210, width: 0, height: 14, rx: 7, fill: C.accent, 'class': 'anim' }, panelG);
      var miTick = el('line', { x1: 444 + 156, y1: 204, x2: 444 + 156, y2: 230, stroke: C.ink, 'stroke-width': 2.5 }, panelG);
      txt(panelG, 444 + 156, 246, 'MI = ' + MI.toFixed(2), { 'font-size': 10, 'text-anchor': 'end', fill: C.ink, 'font-weight': 700 });
      txt(panelG, 444, 246, '0', { 'font-size': 10, fill: C.muted });
      var formula = mathBox(panelG, 436, 280, 180, 60);
      var consumedLab = txt(panelG, 522, 420, '', { 'font-size': 11, 'text-anchor': 'middle', fill: C.muted, 'font-family': 'ui-monospace,monospace' });
      // bubbles
      var maxPij = ch7order[0].pij;
      var bubEls = [];
      ch7pairs.forEach(function (pr) {
        var bx = 52 + rng() * 330, by = 96 + rng() * 380;
        var r = 7 + Math.sqrt(pr.pij / maxPij) * 30;
        var g = el('g', {}, bubG);
        var ring = el('circle', { cx: bx, cy: by, r: r + 4, fill: 'none', stroke: C.accent, 'stroke-width': 3, opacity: 0, 'class': 'anim' }, g);
        var c = el('circle', { cx: bx, cy: by, r: 0, fill: pr.pmi > 0 ? C.blue : C.red, 'fill-opacity': 0.75, stroke: '#fff', 'stroke-width': 1.5, 'class': 'anim' }, g);
        var t = txt(g, bx, by + 3.5, pr.a.slice(0, 4) + '·' + pr.b.slice(0, 4), { 'font-size': 8.5, 'text-anchor': 'middle', fill: '#fff', 'font-weight': 700, opacity: 0, 'class': 'anim' });
        bubEls.push({ g: g, c: c, ring: ring, t: t, r: r, pr: pr, bx: bx, by: by });
      });
      txt(svg, 210, 60, 'bubble area ∝ p(x,y)   ·   color = sign of PMI', { 'font-size': 12, 'text-anchor': 'middle', fill: C.muted });
      st = svg._ch7 = { bubEls: bubEls, readout: readout, fill: fill, formula: formula, consumedLab: consumedLab, stage: -1 };
    }
    var n = st.bubEls.length;
    // consumption progress: 0 bubbles at stage 0, fills up through stages 1-2, all at stage 3
    var kMax = stage === 0 ? 0 : stage === 1 ? ease(clamp(p, 0, 1)) : stage === 2 ? clamp(p, 0, 1) : 1;
    var k = Math.floor(kMax * n);
    // Each bubble is an unordered pair {x,y}; its probability mass is 2*p(x,y)
    // because the symmetric joint distribution counts (x,y) and (y,x) separately.
    // Then sum over bubbles of mass*PMI equals MI exactly.
    st.bubEls.forEach(function (b, i) {
      var local = stage === 0 ? clamp(p * n * 1.25 - i, 0, 1) : 1; // entrance once, on step 0
      b.c.setAttribute('r', b.r * ease(local));
      b.t.setAttribute('opacity', b.r * ease(local) > 17 ? 0.95 : 0);
      var consumed = i < k && stage >= 1;
      b.ring.setAttribute('opacity', consumed ? 1 : 0);
    });
    // running sum ordered by pij desc, like the visual absorption
    var running = 0;
    if (stage >= 1) {
      for (var q = 0; q < k; q++) running += 2 * ch7order[q].pij * ch7order[q].pmi;
      st.readout.textContent = (running > 0 ? '+' : '') + running.toFixed(2);
      st.fill.setAttribute('width', clamp(running / MI, 0, 1) * 156);
      st.consumedLab.textContent = k + ' / ' + n + ' events absorbed';
    } else {
      st.readout.textContent = '0.00';
      st.fill.setAttribute('width', 0);
      st.consumedLab.textContent = '';
    }
    if (st.stage !== stage) {
      st.stage = stage;
      if (stage === 1) setMath(st.formula, 'I(X,Y) = \\mathbb{E}[\\mathrm{PMI}] = \\textstyle\\sum p(x,y)\\,\\mathrm{PMI}(x,y)', 'I(X,Y) = E[PMI] = sum p(x,y)*PMI(x,y)');
      else if (stage === 2 || stage === 3) setMath(st.formula, 'I(X,Y) = \\textstyle\\sum_{x,y} p(x,y) \\log_2 \\tfrac{p(x,y)}{p(x)p(y)}', 'I(X,Y) = sum p(x,y) * log2( p(x,y)/(p(x)p(y)) )');
      else setMath(st.formula, '', '');
    }
    if (stage === 3) st.readout.textContent = '+' + MI.toFixed(2);
    cap.textContent = [
      'Each bubble = one observed pair. Area = p(x,y), blue = positive PMI, red = negative. Rare pairs are small.',
      'MI = E[PMI] = sum p(x,y)*PMI(x,y): absorb bubbles (largest p first) into the running sum...',
      'The running weighted sum converges as more events are absorbed - positives and negatives mix.',
      'Final: MI = +' + MI.toFixed(2) + ' bits for the toy corpus. MI >= 0 always; PMI per pair can be negative.'
    ][stage];
  }

  /* ============================================================
     Chapter 8 - PMI in NLP practice: pipeline + embeddings
     ============================================================ */
  register(document.getElementById('ch8'), 'viz8', 'cap8', {
    pipeline: { render: function (svg, p, cap, changed) { ch8render(svg, p, cap, 0, changed); } },
    code: { render: function (svg, p, cap, changed) { ch8render(svg, p, cap, 1, changed); } },
    embed: { render: function (svg, p, cap, changed) { ch8render(svg, p, cap, 2, changed); } }
  });

  function ch8render(svg, p, cap, stage, changed) {
    var st = svg._ch8;
    if (!st) {
      svg.innerHTML = '';
      var pw = 176, ph = 190, py = 130;
      var panelsG = [];
      var p1 = panel(svg, 24, py, pw, ph, '1 · toy corpus');
      var p2 = panel(svg, 232, py, pw, ph, '2 · counts F');
      var p3 = panel(svg, 440, py, pw, ph, '3 · PPMI matrix');
      // panel 1: text lines
      PMI.CORPUS.slice(0, 7).forEach(function (s, i) {
        txt(p1, 34, py + 40 + i * 20, (s.length > 24 ? s.slice(0, 23) + '…' : s), { 'font-size': 9.5, fill: '#33404f', 'font-family': 'ui-monospace,monospace' });
      });
      txt(p1, 34, py + ph - 12, '… 21 sentences, window ±3', { 'font-size': 9, fill: C.muted });
      // panel 2: mini count heatmap
      var m0x = 244, m0y = py + 34, mc = 15.2;
      for (var i = 0; i < GV; i++) for (var j = 0; j < GV; j++) {
        el('rect', { x: m0x + j * mc, y: m0y + i * mc, width: mc - 1, height: mc - 1, fill: countColor(F[i][j], MAXF) }, p2);
      }
      txt(p2, 244 + GV * mc / 2, py + ph - 12, 'f_ij counts, N = ' + N, { 'font-size': 9, 'text-anchor': 'middle', fill: C.muted });
      // panel 3: mini PPMI heatmap
      for (var a = 0; a < GV; a++) for (var b = 0; b < GV; b++) {
        el('rect', { x: 452 + b * mc, y: py + 34 + a * mc, width: mc - 1, height: mc - 1, fill: pmiColor(PPMI_M[a][b]) }, p3);
      }
      txt(p3, 452 + GV * mc / 2, py + ph - 12, 'PPMI = max(PMI, 0)', { 'font-size': 9, 'text-anchor': 'middle', fill: C.muted });
      // arrows
      var arrG = el('g', {}, svg);
      [[200, 232], [408, 440]].forEach(function (aa) {
        el('line', { x1: aa[0], y1: py + ph / 2, x2: aa[1] - 4, y2: py + ph / 2, stroke: C.accent, 'stroke-width': 3 }, arrG);
        el('path', { d: 'M ' + aa[1] + ' ' + (py + ph / 2) + ' l -9 -6 l 0 12 z', fill: C.accent }, arrG);
      });
      // embeddings scatter (stage 2)
      var embG = el('g', { opacity: 0, 'class': 'anim' }, svg);
      el('rect', { x: 24, y: 356, width: 592, height: 180, rx: 10, fill: C.card, stroke: C.line }, embG);
      txt(embG, 320, 378, '4 · embeddings: SVD of the PPMI matrix (or SGNS ≈ implicit factorization, Levy & Goldberg 2014)', { 'font-size': 11.5, 'text-anchor': 'middle', 'font-weight': 700, fill: C.ink });
      var rng = PMI.mulberry32(2024);
      var wordPos = {};
      VOCAB.forEach(function (w) {
        // strong and tea deliberately land close; powerful/storm far away
        if (w === 'strong') wordPos[w] = [300, 440];
        else if (w === 'tea') wordPos[w] = [336, 452];
        else if (w === 'powerful') wordPos[w] = [520, 470];
        else if (w === 'storm') wordPos[w] = [540, 430];
        else wordPos[w] = [60 + rng() * 200, 410 + rng() * 100];
        var d = el('circle', { cx: wordPos[w][0], cy: wordPos[w][1], r: 7, fill: w === 'tea' || w === 'strong' ? C.accent : (w === 'powerful' || w === 'storm' ? C.red : C.blue), 'fill-opacity': 0.85, stroke: '#fff', 'stroke-width': 1.5 }, embG);
        txt(embG, wordPos[w][0], wordPos[w][1] + 22, w, { 'font-size': 10, 'text-anchor': 'middle', fill: C.ink, 'font-weight': 700 });
      });
      var link = el('line', { x1: wordPos.strong[0], y1: wordPos.strong[1], x2: wordPos.tea[0], y2: wordPos.tea[1], stroke: C.accent, 'stroke-width': 3, 'stroke-dasharray': '6 4' }, embG);
      txt(embG, (wordPos.strong[0] + wordPos.tea[0]) / 2, (wordPos.strong[1] + wordPos.tea[1]) / 2 - 12, 'close: PMI +1.44', { 'font-size': 10, 'text-anchor': 'middle', fill: C.accent, 'font-weight': 700 });
      var panelRects = [p1.firstChild, p2.firstChild, p3.firstChild];
      st = svg._ch8 = { panels: panelRects, embG: embG, stage: -1 };
    }
    // highlight one pipeline stage per step; panels persist, only strokes change
    st.panels.forEach(function (r, i) {
      var on = (stage === 0 && false) || stage === 1 && i === 1 || stage === 2 && i === 2;
      r.setAttribute('stroke', on ? C.accent : C.line);
      r.setAttribute('stroke-width', on ? 3 : 1);
    });
    st.embG.setAttribute('opacity', stage === 2 ? clamp((p - 0.3) / 0.5, 0, 1) : 0);
    cap.textContent = [
      'The whole pipeline: toy corpus -> windowed count matrix F -> PPMI matrix. Everything on this page is this pipeline, computed live.',
      'In Python: Counter + numpy over a sliding window; PMI = log2(P/N outer product), PPMI = clip at 0 (see the code).',
      'SGNS/word2vec ≈ implicit factorization of the (shifted) PMI matrix: associated words end up close in embedding space.'
    ][stage];
  }

  /* ============================================================
     Chapter 9 - recap
     ============================================================ */
  register(document.getElementById('ch9'), 'viz9', 'cap9', {
    formulas: { render: function (svg, p, cap, changed) { ch9render(svg, p, cap, 0, changed); } },
    caveats: { render: function (svg, p, cap, changed) { ch9render(svg, p, cap, 1, changed); } },
    summary: { render: function (svg, p, cap, changed) { ch9render(svg, p, cap, 2, changed); } }
  });

  function ch9render(svg, p, cap, stage, changed) {
    var st = svg._ch9;
    if (!st) {
      svg.innerHTML = '';
      var f1 = mathBox(svg, 40, 40, 560, 48, 'bigmath');
      var f2 = mathBox(svg, 40, 104, 560, 40, 'bigmath');
      var f3 = mathBox(svg, 40, 160, 560, 48, 'bigmath');
      var cavG = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var items = [
        ['rare words inflate PMI', C.orange],
        ['log(0) = −∞, negatives unreliable → PPMI', C.red],
        ['bigger corpus → more reliable estimates', C.blue]
      ];
      items.forEach(function (it, i) {
        var x = 60 + i * 190;
        el('rect', { x: x, y: 260, width: 170, height: 120, rx: 12, fill: C.card, stroke: C.line }, cavG);
        el('circle', { cx: x + 26, cy: 292, r: 10, fill: it[1], 'fill-opacity': 0.85 }, cavG);
        var words = it[0].split(' ');
        var line1 = words.slice(0, 3).join(' '), line2 = words.slice(3, 7).join(' '), line3 = words.slice(7).join(' ');
        txt(cavG, x + 44, 288, line1, { 'font-size': 10.5, fill: C.ink, 'font-weight': 700 });
        txt(cavG, x + 14, 308, line2, { 'font-size': 10, fill: C.muted });
        if (line3) txt(cavG, x + 14, 322, line3, { 'font-size': 10, fill: C.muted });
      });
      var sumG = el('g', { opacity: 0, 'class': 'anim' }, svg);
      // mini summary: gauge needle + bar + heatmap chip row
      var g = el('g', {}, sumG);
      el('rect', { x: 40, y: 250, width: 560, height: 150, rx: 12, fill: C.card, stroke: C.line }, sumG);
      txt(sumG, 320, 280, 'the whole story on one card', { 'font-size': 13, 'text-anchor': 'middle', 'font-weight': 800, fill: C.ink });
      var chipData = [
        ['PMI = log2(obs/exp), bits', C.accent],
        ['PMI(tea,strong) = +1.44', C.blue],
        ['PPMI = max(PMI,0)', C.green],
        ['MI = E[PMI] = +' + MI.toFixed(2) + ' bits', C.orange]
      ];
      chipData.forEach(function (cd, i) {
        var x = 66 + (i % 2) * 270, y = 306 + Math.floor(i / 2) * 40;
        el('rect', { x: x, y: y, width: 250, height: 30, rx: 8, fill: '#f4f2ec', stroke: C.line }, sumG);
        el('circle', { cx: x + 16, cy: y + 15, r: 6, fill: cd[1] }, sumG);
        txt(sumG, x + 30, y + 19.5, cd[0], { 'font-size': 12, fill: C.ink, 'font-family': 'ui-monospace,monospace' });
      });
      st = svg._ch9 = { f1: f1, f2: f2, f3: f3, cavG: cavG, sumG: sumG, stage: -1 };
      setMath(st.f1, '\\mathrm{PMI}(x,y) = \\log_2 \\tfrac{p(x,y)}{p(x)p(y)} = \\log_2 \\tfrac{p(x\\,|\\,y)}{p(x)}', 'PMI(x,y) = log2( p(x,y)/(p(x)p(y)) ) = log2( p(x|y)/p(x) )');
      setMath(st.f2, '\\mathrm{PPMI}(x,y) = \\max(\\mathrm{PMI}(x,y),\\ 0)', 'PPMI(x,y) = max(PMI(x,y), 0)');
      setMath(st.f3, 'I(X,Y) = \\textstyle\\sum_{x,y} p(x,y)\\,\\mathrm{PMI}(x,y) = \\mathbb{E}[\\mathrm{PMI}] \\ge 0', 'I(X,Y) = sum p(x,y)*PMI(x,y) = E[PMI] >= 0');
    }
    st.cavG.setAttribute('opacity', stage === 1 ? 1 : 0);
    st.sumG.setAttribute('opacity', stage === 2 ? clamp((p - 0.3) / 0.5, 0, 1) : 0);
    cap.textContent = [
      'PMI = log2 of the obs/exp ratio (= log2 p(x|y)/p(x)); PPMI clips at 0; MI is the expectation of PMI.',
      'Caveats: rare events inflate PMI, log(0) = -inf and negative PMI on rare events is unreliable (use PPMI), estimates improve with corpus size.',
      'Use PMI for word-word / word-context association: collocations, term-term matrices, embeddings.'
    ][stage];
  }

  update();
})();
