'use strict';
// Run with: node pmi-math.test.js
const assert = require('assert');
const PMIM = require('./pmi-math.js');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}

const CO = PMIM.buildCooccurrence();
const V = CO.vocab;
const idx = CO.index;

t('tokenize lowercases and strips punctuation', () => {
  assert.deepStrictEqual(PMIM.tokenize('Strong Tea, wakes ME up!'), ['strong', 'tea', 'wakes', 'me', 'up']);
  assert.deepStrictEqual(PMIM.tokenize('  '), []);
});

t('buildCooccurrence is deterministic and symmetric', () => {
  const a = PMIM.buildCooccurrence();
  const b = PMIM.buildCooccurrence();
  assert.deepStrictEqual(a.F, b.F);
  assert.strictEqual(a.N, b.N);
  for (let i = 0; i < V.length; i++)
    for (let j = 0; j < V.length; j++)
      assert.strictEqual(a.F[i][j], a.F[j][i], 'F must be symmetric');
});

t('toy corpus regression values: N, pairs, key counts', () => {
  assert.strictEqual(CO.pairs, 34);
  assert.strictEqual(CO.N, 68); // N = 2 * pairs (symmetrized matrix)
  assert.strictEqual(CO.F[idx.tea][idx.strong], 7, 'strong x tea = 7');
  assert.strictEqual(CO.F[idx.tea][idx.powerful], 1, 'powerful x tea = 1');
  assert.strictEqual(CO.F[idx.storm][idx.tea], 0, 'storm x tea never co-occur');
  assert.ok(V.includes('computer') && V.length === 10);
});

t('joint probabilities form a distribution (sum to 1), marginals consistent', () => {
  let s = 0;
  for (let i = 0; i < V.length; i++)
    for (let j = 0; j < V.length; j++) s += PMIM.jointProb(CO.F, i, j);
  assert.ok(Math.abs(s - 1) < 1e-12, 'sum pij = 1, got ' + s);
  const rs = PMIM.rowSums(CO.F);
  for (let i = 0; i < V.length; i++) {
    let m = 0;
    for (let j = 0; j < V.length; j++) m += PMIM.jointProb(CO.F, i, j);
    assert.ok(Math.abs(m - PMIM.marginalProb(CO.F, i)) < 1e-12);
    assert.ok(Math.abs(m - rs[i] / CO.N) < 1e-12);
  }
});

t('pmiFromCounts: independence -> 0, f=0 -> -Infinity, formula correct', () => {
  // perfectly independent 2x2 matrix: every cell = 2, N = 8, marginals 4/8 = 0.5
  const F = [[2, 2], [2, 2]];
  assert.ok(Math.abs(PMIM.pmiFromCounts(2, 4, 4, 8) - 0) < 1e-12, 'ratio 1 => PMI 0');
  assert.strictEqual(PMIM.pmiFromCounts(0, 4, 4, 8), -Infinity, 'log(0) = -inf');
  // p(x,y)=4/16=0.25, p(x)=8/16=0.5, p(y)=4/16=0.25 => ratio 2 => 1 bit
  assert.ok(Math.abs(PMIM.pmiFromCounts(4, 8, 4, 16) - 1) < 1e-12);
  assert.ok(Math.abs(PMIM.pmiFromProbs(0.25, 0.5, 0.25) - 1) < 1e-12);
});

t('massaged algebra: pmiFromProbs == pmiFromConditional when consistent', () => {
  const px = 0.2, py = 0.3, pxy = 0.12; // p(x|y) = 0.12/0.3 = 0.4
  const a = PMIM.pmiFromProbs(pxy, px, py);
  const b = PMIM.pmiFromConditional(pxy / py, px);
  assert.ok(Math.abs(a - b) < 1e-12, a + ' vs ' + b);
  assert.ok(Math.abs(a - PMIM.log2(0.12 / (0.2 * 0.3))) < 1e-12);
});

t('die example: P(5|>4)=1/2 vs P(5)=1/6 => PMI = log2(3) bits', () => {
  const d = PMIM.dieExample();
  assert.strictEqual(d.p5, 1 / 6);
  assert.strictEqual(d.p5GivenGt4, 1 / 2);
  assert.strictEqual(d.ratio, 3);
  assert.ok(Math.abs(d.pmi - PMIM.log2(3)) < 1e-12);
  assert.ok(Math.abs(d.pmi - 1.5849625) < 1e-6);
});

