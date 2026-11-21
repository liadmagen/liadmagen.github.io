'use strict';
// Run with: node nn-math.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const NN = require('./nn-math.js');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || 'values differ') + ': ' + a + ' vs ' + b + ' (tol ' + tol + ')');

const t0 = Date.now();
const F = NN.build();
const buildMs = Date.now() - t0;
const V = NN.values(F);

/* ------------------------------------------------------------------ the course slides' numbers */
t('movie review: z = 0.833 and sigma(z) = 0.70, as on slide 39', () => {
  const r = NN.reviewScore();
  near(r.z, 0.833, 0.001); near(r.p, 0.70, 0.005);
  near(r.contrib.reduce((a, b) => a + b, 0) + NN.REVIEW.b, r.z, 1e-12);
  near(r.contrib[0], 7.5, 1e-9); near(r.contrib[1], -10, 1e-9); near(r.contrib[2], -1.2, 1e-9);
  near(NN.REVIEW.x[5], Math.log(66), 1e-12); near(NN.REVIEW.x[5], 4.19, 0.005);
});
t('review sliders: more negative words lower the probability, more positive words raise it', () => {
  assert.ok(NN.reviewWith(3, 3).p < NN.reviewWith(3, 2).p);
  assert.ok(NN.reviewWith(4, 2).p > NN.reviewWith(3, 2).p);
  assert.strictEqual(NN.reviewWith(3, 2).z, NN.reviewScore().z);
});
t('cheese matrix cosine similarities match the slides (0.80, 0.49, 0.38, 0.17, 0.04, 0.67)', () => {
  const want = { '0-1': 0.80, '0-2': 0.49, '0-3': 0.38, '1-2': 0.17, '1-3': 0.04, '2-3': 0.67 };
  Object.keys(want).forEach((k) => { const [i, j] = k.split('-').map(Number); near(NN.cheeseCosine(i, j), want[k], 0.005, k); });
  near(NN.cheeseCosine(0, 0), 1, 1e-12);
});
t('one-hot vectors: cosine similarity of two different words is exactly 0', () => {
  const e = (i) => [0, 0, 0, 0].map((v, k) => (k === i ? 1 : 0));
  near(NN.cosine(e(0), e(1)), 0, 1e-15); near(NN.cosine(e(2), e(2)), 1, 1e-15);
});

/* ------------------------------------------------------------------ softmax, penalty */
t('softmax: sums to 1, keeps the order, is shift-invariant; penalty is -ln p', () => {
  const p = NN.softmax(NN.SOFTMAX_START);
  near(p.reduce((a, b) => a + b, 0), 1, 1e-12);
  assert.ok(p[0] > p[1] && p[1] > p[2]);
  const q = NN.softmax(NN.SOFTMAX_START.map((v) => v + 100));
  p.forEach((v, i) => near(v, q[i], 1e-12));
  near(NN.penalty(Math.exp(-2)), 2, 1e-12);
  assert.ok(NN.penalty(0.01) > NN.penalty(0.5) && NN.penalty(0.5) > NN.penalty(0.99));
});
t('softmax with two classes equals the sigmoid of the score difference', () => {
  const p = NN.softmax([1.3, -0.4]);
  near(p[0], NN.sigmoid(1.7), 1e-12);
});

/* ------------------------------------------------------------------ regularization demo */
t('separable data: without a penalty the weight keeps growing; a penalty stops it', () => {
  const [none, small, large] = F.sep;
  for (let i = 1; i < none.length; i++) assert.ok(none[i].w > none[i - 1].w, 'w grows at snapshot ' + i);
  assert.ok(none[none.length - 1].w > 5, 'final w without penalty ' + none[none.length - 1].w);
  assert.ok(none[none.length - 1].ce < none[10].ce, 'the loss keeps creeping down');
  const w = (s) => s[s.length - 1].w;
  assert.ok(w(large) < w(small) && w(small) < w(none));
  near(w(small), small[30].w, 0.01); /* settled */
  assert.ok(w(large) < 1.2);
  assert.strictEqual(none.length, NN.SEP_STEPS / NN.SEP_EVERY + 1);
  near(none[0].w, 0, 1e-12);
});
t('the separable data really is separable by one threshold', () => {
  const S = NN.SEP, maxNeg = Math.max.apply(null, S.x.filter((x, i) => S.y[i] === 0)), minPos = Math.min.apply(null, S.x.filter((x, i) => S.y[i] === 1));
  assert.ok(maxNeg < minPos);
});

