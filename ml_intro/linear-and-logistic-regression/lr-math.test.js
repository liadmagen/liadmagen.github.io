'use strict';
// Run with: node lr-math.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const LRM = require('./lr-math.js');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || 'values differ') + ': ' + a + ' vs ' + b + ' (tol ' + tol + ')');

/* data.js is the provenance file written by generate_data.py (numpy). The page does not load it,
   but every number recomputed in JS must agree with it. */
const DATA = JSON.parse(JSON.stringify(vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8') + '; DATA')));
const B = LRM.build();
const E = LRM.ESSAYS, SP = LRM.SPAM;

t('frozen arrays equal the arrays in data.js', () => {
  assert.deepStrictEqual(E.x, DATA.essays.x);
  assert.deepStrictEqual(E.y, DATA.essays.y);
  assert.deepStrictEqual(SP.counts, DATA.spam.counts);
  assert.deepStrictEqual(SP.labels, DATA.spam.labels);
  assert.strictEqual(B.n, 40);
  assert.strictEqual(LRM.N_SPAM, 34);
});

t('readable labels (teacher rating >= 60) equal data.js labels', () => {
  assert.deepStrictEqual(B.labels, DATA.readability.labels);
  assert.strictEqual(B.nReadable, 16);
  assert.strictEqual(B.nNotReadable, 24);
  assert.strictEqual(LRM.labelsFromScores([59.9, 60, 100]).join(''), '011');
});

t('OLS line: b0 ~ 93.296, b1 ~ -2.191, mse ~ 80.4', () => {
  near(B.ols.b0, 93.296, 0.05); near(B.ols.b1, -2.191, 0.01); near(B.ols.mse, 80.4, 0.2);
  near(B.ols.b0, DATA.ols.b0, 0.05); near(B.ols.b1, DATA.ols.b1, 0.01); near(B.ols.mse, DATA.ols.mse, 0.2);
});

t('OLS is the minimum: random nearby lines never beat it', () => {
  for (let k = 0; k < 200; k++) {
    const d0 = Math.sin(k * 12.9898) * 3, d1 = Math.cos(k * 78.233) * 0.3;
    assert.ok(LRM.mse(B.ols.b0 + d0, B.ols.b1 + d1, E.x, E.y) >= B.ols.mse - 1e-9);
  }
});

t('mse is the MEAN of squared gaps (not the total) and matches the closed form', () => {
  const r = LRM.residuals(100, -2, E.x, E.y);
  const total = LRM.sum(r.map((v) => v * v));
  near(LRM.mse(100, -2, E.x, E.y), total / 40, 1e-9);
  near(LRM.lossFromStats(B.S, 100, -2), LRM.mse(100, -2, E.x, E.y), 1e-6);
  near(LRM.lossFromStats(B.S, B.ols.b0, B.ols.b1), B.ols.mse, 1e-6);
});

t('starting loss ~ 3264 (data.js: 3263.7) and the starter line is much better than the start', () => {
  near(B.startLoss, DATA.startLoss, 1);
  assert.ok(B.userDefaultMse < 300 && B.userDefaultMse > B.ols.mse);
});

t('gradient descent "good": 19 calm steps, monotone, ends near the best line, matches data.js', () => {
  const T = B.traj.good;
  assert.strictEqual(T.length, DATA.gd.trajGood.length);
  for (let i = 1; i < T.length; i++) assert.ok(T[i][2] < T[i - 1][2], 'loss falls every step');
  assert.ok(T[T.length - 1][2] < 1.05 * B.ols.mse);
  T.forEach((row, i) => {
    near(row[0], DATA.gd.trajGood[i][0], 0.3, 'b0 step ' + i);
    near(row[1], DATA.gd.trajGood[i][1], 0.01, 'b1 step ' + i);
    near(row[2], DATA.gd.trajGood[i][2], Math.max(1, row[2] * 0.01), 'loss step ' + i);
  });
});

t('gradient descent "small" crawls and "large" explodes (matches data.js)', () => {
  const S = B.traj.small, L = B.traj.large;
  assert.strictEqual(S.length, 60); assert.strictEqual(L.length, 60);
  assert.ok(S[59][2] < S[0][2] && S[59][2] > 0.6 * B.startLoss, 'small: slow progress');
  assert.ok(L[59][2] > 2.5 * B.startLoss, 'large: loss explodes');
  assert.ok(L[10][2] > L[0][2]);
  near(S[59][2], DATA.gd.trajSmall[59][2], 3);
  near(L[20][2] / DATA.gd.trajLarge[20][2], 1, 0.01);
  near(L[59][2] / DATA.gd.trajLarge[59][2], 1, 0.01);
});

t('padTrajectory pads with the last row and truncates', () => {
  const p = LRM.padTrajectory([[1, 2, 3], [4, 5, 6]], 4);
  assert.deepStrictEqual(p, [[1, 2, 3], [4, 5, 6], [4, 5, 6], [4, 5, 6]]);
  assert.strictEqual(LRM.padTrajectory([[1], [2], [3]], 2).length, 2);
});

t('loss ellipses: every point on a level set has exactly that loss', () => {
  B.ellipseLevels.forEach((lv) => {
    LRM.lossEllipse(B.ols, B.S, lv, 60).forEach((p) => near(LRM.mse(p[0], p[1], E.x, E.y), lv, 1e-6 * lv));
  });
});

t('the valley is long and thin: valley points have the stated loss and are far apart', () => {
  const a = LRM.valleyPoint(B.ols, B.S, 2, +1), b = LRM.valleyPoint(B.ols, B.S, 2, -1);
  near(LRM.mse(a.b0, a.b1, E.x, E.y), 2 * B.ols.mse, 1e-6);
  near(LRM.mse(b.b0, b.b1, E.x, E.y), 2 * B.ols.mse, 1e-6);
  assert.ok(Math.abs(a.b0 - b.b0) > 40, 'intercepts differ a lot');
  assert.ok(Math.abs(a.b1 - b.b1) > 2, 'slopes differ clearly');
  /* the trade-off: a steeper line needs a higher intercept, so both lines pass close to the middle of the cloud */
  assert.ok((a.b0 - b.b0) * (a.b1 - b.b1) < 0, 'intercept and slope move in opposite directions');
  const xm = B.S.mx, ym = B.S.my;
  near(LRM.lineAt(a.b0, a.b1, xm), ym, 8); near(LRM.lineAt(b.b0, b.b1, xm), ym, 8);
});

t('candidate lines: all worse than the best line', () => {
  assert.strictEqual(B.candidates.length, 5);
  B.candidates.forEach((c) => assert.ok(c.mse > B.ols.mse * 2));
});

t('line fitted to the 0/1 labels: 1.07 at x=6, -0.23 at x=28 (outside 0..1)', () => {
  near(B.linOnLabels.at6, 1.07, 0.01); near(B.linOnLabels.at28, -0.23, 0.01);
  near(B.linOnLabels.at6, DATA.linOnLabels.yAt6, 0.01); near(B.linOnLabels.at28, DATA.linOnLabels.yAt28, 0.01);
  assert.ok(B.linOnLabels.at6 > 1 && B.linOnLabels.at28 < 0);
});

t('logistic fit: b0 ~ 6.961, b1 ~ -0.457, boundary ~ 15.2, 33 of 40 correct', () => {
  const L = B.logistic;
  near(L.b0, 6.961, 0.05); near(L.b1, -0.457, 0.005); near(L.boundary, 15.2, 0.1);
  near(L.b0, DATA.readability.b0, 0.05); near(L.b1, DATA.readability.b1, 0.005);
  assert.strictEqual(L.nCorrect, 33); assert.strictEqual(L.nCorrect, DATA.readability.nCorrect);
  assert.strictEqual(L.mistakes.length, 7);
  near(L.probs[0], LRM.sigmoid(L.b0 + L.b1 * E.x[0]), 1e-12);
});

t('logistic fit is the likelihood maximum: perturbing it raises the log-loss', () => {
  const L = B.logistic, base = LRM.logLoss(L.b0, L.b1, E.x, B.labels);
  near(base, L.logLoss, 1e-12);
  [[0.2, 0], [-0.2, 0], [0, 0.02], [0, -0.02], [0.3, 0.03]].forEach((d) =>
    assert.ok(LRM.logLoss(L.b0 + d[0], L.b1 + d[1], E.x, B.labels) > base));
});

t('log-loss of one example: confident and wrong costs far more than confident and right', () => {
  near(LRM.logLossOne(0.99, 1), -Math.log(0.99), 1e-12);
  near(LRM.logLossOne(0.01, 1), -Math.log(0.01), 1e-12);
  near(LRM.logLossOne(0.2, 0), -Math.log(0.8), 1e-12);
  assert.ok(LRM.logLossOne(0.01, 1) > 100 * LRM.logLossOne(0.99, 1));
  near(LRM.logLossOne(0.5, 1), Math.LN2, 1e-12);
});

t('odds multiplier per extra word is exp(b1) ~ 0.63', () => {
  near(B.logistic.odds, 0.633, 0.005);
  const o = (x) => B.logistic.pAt(x) / (1 - B.logistic.pAt(x));
  near(o(13) / o(12), B.logistic.odds, 1e-9);
});

t('P(readable) at 8 words ~ 0.96; the 0.5 line is crossed at the boundary', () => {
  near(B.logistic.pAt(8), 0.96, 0.01);
  near(B.logistic.pAt(B.logistic.boundary), 0.5, 1e-9);
  near(B.logistic.zAt(B.logistic.boundary), 0, 1e-9);
});

t('sigmoid and logit are inverse; sigmoid is bounded in (0,1)', () => {
  [-5, -1, 0, 0.3, 2, 7].forEach((z) => near(LRM.logit(LRM.sigmoid(z)), z, 1e-9));
  assert.strictEqual(LRM.sigmoid(0), 0.5);
  assert.ok(LRM.sigmoid(-40) > 0 && LRM.sigmoid(40) <= 1);
});

t('confusion counts add up and move as expected with the threshold', () => {
  const ps = [0.9, 0.6, 0.4, 0.2], lab = [1, 0, 1, 0];
  assert.deepStrictEqual(LRM.confusion(ps, lab, 0.5), { tp: 1, fp: 1, fn: 1, tn: 1, correct: 2, n: 4, positives: 2, negatives: 2 });
  assert.strictEqual(LRM.confusion(ps, lab, 0.95).tp, 0);
  assert.strictEqual(LRM.confusion(ps, lab, 0.1).fp, 2);
  assert.deepStrictEqual(LRM.mistakes(ps, lab, 0.5), [1, 2]);
  const c = B.logistic.confusion;
  assert.strictEqual(c.tp + c.fp + c.fn + c.tn, 40);
  assert.strictEqual(c.correct, 33);
});

t('spam fit: b0 ~ -4.613, b1 ~ 1.586, P(3) ~ 0.536, "free" three times is the tipping point', () => {
  const S = B.spam;
  near(S.b0, -4.613, 0.02); near(S.b1, 1.586, 0.01);
  near(S.b0, DATA.spam.b0, 0.02); near(S.b1, DATA.spam.b1, 0.01);
  near(S.pAt(3), 0.536, 0.005);
  for (let c = 0; c < 10; c++) near(S.pAt(c), DATA.spam.pAt[c], 0.005, 'P(' + c + ')');
  assert.strictEqual(S.minCount, 3); near(S.boundary, 2.91, 0.05);
  assert.strictEqual(S.n, 34); assert.strictEqual(S.nSpam, 14); assert.strictEqual(S.nOk, 20);
});

t('spam threshold slider: raising it never flags more emails (false alarms and caught both fall)', () => {
  let prev = null;
  for (let thr = 0.1; thr <= 0.901; thr += 0.05) {
    const c = B.spam.confusionAt(thr);
    assert.strictEqual(c.tp + c.fp + c.fn + c.tn, 34);
    assert.strictEqual(c.tp + c.fn, 14); assert.strictEqual(c.fp + c.tn, 20);
    if (prev) { assert.ok(c.tp <= prev.tp && c.fp <= prev.fp); }
    prev = c;
  }
  const lo = B.spam.confusionAt(0.2), hi = B.spam.confusionAt(0.8);
  assert.ok(lo.fp > hi.fp, 'low threshold = more false alarms');
  assert.ok(lo.fn < hi.fn, 'low threshold = fewer missed spam');
  assert.strictEqual(B.spam.mistakesAt(0.5).length, B.spam.confusionAt(0.5).fp + B.spam.confusionAt(0.5).fn);
});

t('build() is deterministic', () => {
  const B2 = LRM.build();
  assert.deepStrictEqual(B2.traj.good, B.traj.good);
  assert.strictEqual(B2.ols.b0, B.ols.b0);
  assert.strictEqual(B2.spam.b1, B.spam.b1);
});

console.log('\nAll ' + passed + ' tests passed.');