t('toy corpus PMI values: strong x tea positive max-by-count, powerful x tea negative, storm x tea -inf', () => {
  const pmiTeaStrong = PMIM.pmi(CO.F, idx.tea, idx.strong);
  const pmiTeaPowerful = PMIM.pmi(CO.F, idx.tea, idx.powerful);
  const pmiStormTea = PMIM.pmi(CO.F, idx.storm, idx.tea);
  assert.ok(Math.abs(pmiTeaStrong - 1.4353) < 1e-3, 'got ' + pmiTeaStrong);
  assert.ok(pmiTeaStrong > 0);
  assert.ok(pmiTeaPowerful < 0, 'powerful x tea repelled, got ' + pmiTeaPowerful);
  assert.ok(Math.abs(pmiTeaPowerful - (-0.9133)) < 1e-3, 'got ' + pmiTeaPowerful);
  assert.strictEqual(pmiStormTea, -Infinity);
  // PMI is symmetric on the symmetrized matrix
  assert.strictEqual(PMIM.pmi(CO.F, idx.strong, idx.tea), pmiTeaStrong);
});

t('rare events inflate PMI: powerful x storm (f=1) outranks strong x tea (f=7)', () => {
  const byPmi = PMIM.topPairs(CO.F, V, 100, 'pmi');
  const rare = byPmi.find(p => p.a === 'powerful' && p.b === 'storm');
  const star = byPmi.find(p => p.a === 'tea' && p.b === 'strong');
  assert.strictEqual(rare.f, 1);
  assert.ok(rare.pmi > star.pmi, 'rare pair inflated: ' + rare.pmi + ' > ' + star.pmi);
  const byCount = PMIM.topPairs(CO.F, V, 100, 'count');
  assert.strictEqual(byCount[0].a + 'x' + byCount[0].b, 'teaxstrong', 'top by raw count');
});

t('expectedCount = count(x)*count(y)/N; observed > expected for strong tea, < for powerful tea', () => {
  const rs = PMIM.rowSums(CO.F);
  const e = PMIM.expectedCount(CO.F, idx.tea, idx.strong);
  assert.ok(Math.abs(e - (rs[idx.tea] * rs[idx.strong]) / CO.N) < 1e-12);
  assert.ok(Math.abs(e - 2.588) < 1e-3);
  assert.ok(CO.F[idx.tea][idx.strong] > e);
  assert.ok(CO.F[idx.tea][idx.powerful] < PMIM.expectedCount(CO.F, idx.tea, idx.powerful));
  assert.strictEqual(rs[idx.tea], 16, 'tea is the most frequent word');
  assert.strictEqual(rs[idx.strong], 11);
  assert.strictEqual(Math.max.apply(null, rs), 16);
});

t('pairEvents: per-sentence windows, stopwords skipped but occupy positions', () => {
  const ev = PMIM.pairEvents(['she drinks strong tea every morning'], 3);
  const names = ev.map(e => PMIM.VOCAB[e.wi] + '-' + PMIM.VOCAB[e.wj]).sort();
  assert.deepStrictEqual(names, ['strong-morning', 'strong-tea', 'tea-morning']);
  // window crossing a sentence boundary must NOT pair words
  assert.strictEqual(PMIM.pairEvents(['strong', 'tea'], 3).length, 0);
  // window 1: only adjacent words
  assert.strictEqual(PMIM.pairEvents(['strong tea in morning'], 1).length, 1);
  assert.strictEqual(CO.events.length, CO.pairs);
  assert.strictEqual(CO.nSentences, 21);
});

t('diagonal is NaN (n/a) in pmiMatrix and 0 in PPMI; MI ignores it', () => {
  const M = PMIM.pmiMatrix(CO.F);
  for (let i = 0; i < 10; i++) assert.ok(Number.isNaN(M[i][i]));
  assert.strictEqual(PMIM.ppmiMatrix(CO.F)[3][3], 0);
});

t('pairStats and topPairs minCount filter', () => {
  const s = PMIM.pairStats(CO.F, V, idx.tea, idx.strong);
  assert.strictEqual(s.f, 7);
  assert.strictEqual(s.ci, 16);
  assert.strictEqual(s.cj, 11);
  assert.ok(Math.abs(s.ratio - 7 / s.expected) < 1e-12);
  const all = PMIM.topPairs(CO.F, V, 0, 'pmi');
  const min2 = PMIM.topPairs(CO.F, V, 0, 'pmi', 2);
  assert.ok(min2.length < all.length && min2.every(p => p.f >= 2));
  assert.strictEqual(all[0].a + all[0].b, 'powerfulstorm', 'rare pair tops raw PMI');
  assert.notStrictEqual(min2[0].a + min2[0].b, 'powerfulstorm', 'min-count removes it from the top');
  assert.strictEqual(min2[0].a + min2[0].b, 'powerfulcomputer');
});

