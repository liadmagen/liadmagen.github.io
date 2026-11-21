/* Chapters 3, 4 and 5 of "From a Yes to a Network": one neuron is not enough, layers and the forward pass, backpropagation and training. */
(function () {
  'use strict';
  const K = window.NNKIT;
  if (!K) return;
  const NN = K.NN, F = K.F, S = K.S, C = K.C;
  const el = K.el, T = K.T, clear = K.clear, clamp = K.clamp, lerp = K.lerp, ease = K.ease, rev = K.rev, fmt = K.fmt;
  const lin = K.lin, geo = K.geo, axes = K.axes, pathD = K.pathD, ctlState = K.ctlState;
  const $ = (id) => document.getElementById(id);
  const num = (v, d) => fmt(v, d === undefined ? 1 : d);
  const X = F.xor.X, Y = F.xor.Y, LO = -2.4, HI = 2.4;
  const imgCache = {};
  const cached = (key, fn) => (imgCache[key] !== undefined ? imgCache[key] : (imgCache[key] = fn()));
  const mapOf = (model, key) => cached(key, () => K.mapImage((x, y) => NN.forward(model, [x, y]).p, LO, HI, 48));

  /* a square plot frame centred in the figure */
  function squareFrame(G) {
    const m = G.m, s = Math.min(G.W - m.l - m.r, G.H - m.t - m.b), left = (G.W - s) / 2 + (G.M ? 6 : 10), top = m.t;
    return { s: s, left: left, top: top, sx: lin(LO, HI, left, left + s), sy: lin(LO, HI, top + s, top) };
  }
  const xorAxes = (g, G, f, o) => axes(g, G, f.sx, f.sy, Object.assign({ xt: [-2, -1, 0, 1, 2], yt: [-2, -1, 0, 1, 2], xtitle: 'x₁', ytitle: 'x₂', ytx: f.left - (G.M ? 28 : 40) }, o || {}));
  /* the line a*x + b*y + c = 0 across the plot, clipped by the caller's clip-path */
  function boundary(g, f, a, b, c, o) {
    let p1, p2;
    if (Math.abs(b) > Math.abs(a)) { p1 = [LO - 1, -(a * (LO - 1) + c) / b]; p2 = [HI + 1, -(a * (HI + 1) + c) / b]; }
    else { p1 = [-(b * (LO - 1) + c) / a, LO - 1]; p2 = [-(b * (HI + 1) + c) / a, HI + 1]; }
    return el('line', Object.assign({ x1: f.sx(p1[0]), y1: f.sy(p1[1]), x2: f.sx(p2[0]), y2: f.sy(p2[1]), fill: 'none' }, o), g);
  }
  function points(g, G, f, q, tipOn) {
    X.forEach((p, i) => {
      const v = q === undefined ? 1 : ease(clamp(((q * 1.3 + 0.2) - (i / X.length) * 0.8) / 0.2, 0, 1));
      if (v > 0.01) K.dotAt(g, f.sx(p[0]), f.sy(p[1]), Y[i] === 1, G.dr, tipOn ? '<b>Point ' + (i + 1) + '</b> (made up)<br>x₁ = ' + p[0].toFixed(2) + ', x₂ = ' + p[1].toFixed(2) + '<br>' + (Y[i] ? 'yes' : 'no') : null, v);
    });
  }
  const pctOf = (v) => Math.round(v * 100);

  /* ============================================================
     Chapter 3 - one neuron is not enough
     ============================================================ */
  K.register('ch3', function (C0) {
    const svg = C0.svg, G = geo(C0), f = squareFrame(G);
    const defs = el('defs', {}, svg);
    K.clipRect(defs, 'clip3', f.left, f.top, f.s, f.s);
    const dyn = el('g', {}, svg);
    Array.prototype.forEach.call(C0.ctl.querySelectorAll('[data-hid]'), (b) => { b.onclick = () => { S.hid = +b.getAttribute('data-hid'); C0.redraw(); }; });
    const mapImg = (g, url, op) => { if (url) el('image', { href: url, x: f.left, y: f.top, width: f.s, height: f.s, preserveAspectRatio: 'none', opacity: op === undefined ? 1 : op }, g); };

    /* stage 0: the best a single neuron does */
    function xor(q) {
      const net = F.nets[0], m = net.model;
      const gm = el('g', { 'clip-path': 'url(#clip3)' }, dyn);
      mapImg(gm, mapOf(m, 'h0'), 0.55 * ease(clamp(q * 2 - 0.4)));
      xorAxes(dyn, G, f);
      if (q > 0.35) boundary(gm, f, m.w[0], m.w[1], m.b, { stroke: C.ink, 'stroke-width': 3, opacity: ease(clamp((q - 0.35) * 3)) });
      points(dyn, G, f, Math.min(1, q * 2), true);
      C0.cap('One neuron, one straight line: <b>' + pctOf(net.acc) + '%</b> of the ' + X.length + ' points on the right side. No straight line can do better than about 75%.');
    }

    /* stage 1: add hidden neurons */
    function hidden() {
      const h = S.hid, net = F.nets[h], m = net.model;
      const gm = el('g', { 'clip-path': 'url(#clip3)' }, dyn);
      mapImg(gm, mapOf(m, 'h' + h), 0.7);
      xorAxes(dyn, G, f);
      if (h === 0) boundary(gm, f, m.w[0], m.w[1], m.b, { stroke: C.ink, 'stroke-width': 3 });
      else for (let j = 0; j < h; j++) boundary(gm, f, m.W1[j][0], m.W1[j][1], m.b1[j], { stroke: C.accent, 'stroke-width': 1.6, 'stroke-dasharray': '6 4', opacity: 0.8 });
      points(dyn, G, f, undefined, true);
      C0.cap(h === 0 ? 'No hidden layer: one neuron, one line, <b>' + pctOf(net.acc) + '%</b>.'
        : '<b>' + h + ' hidden neurons</b> (dashed: the line each one draws), accuracy <b>' + pctOf(net.acc) + '%</b>, loss ' + net.loss.toFixed(2) + '.');
    }

    /* stage 2: the points seen through the hidden neurons */
    const m2 = F.nets[2].model;
    const hid = X.map((p) => NN.forward(m2, p).hid);
    const hs = { sx: lin(-0.05, 1.05, f.left, f.left + f.s), sy: lin(-0.05, 1.05, f.top + f.s, f.top) };
    function space(q) {
      const u = ease(clamp((q - 0.1) / 0.7));
      const g0 = el('g', { opacity: 1 - u }, dyn);
      xorAxes(g0, G, f, { xtitle: 'x₁ (input)', ytitle: 'x₂ (input)' });
      const gm = el('g', { 'clip-path': 'url(#clip3)' }, dyn);
      if (u < 0.99) mapImg(gm, mapOf(F.nets[0].model, 'h0'), 0);
      /* the output neuron's view: its probability map over the hidden neurons' answers */
      const outMap = cached('out2', () => K.mapImage((a, b) => NN.sigmoid(m2.W2[0] * a + m2.W2[1] * b + m2.b2), -0.05, 1.05, 48));
      if (outMap) el('image', { href: outMap, x: f.left, y: f.top, width: f.s, height: f.s, preserveAspectRatio: 'none', opacity: 0.7 * clamp((u - 0.5) * 2) }, gm);
      const g1 = el('g', { opacity: u }, dyn);
      axes(g1, G, hs.sx, hs.sy, { xt: [0, 0.5, 1], yt: [0, 0.5, 1], xfmt: (v) => String(v), yfmt: (v) => String(v), xtitle: 'hidden neuron 1 (its answer)', ytitle: 'hidden neuron 2 (its answer)', ytx: f.left - (G.M ? 28 : 40) });
      if (u > 0.6) boundary(gm, { sx: hs.sx, sy: hs.sy }, m2.W2[0], m2.W2[1], m2.b2, { stroke: C.ink, 'stroke-width': 3, opacity: clamp((u - 0.6) * 3) });
      X.forEach((p, i) => {
        const x = lerp(f.sx(p[0]), hs.sx(hid[i][0]), u), y = lerp(f.sy(p[1]), hs.sy(hid[i][1]), u);
        K.dotAt(dyn, x, y, Y[i] === 1, G.dr, null, 1);
      });
      C0.cap(u < 0.2 ? 'The original points: no straight line separates them.' : u < 0.95 ? 'Each point moves to (answer of hidden neuron 1, answer of hidden neuron 2).'
        : 'In the hidden neurons’ space one straight line, the output neuron’s, separates yes from no.');
    }

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlState(C0.ctl, true);
        Array.prototype.forEach.call(C0.ctl.querySelectorAll('[data-hid]'), (b) => b.setAttribute('aria-pressed', String(+b.getAttribute('data-hid') === S.hid)));
        [xor, hidden, space][stage](q);
      }
    };
  });

  /* ============================================================
     a small 2-2-1 network drawn with live numbers (chapters 4 and 5)
     ============================================================ */
  function netBox(G) { return G.M ? { x: 58, y: 44, w: 216, h: 170 } : { x: 96, y: 80, w: G.W - 96 - 190, h: G.H - 80 - 120 }; }
  function node(g, G, p, r, val, fill, stroke, label) {
    el('circle', { cx: p.x, cy: p.y, r: r, fill: fill, stroke: stroke, 'stroke-width': 2.4 }, g);
    if (val !== null) T(g, p.x, p.y + G.fs * 0.35, val, G.fs, C.ink, { anchor: 'middle', weight: 600 });
    if (label) T(g, p.x, p.y - r - 6, label, G.fs - 1, C.muted, { anchor: 'middle' });
  }
  const edgeW = (w) => 0.8 + Math.min(Math.abs(w), 8) * 0.5;
  const edgeCol = (w) => (w >= 0 ? C.blue : C.orange);
  /* edges of the 2-2-1 network: [{from: node, to: node, key, w}] with the node coordinates from netLayout */
  function edgesOf(model, L) {
    const e = [];
    for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) e.push({ a: L[0][k], b: L[1][j], w: model.W1[j][k], id: 'W1_' + j + k });
    for (let j = 0; j < 2; j++) e.push({ a: L[1][j], b: L[2][0], w: model.W2[j], id: 'W2_' + j });
    return e;
  }
  const tint = (v, col) => K.mix('#ffffff', col, clamp(v));

  /* ============================================================
     Chapter 4 - layers and the forward pass
     ============================================================ */
  K.register('ch4', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, M = G.M;
    const dyn = el('g', {}, svg);
    const sX1 = $('sX1'), sX2 = $('sX2');
    sX1.oninput = () => { S.x1 = +sX1.value; C0.redraw(); };
    sX2.oninput = () => { S.x2 = +sX2.value; C0.redraw(); };

    function layers(q) {
      const sizes = [6, 4, 3], box = { x: M ? 74 : 130, y: M ? 56 : 80, w: W - (M ? 74 + 78 : 130 + 150), h: H - (M ? 56 + 96 : 80 + 150) };
      const L = K.netLayout(sizes, box), t = [ease(rev(q, 0, 3)), ease(rev(q, 1, 3)), ease(rev(q, 2, 3))];
      const R = M ? 8 : 12;
      for (let a = 0; a < 2; a++) L[a].forEach((p) => L[a + 1].forEach((p2) => el('line', { x1: p.x, y1: p.y, x2: p2.x, y2: p2.y, stroke: C.axis, 'stroke-width': 1, opacity: 0.6 * t[a + 1] }, dyn)));
      L[0].forEach((p, i) => { T(dyn, p.x - R - 6, p.y + G.fs * 0.35, NN.REVIEW.short[i], G.fs - 1, C.ink, { anchor: 'end', op: t[0] }); });
      L[2].forEach((p, i) => { T(dyn, p.x + R + 6, p.y + G.fs * 0.35, NN.CLASSES[i], G.fs - 1, C.ink, { op: t[2] }); });
      const cols = [C.blue, C.accent, C.teal], names = ['input layer', 'hidden layer', 'output layer'];
      const notes = [['6', 'one per feature', 'fixed by your data', C.teal], ['4', 'any number you like', 'your choice', C.accent], ['3', 'one per class', 'fixed by your data', C.teal]];
      L.forEach((layer, li) => {
        layer.forEach((p) => { el('circle', { cx: p.x, cy: p.y, r: R, fill: '#fff', stroke: cols[li], 'stroke-width': 2.6, opacity: t[li] }, dyn); });
        const x = layer[0].x, nt = notes[li];
        T(dyn, x, box.y - (M ? 26 : 34), names[li], G.ft, cols[li], { anchor: 'middle', weight: 700, op: t[li] });
        el('rect', { x: x - (M ? 38 : 56), y: box.y + box.h + (M ? 18 : 28), width: M ? 76 : 112, height: M ? 44 : 58, rx: 9, fill: nt[3] === C.teal ? '#e5f4f4' : C.accentSoft, stroke: nt[3], 'stroke-width': 1.6, opacity: t[li] }, dyn);
        T(dyn, x, box.y + box.h + (M ? 34 : 50), nt[0] + ' neurons', G.ft, C.ink, { anchor: 'middle', weight: 700, op: t[li] });
        T(dyn, x, box.y + box.h + (M ? 46 : 66), nt[1], G.fs - 1, C.muted, { anchor: 'middle', op: t[li] });
        if (!M) T(dyn, x, box.y + box.h + 82, nt[2], G.fs - 1, nt[3], { anchor: 'middle', weight: 600, op: t[li] });
      });
      C0.cap('The data fixes the input size (features) and the output size (classes). The hidden layers are your design.');
    }

    function forward(q) {
      const m = F.nets[2].model, x = [S.x1, S.x2], f = NN.forward(m, x);
      const box = netBox(G), L = K.netLayout([2, 2, 1], box), R = M ? 17 : 24;
      const t1 = ease(clamp(q / 0.4 + 0.2)), t2 = ease(clamp((q - 0.25) / 0.4 + 0.2));
      const E = edgesOf(m, L);
      E.forEach((e, i) => {
        const hidEdge = i < 4, t = hidEdge ? t1 : t2;
        el('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, stroke: edgeCol(e.w), 'stroke-width': edgeW(e.w), 'stroke-opacity': 0.7 * t, 'stroke-linecap': 'round' }, dyn);
        const px = lerp(e.a.x, e.b.x, hidEdge ? 0.3 : 0.4), py = lerp(e.a.y, e.b.y, hidEdge ? 0.3 : 0.4);
        T(dyn, px, py - 3, num(e.w, 1), G.fs - 1, edgeCol(e.w), { anchor: 'middle', halo: true, weight: 600, op: t });
      });
      L[0].forEach((p, k) => { node(dyn, G, p, R, num(x[k], 1), '#fff', C.blue, 'x' + (k ? '₂' : '₁')); });
      L[1].forEach((p, j) => { node(dyn, G, p, R, f.hid[j].toFixed(2), tint(f.hid[j], '#a99ae6'), C.accent, 'hidden ' + (j + 1)); el('g', {}, dyn); });
      node(dyn, G, L[2][0], R, f.p.toFixed(2), tint(f.p, '#7fc4c4'), C.teal, 'output');
      const ox = L[2][0].x + R + 14;
      T(dyn, ox, L[2][0].y - 4, f.p >= 0.5 ? '“yes”' : '“no”', G.ft + 1, f.p >= 0.5 ? C.blue : C.orange, { weight: 700 });
      T(dyn, ox, L[2][0].y + 14, 'P = ' + f.p.toFixed(2), G.fs, C.muted);
      T(dyn, box.x + box.w / 2, box.y + box.h + (M ? 40 : 54), 'multiply, add, squish: layer after layer', G.ft, C.muted, { anchor: 'middle' });
      /* where the input lies, drawn on the regions this network learned (wide screens) */
      if (!M) {
        const s = 150, ix = W - s - 30, iy = H - s - 56, sx = lin(LO, HI, ix, ix + s), sy = lin(LO, HI, iy + s, iy);
        const url = mapOf(m, 'h2');
        if (url) el('image', { href: url, x: ix, y: iy, width: s, height: s, preserveAspectRatio: 'none', opacity: 0.8 }, dyn);
        el('rect', { x: ix, y: iy, width: s, height: s, fill: 'none', stroke: C.axis }, dyn);
        X.forEach((p, i) => K.dotAt(dyn, sx(p[0]), sy(p[1]), Y[i] === 1, 2.4, null, 0.55));
        el('circle', { cx: sx(x[0]), cy: sy(x[1]), r: 6, fill: 'none', stroke: C.ink, 'stroke-width': 2.4 }, dyn);
        T(dyn, ix + s / 2, iy - 8, 'your input on the learned regions', G.fs - 1, C.muted, { anchor: 'middle' });
      }
      C0.cap('Inputs (' + num(x[0], 1) + ', ' + num(x[1], 1) + ') &rarr; hidden answers ' + f.hid[0].toFixed(2) + ' and ' + f.hid[1].toFixed(2) + ' &rarr; output <b>' + f.p.toFixed(2) + '</b>. The weights are fixed.');
    }

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlState(C0.ctl, true);
        if (document.activeElement !== sX1) sX1.value = S.x1;
        if (document.activeElement !== sX2) sX2.value = S.x2;
        $('oX1').textContent = num(S.x1, 1); $('oX2').textContent = num(S.x2, 1);
        [layers, forward][stage](q);
      }
    };
  });

  /* ============================================================
     Chapter 5 - learning: backpropagation, many epochs, what you choose
     ============================================================ */
  K.register('ch5', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, M = G.M;
    const dyn = el('g', {}, svg);
    ctlState(C0.ctl, false); C0.ctl.classList.remove('on');

    /* one training example: an early (poor) snapshot of the 2-hidden net and its worst-classified "yes" point */
    const snap = F.nets[2].snaps[3], bm = snap.model, LR_ = 2;
    let ex = 0, exP = 2;
    X.forEach((p, i) => { if (Y[i] === 1) { const pr = NN.forward(bm, p).p; if (pr < exP) { exP = pr; ex = i; } } });
    const exX = X[ex], exY = Y[ex], G0 = NN.grads(bm, exX, exY);
    const newM = NN.cloneModel(bm);
    for (let j = 0; j < 2; j++) { for (let k = 0; k < 2; k++) newM.W1[j][k] -= LR_ * G0.dW1[j][k]; newM.W2[j] -= LR_ * G0.dW2[j]; }
    const newP = NN.forward(newM, exX).p;

    function backprop(q) {
      const box = netBox(G), L = K.netLayout([2, 2, 1], box), R = M ? 17 : 22, f = G0.f;
      const ph = q < 0.22 ? 0 : q < 0.45 ? 1 : q < 0.78 ? 2 : 3;
      const tb = ease(clamp((q - 0.45) / 0.3)), tu = ease(clamp((q - 0.78) / 0.15));
      const E = edgesOf(bm, L), En = edgesOf(newM, L);
      const gr = [G0.dW1[0][0], G0.dW1[0][1], G0.dW1[1][0], G0.dW1[1][1], G0.dW2[0], G0.dW2[1]];
      const gmax = Math.max.apply(null, gr.map(Math.abs));
      E.forEach((e, i) => {
        const hidEdge = i < 4, w = ph === 3 ? lerp(e.w, En[i].w, tu) : e.w;
        const gw = ph >= 2 ? 1.2 + 6 * Math.abs(gr[i]) / gmax * (hidEdge ? tb : clamp(tb * 2)) : 0;
        el('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, stroke: edgeCol(w), 'stroke-width': edgeW(w), 'stroke-opacity': ph >= 2 ? 0.35 : 0.7, 'stroke-linecap': 'round' }, dyn);
        if (ph === 2 || ph === 3) el('line', { x1: e.b.x, y1: e.b.y, x2: lerp(e.b.x, e.a.x, hidEdge ? clamp(tb * 1.4 - 0.2) : clamp(tb * 2)), y2: lerp(e.b.y, e.a.y, hidEdge ? clamp(tb * 1.4 - 0.2) : clamp(tb * 2)), stroke: C.red, 'stroke-width': gw, 'stroke-opacity': ph === 3 ? 0.35 : 0.85, 'stroke-linecap': 'round' }, dyn);
        const px = lerp(e.a.x, e.b.x, hidEdge ? 0.3 : 0.4), py = lerp(e.a.y, e.b.y, hidEdge ? 0.3 : 0.4);
        let label, col = edgeCol(w);
        if (ph === 2) { label = 'blame ' + num(gr[i], 2); col = C.red; }
        else if (ph === 3) { label = num(e.w, 1) + ' → ' + num(En[i].w, 1); }
        else label = num(e.w, 1);
        T(dyn, px, py - 3, label, G.fs - 1, col, { anchor: 'middle', halo: true, weight: 600 });
      });
      L[0].forEach((p, k) => node(dyn, G, p, R, num(exX[k], 1), '#fff', C.blue, 'x' + (k ? '₂' : '₁')));
      L[1].forEach((p, j) => node(dyn, G, p, R, f.hid[j].toFixed(2), tint(f.hid[j], '#a99ae6'), C.accent, 'hidden ' + (j + 1)));
      const pOut = ph === 3 ? lerp(f.p, newP, tu) : f.p;
      node(dyn, G, L[2][0], R, pOut.toFixed(2), tint(pOut, '#7fc4c4'), ph >= 1 && ph < 3 ? C.red : C.teal, 'output');
      const ox = L[2][0].x + R + 12, oy = L[2][0].y;
      T(dyn, ox, oy - 8, (M ? 'answer: ' : 'true answer: ') + (exY ? 'yes' : 'no'), G.fs, C.ink, { weight: 600 });
      if (ph >= 1) T(dyn, ox, oy + 9, 'penalty ' + NN.penalty(exY ? f.p : 1 - f.p).toFixed(2), G.fs, C.red, { weight: 700 });
      if (ph === 3) T(dyn, ox, oy + 26, 'now ' + newP.toFixed(2), G.fs, C.teal, { weight: 700 });
      const steps = ['1 · forward: run the example through', '2 · loss: how wrong was the answer?', '3 · backward: how much is each weight to blame?', '4 · update: nudge each weight the other way'];
      steps.forEach((s, i) => T(dyn, 14, box.y + box.h + (M ? 30 : 46) + i * (G.fs + 5), s, G.fs, i === ph ? C.accent : C.muted, { weight: i === ph ? 700 : 400 }));
      C0.cap(['The network (early in training) is shown one point and gives P(yes) = <b>' + f.p.toFixed(2) + '</b>.',
        'The true answer is “yes”, so the penalty is &minus;ln ' + f.p.toFixed(2) + ' = <b>' + NN.penalty(f.p).toFixed(2) + '</b>.',
        'Red: the blame of each weight (the gradient). Thicker means more blame.',
        'Each weight moves a little against its blame; the same point now scores <b>' + newP.toFixed(2) + '</b>.'][ph]);
    }

    /* training: the regions and the loss curve over the epochs */
    const net3 = F.nets[3], nS = net3.snaps.length;
    function train(q) {
      const k = Math.round(clamp(q * 1.05) * (nS - 1)), sn = net3.snaps[k];
      const m = G.m;
      let f, c0, cl, ct, cb;
      if (M) {
        const s = 150; f = { s: s, left: (W - s) / 2 + 8, top: 24 };
        c0 = 46; cl = W - 14; ct = f.top + s + 34; cb = H - 36;
      } else {
        const s = 300; f = { s: s, left: 56, top: 112 };
        c0 = 412; cl = W - 20; ct = 112; cb = 112 + s;
      }
      f.sx = lin(LO, HI, f.left, f.left + f.s); f.sy = lin(LO, HI, f.top + f.s, f.top);
      const url = cached('t3_' + k, () => K.mapImage((a, b) => NN.forward(sn.model, [a, b]).p, LO, HI, 44));
      if (url) el('image', { href: url, x: f.left, y: f.top, width: f.s, height: f.s, preserveAspectRatio: 'none', opacity: 0.85 }, dyn);
      el('rect', { x: f.left, y: f.top, width: f.s, height: f.s, fill: 'none', stroke: C.axis }, dyn);
      X.forEach((p, i) => K.dotAt(dyn, f.sx(p[0]), f.sy(p[1]), Y[i] === 1, M ? 2.8 : 3.8));
      T(dyn, f.left + f.s / 2, f.top - 8, 'what the network says now', G.fs, C.muted, { anchor: 'middle', weight: 600 });
      /* loss curve */
      const E = net3.opt.epochs, cx = lin(0, E, c0, cl), cy = lin(0, Math.max(0.8, net3.curve[0] * 1.05), cb, ct);
      axes(dyn, G, cx, cy, { xt: [0, 100, 200, 300, 400], yt: [0, 0.2, 0.4, 0.6], xtitle: 'epoch', ytitle: 'loss', ytx: c0 - (M ? 30 : 38), yfmt: (v) => String(v) });
      el('path', { d: pathD(net3.curve.map((v, e) => [cx(e), cy(v)])), fill: 'none', stroke: C.grey, 'stroke-width': 1.6, 'stroke-opacity': 0.5 }, dyn);
      el('path', { d: pathD(net3.curve.slice(0, sn.epoch + 1).map((v, e) => [cx(e), cy(v)])), fill: 'none', stroke: C.accent, 'stroke-width': 3 }, dyn);
      el('circle', { cx: cx(sn.epoch), cy: cy(sn.loss), r: G.dr, fill: C.accent, stroke: '#fff', 'stroke-width': 1.4 }, dyn);
      C0.cap('Epoch <b>' + sn.epoch + '</b> of ' + E + ': loss <b>' + sn.loss.toFixed(2) + '</b>, ' + pctOf(sn.acc) + '% of the points right. (3 hidden neurons)');
    }

    /* what you choose */
    function choices(q) {
      const colW = (W - 36) / 2, y0 = M ? 14 : 44, bh = M ? 150 : 240;
      const card = (x, title, col, fill, items, t) => {
        el('rect', { x: x, y: y0, width: colW, height: bh, rx: 12, fill: fill, stroke: col, 'stroke-width': 2, opacity: t }, dyn);
        T(dyn, x + colW / 2, y0 + (M ? 20 : 30), title, G.ft + 1, col, { anchor: 'middle', weight: 700, op: t });
        items.forEach((s, i) => {
          const ti = ease(rev(q, i + 1, items.length + 1));
          T(dyn, x + 14, y0 + (M ? 42 : 68) + i * (M ? 17 : 29), '•  ' + s, G.fs + (M ? 0 : 2), C.ink, { op: ti * t });
        });
      };
      card(12, 'training learns', C.teal, '#e8f5f5', ['weights', 'biases'], 1);
      card(24 + colW, 'you choose', C.accent, '#f3f1fc', ['activation function', 'layers and neurons', 'loss function', 'learning rate', 'number of epochs', 'regularization'], ease(clamp(q * 3)));
      const ty = y0 + bh + (M ? 24 : 38), tt = ease(clamp((q - 0.45) * 2));
      T(dyn, 14, ty, 'the loss follows the task', G.ft, C.ink, { weight: 700, op: tt });
      [['numbers (a score, a price)', 'mean squared error'], ['yes / no', 'binary cross-entropy'], ['one of many classes', 'categorical cross-entropy']].forEach((r, i) => {
        const y = ty + (M ? 18 : 30) + i * (M ? 17 : 30);
        T(dyn, 14, y, r[0], G.fs + (M ? 0 : 2), C.muted, { op: tt });
        T(dyn, W * 0.5, y, '→  ' + r[1], G.fs + (M ? 0 : 2), C.ink, { weight: 600, op: tt });
      });
      C0.cap('Only the weights and biases are learned. Everything else is set by you before training starts.');
    }

    return { render: function (stage, q) { clear(dyn); [backprop, train, choices][stage](q); } };
  });
})();
