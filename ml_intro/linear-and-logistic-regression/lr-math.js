/* Pure math for "From a Number to a Yes" (linear & logistic regression).
   UMD: exposes window.LRM in the browser and module.exports under node.
   Everything is deterministic. The two small datasets below are SYNTHETIC (made up with a
   seeded random generator, see generate_data.py) and frozen here; every fitted number on the
   page (line, loss, descent paths, logistic fit, counts) is recomputed from them in the browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LRM = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* ---------------------------------------------------------------- frozen synthetic data */
  /* 40 made-up essays: x = average sentence length (words), y = a teacher's readability rating (0-100) */
  const ESSAYS = {
    x: [6.28, 9.9, 9.94, 10.3, 10.61, 10.98, 12.11, 12.56, 12.6, 13.03, 13.45, 13.59, 13.81, 14.03, 14.15, 15.48, 15.52, 15.58, 15.85, 15.86, 16.28, 17.33, 17.57, 18.39, 19.09, 19.35, 19.99, 20.08, 20.36, 20.59, 22.56, 23.39, 23.54, 24.17, 25.24, 25.81, 25.91, 26.24, 26.83, 27.27],
    y: [77.3, 81.4, 79.5, 66.4, 62.9, 74.6, 66.4, 60.6, 69.6, 60.7, 64.8, 83.7, 56.9, 51.1, 57.6, 54.4, 62.9, 53.8, 49.8, 54.2, 58.5, 48.1, 64.0, 60.2, 59.6, 42.0, 59.8, 53.2, 63.5, 35.9, 45.6, 48.4, 20.9, 42.4, 32.2, 27.9, 33.9, 54.7, 21.2, 46.7]
  };
  const N_ESSAYS = ESSAYS.x.length;
  /* an essay counts as "readable" when the teacher's rating is at least this */
  const PASS_MARK = 60;

  /* 34 made-up emails: how many times the word "free" appears, and whether the email is spam (1) or not (0) */
  const SPAM = {
    counts: [1, 6, 6, 3, 2, 5, 2, 0, 1, 4, 2, 8, 5, 1, 3, 1, 3, 2, 3, 2, 2, 1, 1, 2, 3, 2, 6, 1, 1, 4, 2, 3, 3, 3],
    labels: [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 1]
  };
  const N_SPAM = SPAM.counts.length;

  /* gradient descent set-up (as in generate_data.py): a "confidently wrong" starting line and three step sizes.
     The step sizes refer to the descent on the RESCALED sentence length (see gdTrajectory). */
  const START = [125, -0.8];
  const DEFAULT_LINE = [128, -3.6]; /* the "reasonable but wrong" starter line */
  const ALPHAS = { small: 0.002, good: 0.0991, large: 1.1 };
  /* lines swept through in the "every line has a number" step */
  const CANDIDATE_LINES = [[100, -1.2], [150, -3.9], [60, -1.8], [118, -2.9], [135, -4.4]];

  /* ---------------------------------------------------------------- small helpers */
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => sum(a) / a.length;
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));
  const logit = (p) => Math.log(p / (1 - p));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lineAt = (b0, b1, x) => b0 + b1 * x;
  const labelsFromScores = (ys, pass) => ys.map((v) => (v >= (pass === undefined ? PASS_MARK : pass) ? 1 : 0));

  /* ---------------------------------------------------------------- linear regression */
  /* ordinary least squares: the closed-form best line */
  function olsFit(xs, ys) {
    const n = xs.length, mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    const b1 = sxy / sxx;
    return { b0: my - b1 * mx, b1: b1 };
  }
  function residuals(b0, b1, xs, ys) { return xs.map((x, i) => ys[i] - lineAt(b0, b1, x)); }
  /* mean squared error: the average of the squared gaps. The one "how wrong is this line" number used everywhere. */
  function mse(b0, b1, xs, ys) { return mean(residuals(b0, b1, xs, ys).map((r) => r * r)); }
  /* the same number in closed form from sufficient statistics (used for fast heat-maps and ellipses) */
  function lossStats(xs, ys) {
    const n = xs.length;
    return { n: n, mx: mean(xs), mxx: mean(xs.map((v) => v * v)), my: mean(ys), myy: mean(ys.map((v) => v * v)), mxy: mean(xs.map((v, i) => v * ys[i])) };
  }
  function lossFromStats(S, b0, b1) {
    return S.myy - 2 * b0 * S.my - 2 * b1 * S.mxy + b0 * b0 + 2 * b0 * b1 * S.mx + b1 * b1 * S.mxx;
  }

  /* ---------------------------------------------------------------- gradient descent */
  /* Descent on the mean squared error. As real tools do, it first RESCALES x to z = (x - mean) / sd and
     descends in (a, b) for the line a + b z. Every step is converted back and recorded in raw (b0, b1),
     so the path can be drawn on the raw loss map. Returns [[b0, b1, loss], ...]. */
  function gdTrajectory(xs, ys, opt) {
    const o = Object.assign({ start: START, alpha: ALPHAS.good, maxSteps: 60, stopBelow: null, minSteps: 10 }, opt || {});
    const n = xs.length, xbar = mean(xs);
    const xsd = Math.sqrt(mean(xs.map((v) => (v - xbar) * (v - xbar))));
    const z = xs.map((v) => (v - xbar) / xsd);
    let a = o.start[0] + o.start[1] * xbar, b = o.start[1] * xsd;
    const traj = [];
    for (let i = 0; i < o.maxSteps; i++) {
      const b0 = a - b * xbar / xsd, b1 = b / xsd;
      traj.push([b0, b1, mse(b0, b1, xs, ys)]);
      const e = ys.map((y, k) => y - (a + b * z[k]));
      let ga = 0, gb = 0;
      for (let k = 0; k < n; k++) { ga += e[k]; gb += z[k] * e[k]; }
      a -= o.alpha * (-2 * ga / n);
      b -= o.alpha * (-2 * gb / n);
      if (!isFinite(a) || !isFinite(b) || Math.abs(a) > 1e4 || Math.abs(b) > 1e4) break;
      if (o.stopBelow !== null && i >= o.minSteps && traj[traj.length - 1][2] < o.stopBelow) break;
    }
    return traj;
  }
  function padTrajectory(t, n) {
    const m = n === undefined ? 60 : n;
    return t.length < m ? t.concat(new Array(m - t.length).fill(t[t.length - 1])) : t.slice(0, m);
  }

  /* ---------------------------------------------------------------- the loss landscape */
  /* Because the loss is a quadratic in (b0, b1), its level sets are ellipses around the best line.
     The matrix [[1, mean x], [mean x, mean x^2]] decides their shape. */
  function lossEllipse(fit, S, level, n) {
    const m = S.mx, s2 = S.mxx;
    const l21 = m, l22 = Math.sqrt(s2 - l21 * l21); /* Cholesky: H = R^T R, R = [[1, m], [0, l22]] */
    const r = Math.sqrt(Math.max(0, level - lossFromStats(S, fit.b0, fit.b1)));
    const pts = [];
    const cnt = n || 90;
    for (let k = 0; k <= cnt; k++) {
      const th = (2 * Math.PI * k) / cnt, u = Math.cos(th), v = Math.sin(th);
      /* solve R d = r (u, v) */
      const d1 = r * v / l22, d0 = r * u - m * d1;
      pts.push([fit.b0 + d0, fit.b1 + d1]);
    }
    return pts;
  }
  /* The valley floor: the direction in (b0, b1) space along which the loss rises slowest. */
  function valley(S) {
    const m = S.mx, s2 = S.mxx;
    const tr = 1 + s2, det = s2 - m * m;
    const lmin = tr / 2 - Math.sqrt(tr * tr / 4 - det);
    const vx = -m, vy = 1 - lmin; /* (H - lmin I) v = 0, first row: (1 - lmin) vx + m vy = 0 */
    const len = Math.hypot(vx, vy);
    return { lambdaMin: lmin, dir: [vx / len, vy / len] };
  }
  /* A point on the valley floor where the loss is `factor` times the minimum (sign = +1 or -1). */
  function valleyPoint(fit, S, factor, sign) {
    const v = valley(S);
    const lmin = lossFromStats(S, fit.b0, fit.b1);
    const t = sign * Math.sqrt(Math.max(0, (factor - 1) * lmin) / v.lambdaMin);
    return { b0: fit.b0 + t * v.dir[0], b1: fit.b1 + t * v.dir[1] };
  }

  /* ---------------------------------------------------------------- logistic regression */
  /* Maximum-likelihood fit by Newton's method on the rescaled feature; returned in raw (b0, b1). */
  function logisticFit(xs, labels, iters) {
    const n = xs.length, xm = mean(xs);
    const xsd = Math.sqrt(mean(xs.map((v) => (v - xm) * (v - xm))));
    const z = xs.map((v) => (v - xm) / xsd);
    let a = 0, b = 0;
    for (let it = 0; it < (iters || 60); it++) {
      let ga = 0, gb = 0, haa = 0, hab = 0, hbb = 0;
      for (let i = 0; i < n; i++) {
        const p = sigmoid(a + b * z[i]), w = p * (1 - p), d = p - labels[i];
        ga += d; gb += d * z[i]; haa += w; hab += w * z[i]; hbb += w * z[i] * z[i];
      }
      const det = haa * hbb - hab * hab;
      const da = (hbb * ga - hab * gb) / det, db = (-hab * ga + haa * gb) / det;
      a -= da; b -= db;
      if (Math.abs(da) + Math.abs(db) < 1e-12) break;
    }
    const b1 = b / xsd;
    return { b0: a - b1 * xm, b1: b1 };
  }
  const probs = (b0, b1, xs) => xs.map((x) => sigmoid(b0 + b1 * x));
  /* log-loss for one example: the penalty is -ln(probability given to the correct answer) */
  function logLossOne(p, label) { return -Math.log(label ? p : 1 - p); }
  function logLoss(b0, b1, xs, labels) { return mean(xs.map((x, i) => logLossOne(sigmoid(b0 + b1 * x), labels[i]))); }
  /* the confusion counts at a threshold. "positive" = label 1 (readable / spam). */
  function confusion(ps, labels, thr) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    ps.forEach((p, i) => {
      const pred = p >= thr;
      if (pred && labels[i]) tp++; else if (pred && !labels[i]) fp++; else if (!pred && labels[i]) fn++; else tn++;
    });
    return { tp: tp, fp: fp, fn: fn, tn: tn, correct: tp + tn, n: ps.length, positives: tp + fn, negatives: fp + tn };
  }
  /* indices of the examples the model gets wrong at a threshold */
  function mistakes(ps, labels, thr) { const o = []; ps.forEach((p, i) => { if ((p >= thr ? 1 : 0) !== labels[i]) o.push(i); }); return o; }
  /* odds multiplier for one more unit of x: odds = p / (1 - p) = exp(b0 + b1 x) */
  const oddsRatio = (b1) => Math.exp(b1);

  /* ---------------------------------------------------------------- everything the page quotes */
  function build() {
    const E = ESSAYS, n = E.x.length;
    const ols = olsFit(E.x, E.y);
    ols.mse = mse(ols.b0, ols.b1, E.x, E.y);
    const S = lossStats(E.x, E.y);
    const labels = labelsFromScores(E.y);
    const lin = olsFit(E.x, labels); /* the "number machine" pointed at 0/1 labels */
    const lg = logisticFit(E.x, labels);
    const ps = probs(lg.b0, lg.b1, E.x);
    const cm = confusion(ps, labels, 0.5);
    const traj = {
      small: padTrajectory(gdTrajectory(E.x, E.y, { alpha: ALPHAS.small }), 60),
      good: gdTrajectory(E.x, E.y, { alpha: ALPHAS.good, stopBelow: 1.02 * ols.mse, minSteps: 10 }),
      large: padTrajectory(gdTrajectory(E.x, E.y, { alpha: ALPHAS.large }), 60)
    };
    const spamFit = logisticFit(SPAM.counts, SPAM.labels);
    const spamPs = probs(spamFit.b0, spamFit.b1, SPAM.counts);
    const spamBoundary = -spamFit.b0 / spamFit.b1;
    const startLoss = mse(START[0], START[1], E.x, E.y);
    const userDefaultMse = mse(DEFAULT_LINE[0], DEFAULT_LINE[1], E.x, E.y);
    const ellipseLevels = [1.5, 3, 6, 12, 25, 50].map((f) => f * ols.mse);
    return {
      n: n, ols: ols, S: S, labels: labels, nReadable: sum(labels), nNotReadable: n - sum(labels),
      linOnLabels: { b0: lin.b0, b1: lin.b1, at6: lineAt(lin.b0, lin.b1, 6), at28: lineAt(lin.b0, lin.b1, 28) },
      logistic: { b0: lg.b0, b1: lg.b1, boundary: -lg.b0 / lg.b1, probs: ps, nCorrect: cm.correct, confusion: cm,
        mistakes: mistakes(ps, labels, 0.5), logLoss: logLoss(lg.b0, lg.b1, E.x, labels), odds: oddsRatio(lg.b1),
        pAt: (x) => sigmoid(lg.b0 + lg.b1 * x), zAt: (x) => lg.b0 + lg.b1 * x },
      traj: traj, startLoss: startLoss, userDefaultMse: userDefaultMse,
      candidates: CANDIDATE_LINES.map((c) => ({ b0: c[0], b1: c[1], mse: mse(c[0], c[1], E.x, E.y) })),
      ellipseLevels: ellipseLevels, valley: valley(S),
      spam: { n: N_SPAM, nSpam: sum(SPAM.labels), nOk: N_SPAM - sum(SPAM.labels), b0: spamFit.b0, b1: spamFit.b1, probs: spamPs,
        boundary: spamBoundary, minCount: Math.ceil(spamBoundary - 1e-9), pAt: (c) => sigmoid(spamFit.b0 + spamFit.b1 * c),
        confusionAt: (thr) => confusion(spamPs, SPAM.labels, thr), mistakesAt: (thr) => mistakes(spamPs, SPAM.labels, thr) }
    };
  }

  return {
    ESSAYS, SPAM, N_ESSAYS, N_SPAM, PASS_MARK, START, DEFAULT_LINE, ALPHAS, CANDIDATE_LINES,
    sum, mean, sigmoid, logit, clamp, lineAt, labelsFromScores,
    olsFit, residuals, mse, lossStats, lossFromStats,
    gdTrajectory, padTrajectory, lossEllipse, valley, valleyPoint,
    logisticFit, probs, logLossOne, logLoss, confusion, mistakes, oddsRatio,
    build
  };
});
