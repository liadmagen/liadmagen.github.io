'use strict';
// Run with: node sg-math.test.js
const assert = require('assert');
const SGM = require('./sg-math.js');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || 'values differ') + ': ' + a + ' vs ' + b + ' (tol ' + tol + ')');
const P = SGM.PEOPLE;
const grp = (g) => P.group.map((v, i) => (v === g ? i : -1)).filter((i) => i >= 0);
const hs = (g) => grp(g).map((i) => P.height[i]);
const ws = (g) => grp(g).map((i) => P.weight[i]);
const RAW = SGM.runPeople('raw'), MM = SGM.runPeople('minmax'), Z = SGM.runPeople('zscore');
const CM = SGM.runPeople('raw', { height: 'cm' }), GR = SGM.runPeople('raw', { height: 'cm', weight: 'g' });

/* ------------------------------------------------------------------ helpers */
t('seeded random numbers are deterministic and well-behaved', () => {
  const a = SGM.makeRng(7), b = SGM.makeRng(7), c = SGM.makeRng(8);
  const xa = [a.uniform(), a.normal(), a.uniform()], xb = [b.uniform(), b.normal(), b.uniform()];
  assert.deepStrictEqual(xa, xb);
  assert.notStrictEqual(c.uniform(), xa[0]);
  const r = SGM.makeRng(1), draws = Array.from({ length: 4000 }, () => r.normal());
  near(SGM.mean(draws), 0, 0.06); near(SGM.std(draws), 1, 0.06);
  assert.ok(Array.from({ length: 500 }, () => r.uniform()).every((v) => v >= 0 && v < 1));
});

/* ------------------------------------------------------------------ part 1: people */
t('made-up people: 40 in two groups of 20, deterministic', () => {
  assert.strictEqual(P.n, 40);
  assert.strictEqual(grp(0).length, 20); assert.strictEqual(grp(1).length, 20);
  assert.deepStrictEqual(SGM.makePeople().height, P.height);
  assert.deepStrictEqual(SGM.makePeople().weight, P.weight);
  assert.ok(P.height.every((h) => h >= 1.5 && h <= 2.0)); assert.ok(P.weight.every((w) => w >= 46 && w <= 110));
});

t('the data is designed so the groups differ in height but not in weight', () => {
  /* heights: the two groups do not even touch */
  assert.ok(Math.max.apply(null, hs(0)) < Math.min.apply(null, hs(1)), 'no A person is as tall as the shortest B person');
  assert.ok(SGM.mean(hs(1)) - SGM.mean(hs(0)) > 0.15);
  assert.ok(SGM.std(hs(0)) < 0.05 && SGM.std(hs(1)) < 0.05);
  /* weights: means within a third of a standard deviation, and the ranges overlap almost entirely */
  const sdW = SGM.std(P.weight);
  assert.ok(Math.abs(SGM.mean(ws(0)) - SGM.mean(ws(1))) < sdW / 3, 'weights barely differ between the groups');
  const lo = Math.max(Math.min.apply(null, ws(0)), Math.min.apply(null, ws(1))), hi = Math.min(Math.max.apply(null, ws(0)), Math.max.apply(null, ws(1)));
  const rng = (a) => Math.max.apply(null, a) - Math.min.apply(null, a);
  assert.ok((hi - lo) / Math.min(rng(ws(0)), rng(ws(1))) > 0.8, 'weight ranges overlap by more than 80%');
});

/* ------------------------------------------------------------------ distance */
t('the instructor\'s example: gaps 0.10 m and 20 kg, squared 0.01 and 400', () => {
  const d = SGM.distanceShares([1.75, 85], [1.65, 65]);
  near(d.parts[0], 0.01, 1e-12); near(d.parts[1], 400, 1e-9);
  near(d.shares[1] * 100, 99.9975, 1e-4); near(d.shares[0] * 100, 0.0025, 1e-4);
  near(d.distance, Math.sqrt(400.01), 1e-12);
  near(d.shares[0] + d.shares[1], 1, 1e-12);
  near(SGM.euclid([0, 0], [3, 4]), 5, 1e-12);
});

