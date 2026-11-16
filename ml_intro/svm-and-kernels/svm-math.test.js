'use strict';
// Run with: node svm-math.test.js
const assert = require('assert');
const M = require('./svm-math.js');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || 'values differ') + ': ' + a + ' vs ' + b + ' (tol ' + tol + ')');
const D = M.DATA;
const SEP = D.separable, OVL = D.overlap, RING = D.rings, MOON = D.moons;
const HARD = M.fit(SEP.X, SEP.y, M.HARD);
const count = (a, v) => a.filter((x) => x === v).length;

/* ------------------------------------------------------------------ helpers and data */
t('seeded random numbers are deterministic and well-behaved', () => {
  const a = M.makeRng(7), b = M.makeRng(7), c = M.makeRng(8);
  const xa = [a.uniform(), a.normal(), a.uniform()], xb = [b.uniform(), b.normal(), b.uniform()];
  assert.deepStrictEqual(xa, xb);
  assert.notStrictEqual(c.uniform(), xa[0]);
  const r = M.makeRng(1), draws = Array.from({ length: 4000 }, () => r.normal());
  near(M.mean(draws), 0, 0.06); near(Math.sqrt(M.variance(draws)), 1, 0.06);
});

t('made-up data sets: balanced, two labels, deterministic, with 200 fresh points each', () => {
  const sizes = { separable: 20, overlap: 30, rings: 40, moons: 40 };
  Object.keys(sizes).forEach((k) => {
    const d = D[k];
    assert.strictEqual(d.n, sizes[k], k);
    assert.strictEqual(d.X.length, d.n); assert.strictEqual(d.y.length, d.n);
    assert.strictEqual(count(d.y, 1), d.n / 2); assert.strictEqual(count(d.y, -1), d.n / 2);
    assert.ok(d.X.every((p) => p.length === 2 && p.every((v) => Number.isFinite(v))));
    assert.strictEqual(d.fresh.n, M.FRESH_N);
    assert.strictEqual(count(d.fresh.y, 1), M.FRESH_N / 2);
    const again = M.SPEC[k].make(M.SPEC[k].n, M.SPEC[k].seed);
    assert.deepStrictEqual(again.X, d.X);
    assert.notDeepStrictEqual(d.fresh.X.slice(0, 5), d.X.slice(0, 5), 'fresh points are new points');
  });
});

/* ------------------------------------------------------------------ the widest street (chapters 1 and 2) */
t('separable groups: the SVM gets every training point right and every fresh point right', () => {
  assert.strictEqual(HARD.converged, true);
  assert.strictEqual(HARD.accuracy(SEP.X, SEP.y), 1);
  assert.strictEqual(HARD.accuracy(SEP.fresh.X, SEP.fresh.y), 1);
  assert.ok(HARD.margin > 1.5 && HARD.margin < 3, 'a clearly visible street: ' + HARD.margin);
});

t('the street is 2/|w| wide, and it is the widest street of any straight line (brute force over directions)', () => {
  near(HARD.margin, 2 / Math.hypot(HARD.w[0], HARD.w[1]), 1e-12);
  const ws = M.widestStreet(SEP);
  near(HARD.margin, ws.gap, 5e-3, 'SVM margin equals the widest gap found by brute force');
  near(Math.atan2(HARD.w[1], HARD.w[0]), ws.t, 0.01, 'same direction');
  /* every other direction that separates has a narrower street */
  for (let k = 0; k < 360; k++) {
    const s = M.streetAt(SEP, (k / 360) * 2 * Math.PI);
    assert.ok(s.gap <= HARD.margin + 1e-3, 'direction ' + k + ' has gap ' + s.gap);
  }
  /* and the centre line sits halfway: b matches the brute-force offset */
  const w = HARD.w, nrm = Math.hypot(w[0], w[1]);
  near(-HARD.b / nrm, ws.offset, 5e-3, 'the centre line is halfway across the street');
});

