'use strict';
// Run with: node ml_intro/decision_trees/ml-math.test.js
const assert = require('assert');
const ML = require('./ml-math.js');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}
const near = (a, b, eps) => Math.abs(a - b) < (eps || 1e-9);

const D = ML.makeDataset(42);
const NZ = ML.makeNoisy(42);
const FR = ML.makeFresh(1001);
const IDX = D.X.map((_, i) => i);
const tree = k => ML.buildTree(D.X, D.y, { maxDepth: k });

/* ---------------------------------------------------------------- impurity */
t('gini: pure node = 0, balanced binary = 0.5', () => {
  assert.strictEqual(ML.gini([10, 0]), 0);
  assert.strictEqual(ML.gini([0, 7]), 0);
  assert.ok(near(ML.gini([5, 5]), 0.5));
  assert.ok(near(ML.giniProbs([0.25, 0.75]), 0.375));
  assert.ok(near(ML.gini([8, 2]), 0.32));
  assert.strictEqual(ML.gini([0, 0]), 0, 'an empty node is not mixed up');
  assert.strictEqual(ML.entropy([0, 0]), 0);
});

t('gini = chance that two examples picked at random (with putting back) disagree', () => {
  for (const c of [[8, 2], [5, 5], [10, 0], [1, 9], [39, 17], [16, 17], [3, 2]]) {
    assert.ok(near(ML.pickDisagreeProb(c), ML.gini(c)), 'counts ' + c);
  }
});

t('entropy: pure = 0, balanced binary = 1 bit, [3,1] = 0.811 bits, [8,2] = 0.722', () => {
  assert.strictEqual(ML.entropy([9, 0]), 0);
  assert.ok(near(ML.entropy([4, 4]), 1));
  assert.ok(near(ML.entropy([3, 1]), 0.8112781244591328));
  assert.ok(near(ML.entropyProbs([0.5, 0.5]), 1));
  assert.ok(near(ML.entropy([8, 2]), 0.7219280948873623));
});

/* ---------------------------------------------------------------- splitting */
t('splitStats: gain = parent impurity - weighted child impurity, counts add up', () => {
  const s = ML.splitStats(D.X, D.y, IDX, 0, 5.0, 'gini');
  assert.strictEqual(s.left.length + s.right.length, D.n);
  assert.strictEqual(s.leftCounts[0] + s.leftCounts[1], s.left.length);
  const w = (s.left.length * ML.gini(s.leftCounts) + s.right.length * ML.gini(s.rightCounts)) / D.n;
  assert.ok(near(s.weightedImpurity, w));
  assert.ok(near(s.gain, ML.gini(s.parentCounts) - w));
  assert.ok(s.left.every(i => D.X[i][0] <= 5.0) && s.right.every(i => D.X[i][0] > 5.0));
});

t('scanSplits covers every gap between sorted values; its best equals bestSplit per feature', () => {
  for (const f of [0, 1]) {
    const scan = ML.scanSplits(D.X, D.y, IDX, 'gini', f);
    assert.strictEqual(scan.length, new Set(D.X.map(p => p[f])).size - 1);
    const best = scan.reduce((a, b) => (b.gain > a.gain ? b : a));
    const bs = ML.bestSplit(D.X, D.y, IDX, 'gini', [f]);
    assert.strictEqual(bs.threshold, best.threshold);
    assert.ok(near(bs.gain, best.gain));
  }
});

t('bestSplit finds the separating threshold on 1-D data', () => {
  const xs = [1, 2, 3, 4, 5, 6], ys = [0, 0, 0, 1, 1, 1];
  const X = xs.map(x => [x, 0]);
  const s = ML.bestSplit(X, ys, [0, 1, 2, 3, 4, 5], 'gini', [0]);
  assert.ok(s.threshold > 3 && s.threshold < 4, 'threshold between 3 and 4, got ' + s.threshold);
  assert.ok(near(s.gain, 0.5), 'gain 0.5, got ' + s.gain);
  assert.deepStrictEqual(s.leftCounts, [3, 0]);
  assert.deepStrictEqual(s.rightCounts, [0, 3]);
  const e = ML.bestSplit(X, ys, [0, 1, 2, 3, 4, 5], 'entropy', [0]);
  assert.ok(near(e.gain, 1), 'entropy gain = 1 bit, got ' + e.gain);
});

