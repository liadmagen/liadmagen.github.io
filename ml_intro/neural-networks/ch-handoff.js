/* Chapter 8 of "From a Yes to a Network": the word vectors that emerge while the tiny network trains, and the hand-off to word2vec. */
(function () {
  'use strict';
  const K = window.NNKIT;
  if (!K) return;
  const NN = K.NN, F = K.F, C = K.C;
  const el = K.el, T = K.T, clear = K.clear, clamp = K.clamp, lerp = K.lerp, ease = K.ease, rev = K.rev, fmt = K.fmt;
  const geo = K.geo, ctlState = K.ctlState;
  const VOCAB = NN.VOCAB, widx = NN.widx;
  const KEY = new Set(['hotel', 'motel', 'goat', 'sheep']);
  const GROUP_NAME = { animal: 'animals', food: 'food', lodging: 'places to stay', adj: 'adjectives', verb: 'verbs', other: 'other' };

  /* the longest vector at any point of training: fixes the scale, so arrows grow instead of the picture rescaling */
  const RMAX = Math.max.apply(null, F.emb.snaps.map((s) => Math.max.apply(null, s.E.map((v) => Math.hypot(v[0], v[1]))))) * 1.02;

  /* push labels apart around the circle: angles in, angles out, at least `sep` radians between neighbours */
  function spread(angles, sep) {
    const idx = angles.map((a, i) => i).sort((i, j) => angles[i] - angles[j]);
    const out = angles.slice();
    for (let pass = 0; pass < 60; pass++) {
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k], j = idx[(k + 1) % idx.length];
        let d = out[j] - out[i]; if (k === idx.length - 1) d += 2 * Math.PI;
        if (d < sep) { const push = (sep - d) / 2; out[i] -= push; out[j] += push; }
      }
    }
    return out;
  }

  K.register('ch8', function (C0) {
    const svg = C0.svg, G = geo(C0), W = G.W, H = G.H, M = G.M;
    const dyn = el('g', {}, svg);
    ctlState(C0.ctl, false); C0.ctl.classList.remove('on');
    const snaps = F.emb.snaps, nS = snaps.length;

    function nearby(q) {
      const k = Math.round(clamp(q * 1.1) * (nS - 1)), sn = snaps[k], E = sn.E;
      const R = M ? 82 : 168, cx = M ? W / 2 : 206, cy = M ? 104 : H / 2 - 4, sc = R / RMAX;
      /* rings and axes */
      el('circle', { cx: cx, cy: cy, r: R, fill: 'none', stroke: C.line, 'stroke-width': 1.4 }, dyn);
      el('circle', { cx: cx, cy: cy, r: R / 2, fill: 'none', stroke: C.grid }, dyn);
      el('line', { x1: cx - R, x2: cx + R, y1: cy, y2: cy, stroke: C.grid }, dyn);
      el('line', { x1: cx, x2: cx, y1: cy - R, y2: cy + R, stroke: C.grid }, dyn);
      const tips = VOCAB.map((w, i) => [cx + E[i][0] * sc, cy - E[i][1] * sc]);
      const ang = VOCAB.map((w, i) => Math.atan2(-(E[i][1]), E[i][0]));
      const lab = spread(ang.map((a) => a), M ? 0.26 : 0.19);
      VOCAB.forEach((w, i) => {
        const col = K.GROUP_COL[NN_GROUP(w)], key = KEY.has(w);
        K.arrow(dyn, cx, cy, tips[i][0], tips[i][1], col, key ? 2.8 : 1.6, key ? 8 : 6, key ? 1 : 0.75);
        const lr = R + (M ? 10 : 14), lx = cx + Math.cos(lab[i]) * lr, ly = cy - Math.sin(lab[i]) * lr;
        el('line', { x1: tips[i][0], y1: tips[i][1], x2: cx + Math.cos(lab[i]) * (R + 2), y2: cy - Math.sin(lab[i]) * (R + 2), stroke: col, 'stroke-width': 0.8, 'stroke-opacity': 0.5 }, dyn);
        T(dyn, lx, ly + G.fs * 0.35, w, key ? G.fs + 1 : G.fs - 1, col, { anchor: Math.cos(lab[i]) >= 0 ? 'start' : 'end', weight: key ? 700 : 500 });
      });
      /* the cosine similarity of the pairs we care about */
      const px = M ? 18 : 410, py = M ? cy + R + 40 : 70, pw = M ? W - 36 : W - 410 - 16, rh = M ? 17 : 30;
      T(dyn, px, py - (M ? 8 : 16), 'cosine similarity', G.ft, C.ink, { weight: 700 });
      const pairs = NN.pairCosines(E);
      pairs.forEach((p, i) => {
        const y = py + i * rh + (M ? 3 : 6), bw = pw - (M ? 108 : 110) - 44;
        T(dyn, px, y + rh * 0.55, p.a + ' – ' + p.b, G.fs, KEY.has(p.a) ? C.ink : C.muted, { weight: KEY.has(p.a) ? 700 : 400 });
        const x0 = px + (M ? 108 : 110);
        el('rect', { x: x0, y: y + rh * 0.18, width: bw, height: rh * 0.5, rx: 3, fill: '#f1eee6' }, dyn);
        el('rect', { x: x0, y: y + rh * 0.18, width: Math.max(bw * clamp(p.cos), 0), height: rh * 0.5, rx: 3, fill: KEY.has(p.a) ? C.accent : C.grey }, dyn);
        T(dyn, x0 + bw + 5, y + rh * 0.58, p.cos >= 0.995 ? '>0.99' : fmt(p.cos, 2), G.fs - 1, C.muted);
      });
      const hg = NN.cosine(E[widx('hotel')], E[widx('goat')]);
      if (!M) {
        T(dyn, px, py + 4 * 30 + 16, 'hotel – goat: ' + fmt(hg, 2), G.fs, C.muted);
        T(dyn, px, py + 4 * 30 + 32, '(unrelated words: near 0 or below)', G.fs - 1, C.muted);
      }
      /* the unseen pair, once training has run */
      const t = ease(clamp((q - 0.8) * 5));
      if (t > 0.02 && !M) {
        const ix = px, iy = py + 4 * 30 + 56, iw = pw;
        el('rect', { x: ix - 8, y: iy, width: iw + 8, height: 112, rx: 10, fill: C.accentSoft, stroke: C.accent, 'stroke-width': 1.6, opacity: t }, dyn);
        T(dyn, ix, iy + 20, 'the unseen pair “… pool”', G.fs + 1, C.accent, { weight: 700, op: t });
        const pm = F.emb.model.probs('motel')[widx('pool')], pg = F.emb.model.probs('goat')[widx('pool')];
        [['Markov: motel pool', '0', C.orange], ['network: motel pool', pm.toFixed(3), C.accent], ['network: goat pool', pg < 0.001 ? '< 0.001' : pg.toFixed(3), C.grey]].forEach((r, i) => {
          T(dyn, ix, iy + 44 + i * 22, r[0], G.fs, C.ink, { op: t });
          T(dyn, ix + iw - 2, iy + 44 + i * 22, r[1], G.ft, r[2], { anchor: 'end', weight: 700, op: t });
        });
      }
      /* colour legend */
      const gl = ['animal', 'food', 'lodging', 'adj', 'verb'];
      const ly = M ? H - 12 : H - 14;
      let lx = M ? 8 : 20;
      gl.forEach((g) => {
        el('rect', { x: lx, y: ly - 8, width: 10, height: 10, rx: 2, fill: K.GROUP_COL[g] }, dyn);
        T(dyn, lx + 14, ly + 1, GROUP_NAME[g], G.fs - 1, C.muted);
        lx += (M ? 18 : 18) + GROUP_NAME[g].length * (M ? 5.6 : 6.2);
      });
      C0.cap('Epoch <b>' + sn.epoch + '</b> of ' + NN.EMB.epochs + ': <i>hotel</i>–<i>motel</i> cosine similarity <b>' + NN.simStr(pairs[0].cos) + '</b>, <i>goat</i>–<i>sheep</i> <b>' + NN.simStr(pairs[1].cos) + '</b>. Two numbers per word; real vectors have hundreds.');
    }
    const NN_GROUP = (w) => NN.GROUP_OF[w];

    function next(q) {
      const rows = [
        ['1', 'Neighbours on both sides', 'predict a word from the words around it (CBOW), or the neighbours from the word (skip-gram)'],
        ['2', 'Negative sampling', 'instead of a softmax over every word of the vocabulary: fast enough for millions of words'],
        ['3', 'Judging the vectors', 'nearest neighbours by cosine similarity, and analogy tests'],
        ['4', 'What came next', 'FastText (characters), BPE (sub-words), contextual vectors: ELMo, BERT, GPT']
      ];
      const top = M ? 12 : 24, rh = M ? 58 : 84, r = M ? 13 : 18;
      T(dyn, W / 2, top + (M ? 8 : 12), 'what to look for when you read about word2vec', G.ft + 1, C.ink, { anchor: 'middle', weight: 700 });
      rows.forEach((row, i) => {
        const t = ease(rev(q, i, 4)), y = top + (M ? 30 : 46) + i * rh;
        el('rect', { x: 10, y: y, width: W - 20, height: rh - 10, rx: 12, fill: i === 3 ? '#f6f4ee' : C.accentSoft, stroke: i === 3 ? C.axis : C.accent, 'stroke-width': 1.6, opacity: t }, dyn);
        el('circle', { cx: 10 + (M ? 22 : 32), cy: y + (rh - 10) / 2, r: r, fill: i === 3 ? C.grey : C.accent, opacity: t }, dyn);
        T(dyn, 10 + (M ? 22 : 32), y + (rh - 10) / 2 + G.fs * 0.35, row[0], G.ft, '#fff', { anchor: 'middle', weight: 700, op: t });
        const tx = 10 + (M ? 44 : 64);
        T(dyn, tx, y + (M ? 20 : 30), row[1], G.ft + 1, C.ink, { weight: 700, op: t });
        const words = row[2].split(' '), maxCh = M ? 44 : 92;
        let line = '', ln = 0;
        words.forEach((w) => {
          if ((line + ' ' + w).trim().length > maxCh) { T(dyn, tx, y + (M ? 33 : 50) + ln * (G.fs + 3), line.trim(), G.fs, C.muted, { op: t }); line = w; ln++; } else line += ' ' + w;
        });
        if (line.trim()) T(dyn, tx, y + (M ? 33 : 50) + ln * (G.fs + 3), line.trim(), G.fs, C.muted, { op: t });
      });
      const tf = ease(clamp((q - 0.7) * 3));
      T(dyn, W / 2, H - (M ? 10 : 22), 'Pre-trained vectors can be reused: average a text’s word vectors, put logistic regression on top.', G.fs - (M ? 1 : 0), C.teal, { anchor: 'middle', weight: 600, op: tf });
      C0.cap('word2vec is this idea, made fast and pointed at both neighbours. Time to read how.');
    }

    return { render: function (stage, q) { clear(dyn); [nearby, next][stage](q); } };
  });
})();