t('count rank vs PMI rank: tea x coffee ties 2nd by count but has low PMI', () => {
  const tc = PMIM.pairStats(CO.F, V, idx.tea, idx.coffee);
  assert.strictEqual(tc.f, 3);
  assert.ok(Math.abs(tc.pmi - 0.35) < 0.01);
  const pc = PMIM.pairStats(CO.F, V, idx.powerful, idx.computer);
  assert.strictEqual(pc.f, 3);
  assert.ok(Math.abs(pc.pmi - 2.67) < 0.01);
});

t('pmiSmoothed: alpha=1 equals plain PMI; alpha<1 lowers rare-context PMI', () => {
  assert.ok(Math.abs(PMIM.pmiSmoothed(CO.F, idx.tea, idx.strong, 1) - PMIM.pmi(CO.F, idx.tea, idx.strong)) < 1e-12);
  const plain = PMIM.pmi(CO.F, idx.powerful, idx.storm);
  const sm = PMIM.pmiSmoothed(CO.F, idx.powerful, idx.storm, 0.75);
  assert.ok(sm < plain, sm + ' < ' + plain);
  assert.strictEqual(PMIM.pmiSmoothed(CO.F, idx.storm, idx.tea, 0.75), -Infinity);
});

t('shuffle experiment: deterministic, N chips, mean ~ count(x)count(y)/(N-1)', () => {
  const rng = PMIM.mulberry32(5);
  const sp = PMIM.shuffledPairs(CO.F, rng);
  assert.strictEqual(sp.length, CO.pairs);
  const flat = [].concat.apply([], sp);
  const rs = PMIM.rowSums(CO.F);
  for (let w = 0; w < 10; w++) assert.strictEqual(flat.filter(x => x === w).length, rs[w], 'chip counts preserved');
  assert.deepStrictEqual(PMIM.shuffleCounts(CO.F, idx.tea, idx.strong, 50, 3), PMIM.shuffleCounts(CO.F, idx.tea, idx.strong, 50, 3));
  const c = PMIM.shuffleCounts(CO.F, idx.tea, idx.strong, 4000, 1);
  const mean = c.reduce((a, b) => a + b, 0) / c.length;
  assert.ok(Math.abs(mean - (16 * 11) / (CO.N - 1)) < 0.15, 'mean ' + mean);
  assert.ok(c.filter(x => x >= 7).length / c.length < 0.01, 'chance almost never reaches the observed 7');
});

t('symmetricEigen: reconstruction, orthonormality, ordering, deterministic sign', () => {
  const A = PMIM.ppmiMatrix(CO.F);
  const E = PMIM.symmetricEigen(A);
  const n = A.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    let r = 0;
    for (let k = 0; k < n; k++) r += E.values[k] * E.vectors[k][i] * E.vectors[k][j];
    assert.ok(Math.abs(r - A[i][j]) < 1e-9, 'reconstruct ' + i + ',' + j);
  }
  for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) {
    let d = 0;
    for (let k = 0; k < n; k++) d += E.vectors[p][k] * E.vectors[q][k];
    assert.ok(Math.abs(d - (p === q ? 1 : 0)) < 1e-9, 'orthonormal');
  }
  for (let k = 1; k < n; k++) assert.ok(Math.abs(E.values[k - 1]) >= Math.abs(E.values[k]) - 1e-12);
  E.vectors.forEach((v) => {
    let big = 0;
    v.forEach((x, i) => { if (Math.abs(x) > Math.abs(v[big]) + 1e-12) big = i; });
    assert.ok(v[big] > 0, 'largest component positive');
  });
  assert.deepStrictEqual(PMIM.symmetricEigen(A), E);
  // known 2x2: [[2,1],[1,2]] -> 3, 1
  const S = PMIM.symmetricEigen([[2, 1], [1, 2]]);
  assert.ok(Math.abs(S.values[0] - 3) < 1e-12 && Math.abs(S.values[1] - 1) < 1e-12);
});

t('embed: 2-D coordinates are finite; tea block and powerful block separate', () => {
  const E = PMIM.embed(PMIM.ppmiMatrix(CO.F), [0, 2]);
  assert.strictEqual(E.coords.length, 10);
  E.coords.forEach(c => { assert.strictEqual(c.length, 2); c.forEach(x => assert.ok(Number.isFinite(x))); });
  const d = (a, b) => Math.hypot(E.coords[idx[a]][0] - E.coords[idx[b]][0], E.coords[idx[a]][1] - E.coords[idx[b]][1]);
  assert.ok(d('tea', 'strong') < d('tea', 'powerful'), 'tea is nearer strong than powerful');
  assert.ok(d('tea', 'coffee') < d('tea', 'engine'));
  assert.strictEqual(PMIM.embed(PMIM.ppmiMatrix(CO.F), 3).coords[0].length, 3);
});