/* ---------------------------------------------------------------- the dataset (A1, A2) */
t('dataset is deterministic: 56 training points, 39 blue and 17 orange, all in range', () => {
  const a = ML.makeDataset(11), b = ML.makeDataset(11);
  assert.deepStrictEqual(a.X, b.X);
  assert.strictEqual(D.n, 56);
  assert.deepStrictEqual(ML.countsOf(D.y, IDX), [39, 17]);
  assert.ok(D.X.every(p => p.every(v => v >= 0.2 && v <= 9.8)));
});

t('dataset is NOT an XOR: the greedy root really is a vertical cut near 5.4 with a big gain', () => {
  const best = ML.bestSplit(D.X, D.y, IDX, 'gini');
  assert.strictEqual(best.feature, 0, 'root question is about feature 1');
  assert.ok(best.threshold > 5.0 && best.threshold < 5.9, 'root threshold ' + best.threshold);
  assert.ok(best.gain > 0.1, 'gain ' + best.gain + ' (the old XOR data had 0.04)');
  const bestY = ML.bestSplit(D.X, D.y, IDX, 'gini', [1]);
  assert.ok(best.gain > bestY.gain + 0.03, 'feature 1 beats the best feature-2 cut clearly');
  assert.deepStrictEqual(best.rightCounts, [23, 0], 'the right-hand side is pure blue');
  assert.deepStrictEqual(best.leftCounts, [16, 17]);
  assert.ok(near(best.parentImpurity, ML.gini([39, 17])));
});

t('accuracy grows 71% -> 96% -> 100% with depth 1, 2, 4 (the numbers the text relies on)', () => {
  const a = k => ML.accuracy(tree(k), D.X, D.y);
  assert.ok(near(a(1), 40 / 56), 'depth 1: ' + a(1));
  assert.ok(near(a(2), 54 / 56), 'depth 2: ' + a(2));
  assert.ok(a(2) > a(1) + 0.2);
  assert.strictEqual(a(8), 1, 'a deep tree fits the clean training data perfectly');
  assert.strictEqual(ML.leafCount(tree(8)), 5);
});

t('one tree for the whole page: depth-limited trees are prefixes of the deeper tree', () => {
  const t1 = tree(1), t2 = tree(2), t3 = tree(3);
  for (const [a, b] of [[t1, t2], [t2, t3]]) {
    for (const [na, nb] of [[a, b], [a.left, b.left], [a.right, b.right]]) {
      if (na.leaf && nb.depth >= na.depth && na.reason !== 'depth') { assert.ok(nb.leaf); continue; }
      if (!na.leaf) { assert.strictEqual(na.feature, nb.feature); assert.strictEqual(na.threshold, nb.threshold); }
    }
  }
  // the walk of chapter 2, the training of chapter 5 and the boundary of chapter 6 use this tree
  assert.strictEqual(t2.feature, 0);
  assert.strictEqual(t2.left.feature, 1);
  assert.ok(near(t2.left.threshold, 4.98, 0.01));
  assert.ok(t2.right.leaf && t2.right.reason === 'pure');
  assert.deepStrictEqual(t2.left.leftCounts || t2.left.left.counts, [16, 2]);
  assert.deepStrictEqual(t2.left.right.counts, [0, 15]);
});