t('margin matches geometry: support vectors sit exactly half a street from the line, nobody is closer', () => {
  const nrm = HARD.norm;
  HARD.sv.forEach((i) => {
    near(Math.abs(HARD.decision(SEP.X[i])), 1, 2e-3, 'on the edge of the street: |f| = 1');
    near(Math.abs(HARD.decision(SEP.X[i])) / nrm, HARD.margin / 2, 2e-3, 'distance to the line = half the street');
  });
  SEP.X.forEach((x, i) => assert.ok(SEP.y[i] * HARD.decision(x) >= 1 - 2e-3, 'nobody is inside the street'));
  assert.ok(HARD.sv.some((i) => SEP.y[i] === 1) && HARD.sv.some((i) => SEP.y[i] === -1), 'both groups have a support vector');
  assert.ok(HARD.nSV >= 2 && HARD.nSV <= 5, 'only a few support vectors: ' + HARD.nSV);
});

t('all non-support-vector alphas are exactly 0, alphas respect the bounds, and sum(alpha * y) = 0', () => {
  HARD.alpha.forEach((a, i) => { if (HARD.sv.indexOf(i) < 0) assert.strictEqual(a, 0); else assert.ok(a > 0); });
  near(M.sum(HARD.alpha.map((a, i) => a * SEP.y[i])), 0, 1e-9);
  const w = [0, 1].map((d) => M.sum(HARD.alpha.map((a, i) => a * SEP.y[i] * SEP.X[i][d])));
  near(w[0], HARD.w[0], 1e-12); near(w[1], HARD.w[1], 1e-12);
});

/* the optimality (KKT) conditions: alpha = 0 -> y f >= 1; 0 < alpha < C -> y f = 1; alpha = C -> y f <= 1 */
function kkt(m, d, tol) {
  m.alpha.forEach((a, i) => {
    const yf = d.y[i] * m.decision(d.X[i]);
    if (a <= 1e-8) assert.ok(yf >= 1 - tol, 'alpha 0 but y f = ' + yf);
    else if (a >= m.C - 1e-8) assert.ok(yf <= 1 + tol, 'alpha C but y f = ' + yf);
    else near(yf, 1, tol, 'free support vector must sit on the street edge');
    assert.ok(a >= -1e-12 && a <= m.C + 1e-9);
  });
  near(M.sum(m.alpha.map((a, i) => a * d.y[i])), 0, 1e-8);
}
t('KKT conditions hold within tolerance: hard margin, every C, and with kernels', () => {
  kkt(HARD, SEP, 5e-3);
  M.C_VALUES.forEach((C) => kkt(M.fit(OVL.X, OVL.y, { kernel: M.LINEAR, C: C }), OVL, 5e-3));
  [M.KERNELS.poly2, M.KERNELS.poly3, M.KERNELS.rbf, M.rbf(20)].forEach((k) => kkt(M.fit(RING.X, RING.y, { kernel: k, C: 1 }), RING, 5e-3));
  [M.KERNELS.poly3, M.KERNELS.rbf, M.rbf(20)].forEach((k) => kkt(M.fit(MOON.X, MOON.y, { kernel: k, C: 1 }), MOON, 5e-3));
});

t('removing a point that is not a support vector changes nothing; removing a support vector does', () => {
  const tight = { kernel: M.LINEAR, C: M.HARD_C, eps: 1e-9 }, ref = M.fit(SEP.X, SEP.y, tight);
  const keep = (i) => ({ X: SEP.X.filter((_, k) => k !== i), y: SEP.y.filter((_, k) => k !== i) });
  const farAway = SEP.X.map((_, i) => i).filter((i) => HARD.sv.indexOf(i) < 0);
  assert.ok(farAway.length >= 15);
  farAway.forEach((i) => {
    const s = keep(i), m = M.fit(s.X, s.y, tight);
    near(m.margin, ref.margin, 1e-6); near(m.w[0], ref.w[0], 1e-6); near(m.w[1], ref.w[1], 1e-6); near(m.b, ref.b, 1e-6);
    assert.strictEqual(m.nSV, ref.nSV);
  });
  let changed = 0;
  HARD.sv.forEach((i) => {
    const s = keep(i), m = M.fit(s.X, s.y, tight);
    if (Math.abs(m.margin - ref.margin) > 0.05) changed++;
  });
  assert.ok(changed >= 1, 'removing a support vector widens the street');
  /* moving a support vector toward the street narrows it; nudging a far-away point (away from the street) does nothing */
  const sv0 = HARD.sv[0], X2 = SEP.X.map((p) => p.slice());
  X2[sv0] = [X2[sv0][0] - 0.3 * HARD.w[0] * SEP.y[sv0] / HARD.norm, X2[sv0][1] - 0.3 * HARD.w[1] * SEP.y[sv0] / HARD.norm];
  assert.ok(M.fit(X2, SEP.y, tight).margin < ref.margin - 0.05, 'moving a support vector moves the street');
  const far = farAway[0], X3 = SEP.X.map((p) => p.slice());
  X3[far] = [X3[far][0] + 0.2 * HARD.w[0] * SEP.y[far], X3[far][1] + 0.2 * HARD.w[1] * SEP.y[far]];
  near(M.fit(X3, SEP.y, tight).margin, ref.margin, 1e-6);
});

