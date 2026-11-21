/* Pure math for "From a Yes to a Network" (logistic regression -> neurons -> neural networks -> the stage for word2vec).
   UMD: exposes window.NNM in the browser and module.exports under node.
   Everything is deterministic. All data is SYNTHETIC or taken from the course slides (the movie-review example);
   every trained model on the page (the regularization demo, the XOR networks, the tiny next-word model) is trained in the
   browser, with the seeded random generator below, from the frozen settings in this file. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NNM = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* ---------------------------------------------------------------- small helpers */
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => sum(a) / a.length;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));
  const relu = (z) => Math.max(0, z);
  const logit = (p) => Math.log(p / (1 - p));
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const norm = (a) => Math.sqrt(dot(a, a));
  const cosine = (a, b) => dot(a, b) / (norm(a) * norm(b));

  /* seeded random numbers: mulberry32 + Box-Muller (the same generator as the sibling pages) */
  function makeRng(seed) {
    let s = seed >>> 0, spare = null;
    const u = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const normal = () => {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let a = 0; while (a < 1e-12) a = u();
      const r = Math.sqrt(-2 * Math.log(a)), th = 2 * Math.PI * u();
      spare = r * Math.sin(th);
      return r * Math.cos(th);
    };
    return { uniform: u, normal: normal };
  }

  /* softmax over scores (numerically stable) and the penalty for one example: -ln(probability of the right answer) */
  function softmax(scores) {
    const m = Math.max.apply(null, scores);
    const e = scores.map((s) => Math.exp(s - m));
    const t = sum(e);
    return e.map((v) => v / t);
  }
  const penalty = (pRight) => -Math.log(Math.max(pRight, 1e-12));

  /* ================================================================ PART 1: the movie-review neuron (the course slides) */
  /* Six hand-made features of one review, the weights of a (pretend) trained model and its bias, exactly as on the slides. */
  const REVIEW = {
    names: ['positive words', 'negative words', '“no” present', '1st/2nd-person pronouns', '“!” present', 'length (ln of word count)'],
    short: ['pos. words', 'neg. words', '“no”', 'pronouns', '“!”', 'ln(length)'],
    x: [3, 2, 1, 3, 0, Math.log(66)],
    w: [2.5, -5.0, -1.2, 0.5, 2.0, 0.7],
    b: 0.1
  };
  /* what one review gives: the six contributions w_i * x_i, the total z (the "log-odds") and the probability */
  function reviewScore(x, w, b) {
    const R = REVIEW;
    x = x || R.x; w = w || R.w; b = b === undefined ? R.b : b;
    const contrib = x.map((v, i) => w[i] * v);
    const z = sum(contrib) + b;
    return { contrib: contrib, z: z, p: sigmoid(z) };
  }
  /* the same review with a different number of positive / negative words (the sliders) */
  function reviewWith(pos, neg) {
    const x = REVIEW.x.slice(); x[0] = pos; x[1] = neg;
    return reviewScore(x);
  }

  /* three-class version (positive / neutral / negative) for the softmax step: three pretend scores */
  const CLASSES = ['positive', 'neutral', 'negative'];
  const SOFTMAX_START = [0.8, 0.2, -0.6];

  /* ================================================================ PART 2: regularization on perfectly separable data */
  /* 12 made-up one-feature points that a single threshold separates perfectly. Without a penalty, training keeps
     making the weight larger (the loss only creeps towards 0); with an L2 penalty the weight settles. */
  const SEP = {
    x: [-3.0, -2.4, -1.9, -1.4, -0.9, -0.5, 0.6, 1.0, 1.5, 2.0, 2.5, 3.1],
    y: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]
  };
  const SEP_LAMBDAS = [0, 0.02, 0.2];
  const SEP_STEPS = 600, SEP_EVERY = 10, SEP_LR = 0.5;
  /* mean cross-entropy + (lambda / 2) * w^2, full-batch gradient descent from w = b = 0; returns snapshots every SEP_EVERY steps */
  function sepTrain(lambda, steps) {
    const X = SEP.x, Y = SEP.y, n = X.length;
    let w = 0, b = 0;
    const snaps = [];
    for (let t = 0; t <= (steps || SEP_STEPS); t++) {
      let ce = 0, gw = 0, gb = 0;
      for (let i = 0; i < n; i++) {
        const p = sigmoid(w * X[i] + b), d = p - Y[i];
        ce += penalty(Y[i] ? p : 1 - p); gw += d * X[i]; gb += d;
      }
      ce /= n; gw = gw / n + lambda * w; gb /= n;
      if (t % SEP_EVERY === 0) snaps.push({ t: t, w: w, b: b, ce: ce, loss: ce + 0.5 * lambda * w * w });
      w -= SEP_LR * gw; b -= SEP_LR * gb;
    }
    return snaps;
  }

  /* ================================================================ PART 3: a tiny neural network (one hidden layer) */
  /* model = { h, W1[h][2], b1[h], W2[h], b2 }.  h = 0 means no hidden layer: one neuron, { h:0, w:[w1,w2], b }.
     Hidden units and the output use the sigmoid; the loss is cross-entropy, so the output "blame" is simply p - y. */
  function forward(m, x) {
    if (m.h === 0) { const z = m.w[0] * x[0] + m.w[1] * x[1] + m.b; return { hid: [], z1: [], z: z, p: sigmoid(z) }; }
    const z1 = [], hid = [];
    for (let j = 0; j < m.h; j++) {
      const z = m.W1[j][0] * x[0] + m.W1[j][1] * x[1] + m.b1[j];
      z1.push(z); hid.push(sigmoid(z));
    }
    const z = dot(m.W2, hid) + m.b2;
    return { hid: hid, z1: z1, z: z, p: sigmoid(z) };
  }
  /* gradients of the cross-entropy for ONE example, by backpropagation (the chain rule, layer by layer) */
  function grads(m, x, y) {
    const f = forward(m, x), loss = penalty(y ? f.p : 1 - f.p), dz = f.p - y;
    if (m.h === 0) return { f: f, loss: loss, dz: dz, dw: [dz * x[0], dz * x[1]], db: dz };
    const dW2 = f.hid.map((h) => dz * h), db2 = dz;
    const dh = m.W2.map((w) => dz * w);
    const dz1 = dh.map((d, j) => d * f.hid[j] * (1 - f.hid[j]));
    const dW1 = dz1.map((d) => [d * x[0], d * x[1]]), db1 = dz1.slice();
    return { f: f, loss: loss, dz: dz, dh: dh, dz1: dz1, dW1: dW1, db1: db1, dW2: dW2, db2: db2 };
  }
  const cloneModel = (m) => JSON.parse(JSON.stringify(m));
  function initModel(h, rng) {
    if (h === 0) return { h: 0, w: [0.1 * rng.normal(), 0.1 * rng.normal()], b: 0 };
    const W1 = [], b1 = [], W2 = [];
    for (let j = 0; j < h; j++) { W1.push([rng.normal(), rng.normal()]); b1.push(0); W2.push(rng.normal()); }
    return { h: h, W1: W1, b1: b1, W2: W2, b2: 0 };
  }
  /* one full-batch gradient-descent step (in place) */
  function stepModel(m, X, Y, lr) {
    const n = X.length;
    if (m.h === 0) {
      let gw0 = 0, gw1 = 0, gb = 0;
      for (let i = 0; i < n; i++) { const g = grads(m, X[i], Y[i]); gw0 += g.dw[0]; gw1 += g.dw[1]; gb += g.db; }
      m.w[0] -= lr * gw0 / n; m.w[1] -= lr * gw1 / n; m.b -= lr * gb / n;
      return;
    }
    const gW1 = m.W1.map(() => [0, 0]), gb1 = m.b1.map(() => 0), gW2 = m.W2.map(() => 0);
    let gb2 = 0;
    for (let i = 0; i < n; i++) {
      const g = grads(m, X[i], Y[i]);
      for (let j = 0; j < m.h; j++) {
        gW1[j][0] += g.dW1[j][0]; gW1[j][1] += g.dW1[j][1]; gb1[j] += g.db1[j]; gW2[j] += g.dW2[j];
      }
      gb2 += g.db2;
    }
    for (let j = 0; j < m.h; j++) {
      m.W1[j][0] -= lr * gW1[j][0] / n; m.W1[j][1] -= lr * gW1[j][1] / n; m.b1[j] -= lr * gb1[j] / n; m.W2[j] -= lr * gW2[j] / n;
    }
    m.b2 -= lr * gb2 / n;
  }
  const dataLoss = (m, X, Y) => mean(X.map((x, i) => grads(m, x, Y[i]).loss));
  const accuracy = (m, X, Y) => mean(X.map((x, i) => ((forward(m, x).p >= 0.5 ? 1 : 0) === Y[i] ? 1 : 0)));

  /* train from a seed; keeps `snaps` evenly spaced copies of the model (epoch 0 included) and the loss after every epoch */
  function trainNet(X, Y, opt) {
    const o = Object.assign({ h: 2, seed: 1, epochs: 400, lr: 2, snaps: 60 }, opt || {});
    const rng = makeRng(o.seed), m = initModel(o.h, rng);
    const snaps = [], curve = [];
    const every = o.epochs / o.snaps;
    let next = 0;
    for (let e = 0; e <= o.epochs; e++) {
      const L = dataLoss(m, X, Y);
      curve.push(L);
      if (e >= next - 1e-9) { snaps.push({ epoch: e, loss: L, acc: accuracy(m, X, Y), model: cloneModel(m) }); next += every; }
      if (e < o.epochs) stepModel(m, X, Y, o.lr);
    }
    return { model: m, snaps: snaps, curve: curve, acc: accuracy(m, X, Y), loss: curve[curve.length - 1], opt: o };
  }

  /* XOR-like data: four blobs, the two on one diagonal are "yes" (1), the two on the other diagonal "no" (0) */
  const XOR_SPEC = { seed: 7, perBlob: 20, sd: 0.35, centres: [[-1, -1, 0], [1, 1, 0], [-1, 1, 1], [1, -1, 1]] };
  function makeXor(spec) {
    spec = spec || XOR_SPEC;
    const rng = makeRng(spec.seed), X = [], Y = [];
    for (let i = 0; i < spec.perBlob; i++) {
      spec.centres.forEach((c) => {
        X.push([+(c[0] + spec.sd * rng.normal()).toFixed(2), +(c[1] + spec.sd * rng.normal()).toFixed(2)]);
        Y.push(c[2]);
      });
    }
    return { X: X, Y: Y };
  }
  /* Frozen training choices (sigmoid hidden units, lr 2, 400 epochs); the seeds were picked so every net reaches >= 95%. */
  const NET_CONFIGS = { 0: { seed: 3 }, 2: { seed: 1 }, 3: { seed: 2 }, 8: { seed: 1 } };
  /* probability map of a model over [lo, hi]^2 on an n x n grid (row 0 = top = largest y) */
  function probGrid(m, lo, hi, n) {
    const g = [];
    for (let r = 0; r < n; r++) {
      const row = [], y = hi - ((r + 0.5) / n) * (hi - lo);
      for (let c = 0; c < n; c++) row.push(forward(m, [lo + ((c + 0.5) / n) * (hi - lo), y]).p);
      g.push(row);
    }
    return g;
  }

  /* ================================================================ PART 4: words (the deck's cheese matrix, a tiny corpus) */
  /* the matrix from the slides: how often each word co-occurs with each other, and the cosine similarities it gives */
  const CHEESE = {
    words: ['cheese', 'bread', 'goat', 'sheep'],
    m: [[14, 7, 5, 1], [7, 12, 0, 0], [5, 0, 8, 12], [1, 0, 12, 2]]
  };
  const cheeseCosine = (i, j) => cosine(CHEESE.m[i], CHEESE.m[j]);

  /* The tiny made-up corpus. Each row: the words of one sentence, then how many times it occurs.
     Written as a count table (not random sentences) so every number on the page is exact and reproducible.
     "motel pool" never occurs: it is the unseen pair the Markov chain cannot handle. */
  const SENTENCES = [
    ['the', 'goat', 'eats', 'grass', 3], ['the', 'sheep', 'eats', 'grass', 3], ['the', 'goat', 'eats', 'hay', 1], ['the', 'sheep', 'eats', 'hay', 2],
    ['the', 'hotel', 'room', 'is', 'clean', 2], ['the', 'motel', 'room', 'is', 'clean', 2], ['the', 'hotel', 'pool', 'is', 'clean', 2],
    ['the', 'hotel', 'room', 'is', 'cheap', 1], ['the', 'motel', 'room', 'is', 'cheap', 2],
    ['the', 'hotel', 'is', 'clean', 1], ['the', 'motel', 'is', 'cheap', 1]
  ];
  const VOCAB = ['.', 'the', 'goat', 'sheep', 'eats', 'grass', 'hay', 'hotel', 'motel', 'room', 'pool', 'is', 'clean', 'cheap'];
  const V = VOCAB.length;
  /* groups are only used for colours: animals, food, lodging, adjectives, verbs, and the rest */
  const GROUP_OF = { goat: 'animal', sheep: 'animal', grass: 'food', hay: 'food', hotel: 'lodging', motel: 'lodging',
    clean: 'adj', cheap: 'adj', eats: 'verb', is: 'verb', room: 'other', pool: 'other', the: 'other', '.': 'other' };
  /* the pairs the page cares about: same-company words that should end up pointing the same way */
  const KEY_PAIRS = [['hotel', 'motel'], ['goat', 'sheep'], ['grass', 'hay'], ['clean', 'cheap']];
  const widx = (w) => VOCAB.indexOf(w);

  /* every sentence is wrapped in "." ; count every pair of neighbouring words */
  function bigramCounts() {
    const c = VOCAB.map(() => new Array(V).fill(0));
    let pairs = 0, sentences = 0;
    SENTENCES.forEach((s) => {
      const n = s[s.length - 1], words = ['.'].concat(s.slice(0, -1), ['.']);
      for (let k = 0; k + 1 < words.length; k++) c[widx(words[k])][widx(words[k + 1])] += n;
      pairs += n * (words.length - 1); sentences += n;
    });
    return { c: c, pairs: pairs, sentences: sentences };
  }
  const BG = bigramCounts();
  /* the Markov chain: P(next | current) = how often next follows current / how often current is followed by anything.
     A lookup table of probabilities: no learning, and any pair never seen gets exactly 0. */
  function markovRow(word) {
    const r = BG.c[widx(word)], t = sum(r);
    return r.map((v) => v / t);
  }
  const markovP = (cur, nxt) => markovRow(cur)[widx(nxt)];
  /* the corpus read out as running text (for display), one line per distinct sentence */
  const corpusLines = () => SENTENCES.map((s) => s.slice(0, -1).join(' ') + ' .');

  /* The neural next-word model: one-hot(current word) x E (V x d, the "embedding" matrix: linear, no activation) -> d numbers
     x U (d x V) + c -> softmax over the V words. Trained by full-batch gradient descent on the bigram counts.
     Stopped after 300 epochs (early stopping): trained much longer, the model gets more certain and guesses less about unseen pairs. */
  const EMB = { d: 2, seed: 10, epochs: 300, lr: 0.5, snaps: 60 };
  function trainEmbedding(opt) {
    const o = Object.assign({}, EMB, opt || {});
    const rng = makeRng(o.seed), d = o.d;
    const E = VOCAB.map(() => Array.from({ length: d }, () => 0.5 * rng.normal()));
    const U = Array.from({ length: d }, () => VOCAB.map(() => 0.5 * rng.normal()));
    const c = new Array(V).fill(0);
    const total = BG.pairs;
    const snaps = [], curve = [];
    const every = o.epochs / o.snaps;
    let next = 0;
    const probsOf = (i) => {
      const s = new Array(V).fill(0);
      for (let j = 0; j < V; j++) { let a = c[j]; for (let k = 0; k < d; k++) a += E[i][k] * U[k][j]; s[j] = a; }
      return softmax(s);
    };
    const lossNow = () => {
      let L = 0;
      for (let i = 0; i < V; i++) { const p = probsOf(i); for (let j = 0; j < V; j++) if (BG.c[i][j]) L += BG.c[i][j] * penalty(p[j]); }
      return L / total;
    };
    for (let e = 0; e <= o.epochs; e++) {
      const L = lossNow();
      curve.push(L);
      if (e >= next - 1e-9) { snaps.push({ epoch: e, loss: L, E: E.map((r) => r.slice()) }); next += every; }
      if (e === o.epochs) break;
      const dE = E.map(() => new Array(d).fill(0)), dU = U.map(() => new Array(V).fill(0)), dc = new Array(V).fill(0);
      for (let i = 0; i < V; i++) {
        const rowN = sum(BG.c[i]);
        if (!rowN) continue;
        const p = probsOf(i);
        for (let j = 0; j < V; j++) {
          const g = (rowN * p[j] - BG.c[i][j]) / total;
          dc[j] += g;
          for (let k = 0; k < d; k++) { dE[i][k] += g * U[k][j]; dU[k][j] += g * E[i][k]; }
        }
      }
      for (let i = 0; i < V; i++) for (let k = 0; k < d; k++) E[i][k] -= o.lr * dE[i][k];
      for (let k = 0; k < d; k++) for (let j = 0; j < V; j++) U[k][j] -= o.lr * dU[k][j];
      for (let j = 0; j < V; j++) c[j] -= o.lr * dc[j];
    }
    const model = { E: E, U: U, c: c, probs: (w) => probsOf(widx(w)) };
    return { model: model, snaps: snaps, curve: curve, loss: curve[curve.length - 1] };
  }
  /* nearest neighbours of a word by cosine SIMILARITY (1 = same direction, 0 = unrelated, -1 = opposite) */
  function neighbours(E, word, k) {
    const i = widx(word);
    return VOCAB.map((w, j) => ({ word: w, i: j, cos: cosine(E[i], E[j]) })).filter((o) => o.i !== i)
      .sort((a, b) => b.cos - a.cos).slice(0, k || 3);
  }
  const pairCosines = (E) => KEY_PAIRS.map((p) => ({ a: p[0], b: p[1], cos: cosine(E[widx(p[0])], E[widx(p[1])]) }));
  /* mean of the vectors of some words (the "average the word vectors" idea) */
  function averageVector(E, words) {
    const d = E[0].length, a = new Array(d).fill(0);
    words.forEach((w) => E[widx(w)].forEach((v, k) => { a[k] += v / words.length; }));
    return a;
  }

  /* ================================================================ everything the page trains and quotes */
  function build() {
    const xor = makeXor();
    const nets = {};
    Object.keys(NET_CONFIGS).forEach((h) => { nets[h] = trainNet(xor.X, xor.Y, { h: +h, seed: NET_CONFIGS[h].seed }); });
    const emb = trainEmbedding();
    return {
      review: reviewScore(),
      sep: SEP_LAMBDAS.map((l) => sepTrain(l)),
      xor: xor, nets: nets, emb: emb,
      embFinal: emb.snaps[emb.snaps.length - 1].E
    };
  }
  /* a cosine similarity for display: two decimals, and "over 0.99" instead of a misleading 1.00 */
  const simStr = (v) => (v >= 0.995 ? 'over 0.99' : (v < 0 && v > -0.005 ? 0 : v).toFixed(2).replace('-', '−'));
  /* the prose placeholders: {{key}} or {{key arg arg}} in index.html */
  function values(F) {
    const pct = (v) => String(Math.round(v * 100));
    const lastSep = F.sep[0][F.sep[0].length - 1];
    const E = F.embFinal, P = (a, b) => cosine(E[widx(a)], E[widx(b)]);
    const prob = (v) => (v < 0.001 ? 'less than 0.001' : v.toFixed(3));
    const sim = simStr;
    return {
      z: F.review.z.toFixed(2), pPct: pct(F.review.p),
      sepSteps: SEP_STEPS, sepW0: lastSep.w.toFixed(1),
      xorN: F.xor.X.length, xorAcc0: pct(F.nets[0].acc), acc2: pct(F.nets[2].acc), acc3: pct(F.nets[3].acc), acc8: pct(F.nets[8].acc),
      epochs: F.nets[3].opt.epochs,
      cc: (i, j) => cheeseCosine(+i, +j).toFixed(2),
      nSent: BG.sentences, pairs: BG.pairs, V: V, embEpochs: EMB.epochs,
      cosHM: sim(P('hotel', 'motel')), cosGS: sim(P('goat', 'sheep')),
      pMotelPool: prob(F.emb.model.probs('motel')[widx('pool')]), pGoatPool: prob(F.emb.model.probs('goat')[widx('pool')])
    };
  }

  return {
    sum, mean, clamp, sigmoid, relu, logit, dot, norm, cosine, makeRng, softmax, penalty,
    REVIEW, reviewScore, reviewWith, CLASSES, SOFTMAX_START,
    SEP, SEP_LAMBDAS, SEP_STEPS, SEP_EVERY, sepTrain,
    forward, grads, initModel, stepModel, dataLoss, accuracy, trainNet, cloneModel, XOR_SPEC, makeXor, NET_CONFIGS, probGrid,
    CHEESE, cheeseCosine, SENTENCES, VOCAB, V, GROUP_OF, KEY_PAIRS, widx, BG, markovRow, markovP, corpusLines,
    EMB, trainEmbedding, neighbours, pairCosines, averageVector, simStr, build, values
  };
});