t('the chapter-2 walk: probe goes yes at the root, no at the next question, and lands in the pure orange leaf', () => {
  const w = ML.predict(tree(2), ML.PROBE);
  assert.strictEqual(w.path.length, 3);
  assert.ok(ML.PROBE[0] <= w.path[0].threshold, 'root: yes');
  assert.ok(ML.PROBE[1] > w.path[1].threshold, 'second question: no');
  assert.strictEqual(w.path[1].feature, 1);
  assert.strictEqual(w.label, 1);
  assert.deepStrictEqual(w.leaf.counts, [0, 15]);
  assert.strictEqual(w.leaf.reason, 'pure');
});

t('tree nodes carry their own impurity, leaf reason and a stable id', () => {
  const nodes = ML.treeNodes(tree(3));
  assert.strictEqual(new Set(nodes.map(n => n.id)).size, nodes.length);
  nodes.forEach(n => {
    assert.ok(near(n.impurity, ML.gini(n.counts)));
    if (n.leaf) assert.ok(['pure', 'depth', 'small', 'nogain'].includes(n.reason));
    else assert.ok(near(n.gain, n.impurity - n.weightedImpurity));
  });
  assert.strictEqual(ML.treeDepth(tree(8)), 4);
});

t('predict returns a valid root-to-leaf path', () => {
  const tr = tree(3);
  for (const x of D.X.slice(0, 10)) {
    const r = ML.predict(tr, x);
    assert.strictEqual(r.path[0], tr);
    assert.strictEqual(r.path[r.path.length - 1], r.leaf);
    assert.strictEqual(r.label, r.leaf.prediction);
  }
});

t('partitionRects tiles the plane, one rectangle per leaf, and agrees with predict', () => {
  for (const k of [1, 2, 3, 8]) {
    const tr = tree(k);
    const rects = ML.partitionRects(tr, { x0: 0, x1: 10, y0: 0, y1: 10 });
    const area = rects.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0);
    assert.ok(near(area, 100, 1e-6), 'area ' + area);
    assert.strictEqual(rects.length, ML.leafCount(tr));
    for (const r of rects) {
      const c = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
      assert.strictEqual(ML.predict(tr, c).label, r.pred);
    }
  }
});

t('layoutTree puts leaves left to right and parents above their children', () => {
  const tr = ML.layoutTree(tree(3), 0, 100, 10, 50);
  const leaves = ML.treeNodes(tr).filter(n => n.leaf);
  for (let i = 1; i < leaves.length; i++) assert.ok(leaves[i].px > leaves[i - 1].px);
  ML.treeNodes(tr).filter(n => !n.leaf).forEach(n => {
    assert.ok(near(n.px, (n.left.px + n.right.px) / 2));
    assert.ok(n.py < n.left.py && n.py < n.right.py);
  });
  assert.ok(leaves.every(l => l.px >= 0 && l.px <= 100));
  assert.ok(near(leaves[0].px, 0) && near(leaves[leaves.length - 1].px, 100), 'leaves span the whole width');
  for (let i = 1; i < leaves.length; i++) assert.ok(near(leaves[i].px - leaves[i - 1].px, 100 / (leaves.length - 1)), 'even spacing');
});

/* ---------------------------------------------------------------- overfitting (A6) */
t('noisy data: four mislabelled points that contradict their neighbourhood', () => {
  assert.strictEqual(NZ.n, 60);
  assert.deepStrictEqual(NZ.noisy, [56, 57, 58, 59]);
  const ref = tree(3);
  for (const i of NZ.noisy) assert.notStrictEqual(ML.predict(ref, NZ.X[i]).label, NZ.y[i], 'point ' + i + ' disagrees with its region');
});

