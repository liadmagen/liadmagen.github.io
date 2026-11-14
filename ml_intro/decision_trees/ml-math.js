/* Pure maths and data for the decision-tree explainer (no DOM, UMD, unit-tested).
   Every number shown on the page is computed here: the datasets, the trained trees,
   the impurity and gain values, the forest and the AdaBoost rounds.

   Two classes: 0 = "blue", 1 = "orange". Two measurements per example: x[0] ("feature 1")
   and x[1] ("feature 2"), both on a 0..10 scale. The data are synthetic and seeded: they
   illustrate the algorithm, they are not linguistic data. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MLM = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* ---------------------------------------------------------------- random numbers */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(rng) {
    let u = 0;
    while (u === 0) u = rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------------------------------------------------------------- data */
  // A staircase, not an XOR: orange sits top-left; blue sits bottom-left and on the whole
  // right-hand side. One vertical question helps a lot, a second horizontal one finishes the job.
  const CLUSTERS = [
    { c: [3.2, 6.6], sd: [0.9, 1.1], label: 1, n: 17 },
    { c: [3.4, 3.3], sd: [1.2, 0.8], label: 0, n: 17 },
    { c: [7.7, 5.8], sd: [0.9, 1.2], label: 0, n: 22 },
  ];
  // Four examples whose label contradicts their neighbourhood (label noise).
  const MISLABELED = [[7.0, 4.6, 1], [6.3, 6.9, 1], [3.0, 6.0, 0], [2.6, 7.4, 0]];

  function sampleClusters(rng, mult) {
    const X = [], y = [], cluster = [];
    CLUSTERS.forEach((b, k) => {
      for (let i = 0; i < b.n * mult; i++) {
        const x = Math.min(9.8, Math.max(0.2, b.c[0] + gaussian(rng) * b.sd[0]));
        const yy = Math.min(9.8, Math.max(0.2, b.c[1] + gaussian(rng) * b.sd[1]));
        X.push([x, yy]); y.push(b.label); cluster.push(k);
      }
    });
    return { X, y, cluster };
  }

  function makeDataset(seed) {
    const d = sampleClusters(mulberry32(seed), 1);
    d.n = d.X.length;
    d.noisy = [];
    return d;
  }

  // the same data plus four mislabelled examples (indices listed in .noisy)
  function makeNoisy(seed) {
    const d = makeDataset(seed);
    for (const [x, yy, l] of MISLABELED) {
      d.noisy.push(d.X.length);
      d.X.push([x, yy]); d.y.push(l); d.cluster.push(-1);
    }
    d.n = d.X.length;
    return d;
  }

  // fresh examples from the same clusters, four times as many, no mislabels
  function makeFresh(seed) {
    const d = sampleClusters(mulberry32(seed), 4);
    d.n = d.X.length;
    d.noisy = [];
    return d;
  }

  // a new, unlabelled example that chapter 2 sends down the tree
  const PROBE = [4.3, 6.1];

  // 1-D data for AdaBoost, labels already -1 / +1. Two examples cross over on purpose:
  // x = 3.0 is +1 although it sits in the -1 zone, and x = 7.4 is -1 in the +1 zone.
  function makeLine() {
    const xs = [1.0, 1.8, 2.6, 3.4, 4.2, 5.4, 6.2, 7.0, 7.8, 8.6, 9.2, 3.0, 7.4];
    const ys = xs.map(x => (x < 4.8 ? -1 : 1));
    ys[11] = 1; ys[12] = -1;
    return { xs, ys, n: xs.length, outliers: [11, 12] };
  }

  /* ---------------------------------------------------------------- impurity */
  function countsOf(y, idx) {
    let c0 = 0, c1 = 0;
    for (const i of idx) (y[i] === 0 ? c0++ : c1++);
    return [c0, c1];
  }

  function probs(counts) {
    const n = counts[0] + counts[1];
    if (n === 0) return [0, 0];
    return [counts[0] / n, counts[1] / n];
  }

  // an empty node has nothing to disagree about: impurity 0
  function giniProbs(p) { return p[0] + p[1] === 0 ? 0 : 1 - (p[0] * p[0] + p[1] * p[1]); }
  function gini(counts) { return giniProbs(probs(counts)); }

  // "Pick one example, put it back, pick again: how often do the two disagree?"
  // Computed by listing every ordered pair, so it is independent of the formula.
  function pickDisagreeProb(counts) {
    const labels = [];
    for (let k = 0; k < counts[0]; k++) labels.push(0);
    for (let k = 0; k < counts[1]; k++) labels.push(1);
    const n = labels.length;
    if (!n) return 0;
    let diff = 0;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (labels[a] !== labels[b]) diff++;
    return diff / (n * n);
  }

  function entropyProbs(p) {
    let h = 0;
    for (const pk of p) if (pk > 0) h -= pk * Math.log2(pk);
    return h;
  }
  function entropy(counts) { return entropyProbs(probs(counts)); }

  function impurity(criterion, counts) {
    return criterion === 'entropy' ? entropy(counts) : gini(counts);
  }

  /* ---------------------------------------------------------------- splitting */
  // Score the question "X[i][feature] <= threshold ?" for the examples in idx.
  function splitStats(X, y, idx, feature, threshold, criterion) {
    const left = [], right = [];
    for (const i of idx) (X[i][feature] <= threshold ? left : right).push(i);
    const cl = countsOf(y, left), cr = countsOf(y, right), parent = countsOf(y, idx);
    const n = idx.length;
    const parentImp = impurity(criterion, parent);
    const impL = impurity(criterion, cl), impR = impurity(criterion, cr);
    const wImp = n ? (left.length * impL + right.length * impR) / n : 0;
    return {
      feature, threshold, left, right, leftCounts: cl, rightCounts: cr, parentCounts: parent,
      leftImpurity: impL, rightImpurity: impR, parentImpurity: parentImp,
      weightedImpurity: wImp, gain: parentImp - wImp,
    };
  }

  // Every candidate threshold (midpoints between neighbouring sorted values) for one feature.
  function scanSplits(X, y, idx, criterion, feature) {
    const vals = idx.map(i => X[i][feature]).sort((a, b) => a - b);
    const out = [];
    const seen = new Set();
    for (let k = 0; k < vals.length - 1; k++) {
      const t = (vals[k] + vals[k + 1]) / 2;
      if (seen.has(t) || vals[k] === vals[k + 1]) continue;
      seen.add(t);
      const s = splitStats(X, y, idx, feature, t, criterion);
      if (!s.left.length || !s.right.length) continue;
      out.push(s);
    }
    return out;
  }

  function bestSplit(X, y, idx, criterion, features) {
    let best = null;
    for (const f of (features || [0, 1])) {
      for (const s of scanSplits(X, y, idx, criterion, f)) {
        if (!best || s.gain > best.gain) best = s;
      }
    }
    return best;
  }

  function majority(counts) { return counts[1] > counts[0] ? 1 : 0; }

  function buildTree(X, y, opts) {
    opts = opts || {};
    const maxDepth = opts.maxDepth != null ? opts.maxDepth : 4;
    const minSplit = opts.minSamplesSplit != null ? opts.minSamplesSplit : 2;
    const criterion = opts.criterion || 'gini';
    const maxFeatures = opts.maxFeatures || null;
    const rng = opts.rng || Math.random;
    let nextId = 0;

    function recurse(idx, depth) {
      const counts = countsOf(y, idx);
      const node = {
        id: nextId++, n: idx.length, counts, depth, idx,
        impurity: impurity(criterion, counts), prediction: majority(counts), leaf: false,
      };
      const pure = counts[0] === 0 || counts[1] === 0;
      if (depth >= maxDepth || idx.length < minSplit || pure) {
        node.leaf = true;
        node.reason = pure ? 'pure' : (depth >= maxDepth ? 'depth' : 'small');
        return node;
      }
      let feats = [0, 1];
      if (maxFeatures && maxFeatures < feats.length) {
        feats = feats.slice();
        for (let i = feats.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const tmp = feats[i]; feats[i] = feats[j]; feats[j] = tmp;
        }
        feats = feats.slice(0, maxFeatures);
      }
      const split = bestSplit(X, y, idx, criterion, feats);
      if (!split || split.gain <= 1e-12) { node.leaf = true; node.reason = 'nogain'; return node; }
      node.feature = split.feature;
      node.threshold = split.threshold;
      node.gain = split.gain;
      node.weightedImpurity = split.weightedImpurity;
      node.left = recurse(split.left, depth + 1);
      node.right = recurse(split.right, depth + 1);
      return node;
    }
    return recurse(X.map((_, i) => i), 0);
  }

  function predict(tree, x) {
    const path = [tree];
    let node = tree;
    while (!node.leaf) {
      node = x[node.feature] <= node.threshold ? node.left : node.right;
      path.push(node);
    }
    return { label: node.prediction, leaf: node, path };
  }

  function accuracy(tree, X, y) {
    let ok = 0;
    for (let i = 0; i < X.length; i++) if (predict(tree, X[i]).label === y[i]) ok++;
    return ok / X.length;
  }
  const trainAccuracy = accuracy;

  function treeNodes(tree) {
    const out = [];
    (function walk(n) { out.push(n); if (!n.leaf) { walk(n.left); walk(n.right); } })(tree);
    return out;
  }
  function leafCount(tree) { return treeNodes(tree).filter(n => n.leaf).length; }
  function treeDepth(tree) { return Math.max.apply(null, treeNodes(tree).map(n => n.depth)); }

  function treeWidth(node, minLeafW) {
    if (node.leaf) return Math.max(minLeafW || 8, node.n);
    return treeWidth(node.left, minLeafW) + treeWidth(node.right, minLeafW);
  }

  // Tidy layout: leaves are spread evenly from x0 to x1 (first leaf at x0, last at x1),
  // parents sit above the middle of their children.
  function layoutTree(tree, x0, x1, y0, levelH) {
    let leaves = 0;
    (function count(n) { if (n.leaf) leaves++; else { count(n.left); count(n.right); } })(tree);
    const slot = leaves > 1 ? (x1 - x0) / (leaves - 1) : 0;
    let k = 0;
    (function place(n) {
      n.py = y0 + n.depth * levelH;
      if (n.leaf) { n.px = leaves > 1 ? x0 + slot * k : (x0 + x1) / 2; k++; return; }
      place(n.left); place(n.right);
      n.px = (n.left.px + n.right.px) / 2;
    })(tree);
    return tree;
  }

  // The rectangles of the plane that a tree (cut off at maxDepth) predicts.
  function partitionRects(tree, bounds, maxDepth) {
    const rects = [];
    function walk(node, b) {
      if (node.leaf || (maxDepth != null && node.depth >= maxDepth)) {
        rects.push({
          x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1,
          pred: node.prediction, counts: node.counts, depth: node.depth, node: node,
        });
        return;
      }
      if (node.feature === 0) {
        walk(node.left, { x0: b.x0, x1: Math.min(node.threshold, b.x1), y0: b.y0, y1: b.y1 });
        walk(node.right, { x0: Math.max(node.threshold, b.x0), x1: b.x1, y0: b.y0, y1: b.y1 });
      } else {
        walk(node.left, { x0: b.x0, x1: b.x1, y0: b.y0, y1: Math.min(node.threshold, b.y1) });
        walk(node.right, { x0: b.x0, x1: b.x1, y0: Math.max(node.threshold, b.y0), y1: b.y1 });
      }
    }
    walk(tree, bounds);
    return rects;
  }

  /* ---------------------------------------------------------------- forest */
  function bootstrap(n, rng) {
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(Math.floor(rng() * n));
    return idx;
  }

  // chance that one example is never drawn in n draws with replacement: (1 - 1/n)^n -> 1/e
  function outOfBagChance(n) { return Math.pow(1 - 1 / n, n); }

  function trainForest(X, y, opts) {
    opts = opts || {};
    const rng = mulberry32(opts.seed != null ? opts.seed : 1);
    const trees = [], bags = [];
    for (let t = 0; t < (opts.nTrees || 25); t++) {
      const idx = bootstrap(X.length, rng);
      bags.push(idx);
      trees.push(buildTree(idx.map(i => X[i]), idx.map(i => y[i]), {
        maxDepth: opts.maxDepth != null ? opts.maxDepth : 8, maxFeatures: opts.maxFeatures || 1, rng,
      }));
    }
    return { trees, bags };
  }

  function forestVote(forest, x) {
    const votes = [0, 0];
    for (const t of forest.trees) votes[predict(t, x).label]++;
    return { label: votes[1] > votes[0] ? 1 : 0, votes };
  }

  function forestAccuracy(forest, X, y) {
    let ok = 0;
    for (let i = 0; i < X.length; i++) if (forestVote(forest, X[i]).label === y[i]) ok++;
    return ok / X.length;
  }

  /* ---------------------------------------------------------------- AdaBoost (1-D stumps) */
  function stumpPredict(s, x) { return s.polarity * (x > s.threshold ? 1 : -1); }

  function adaboostF(model, x) {
    let F = 0;
    for (const s of model.stumps) F += s.alpha * stumpPredict(s, x);
    return F;
  }
  function adaboostPredict(model, x) { return Math.sign(adaboostF(model, x)) || 1; }

  // ys must be -1 / +1. Stops when the ensemble makes no training mistake, or after T rounds.
  function adaboostTrain1D(xs, ys, T) {
    const n = xs.length;
    let w = xs.map(() => 1 / n);
    const stumps = [], history = [];
    const vals = [...new Set(xs)].sort((a, b) => a - b);
    for (let t = 0; t < T; t++) {
      let best = null;
      for (let k = 0; k < vals.length - 1; k++) {
        const thr = (vals[k] + vals[k + 1]) / 2;
        for (const pol of [1, -1]) {
          let err = 0;
          for (let i = 0; i < n; i++) if (pol * (xs[i] > thr ? 1 : -1) !== ys[i]) err += w[i];
          if (!best || err < best.err - 1e-12) best = { threshold: thr, polarity: pol, err };
        }
      }
      if (!best) break;
      const err = Math.min(Math.max(best.err, 1e-12), 1 - 1e-12);
      const alpha = 0.5 * Math.log((1 - err) / err);
      const stump = { threshold: best.threshold, polarity: best.polarity, err, alpha };
      const weightsBefore = w.slice();
      const wrong = [];
      for (let i = 0; i < n; i++) if (stumpPredict(stump, xs[i]) !== ys[i]) wrong.push(i);
      const wNew = xs.map((x, i) => w[i] * Math.exp(-alpha * ys[i] * stumpPredict(stump, x)));
      const z = wNew.reduce((a, b) => a + b, 0);
      w = wNew.map(v => v / z);
      stumps.push(stump);
      let trainErr = 0;
      const ensembleWrong = [];
      for (let i = 0; i < n; i++) if (adaboostPredict({ stumps }, xs[i]) !== ys[i]) { trainErr++; ensembleWrong.push(i); }
      history.push({
        stump, weightsBefore, weights: w.slice(), err, alpha, wrong,
        trainErr: trainErr / n, ensembleWrong,
      });
      if (trainErr === 0) break;
    }
    return { stumps, history };
  }

  return {
    mulberry32, gaussian, CLUSTERS, MISLABELED, PROBE,
    makeDataset, makeNoisy, makeFresh, makeLine,
    countsOf, probs, gini, giniProbs, pickDisagreeProb, entropy, entropyProbs, impurity,
    splitStats, scanSplits, bestSplit, buildTree, predict, accuracy, trainAccuracy, majority,
    treeNodes, leafCount, treeDepth, layoutTree, partitionRects,
    bootstrap, outOfBagChance, trainForest, forestVote, forestAccuracy,
    stumpPredict, adaboostTrain1D, adaboostF, adaboostPredict,
  };
});