t('the page contains a pair of people with exactly that example\'s gaps; and a close pair from different groups', () => {
  const cp = SGM.closestPair(P, 0.10, 20);
  near(Math.abs(P.height[cp.i] - P.height[cp.j]), 0.10, 1e-9); near(Math.abs(P.weight[cp.i] - P.weight[cp.j]), 20, 1e-9);
  const xg = SGM.closestAcrossGroups(P);
  assert.notStrictEqual(P.group[xg.i], P.group[xg.j]);
  assert.ok(Math.abs(P.height[xg.i] - P.height[xg.j]) > 0.15, 'a clear height gap');
  assert.ok(Math.sqrt(xg.d2) < 2, 'but they count as nearly the same person');
  const sh = SGM.distanceShares([P.height[xg.i], P.weight[xg.i]], [P.height[xg.j], P.weight[xg.j]]);
  assert.ok(sh.distance < SGM.distanceShares([P.height[cp.i], P.weight[cp.i]], [P.height[cp.j], P.weight[cp.j]]).distance);
});

/* ------------------------------------------------------------------ scaling */
t('min-max maps the training range to 0..1; z-score gives mean 0 and spread 1', () => {
  const rows = SGM.features(P), mm = SGM.fitMinMax(rows), z = SGM.fitStandard(rows);
  const A = rows.map(mm.apply), B = rows.map(z.apply);
  [0, 1].forEach((k) => {
    near(Math.min.apply(null, A.map((r) => r[k])), 0, 1e-12); near(Math.max.apply(null, A.map((r) => r[k])), 1, 1e-12);
    near(SGM.mean(B.map((r) => r[k])), 0, 1e-12); near(SGM.std(B.map((r) => r[k])), 1, 1e-12);
  });
  near(mm.apply([1.75, 85])[0], (1.75 - mm.min[0]) / (mm.max[0] - mm.min[0]), 1e-12);
  near(z.apply([1.75, 85])[1], (85 - z.mean[1]) / z.std[1], 1e-12);
});

t('scalers are fitted on training rows and applied unchanged to new rows', () => {
  const rows = SGM.features(P), mm = SGM.fitMinMax(rows), z = SGM.fitStandard(rows);
  const far = mm.apply([2.5, 200]);
  assert.ok(far[0] > 1 && far[1] > 1, 'a new, more extreme person lands outside 0..1; the training min and max are not recomputed');
  const again = SGM.fitMinMax(rows);
  assert.deepStrictEqual(mm.apply([1.7, 70]), again.apply([1.7, 70]));
  assert.strictEqual(SGM.fitMinMax([[1, 5], [1, 7]]).apply([1, 6])[0], 0, 'a constant feature does not divide by zero');
  assert.strictEqual(SGM.fitStandard([[1, 5], [1, 7]]).apply([1, 6])[0], 0);
  assert.ok(z.apply([2.5, 200])[0] > 3);
});

/* ------------------------------------------------------------------ k-means */
t('k-means on a tiny hand-made example', () => {
  const rows = [[0, 0], [0, 1], [1, 0], [10, 10], [10, 11], [11, 10]];
  const km = SGM.kmeans(rows, [0, 3]);
  assert.deepStrictEqual(km.assign, [0, 0, 0, 1, 1, 1]);
  near(km.centres[0][0], 1 / 3, 1e-12); near(km.centres[1][1], 10 + 1 / 3, 1e-12);
  assert.ok(km.iterations >= 2 && km.iterations <= 4);
  assert.strictEqual(km.steps[0].assign, null);
});