t('the chapter 2 demos: the farthest non-support dot can go; a support vector slid toward the street narrows it, and the groups stay separable', () => {
  const far = M.farthestNonSV(HARD, SEP);
  assert.ok(far >= 0 && HARD.sv.indexOf(far) < 0);
  const dists = SEP.X.map((x, i) => (HARD.sv.indexOf(i) < 0 ? Math.abs(HARD.decision(x)) : -1));
  assert.strictEqual(dists[far], Math.max.apply(null, dists));
  const sv = HARD.sv.find((i) => SEP.y[i] === 1), X2 = M.moveTowardStreet(SEP, HARD, sv, M.MOVE_BY);
  const moved = M.fit(X2, SEP.y, M.HARD);
  assert.strictEqual(moved.accuracy(X2, SEP.y), 1, 'still separable');
  assert.ok(moved.margin < HARD.margin - 0.2, 'narrower: ' + moved.margin + ' vs ' + HARD.margin);
  near(Math.abs(HARD.decision(SEP.X[sv])) / HARD.norm - Math.abs(HARD.decision(X2[sv])) / HARD.norm, M.MOVE_BY, 1e-3, 'moved by exactly MOVE_BY');
  assert.ok(Math.abs(moved.w[1] / moved.w[0] - HARD.w[1] / HARD.w[0]) > 0.01, 'and the street turns');
});

t('candidate lines all separate the training groups, but their streets are narrower and they do worse on fresh points', () => {
  const ws = M.widestStreet(SEP), cands = M.candidateLines(SEP, ws);
  assert.strictEqual(cands.length, 4);
  const svmFresh = M.lineAccuracy(ws.t, ws.offset, SEP.fresh);
  assert.strictEqual(svmFresh, 1);
  near(M.lineMargin(SEP, ws.t, ws.offset), ws.gap, 1e-9, 'a centred line has the whole gap as its street');
  cands.forEach((c) => {
    assert.strictEqual(M.lineAccuracy(c.t, c.offset, SEP), 1, 'every candidate is 100% right on the training points');
    assert.ok(c.gap < HARD.margin - 0.3, 'narrower street: ' + c.gap);
    assert.ok(c.margin > 0 && c.margin <= c.gap + 1e-9 && c.margin < HARD.margin - 0.3, 'the line\'s own street is narrower still: ' + c.margin);
    assert.ok(M.lineAccuracy(c.t, c.offset, SEP.fresh) < svmFresh, 'worse on fresh points');
  });
  assert.ok(new Set(cands.map((c) => c.t.toFixed(3))).size === 4, 'four different directions');
});

/* ------------------------------------------------------------------ soft margin: C (chapter 3) */
t('overlapping groups: no street can be clean, and C trades width for mistakes', () => {
  const sw = M.softSweep('overlap');
  const hardish = M.fit(OVL.X, OVL.y, M.HARD);
  assert.ok(hardish.accuracy(OVL.X, OVL.y) < 1 || hardish.atBound.length > 0, 'the groups overlap: some point must break the rules');
  for (let i = 1; i < sw.length; i++) assert.ok(sw[i].margin <= sw[i - 1].margin + 0.02, 'a bigger C never widens the street (C index ' + i + ')');
  const small = sw[0], big = sw[sw.length - 1];
  assert.ok(small.margin > 4 * big.margin, 'smaller C: much wider street: ' + small.margin + ' vs ' + big.margin);
  assert.ok(small.nSV > 3 * big.nSV, 'smaller C: more support vectors: ' + small.nSV + ' vs ' + big.nSV);
  assert.ok(small.errors.length > big.errors.length, 'smaller C tolerates more mistakes: ' + small.errors.length + ' vs ' + big.errors.length);
  assert.ok(small.nSV >= 0.9 * OVL.n, 'with the smallest C nearly everybody is a support vector');
  /* sklearn's default C = 1 sits in the middle, and is within a point of the best accuracy on fresh points */
  const iBest = M.bestIndexBy(sw, (r) => r.fresh), c1 = sw[M.C_VALUES.indexOf(1)];
  assert.ok(sw[iBest].fresh - c1.fresh <= 0.01 + 1e-9, 'C = 1 is nearly as good as any on fresh points');
  assert.ok(iBest > 3 && iBest < sw.length - 3, 'the best C is in the middle of the range');
  assert.ok(c1.fresh > small.fresh && c1.fresh > big.fresh, 'both extremes are worse on fresh points');
  assert.ok(c1.margin < small.margin && c1.margin > big.margin);
});