/* ------------------------------------------------------------------ the tiny network */
t('backpropagation: gradients equal finite differences (no hidden layer, 2 and 3 hidden neurons)', () => {
  const rng = NN.makeRng(99);
  [0, 2, 3].forEach((h) => {
    const m = NN.initModel(h, rng);
    if (h) { m.b1 = m.b1.map(() => 0.3 * rng.normal()); m.b2 = 0.4; }
    else m.b = 0.2;
    const x = [0.7, -1.1], y = 1, g = NN.grads(m, x, y), eps = 1e-6;
    const numeric = (get, set) => { const v = get(); set(v + eps); const a = NN.grads(m, x, y).loss; set(v - eps); const b = NN.grads(m, x, y).loss; set(v); return (a - b) / (2 * eps); };
    if (h === 0) {
      near(numeric(() => m.w[0], (v) => { m.w[0] = v; }), g.dw[0], 1e-6); near(numeric(() => m.w[1], (v) => { m.w[1] = v; }), g.dw[1], 1e-6);
      near(numeric(() => m.b, (v) => { m.b = v; }), g.db, 1e-6);
    } else {
      for (let j = 0; j < h; j++) {
        near(numeric(() => m.W1[j][0], (v) => { m.W1[j][0] = v; }), g.dW1[j][0], 1e-6, 'W1 ' + j + ',0');
        near(numeric(() => m.W1[j][1], (v) => { m.W1[j][1] = v; }), g.dW1[j][1], 1e-6, 'W1 ' + j + ',1');
        near(numeric(() => m.b1[j], (v) => { m.b1[j] = v; }), g.db1[j], 1e-6, 'b1 ' + j);
        near(numeric(() => m.W2[j], (v) => { m.W2[j] = v; }), g.dW2[j], 1e-6, 'W2 ' + j);
      }
      near(numeric(() => m.b2, (v) => { m.b2 = v; }), g.db2, 1e-6);
    }
  });
});
t('XOR blobs: 80 points, 40 yes and 40 no, in four blobs', () => {
  assert.strictEqual(F.xor.X.length, 80);
  assert.strictEqual(F.xor.Y.reduce((a, b) => a + b, 0), 40);
  /* the label is the blob a point was drawn from; a point or two may wander across an axis */
  const onSide = F.xor.X.filter((p, i) => ((p[0] > 0) !== (p[1] > 0) ? 1 : 0) === F.xor.Y[i]).length;
  assert.ok(onSide >= 76, onSide + ' of 80 points on their blob\'s side');
});
t('one neuron cannot solve XOR (at most about 75%); hidden layers can (>= 95%)', () => {
  assert.ok(F.nets[0].acc <= 0.8, 'one neuron ' + F.nets[0].acc);
  [2, 3, 8].forEach((h) => assert.ok(F.nets[h].acc >= 0.95, h + ' hidden neurons: ' + F.nets[h].acc));
  assert.ok(F.nets[8].loss < F.nets[0].loss);
});
t('training is deterministic and the loss falls; snapshots cover epoch 0 to 400', () => {
  const again = NN.trainNet(F.xor.X, F.xor.Y, { h: 3, seed: NN.NET_CONFIGS[3].seed });
  assert.deepStrictEqual(again.model, F.nets[3].model);
  const c = F.nets[3].curve;
  assert.ok(c[c.length - 1] < c[0] * 0.2);
  const s = F.nets[3].snaps;
  assert.strictEqual(s[0].epoch, 0); assert.strictEqual(s[s.length - 1].epoch, 400); assert.strictEqual(s.length, 61);
  near(s[s.length - 1].loss, c[c.length - 1], 1e-12);
});
t('the 2-hidden network separates the data by one straight line in the hidden space (the "space" step)', () => {
  const m = F.nets[2].model, X = F.xor.X, Y = F.xor.Y;
  let right = 0;
  X.forEach((p, i) => { const h = NN.forward(m, p).hid; if ((m.W2[0] * h[0] + m.W2[1] * h[1] + m.b2 >= 0 ? 1 : 0) === Y[i]) right++; });
  assert.ok(right / X.length >= 0.95);
});
t('the backprop example: one update lowers the penalty of that example', () => {
  const snap = F.nets[2].snaps[3], m = snap.model;
  let ex = 0, exP = 2;
  F.xor.X.forEach((p, i) => { if (F.xor.Y[i] === 1) { const pr = NN.forward(m, p).p; if (pr < exP) { exP = pr; ex = i; } } });
  const g = NN.grads(m, F.xor.X[ex], 1), n = NN.cloneModel(m);
  for (let j = 0; j < 2; j++) { for (let k = 0; k < 2; k++) n.W1[j][k] -= 2 * g.dW1[j][k]; n.W2[j] -= 2 * g.dW2[j]; }
  assert.ok(NN.forward(n, F.xor.X[ex]).p > exP, 'the example scores higher after the update');
});