t('k-means: the total squared distance never increases from round to round, and the last round changes nothing', () => {
  [RAW, MM, Z, CM].forEach((run) => {
    let prev = Infinity;
    run.steps.forEach((s) => {
      if (!s.assign) return;
      const inertia = SGM.sum(run.rows.map((r, i) => SGM.sqDist(r, s.centres[s.assign[i]])));
      assert.ok(inertia <= prev + 1e-9); prev = inertia;
    });
    const last = run.steps[run.steps.length - 1], before = run.steps[run.steps.length - 2];
    assert.deepStrictEqual(last.assign, before.assign);
  });
});

t('every run starts from the same two people, so the comparison is fair', () => {
  [RAW, MM, Z, CM, GR].forEach((run) => {
    /* steps[0].centres are the two starting people (in that run's own scaling), listed in aligned cluster order */
    const starts = SGM.INIT.map((i) => run.rows[i]);
    const found = run.steps[0].centres.map((c) => starts.findIndex((s) => s[0] === c[0] && s[1] === c[1]));
    assert.ok(found.every((f) => f >= 0));
    assert.strictEqual(new Set(found).size, 2);
  });
});

t('agreement is the best match over relabellings of the clusters', () => {
  assert.strictEqual(SGM.agreement([0, 0, 1, 1], [1, 1, 0, 0]), 1);
  assert.strictEqual(SGM.agreement([0, 1, 0, 1], [0, 0, 1, 1]), 0.5);
  assert.strictEqual(SGM.agreement([0, 0, 0, 1], [0, 0, 1, 1]), 0.75);
  const bm = SGM.bestMatch([1, 1, 0], [0, 0, 1]);
  assert.deepStrictEqual(bm.aligned, [0, 0, 1]);
});

/* ------------------------------------------------------------------ the story */
t('STORY 1: on metres and kilograms k-means does little better than a coin', () => {
  assert.ok(RAW.agreement <= 0.6, 'raw agreement ' + RAW.agreement);
  assert.ok(RAW.agreement >= 0.5);
  assert.ok(RAW.wrong.length >= 16, 'a large share of people are in the wrong group');
});

t('STORY 1b: those clusters are a split by weight (a plain weight cut reproduces them), not by height', () => {
  assert.ok(SGM.weightCutAgreement(RAW.assign) >= 0.95);
  const c0 = RAW.centres[0], c1 = RAW.centres[1];
  assert.ok(Math.abs(c0[1] - c1[1]) > 10, 'centres are more than 10 kg apart');
  assert.ok(Math.abs(c0[0] - c1[0]) < 0.05, 'and less than 5 cm apart');
  /* ... while the true groups are 20 cm apart */
  assert.ok(SGM.mean(hs(1)) - SGM.mean(hs(0)) > 0.18);
});

t('STORY 2: after min-max normalization or standardization k-means recovers the true groups', () => {
  assert.ok(MM.agreement >= 0.95, 'min-max ' + MM.agreement);
  assert.ok(Z.agreement >= 0.95, 'z-score ' + Z.agreement);
  assert.strictEqual(MM.wrong.length, 0); assert.strictEqual(Z.wrong.length, 0);
  /* the two scaled runs find the same partition */
  assert.deepStrictEqual(MM.assign, Z.assign);
  /* and now the split is a split by height */
  assert.ok(Math.max.apply(null, hs(0)) < Math.min.apply(null, hs(1)));
  const cut = SGM.agreement(P.height.map((h) => (h > 1.735 ? 1 : 0)), Z.assign);
  assert.strictEqual(cut, 1);
});

t('STORY 3: the unit matters. Height in centimetres gives different clusters from height in metres', () => {
  assert.notDeepStrictEqual(CM.assign, RAW.assign);
  assert.ok(CM.agreement >= 0.95, 'cm ' + CM.agreement);
  assert.ok(RAW.agreement <= 0.6);
  /* the distance example, in the other unit */
  const d = SGM.distanceShares([175, 85], [165, 65]);
  near(d.parts[0], 100, 1e-9); near(d.parts[1], 400, 1e-9);
  /* weight in grams breaks it again: nothing is safe unless features are scaled */
  assert.ok(GR.agreement <= 0.6, 'grams ' + GR.agreement);
  assert.deepStrictEqual(GR.assign, RAW.assign);
});