t('support vectors that are alpha = C are exactly the points that break the street rules', () => {
  const r = M.softRun(1, 'overlap'), m = r.model;
  m.sv.forEach((i) => {
    const yf = OVL.y[i] * m.decision(OVL.X[i]), atC = m.alpha[i] >= m.C - 1e-8;
    if (atC) assert.ok(yf <= 1 + 5e-3); else near(yf, 1, 5e-3);
  });
  m.atBound.forEach((i) => assert.ok(OVL.y[i] * m.decision(OVL.X[i]) <= 1 + 5e-3));
  r.errors.forEach((i) => assert.ok(m.atBound.indexOf(i) >= 0, 'a misclassified point always has alpha = C'));
});

/* ------------------------------------------------------------------ rings: no straight line (chapter 4) */
t('rings: a straight line is near chance, even the best of 360 directions and every threshold', () => {
  const lin = M.fit(RING.X, RING.y, { kernel: M.LINEAR, C: 1 });
  assert.ok(lin.accuracy(RING.X, RING.y) <= 0.7, 'linear SVM on the rings: ' + lin.accuracy(RING.X, RING.y));
  assert.ok(lin.accuracy(RING.fresh.X, RING.fresh.y) <= 0.7);
  const best = M.bestLine(RING);
  assert.ok(best.acc <= 0.8, 'best line of all: ' + best.acc);
  assert.strictEqual(best.n, RING.n); assert.strictEqual(best.correct, Math.round(best.acc * RING.n));
  assert.ok(best.acc >= 0.5);
  assert.ok(M.lineAtAngle(RING, 1.0).acc <= best.acc + 1e-12);
  /* the same is true of the brute-force line on fresh points */
  assert.ok(M.lineAccuracy(best.t, best.offset, RING.fresh) <= 0.75);
});

/* ------------------------------------------------------------------ the lift (chapter 5) */
t('lift: z = x1^2 + x2^2 and a flat sheet z = c separates the rings, with room to spare', () => {
  const p = M.liftPlane(RING);
  assert.strictEqual(p.separates, true);
  assert.ok(p.gap > 1 && p.c > p.maxA && p.c < p.minB);
  RING.X.forEach((x, i) => {
    const z = M.lift(x)[2];
    near(z, x[0] * x[0] + x[1] * x[1], 1e-12);
    assert.strictEqual(z < p.c ? 1 : -1, RING.y[i], 'the sheet puts every point on the right side');
  });
  /* the same sheet works on fresh points almost perfectly */
  const ok = RING.fresh.X.filter((x, i) => (M.lift(x)[2] < p.c ? 1 : -1) === RING.fresh.y[i]).length;
  assert.ok(ok / M.FRESH_N >= 0.99, 'fresh points: ' + ok / M.FRESH_N);
  /* the sheet cuts the bowl in a circle of radius sqrt(c), which falls between the inner cluster and the ring */
  near(p.radius * p.radius, p.c, 1e-12);
  assert.ok(p.radiusA < p.radius && p.radius < p.radiusB);
  /* a linear SVM in the lifted 3-D space gets everything right: the lift is what makes a line enough */
  const L = RING.X.map(M.lift), m3 = M.fit(L, RING.y, { kernel: M.LINEAR, C: M.HARD_C });
  assert.strictEqual(m3.accuracy(L, RING.y), 1);
  assert.ok(Math.abs(m3.w[2]) > 4 * Math.abs(m3.w[0]) && Math.abs(m3.w[2]) > 4 * Math.abs(m3.w[1]), 'the plane is nearly flat (mostly a z threshold)');
  assert.ok(m3.accuracy(RING.fresh.X.map(M.lift), RING.fresh.y) >= 0.99);
  /* the three numbers of a lifted point: height 0 before the lift, x1^2 + x2^2 after */
  assert.deepStrictEqual(M.lift([3, 4]), [3, 4, 25]);
});

