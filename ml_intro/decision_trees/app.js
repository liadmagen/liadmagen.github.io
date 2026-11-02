/* Scroll-driven visualizations for the decision-tree tutorial.
   All math comes from ml-math.js (window.MLM). No external libraries. */
(function () {
  'use strict';
  var ML = window.MLM;
  if (!ML) return;

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
    line: '#e5e1d8', green: '#1f9d63', accent: '#6d5bd0'
  };

  var PW = 620, PH = 500, PX = 10, PY = 40;
  function sx(x) { return PX + (x / 10) * PW; }
  function sy(y) { return PY + PH - (y / 10) * PH; }

  function frame(svg, withAxes) {
    el('rect', { x: PX, y: PY, width: PW, height: PH, fill: '#fdfcfa', stroke: C.line, rx: 8 }, svg);
    if (withAxes) {
      for (var i = 0; i <= 10; i += 2) {
        el('line', { x1: sx(i), y1: sy(0), x2: sx(i), y2: sy(10), stroke: '#efede6', 'stroke-width': 1 }, svg);
        el('line', { x1: sx(0), y1: sy(i), x2: sx(10), y2: sy(i), stroke: '#efede6', 'stroke-width': 1 }, svg);
        txt(svg, sx(i), sy(0) + 16, String(i), { 'font-size': 10, fill: C.muted, 'text-anchor': 'middle', 'font-family': 'ui-monospace,monospace' });
        txt(svg, sx(0) - 8, sy(i) + 3, String(i), { 'font-size': 10, fill: C.muted, 'text-anchor': 'end', 'font-family': 'ui-monospace,monospace' });
      }
      txt(svg, sx(5), sy(0) + 32, 'feature x1', { 'font-size': 12, fill: C.muted, 'text-anchor': 'middle' });
      var yl = txt(svg, 16, sy(5), 'feature x2', { 'font-size': 12, fill: C.muted, 'text-anchor': 'middle' });
      yl.setAttribute('transform', 'rotate(-90 16 ' + sy(5) + ')');
    }
  }

  function drawPoints(svg, data, opts) {
    opts = opts || {};
    var g = el('g', {}, svg);
    var rng = ML.mulberry32(1234);
    var order = data.X.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    data.X.forEach(function (p, i) {
      var c = el('circle', {
        'class': 'anim', cx: sx(p[0]), cy: sy(p[1]), r: 0,
        fill: data.y[i] === 0 ? C.blue : C.orange,
        'fill-opacity': opts.fillOpacity != null ? opts.fillOpacity : 0.9,
        stroke: '#fff', 'stroke-width': 1.2
      }, g);
      c.dataset.order = order.indexOf(i);
      c.dataset.finalR = opts.r || 5.5;
      c.dataset.i = i;
    });
    return g;
  }

  function animatePointRadii(g, p) {
    var kids = g.children;
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      var local = clamp(p * kids.length * 1.15 - (+c.dataset.order), 0, 1);
      c.setAttribute('r', (+c.dataset.finalR) * ease(local));
    }
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

  /* ============================================================
     Chapter 1 - the dataset
     ============================================================ */
  var data1 = ML.makeDataset(42);

  register(document.getElementById('ch1'), 'viz1', 'cap1', {
    points: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 0, changed); } },
    labels: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 1, changed); } },
    question: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 2, changed); } },
    clusters: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 3, changed); } }
  });

  function ch1render(svg, p, cap, stage, changed) {
    var st = svg._ch1;
    if (!st) {
      svg.innerHTML = '';
      frame(svg, true);
      var g = drawPoints(svg, data1, { r: 5.5 });
      var clusters = el('g', { opacity: 0, 'class': 'anim' }, svg);
      [[2.5, 7.5, 2.6], [7.5, 2.5, 2.6], [2.5, 2.5, 2.6], [7.5, 7.5, 2.6]].forEach(function (c) {
        el('ellipse', { cx: sx(c[0]), cy: sy(c[1]), rx: sx(c[2]) - sx(0), ry: sy(0) - sy(c[2]), fill: 'none', stroke: C.accent, 'stroke-width': 2, 'stroke-dasharray': '7 6' }, clusters);
      });
      var qline = el('line', { x1: sx(5), y1: sy(0), x2: sx(5), y2: sy(10), stroke: C.accent, 'stroke-width': 2.5, 'stroke-dasharray': '8 6', opacity: 0, 'class': 'anim' }, svg);
      var ql = txt(svg, sx(5) + 8, sy(9.6), 'x1 <= 5 ?', { 'font-size': 13, fill: C.accent, 'font-weight': 700, opacity: 0, 'class': 'anim' });
      st = svg._ch1 = { g: g, clusters: clusters, qline: qline, ql: ql };
    }
    // The dots grow in once, during the first step, and then persist for the
    // whole chapter: later steps only recolor them or add overlays on top.
    // (The per-step scroll progress resets to 0 at every step change, so it must
    // not drive the radii of persistent elements.)
    animatePointRadii(st.g, stage === 0 ? p : 1);
    var colored = stage >= 1;
    Array.prototype.forEach.call(st.g.children, function (c) {
      c.setAttribute('fill', colored ? (data1.y[+c.dataset.i] === 0 ? C.blue : C.orange) : '#9aa7b5');
    });
    st.qline.setAttribute('opacity', stage === 2 ? 1 : 0);
    st.ql.setAttribute('opacity', stage === 2 ? 1 : 0);
    st.clusters.setAttribute('opacity', stage === 3 ? 1 : 0);
    cap.textContent = ['64 examples, two features each - labels hidden for now.',
      'Labels: blue vs. orange class.',
      'Could a few yes/no questions separate them? e.g. "x1 <= 5?"',
      'Two clusters per class - separable with axis-parallel questions.'][stage];
  }

  /* ============================================================
     Chapter 2 - inference walk
     ============================================================ */
  // Demo tree that matches the narrative: the root asks "x1 <= 5?", each child
  // asks "x2 <= 5?". Counts and majority predictions are still computed live
  // from the dataset, so the numbers on the nodes are real.
  function naturalTree(X, y) {
    function mkLeaf(idx, depth) {
      var c = ML.countsOf(y, idx);
      return { leaf: true, counts: c, n: idx.length, depth: depth, prediction: ML.majority(c) };
    }
    function mkSplit(idx, feature, threshold, depth, childFn) {
      var left = [], right = [];
      idx.forEach(function (i) { (X[i][feature] <= threshold ? left : right).push(i); });
      var c = ML.countsOf(y, idx);
      var node = { leaf: false, feature: feature, threshold: threshold, counts: c, n: idx.length, depth: depth, prediction: ML.majority(c) };
      node.left = childFn(left, depth + 1);
      node.right = childFn(right, depth + 1);
      return node;
    }
    return mkSplit(X.map(function (_, i) { return i; }), 0, 5, 0, function (idx, depth) {
      return mkSplit(idx, 1, 5, depth, mkLeaf);
    });
  }
  var tree2 = naturalTree(data1.X, data1.y);
  var probe = [2.2, 7.8];
  var walk = ML.predict(tree2, probe);

  register(document.getElementById('ch2'), 'viz2', 'cap2', {
    root: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 0, changed); } },
    q1: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 1, changed); } },
    q2: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 2, changed); } },
    leaf: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 3, changed); } }
  });

  function ch2render(svg, p, cap, stage, changed) {
    if (!svg._ch2) {
      svg.innerHTML = '';
      var tg = el('g', {}, svg);
      ML.layoutTree(tree2, 8, 288, 84, 118, 58);
      var nodes = [], edges = [];
      (function collect(n) {
        nodes.push(n);
        if (!n.leaf) { edges.push([n, n.left]); edges.push([n, n.right]); collect(n.left); collect(n.right); }
      })(tree2);
      var edgeEls = edges.map(function (e) {
        return el('line', { x1: e[0].px, y1: e[0].py + 22, x2: e[1].px, y2: e[1].py - 22, stroke: '#c9c2b4', 'stroke-width': 2.5, 'class': 'anim' }, tg);
      });
      var nodeEls = nodes.map(function (n) {
        var g = el('g', {}, tg);
        var c = el('circle', { cx: n.px, cy: n.py, r: 22, fill: '#fff', stroke: C.ink, 'stroke-width': 2, 'class': 'anim' }, g);
        var label = n.leaf ? (n.prediction === 0 ? 'blue' : 'orange')
          : (n.feature === 0 ? 'x1≤' + (+n.threshold.toFixed(1)) : 'x2≤' + (+n.threshold.toFixed(1)));
        txt(g, n.px, n.py - 2, label, { 'font-size': 10, 'text-anchor': 'middle', 'font-weight': 700, fill: n.leaf ? (n.prediction === 0 ? C.blue : C.orange) : C.ink });
        // class counts: blue/orange when > 0, black when 0
        txt(g, n.px, n.py + 10, n.counts[0] + ' blue', { 'font-size': 8, 'text-anchor': 'middle', fill: n.counts[0] > 0 ? C.blue : C.ink });
        txt(g, n.px, n.py + 18, n.counts[1] + ' orange', { 'font-size': 8, 'text-anchor': 'middle', fill: n.counts[1] > 0 ? C.orange : C.ink });
        if (!n.leaf) {
          txt(g, n.px - 26, n.py + 38, 'yes', { 'font-size': 9.5, fill: C.green });
          txt(g, n.px + 26, n.py + 38, 'no', { 'font-size': 9.5, fill: C.red });
        }
        return { n: n, c: c };
      });
      var sg = el('g', {}, svg);
      el('rect', { x: 300, y: PY, width: 320, height: 420, fill: '#fdfcfa', stroke: C.line, rx: 8 }, sg);
      var region1 = el('rect', { x: 300, y: PY, width: 0, height: 0, fill: C.blueSoft, 'class': 'anim' }, sg);
      var region2 = el('rect', { x: 300, y: PY, width: 0, height: 0, fill: 'rgba(47,111,237,0.30)', 'class': 'anim' }, sg);
      var pts = el('g', {}, sg);
      data1.X.forEach(function (pt, i) {
        el('circle', { cx: 300 + (pt[0] / 10) * 320, cy: PY + 420 - (pt[1] / 10) * 420, r: 4, fill: data1.y[i] === 0 ? C.blue : C.orange, 'fill-opacity': 0.85 }, pts);
      });
      // the new point: a black ring with a black dot inside (same radius as the data points);
      // it appears during the scroll, not from the beginning
      var probeX = 300 + (probe[0] / 10) * 320, probeY = PY + 420 - (probe[1] / 10) * 420;
      var probeRing = el('circle', { cx: probeX, cy: probeY, r: 0, fill: 'none', stroke: C.ink, 'stroke-width': 3, opacity: 0, 'class': 'anim' }, sg);
      var probeDot = el('circle', { cx: probeX, cy: probeY, r: 0, fill: C.ink, opacity: 0, 'class': 'anim' }, sg);
      txt(sg, 308, PY + 14, 'new point', { 'font-size': 10, fill: C.muted });
      svg._ch2 = { nodeEls: nodeEls, edgeEls: edgeEls, edges: edges, region1: region1, region2: region2, probeRing: probeRing, probeDot: probeDot, path: walk.path };
    }
    var st = svg._ch2;
    // region reached after the first k questions of the walk (in data coordinates)
    function pathRegion(k) {
      var b = { x0: 0, x1: 10, y0: 0, y1: 10 };
      for (var i = 0; i < k && i < st.path.length - 1; i++) {
        var n = st.path[i];
        var wentLeft = st.path[i + 1] === n.left;
        if (n.feature === 0) { if (wentLeft) b.x1 = Math.min(b.x1, n.threshold); else b.x0 = Math.max(b.x0, n.threshold); }
        else { if (wentLeft) b.y1 = Math.min(b.y1, n.threshold); else b.y0 = Math.max(b.y0, n.threshold); }
      }
      return b;
    }
    function drawRegion(rectEl, b) {
      rectEl.setAttribute('x', 300 + (b.x0 / 10) * 320);
      rectEl.setAttribute('y', PY + 420 - (b.y1 / 10) * 420);
      rectEl.setAttribute('width', Math.max(0, (b.x1 - b.x0) / 10 * 320));
      rectEl.setAttribute('height', Math.max(0, (b.y1 - b.y0) / 10 * 420));
    }
    var pathIdx = clamp(stage, 0, st.path.length - 1);
    st.nodeEls.forEach(function (ne) {
      var pi = st.path.indexOf(ne.n);
      var onPath = pi !== -1 && pi <= pathIdx;
      ne.c.setAttribute('stroke', onPath ? C.accent : C.ink);
      ne.c.setAttribute('stroke-width', onPath ? 4 : 2);
      ne.c.setAttribute('fill', onPath ? '#efecfb' : '#fff');
    });
    st.edgeEls.forEach(function (ee, i) {
      var pi = st.path.indexOf(st.edges[i][0]);
      var ci = st.path.indexOf(st.edges[i][1]);
      var on = pi !== -1 && ci !== -1 && ci <= pathIdx;
      ee.setAttribute('stroke', on ? C.accent : '#c9c2b4');
      ee.setAttribute('stroke-width', on ? 4 : 2.5);
    });
    if (stage >= 1) drawRegion(st.region1, pathRegion(1)); else st.region1.setAttribute('width', 0);
    if (stage >= 2) drawRegion(st.region2, pathRegion(2)); else st.region2.setAttribute('width', 0);
    // the new point pops in while the first step is on screen
    var appear = stage === 0 ? clamp((p - 0.25) / 0.5, 0, 1) : 1;
    st.probeRing.setAttribute('r', 10 * ease(appear));
    st.probeRing.setAttribute('opacity', appear);
    st.probeDot.setAttribute('r', 4 * ease(appear));
    st.probeDot.setAttribute('opacity', appear);
    cap.textContent = [
      'A trained tree is a flowchart - start at the root. A new point arrives (black ring).',
      'Root asks: "x1 ≤ 5?" The new point has x1 = 2.2, so: yes -> left. The left half is shaded.',
      'Next node asks: "x2 ≤ 5?" Here x2 = 7.8 > 5, so: no -> the shaded region shrinks to the top-left.',
      'Leaf reached: 14 blue / 0 orange - pure. Predict BLUE. Inference = a path of questions.'
    ][stage];
  }

  /* ============================================================
     Chapter 3 - Gini impurity
     ============================================================ */
  register(document.getElementById('ch3'), 'viz3', 'cap3', {
    intro: { render: function (svg, p, cap, changed) { giniRender(svg, p, cap, 0, changed); } },
    calc1: { render: function (svg, p, cap, changed) { giniRender(svg, p, cap, 1, changed); } },
    max: { render: function (svg, p, cap, changed) { giniRender(svg, p, cap, 2, changed); } },
    pure: { render: function (svg, p, cap, changed) { giniRender(svg, p, cap, 3, changed); } },
    curve: { render: function (svg, p, cap, changed) { giniRender(svg, p, cap, 4, changed); } }
  });

  var giniCountsByStage = [[8, 2], [8, 2], [5, 5], [10, 0], [8, 2]];

  function giniRender(svg, p, cap, stage, changed) {
    var st = svg._gini;
    if (!st) {
      svg.innerHTML = '';
      el('rect', { x: 60, y: 90, width: 240, height: 300, rx: 16, fill: '#fdfcfa', stroke: C.line }, svg);
      txt(svg, 180, 70, 'one node', { 'font-size': 14, 'text-anchor': 'middle', fill: C.muted, 'font-weight': 700 });
      var dotsG = el('g', {}, svg);
      var formula = mathBox(svg, 336, 132, 296, 30);
      var formula2 = mathBox(svg, 336, 164, 296, 30);
      var gval = mathBox(svg, 336, 200, 296, 40, 'bigmath');
      el('rect', { x: 340, y: 280, width: 240, height: 18, rx: 9, fill: '#efede6', stroke: C.line }, svg);
      var bar = el('rect', { x: 340, y: 280, width: 0, height: 18, rx: 9, fill: C.accent, 'class': 'anim' }, svg);
      txt(svg, 340, 322, '0', { 'font-size': 11, fill: C.muted });
      txt(svg, 580, 322, '0.5 (max, 2 classes)', { 'font-size': 11, fill: C.muted, 'text-anchor': 'end' });
      var cg = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var cx0 = 340, cy0 = 470, cw = 240, ch = 130;
      el('rect', { x: cx0, y: cy0 - ch, width: cw, height: ch, fill: '#fdfcfa', stroke: C.line }, cg);
      var pts = [];
      for (var i = 0; i <= 60; i++) { var pp = i / 60; pts.push((cx0 + pp * cw) + ',' + (cy0 - (2 * pp * (1 - pp)) / 0.5 * ch)); }
      el('polyline', { points: pts.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2.5 }, cg);
      txt(cg, cx0 + cw / 2, cy0 - ch - 8, 'G(p) = 2p(1-p),  p = fraction of blue', { 'font-size': 11, 'text-anchor': 'middle', fill: C.muted });
      var dot = el('circle', { cx: cx0, cy: cy0, r: 6, fill: C.orange, stroke: '#fff', 'stroke-width': 2, 'class': 'anim' }, cg);
      txt(cg, cx0 + 4, cy0 + 16, 'p=0', { 'font-size': 10, fill: C.muted });
      txt(cg, cx0 + cw - 4, cy0 + 16, 'p=1', { 'font-size': 10, fill: C.muted, 'text-anchor': 'end' });
      st = svg._gini = { dotsG: dotsG, formula: formula, formula2: formula2, gval: gval, bar: bar, cg: cg, dot: dot, cx0: cx0, cy0: cy0, cw: cw, ch: ch, stage: -1, mp: 0 };
    }
    var counts = giniCountsByStage[stage];
    var g = ML.gini(counts);
    // node dots and formulas only change with the step, not with every scroll frame
    var stageChanged = st.stage !== stage;
    if (stageChanged) {
      st.stage = stage;
      st.dotsG.innerHTML = '';
      var total = counts[0] + counts[1];
      for (var i = 0; i < total; i++) {
        var ang = (i / total) * Math.PI * 2 - Math.PI / 2;
        var rr = 52 + (i % 3) * 14;
        el('circle', { cx: 180 + Math.cos(ang) * rr, cy: 240 + Math.sin(ang) * rr, r: 9, fill: i < counts[0] ? C.blue : C.orange, stroke: '#fff', 'stroke-width': 1.5 }, st.dotsG);
      }
    }
    var f1 = '', f2 = '', gv = '', f1t = '', f2t = '', gvt = '';
    if (stage === 0 || stage === 4) {
      f1 = 'G = 1 - (p_1^2 + p_2^2)';
      f1t = 'G = 1 - (p1^2 + p2^2)';
      f2 = '\\text{counts: } ' + counts[0] + ' \\text{ blue, } ' + counts[1] + ' \\text{ orange}';
      f2t = 'counts: ' + counts[0] + ' blue, ' + counts[1] + ' orange';
      gv = 'G = ' + g.toFixed(2);
      gvt = gv;
    }
    if (stage === 1) {
      f1 = 'G = 1 - (0.8^2 + 0.2^2)';
      f1t = 'G = 1 - (0.8^2 + 0.2^2)';
      f2 = 'G = 1 - 0.68';
      f2t = f2;
      gv = 'G = \\mathbf{0.32}';
      gvt = 'G = 0.32';
    }
    if (stage === 2) {
      f1 = 'G = 1 - (0.5^2 + 0.5^2)';
      f1t = 'G = 1 - (0.5^2 + 0.5^2)';
      f2 = 'G = 1 - 0.50';
      f2t = f2;
      gv = 'G = \\mathbf{0.50} \\ \\text{(maximum)}';
      gvt = 'G = 0.50 (maximum)';
    }
    if (stage === 3) {
      f1 = 'G = 1 - (1^2 + 0^2)';
      f1t = 'G = 1 - (1^2 + 0^2)';
      f2 = 'G = 1 - 1';
      f2t = f2;
      gv = 'G = \\mathbf{0} \\ \\text{(pure: stop!)}';
      gvt = 'G = 0 (pure: stop!)';
    }
    if (stageChanged) {
      setMath(st.formula, f1, f1t);
      setMath(st.formula2, f2, f2t);
      setMath(st.gval, gv, gvt);
    }
    // bar fills in once and stays (monotonic reveal, never resets per step)
    st.mp = Math.max(st.mp, p);
    st.bar.setAttribute('width', (g / 0.5) * 240 * clamp(st.mp * 1.4, 0, 1));
    st.cg.setAttribute('opacity', stage === 4 ? 1 : 0);
    if (stage === 4) {
      var pp = ease(clamp(p, 0, 1));
      st.dot.setAttribute('cx', st.cx0 + pp * st.cw);
      st.dot.setAttribute('cy', st.cy0 - (2 * pp * (1 - pp)) / 0.5 * st.ch);
    }
    cap.textContent = ['Node with 10 points: 8 blue, 2 orange. How mixed is it?',
      'p = (0.8, 0.2) -> G = 0.32. Moderately mixed.',
      'Half-and-half is the messiest: G = 0.5 for two classes.',
      'Pure node: G = 0 - a leaf. Majority vote is unanimous.',
      'Gini vs. the blue fraction: parabola peaking at 0.5.'][stage];
  }

  /* ============================================================
     Chapter 4 - Entropy
     ============================================================ */
  register(document.getElementById('ch4'), 'viz4', 'cap4', {
    intro: { render: function (svg, p, cap, changed) { entRender(svg, p, cap, 0, changed); } },
    calc: { render: function (svg, p, cap, changed) { entRender(svg, p, cap, 1, changed); } },
    curve: { render: function (svg, p, cap, changed) { entRender(svg, p, cap, 2, changed); } },
    compare: { render: function (svg, p, cap, changed) { entRender(svg, p, cap, 3, changed); } }
  });

  function entRender(svg, p, cap, stage, changed) {
    var st = svg._ent;
    if (!st) {
      svg.innerHTML = '';
      el('rect', { x: 60, y: 90, width: 240, height: 300, rx: 16, fill: '#fdfcfa', stroke: C.line }, svg);
      txt(svg, 180, 70, 'the same node: 8 blue / 2 orange', { 'font-size': 14, 'text-anchor': 'middle', fill: C.muted, 'font-weight': 700 });
      for (var i = 0; i < 10; i++) {
        var ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
        var rr = 52 + (i % 3) * 14;
        el('circle', { cx: 180 + Math.cos(ang) * rr, cy: 240 + Math.sin(ang) * rr, r: 9, fill: i < 8 ? C.blue : C.orange, stroke: '#fff', 'stroke-width': 1.5 }, svg);
      }
      var f1 = mathBox(svg, 336, 122, 296, 30);
      var f2 = mathBox(svg, 336, 154, 296, 30);
      var f3 = mathBox(svg, 336, 186, 296, 30);
      var hv = mathBox(svg, 336, 222, 296, 40, 'bigmath');
      var cg = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var cx0 = 340, cy0 = 480, cw = 250, ch = 120;
      el('rect', { x: cx0, y: cy0 - ch, width: cw, height: ch, fill: '#fdfcfa', stroke: C.line }, cg);
      var ptsH = [], ptsG = [];
      for (var k = 0; k <= 60; k++) {
        var pp = k / 60;
        var h = -(pp * Math.log2(pp || 1e-9) + (1 - pp) * Math.log2((1 - pp) || 1e-9));
        // raw units on a shared 0..1 axis: entropy peaks at 1 bit, Gini at 0.5
        ptsH.push((cx0 + pp * cw) + ',' + (cy0 - h * ch));
        ptsG.push((cx0 + pp * cw) + ',' + (cy0 - (2 * pp * (1 - pp)) * ch));
      }
      el('polyline', { points: ptsH.join(' '), fill: 'none', stroke: C.green, 'stroke-width': 2.5 }, cg);
      var gline = el('polyline', { points: ptsG.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2.5, 'stroke-dasharray': '6 4', opacity: 0, 'class': 'anim' }, cg);
      // y-axis ticks (shared scale: 0 .. 1 bit)
      txt(cg, cx0 - 6, cy0 - ch + 3, '1', { 'font-size': 9, fill: C.muted, 'text-anchor': 'end' });
      txt(cg, cx0 - 6, cy0 - ch / 2 + 3, '0.5', { 'font-size': 9, fill: C.muted, 'text-anchor': 'end' });
      txt(cg, cx0 - 6, cy0 + 3, '0', { 'font-size': 9, fill: C.muted, 'text-anchor': 'end' });
      txt(cg, cx0 + 6, cy0 - ch + 14, 'H(p) entropy, bits (green)', { 'font-size': 10, fill: C.green });
      var glab = txt(cg, cx0 + 6, cy0 - ch + 28, 'G(p) Gini, max 0.5 (purple)', { 'font-size': 10, fill: C.accent, opacity: 0, 'class': 'anim' });
      txt(cg, cx0 + cw / 2, cy0 + 16, 'p = fraction of blue  ->  both peak at p = 0.5', { 'font-size': 10, 'text-anchor': 'middle', fill: C.muted });
      var dot = el('circle', { cx: cx0 + 0.8 * cw, cy: cy0 - 0.7219 * ch, r: 6, fill: C.orange, stroke: '#fff', 'stroke-width': 2, 'class': 'anim' }, cg);
      st = svg._ent = { f1: f1, f2: f2, f3: f3, hv: hv, cg: cg, dot: dot, gline: gline, glab: glab, cx0: cx0, cy0: cy0, cw: cw, ch: ch, stage: -1 };
    }
    // formulas and CSS classes only change with the step, not every scroll frame
    if (st.stage !== stage) {
      st.stage = stage;
    if (stage === 0) {
      setMath(st.f1, 'H = -\\sum_k p_k \\log_2 p_k', 'H = -sum_k p_k * log2(p_k)');
      setMath(st.f2, '\\text{units: bits}', 'units: bits');
      setMath(st.f3, '', ''); setMath(st.hv, '', '');
    }
    if (stage === 1) {
      setMath(st.f1, 'H = -(0.8\\log_2 0.8 + 0.2\\log_2 0.2)', 'H = -(0.8*log2 0.8 + 0.2*log2 0.2)');
      setMath(st.f2, '= -(-0.2575 - 0.4644)', '= -(-0.2575 - 0.4644)');
      setMath(st.f3, '\\text{5/5} \\to 1\\ \\text{bit} \\quad \\text{10/0} \\to 0\\ \\text{bits}', '5/5 -> 1 bit    10/0 -> 0 bits');
      setMath(st.hv, 'H = \\mathbf{0.72}\\ \\text{bits}', 'H = 0.72 bits');
    }
    if (stage === 2) {
      setMath(st.f1, 'H(p) = -p\\log_2 p - (1-p)\\log_2(1-p)', 'H(p) = -p*log2 p - (1-p)*log2(1-p)');
      setMath(st.f2, '\\text{fair coin } (p=0.5): \\mathbf{1}\\ \\text{bit}', 'fair coin (p=0.5): 1 bit');
      setMath(st.f3, '', '');
      setMath(st.hv, '\\text{peak} = 1\\ \\text{bit}', 'peak = 1 bit');
    }
    if (stage === 3) {
      st.f1.className = 'math smallmath';
      st.f2.className = 'math smallmath';
      st.f3.className = 'math smallmath';
      st.hv.className = 'math midmath';
      setMath(st.f1, '\\text{Gain} = H(\\text{parent}) - \\tfrac{n_L}{n}H(L) - \\tfrac{n_R}{n}H(R)', 'Gain = H(parent) - (nL/n)H(L) - (nR/n)H(R)');
      setMath(st.f2, '\\text{both peak at } p=0.5 \\Rightarrow \\text{ same splits, usually}', 'both peak at p = 0.5  =>  same splits, usually');
      setMath(st.f3, '', '');
      setMath(st.hv, '\\text{CART: Gini}\\ \\cdot\\ \\text{ID3/C4.5: entropy}', 'CART: Gini  ·  ID3/C4.5: entropy');
    } else {
      st.f1.className = 'math';
      st.f2.className = 'math';
      st.f3.className = 'math';
      st.hv.className = 'math bigmath';
    }
    }
    st.cg.setAttribute('opacity', stage >= 2 ? 1 : 0);
    st.gline.setAttribute('opacity', stage >= 3 ? 1 : 0);
    st.glab.setAttribute('opacity', stage >= 3 ? 1 : 0);
    if (stage >= 2) {
      var pp = stage === 2 ? ease(clamp(p, 0, 1)) : 0.8;
      var h = -(pp * Math.log2(pp || 1e-9) + (1 - pp) * Math.log2((1 - pp) || 1e-9));
      st.dot.setAttribute('cx', st.cx0 + pp * st.cw);
      st.dot.setAttribute('cy', st.cy0 - h * st.ch);
    }
    cap.textContent = ['Entropy measures mixedness in bits - questions still needed.',
      'Same 8/2 node: H = 0.72 bits (vs. Gini 0.32 - different units).',
      'Entropy curve peaks at p = 0.5 with exactly 1 bit.',
      'Gini and entropy are both concave -> usually the same splits.'][stage];
  }

  /* ============================================================
     Chapter 5 - recursive training (CART)
     ============================================================ */
  var tree5 = ML.buildTree(data1.X, data1.y, { maxDepth: 4, criterion: 'gini' });
  var allIdx = data1.X.map(function (_, i) { return i; });
  var sweepSplit = ML.bestSplit(data1.X, data1.y, allIdx, 'gini', [0]);

  register(document.getElementById('ch5'), 'viz5', 'cap5', {
    code: { render: function (svg, p, cap, changed) { trainRender(svg, p, cap, 0, changed); } },
    scan: { render: function (svg, p, cap, changed) { trainRender(svg, p, cap, 1, changed); } },
    split1: { render: function (svg, p, cap, changed) { trainRender(svg, p, cap, 2, changed); } },
    recurse: { render: function (svg, p, cap, changed) { trainRender(svg, p, cap, 3, changed); } },
    stop: { render: function (svg, p, cap, changed) { trainRender(svg, p, cap, 4, changed); } }
  });

  function trainRender(svg, p, cap, stage, changed) {
    var st = svg._tr;
    if (!st) {
      svg.innerHTML = '';
      frame(svg, true);
      var pts = drawPoints(svg, data1, { r: 5 });
      animatePointRadii(pts, 1);
      var sweep = el('line', { x1: sx(0), y1: sy(0), x2: sx(0), y2: sy(10), stroke: C.accent, 'stroke-width': 2, 'stroke-dasharray': '6 5', opacity: 0, 'class': 'anim' }, svg);
      var gainLab = mathBox(svg, sx(0) - 60, sy(10) - 26, 160, 22);
      gainLab.parentNode.setAttribute('opacity', 0);
      gainLab.parentNode.setAttribute('class', 'anim');
      var commit = el('line', { x1: sx(sweepSplit.threshold), y1: sy(0), x2: sx(sweepSplit.threshold), y2: sy(10), stroke: C.ink, 'stroke-width': 3.5, opacity: 0, 'class': 'anim' }, svg);
      var sub = el('g', { opacity: 0, 'class': 'anim' }, svg);
      [tree5.left, tree5.right].forEach(function (n) {
        if (n && !n.leaf) {
          var horizontal = n.feature === 1;
          el('line', {
            x1: horizontal ? sx(0) : sx(n.threshold), y1: horizontal ? sy(n.threshold) : sy(0),
            x2: horizontal ? sx(10) : sx(n.threshold), y2: horizontal ? sy(n.threshold) : sy(10),
            stroke: C.accent, 'stroke-width': 2.5, opacity: 0.9
          }, sub);
        }
      });
      var chipL = txt(svg, sx(0.2), sy(0) + 18, '', { 'font-size': 12, fill: C.blue, 'font-family': 'ui-monospace,monospace', opacity: 0, 'class': 'anim' });
      var chipR = txt(svg, sx(9.8), sy(0) + 18, '', { 'font-size': 12, fill: C.orange, 'font-family': 'ui-monospace,monospace', opacity: 0, 'class': 'anim', 'text-anchor': 'end' });
      var leafNote = txt(svg, sx(5), sy(0) - 8, '', { 'font-size': 13, fill: C.green, 'text-anchor': 'middle', 'font-weight': 700, opacity: 0, 'class': 'anim' });
      st = svg._tr = { sweep: sweep, gainLab: gainLab, commit: commit, sub: sub, chipL: chipL, chipR: chipR, leafNote: leafNote };
    }
    // every stage sets the full overlay state, so scrolling backwards is clean too
    st.sweep.setAttribute('opacity', 0); st.commit.setAttribute('opacity', 0);
    st.sub.setAttribute('opacity', 0); st.chipL.setAttribute('opacity', 0);
    st.chipR.setAttribute('opacity', 0); st.leafNote.setAttribute('opacity', 0);
    st.gainLab.parentNode.setAttribute('opacity', 0);
    if (stage === 0) {
      cap.textContent = 'train(node, data, depth) - one recursive procedure builds the whole tree.';
    }
    if (stage === 1) {
      var t = ease(clamp(p, 0, 1)) * 10;
      st.sweep.setAttribute('opacity', 1);
      st.sweep.setAttribute('x1', sx(t)); st.sweep.setAttribute('x2', sx(t));
      var idx = allIdx.filter(function (i) { return data1.X[i][0] <= t; });
      var c = idx.length ? ML.countsOf(data1.y, idx) : [0, 0];
      var g = ML.gini(c);
      var fo = st.gainLab.parentNode;
      fo.setAttribute('opacity', 1);
      fo.setAttribute('x', clamp(sx(t) - 80, PX + 4, PX + PW - 166));
      setMath(st.gainLab, 'G(\\text{left}) = ' + g.toFixed(2), 'G(left)=' + g.toFixed(2));
      st.commit.setAttribute('opacity', 0);
      cap.textContent = 'Scan every candidate threshold on x1 (and x2) - score each by its gain.';
    }
    if (stage === 2) {
      st.sweep.setAttribute('opacity', 0); st.gainLab.parentNode.setAttribute('opacity', 0);
      st.commit.setAttribute('opacity', 1);
      st.chipL.setAttribute('opacity', 1); st.chipR.setAttribute('opacity', 1);
      st.chipL.textContent = 'left: ' + sweepSplit.leftCounts[0] + 'B/' + sweepSplit.leftCounts[1] + 'O  G=' + ML.gini(sweepSplit.leftCounts).toFixed(2);
      st.chipR.textContent = 'right: ' + sweepSplit.rightCounts[0] + 'B/' + sweepSplit.rightCounts[1] + 'O  G=' + ML.gini(sweepSplit.rightCounts).toFixed(2);
      cap.textContent = 'Best cut: x1 <= ' + sweepSplit.threshold.toFixed(2) + ', gain = ' + sweepSplit.gain.toFixed(3) + '. Split!';
    }
    if (stage === 3) {
      st.sub.setAttribute('opacity', 1);
      cap.textContent = 'Recurse: left child scans horizontal cuts in the left half; right child scans its own half.';
    }
    if (stage === 4) {
      st.leafNote.setAttribute('opacity', 1);
      st.leafNote.textContent = 'Stop: pure node / max depth / too few samples -> leaf';
      cap.textContent = 'Each branch ends in a leaf (G=0, depth cap, or min-samples). The recursion terminates.';
    }
  }

  /* ============================================================
     Chapter 6 - decision boundary
     ============================================================ */
  var trees6 = {
    1: ML.buildTree(data1.X, data1.y, { maxDepth: 1 }),
    2: ML.buildTree(data1.X, data1.y, { maxDepth: 2 }),
    6: ML.buildTree(data1.X, data1.y, { maxDepth: 6 })
  };

  register(document.getElementById('ch6'), 'viz6', 'cap6', {
    d1: { render: function (svg, p, cap, changed) { boundaryRender(svg, p, cap, 1, changed, false); } },
    d2: { render: function (svg, p, cap, changed) { boundaryRender(svg, p, cap, 2, changed, false); } },
    d6: { render: function (svg, p, cap, changed) { boundaryRender(svg, p, cap, 6, changed, false); } },
    note: { render: function (svg, p, cap, changed) { boundaryRender(svg, p, cap, 6, changed, true); } }
  });

  function boundaryRender(svg, p, cap, depth, changed, note) {
    var st = svg._bd;
    if (!st) {
      svg.innerHTML = '';
      frame(svg, true);
      var rg = el('g', {}, svg);
      var pts = drawPoints(svg, data1, { r: 5 });
      animatePointRadii(pts, 1); // dots are persistent and always fully drawn
      var title = txt(svg, sx(5), sy(0) - 8, '', { 'font-size': 14, 'text-anchor': 'middle', 'font-weight': 700, fill: C.ink });
      st = svg._bd = { rg: rg, pts: pts, title: title, depth: -1, mp: 0, rectEls: [], nRects: 0 };
    }
    // region rects are created once per depth, then only their opacity is
    // updated while scrolling - they are never removed and re-created
    if (st.depth !== depth) {
      st.depth = depth;
      st.rg.innerHTML = '';
      st.rectEls = [];
      var rects = ML.partitionRects(trees6[depth], { x0: 0, x1: 10, y0: 0, y1: 10 });
      st.nRects = rects.length;
      rects.forEach(function (r) {
        st.rectEls.push(el('rect', {
          x: sx(r.x0), y: sy(r.y1), width: Math.max(0.5, sx(r.x1) - sx(r.x0)), height: Math.max(0.5, sy(r.y0) - sy(r.y1)),
          fill: r.pred === 0 ? C.blue : C.orange, 'fill-opacity': 0,
          stroke: r.pred === 0 ? C.blue : C.orange, 'stroke-opacity': 0, 'stroke-width': 1.2
        }, st.rg));
      });
    }
    // monotonic reveal: once regions have appeared they stay on screen
    st.mp = Math.max(st.mp, p);
    st.rectEls.forEach(function (rc, i) {
      var local = clamp(st.mp * st.rectEls.length * 1.2 - i, 0, 1);
      rc.setAttribute('fill-opacity', 0.16 * ease(local));
      rc.setAttribute('stroke-opacity', 0.55 * ease(local));
    });
    st.title.textContent = note ? 'The boundary IS the model - axis-parallel only' : 'Depth ' + depth + ' tree: ' + st.nRects + ' regions';
    cap.textContent = (depth === 1 ? 'One question -> one vertical cut. ' :
      depth === 2 ? 'Second level cuts regions again -> rectangles. ' :
      'Deep tree: staircase hugging the clusters - but only axis-parallel lines. ') +
      'Every leaf = one region = one majority vote.';
  }

  /* ============================================================
     Chapter 7 - overfitting
     ============================================================ */
  var dataNoisy = ML.makeNoisy(42);
  var treeDeep = ML.buildTree(dataNoisy.X, dataNoisy.y, { maxDepth: 8 });
  var treeShallow = naturalTree(dataNoisy.X, dataNoisy.y); // depth-2 quadrant tree: ignores the outliers
  var treeClean = ML.buildTree(data1.X, data1.y, { maxDepth: 8 });
  var testSet = { X: [], y: [] };
  (function () {
    var rngTest = ML.mulberry32(777);
    [[2.5, 7.5, 0], [7.5, 2.5, 0], [2.5, 2.5, 1], [7.5, 7.5, 1]].forEach(function (b) {
      for (var i = 0; i < 50; i++) {
        testSet.X.push([clamp(b[0] + ML.gaussian(rngTest) * 1.25, 0.2, 9.8), clamp(b[1] + ML.gaussian(rngTest) * 1.25, 0.2, 9.8)]);
        testSet.y.push(b[2]);
      }
    });
  })();
  function pct(a) { return (a * 100).toFixed(0) + '%'; }
  // create the region rects of a tree once; the caller animates their opacity
  function makeRegionRects(rg, tree, kind) {
    var rects = ML.partitionRects(tree, { x0: 0, x1: 10, y0: 0, y1: 10 });
    return rects.map(function (r) {
      var attrs = {
        x: sx(r.x0), y: sy(r.y1), width: Math.max(0.5, sx(r.x1) - sx(r.x0)), height: Math.max(0.5, sy(r.y0) - sy(r.y1)),
        'fill-opacity': 0, 'stroke-opacity': 0
      };
      if (kind === 'fill') {
        attrs.fill = r.pred === 0 ? C.blue : C.orange;
        attrs.stroke = attrs.fill; attrs['stroke-width'] = 1;
      } else if (kind === 'green') {
        attrs.fill = 'none'; attrs.stroke = C.green; attrs['stroke-width'] = 2; attrs['stroke-dasharray'] = '6 4';
      } else { // red
        attrs.fill = 'none'; attrs.stroke = C.red; attrs['stroke-width'] = 1.2;
      }
      return el('rect', attrs, rg);
    });
  }

  register(document.getElementById('ch7'), 'viz7', 'cap7', {
    clean: { render: function (svg, p, cap, changed) { overRender(svg, p, cap, 0, changed); } },
    noise: { render: function (svg, p, cap, changed) { overRender(svg, p, cap, 1, changed); } },
    islands: { render: function (svg, p, cap, changed) { overRender(svg, p, cap, 2, changed); } },
    gap: { render: function (svg, p, cap, changed) { overRender(svg, p, cap, 3, changed); } }
  });

  function overRender(svg, p, cap, stage, changed) {
    var st = svg._ov;
    if (!st) {
      svg.innerHTML = '';
      frame(svg, true);
      var rg = el('g', {}, svg);
      var pts = el('g', {}, svg);
      var chips = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var chipA = txt(chips, sx(0.2), sy(10) - 8, '', { 'font-size': 13, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      var chipB = txt(chips, sx(0.2), sy(10) - 28, '', { 'font-size': 13, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      st = svg._ov = { rg: rg, pts: pts, chips: chips, chipA: chipA, chipB: chipB, stage: -1, mp: 0, fillEls: [], rectsS: [], rectsD: [] };
    }
    // points and region rects are rebuilt only when the step changes; while
    // scrolling, only attributes are updated - nothing is wiped and re-created
    if (st.stage !== stage) {
      st.stage = stage;
      var d = stage === 0 ? data1 : dataNoisy;
      var outlierStart = data1.n; // indices >= this are the mislabeled outliers
      st.pts.innerHTML = '';
      d.X.forEach(function (pt, i) {
        var cx = sx(pt[0]), cy = sy(pt[1]);
        var col = d.y[i] === 0 ? C.blue : C.orange;
        if (stage >= 1 && i >= outlierStart) {
          // mislabeled outliers are drawn as crosses
          el('line', { x1: cx - 4.5, y1: cy - 4.5, x2: cx + 4.5, y2: cy + 4.5, stroke: col, 'stroke-width': 2.5 }, st.pts);
          el('line', { x1: cx - 4.5, y1: cy + 4.5, x2: cx + 4.5, y2: cy - 4.5, stroke: col, 'stroke-width': 2.5 }, st.pts);
        } else {
          el('circle', { cx: cx, cy: cy, r: 5, fill: col, 'fill-opacity': 0.9, stroke: '#fff', 'stroke-width': 1.2 }, st.pts);
        }
      });
      st.rg.innerHTML = '';
      st.fillEls = []; st.rectsS = []; st.rectsD = [];
      if (stage === 0) {
        st.fillEls = makeRegionRects(st.rg, treeClean, 'fill');
      } else if (stage === 2) {
        st.fillEls = makeRegionRects(st.rg, treeDeep, 'fill');
      } else if (stage === 3) {
        // first the depth-2 boundary (green dashes), then the depth-8 boundary (red) on top of it
        st.rectsS = makeRegionRects(st.rg, treeShallow, 'green');
        st.rectsD = makeRegionRects(st.rg, treeDeep, 'red');
        st.chipA.textContent = 'depth-8 (red):   train ' + pct(ML.trainAccuracy(treeDeep, dataNoisy.X, dataNoisy.y)) + '   fresh ' + pct(ML.trainAccuracy(treeDeep, testSet.X, testSet.y));
        st.chipB.textContent = 'depth-2 (green): train ' + pct(ML.trainAccuracy(treeShallow, dataNoisy.X, dataNoisy.y)) + '   fresh ' + pct(ML.trainAccuracy(treeShallow, testSet.X, testSet.y));
      }
    }
    if (stage === 0 || stage === 2) {
      // monotonic reveal: once the boundary has appeared it stays on screen
      st.mp = Math.max(st.mp, p);
      st.fillEls.forEach(function (rc, i) {
        var local = clamp(st.mp * st.fillEls.length * 1.2 - i, 0, 1);
        rc.setAttribute('fill-opacity', 0.15 * ease(local));
        rc.setAttribute('stroke-opacity', 0.5 * ease(local));
      });
      st.chips.setAttribute('opacity', 0);
      cap.textContent = stage === 0
        ? 'Clean data: a depth-8 tree fits perfectly - looks great.'
        : 'Depth-8 (filled) carves tiny islands around each outlier - ~100% train accuracy, but it learned noise.';
    } else if (stage === 1) {
      st.chips.setAttribute('opacity', 0);
      cap.textContent = 'Add 4 mislabeled outliers (crosses) - real data is noisy.';
    } else {
      st.rectsS.forEach(function (rc, i) {
        var local = clamp((p / 0.5) * st.rectsS.length * 1.2 - i, 0, 1);
        rc.setAttribute('stroke-opacity', 0.9 * ease(local));
      });
      st.rectsD.forEach(function (rc, i) {
        var local = clamp(((p - 0.5) / 0.5) * st.rectsD.length * 1.2 - i, 0, 1);
        rc.setAttribute('stroke-opacity', 0.75 * ease(local));
      });
      st.chips.setAttribute('opacity', clamp((p - 0.85) / 0.15, 0, 1));
      cap.textContent = 'Depth-2 (green dashes) ignores the outliers; depth-8 (red) wraps around them. On fresh data the shallow tree wins - that gap is overfitting.';
    }
  }

  /* ============================================================
     Chapter 8 - random forest (bagging)
     ============================================================ */
  var rfTrees = [];
  (function () {
    var rng = ML.mulberry32(2024);
    for (var t = 0; t < 25; t++) {
      var idx = ML.bootstrap(data1.n, rng);
      var Xb = idx.map(function (i) { return data1.X[i]; });
      var yb = idx.map(function (i) { return data1.y[i]; });
      rfTrees.push(ML.buildTree(Xb, yb, { maxDepth: 4, criterion: 'gini', maxFeatures: 1, rng: rng }));
    }
  })();
  var miniTrees = rfTrees.slice(0, 5);

  register(document.getElementById('ch8'), 'viz8', 'cap8', {
    idea: { render: function (svg, p, cap, changed) { rfRender(svg, p, cap, 0, changed); } },
    bootstrap: { render: function (svg, p, cap, changed) { rfRender(svg, p, cap, 1, changed); } },
    trees: { render: function (svg, p, cap, changed) { rfRender(svg, p, cap, 2, changed); } },
    vote: { render: function (svg, p, cap, changed) { rfRender(svg, p, cap, 3, changed); } }
  });

  function rfPoints(g, r, fo, strokeW) {
    data1.X.forEach(function (pt, i) {
      el('circle', { cx: sx(pt[0]), cy: sy(pt[1]), r: r, fill: data1.y[i] === 0 ? C.blue : C.orange, 'fill-opacity': fo, stroke: '#fff', 'stroke-width': strokeW }, g);
    });
  }

  function rfRender(svg, p, cap, stage, changed) {
    var st = svg._rf;
    if (!st) {
      svg.innerHTML = '';
      frame(svg, true);
      var rg = el('g', {}, svg);
      var pg = el('g', {}, svg);
      var mg = el('g', { opacity: 0, 'class': 'anim' }, svg);
      st = svg._rf = { rg: rg, pg: pg, mg: mg, stage: -1, panelRects: [], cellEls: [], GX: 31, GY: 26, x0: 14, y0: 470, panelW: 112, gap: 10 };
    }
    // stage content (points, mini-tree panels, vote grid) is built only when
    // the step changes; while scrolling only fill-opacity attributes change
    if (st.stage !== stage) {
      st.stage = stage;
      st.rg.innerHTML = ''; st.pg.innerHTML = ''; st.mg.innerHTML = '';
      st.panelRects = []; st.cellEls = [];
      if (stage === 1) {
        var rng = ML.mulberry32(555);
        var idx = ML.bootstrap(data1.n, rng);
        var counts = {};
        idx.forEach(function (i) { counts[i] = (counts[i] || 0) + 1; });
        data1.X.forEach(function (pt, i) {
          var k = counts[i] || 0;
          el('circle', {
            cx: sx(pt[0]), cy: sy(pt[1]), r: 4 + k * 3,
            fill: data1.y[i] === 0 ? C.blue : C.orange,
            'fill-opacity': k === 0 ? 0.25 : 0.55 + 0.2 * Math.min(k, 2),
            stroke: k === 0 ? C.muted : '#fff', 'stroke-width': k === 0 ? 1.5 : 1,
            'stroke-dasharray': k === 0 ? '3 3' : 'none'
          }, st.pg);
        });
      } else if (stage === 2) {
        miniTrees.forEach(function (tree, i) {
          var g = el('g', {}, st.mg);
          el('rect', { x: st.x0 + i * (st.panelW + st.gap), y: st.y0, width: st.panelW, height: 70, rx: 6, fill: '#fdfcfa', stroke: C.line }, g);
          txt(g, st.x0 + i * (st.panelW + st.gap) + 4, st.y0 + 12, 'tree ' + (i + 1), { 'font-size': 9, fill: C.muted });
          var rects = ML.partitionRects(tree, { x0: 0, x1: 10, y0: 0, y1: 10 });
          var px = st.x0 + i * (st.panelW + st.gap), py = st.y0 + 14;
          st.panelRects.push(rects.map(function (r) {
            return el('rect', {
              x: px + (r.x0 / 10) * st.panelW, y: py + (1 - r.y1 / 10) * 56,
              width: Math.max(0.4, ((r.x1 - r.x0) / 10) * st.panelW), height: Math.max(0.4, ((r.y1 - r.y0) / 10) * 56),
              fill: r.pred === 0 ? C.blue : C.orange, 'fill-opacity': 0
            }, g);
          }));
        });
        rfPoints(st.pg, 4, 0.85, 0);
      } else if (stage === 3) {
        for (var gx = 0; gx < st.GX; gx++) for (var gy = 0; gy < st.GY; gy++) {
          var cx = (gx + 0.5) / st.GX * 10, cy = (gy + 0.5) / st.GY * 10;
          var votes = 0;
          rfTrees.forEach(function (t) { votes += ML.predict(t, [cx, cy]).label === 0 ? -1 : 1; });
          var pred = votes < 0 ? 0 : 1;
          var cell = el('rect', {
            x: sx(gx / st.GX * 10), y: sy((gy + 1) / st.GY * 10),
            width: sx((gx + 1) / st.GX * 10) - sx(gx / st.GX * 10), height: sy(gy / st.GY * 10) - sy((gy + 1) / st.GY * 10),
            fill: pred === 0 ? C.blue : C.orange, 'fill-opacity': 0
          }, st.rg);
          cell.dataset.gx = gx;
          st.cellEls.push(cell);
        }
        rfPoints(st.pg, 4.5, 0.9, 1);
      } else {
        rfPoints(st.pg, 5, 0.9, 1.2);
      }
    }
    st.mg.setAttribute('opacity', stage === 2 ? 1 : 0);
    if (stage === 2) {
      st.panelRects.forEach(function (list, i) {
        var local = clamp(p * 5 - i, 0, 1);
        list.forEach(function (rc) { rc.setAttribute('fill-opacity', 0.35 * ease(local)); });
      });
      cap.textContent = '5 trees, 5 bootstrap samples (+ random feature subset per split): similar boundaries, not identical.';
    } else if (stage === 3) {
      st.cellEls.forEach(function (rc) {
        var cellP = clamp(p * 1.6 - (rc.dataset.gx / st.GX) * 0.6, 0, 1);
        rc.setAttribute('fill-opacity', 0.18 * ease(cellP));
      });
      cap.textContent = '25 trees vote per point - the forest boundary is smoother and more robust than any single tree.';
    } else if (stage === 1) {
      cap.textContent = 'Bootstrap: n draws with replacement - bigger = drawn twice, dashed = left out (out-of-bag ~ 37%).';
    } else {
      cap.textContent = 'One tree = one opinion. A forest of trees, each on a bootstrap sample, votes together.';
    }
  }

  /* ============================================================
     Chapter 9 - boosting / AdaBoost
     ============================================================ */
  var line = ML.makeLine(5);
  var ys = line.ys.map(function (v) { return v === 1 ? 1 : -1; });
  var ada = ML.adaboostTrain1D(line.xs, ys, 8);

  register(document.getElementById('ch9'), 'viz9', 'cap9', {
    line: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 0, changed); } },
    stump1: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 1, changed); } },
    reweight: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 2, changed); } },
    rounds: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 3, changed); } },
    final: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 4, changed); } },
    summary: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 5, changed); } }
  });

  function adaRender(svg, p, cap, stage, changed) {
    var st = svg._ada;
    if (!st) {
      svg.innerHTML = '';
      var x0 = 40, x1 = 600;
      function ax(x) { return x0 + ((x - 0.5) / 9) * (x1 - x0); }
      var topY = 150, botY = 300;
      el('line', { x1: x0, y1: 230, x2: x1, y2: 230, stroke: C.line, 'stroke-width': 2 }, svg);
      txt(svg, x0, topY - 26, 'label +1', { 'font-size': 12, fill: C.orange, 'font-weight': 700 });
      txt(svg, x0, botY + 30, 'label -1', { 'font-size': 12, fill: C.blue, 'font-weight': 700 });
      for (var i = 0; i <= 9; i++) txt(svg, ax(i), 250, String(i), { 'font-size': 10, fill: C.muted, 'text-anchor': 'middle', 'font-family': 'ui-monospace,monospace' });
      txt(svg, (x0 + x1) / 2, 272, 'feature x', { 'font-size': 12, fill: C.muted, 'text-anchor': 'middle' });
      var ptG = el('g', {}, svg);
      var stumpG = el('g', {}, svg);
      var fG = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var info = mathBox(svg, x0 - 6, 14, x1 - x0 + 12, 26);
      var info2 = mathBox(svg, x0 - 6, 42, x1 - x0 + 12, 26);
      var fx0 = x0, fx1 = x1, fy0 = 520, fy1 = 380;
      el('rect', { x: fx0, y: fy1, width: fx1 - fx0, height: fy0 - fy1, fill: '#fdfcfa', stroke: C.line, rx: 8 }, fG);
      el('line', { x1: fx0, y1: (fy0 + fy1) / 2, x2: fx1, y2: (fy0 + fy1) / 2, stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '4 4' }, fG);
      txt(fG, fx0 + 4, fy1 + 14, 'F(x) = sum alpha_t * h_t(x) - the boosted vote', { 'font-size': 11, fill: C.muted });
      // persistent elements for the final-stage F(x) plot (updated in place)
      var fPoly = el('polyline', { points: '', fill: 'none', stroke: C.accent, 'stroke-width': 2.5 }, fG);
      var zDot = el('circle', { cx: fx0, cy: (fy0 + fy1) / 2, r: 5, fill: '#d64545', opacity: 0 }, fG);
      var zG = el('g', {}, svg);
      var zLine = el('line', { x1: x0, y1: 100, x2: x0, y2: 330, stroke: '#d64545', 'stroke-width': 3, 'stroke-dasharray': '5 4', opacity: 0 }, zG);
      st = svg._ada = { ptG: ptG, stumpG: stumpG, fG: fG, info: info, info2: info2, topY: topY, botY: botY, ax: ax, fx0: fx0, fx1: fx1, fy0: fy0, fy1: fy1, fPoly: fPoly, zDot: zDot, zLine: zLine, stage: -1, zx: null };
    }
    var ax = st.ax;
    // points, stump lines and formulas are rebuilt only when the step changes
    if (st.stage !== stage) {
      st.stage = stage;
      st.ptG.innerHTML = ''; st.stumpG.innerHTML = '';
      var weights = stage === 0 ? line.xs.map(function () { return 1 / line.n; })
        : ada.history[Math.min(stage - 1, ada.history.length - 1)].weights;
      line.xs.forEach(function (x, i) {
        var y = ys[i] === 1 ? st.topY : st.botY;
        el('circle', { cx: ax(x), cy: y, r: 5 + weights[i] * line.n * 6, fill: ys[i] === 1 ? C.orange : C.blue, 'fill-opacity': 0.85, stroke: '#fff', 'stroke-width': 1 }, st.ptG);
      });
      var round = clamp(stage - 1, 0, ada.stumps.length - 1);
      if (stage >= 1 && stage <= 3) {
        for (var t = 0; t <= round; t++) {
          var s = ada.stumps[t];
          var alphaRel = clamp(s.alpha / (ada.stumps[0].alpha || 1), 0.25, 1);
          el('line', { x1: ax(s.threshold), y1: 100, x2: ax(s.threshold), y2: 330, stroke: t === round ? C.ink : '#b9b2a4', 'stroke-width': 2 + 3 * alphaRel, opacity: t === round ? 1 : 0.45 }, st.stumpG);
          var leftX = s.polarity === 1 ? ax(s.threshold) : ax(0.5);
          var rightX = s.polarity === 1 ? ax(9.5) : ax(s.threshold);
          el('rect', { x: Math.min(leftX, rightX), y: 100, width: Math.abs(rightX - leftX), height: 230, fill: C.orange, 'fill-opacity': 0.06 * (t === round ? 1 : 0.4) }, st.stumpG);
        }
        var h = ada.history[round];
        setMath(st.info,
          '\\text{round } ' + (round + 1) + ':\\ x \\le ' + h.stump.threshold.toFixed(2) + ',\\quad \\varepsilon = ' + h.err.toFixed(3) + ',\\quad \\alpha = ' + h.alpha.toFixed(3),
          'round ' + (round + 1) + ': threshold x <= ' + h.stump.threshold.toFixed(2) + ',  eps = ' + h.err.toFixed(3) + ',  alpha = ' + h.alpha.toFixed(3));
        setMath(st.info2, stage === 2
          ? 'w_i \\leftarrow w_i\\, e^{-\\alpha\\, y_i\\, h(x_i)}: \\text{ wrong points swell (bigger circles)}'
          : '\\alpha = \\tfrac12 \\ln\\frac{1-\\varepsilon}{\\varepsilon} \\text{ — accurate stumps speak louder}',
          stage === 2
          ? 'w_i <- w_i * e^(-alpha*y_i*h(x_i)): wrong points swell (bigger circles)'
          : 'alpha = 0.5*ln((1-eps)/eps) - accurate stumps speak louder');
      } else { setMath(st.info, '', ''); setMath(st.info2, '', ''); }
      if (stage === 4 || stage === 5) {
        var maxF0 = 1e-9, F0 = [];
        for (var k0 = 0; k0 <= 100; k0++) { var f0 = ML.adaboostF(ada, 0.5 + (k0 / 100) * 9); F0.push(f0); maxF0 = Math.max(maxF0, Math.abs(f0)); }
        st.zx = null;
        for (var k2 = 0; k2 < F0.length - 1; k2++) if (F0[k2] === 0 || F0[k2] * F0[k2 + 1] < 0) { st.zx = 0.5 + ((k2 + 0.5) / 100) * 9; break; }
        setMath(st.info, ada.stumps.length + '\\ \\text{stumps, final: } \\hat{y} = \\mathrm{sign}\\left(\\sum_t \\alpha_t h_t(x)\\right)', ada.stumps.length + ' stumps, final: y_hat = sign( sum alpha_t * h_t(x) )');
        setMath(st.info2, '\\text{where } F(x) \\text{ crosses 0 (red) is the ensemble boundary}', 'where F(x) crosses 0 (red) is the ensemble boundary');
      }
    }
    if (stage === 4 || stage === 5) {
      st.fG.setAttribute('opacity', 1);
      // F(x) staircase: persistent polyline, only its points are updated per frame
      var maxF = 1e-9, F = [];
      for (var k = 0; k <= 100; k++) { var f = ML.adaboostF(ada, 0.5 + (k / 100) * 9); F.push(f); maxF = Math.max(maxF, Math.abs(f)); }
      var midY = (st.fy0 + st.fy1) / 2;
      var pts = [];
      F.forEach(function (f, k) {
        pts.push((st.fx0 + (k / 100) * (st.fx1 - st.fx0)) + ',' + (midY - (f / maxF) * ((st.fy0 - st.fy1) / 2 - 8) * clamp(p * 1.5, 0, 1)));
      });
      st.fPoly.setAttribute('points', pts.join(' '));
      if (st.zx != null) {
        st.zLine.setAttribute('x1', ax(st.zx)); st.zLine.setAttribute('x2', ax(st.zx));
        st.zLine.setAttribute('opacity', 1);
        st.zDot.setAttribute('cx', st.fx0 + ((st.zx - 0.5) / 9) * (st.fx1 - st.fx0));
        st.zDot.setAttribute('cy', midY);
        st.zDot.setAttribute('opacity', 1);
      } else { st.zLine.setAttribute('opacity', 0); st.zDot.setAttribute('opacity', 0); }
    } else {
      st.fG.setAttribute('opacity', 0);
      st.zLine.setAttribute('opacity', 0); st.zDot.setAttribute('opacity', 0);
    }
    cap.textContent = [
      'One feature x; -1 (blue) left, +1 (orange) right - boosting in 1-D is easiest to see.',
      'Round 1: every point weight 1/n; best stump = threshold with lowest weighted error.',
      'Reweight: w <- w * e^(-alpha*y*h(x)), renormalize - mistakes get bigger circles.',
      'Rounds 2..T: each stump aims where the ensemble is still wrong.',
      'Final vote F(x) = sum alpha_t*h_t(x); sign(F) decides - a strong classifier from weak stumps.',
      'Bagging = parallel trees on bootstrap samples; Boosting = sequential, error-focused reweighting.'][stage];
  }

  update();
})();