t('STORY 4: a new person is scaled with the TRAINING numbers, then goes to the nearest centre', () => {
  const np = SGM.NEW_PERSON;
  const inRaw = SGM.assignNew(np, RAW), inZ = SGM.assignNew(np, Z), inMM = SGM.assignNew(np, MM);
  assert.strictEqual(inZ.cluster, np.group, 'z-scores: the tall newcomer joins the B side');
  assert.strictEqual(inMM.cluster, np.group);
  assert.notStrictEqual(inRaw.cluster, np.group, 'raw: the newcomer is judged by weight alone and joins the wrong side');
  /* the scaled coordinates use the training mean and std, not the newcomer's */
  near(inZ.row[0], (np.height - Z.scaler.mean[0]) / Z.scaler.std[0], 1e-12);
});

t('STORY 5: one extreme value squeezes everybody else, min-max more than z-score', () => {
  const mm = SGM.outlierSqueeze('minmax'), z = SGM.outlierSqueeze('zscore');
  assert.ok(mm.ratio < 0.35, 'min-max keeps ' + mm.ratio);
  assert.ok(z.ratio < 0.6 && z.ratio > mm.ratio, 'z-score keeps ' + z.ratio);
  near(mm.outlierValue, 1, 1e-12);
  assert.ok(z.outlierValue > 4);
  near(mm.before, SGM.std(SGM.features(P).map((r) => mm.scalerBase.apply(r)[1])), 1e-12);
  near(z.before, 1, 1e-9);
});

/* ------------------------------------------------------------------ part 2: algebra */
t('least squares by QR recovers an exact line, and also a nearly-singular problem', () => {
  const A = [[1, 0], [1, 1], [1, 2], [1, 3]], b = [1, 3, 5, 7];
  const x = SGM.lstsq(A, b);
  near(x[0], 1, 1e-10); near(x[1], 2, 1e-10);
  const B = [[1, 1], [1, 1 + 1e-9], [1, 1 - 1e-9], [1, 1]];
  assert.ok(SGM.lstsq(B, [1, 1, 1, 1]).every(Number.isFinite));
});

t('ridge with lambda 0 is ordinary least squares; the intercept is never penalized', () => {
  const X = [[-1.5], [-0.5], [0.5], [1.5]], y = [10, 14, 18, 22]; /* y = 16 + 4 x */
  const f0 = SGM.ridgeFit(X, y, 0);
  near(f0.b0, 16, 1e-10); near(f0.w[0], 4, 1e-10);
  /* closed form for one standardized-style column: w = (X'y/n) / (mean(x^2) + lambda) */
  const lam = 0.5, f = SGM.ridgeFit(X, y, lam), sxx = SGM.mean(X.map((r) => r[0] * r[0])), sxy = SGM.mean(X.map((r, i) => r[0] * y[i]));
  near(f.w[0], sxy / (sxx + lam), 1e-10); near(f.b0, 16, 1e-10);
});

t('soft-thresholding, and lasso against its closed form on an orthogonal problem', () => {
  assert.strictEqual(SGM.soft(3, 1), 2); assert.strictEqual(SGM.soft(-3, 1), -2);
  assert.strictEqual(SGM.soft(0.5, 1), 0); assert.strictEqual(SGM.soft(-1, 1), 0);
  /* two orthogonal columns, each with mean 0 and mean square 1: w_j = soft(rho_j, lambda / 2) */
  const X = [[1, 1], [1, -1], [-1, 1], [-1, -1]], y = [5, 1, -1, -5]; /* rho = (3, 2) after centring */
  const rho = [0, 1].map((j) => SGM.mean(X.map((r, i) => r[j] * y[i])));
  [0.5, 3, 4.5, 7].forEach((lam) => {
    const f = SGM.lassoFit(X, y, lam);
    near(f.w[0], SGM.soft(rho[0], lam / 2), 1e-9); near(f.w[1], SGM.soft(rho[1], lam / 2), 1e-9);
  });
  /* enough penalty and every coefficient is exactly zero */
  assert.deepStrictEqual(SGM.lassoFit(X, y, 100).w, [0, 0]);
  assert.ok(Object.is(SGM.lassoFit(X, y, 100).w[0], 0));
});