t('overfitting: a depth-8 tree is perfect on its training data, but loses on fresh data', () => {
  const deep = ML.buildTree(NZ.X, NZ.y, { maxDepth: 8 });
  const shallow = ML.buildTree(NZ.X, NZ.y, { maxDepth: 2 });
  const A = (tr, d) => ML.accuracy(tr, d.X, d.y);
  assert.strictEqual(A(deep, NZ), 1, 'deep tree memorises the noisy training data');
  assert.ok(A(shallow, NZ) < 0.95, 'shallow tree ignores the noise: ' + A(shallow, NZ));
  assert.ok(A(deep, NZ) > A(shallow, NZ));
  assert.strictEqual(FR.n, 224);
  assert.ok(A(shallow, FR) > A(deep, FR) + 0.05, 'fresh: shallow ' + A(shallow, FR) + ' vs deep ' + A(deep, FR));
  assert.ok(ML.leafCount(deep) > ML.leafCount(shallow) + 5);
});

t('overfitting curve: training accuracy never falls with depth; fresh accuracy peaks at depth 2-3', () => {
  const fresh = [], train = [];
  for (let k = 1; k <= 8; k++) {
    const tr = ML.buildTree(NZ.X, NZ.y, { maxDepth: k });
    train.push(ML.accuracy(tr, NZ.X, NZ.y)); fresh.push(ML.accuracy(tr, FR.X, FR.y));
  }
  for (let k = 1; k < 8; k++) assert.ok(train[k] >= train[k - 1] - 1e-12, 'train depth ' + (k + 1));
  const bestFresh = fresh.indexOf(Math.max.apply(null, fresh)) + 1;
  assert.ok(bestFresh === 2 || bestFresh === 3, 'best fresh depth ' + bestFresh);
  assert.ok(fresh[7] < fresh[bestFresh - 1] - 0.08, 'depth 8 is clearly worse on fresh data');
  assert.ok(fresh[0] < fresh[1], 'depth 1 underfits');
});

t('fresh points are new: none coincides with a training point', () => {
  const key = p => p[0].toFixed(6) + ',' + p[1].toFixed(6);
  const seen = new Set(NZ.X.map(key));
  assert.ok(FR.X.every(p => !seen.has(key(p))));
});

/* ---------------------------------------------------------------- forest */
t('bootstrap: n draws in range; about 37% of examples are left out', () => {
  const rng = ML.mulberry32(99);
  const idx = ML.bootstrap(50, rng);
  assert.strictEqual(idx.length, 50);
  assert.ok(idx.every(i => i >= 0 && i < 50));
  assert.ok(near(ML.outOfBagChance(60), Math.pow(59 / 60, 60)));
  assert.ok(Math.abs(ML.outOfBagChance(1000) - 1 / Math.E) < 5e-4);
  let left = 0, total = 0;
  for (let r = 0; r < 400; r++) {
    const b = new Set(ML.bootstrap(NZ.n, rng));
    left += NZ.n - b.size; total += NZ.n;
  }
  assert.ok(Math.abs(left / total - ML.outOfBagChance(NZ.n)) < 0.01, 'simulated ' + left / total);
});

t('random forest: 25 deep trees voting beat one deep tree on fresh data', () => {
  const f = ML.trainForest(NZ.X, NZ.y, { seed: 7, nTrees: 25, maxDepth: 8, maxFeatures: 1 });
  assert.strictEqual(f.trees.length, 25);
  assert.strictEqual(f.bags.length, 25);
  const deep = ML.buildTree(NZ.X, NZ.y, { maxDepth: 8 });
  const fAcc = ML.forestAccuracy(f, FR.X, FR.y), dAcc = ML.accuracy(deep, FR.X, FR.y);
  assert.ok(fAcc > dAcc + 0.05, 'forest ' + fAcc + ' vs single tree ' + dAcc);
  const v = ML.forestVote(f, [7, 5]);
  assert.strictEqual(v.votes[0] + v.votes[1], 25);
  assert.strictEqual(v.label, v.votes[1] > v.votes[0] ? 1 : 0);
  // with two features, "a random subset of features" means one feature per split
  const again = ML.trainForest(NZ.X, NZ.y, { seed: 7, nTrees: 25, maxDepth: 8, maxFeatures: 1 });
  assert.deepStrictEqual(again.bags, f.bags, 'deterministic');
});

