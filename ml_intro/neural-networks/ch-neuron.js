/* Chapters 1 and 2 of "From a Yes to a Network": the weighted-sum machine of logistic regression, and the same machine drawn as a neuron. */
(function () {
  'use strict';
  const K = window.NNKIT;
  if (!K) return;
  const NN = K.NN, F = K.F, S = K.S, C = K.C;
  const el = K.el, T = K.T, clear = K.clear, clamp = K.clamp, lerp = K.lerp, ease = K.ease, rev = K.rev, fmt = K.fmt;
  const lin = K.lin, geo = K.geo, axes = K.axes, pathD = K.pathD, tex = K.tex, ctlState = K.ctlState;
  const $ = (id) => document.getElementById(id);
  const REV = NN.REVIEW;

  /* the current review: the class example, with the two slider-controlled word counts */
  const current = () => NN.reviewWith(S.pos, S.neg);
  const xs = () => { const x = REV.x.slice(); x[0] = S.pos; x[1] = S.neg; return x; };
  const num = (v, d) => fmt(v, d === undefined ? 1 : d);

  /* ============================================================
     Chapter 1 - the weighted sum, the penalty, the weight that never stops, softmax
     ============================================================ */
  K.register('ch1', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, M = G.M;
    const dyn = el('g', {}, svg);
    /* controls */
    const sPos = $('sPos'), sNeg = $('sNeg');
    sPos.oninput = () => { S.pos = +sPos.value; C0.redraw(); };
    sNeg.oninput = () => { S.neg = +sNeg.value; C0.redraw(); };
    Array.prototype.forEach.call(C0.ctl.querySelectorAll('[data-y]'), (b) => { b.onclick = () => { S.y = +b.getAttribute('data-y'); C0.redraw(); }; });
    Array.prototype.forEach.call(C0.ctl.querySelectorAll('[data-lam]'), (b) => { b.onclick = () => { S.lam = +b.getAttribute('data-lam'); C0.redraw(); }; });
    [0, 1, 2].forEach((k) => { const s = $('sc' + k); s.oninput = () => { S.scores[k] = +s.value; C0.redraw(); }; });

    /* ---- stage 0: the waterfall of evidence and the S-curve ---- */
    function review(q) {
      const cur = current(), x = xs();
      const rowH = M ? 15.5 : 25, top = M ? 20 : 34, nRows = 8;
      const labR = M ? 104 : 190, prodL = M ? 110 : 198, zx = M ? 262 : 452, half = M ? 80 : 128, range = 12;
      const bx = lin(-range, range, zx - half, zx + half);
      T(dyn, labR, top - 8, 'feature', G.fs, C.muted, { anchor: 'end', weight: 600 });
      T(dyn, prodL, top - 8, 'value × weight', G.fs, C.muted, { weight: 600 });
      el('line', { x1: zx, x2: zx, y1: top - 4, y2: top + nRows * rowH, stroke: C.axis }, dyn);
      T(dyn, bx(-range * 0.55), top - 8, 'against', G.fs, C.orange, { anchor: 'middle', weight: 600 });
      T(dyn, bx(range * 0.55), top - 8, 'for', G.fs, C.blue, { anchor: 'middle', weight: 600 });
      const rows = REV.short.map((nm, i) => ({ name: nm, prod: num(x[i], i === 5 ? 2 : 0) + ' × ' + num(REV.w[i], 1), v: cur.contrib[i], col: cur.contrib[i] >= 0 ? C.blue : C.orange }));
      rows.push({ name: 'bias b', prod: '', v: REV.b, col: REV.b >= 0 ? C.blue : C.orange });
      rows.push({ name: 'total z', prod: '', v: cur.z, col: C.accent, bold: true });
      rows.forEach((r, i) => {
        const y = top + i * rowH, t = i < 7 ? ease(rev(q, i, 8)) : ease(rev(q, 7, 8));
        const cy = y + rowH / 2;
        if (r.bold) el('line', { x1: 8, x2: W - 8, y1: y, y2: y, stroke: C.axis, 'stroke-dasharray': '3 3' }, dyn);
        T(dyn, labR, cy + G.fs * 0.35, r.name, G.fs, r.bold ? C.accent : C.ink, { anchor: 'end', weight: r.bold ? 700 : 400 });
        if (r.prod) T(dyn, prodL, cy + G.fs * 0.35, r.prod, G.fs, C.muted);
        const v = clamp(r.v, -range, range) * t, x0 = bx(0), x1 = bx(v);
        el('rect', { x: Math.min(x0, x1), y: y + rowH * 0.2, width: Math.abs(x1 - x0), height: rowH * 0.6, fill: r.col, 'fill-opacity': r.bold ? 0.95 : 0.8, rx: 2 }, dyn);
        if (Math.abs(r.v) > range) T(dyn, r.v > 0 ? bx(range) + 3 : bx(-range) - 3, cy + G.fs * 0.35, r.v > 0 ? '»' : '«', G.fs, C.muted, { anchor: r.v > 0 ? 'start' : 'end' });
        if (t > 0.6) T(dyn, v >= 0 ? Math.max(x1, x0) + 4 : Math.min(x1, x0) - 4, cy + G.fs * 0.35, num(r.v, 1), G.fs, r.col, { anchor: v >= 0 ? 'start' : 'end', weight: 600, halo: true });
      });
      /* the sigmoid with a probe */
      const cTop = top + nRows * rowH + (M ? 22 : 36), cBot = H - (M ? 38 : 56);
      const sx = lin(-6, 6, M ? 52 : 74, W - (M ? 22 : 40)), sy = lin(0, 1, cBot, cTop);
      axes(dyn, G, sx, sy, { xt: [-6, -3, 0, 3, 6], yt: [0, 0.5, 1], yfmt: (v) => (v === 0 ? '0' : v === 1 ? '1' : '0.5'), xtitle: 'score z', ytitle: M ? 'P(positive)' : 'probability of positive', ytx: M ? 10 : 18 });
      const u = ease(clamp((q - 0.55) / 0.4));
      el('path', { d: pathD(K.curvePts(sx, sy, NN.sigmoid, -6, lerp(-6, 6, u), 0.1)), fill: 'none', stroke: C.ink, 'stroke-width': 2.6 }, dyn);
      if (lerp(-6, 6, u) >= clamp(cur.z, -6, 6)) {
        const zc = clamp(cur.z, -6, 6), px = sx(zc), py = sy(cur.p);
        el('line', { x1: px, x2: px, y1: cBot, y2: py, stroke: C.accent, 'stroke-dasharray': '4 4', 'stroke-width': 1.6 }, dyn);
        el('line', { x1: sx(-6), x2: px, y1: py, y2: py, stroke: C.accent, 'stroke-dasharray': '4 4', 'stroke-width': 1.6 }, dyn);
        el('circle', { cx: px, cy: py, r: G.dr + 1.5, fill: C.accent, stroke: '#fff', 'stroke-width': 1.5 }, dyn);
        T(dyn, clamp(px, 70, W - 70), Math.min(py - 10, cBot - 8) , Math.round(cur.p * 100) + '% positive', G.ft, C.accent, { anchor: px > W - 100 ? 'end' : 'middle', weight: 700, halo: true });
      }
      C0.cap('z = <b>' + num(cur.z, 2) + '</b> &rarr; P(positive) = <b>' + cur.p.toFixed(2) + '</b>. Weights and bias are the pretend-trained ones from class.');
    }

    /* ---- stage 1: the penalty curve ---- */
    function loss(q) {
      const cur = current(), y = S.y;
      const mL = M ? 46 : 68, top = M ? 24 : 36, bot = H - (M ? 46 : 66);
      const sx = lin(0, 1, mL, W - (M ? 18 : 40)), sy = lin(0, 4.6, bot, top);
      axes(dyn, G, sx, sy, { xt: [0, 0.25, 0.5, 0.75, 1], xfmt: (v) => String(v), yt: [0, 1, 2, 3, 4], xtitle: 'probability the model gives to “positive”', ytitle: 'penalty', ytx: M ? 10 : 18 });
      const fn = (p) => NN.penalty(y ? p : 1 - p);
      const u = ease(clamp(q / 0.6 + 0.15));
      const x1 = lerp(0.01, 0.99, u);
      const pts = []; for (let p = 0.01; p <= x1 + 1e-9; p += 0.005) pts.push([sx(p), sy(fn(p))]);
      el('path', { d: pathD(pts), fill: 'none', stroke: y ? C.blue : C.orange, 'stroke-width': 3 }, dyn);
      const wrongSide = y ? 0.1 : 0.9;
      T(dyn, sx(wrongSide), sy(4.1), 'sure and wrong', G.ft, C.red, { anchor: y ? 'start' : 'end', weight: 700 });
      T(dyn, sx(wrongSide) + (y ? 0 : 0), sy(3.7), 'huge penalty', G.fs, C.red, { anchor: y ? 'start' : 'end' });
      T(dyn, sx(y ? 0.97 : 0.03), sy(0.35), 'sure and right', G.fs, C.teal, { anchor: y ? 'end' : 'start', weight: 600 });
      if (u > 0.9) {
        const p = cur.p, pen = fn(p), px = sx(p), py = sy(pen);
        el('line', { x1: px, x2: px, y1: bot, y2: py, stroke: C.accent, 'stroke-dasharray': '4 4', 'stroke-width': 1.6 }, dyn);
        el('circle', { cx: px, cy: py, r: G.dr + 1.5, fill: C.accent, stroke: '#fff', 'stroke-width': 1.5 }, dyn);
        T(dyn, clamp(px, 62, W - 62), py - 12, 'penalty ' + pen.toFixed(2), G.ft, C.accent, { anchor: 'middle', weight: 700, halo: true });
      }
      C0.cap('The review gets P(positive) = <b>' + cur.p.toFixed(2) + '</b>. If it really is ' + (y ? 'positive' : 'negative') + ', the penalty is &minus;ln(' +
        (y ? cur.p : 1 - cur.p).toFixed(2) + ') = <b>' + fn(cur.p).toFixed(2) + '</b>.');
    }

    /* ---- stage 2: the weight that grows forever, and the penalty that stops it ---- */
    function reg(q) {
      const snaps = F.sep[S.lam], k = Math.round(q * (snaps.length - 1)), sn = snaps[k];
      const mL = M ? 44 : 64, rr = W - (M ? 16 : 36), gap = M ? 40 : 56;
      const h1 = (H - gap - (M ? 30 : 40)) * 0.52, t1 = M ? 14 : 22, b1 = t1 + h1, t2 = b1 + gap, b2 = H - (M ? 36 : 50);
      /* top: the made-up data and the current curve */
      const sx = lin(-4, 4, mL, rr), sy = lin(0, 1, b1, t1);
      axes(dyn, G, sx, sy, { xt: [-4, -2, 0, 2, 4], yt: [0, 1], xtitle: 'a feature of the review (made up)', ytitle: M ? 'P(positive)' : 'probability of positive', ytx: M ? 10 : 18 });
      el('path', { d: pathD(K.curvePts(sx, sy, (x) => NN.sigmoid(sn.w * x + sn.b), -4, 4, 0.05)), fill: 'none', stroke: C.ink, 'stroke-width': 2.6 }, dyn);
      NN.SEP.x.forEach((x, i) => K.dotAt(dyn, sx(x), sy(NN.SEP.y[i]), NN.SEP.y[i] === 1, G.dr));
      /* bottom: the weight against the training step */
      const tx = lin(0, NN.SEP_STEPS, mL, rr), wMax = 6.5, ty = lin(0, wMax, b2, t2);
      axes(dyn, G, tx, ty, { xt: [0, 200, 400, 600], yt: [0, 2, 4, 6], xtitle: 'training step', ytitle: 'weight w', ytx: M ? 10 : 18 });
      F.sep.forEach((sn2, li) => {
        const sel = li === S.lam;
        const pts = sn2.map((s) => [tx(s.t), ty(Math.min(s.w, wMax))]);
        el('path', { d: pathD(pts), fill: 'none', stroke: sel ? C.accent : C.grey, 'stroke-width': sel ? 2.8 : 1.4, 'stroke-opacity': sel ? 1 : 0.5 }, dyn);
        const lastP = pts[pts.length - 1];
        T(dyn, lastP[0] - 3, lastP[1] - 5, ['no penalty', 'small', 'large'][li], G.fs - 1, sel ? C.accent : C.muted, { anchor: 'end', weight: sel ? 700 : 400 });
      });
      el('line', { x1: tx(sn.t), x2: tx(sn.t), y1: t2, y2: b2, stroke: C.accent, 'stroke-dasharray': '4 4' }, dyn);
      el('circle', { cx: tx(sn.t), cy: ty(Math.min(sn.w, wMax)), r: G.dr, fill: C.accent, stroke: '#fff', 'stroke-width': 1.4 }, dyn);
      C0.cap('Step <b>' + sn.t + '</b>: weight w = <b>' + num(sn.w, 2) + '</b>, cross-entropy ' + sn.ce.toFixed(3) +
        (S.lam === 0 ? ' &middot; still climbing, never settling' : ' &middot; the penalty keeps w from running away'));
    }

    /* ---- stage 3: softmax ---- */
    function softmax() {
      const sc = S.scores, pr = NN.softmax(sc), n = 3;
      const top = M ? 44 : 70, rowH = M ? 66 : 102;
      const l1 = M ? 78 : 112, zx = M ? 140 : 220, half = M ? 56 : 90, px0 = M ? 232 : 392, pw = M ? 120 : 190;
      T(dyn, zx, top - 22, 'scores', G.ft, C.muted, { anchor: 'middle', weight: 700 });
      T(dyn, W - (M ? 70 : 100), top - 22, 'probabilities', G.ft, C.muted, { anchor: 'middle', weight: 700 });
      const bx = lin(-4, 4, zx - half, zx + half);
      arrow2(zx + half + 12, top + rowH * 1.5 - 12, px0 - 12);
      T(dyn, (zx + half + px0) / 2, top + rowH * 1.5 - 18, 'softmax', G.fs, C.accent, { anchor: 'middle', weight: 700 });
      NN.CLASSES.forEach((nm, k) => {
        const cy = top + k * rowH + rowH / 2, isTrue = k === 0;
        T(dyn, l1, cy + 4, nm, G.ft, C.ink, { anchor: 'end', weight: isTrue ? 700 : 400 });
        el('line', { x1: zx, x2: zx, y1: cy - 18, y2: cy + 18, stroke: C.axis }, dyn);
        const x0 = bx(0), x1 = bx(sc[k]);
        el('rect', { x: Math.min(x0, x1), y: cy - 11, width: Math.max(Math.abs(x1 - x0), 1), height: 22, fill: sc[k] >= 0 ? C.blue : C.orange, 'fill-opacity': 0.8, rx: 3 }, dyn);
        T(dyn, sc[k] >= 0 ? Math.max(x0, x1) + 4 : Math.min(x0, x1) - 4, cy + 4, num(sc[k], 1), G.fs, C.ink, { anchor: sc[k] >= 0 ? 'start' : 'end', halo: true });
        const bw = pw * pr[k];
        el('rect', { x: px0, y: cy - 11, width: pw, height: 22, fill: '#f1eee6', rx: 3 }, dyn);
        el('rect', { x: px0, y: cy - 11, width: Math.max(bw, 1), height: 22, fill: C.accent, rx: 3, 'fill-opacity': 0.9 }, dyn);
        T(dyn, px0 + pw + 6, cy + 4, pr[k].toFixed(2), G.ft, C.ink, { weight: 600 });
        if (isTrue) {
          el('rect', { x: 8, y: cy - 26, width: W - 16, height: 52, fill: 'none', stroke: C.teal, 'stroke-width': 1.6, 'stroke-dasharray': '5 4', rx: 8 }, dyn);
        }
      });
      T(dyn, 14, H - (M ? 24 : 36), 'true answer: positive, as a one-hot vector  [ 1, 0, 0 ]', G.ft, C.teal, { weight: 600 });
      T(dyn, 14, H - (M ? 8 : 14), 'penalty = −ln P(positive) = ' + NN.penalty(pr[0]).toFixed(2) + '   ·   the probabilities add up to ' + pr.reduce((a, b) => a + b, 0).toFixed(2), G.fs, C.muted);
      C0.cap('Raise a score and its probability rises while the others fall: the three probabilities always add up to 1.');
    }
    function arrow2(x1, y, x2) { K.arrow(dyn, x1, y, x2, y, C.accent, 2.2, 8); }

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlState(C0.ctl, true);
        sPos.value = S.pos; sNeg.value = S.neg; $('oPos').textContent = S.pos; $('oNeg').textContent = S.neg;
        Array.prototype.forEach.call(C0.ctl.querySelectorAll('[data-y]'), (b) => b.setAttribute('aria-pressed', String(+b.getAttribute('data-y') === S.y)));
        Array.prototype.forEach.call(C0.ctl.querySelectorAll('[data-lam]'), (b) => b.setAttribute('aria-pressed', String(+b.getAttribute('data-lam') === S.lam)));
        [0, 1, 2].forEach((k) => { if (document.activeElement !== $('sc' + k)) $('sc' + k).value = S.scores[k]; });
        [review, loss, reg, softmax][stage](q);
      }
    };
  });

  /* ============================================================
     Chapter 2 - the same machine, drawn as a neuron; a little history
     ============================================================ */
  K.register('ch2', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, M = G.M;
    const dyn = el('g', {}, svg);
    Array.prototype.forEach.call(C0.ctl.querySelectorAll('[data-act]'), (b) => { b.onclick = () => { S.act = b.getAttribute('data-act'); C0.redraw(); }; });

    function actSketch(g, x, y, w, h, kind) {
      K.chip(g, x, y, w, h, '#fff', C.ink, '', 10, C.ink, { sw: 2 });
      const sx = lin(-3, 3, x + 6, x + w - 6), sy = lin(kind === 'relu' ? 3 : 1, kind === 'relu' ? 0 : 0, y + 6, y + h - 6);
      const fn = kind === 'relu' ? (z) => Math.max(0, z) : NN.sigmoid;
      el('line', { x1: x + 4, x2: x + w - 4, y1: sy(0), y2: sy(0), stroke: C.axis }, g);
      el('path', { d: pathD(K.curvePts(sx, sy, fn, -3, 3, 0.1)), fill: 'none', stroke: C.accent, 'stroke-width': 2.4 }, g);
    }

    function neuron(q) {
      const x = xs(), cur = current(), n = 6;
      const top = M ? 26 : 40, bot = H - (M ? 40 : 60);
      const inX = M ? 100 : 178, nx = M ? 210 : 372, ny = (top + bot) / 2, nr = M ? 24 : 34;
      const out = S.act === 'relu' ? Math.max(0, cur.z) : cur.p;
      /* inputs and weighted edges */
      REV.short.forEach((nm, i) => {
        const y = top + (i / (n - 1)) * (bot - top), t = ease(rev(q, i, 7));
        const w = REV.w[i], col = w >= 0 ? C.blue : C.orange;
        el('line', { x1: inX + 15, y1: y, x2: nx - nr * 0.92, y2: ny + (y - ny) * 0.25, stroke: col, 'stroke-width': (0.8 + Math.abs(w) * 1.5) * t, 'stroke-opacity': 0.75, 'stroke-linecap': 'round' }, dyn);
        T(dyn, inX - 20, y + G.fs * 0.35, nm, G.fs, C.ink, { anchor: 'end', op: t });
        el('circle', { cx: inX, cy: y, r: 15, fill: '#fff', stroke: C.ink, 'stroke-width': 1.5, opacity: t }, dyn);
        T(dyn, inX, y + G.fs * 0.35, num(x[i], i === 5 ? 1 : 0), G.fs, C.ink, { anchor: 'middle', op: t });
        const ex1 = inX + 15, ey1 = y, ex2 = nx - nr * 0.92, ey2 = ny + (y - ny) * 0.25;
        T(dyn, lerp(ex1, ex2, 0.34), lerp(ey1, ey2, 0.34) - 6, 'w=' + num(w, 1), G.fs - 1, col, { anchor: 'middle', op: t, halo: true, weight: 600 });
      });
      /* the neuron */
      const tn = ease(rev(q, 6, 7)), ta = ease(clamp((q - 0.55) / 0.2)), to = ease(clamp((q - 0.75) / 0.2));
      el('circle', { cx: nx, cy: ny, r: nr, fill: C.accentSoft, stroke: C.accent, 'stroke-width': 3, opacity: tn }, dyn);
      T(dyn, nx, ny + 2, 'Σ', G.ft + 12, C.accent, { anchor: 'middle', weight: 700, op: tn });
      T(dyn, nx, ny + nr + 18, 'sum + bias ' + num(REV.b, 1), G.fs, C.muted, { anchor: 'middle', op: tn });
      T(dyn, nx, ny - nr - 8, 'z = ' + num(cur.z, 2), G.ft, C.accent, { anchor: 'middle', weight: 700, op: tn });
      /* the activation, then the output */
      const ax = nx + nr + (M ? 14 : 26), aw = M ? 46 : 64, ah = M ? 36 : 48;
      el('line', { x1: nx + nr, x2: ax, y1: ny, y2: ny, stroke: C.ink, 'stroke-width': 2, opacity: ta }, dyn);
      const gA = el('g', { opacity: ta }, dyn);
      actSketch(gA, ax, ny - ah / 2, aw, ah, S.act);
      T(dyn, ax + aw / 2, ny - ah / 2 - 7, S.act === 'relu' ? 'ReLU' : 'sigmoid', G.fs, C.ink, { anchor: 'middle', weight: 600, op: ta });
      const ox = ax + aw + (M ? 6 : 14);
      K.arrow(dyn, ax + aw, ny, ox + (M ? 14 : 22), ny, C.ink, 2, 8, to);
      T(dyn, ox + (M ? 18 : 28), ny + 5, num(out, 2), G.ft + 2, C.teal, { weight: 700, op: to });
      T(dyn, ox + (M ? 18 : 28), ny + 22, S.act === 'relu' ? 'a score' : 'a probability', G.fs - 1, C.muted, { op: to });
      T(dyn, inX, H - (M ? 8 : 14), 'inputs: the six features of the review, same as chapter 1', G.fs, C.muted, { anchor: 'middle', op: 1 });
      const cp = S.act === 'relu' ? 'ReLU keeps positive scores and cuts negatives to 0: output ' + num(out, 2) + '.' : 'Sigmoid squashes z into a probability: <b>' + out.toFixed(2) + '</b>.';
      C0.cap('A neuron: weighted sum, then an activation. ' + cp + ' Blue edges push up, orange push down; thicker = bigger weight.');
    }

    function bio(q) {
      const u = (i) => ease(rev(q, i, 5));
      /* timeline */
      const ty = M ? 62 : 90, tx0 = M ? 36 : 70, tx1 = W - (M ? 36 : 70);
      el('line', { x1: tx0, x2: tx1, y1: ty, y2: ty, stroke: C.axis, 'stroke-width': 2 }, dyn);
      const ev = [
        { x: lerp(tx0, tx1, 0.12), yr: '1943', t1: 'McCulloch & Pitts', t2: 'threshold switch', step: false },
        { x: lerp(tx0, tx1, 0.5), yr: '1958', t1: 'Rosenblatt’s perceptron', t2: 'weights learned from examples', step: true },
        { x: lerp(tx0, tx1, 0.88), yr: 'today', t1: 'networks of many layers', t2: 'sigmoid, ReLU, …', step: true }
      ];
      ev.forEach((e, i) => {
        const t = u(i);
        el('circle', { cx: e.x, cy: ty, r: 7, fill: C.accent, stroke: '#fff', 'stroke-width': 2, opacity: t }, dyn);
        T(dyn, e.x, ty - 16, e.yr, G.ft + 1, C.accent, { anchor: 'middle', weight: 700, op: t });
        T(dyn, e.x, ty + 26, e.t1, G.fs, C.ink, { anchor: 'middle', weight: 600, op: t });
        T(dyn, e.x, ty + 26 + G.fs + 4, e.t2, G.fs - 1, C.muted, { anchor: 'middle', op: t });
      });
      /* a real neuron and an artificial one */
      const by = M ? 200 : 300, lx = W * 0.27, rx = W * 0.73, t3 = u(3), t4 = u(4);
      const g1 = el('g', { opacity: t3 }, dyn);
      for (let k = 0; k < 5; k++) {
        const a = -2.2 + k * 0.55, ex = lx - 6 + Math.cos(a + 3.14) * 46, ey = by + Math.sin(a + 3.14) * 40;
        el('path', { d: 'M' + (lx - 6) + ',' + by + ' Q' + (lx - 6 + (ex - lx) * 0.5) + ',' + (by + (ey - by) * 0.4) + ' ' + ex + ',' + ey, fill: 'none', stroke: C.grey, 'stroke-width': 2 }, g1);
      }
      el('circle', { cx: lx - 6, cy: by, r: M ? 13 : 17, fill: '#e9e5dc', stroke: C.grey, 'stroke-width': 2 }, g1);
      el('path', { d: 'M' + (lx + 8) + ',' + by + ' L' + (lx + (M ? 54 : 78)) + ',' + by, stroke: C.grey, 'stroke-width': 3 }, g1);
      for (let k = 0; k < 4; k++) el('line', { x1: lx + 22 + k * (M ? 9 : 14) + (k > 1 ? 6 : 0), x2: lx + 22 + k * (M ? 9 : 14) + (k > 1 ? 6 : 0), y1: by - 12, y2: by + 12, stroke: C.red, 'stroke-width': 2 }, g1);
      T(dyn, lx, by + 74, 'a real neuron', G.ft, C.ink, { anchor: 'middle', weight: 700, op: t3 });
      T(dyn, lx, by + 74 + G.fs + 4, 'spikes at varying frequencies', G.fs - 1, C.muted, { anchor: 'middle', op: t3 });
      const g2 = el('g', { opacity: t4 }, dyn);
      for (let k = 0; k < 3; k++) K.arrow(g2, rx - 56, by - 26 + k * 26, rx - 16, by - 6 + k * 6 - 6, k === 1 ? C.orange : C.blue, 1 + k * 0.8, 6);
      el('circle', { cx: rx, cy: by, r: M ? 14 : 18, fill: C.accentSoft, stroke: C.accent, 'stroke-width': 2.4 }, g2);
      T(g2, rx, by + 5, 'Σ', 17, C.accent, { anchor: 'middle', weight: 700 });
      K.arrow(g2, rx + 18, by, rx + 62, by, C.ink, 2, 7);
      T(dyn, rx + 66, by + 4, '0.70', G.ft, C.teal, { weight: 700, op: t4 });
      T(dyn, rx, by + 74, 'an artificial neuron', G.ft, C.ink, { anchor: 'middle', weight: 700, op: t4 });
      T(dyn, rx, by + 74 + G.fs + 4, 'one number in, one number out', G.fs - 1, C.muted, { anchor: 'middle', op: t4 });
      C0.cap('Treat a network as a chain of learned bendings of the data, not as a model of the brain.');
    }

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlState(C0.ctl, true);
        Array.prototype.forEach.call(C0.ctl.querySelectorAll('[data-act]'), (b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-act') === S.act)));
        [neuron, bio][stage](q);
      }
    };
  });
})();