t('PPMI eigen-directions: the two biggest describe the powerful group, the third the tea group', () => {
  const E = PMIM.symmetricEigen(PMIM.ppmiMatrix(CO.F));
  const powerGroup = ['powerful', 'engine', 'storm', 'computer'].map(w => idx[w]);
  const teaGroup = ['tea', 'coffee', 'strong', 'hot', 'bitter', 'morning'].map(w => idx[w]);
  const mass = (v, ids) => ids.reduce((a, i) => a + v[i] * v[i], 0);
  assert.ok(mass(E.vectors[0], powerGroup) > 0.99, 'direction 1 lives on the powerful group');
  assert.ok(mass(E.vectors[1], powerGroup) > 0.99, 'direction 2 lives on the powerful group');
  assert.ok(mass(E.vectors[2], teaGroup) > 0.99, 'direction 3 lives on the tea group');
});

t('cosine', () => {
  assert.ok(Math.abs(PMIM.cosine([1, 0], [1, 0]) - 1) < 1e-12);
  assert.ok(Math.abs(PMIM.cosine([1, 0], [0, 1])) < 1e-12);
  assert.strictEqual(PMIM.cosine([0, 0], [1, 1]), 0);
});

t('pmiMatrix / ppmiMatrix shapes and values; PPMI clips negatives and -inf to 0', () => {
  const M = PMIM.pmiMatrix(CO.F);
  const PP = PMIM.ppmiMatrix(CO.F);
  assert.strictEqual(M.length, 10);
  assert.strictEqual(M[0].length, 10);
  assert.strictEqual(M[idx.tea][idx.strong], PMIM.pmi(CO.F, idx.tea, idx.strong));
  assert.strictEqual(M[idx.storm][idx.tea], -Infinity);
  assert.strictEqual(PP[idx.storm][idx.tea], 0, 'PPMI(-inf) = 0');
  assert.strictEqual(PP[idx.tea][idx.powerful], 0, 'PPMI(negative) = 0');
  assert.strictEqual(PP[idx.tea][idx.strong], M[idx.tea][idx.strong], 'PPMI keeps positives');
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) assert.ok(PP[i][j] >= 0);
});

t('ppmi function: max(PMI, 0)', () => {
  assert.strictEqual(PMIM.ppmi(2.5), 2.5);
  assert.strictEqual(PMIM.ppmi(0), 0);
  assert.strictEqual(PMIM.ppmi(-1.2), 0);
  assert.strictEqual(PMIM.ppmi(-Infinity), 0);
});

t('mutual information = E[PMI] = sum pij * pmi; always >= 0; 0 for independence', () => {
  const mi = PMIM.mutualInformation(CO.F);
  assert.ok(Math.abs(mi - 1.3087) < 1e-3, 'toy MI ~ 1.31 bits, got ' + mi);
  // manual recomputation
  const rs = PMIM.rowSums(CO.F), cs = PMIM.colSums(CO.F);
  let manual = 0;
  for (let i = 0; i < V.length; i++)
    for (let j = 0; j < V.length; j++)
      if (CO.F[i][j] > 0) manual += (CO.F[i][j] / CO.N) * PMIM.pmiFromCounts(CO.F[i][j], rs[i], cs[j], CO.N);
  assert.ok(Math.abs(manual - mi) < 1e-12);
  const Find = [[2, 2], [2, 2]];
  assert.ok(Math.abs(PMIM.mutualInformation(Find)) < 1e-12, 'independent => MI = 0');
  assert.ok(mi >= 0);
});

t('topPairs returns only observed unordered pairs with all stats', () => {
  const tp = PMIM.topPairs(CO.F, V, 5, 'count');
  assert.strictEqual(tp.length, 5);
  tp.forEach(p => {
    assert.ok(p.f > 0 && p.i < p.j);
    assert.ok(Math.abs(p.ratio - p.f / p.expected) < 1e-12);
    assert.ok(Math.abs(p.pmi - PMIM.log2(p.ratio)) < 1e-12, 'PMI = log2(obs/exp)');
    assert.ok(Math.abs(p.pij - p.f / CO.N) < 1e-12);
  });
  // sorted descending by count
  for (let k = 1; k < tp.length; k++) assert.ok(tp[k - 1].f >= tp[k].f);
});

t('mulberry32 is deterministic', () => {
  const r1 = PMIM.mulberry32(7), r2 = PMIM.mulberry32(7);
  for (let i = 0; i < 5; i++) assert.strictEqual(r1(), r2());
});

console.log('\nAll ' + passed + ' tests passed.');