/* ---------------------------------------------------------------- AdaBoost (A3) */
const LINE = ML.makeLine();
const ADA = ML.adaboostTrain1D(LINE.xs, LINE.ys, 20);

t('line data uses -1/+1 labels and two examples really cross over', () => {
  assert.ok(LINE.ys.every(v => v === 1 || v === -1));
  assert.strictEqual(LINE.xs.length, LINE.n);
  assert.strictEqual(LINE.ys[LINE.outliers[0]], 1);
  assert.ok(LINE.xs[LINE.outliers[0]] < 4.8, 'a +1 example in the -1 zone');
  assert.strictEqual(LINE.ys[LINE.outliers[1]], -1);
  assert.ok(LINE.xs[LINE.outliers[1]] > 4.8, 'a -1 example in the +1 zone');
});

t('adaboost needs several rounds (the old data stopped after round 1) and ends with zero training errors', () => {
  const H = ADA.history;
  assert.ok(H.length >= 3, 'rounds: ' + H.length);
  assert.strictEqual(H.length, 7);
  assert.ok(H[0].err > 0.1, 'the first stump makes mistakes: ' + H[0].err);
  assert.ok(H[0].alpha > 0 && H[0].alpha < 2, 'sensible first alpha: ' + H[0].alpha);
  assert.deepStrictEqual(H[0].wrong, LINE.outliers, 'round 1 gets exactly the two crossing examples wrong');
  assert.strictEqual(H[H.length - 1].trainErr, 0);
  assert.ok(H.slice(0, -1).every(h => h.trainErr > 0), 'it only stops when the ensemble is perfect');
  let correct = 0;
  LINE.xs.forEach((x, i) => { if (ML.adaboostPredict(ADA, x) === LINE.ys[i]) correct++; });
  assert.strictEqual(correct, LINE.n);
  assert.strictEqual(ADA.stumps.length, H.length);
});

t('adaboost reweighting: mistakes get heavier, the rest lighter, weights stay normalised', () => {
  ADA.history.forEach((h, r) => {
    assert.ok(near(h.weights.reduce((a, b) => a + b, 0), 1));
    assert.ok(near(h.weightsBefore.reduce((a, b) => a + b, 0), 1));
    if (r === 0) assert.ok(h.weightsBefore.every(w => near(w, 1 / LINE.n)), 'round 1 starts uniform');
    else assert.deepStrictEqual(h.weightsBefore, ADA.history[r - 1].weights);
    const wrong = new Set(h.wrong);
    LINE.xs.forEach((_, i) => {
      if (wrong.has(i)) assert.ok(h.weights[i] > h.weightsBefore[i], 'round ' + (r + 1) + ' point ' + i + ' grows');
      else assert.ok(h.weights[i] < h.weightsBefore[i], 'round ' + (r + 1) + ' point ' + i + ' shrinks');
    });
    // classic AdaBoost property: after reweighting, the stump just chosen is exactly as bad as a coin flip
    assert.ok(near(h.wrong.reduce((a, i) => a + h.weights[i], 0), 0.5, 1e-9));
    assert.ok(near(h.wrong.reduce((a, i) => a + h.weightsBefore[i], 0), h.err, 1e-9));
    assert.ok(near(h.alpha, 0.5 * Math.log((1 - h.err) / h.err)));
  });
});

t('adaboost final vote is the sign of the weighted sum of stump votes', () => {
  for (const x of [0.5, 3.0, 5.0, 7.4, 9.5]) {
    let F = 0;
    for (const s of ADA.stumps) F += s.alpha * ML.stumpPredict(s, x);
    assert.ok(near(ML.adaboostF(ADA, x), F));
    assert.strictEqual(ML.adaboostPredict(ADA, x), F >= 0 ? 1 : -1);
  }
});

console.log('\nAll ' + passed + ' tests passed.');