/* ------------------------------------------------------------------ the kernel trick (chapter 6) */
t('kernel identity: (x . y)^2 equals phi(x) . phi(y) with phi = (x1^2, sqrt2 x1 x2, x2^2), for the page example and 200 random pairs', () => {
  const ex = M.kernelIdentity([1, 2], [3, 1]);
  near(ex.lhs, 25, 1e-12); near(ex.rhs, 25, 1e-12);
  assert.deepStrictEqual(ex.phiX.map((v) => Math.round(v * 1e6) / 1e6), [1, Math.round(Math.SQRT2 * 2e6) / 1e6, 4]);
  near(ex.dotXY, 5, 1e-12);
  near(M.sum(ex.parts), ex.rhs, 1e-12);
  const r = M.makeRng(99);
  for (let k = 0; k < 200; k++) {
    const x = [r.normal() * 3, r.normal() * 3], y = [r.normal() * 3, r.normal() * 3], q = M.kernelIdentity(x, y);
    near(q.lhs, q.rhs, 1e-9 * Math.max(1, Math.abs(q.lhs)));
    near(M.kernelFn(M.poly(2, 1, 0))(x, y), q.lhs, 1e-9 * Math.max(1, Math.abs(q.lhs)));
  }
});

t('kernel trick in action: the kernel SVM equals a linear SVM trained on explicitly lifted points', () => {
  const kern = M.fit(RING.X, RING.y, { kernel: M.poly(2, 1, 0), C: 10 });
  const lifted = RING.X.map(M.phi2), explicit = M.fit(lifted, RING.y, { kernel: M.LINEAR, C: 10 });
  assert.deepStrictEqual(kern.sv, explicit.sv, 'same support vectors');
  RING.fresh.X.slice(0, 60).forEach((x) => near(kern.decision(x), explicit.decision(M.phi2(x)), 5e-3, 'same decision values'));
  assert.strictEqual(kern.accuracy(RING.X, RING.y), 1);
  /* the lifted points are 3-D: the street there is a flat slab; back in 2-D it is a circle (decision = 0 where x1^2 + x2^2 = const) */
  const w = explicit.w;
  near(w[0], w[2], 0.05 * Math.abs(w[0]), 'x1^2 and x2^2 carry equal weight: a circle, not an ellipse');
  assert.ok(Math.abs(w[1]) < 0.15 * Math.abs(w[0]), 'the cross term barely matters');
});

t('RBF kernel: 1 at distance 0, fades with distance, faster for a larger gamma; gamma = scale helper', () => {
  const k1 = M.kernelFn(M.rbf(1)), k5 = M.kernelFn(M.rbf(5));
  near(k1([1, 1], [1, 1]), 1, 1e-15);
  assert.ok(k1([0, 0], [1, 0]) > k1([0, 0], [2, 0]) && k1([0, 0], [2, 0]) > k1([0, 0], [3, 0]));
  assert.ok(k5([0, 0], [1, 0]) < k1([0, 0], [1, 0]));
  near(k1([0, 0], [1, 0]), Math.exp(-1), 1e-15);
  assert.ok(M.kernelFn(M.rbf(1))([0, 0], [100, 100]) < 1e-12);
  /* gamma='scale' = 1 / (n_features * X.var()) over every entry */
  const X = [[0, 2], [4, 6]], all = [0, 2, 4, 6];
  near(M.gammaScale(X), 1 / (2 * M.variance(all)), 1e-15);
  near(M.gammaScale(X), 1 / (2 * 5), 1e-15);
});

