/* Pure math for "Same Units, Fair Distances" (feature scaling, generalization, L1 and L2).
   UMD: exposes window.SGM in the browser and module.exports under node.
   Everything is deterministic: the data is SYNTHETIC (made up with the seeded random generator below) and every
   number on the page (clusters, agreement, fits, errors, coefficient paths) is recomputed from it in the browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SGM = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* ---------------------------------------------------------------- small helpers */
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => sum(a) / a.length;
  const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) * (v - m)))); }; /* population std */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };

  /* seeded random numbers: mulberry32 + Box-Muller */
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

  /* ================================================================ PART 1: PEOPLE, DISTANCE, K-MEANS, SCALING */
  /* Two made-up groups, A and B, 20 people each. They differ mainly in HEIGHT; their body weights overlap almost completely. */
  const PEOPLE_SPEC = {
    seed: 214,
    perGroup: 20,
    groups: [
      { name: 'A', height: [1.63, 0.035], weight: [71, 12] },
      { name: 'B', height: [1.83, 0.035], weight: [73, 12] }
    ]
  };
  const GROUP_NAMES = PEOPLE_SPEC.groups.map((g) => g.name);

  function makePeople(spec) {
    spec = spec || PEOPLE_SPEC;
    const rng = makeRng(spec.seed), h = [], w = [], g = [];
    for (let i = 0; i < spec.perGroup; i++) {
      spec.groups.forEach((grp, gi) => {
        h.push(round(clamp(grp.height[0] + grp.height[1] * rng.normal(), 1.5, 2.0), 2));
        w.push(Math.round(clamp(grp.weight[0] + grp.weight[1] * rng.normal(), 46, 110)));
        g.push(gi);
      });
    }
    return { height: h, weight: w, group: g, n: h.length };
  }
  const PEOPLE = makePeople();

  /* feature matrix of [height, weight] rows in the chosen units */
  function features(p, units) {
    const hu = (units && units.height) || 'm', wu = (units && units.weight) || 'kg';
    const hf = hu === 'cm' ? 100 : 1, wf = wu === 'g' ? 1000 : 1;
    return p.height.map((v, i) => [round(v * hf, 4), p.weight[i] * wf]);
  }

  /* ---- distance */
  const sqDist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]); return s; };
  const euclid = (a, b) => Math.sqrt(sqDist(a, b));
  /* how much each feature adds to the SQUARED distance (they sum to 1) */
  function distanceShares(a, b) {
    const parts = a.map((v, i) => (v - b[i]) * (v - b[i])), tot = sum(parts);
    return { parts: parts, total: tot, shares: parts.map((v) => (tot ? v / tot : 0)), distance: Math.sqrt(tot) };
  }
  /* the pair of people whose gaps are closest to the instructor's example (about 0.10 m and 20 kg) */
  function closestPair(p, dh, dw) {
    let best = null;
    for (let i = 0; i < p.n; i++) for (let j = i + 1; j < p.n; j++) {
      const eh = (Math.abs(p.height[i] - p.height[j]) - dh) / 0.01, ew = (Math.abs(p.weight[i] - p.weight[j]) - dw) / 1;
      const e = eh * eh + ew * ew;
      if (!best || e < best.err) best = { i: i, j: j, err: e };
    }
    return best;
  }

  /* the closest pair of people that belong to DIFFERENT groups (in raw metres and kilograms) */
  function closestAcrossGroups(p) {
    let best = null;
    for (let i = 0; i < p.n; i++) for (let j = i + 1; j < p.n; j++) {
      if (p.group[i] === p.group[j]) continue;
      const d = sqDist([p.height[i], p.weight[i]], [p.height[j], p.weight[j]]);
      if (!best || d < best.d2) best = { i: i, j: j, d2: d };
    }
    return best;
  }

  /* ---- scaling: fit on TRAINING rows, apply to any rows */
  function fitMinMax(rows) {
    const d = rows[0].length, min = [], max = [];
    for (let k = 0; k < d; k++) { const c = rows.map((r) => r[k]); min.push(Math.min.apply(null, c)); max.push(Math.max.apply(null, c)); }
    return { kind: 'minmax', min: min, max: max,
      apply: (r) => r.map((v, k) => (max[k] === min[k] ? 0 : (v - min[k]) / (max[k] - min[k]))) };
  }
  function fitStandard(rows) {
    const d = rows[0].length, mu = [], sd = [];
    for (let k = 0; k < d; k++) { const c = rows.map((r) => r[k]); mu.push(mean(c)); sd.push(std(c)); }
    return { kind: 'zscore', mean: mu, std: sd, apply: (r) => r.map((v, k) => (sd[k] ? (v - mu[k]) / sd[k] : 0)) };
  }
  const fitIdentity = () => ({ kind: 'raw', apply: (r) => r.slice() });
  const fitScaler = (kind, rows) => (kind === 'minmax' ? fitMinMax(rows) : kind === 'zscore' ? fitStandard(rows) : fitIdentity());

  /* ---- k-means (Lloyd). Initial centres are given as person indices, so every run starts from the SAME people. */
  const INIT = [0, 1];
  function nearest(r, centres) {
    let b = 0, bd = Infinity;
    centres.forEach((c, k) => { const d = sqDist(r, c); if (d < bd) { bd = d; b = k; } });
    return b;
  }
  function kmeans(rows, initIdx, maxIter) {
    const k = initIdx.length, d = rows[0].length;
    let centres = initIdx.map((i) => rows[i].slice());
    const steps = [{ centres: centres.map((c) => c.slice()), assign: null }];
    let prev = null, assign = null;
    for (let it = 0; it < (maxIter || 50); it++) {
      assign = rows.map((r) => nearest(r, centres));
      const nc = [];
      for (let c = 0; c < k; c++) {
        const mem = rows.filter((r, i) => assign[i] === c);
        nc.push(mem.length ? Array.from({ length: d }, (_, j) => mean(mem.map((r) => r[j]))) : centres[c].slice());
      }
      steps.push({ centres: nc.map((c) => c.slice()), assign: assign.slice() });
      centres = nc;
      if (prev && prev.every((v, i) => v === assign[i])) break;
      prev = assign;
    }
    const inertia = sum(rows.map((r, i) => sqDist(r, centres[assign[i]])));
    return { assign: assign, centres: centres, steps: steps, iterations: steps.length - 1, inertia: inertia };
  }
  function permutations(a) {
    if (a.length <= 1) return [a.slice()];
    const out = [];
    a.forEach((v, i) => permutations(a.slice(0, i).concat(a.slice(i + 1))).forEach((p) => out.push([v].concat(p))));
    return out;
  }
  /* best relabelling of the clusters against the true groups: { agreement, perm, aligned } */
  function bestMatch(assign, truth) {
    const k = Math.max.apply(null, assign.concat(truth)) + 1;
    let best = null;
    permutations(Array.from({ length: k }, (_, i) => i)).forEach((p) => {
      const aligned = assign.map((a) => p[a]);
      const hit = aligned.filter((a, i) => a === truth[i]).length;
      if (!best || hit > best.hit) best = { hit: hit, perm: p, aligned: aligned };
    });
    return { agreement: best.hit / truth.length, hit: best.hit, perm: best.perm, aligned: best.aligned };
  }
  const agreement = (assign, truth) => bestMatch(assign, truth).agreement;

  /* one k-means run on the made-up people, in the chosen units and scaling; labels are aligned to the true groups
     so that cluster 0 is "the A side" and cluster 1 is "the B side" (only a naming choice, never a score trick) */
  function runPeople(kind, units, p) {
    p = p || PEOPLE;
    const raw = features(p, units), sc = fitScaler(kind, raw), rows = raw.map(sc.apply);
    const km = kmeans(rows, INIT), bm = bestMatch(km.assign, p.group), perm = bm.perm;
    const toRaw = (c) => c; /* centres stay in the scaled space; the page maps them for drawing */
    return {
      kind: kind, units: units || { height: 'm', weight: 'kg' }, scaler: sc, rows: rows, rawRows: raw,
      assign: bm.aligned, agreement: bm.agreement, hit: bm.hit, iterations: km.iterations,
      centres: perm.map((_, c) => km.centres[perm.indexOf(c)]).map(toRaw),
      steps: km.steps.map((s) => ({ assign: s.assign ? s.assign.map((a) => perm[a]) : null, centres: perm.map((_, c) => s.centres[perm.indexOf(c)]) })),
      wrong: bm.aligned.map((a, i) => (a !== p.group[i] ? i : -1)).filter((i) => i >= 0)
    };
  }
  /* how well can a plain weight cut (heavier / lighter than some threshold) reproduce a clustering? */
  function weightCutAgreement(assign, p) {
    p = p || PEOPLE;
    const ws = Array.from(new Set(p.weight)).sort((a, b) => a - b);
    let best = 0;
    ws.forEach((t) => {
      const cut = p.weight.map((w) => (w > t ? 1 : 0));
      best = Math.max(best, agreement(cut, assign));
    });
    return best;
  }
  /* a person who arrives later: scaled with the TRAINING numbers, then given to the nearest centre */
  function assignNew(person, run) {
    const r = run.scaler.apply([person.height * (run.units.height === 'cm' ? 100 : 1), person.weight * (run.units.weight === 'g' ? 1000 : 1)]);
    return { row: r, cluster: nearest(r, run.centres) };
  }

  /* ---- one extreme value: what do the scalers do to everybody else? */
  const OUTLIER = { height: 1.72, weight: 200 };
  /* a person who arrives after the scaler and k-means were fitted: tall, heavier than the A/B average; truly from group B */
  const NEW_PERSON = { height: 1.85, weight: 90, group: 1 };
  function withOutlier(p, o) {
    o = o || OUTLIER;
    return { height: p.height.concat([o.height]), weight: p.weight.concat([o.weight]), group: p.group.concat([0]), n: p.n + 1 };
  }
  /* spread (std) of everybody else's body weight after scaling, with and without the extreme person in the scaler's fit */
  function outlierSqueeze(kind, p) {
    p = p || PEOPLE;
    const base = features(p), all = features(withOutlier(p));
    const sBase = fitScaler(kind, base), sAll = fitScaler(kind, all);
    const spread = (sc) => std(base.map((r) => sc.apply(r)[1]));
    const before = spread(sBase), after = spread(sAll);
    return { before: before, after: after, ratio: after / before, outlierValue: sAll.apply([OUTLIER.height, OUTLIER.weight])[1], scalerAll: sAll, scalerBase: sBase };
  }

  /* ================================================================ PART 2: GENERALIZATION, RIDGE (L2), LASSO (L1) */
  /* 15 training essays and 40 fresh test essays: x = average sentence length (words), y = a teacher's readability rating */
  const ESSAY_SPEC = { seed: 383, nTrain: 15, nTest: 40, noise: 3.5, lo: 6, hi: 27 };
  const trueRating = (x) => 22 + 62 / (1 + Math.exp((x - 16.5) / 3.2));
  function makeEssays(spec) {
    spec = spec || ESSAY_SPEC;
    const rng = makeRng(spec.seed);
    const draw = (n) => {
      /* one essay per equal slice of the range, at a random spot inside the slice: spread out, but not a regular grid */
      const xs = Array.from({ length: n }, (_, i) => round(spec.lo + (spec.hi - spec.lo) * (i + rng.uniform()) / n, 1));
      return { x: xs, y: xs.map((x) => round(clamp(trueRating(x) + spec.noise * rng.normal(), 0, 100), 1)) };
    };
    return { train: draw(spec.nTrain), test: draw(spec.nTest) };
  }
  const ESSAYS = makeEssays();

  /* ---- linear algebra: least squares by Householder QR (stable even when the columns are nearly the same) */
  function lstsq(A, b) {
    const m = A.length, n = A[0].length, R = A.map((r) => r.slice()), y = b.slice();
    for (let k = 0; k < n; k++) {
      let nrm = 0; for (let i = k; i < m; i++) nrm += R[i][k] * R[i][k];
      nrm = Math.sqrt(nrm);
      if (nrm < 1e-14) continue;
      const alpha = R[k][k] > 0 ? -nrm : nrm, v = new Array(m).fill(0);
      for (let i = k; i < m; i++) v[i] = R[i][k];
      v[k] -= alpha;
      let vn = 0; for (let i = k; i < m; i++) vn += v[i] * v[i];
      if (vn < 1e-300) continue;
      for (let j = k; j < n; j++) { let d = 0; for (let i = k; i < m; i++) d += v[i] * R[i][j]; d = 2 * d / vn; for (let i = k; i < m; i++) R[i][j] -= d * v[i]; }
      let d = 0; for (let i = k; i < m; i++) d += v[i] * y[i]; d = 2 * d / vn; for (let i = k; i < m; i++) y[i] -= d * v[i];
    }
    const x = new Array(n).fill(0);
    for (let k = n - 1; k >= 0; k--) {
      let s = y[k]; for (let j = k + 1; j < n; j++) s -= R[k][j] * x[j];
      x[k] = Math.abs(R[k][k]) < 1e-12 ? 0 : s / R[k][k];
    }
    return x;
  }

  /* ---- polynomial features, standardized with TRAINING numbers.
     Column k holds the k-th power of the (centred) sentence length; every column is then standardized. */
  function polyScaler(xs, degree) {
    const mu = mean(xs), sd = std(xs);
    const cols = (x) => { const u = (x - mu) / sd; return Array.from({ length: degree }, (_, k) => Math.pow(u, k + 1)); };
    const raw = xs.map(cols), cm = [], cs = [];
    for (let k = 0; k < degree; k++) { const c = raw.map((r) => r[k]); cm.push(mean(c)); cs.push(std(c) || 1); }
    return { degree: degree, mu: mu, sd: sd, colMean: cm, colStd: cs,
      row: (x) => cols(x).map((v, k) => (v - cm[k]) / cs[k]) };
  }
  const SQ_FEATURE_NOTE = 'powers of the centred sentence length, each column standardized';

  /* objective for ridge and lasso (X standardized, intercept not penalized):
       ridge: mean squared miss + lambda * sum(w^2)       lasso: mean squared miss + lambda * sum(|w|)  */
  function ridgeFit(X, y, lambda) {
    const n = X.length, p = X[0].length, ym = mean(y), yc = y.map((v) => v - ym);
    const sq = Math.sqrt(n * lambda), A = X.map((r) => r.slice()), b = yc.slice();
    if (lambda > 0) for (let j = 0; j < p; j++) { const row = new Array(p).fill(0); row[j] = sq; A.push(row); b.push(0); }
    return { b0: ym, w: lstsq(A, b) };
  }
  const soft = (z, t) => (z > t ? z - t : z < -t ? z + t : 0);
  /* upper-triangular R of a Householder QR (so that A'A = R'R) */
  function qrR(A) {
    const m = A.length, n = A[0].length, R = A.map((r) => r.slice());
    for (let k = 0; k < n; k++) {
      let nrm = 0; for (let i = k; i < m; i++) nrm += R[i][k] * R[i][k];
      nrm = Math.sqrt(nrm);
      if (nrm < 1e-14) continue;
      const alpha = R[k][k] > 0 ? -nrm : nrm, v = new Array(m).fill(0);
      for (let i = k; i < m; i++) v[i] = R[i][k];
      v[k] -= alpha;
      let vn = 0; for (let i = k; i < m; i++) vn += v[i] * v[i];
      if (vn < 1e-300) continue;
      for (let j = k; j < n; j++) { let d = 0; for (let i = k; i < m; i++) d += v[i] * R[i][j]; d = 2 * d / vn; for (let i = k; i < m; i++) R[i][j] -= d * v[i]; }
    }
    return R.slice(0, n);
  }
  /* Lasso, solved exactly by "feature-sign search" (Lee et al., 2007): keep a set of active coefficients with known signs, solve the
     smooth problem on that set, slide along the way to the new solution and drop any coefficient that crosses zero, then activate
     the inactive coefficient whose gradient is the most violated. Plain coordinate descent (soft-thresholding, as in the
     one-coefficient formula soft(rho, lambda/2)) crawls when the columns are nearly the same, which they are for x, x^2, ... x^12. */
  function lassoFit(X, y, lambda, start) {
    const n = X.length, p = X[0].length, ym = mean(y), yc = y.map((v) => v - ym), gam = n * lambda;
    const w = start ? start.slice() : new Array(p).fill(0);
    const resid = (ww) => yc.map((v, i) => v - sum(X[i].map((xv, j) => xv * ww[j])));
    const obj = (ww) => { const r = resid(ww); return sum(r.map((v) => v * v)) + gam * sum(ww.map(Math.abs)); };
    const gradLoss = (ww) => { const r = resid(ww); return Array.from({ length: p }, (_, j) => -2 * sum(r.map((rv, i) => rv * X[i][j]))); };
    let outer = 0;
    for (; outer < 600; outer++) {
      for (let inner = 0; inner < 200; inner++) {
        const act = []; for (let j = 0; j < p; j++) if (w[j] !== 0) act.push(j);
        if (!act.length) break;
        const XA = X.map((row) => act.map((j) => row[j])), sg = act.map((j) => Math.sign(w[j])), m = act.length;
        const w0 = lstsq(XA, yc), R = qrR(XA), z = new Array(m).fill(0), v = new Array(m).fill(0);
        for (let a = 0; a < m; a++) { let tt = sg[a]; for (let b = 0; b < a; b++) tt -= R[b][a] * z[b]; z[a] = tt / R[a][a]; }
        for (let a = m - 1; a >= 0; a--) { let tt = z[a]; for (let b = a + 1; b < m; b++) tt -= R[a][b] * v[b]; v[a] = tt / R[a][a]; }
        const target = new Array(p).fill(0); act.forEach((j, a) => { target[j] = w0[a] - (gam / 2) * v[a]; });
        /* candidate stopping points on the way from w to target: the target itself and every zero crossing */
        const cand = [{ t: 1, j: -1 }];
        act.forEach((j) => { if (w[j] * target[j] < 0) cand.push({ t: w[j] / (w[j] - target[j]), j: j }); });
        let best = null;
        cand.forEach((c) => {
          const pt = w.map((wv, j) => wv + c.t * (target[j] - wv)); if (c.j >= 0) pt[c.j] = 0;
          const o = obj(pt); if (!best || o < best.o) best = { o: o, pt: pt, t: c.t, j: c.j };
        });
        const flipped = cand.length > 1;
        for (let j = 0; j < p; j++) w[j] = best.pt[j];
        if (best.j < 0 && !flipped) break; /* signs held: this active set is solved. (If the target flips a sign, solve again with the new signs.) */
      }
      const g = gradLoss(w);
      let jb = -1, gb = gam * (1 + 1e-7) + 1e-8;
      for (let j = 0; j < p; j++) if (w[j] === 0 && Math.abs(g[j]) > gb) { gb = Math.abs(g[j]); jb = j; }
      if (jb < 0) break;
      w[jb] = -Math.sign(g[jb]) * 1e-12; /* activate with the right sign; the next solve moves it to its real value */
    }
    return { b0: ym, w: w, iterations: outer };
  }

  /* the lambda grid used by the sliders: 0, then 10^-5 ... 10^2 in equal steps on a log scale */
  const LAMBDA_STEPS = 57;
  const LAMBDAS = [0].concat(Array.from({ length: LAMBDA_STEPS }, (_, k) => Math.pow(10, -5 + (7 * k) / (LAMBDA_STEPS - 1))));

  /* a fitted polynomial model: penalty = 'none' | 'l2' | 'l1'. Returns predict(), coefficients and errors. */
  function fitPoly(data, degree, penalty, lambda, start) {
    const sc = polyScaler(data.x, degree), X = data.x.map(sc.row);
    const f = penalty === 'l1' && lambda > 0 ? lassoFit(X, data.y, lambda, start) : ridgeFit(X, data.y, penalty === 'l2' ? lambda : 0); /* lasso with lambda 0 is plain least squares */
    const predict = (x) => f.b0 + sum(sc.row(x).map((v, k) => v * f.w[k]));
    const err = (d) => mean(d.x.map((x, i) => (d.y[i] - predict(x)) * (d.y[i] - predict(x))));
    return { degree: degree, penalty: penalty || 'none', lambda: lambda || 0, scaler: sc, b0: f.b0, w: f.w, predict: predict,
      trainMse: err(data), testMse: null, mseOn: err,
      l1: sum(f.w.map(Math.abs)), l2: sum(f.w.map((v) => v * v)), zeros: f.w.filter((v) => v === 0).length };
  }
  const withTest = (m, test) => { m.testMse = m.mseOn(test); return m; };

  /* error against polynomial degree 1..maxDeg (no penalty) */
  function degreeSweep(data, test, maxDeg) {
    return Array.from({ length: maxDeg || 12 }, (_, k) => {
      const m = withTest(fitPoly(data, k + 1, 'none', 0), test);
      return { degree: k + 1, train: m.trainMse, test: m.testMse, model: m };
    });
  }
  /* error and coefficients against lambda at a fixed degree, for ridge or lasso (lasso warm-starts down the path) */
  function lambdaSweep(data, test, degree, penalty) {
    const out = new Array(LAMBDAS.length); let start = null;
    /* the lasso path is computed from the largest lambda down, each fit starting from the previous one */
    const order = penalty === 'l1' ? LAMBDAS.map((_, i) => LAMBDAS.length - 1 - i) : LAMBDAS.map((_, i) => i);
    order.forEach((i) => {
      const lam = LAMBDAS[i];
      const m = withTest(fitPoly(data, degree, penalty, lam, penalty === 'l1' ? start : undefined), test);
      if (penalty === 'l1') start = m.w;
      out[i] = { lambda: lam, train: m.trainMse, test: m.testMse, w: m.w, zeros: m.zeros, l1: m.l1, l2: m.l2, model: m };
    });
    return out;
  }
  const bestIndex = (sweep, key) => sweep.reduce((bi, r, i) => (r[key || 'test'] < sweep[bi][key || 'test'] ? i : bi), 0);

  /* ---- chapter 8: the same information in different units. Two features, ridge WITHOUT any scaling. */
  const UNITS_SPEC = { seed: 1, n: 60 };
  function makeUnitsEssays(spec) {
    spec = spec || UNITS_SPEC;
    const rng = makeRng(spec.seed), len = [], rare0 = [];
    for (let i = 0; i < spec.n; i++) { len.push(6 + 21 * rng.uniform()); rare0.push(rng.uniform()); }
    /* make the two features uncorrelated by design (so that nothing but the units differs between the three set-ups), then
       stretch the rare-word share to 0.03 ... 0.30 */
    const ml = mean(len), mr = mean(rare0);
    const b = sum(len.map((v, i) => (v - ml) * (rare0[i] - mr))) / sum(len.map((v) => (v - ml) * (v - ml)));
    const res = rare0.map((v, i) => v - b * (len[i] - ml)), lo = Math.min.apply(null, res), hi = Math.max.apply(null, res);
    const s = [], r = [], y = [];
    for (let i = 0; i < spec.n; i++) {
      const rare = 0.03 + 0.27 * (res[i] - lo) / (hi - lo);
      s.push(round(len[i], 1)); r.push(round(rare, 3));
      y.push(round(clamp(92 - 1.5 * len[i] - 85 * rare + 5 * rng.normal(), 0, 100), 1));
    }
    return { length: s, rare: r, y: y, n: spec.n };
  }
  const UNITS_DATA = makeUnitsEssays();
  const UNITS_LAMBDAS = Array.from({ length: 31 }, (_, k) => Math.pow(10, -2 + (3 * k) / 30)); /* 0.01 ... 10 */
  /* ridge on [length, rare] with rare in the given unit (1 = fraction, 100 = percent), optionally standardized first.
     Returns the coefficients in THEIR OWN units and the share of the unpenalized coefficient that survives. */
  function unitsRidge(lambda, rareFactor, standardize, d) {
    d = d || UNITS_DATA;
    let X = d.length.map((v, i) => [v, d.rare[i] * rareFactor]), sc = null;
    if (standardize) { sc = fitStandard(X); X = X.map(sc.apply); }
    else { const cm = [0, 1].map((k) => mean(X.map((r) => r[k]))); X = X.map((r) => r.map((v, k) => v - cm[k])); } /* only shifted to mean 0 (the intercept is never penalized); the units stay */
    const w0 = ridgeFit(X, d.y, 0).w, w = ridgeFit(X, d.y, lambda).w;
    return { w: w, w0: w0, kept: w.map((v, k) => (w0[k] ? v / w0[k] : 0)), scaler: sc };
  }

  /* ---- chapter 7, optional: why corners give zeros. A toy problem with two coefficients.
     loss(w) = (w - w*)' A (w - w*), plus a penalty. */
  const TOY = { A: [[1, 0.7], [0.7, 1]], star: [2.4, 0.9] };
  function toySolve(kind, lambda) {
    const A = TOY.A, ws = TOY.star;
    if (!lambda) return ws.slice();
    if (kind === 'l2') {
      /* (A + lambda I) w = A w* */
      const b = [A[0][0] * ws[0] + A[0][1] * ws[1], A[1][0] * ws[0] + A[1][1] * ws[1]];
      const M = [[A[0][0] + lambda, A[0][1]], [A[1][0], A[1][1] + lambda]], det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      return [(M[1][1] * b[0] - M[0][1] * b[1]) / det, (M[0][0] * b[1] - M[1][0] * b[0]) / det];
    }
    const w = [0, 0];
    for (let it = 0; it < 5000; it++) {
      const old = w.slice();
      for (let j = 0; j < 2; j++) {
        const o = 1 - j;
        w[j] = soft(A[j][j] * ws[j] - A[j][o] * (w[o] - ws[o]), lambda / 2) / A[j][j];
      }
      if (Math.abs(w[0] - old[0]) + Math.abs(w[1] - old[1]) < 1e-13) break;
    }
    return w;
  }
  const toyLoss = (w) => { const d = [w[0] - TOY.star[0], w[1] - TOY.star[1]]; return d[0] * (TOY.A[0][0] * d[0] + TOY.A[0][1] * d[1]) + d[1] * (TOY.A[1][0] * d[0] + TOY.A[1][1] * d[1]); };
  const TOY_LAMBDAS = Array.from({ length: 41 }, (_, k) => k * 0.1);

  return {
    PEOPLE_SPEC: PEOPLE_SPEC, GROUP_NAMES: GROUP_NAMES, PEOPLE: PEOPLE, INIT: INIT, OUTLIER: OUTLIER, NEW_PERSON: NEW_PERSON, UNITS_LAMBDAS: UNITS_LAMBDAS,
    ESSAY_SPEC: ESSAY_SPEC, ESSAYS: ESSAYS, LAMBDAS: LAMBDAS, UNITS_SPEC: UNITS_SPEC, UNITS_DATA: UNITS_DATA, TOY: TOY, TOY_LAMBDAS: TOY_LAMBDAS,
    SQ_FEATURE_NOTE: SQ_FEATURE_NOTE, trueRating: trueRating,
    sum: sum, mean: mean, std: std, clamp: clamp, makeRng: makeRng,
    makePeople: makePeople, features: features, sqDist: sqDist, euclid: euclid, distanceShares: distanceShares, closestPair: closestPair, closestAcrossGroups: closestAcrossGroups,
    fitMinMax: fitMinMax, fitStandard: fitStandard, fitScaler: fitScaler,
    kmeans: kmeans, bestMatch: bestMatch, agreement: agreement, runPeople: runPeople, weightCutAgreement: weightCutAgreement, assignNew: assignNew,
    withOutlier: withOutlier, outlierSqueeze: outlierSqueeze,
    makeEssays: makeEssays, lstsq: lstsq, polyScaler: polyScaler, ridgeFit: ridgeFit, lassoFit: lassoFit, soft: soft,
    fitPoly: fitPoly, withTest: withTest, degreeSweep: degreeSweep, lambdaSweep: lambdaSweep, bestIndex: bestIndex,
    makeUnitsEssays: makeUnitsEssays, unitsRidge: unitsRidge, toySolve: toySolve, toyLoss: toyLoss
  };
});