/* ------------------------------------------------------------------ part 2: generalization */
const D = SGM.ESSAYS;
const DEG = SGM.degreeSweep(D.train, D.test, 12);

t('essays: 15 training and 40 fresh test essays, deterministic, spread over 6..27 words', () => {
  assert.strictEqual(D.train.x.length, 15); assert.strictEqual(D.test.x.length, 40);
  assert.deepStrictEqual(SGM.makeEssays().train, D.train); assert.deepStrictEqual(SGM.makeEssays().test, D.test);
  assert.ok(D.train.x.concat(D.test.x).every((x) => x >= 6 && x <= 27));
  assert.ok(D.train.y.concat(D.test.y).every((y) => y >= 0 && y <= 100));
  assert.notDeepStrictEqual(D.train.x, D.test.x.slice(0, 15));
});

t('degree sweep: training error never goes up as the degree grows', () => {
  assert.strictEqual(DEG.length, 12);
  for (let i = 1; i < 12; i++) assert.ok(DEG[i].train <= DEG[i - 1].train * (1 + 1e-9) + 1e-9, 'degree ' + (i + 1));
  assert.ok(DEG[11].train < 3, 'degree 12 nearly memorises 15 essays: ' + DEG[11].train);
  assert.ok(DEG[0].train > 5 * DEG[11].train);
});

t('degree sweep: test error is U-shaped, with its minimum strictly inside the range', () => {
  const te = DEG.map((r) => r.test), best = te.indexOf(Math.min.apply(null, te));
  assert.ok(best >= 1 && best <= 9, 'best degree ' + (best + 1));
  assert.ok(te[0] > 1.3 * te[best], 'a straight line underfits');
  assert.ok(te[11] > 20 * te[best], 'degree 12 overfits badly: ' + te[11] + ' vs ' + te[best]);
  assert.ok(te[11] > te[8] && te[8] > te[best]);
  assert.ok(DEG[best].train > DEG[11].train, 'the best model on new data is not the best on training data');
  assert.ok(DEG[best].degree >= 2 && DEG[best].degree <= 5);
});

/* ------------------------------------------------------------------ part 2: L2 and L1 */
const RS = SGM.lambdaSweep(D.train, D.test, 12, 'l2'), LS = SGM.lambdaSweep(D.train, D.test, 12, 'l1');
const bestDeg = SGM.bestIndex(DEG);

t('lambda grid starts at 0 and grows on a log scale', () => {
  assert.strictEqual(SGM.LAMBDAS[0], 0);
  for (let i = 2; i < SGM.LAMBDAS.length; i++) near(SGM.LAMBDAS[i] / SGM.LAMBDAS[i - 1], SGM.LAMBDAS[2] / SGM.LAMBDAS[1], 1e-9);
  assert.strictEqual(RS.length, SGM.LAMBDAS.length); assert.strictEqual(LS.length, SGM.LAMBDAS.length);
});

t('ridge (L2): the coefficients shrink steadily as lambda grows, and none is ever exactly zero', () => {
  for (let i = 1; i < RS.length; i++) assert.ok(RS[i].l2 <= RS[i - 1].l2 * (1 + 1e-9), 'sum of squares at ' + i);
  assert.ok(RS.every((r) => r.zeros === 0), 'no exact zeros');
  assert.ok(RS.every((r) => r.w.every((v) => v !== 0)));
  assert.ok(Math.sqrt(RS[0].l2) > 1000 && Math.sqrt(RS[RS.length - 1].l2) < 1);
  /* the price: training error only goes up */
  for (let i = 1; i < RS.length; i++) assert.ok(RS[i].train >= RS[i - 1].train - 1e-6, 'training error at ' + i);
});