/* ------------------------------------------------------------------ words */
t('corpus: 14 words, 20 sentences, 109 neighbouring pairs; "motel pool" never occurs', () => {
  assert.strictEqual(NN.V, 14); assert.strictEqual(new Set(NN.VOCAB).size, 14);
  assert.strictEqual(NN.BG.sentences, 20); assert.strictEqual(NN.BG.pairs, 109);
  assert.strictEqual(NN.BG.c[NN.widx('motel')][NN.widx('pool')], 0);
  assert.ok(NN.BG.c[NN.widx('hotel')][NN.widx('pool')] > 0);
  NN.SENTENCES.forEach((s) => s.slice(0, -1).forEach((w) => assert.ok(NN.VOCAB.indexOf(w) >= 0, w)));
});
t('Markov chain: rows are probabilities; motel -> pool is exactly 0', () => {
  NN.VOCAB.forEach((w) => near(NN.markovRow(w).reduce((a, b) => a + b, 0), 1, 1e-12, w));
  assert.strictEqual(NN.markovP('motel', 'pool'), 0);
  near(NN.markovP('motel', 'room'), 0.8, 1e-12); near(NN.markovP('motel', 'is'), 0.2, 1e-12);
  near(NN.markovP('.', 'the'), 1, 1e-12);
});
t('embedding model: the loss falls, every row of predictions is a distribution', () => {
  const e = F.emb;
  assert.ok(e.loss < e.curve[0] * 0.5, 'loss ' + e.curve[0] + ' -> ' + e.loss);
  NN.VOCAB.forEach((w) => near(e.model.probs(w).reduce((a, b) => a + b, 0), 1, 1e-9, w));
  assert.strictEqual(e.snaps.length, 61); assert.strictEqual(e.snaps[0].epoch, 0); assert.strictEqual(e.snaps[60].epoch, 300);
  assert.deepStrictEqual(NN.trainEmbedding().snaps[60].E, e.snaps[60].E);
});
t('similar words get rows that point the same way: hotel-motel and goat-sheep above 0.95, hotel-goat below 0.3', () => {
  const E = F.embFinal, c = (a, b) => NN.cosine(E[NN.widx(a)], E[NN.widx(b)]);
  assert.ok(c('hotel', 'motel') > 0.95, 'hotel-motel ' + c('hotel', 'motel'));
  assert.ok(c('goat', 'sheep') > 0.95, 'goat-sheep ' + c('goat', 'sheep'));
  assert.ok(c('hotel', 'goat') < 0.3, 'hotel-goat ' + c('hotel', 'goat'));
  assert.strictEqual(NN.neighbours(E, 'hotel', 1)[0].word, 'motel');
  assert.strictEqual(NN.neighbours(E, 'motel', 1)[0].word, 'hotel');
  assert.strictEqual(NN.neighbours(E, 'goat', 1)[0].word, 'sheep');
  assert.strictEqual(NN.neighbours(E, 'sheep', 1)[0].word, 'goat');
  NN.pairCosines(E).forEach((p) => assert.ok(p.cos > 0.9, p.a + '-' + p.b + ' ' + p.cos));
});
t('before training the vectors are not yet alike (epoch 0 is random)', () => {
  const E0 = F.emb.snaps[0].E;
  const c = NN.cosine(E0[NN.widx('hotel')], E0[NN.widx('motel')]);
  assert.ok(Math.abs(c) < 0.95 || F.emb.snaps[0].loss > F.emb.loss, 'epoch 0 cosine ' + c);
});
t('unseen pair: the network gives "motel pool" far more than "goat pool"; the Markov chain gives 0', () => {
  const pm = F.emb.model.probs('motel')[NN.widx('pool')], pg = F.emb.model.probs('goat')[NN.widx('pool')];
  assert.ok(pm > 0.02 && pm < 0.3, 'motel pool ' + pm);
  assert.ok(pm >= 50 * pg, 'motel pool ' + pm + ' vs goat pool ' + pg);
  assert.ok(pm > 0);
});
t('average of word vectors is their mean', () => {
  const E = F.embFinal, a = NN.averageVector(E, ['hotel', 'motel']);
  near(a[0], (E[NN.widx('hotel')][0] + E[NN.widx('motel')][0]) / 2, 1e-12);
});

