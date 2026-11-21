/* Chapters 6 and 7 of "From a Yes to a Network": words as numbers, then from a Markov chain to a neural next-word model. */
(function () {
  'use strict';
  const K = window.NNKIT;
  if (!K) return;
  const NN = K.NN, F = K.F, S = K.S, C = K.C;
  const el = K.el, T = K.T, clear = K.clear, clamp = K.clamp, lerp = K.lerp, ease = K.ease, rev = K.rev, fmt = K.fmt;
  const geo = K.geo, ctlState = K.ctlState;
  const $ = (id) => document.getElementById(id);
  const num = (v, d) => fmt(v, d === undefined ? 1 : d);
  const CH = NN.CHEESE, VOCAB = NN.VOCAB, widx = NN.widx;
  const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  const wordLabel = (w) => (w === '.' ? '. (sentence end)' : w);

  /* a matrix drawn as coloured cells: cells(g, x, y, cell, rows, cols, valueFn, colorFn, labelFn) */
  function grid(g, G, x, y, cell, n, m, valFn, colFn, txtFn, op) {
    for (let r = 0; r < n; r++) for (let c = 0; c < m; c++) {
      el('rect', { x: x + c * cell, y: y + r * cell, width: cell - 2, height: cell - 2, rx: 4, fill: colFn(valFn(r, c), r, c), opacity: op === undefined ? 1 : op }, g);
      const t = txtFn(valFn(r, c), r, c);
      if (t !== '') T(g, x + c * cell + (cell - 2) / 2, y + r * cell + (cell - 2) / 2 + G.fs * 0.35, t, G.fs, C.ink, { anchor: 'middle', op: op });
    }
  }

  /* ============================================================
     Chapter 6 - words as numbers
     ============================================================ */
  K.register('ch6', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, M = G.M;
    const dyn = el('g', {}, svg);
    const sel = $('selPair');
    if (!sel.options.length) PAIRS.forEach((p, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = CH.words[p[0]] + ' and ' + CH.words[p[1]]; sel.appendChild(o); });
    sel.onchange = () => { S.pair = sel.value; C0.redraw(); };
    const pairIdx = () => clamp(+S.pair || 0, 0, 5);
    const blue = (v, max) => K.mix('#ffffff', C.blue, clamp(v / max) * 0.85);

    function onehot(q) {
      const cell = M ? 26 : 38, gx = M ? 58 : 120, gy = M ? 78 : 140;
      T(dyn, gx + cell * 2 - 1, gy - (M ? 30 : 44), 'one-hot vectors', G.ft, C.ink, { anchor: 'middle', weight: 700 });
      T(dyn, gx + cell * 2 - 1, gy - (M ? 16 : 26), '(a vocabulary of just 4 words)', G.fs - 1, C.muted, { anchor: 'middle' });
      CH.words.forEach((w, r) => {
        const t = ease(rev(q, r, 4));
        T(dyn, gx - 8, gy + r * cell + cell / 2 + G.fs * 0.35 - 1, w, G.fs + 1, C.ink, { anchor: 'end', weight: 600, op: t });
      });
      grid(dyn, G, gx, gy, cell, 4, 4, (r, c) => (r === c ? 1 : 0), (v) => (v ? C.blue : '#f1eee6'), (v) => String(v), 1);
      const mx = M ? 236 : 400, cc = M ? 28 : 40;
      T(dyn, mx + cc * 2 - 1, gy - (M ? 30 : 44), 'cosine similarity', G.ft, C.ink, { anchor: 'middle', weight: 700 });
      T(dyn, mx + cc * 2 - 1, gy - (M ? 16 : 26), 'of each pair of words', G.fs - 1, C.muted, { anchor: 'middle' });
      const tm = ease(clamp((q - 0.3) / 0.5));
      CH.words.forEach((w, i) => {
        T(dyn, mx + i * cc + cc / 2 - 1, gy - 2, w.slice(0, 3), G.fs - 1, C.muted, { anchor: 'middle', op: tm });
        T(dyn, mx - 6, gy + i * cc + cc / 2 + G.fs * 0.35 - 1, w, G.fs - 1, C.muted, { anchor: 'end', op: tm });
      });
      grid(dyn, G, mx, gy + 8, cc, 4, 4, (r, c) => (r === c ? 1 : 0), (v) => (v ? '#bcd2f3' : '#f1eee6'), (v) => (v ? '1' : '0'), tm);
      T(dyn, W / 2, gy + cc * 4 + (M ? 56 : 84), 'with 100,000 words: 100,000 numbers per word, one of them a 1', G.fs, C.muted, { anchor: 'middle' });
      C0.cap('Every pair of different words has cosine similarity <b>0</b>: to a one-hot vector, <i>cheese</i> is as unrelated to <i>bread</i> as to <i>sheep</i>.');
    }

    function company() {
      const p = PAIRS[pairIdx()], a = p[0], b = p[1];
      const cell = M ? 24 : 34, top = M ? 36 : 54;
      const gx = M ? 52 : 98, mx = M ? 224 : 380;
      T(dyn, gx + cell * 2, top - (M ? 22 : 30), 'how often they co-occur', G.fs + 1, C.ink, { anchor: 'middle', weight: 700 });
      T(dyn, mx + cell * 2, top - (M ? 22 : 30), 'cosine similarity', G.fs + 1, C.ink, { anchor: 'middle', weight: 700 });
      CH.words.forEach((w, i) => {
        T(dyn, gx + i * cell + cell / 2 - 1, top - 4, w.slice(0, 3), G.fs - 1, C.muted, { anchor: 'middle' });
        T(dyn, gx - 5, top + i * cell + cell / 2 + G.fs * 0.35 - 1, w, G.fs - 1, i === a || i === b ? C.accent : C.muted, { anchor: 'end', weight: i === a || i === b ? 700 : 400 });
        T(dyn, mx + i * cell + cell / 2 - 1, top - 4, w.slice(0, 3), G.fs - 1, C.muted, { anchor: 'middle' });
        T(dyn, mx - 5, top + i * cell + cell / 2 + G.fs * 0.35 - 1, w, G.fs - 1, i === a || i === b ? C.accent : C.muted, { anchor: 'end', weight: i === a || i === b ? 700 : 400 });
      });
      grid(dyn, G, gx, top, cell, 4, 4, (r, c) => CH.m[r][c], (v) => blue(v, 14), (v) => String(v), 1);
      grid(dyn, G, mx, top, cell, 4, 4, (r, c) => NN.cheeseCosine(r, c), (v) => blue(v, 1), (v) => v.toFixed(2).replace(/^0/, ''), 1);
      [a, b].forEach((r) => {
        el('rect', { x: gx - 2, y: top + r * cell - 2, width: cell * 4 + 2, height: cell + 2, rx: 5, fill: 'none', stroke: C.accent, 'stroke-width': 2.2 }, dyn);
      });
      el('rect', { x: mx + b * cell - 2, y: top + a * cell - 2, width: cell + 2, height: cell + 2, rx: 5, fill: 'none', stroke: C.accent, 'stroke-width': 2.6 }, dyn);
      /* the two rows, side by side, as bars */
      const by = top + cell * 4 + (M ? 34 : 50), bh = (H - by) - (M ? 48 : 70), bx0 = M ? 50 : 98, bw = W - bx0 - (M ? 66 : 120);
      const gw = bw / 4, ymax = 14, sy = (v) => by + bh - (v / ymax) * bh;
      T(dyn, bx0, by - 10, 'the two rows, side by side', G.fs, C.muted, { weight: 600 });
      el('line', { x1: bx0, x2: bx0 + bw, y1: by + bh, y2: by + bh, stroke: C.axis }, dyn);
      CH.words.forEach((w, i) => {
        const x = bx0 + i * gw + gw * 0.12, ww = gw * 0.36;
        el('rect', { x: x, y: sy(CH.m[a][i]), width: ww, height: by + bh - sy(CH.m[a][i]), fill: C.blue, 'fill-opacity': 0.85, rx: 2 }, dyn);
        el('rect', { x: x + ww + 3, y: sy(CH.m[b][i]), width: ww, height: by + bh - sy(CH.m[b][i]), fill: C.orange, 'fill-opacity': 0.85, rx: 2 }, dyn);
        T(dyn, x + ww, by + bh + G.fs + 4, w, G.fs, C.muted, { anchor: 'middle' });
      });
      T(dyn, bx0 + bw + 10, by + 12, CH.words[a], G.fs, C.blue, { weight: 700 });
      T(dyn, bx0 + bw + 10, by + 12 + G.fs + 4, CH.words[b], G.fs, C.orange, { weight: 700 });
      T(dyn, bx0 + bw + 10, by + 12 + 3 * (G.fs + 4), 'cosine', G.fs, C.muted);
      T(dyn, bx0 + bw + 10, by + 12 + 4 * (G.fs + 4) + 6, NN.cheeseCosine(a, b).toFixed(2), G.ft + 6, C.accent, { weight: 700 });
      C0.cap('<i>' + CH.words[a] + '</i> and <i>' + CH.words[b] + '</i>: cosine similarity <b>' + NN.cheeseCosine(a, b).toFixed(2) + '</b> (1 = rows point the same way, 0 = unrelated).');
    }

    function dense(q) {
      const lane = (y, h, col, fill, items, t, title, note) => {
        el('rect', { x: 8, y: y, width: W - 16, height: h, rx: 14, fill: fill, stroke: col, 'stroke-width': 2, opacity: t }, dyn);
        T(dyn, 20, y + (M ? 18 : 26), title, G.ft, col, { weight: 700, op: t });
        const bw = (W - 40 - 2 * (M ? 18 : 30)) / 3, bh = M ? 44 : 60, by = y + (h - bh) / 2 + (M ? 12 : 18);
        items.forEach((it, i) => {
          const x = 20 + i * (bw + (M ? 18 : 30));
          K.chip(dyn, x, by, bw, bh, '#fff', col, '', G.fs, C.ink, { op: t, sw: 2 });
          it.forEach((ln, k) => T(dyn, x + bw / 2, by + bh / 2 + (k - (it.length - 1) / 2) * (G.fs + 3) + G.fs * 0.35, ln, G.fs, C.ink, { anchor: 'middle', op: t, weight: k === 0 ? 600 : 400 }));
          if (i < 2) K.arrow(dyn, x + bw + 3, by + bh / 2, x + bw + (M ? 15 : 27), by + bh / 2, col, 2, 7, t);
        });
        if (note) T(dyn, W - 20, y + (M ? 18 : 26), note, G.fs - 1, C.muted, { anchor: 'end', op: t });
      };
      const h = (H - 36) / 2, t2 = 0.45 + 0.55 * ease(clamp(q * 2));
      lane(10, h, C.grey, '#f6f4ee', [['co-occurrence', 'table (counts)'], ['compress it', '(SVD, as in class)'], ['short dense', 'word vectors']], 1 - 0.35 * ease(clamp(q * 2)), 'Route 1: count, then compress', 'PMI page');
      lane(10 + h + 16, h, C.accent, C.accentSoft, [['running text', '(free labels)'], ['predict the next', 'or a missing word'], ['short dense', 'word vectors']], t2, 'Route 2: learn to predict', 'next chapters');
      C0.cap('Two routes lead to short, dense vectors. Chapters 7 and 8 follow the second one.');
    }

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlState(C0.ctl, true);
        sel.value = String(pairIdx());
        [onehot, company, dense][stage](q);
      }
    };
  });

  /* ============================================================
     Chapter 7 - from a Markov chain to a neural next-word model
     ============================================================ */
  K.register('ch7', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, M = G.M;
    const dyn = el('g', {}, svg);
    const sel = $('selWord');
    if (!sel.options.length) VOCAB.forEach((w) => { const o = document.createElement('option'); o.value = w; o.textContent = wordLabel(w); sel.appendChild(o); });
    sel.onchange = () => { S.word = sel.value; C0.redraw(); };
    const probs = (w) => F.emb.model.probs(w);
    const top3 = (arr) => arr.map((p, i) => ({ w: VOCAB[i], p: p })).filter((o) => o.p > 0.005).sort((a, b) => b.p - a.p).slice(0, 3);
    const fmtTop = (arr) => top3(arr).map((o) => o.w + ' ' + o.p.toFixed(2)).join(', ');

    /* ---- stage 0: the Markov chain as a graph ---- */
    const POS = {
      '.': [0, 1.5], the: [1, 1.5], goat: [2, 0], sheep: [2, 1], hotel: [2, 2], motel: [2, 3],
      eats: [3, 0.5], room: [3, 2], pool: [3, 3], is: [4, 2.5], grass: [5, 0], hay: [5, 1], clean: [5, 2], cheap: [5, 3]
    };
    function markov(q) {
      const cw = M ? 40 : 60, ch = M ? 20 : 26, x0 = (M ? 30 : 48), x1 = W - (M ? 58 : 92), y0 = M ? 30 : 48, y1 = H - (M ? 74 : 104);
      const P = (w) => ({ x: lerp(x0, x1, POS[w][0] / 5), y: lerp(y0, y1, POS[w][1] / 3) });
      const sw = S.word, sIdx = widx(sw);
      const draw = (from, to, p, isSel) => {
        const a = P(from), b = P(to), ax = a.x + cw / 2, bx = b.x - cw / 2;
        el('line', { x1: ax, y1: a.y, x2: bx, y2: b.y, stroke: isSel ? C.accent : C.axis, 'stroke-width': isSel ? 1.5 + 5 * p : 0.8 + 3 * p, 'stroke-opacity': isSel ? 0.9 : 0.5, 'stroke-linecap': 'round' }, dyn);
        if (isSel) T(dyn, lerp(ax, bx, 0.55), lerp(a.y, b.y, 0.55) - 4, p.toFixed(2), G.fs, C.accent, { anchor: 'middle', halo: true, weight: 700 });
      };
      VOCAB.forEach((from) => {
        const row = NN.markovRow(from);
        VOCAB.forEach((to, j) => { if (row[j] > 0 && to !== '.' && from !== sw) draw(from, to, row[j], false); });
      });
      VOCAB.forEach((to, j) => { const p = NN.markovRow(sw)[j]; if (p > 0 && to !== '.') draw(sw, to, p, true); });
      /* sentence ends: a small stub */
      VOCAB.forEach((from) => {
        const p = NN.markovP(from, '.');
        if (p > 0 && from !== '.') {
          const a = P(from), isSel = from === sw;
          K.arrow(dyn, a.x + cw / 2, a.y, a.x + cw / 2 + (M ? 16 : 24), a.y, isSel ? C.accent : C.axis, isSel ? 2.4 : 1.2, 6);
          T(dyn, a.x + cw / 2 + (M ? 18 : 27), a.y + 4, '.', G.fs + 2, isSel ? C.accent : C.muted, { weight: 700 });
          if (isSel) T(dyn, a.x + cw / 2 + (M ? 8 : 12), a.y - 6, p.toFixed(2), G.fs, C.accent, { anchor: 'middle', halo: true, weight: 700 });
        }
      });
      if (sw === 'motel') {
        const a = P('motel'), b = P('pool');
        el('line', { x1: a.x + cw / 2, y1: a.y, x2: b.x - cw / 2, y2: b.y, stroke: C.orange, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, dyn);
        T(dyn, lerp(a.x + cw / 2, b.x - cw / 2, 0.5), a.y + (M ? 16 : 22), 'never seen: 0', G.fs, C.orange, { anchor: 'middle', weight: 700, halo: true });
      }
      VOCAB.forEach((w) => {
        if (w === '.') return;
        const p = P(w), on = w === sw, t = ease(clamp(q * 2.2 + 0.4 - POS[w][0] * 0.2));
        el('rect', { x: p.x - cw / 2, y: p.y - ch / 2, width: cw, height: ch, rx: 8, fill: on ? C.accent : '#fff', stroke: on ? C.accent : C.ink, 'stroke-width': on ? 2.4 : 1.4, opacity: t }, dyn);
        T(dyn, p.x, p.y + G.fs * 0.35, w, G.fs, on ? '#fff' : C.ink, { anchor: 'middle', weight: 600, op: t });
        el('rect', { x: p.x - cw / 2, y: p.y - ch / 2, width: cw, height: ch, fill: 'transparent', class: 'hit', 'data-tip': '<b>' + w + '</b><br>click to see its next-word probabilities' }, dyn).addEventListener('click', () => { S.word = w; C0.redraw(); });
      });
      const dot = P('the'), pDot = P('.');
      el('rect', { x: pDot.x - (M ? 14 : 18), y: pDot.y - ch / 2, width: M ? 28 : 36, height: ch, rx: 8, fill: sw === '.' ? C.accent : '#fff', stroke: sw === '.' ? C.accent : C.ink, 'stroke-width': 1.4 }, dyn);
      T(dyn, pDot.x, pDot.y + 5, '.', G.ft + 2, sw === '.' ? '#fff' : C.ink, { anchor: 'middle', weight: 700 });
      const a0 = pDot, b0 = dot;
      el('line', { x1: a0.x + (M ? 14 : 18), y1: a0.y, x2: b0.x - cw / 2, y2: b0.y, stroke: sw === '.' ? C.accent : C.axis, 'stroke-width': sw === '.' ? 4 : 2, 'stroke-opacity': 0.8 }, dyn);
      T(dyn, W / 2, H - (M ? 16 : 26), (M ? 'thickness = probability of the next word' : 'edge thickness = probability that the next word follows (edges to “.” are the small arrows)'), G.fs - 1, C.muted, { anchor: 'middle' });
      const row = NN.markovRow(sw);
      const parts = row.map((p, i) => ({ w: VOCAB[i], p: p })).filter((o) => o.p > 0).sort((a, b) => b.p - a.p).map((o) => o.w + ' ' + o.p.toFixed(2));
      C0.cap('After <b>' + wordLabel(sw) + '</b>: ' + parts.join(' &middot; ') + (sw === 'motel' ? ' &middot; pool <b>0</b>' : ''));
    }

    /* ---- stage 1: one-hot x inner matrix = one row ---- */
    function lookup(q) {
      const E0 = F.emb.snaps[0].E, si = widx(S.word), n = VOCAB.length;
      const top = M ? 40 : 66, bot = H - (M ? 30 : 44), rh = (bot - top) / n, cw = M ? 40 : 62;
      const ohx = M ? 70 : 120, mx = ohx + (M ? 44 : 76), oh = Math.min(rh - 2, M ? 16 : 22);
      const t = ease(clamp(q * 2 + 0.4));
      T(dyn, ohx + oh / 2, top - (M ? 16 : 24), 'one-hot', G.ft, C.ink, { anchor: 'middle', weight: 700 });
      T(dyn, ohx + oh / 2, top - (M ? 5 : 8), 'vector', G.fs - 1, C.muted, { anchor: 'middle' });
      T(dyn, mx + cw, top - (M ? 16 : 24), 'inner matrix', G.ft, C.ink, { anchor: 'middle', weight: 700 });
      T(dyn, mx + cw, top - (M ? 5 : 8), 'random at the start', G.fs - 1, C.muted, { anchor: 'middle' });
      T(dyn, ohx + oh + (M ? 12 : 20), top + (bot - top) / 2 + 6, '×', G.ft + 10, C.muted, { anchor: 'middle' });
      VOCAB.forEach((w, i) => {
        const y = top + i * rh, on = i === si;
        T(dyn, ohx - 8, y + rh / 2 + G.fs * 0.35, w, G.fs, on ? C.accent : C.muted, { anchor: 'end', weight: on ? 700 : 400 });
        el('rect', { x: ohx, y: y + 1, width: oh, height: rh - 2, rx: 3, fill: on ? C.blue : '#f1eee6' }, dyn);
        T(dyn, ohx + oh / 2, y + rh / 2 + G.fs * 0.35, on ? '1' : '0', G.fs - 1, on ? '#fff' : C.muted, { anchor: 'middle' });
        for (let k = 0; k < 2; k++) {
          const v = E0[i][k];
          el('rect', { x: mx + k * cw, y: y + 1, width: cw - 3, height: rh - 2, rx: 3, fill: on ? '#d9d2f7' : '#f6f4ee', stroke: on ? C.accent : 'none', 'stroke-width': 2 }, dyn);
          T(dyn, mx + k * cw + (cw - 3) / 2, y + rh / 2 + G.fs * 0.35, num(v, 2), G.fs - 1, C.ink, { anchor: 'middle', weight: on ? 700 : 400 });
        }
      });
      const ry = top + si * rh + rh / 2, rx = mx + 2 * cw + (M ? 14 : 30);
      K.arrow(dyn, mx + 2 * cw + 2, ry, rx, ry, C.accent, 2.4, 8, t);
      T(dyn, rx + 6, ry - 6, '= its row', G.ft, C.accent, { weight: 700, op: t });
      T(dyn, rx + 6, ry + 12, '(' + num(E0[si][0], 2) + ', ' + num(E0[si][1], 2) + ')', G.ft, C.ink, { weight: 600, op: t });
      T(dyn, rx + 6, ry + 30, 'the word’s vector', G.fs - 1, C.muted, { op: t });
      C0.cap('A 1 at the position of <b>' + wordLabel(S.word) + '</b> times the matrix gives exactly that word’s row. Pick another word below.');
    }

    /* ---- stage 2: the network predicts the next word ---- */
    function bigram(q) {
      const E = F.embFinal, si = widx(S.word), n = VOCAB.length, pn = probs(S.word), pm = NN.markovRow(S.word);
      const top = M ? 28 : 42, bot = H - (M ? 40 : 58), rh = (bot - top) / n;
      const ix = M ? 18 : 44, hx = M ? 84 : 190, lbl = M ? 176 : 372, bx = lbl + 6, bw = W - bx - (M ? 34 : 56);
      const t = ease(clamp(q * 2 + 0.3));
      T(dyn, ix, top - (M ? 10 : 14), M ? 'in' : 'input', G.fs, C.muted, { anchor: 'middle', weight: 700 });
      T(dyn, hx, top - (M ? 10 : 14), M ? 'hidden (2)' : 'hidden: 2 numbers', G.fs, C.muted, { anchor: 'middle', weight: 700 });
      T(dyn, bx + bw / 2, top - (M ? 10 : 14), 'P(next word)', G.fs, C.muted, { anchor: 'middle', weight: 700 });
      const hy = [top + (bot - top) * 0.38, top + (bot - top) * 0.62], hr = M ? 15 : 21;
      VOCAB.forEach((w, i) => {
        const y = top + i * rh + rh / 2, on = i === si;
        hy.forEach((yy) => el('line', { x1: ix + 4, y1: y, x2: hx - hr, y2: yy, stroke: C.accent, 'stroke-width': on ? 2.4 : 0.5, 'stroke-opacity': on ? 0.9 : 0.22 }, dyn));
        el('circle', { cx: ix, cy: y, r: M ? 3.4 : 4.6, fill: on ? C.blue : '#fff', stroke: on ? C.blue : C.axis, 'stroke-width': 1.4 }, dyn);
        T(dyn, lbl, y + G.fs * 0.35 - 0.5, w, G.fs - (M ? 0 : 0), on ? C.accent : C.ink, { anchor: 'end', weight: on ? 700 : 400 });
        el('rect', { x: bx, y: y - rh * 0.34, width: bw, height: rh * 0.68, rx: 2, fill: '#f6f4ee' }, dyn);
        const bwid = Math.max(bw * pn[i] * t, pn[i] > 0 ? 1 : 0);
        el('rect', { x: bx, y: y - rh * 0.34, width: bwid, height: rh * 0.68, rx: 2, fill: C.accent, 'fill-opacity': 0.9 }, dyn);
        if (pm[i] > 0) el('line', { x1: bx + bw * pm[i], x2: bx + bw * pm[i], y1: y - rh * 0.5, y2: y + rh * 0.5, stroke: C.ink, 'stroke-width': 2.6 }, dyn);
        if (pn[i] > 0.04 || pm[i] > 0.04) T(dyn, bx + bw + 4, y + G.fs * 0.35 - 0.5, pn[i].toFixed(2), G.fs - 1, C.muted);
      });
      [0, 1].forEach((k) => {
        el('circle', { cx: hx, cy: hy[k], r: hr, fill: K.mix('#ffffff', '#a99ae6', clamp(Math.abs(E[si][k]) / 3)), stroke: C.accent, 'stroke-width': 2.4 }, dyn);
        T(dyn, hx, hy[k] + G.fs * 0.35, num(E[si][k], 1), G.fs, C.ink, { anchor: 'middle', weight: 700 });
      });
      K.arrow(dyn, hx + hr + 4, (hy[0] + hy[1]) / 2, lbl - (M ? 70 : 100), (hy[0] + hy[1]) / 2, C.accent, 2, 7);
      T(dyn, (hx + hr + lbl - (M ? 70 : 100)) / 2, (hy[0] + hy[1]) / 2 - 8, 'softmax', G.fs, C.accent, { anchor: 'middle', weight: 700 });
      el('rect', { x: 8, y: H - (M ? 26 : 38), width: 12, height: 10, rx: 2, fill: C.accent }, dyn);
      T(dyn, 26, H - (M ? 17 : 29), 'neural network', G.fs, C.ink);
      el('line', { x1: M ? 112 : 130, x2: M ? 112 : 130, y1: H - (M ? 28 : 40), y2: H - (M ? 14 : 26), stroke: C.ink, 'stroke-width': 2.6 }, dyn);
      T(dyn, M ? 118 : 138, H - (M ? 17 : 29), 'Markov table', G.fs, C.ink);
      C0.cap('After <b>' + wordLabel(S.word) + '</b>: the network guesses ' + fmtTop(pn) + '. The Markov table: ' + fmtTop(pm) + '.');
    }

    return {
      render: function (stage, q) {
        clear(dyn);
        ctlState(C0.ctl, true);
        sel.value = S.word;
        [markov, lookup, bigram][stage](q);
      }
    };
  });
})();