t('ridge (L2): the lambda sweep has an interior best test error, close to the best polynomial degree', () => {
  const te = RS.map((r) => r.test), b = SGM.bestIndex(RS);
  assert.ok(b > 1 && b < RS.length - 2, 'best lambda index ' + b);
  assert.ok(te[b] < te[0] / 20, 'penalty cures the memorising: ' + te[0] + ' -> ' + te[b]);
  assert.ok(te[b] < 2 * DEG[bestDeg].test, 'ridge at degree 12 gets within a factor 2 of the best polynomial degree');
  assert.ok(te[te.length - 1] > 5 * te[b], 'too much penalty underfits');
  assert.ok(te[te.length - 1] > te[Math.floor(te.length * 0.8)] && te[Math.floor(te.length * 0.8)] > te[b]);
});

t('lasso (L1): satisfies its optimality conditions (KKT) at every lambda', () => {
  const sc = SGM.polyScaler(D.train.x, 12), X = D.train.x.map(sc.row), n = X.length, ym = SGM.mean(D.train.y);
  assert.ok(LS.every((r) => r.model.zeros >= 0));
  LS.forEach((row, idx) => {
    if (idx === 0) return;
    const lam = row.lambda, w = row.w;
    const res = D.train.y.map((y, i) => y - ym - SGM.sum(X[i].map((v, j) => v * w[j])));
    w.forEach((wj, j) => {
      const g = (2 / n) * SGM.sum(res.map((r, i) => r * X[i][j]));
      if (wj !== 0) near(g, lam * Math.sign(wj), 1e-4 + 1e-6 * lam, 'active coefficient ' + j + ' at lambda ' + lam);
      else assert.ok(Math.abs(g) <= lam * (1 + 1e-6) + 1e-4, 'zero coefficient ' + j + ' at lambda ' + lam + ' has gradient ' + g);
    });
  });
});

t('lasso (L1): exact zeros appear, and there are more of them as lambda grows', () => {
  assert.strictEqual(LS[0].zeros, 0);
  for (let i = 1; i < LS.length; i++) assert.ok(LS[i].zeros >= LS[i - 1].zeros, 'zeros do not come back at ' + i);
  assert.strictEqual(LS[LS.length - 1].zeros, 12, 'enough penalty switches everything off');
  const mid = LS[SGM.bestIndex(LS)];
  assert.ok(mid.zeros >= 4 && mid.zeros <= 11, 'at the best lambda some, not all, coefficients are zero: ' + mid.zeros);
  assert.ok(mid.w.some((v) => Object.is(v, 0)));
  for (let i = 1; i < LS.length; i++) assert.ok(LS[i].l1 <= LS[i - 1].l1 + 1e-6, 'sum of absolute values never grows');
  assert.ok(LS.some((r) => r.zeros > 0 && r.zeros < 12));
});

t('lasso (L1): interior best test error, far better than memorising; ridge never switches anything off', () => {
  const te = LS.map((r) => r.test), b = SGM.bestIndex(LS);
  assert.ok(b > 1 && b < LS.length - 2, 'best lambda index ' + b);
  assert.ok(te[b] < te[0] / 20);
  assert.ok(te[b] < 1.5 * DEG[bestDeg].test);
  assert.ok(te[te.length - 1] > 5 * te[b]);
  assert.ok(LS[b].zeros > RS[SGM.bestIndex(RS)].zeros);
});