/* ------------------------------------------------------------------ kernels side by side and gamma (chapter 7) */
t('rings: linear fails, a polynomial of degree 2 and RBF both get everything right, on training and fresh points', () => {
  const lin = M.kernelRun('rings', M.KERNELS.linear), p2 = M.kernelRun('rings', M.KERNELS.poly2), rb = M.kernelRun('rings', M.KERNELS.rbf);
  assert.ok(lin.train <= 0.7 && lin.fresh <= 0.7);
  [p2, rb].forEach((r) => { assert.strictEqual(r.train, 1); assert.ok(r.fresh >= 0.99); });
});

t('moons: linear is clearly worse than a curved kernel; the polynomial of degree 3 and RBF both reach 97% on fresh points', () => {
  const lin = M.kernelRun('moons', M.KERNELS.linear), p3 = M.kernelRun('moons', M.KERNELS.poly3), rb = M.kernelRun('moons', M.KERNELS.rbf);
  assert.ok(p3.fresh - lin.fresh > 0.1 && rb.fresh - lin.fresh > 0.1, 'curved kernels win: ' + [lin.fresh, p3.fresh, rb.fresh]);
  assert.ok(p3.fresh >= 0.97 && rb.fresh >= 0.95);
  assert.ok(M.kernelRun('moons', M.KERNELS.poly2).fresh < p3.fresh, 'degree 2 is not bendy enough for moons');
});

t('large gamma memorises: training near 100% but fresh accuracy falls; tiny gamma underfits (both shapes)', () => {
  ['rings', 'moons'].forEach((key) => {
    const sw = M.gammaSweep(key, M.RBF_C), best = M.bestIndexBy(sw, (r) => r.fresh), first = sw[0], last = sw[sw.length - 1];
    assert.ok(best > 1 && best < sw.length - 2, key + ': an interior best gamma ' + best);
    assert.ok(last.train >= 0.97, key + ': huge gamma fits the training points');
    assert.ok(sw[best].fresh - last.fresh >= 0.2, key + ': ... and loses a lot on fresh points: ' + sw[best].fresh + ' vs ' + last.fresh);
    assert.ok(first.train <= 0.9, key + ': tiny gamma underfits even the training points: ' + first.train);
    assert.ok(sw[best].fresh - first.fresh >= 0.1);
    assert.ok(last.nSV >= 0.95 * D[key].n, 'islands: nearly every point becomes a support vector');
    assert.ok(sw[best].nSV < last.nSV - 5, 'a moderate gamma needs fewer support vectors than a huge one');
    /* the gap between training and fresh accuracy grows with gamma */
    assert.ok(last.train - last.fresh > sw[best].train - sw[best].fresh + 0.1);
  });
});

/* ------------------------------------------------------------------ agreement with scikit-learn */
t('results match scikit-learn 1.9.1 SVC on the same points (reference values recorded from a real run)', () => {
  /* separable, SVC(kernel='linear', C=1000): support_ = [19, 2, 16], coef_ = [0.8472, 0.3376], intercept_ = -0.0338, margin 2.193 */
  assert.deepStrictEqual(HARD.sv.slice().sort((a, b) => a - b), [2, 16, 19]);
  near(HARD.w[0], 0.8472, 3e-3); near(HARD.w[1], 0.3376, 3e-3); near(HARD.b, -0.0338, 3e-3); near(HARD.margin, 2.193, 3e-3);
  /* overlap, linear: C = 0.01 -> 30 SVs, margin 4.9108; C = 1 -> 9 SVs, margin 1.9583; C = 100 -> 7 SVs, margin 0.9105 */
  [[0.01, 30, 4.9108, 0.9, 0.9], [1, 9, 1.9583, 0.9333, 0.94], [100, 7, 0.9105, 0.9667, 0.925]].forEach((r) => {
    const x = M.softRun(r[0], 'overlap');
    assert.strictEqual(x.nSV, r[1]); near(x.margin, r[2], 0.01); near(x.train, r[3], 1e-3); near(x.fresh, r[4], 1e-9);
  });
  /* rings (C = 1): linear 38 SVs 0.65 / 0.62; poly2 (gamma 1, coef0 1) 7 SVs; poly3 6 SVs; rbf 0.5 15 SVs */
  [['rings', 'linear', 38, 0.65, 0.62], ['rings', 'poly2', 7, 1, 1], ['rings', 'poly3', 6, 1, 1], ['rings', 'rbf', 15, 1, 1],
   ['moons', 'linear', 11, 0.85, 0.845], ['moons', 'poly2', 11, 0.95, 0.885], ['moons', 'poly3', 7, 1, 0.98], ['moons', 'rbf', 16, 0.975, 0.97]].forEach((r) => {
    const x = M.kernelRun(r[0], M.KERNELS[r[1]]);
    assert.strictEqual(x.nSV, r[2], r[0] + ' ' + r[1]); near(x.train, r[3], 1e-9); near(x.fresh, r[4], 1e-9);
  });
  /* moons, rbf gamma 31.6228: 38 SVs, train 1.0, fresh 0.82; gamma 0.0316: 20 SVs, 0.85 / 0.825 */
  const big = M.kernelRun('moons', M.rbf(31.6228)), tiny = M.kernelRun('moons', M.rbf(0.0316));
  assert.strictEqual(big.nSV, 38); near(big.train, 1, 1e-9); near(big.fresh, 0.82, 1e-9);
  assert.strictEqual(tiny.nSV, 20); near(tiny.train, 0.85, 1e-9); near(tiny.fresh, 0.825, 1e-9);
});

