/* Pure math for "The Widest Street" (support vector machines and the kernel trick).
   UMD: exposes window.SVMM in the browser and module.exports under node.
   Everything is deterministic: the data is SYNTHETIC (made up with the seeded random generator below) and every
   number on the page (streets, support vectors, accuracies, kernel checks) is recomputed from it in the browser.
   The SVM solver is a small SMO (sequential minimal optimization) in the style of libsvm, the library scikit-learn's
   SVC is built on: same dual problem, same stopping rule (tolerance 1e-3). */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SVMM = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* ---------------------------------------------------------------- small helpers */
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => sum(a) / a.length;
  const variance = (a) => { const m = mean(a); return mean(a.map((v) => (v - m) * (v - m))); }; /* population variance, like numpy */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const sqDist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]); return s; };

  /* seeded random numbers: mulberry32 + Box-Muller (same recipe as the other pages) */
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

  /* ================================================================ KERNELS */
  /* a kernel spec is plain data: { type: 'linear' } | { type: 'poly', degree, gamma, coef0 } | { type: 'rbf', gamma } */
  const LINEAR = { type: 'linear' };
  const poly = (degree, gamma, coef0) => ({ type: 'poly', degree: degree, gamma: gamma === undefined ? 1 : gamma, coef0: coef0 === undefined ? 1 : coef0 });
  const rbf = (gamma) => ({ type: 'rbf', gamma: gamma });
  function kernelFn(k) {
    if (k.type === 'linear') return (a, b) => dot(a, b);
    if (k.type === 'poly') return (a, b) => Math.pow(k.gamma * dot(a, b) + k.coef0, k.degree);
    if (k.type === 'rbf') return (a, b) => Math.exp(-k.gamma * sqDist(a, b));
    throw new Error('unknown kernel ' + k.type);
  }
  /* scikit-learn's gamma='scale': 1 / (n_features * X.var()), the variance taken over every entry of X */
  function gammaScale(X) {
    const flat = []; X.forEach((r) => r.forEach((v) => flat.push(v)));
    return 1 / (X[0].length * variance(flat));
  }

  /* the degree-2 polynomial kernel (x.y)^2 and the 3-D lift it secretly performs: phi(x) = (x1^2, sqrt2 x1 x2, x2^2) */
  const phi2 = (x) => [x[0] * x[0], Math.SQRT2 * x[0] * x[1], x[1] * x[1]];
  function kernelIdentity(x, y) {
    const lhs = Math.pow(dot(x, y), 2), px = phi2(x), py = phi2(y), rhs = dot(px, py);
    return { lhs: lhs, rhs: rhs, phiX: px, phiY: py, dotXY: dot(x, y), parts: px.map((v, i) => v * py[i]) };
  }

  /* ================================================================ SVM TRAINING (SMO, libsvm style) */
  const TAU = 1e-12, HARD_C = 1000, EPS = 1e-3;
  /* X: array of [x1, x2, ...]; y: array of +1 / -1.  Solves the dual problem
       min  1/2 a'Qa - sum(a)   with  0 <= a_i <= C,  sum(a_i y_i) = 0,   Q_ij = y_i y_j K(x_i, x_j)
     by repeatedly choosing the pair that violates the optimality conditions most (second-order selection) and
     solving that two-variable problem exactly.  Deterministic. */
  function fit(X, y, opts) {
    opts = opts || {};
    const n = X.length, C = opts.C === undefined ? 1 : opts.C, eps = opts.eps || EPS, maxIter = opts.maxIter || 200000;
    const kernel = opts.kernel || LINEAR, kf = kernelFn(kernel);
    const K = new Array(n);
    for (let i = 0; i < n; i++) { K[i] = new Float64Array(n); }
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { const v = kf(X[i], X[j]); K[i][j] = v; K[j][i] = v; }
    const alpha = new Float64Array(n), G = new Float64Array(n).fill(-1);
    let iter = 0, converged = false;
    while (iter < maxIter) {
      /* first index: the most violating one in I_up */
      let Gmax = -Infinity, iSel = -1;
      for (let t = 0; t < n; t++) {
        if (y[t] === 1) { if (alpha[t] < C && -G[t] >= Gmax) { Gmax = -G[t]; iSel = t; } }
        else if (alpha[t] > 0 && G[t] >= Gmax) { Gmax = G[t]; iSel = t; }
      }
      /* second index: the best second-order gain in I_low */
      let Gmax2 = -Infinity, jSel = -1, best = Infinity;
      for (let t = 0; t < n; t++) {
        if (y[t] === 1) {
          if (alpha[t] > 0) {
            if (G[t] >= Gmax2) Gmax2 = G[t];
            const gd = Gmax + G[t];
            if (gd > 0) {
              let a = K[iSel][iSel] + K[t][t] - 2 * K[iSel][t]; if (a <= 0) a = TAU;
              const od = -(gd * gd) / a;
              if (od <= best) { best = od; jSel = t; }
            }
          }
        } else if (alpha[t] < C) {
          if (-G[t] >= Gmax2) Gmax2 = -G[t];
          const gd = Gmax - G[t];
          if (gd > 0) {
            let a = K[iSel][iSel] + K[t][t] - 2 * K[iSel][t]; if (a <= 0) a = TAU;
            const od = -(gd * gd) / a;
            if (od <= best) { best = od; jSel = t; }
          }
        }
      }
      if (iSel < 0 || jSel < 0 || Gmax + Gmax2 < eps) { converged = true; break; }
      iter++;
      const i = iSel, j = jSel, oi = alpha[i], oj = alpha[j];
      if (y[i] !== y[j]) {
        let a = K[i][i] + K[j][j] - 2 * K[i][j]; if (a <= 0) a = TAU;
        const delta = (-G[i] - G[j]) / a, diff = alpha[i] - alpha[j];
        alpha[i] += delta; alpha[j] += delta;
        if (diff > 0) { if (alpha[j] < 0) { alpha[j] = 0; alpha[i] = diff; } } else if (alpha[i] < 0) { alpha[i] = 0; alpha[j] = -diff; }
        if (diff > 0) { if (alpha[i] > C) { alpha[i] = C; alpha[j] = C - diff; } } else if (alpha[j] > C) { alpha[j] = C; alpha[i] = C + diff; }
      } else {
        let a = K[i][i] + K[j][j] - 2 * K[i][j]; if (a <= 0) a = TAU;
        const delta = (G[i] - G[j]) / a, s = alpha[i] + alpha[j];
        alpha[i] -= delta; alpha[j] += delta;
        if (s > C) { if (alpha[i] > C) { alpha[i] = C; alpha[j] = s - C; } } else if (alpha[j] < 0) { alpha[j] = 0; alpha[i] = s; }
        if (s > C) { if (alpha[j] > C) { alpha[j] = C; alpha[i] = s - C; } } else if (alpha[i] < 0) { alpha[i] = 0; alpha[j] = s; }
      }
      const di = alpha[i] - oi, dj = alpha[j] - oj;
      for (let k = 0; k < n; k++) G[k] += y[k] * (y[i] * K[i][k] * di + y[j] * K[j][k] * dj);
    }
    /* the offset: f(x) = sum a_i y_i K(x_i, x) + b */
    let ub = Infinity, lb = -Infinity, sumFree = 0, nFree = 0;
    for (let i = 0; i < n; i++) {
      const yG = y[i] * G[i];
      if (alpha[i] >= C) { if (y[i] === -1) ub = Math.min(ub, yG); else lb = Math.max(lb, yG); }
      else if (alpha[i] <= 0) { if (y[i] === 1) ub = Math.min(ub, yG); else lb = Math.max(lb, yG); }
      else { nFree++; sumFree += yG; }
    }
    const rho = nFree > 0 ? sumFree / nFree : (ub + lb) / 2, b = -rho;
    const sv = [];
    for (let i = 0; i < n; i++) if (alpha[i] > 1e-8) sv.push(i);
    const coef = sv.map((i) => alpha[i] * y[i]);
    const decision = (x) => { let s = b; for (let k = 0; k < sv.length; k++) s += coef[k] * kf(X[sv[k]], x); return s; };
    const model = {
      kernel: kernel, C: C, X: X, y: y, alpha: Array.from(alpha), b: b, sv: sv, nSV: sv.length, iterations: iter, converged: converged,
      decision: decision, predict: (x) => (decision(x) >= 0 ? 1 : -1),
      /* margin violators: points inside the street or on its wrong side (alpha at the upper bound C) */
      atBound: sv.filter((i) => alpha[i] >= C - 1e-8)
    };
    if (kernel.type === 'linear') {
      const w = X[0].map((_, d) => sum(sv.map((i) => alpha[i] * y[i] * X[i][d])));
      model.w = w; model.norm = Math.sqrt(dot(w, w)); model.margin = 2 / model.norm; /* the street is 2/|w| wide */
    }
    model.accuracy = (Xs, ys) => accuracy(model, Xs, ys);
    return model;
  }
  function accuracy(model, Xs, ys) {
    let ok = 0;
    for (let i = 0; i < Xs.length; i++) if (model.predict(Xs[i]) === ys[i]) ok++;
    return ok / Xs.length;
  }
  const wrongIndices = (model, Xs, ys) => Xs.map((x, i) => (model.predict(x) === ys[i] ? -1 : i)).filter((i) => i >= 0);

  /* ================================================================ MADE-UP DATA */
  /* every data set is { X: [[x1, x2], ...], y: [+1 | -1, ...], n }, with its own fresh set of 200 more points from the same recipe.
     Label +1 is group A (blue circles), label -1 is group B (orange diamonds). */
  const FRESH_N = 200;
  const R2 = (v) => round(v, 2);
  function blobs(spec, n, seed) {
    const rng = makeRng(seed), X = [], y = [];
    for (let i = 0; i < n; i++) {
      [1, -1].forEach((lab) => {
        const c = lab === 1 ? spec.a : spec.b;
        X.push([R2(c[0] + spec.sd * rng.normal()), R2(c[1] + spec.sd * rng.normal())]); y.push(lab);
      });
    }
    return { X: X, y: y, n: X.length };
  }
  /* two concentric groups, like scikit-learn's make_circles: B is a ring, A a small cluster inside */
  function circles(n, noise, factor, R, seed) {
    const rng = makeRng(seed), X = [], y = [];
    for (let i = 0; i < n; i++) {
      [1, -1].forEach((lab) => {
        const a = 2 * Math.PI * rng.uniform(), r = (lab === 1 ? factor * R : R) + noise * rng.normal();
        X.push([R2(r * Math.cos(a)), R2(r * Math.sin(a))]); y.push(lab);
      });
    }
    return { X: X, y: y, n: X.length };
  }
  /* two interlocking half-circles, like make_moons: A on top, B below */
  function moons(n, noise, R, seed) {
    const rng = makeRng(seed), X = [], y = [];
    for (let i = 0; i < n; i++) {
      [1, -1].forEach((lab) => {
        const t = Math.PI * rng.uniform();
        const px = lab === 1 ? Math.cos(t) : 1 - Math.cos(t), py = lab === 1 ? Math.sin(t) : 0.5 - Math.sin(t);
        X.push([R2(R * (px - 0.5) + noise * rng.normal()), R2(R * (py - 0.25) + noise * rng.normal())]); y.push(lab);
      });
    }
    return { X: X, y: y, n: X.length };
  }

  const SPEC = {
    /* chapters 1 and 2: two groups with a clear gap, 10 points each */
    separable: { make: (n, seed) => blobs({ a: [1.7, 1.15], b: [-1.7, -1.15], sd: 0.62 }, n, seed), n: 10, seed: 109, freshSeed: 911 },
    /* chapter 3: the groups overlap a little, 15 points each */
    overlap: { make: (n, seed) => blobs({ a: [1.25, 0.8], b: [-1.25, -0.8], sd: 0.95 }, n, seed), n: 15, seed: 38, freshSeed: 905 },
    /* chapters 4, 5, 7: a cluster inside a ring, 20 points each */
    rings: { make: (n, seed) => circles(n, 0.17, 0.3, 1.9, seed), n: 20, seed: 3, freshSeed: 903 },
    /* chapter 7: two moons, 20 points each */
    moons: { make: (n, seed) => moons(n, 0.27, 2.2, seed), n: 20, seed: 4, freshSeed: 904 }
  };
  const DATA = {};
  Object.keys(SPEC).forEach((k) => {
    const s = SPEC[k];
    DATA[k] = s.make(s.n, s.seed);
    DATA[k].fresh = s.make(FRESH_N / 2, s.freshSeed);
  });
  const HARD = { kernel: LINEAR, C: HARD_C };

  /* ================================================================ LINES AND STREETS (chapter 1) */
  /* A line is a unit direction w = (cos t, sin t) and an offset c: it separates by the sign of w.x - c.
     For a direction t, group A must lie on the high side and group B on the low side:
       gap(t) = min over A of w.x  -  max over B of w.x.
     gap > 0: the direction can separate the groups, and the widest street that fits has width gap, centred at c. */
  const dirOf = (t) => [Math.cos(t), Math.sin(t)];
  function streetAt(d, t) {
    const w = dirOf(t), pa = [], pb = [];
    d.X.forEach((x, i) => (d.y[i] === 1 ? pa : pb).push(dot(w, x)));
    const lo = Math.max.apply(null, pb), hi = Math.min.apply(null, pa);
    return { t: t, w: w, gap: hi - lo, offset: (hi + lo) / 2, separates: hi > lo };
  }
  /* the direction with the widest street, by brute force over angles (refined near the best): this is what the SVM finds */
  function widestStreet(d) {
    let best = null;
    const scan = (t0, t1, steps) => {
      for (let k = 0; k <= steps; k++) {
        const t = t0 + ((t1 - t0) * k) / steps, s = streetAt(d, t);
        if (!best || s.gap > best.gap) best = s;
      }
    };
    scan(-Math.PI, Math.PI, 720);
    const c = best.t; scan(c - 0.01, c + 0.01, 400);
    return best;
  }
  /* best accuracy any straight line can reach, by brute force: every direction, every sensible threshold */
  function bestLine(d) {
    let best = { acc: 0, t: 0, offset: 0 };
    const n = d.n;
    for (let k = 0; k < 360; k++) {
      const t = (k / 360) * 2 * Math.PI, r = lineAtAngle(d, t);
      if (r.acc > best.acc + 1e-12) best = { acc: r.acc, t: t, offset: r.offset, correct: r.correct };
    }
    best.n = n;
    return best;
  }
  /* for direction t, the threshold that classifies the most points correctly (A on the high side) */
  function lineAtAngle(d, t) {
    const w = dirOf(t), p = d.X.map((x, i) => ({ v: dot(w, x), y: d.y[i] })).sort((a, b) => a.v - b.v);
    /* threshold between p[k-1] and p[k]: everything before is predicted B, everything after A */
    let correct = p.filter((q) => q.y === 1).length, best = correct, bk = 0; /* threshold below everything: all predicted A */
    for (let k = 0; k < p.length; k++) {
      correct += p[k].y === -1 ? 1 : -1;
      if (correct > best) { best = correct; bk = k + 1; }
    }
    const off = bk === 0 ? p[0].v - 0.5 : bk === p.length ? p[p.length - 1].v + 0.5 : (p[bk - 1].v + p[bk].v) / 2;
    return { correct: best, acc: best / p.length, offset: off, t: t };
  }
  /* a handful of lines that all separate the training groups: tilted, and hugging one group or the other */
  const CANDIDATES = [[0.52, 0.12], [-0.46, 0.85], [0.95, 0.5], [-0.9, 0.3]];
  function candidateLines(d, best) {
    const t0 = (best || widestStreet(d)).t, out = [];
    CANDIDATES.forEach((c) => {
      let dt = c[0], s = streetAt(d, t0 + dt), tries = 0;
      while (!s.separates && tries++ < 60) { dt *= 0.93; s = streetAt(d, t0 + dt); }
      if (!s.separates) return;
      const lo = s.offset - s.gap / 2, off = lo + c[1] * s.gap; /* c[1]: where inside the gap the line sits (0 = against B, 1 = against A) */
      out.push({ t: s.t, offset: off, w: s.w, gap: s.gap, margin: lineMargin(d, s.t, off), dt: dt });
    });
    return out;
  }
  /* the street a particular line really has: twice the distance to its nearest dot (negative if some dot is on the wrong side) */
  function lineMargin(d, t, c) {
    const w = dirOf(t); let m = Infinity;
    d.X.forEach((x, i) => { m = Math.min(m, d.y[i] * (dot(w, x) - c)); });
    return 2 * m;
  }
  /* accuracy of a line (direction t, offset c, A on the high side) on a set */
  function lineAccuracy(t, c, d) {
    const w = dirOf(t); let ok = 0;
    d.X.forEach((x, i) => { if ((dot(w, x) - c >= 0 ? 1 : -1) === d.y[i]) ok++; });
    return ok / d.n;
  }

  /* ================================================================ EDITING THE POINTS (chapter 2) */
  const MOVE_BY = 0.8;
  /* the dot that is not a support vector and lies farthest from the street */
  function farthestNonSV(m, d) {
    let best = -1, bd = -1;
    d.X.forEach((x, i) => { if (m.sv.indexOf(i) >= 0) return; const v = Math.abs(m.decision(x)); if (v > bd) { bd = v; best = i; } });
    return best;
  }
  /* a copy of the points with dot i slid `by` units toward the street (a linear model m is needed for the street's direction) */
  function moveTowardStreet(d, m, i, by) {
    const X = d.X.map((p) => p.slice()), nx = m.w[0] / m.norm, ny = m.w[1] / m.norm;
    X[i] = [round(X[i][0] - by * d.y[i] * nx, 4), round(X[i][1] - by * d.y[i] * ny, 4)];
    return X;
  }

  /* ================================================================ THE LIFT (chapter 5) */
  const lift = (x) => [x[0], x[1], x[0] * x[0] + x[1] * x[1]];
  /* the flat sheet z = c halfway through the empty gap in height between group A (inside) and group B (the ring) */
  function liftPlane(d) {
    const zA = [], zB = [];
    d.X.forEach((x, i) => (d.y[i] === 1 ? zA : zB).push(lift(x)[2]));
    const hi = Math.max.apply(null, zA), lo = Math.min.apply(null, zB);
    const c = (hi + lo) / 2;
    return { c: c, gap: lo - hi, maxA: hi, minB: lo, separates: lo > hi, radius: Math.sqrt(c), radiusA: Math.sqrt(hi), radiusB: Math.sqrt(lo) };
  }

  /* ================================================================ SWEEPS (chapters 3 and 7) */
  const C_VALUES = Array.from({ length: 17 }, (_, k) => round(Math.pow(10, -2 + k * 0.25), 4)); /* 0.01 ... 100 */
  const GAMMAS = Array.from({ length: 21 }, (_, k) => round(Math.pow(10, -1.5 + k * 0.2), 4)); /* about 0.03 ... 316 */
  function softRun(C, key) {
    const d = DATA[key || 'overlap'], m = fit(d.X, d.y, { kernel: LINEAR, C: C });
    return { C: C, model: m, margin: m.margin, nSV: m.nSV, train: m.accuracy(d.X, d.y), fresh: m.accuracy(d.fresh.X, d.fresh.y), errors: wrongIndices(m, d.X, d.y), atBound: m.atBound.length };
  }
  function softSweep(key) { return C_VALUES.map((C) => softRun(C, key)); }
  function kernelRun(key, kernel, C) {
    const d = DATA[key], m = fit(d.X, d.y, { kernel: kernel, C: C === undefined ? 1 : C });
    return { model: m, nSV: m.nSV, train: m.accuracy(d.X, d.y), fresh: m.accuracy(d.fresh.X, d.fresh.y), kernel: kernel };
  }
  function gammaSweep(key, C) { return GAMMAS.map((g) => Object.assign({ gamma: g }, kernelRun(key, rbf(g), C))); }
  const bestIndexBy = (rows, f) => rows.reduce((b, r, i) => (f(r) > f(rows[b]) + 1e-12 ? i : b), 0);

  /* the kernel setups shown in chapter 7 */
  const RBF_C = 1;
  const KERNELS = {
    linear: LINEAR,
    poly2: poly(2, 1, 1),
    poly3: poly(3, 1, 1),
    rbf: rbf(0.5)
  };

  return {
    makeRng: makeRng, sum: sum, mean: mean, variance: variance, round: round, dot: dot, sqDist: sqDist,
    LINEAR: LINEAR, poly: poly, rbf: rbf, kernelFn: kernelFn, gammaScale: gammaScale, phi2: phi2, kernelIdentity: kernelIdentity,
    HARD_C: HARD_C, EPS: EPS, fit: fit, accuracy: accuracy, wrongIndices: wrongIndices,
    FRESH_N: FRESH_N, SPEC: SPEC, DATA: DATA, HARD: HARD, blobs: blobs, circles: circles, moons: moons,
    dirOf: dirOf, streetAt: streetAt, widestStreet: widestStreet, bestLine: bestLine, lineAtAngle: lineAtAngle, candidateLines: candidateLines, lineMargin: lineMargin, lineAccuracy: lineAccuracy,
    MOVE_BY: MOVE_BY, farthestNonSV: farthestNonSV, moveTowardStreet: moveTowardStreet,
    lift: lift, liftPlane: liftPlane,
    C_VALUES: C_VALUES, GAMMAS: GAMMAS, softRun: softRun, softSweep: softSweep, kernelRun: kernelRun, gammaSweep: gammaSweep, bestIndexBy: bestIndexBy,
    RBF_C: RBF_C, KERNELS: KERNELS
  };
});