t('lasso results do not depend on the starting point', () => {
  const sc = SGM.polyScaler(D.train.x, 12), X = D.train.x.map(sc.row);
  const a = SGM.lassoFit(X, D.train.y, 0.3), b = SGM.lassoFit(X, D.train.y, 0.3, LS[10].w);
  a.w.forEach((v, j) => near(v, b.w[j], 1e-6));
});

/* ------------------------------------------------------------------ chapter 8: units */
t('ridge without scaling punishes a feature by its units; standardizing removes that', () => {
  const lam = 0.25;
  const frac = SGM.unitsRidge(lam, 1, false), pct = SGM.unitsRidge(lam, 100, false), std = SGM.unitsRidge(lam, 1, true), std2 = SGM.unitsRidge(lam, 100, true);
  assert.ok(frac.kept[1] < 0.05, 'a fraction: its coefficient is huge, so it is crushed: ' + frac.kept[1]);
  assert.ok(pct.kept[1] > 0.95, 'the same information as a percent is barely touched: ' + pct.kept[1]);
  assert.ok(frac.kept[0] > 0.95 && pct.kept[0] > 0.95);
  near(frac.w0[1], 100 * pct.w0[1], 1e-6 * Math.abs(frac.w0[1])); /* same model, coefficient 100 times larger */
  near(std.kept[0], 1 / (1 + lam), 1e-3); near(std.kept[1], 1 / (1 + lam), 1e-3);
  near(std.kept[1], std2.kept[1], 1e-9); near(std.w[1], std2.w[1], 1e-9);
  const d = SGM.UNITS_DATA, mx = SGM.mean(d.length), mr = SGM.mean(d.rare);
  near(SGM.sum(d.length.map((v, i) => (v - mx) * (d.rare[i] - mr))) / d.n, 0, 1e-3, 'the two features are uncorrelated by design');
  SGM.UNITS_LAMBDAS.forEach((l) => SGM.unitsRidge(l, 1, false).kept.concat(SGM.unitsRidge(l, 1, true).kept).forEach((k) => assert.ok(k >= 0 && k <= 1 + 1e-9)));
});

/* ------------------------------------------------------------------ chapter 7 (optional): corners */
t('toy problem: the L1 solution lands exactly on an axis, the L2 solution never does', () => {
  const l1 = SGM.TOY_LAMBDAS.map((l) => SGM.toySolve('l1', l)), l2 = SGM.TOY_LAMBDAS.map((l) => SGM.toySolve('l2', l));
  assert.deepStrictEqual(l1[0], SGM.TOY.star); assert.deepStrictEqual(l2[0], SGM.TOY.star);
  assert.ok(l1.some((w) => w[1] === 0 && w[0] > 0), 'L1 reaches w2 = 0 with w1 still alive');
  assert.ok(l2.every((w) => w[0] !== 0 && w[1] !== 0));
  for (let i = 1; i < l1.length; i++) {
    assert.ok(Math.abs(l1[i][0]) + Math.abs(l1[i][1]) <= Math.abs(l1[i - 1][0]) + Math.abs(l1[i - 1][1]) + 1e-9);
    assert.ok(SGM.toyLoss(l1[i]) >= SGM.toyLoss(l1[i - 1]) - 1e-9 && SGM.toyLoss(l2[i]) >= SGM.toyLoss(l2[i - 1]) - 1e-9);
  }
});

/* ------------------------------------------------------------------ determinism */
t('everything is deterministic', () => {
  assert.deepStrictEqual(SGM.runPeople('zscore').assign, Z.assign);
  assert.deepStrictEqual(SGM.runPeople('raw').steps, RAW.steps);
  const RS2 = SGM.lambdaSweep(D.train, D.test, 12, 'l2');
  assert.deepStrictEqual(RS2.map((r) => r.test), RS.map((r) => r.test));
  assert.deepStrictEqual(SGM.lambdaSweep(D.train, D.test, 12, 'l1').map((r) => r.w), LS.map((r) => r.w));
});

console.log('\nAll ' + passed + ' tests passed.');