/* ------------------------------------------------------------------ the page and the module agree */
t('every {{placeholder}} in index.html is filled by app.js; the only external links are the scikit-learn guide and the R2D3 credit; no notebooks; KaTeX is local', () => {
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const used = Array.from(new Set((html.match(/\{\{[^}]+\}\}/g) || []).map((m) => m.slice(2, -2).trim().split(/\s+/)[0])));
  assert.ok(used.length >= 25, 'prose is driven by placeholders: ' + used.length);
  used.forEach((k) => assert.ok(app.indexOf("case '" + k + "'") >= 0, 'app.js has no case for {{' + k + '}}'));
  const links = Array.from(new Set((html.match(/https?:\/\/[^"' )<]+/g) || []).filter((u) => !/w3\.org/.test(u))));
  assert.deepStrictEqual(links.sort(), ['https://scikit-learn.org/stable/modules/svm.html', 'https://www.r2d3.us/visual-intro-to-machine-learning-part-1/']);
  assert.ok(!/colab|\.ipynb|notebook/i.test(html), 'no links to notebooks');
  assert.ok(/\.\.\/vendor\/katex\/katex\.min\.js/.test(html), 'KaTeX is loaded locally');
  assert.ok(html.indexOf("Inspired by the classic 'polynomial kernel' 3-D animation of SVMs") >= 0, 'footer credit, as agreed');
  assert.ok(!/<video|<iframe|youtube|linkedin/i.test(html), 'no embedded external video');
  assert.ok(/made up|made-up/.test(html));
});

t('chapter 8 snippets: every snippet has code and a real output block, the version is named, and the page says what version produced them', () => {
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const blocks = html.match(/<div class="snip" data-snip="\d"/g) || [];
  assert.strictEqual(blocks.length, 5);
  assert.strictEqual((html.match(/<pre class="out"/g) || []).length, 5);
  assert.ok(/scikit-learn 1\.9\.1/.test(html));
  /* the first snippet's points are exactly the page's separable dots, so its support vectors are the ones the page draws */
  const m = html.match(/X = np\.array\(\[([\s\S]*?)\]\)/)[1].match(/\[\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]/g).map((s) => s.match(/-?[\d.]+/g).map(Number));
  assert.deepStrictEqual(m, SEP.X);
  assert.ok(html.indexOf('[19  2 16]') >= 0, 'the printed support rows are 19, 2 and 16');
  assert.deepStrictEqual(HARD.sv.slice().sort((a, b) => a - b), [2, 16, 19]);
});


/* ------------------------------------------------------------------ determinism */
t('everything is deterministic', () => {
  const a = M.fit(OVL.X, OVL.y, { kernel: M.rbf(2), C: 3 }), b = M.fit(OVL.X, OVL.y, { kernel: M.rbf(2), C: 3 });
  assert.deepStrictEqual(a.alpha, b.alpha); assert.strictEqual(a.b, b.b);
  assert.deepStrictEqual(M.gammaSweep('moons', 1).map((r) => r.fresh), M.gammaSweep('moons', 1).map((r) => r.fresh));
  assert.deepStrictEqual(M.bestLine(RING), M.bestLine(RING));
});

console.log('\nAll ' + passed + ' tests passed.');