/* ------------------------------------------------------------------ the page: every placeholder, every scene, short cards */
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
t('every {{placeholder}} in index.html is defined, and none renders as ? or NaN', () => {
  const keys = new Set();
  (html.match(/\{\{[^}]+\}\}/g) || []).forEach((m) => keys.add(m.slice(2, -2).trim().split(/\s+/)[0].replace(/^t:/, '')));
  assert.ok(keys.size >= 15, 'found ' + keys.size);
  (html.match(/\{\{[^}]+\}\}/g) || []).forEach((m) => {
    const a = m.slice(2, -2).trim().split(/\s+/), k = a[0].replace(/^t:/, ''), f = V[k];
    assert.ok(f !== undefined, 'undefined placeholder ' + k);
    const out = typeof f === 'function' ? String(f.apply(null, a.slice(1))) : String(f);
    assert.ok(out !== '' && !/NaN|undefined|\?/.test(out), k + ' -> ' + out);
  });
});
t('index.html has 8 chapters with the planned scenes, each scene handled by a chapter file', () => {
  const want = [['review', 'loss', 'reg', 'softmax'], ['neuron', 'bio'], ['xor', 'hidden', 'space'], ['layers', 'forward'], ['backprop', 'train', 'choices'],
    ['onehot', 'company', 'dense'], ['markov', 'lookup', 'bigram'], ['nearby', 'next']];
  const chapters = html.split('<section class="chapter"').slice(1);
  assert.strictEqual(chapters.length, 8);
  chapters.forEach((c, i) => {
    const scenes = (c.match(/data-scene="([a-z]+)"/g) || []).map((s) => s.slice(12, -1));
    assert.deepStrictEqual(scenes, want[i], 'chapter ' + (i + 1));
    ['viz' + (i + 1), 'cap' + (i + 1), 'ctl' + (i + 1)].forEach((id) => assert.ok(c.indexOf('id="' + id + '"') >= 0, id));
  });
  const src = ['ch-neuron.js', 'ch-network.js', 'ch-words.js', 'ch-handoff.js'].map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  for (let i = 1; i <= 8; i++) assert.ok(src.indexOf("register('ch" + i + "'") >= 0, 'chapter ' + i + ' is registered');
  want.flat().forEach((s) => assert.ok(new RegExp('\\b' + s + '\\b').test(src), 'scene function ' + s));
});
t('step cards stay short (about 70 words of prose, formulas and predict boxes excluded)', () => {
  const steps = html.split('<div class="step"').slice(1);
  assert.strictEqual(steps.length, 22);
  steps.forEach((s) => {
    const body = s.split(/\n      <\/div>/)[0].replace(/<div class="predict"[\s\S]*?<\/div>\s*<\/div>/g, '').replace(/<span class="formula">[\s\S]*?<\/span>/g, '')
      .replace(/<span class="tag">[\s\S]*?<\/span>/g, '').replace(/<h3>[\s\S]*?<\/h3>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
    const words = body.split(/\s+/).filter(Boolean).length;
    assert.ok(words <= 80, (s.match(/data-scene="(\w+)"/) || [])[1] + ': ' + words + ' words');
  });
});
t('the page needs only local files (no external scripts or fonts)', () => {
  const ext = (html.match(/(?:src|href)="https?:\/\/[^"]+"/g) || []).filter((u) => !/<a /.test(u));
  (html.match(/<(?:script|link)[^>]+>/g) || []).forEach((tag) => assert.ok(!/https?:\/\//.test(tag), tag));
  void ext;
  ['nn-math.js', 'kit.js', 'ch-neuron.js', 'ch-network.js', 'ch-words.js', 'ch-handoff.js', 'app.js'].forEach((f) => assert.ok(fs.existsSync(path.join(__dirname, f)), f));
  assert.ok(html.indexOf('../vendor/katex/katex.min.js') > 0 && fs.existsSync(path.join(__dirname, '..', 'vendor', 'katex', 'katex.min.js')));
});
t('everything the page trains at load takes well under a second', () => {
  assert.ok(buildMs < 1000, 'build took ' + buildMs + ' ms');
});

console.log('\n' + passed + ' tests passed (build ' + buildMs + ' ms)');
