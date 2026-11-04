/* Pure math for the PMI (pointwise mutual information) visual guide.
   UMD: exposes window.PMIM in the browser and module.exports under node.
   Everything is deterministic: the toy corpus is hard-coded, so all counts,
   probabilities, PMI values and MI on the page are reproducible and testable. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PMIM = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* A tiny hard-coded English toy corpus. Deterministic - no randomness. */
  const CORPUS = [
    'strong tea wakes me up',
    'a strong tea please',
    'she drinks strong tea every morning',
    'strong tea not coffee',
    'i prefer strong tea',
    'one more strong tea',
    'strong tea again',
    'powerful engine roars loudly',
    'a powerful storm hit the coast',
    'the engine is powerful',
    'strong engine in the car',
    'hot tea in the morning',
    'bitter coffee in the morning',
    'strong coffee is too much',
    'hot coffee and bitter tea',
    'morning tea with a friend',
    'tea or coffee in the morning',
    'powerful tea sounds strange',
    'a powerful computer',
    'the computer is powerful',
    'powerful engine and computer'
  ];

  /* The content-word vocabulary we count over (stopwords are ignored). */
  const VOCAB = ['tea', 'coffee', 'strong', 'powerful', 'hot', 'bitter', 'morning', 'engine', 'storm', 'computer'];

  /* Co-occurrence window: words within this many positions in the same sentence. */
  const WINDOW = 3;

  function log2(x) { return Math.log(x) / Math.LN2; }

  function tokenize(sentence) {
    return String(sentence).toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Co-occurrence matrix F over VOCAB: for every unordered pair of vocabulary
     words within `windowSize` positions in the same sentence, add 1 to both
     F[a][b] and F[b][a] (symmetric matrix). N = sum of all cells = 2 * #pairs,
     so p_ij = F[i][j] / N is a proper joint distribution over ordered pairs. */
  function buildCooccurrence(corpus, windowSize) {
    const sents = (corpus || CORPUS).map(tokenize);
    const w = windowSize || WINDOW;
    const vocab = VOCAB.slice();
    const index = {};
    vocab.forEach((word, i) => { index[word] = i; });
    const V = vocab.length;
    const F = [];
    for (let i = 0; i < V; i++) F.push(new Array(V).fill(0));
    let pairs = 0;
    sents.forEach((toks) => {
      const vt = toks.map(t => (index[t] !== undefined ? index[t] : -1));
      for (let i = 0; i < vt.length; i++) {
        if (vt[i] < 0) continue;
        for (let d = 1; d <= w; d++) {
          const j = i + d;
          if (j >= vt.length || vt[j] < 0) continue;
          F[vt[i]][vt[j]] += 1;
          F[vt[j]][vt[i]] += 1;
          pairs++;
        }
      }
    });
    return { vocab, index, F, N: totalN(F), pairs, windowSize: w };
  }

  function rowSums(F) { return F.map(row => row.reduce((a, b) => a + b, 0)); }
  function colSums(F) {
    const V = F.length, cs = new Array(V).fill(0);
    for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) cs[j] += F[i][j];
    return cs;
  }
  function totalN(F) {
    let n = 0;
    for (const row of F) for (const v of row) n += v;
    return n;
  }

  function jointProb(F, i, j) { return F[i][j] / totalN(F); }
  function marginalProb(F, i) { return rowSums(F)[i] / totalN(F); }

  /* Expected co-occurrence count under independence: E[f_ij] = f_i * f_j / N. */
  function expectedCount(F, i, j) {
    const rs = rowSums(F), cs = colSums(F), N = totalN(F);
    return (rs[i] * cs[j]) / N;
  }

  /* The 2x2 contingency table for the pair (i, j), in count units:
     a = both, b = i only, c = j only, d = neither. Cells sum to N. */
  function contingency(F, i, j) {
    const rs = rowSums(F), cs = colSums(F), N = totalN(F);
    const a = F[i][j];
    return { a, b: rs[i] - a, c: cs[j] - a, d: N - rs[i] - cs[j] + a, fi: rs[i], fj: cs[j], N };
  }

  /* PMI from raw counts (SLP3 J.5): PMI = log2( f_ij * N / (f_i * f_j) ).
     f_ij = 0 gives log(0) = -Infinity. */
  function pmiFromCounts(fij, fi, fj, N) {
    if (fij <= 0 || fi <= 0 || fj <= 0) return -Infinity;
    return log2((fij * N) / (fi * fj));
  }

  function pmi(F, i, j) {
    const rs = rowSums(F), cs = colSums(F);
    return pmiFromCounts(F[i][j], rs[i], cs[j], totalN(F));
  }

  function pmiMatrix(F) {
    const rs = rowSums(F), cs = colSums(F), N = totalN(F);
    return F.map((row, i) => row.map((f, j) => pmiFromCounts(f, rs[i], cs[j], N)));
  }

  /* PPMI (SLP3 J.4): positive PMI = max(PMI, 0). Clips negatives AND -Infinity. */
  function ppmi(x) { return x > 0 ? x : 0; }

  function ppmiMatrix(F) {
    return pmiMatrix(F).map(row => row.map(ppmi));
  }

  /* Mutual information (SLP3 J.1): I(X,Y) = sum_x sum_y p(x,y) * PMI(x,y)
     = E[PMI], the expectation of PMI under the joint distribution. */
  function mutualInformation(F) {
    const rs = rowSums(F), cs = colSums(F), N = totalN(F);
    let mi = 0;
    for (let i = 0; i < F.length; i++) {
      for (let j = 0; j < F[i].length; j++) {
        const f = F[i][j];
        if (f > 0) mi += (f / N) * pmiFromCounts(f, rs[i], cs[j], N);
      }
    }
    return mi;
  }

  /* The "massaged" forms (eranraviv): with p(x,y) = p(x|y) p(y),
     PMI(x,y) = log( p(x,y) / (p(x) p(y)) ) = log( p(x|y) / p(x) ) = log( p(y|x) / p(y) ). */
  function pmiFromProbs(pxy, px, py) {
    if (pxy <= 0 || px <= 0 || py <= 0) return -Infinity;
    return log2(pxy / (px * py));
  }
  function pmiFromConditional(pxGivenY, px) {
    if (pxGivenY <= 0 || px <= 0) return -Infinity;
    return log2(pxGivenY / px);
  }

  /* Die example: P(5) = 1/6, but P(5 | result > 4) = 1/2.
     PMI(5, "result > 4") = log2( (1/2) / (1/6) ) = log2(3) bits. */
  function dieExample() {
    const p5 = 1 / 6;
    const p5GivenGt4 = 1 / 2;
    return {
      p5,
      p5GivenGt4,
      ratio: p5GivenGt4 / p5,
      pmi: pmiFromConditional(p5GivenGt4, p5)
    };
  }

  /* All observed unordered pairs (i < j, f > 0) with their stats, sorted. */
  function topPairs(F, vocab, k, sortBy) {
    const rs = rowSums(F), cs = colSums(F), N = totalN(F);
    const out = [];
    for (let i = 0; i < F.length; i++) {
      for (let j = i + 1; j < F[i].length; j++) {
        const f = F[i][j];
        if (f <= 0) continue;
        const exp = (rs[i] * cs[j]) / N;
        const p = pmiFromCounts(f, rs[i], cs[j], N);
        out.push({
          a: vocab[i], b: vocab[j], i, j, f,
          expected: exp,
          ratio: f / exp,
          pmi: p,
          ppmi: ppmi(p),
          pij: f / N
        });
      }
    }
    const key = sortBy === 'pmi' ? (x) => x.pmi : (x) => x.f;
    out.sort((x, y) => key(y) - key(x));
    return k ? out.slice(0, k) : out;
  }

  return {
    CORPUS, VOCAB, WINDOW,
    log2, tokenize, mulberry32,
    buildCooccurrence, rowSums, colSums, totalN,
    jointProb, marginalProb, expectedCount, contingency,
    pmiFromCounts, pmi, pmiMatrix, ppmi, ppmiMatrix, mutualInformation,
    pmiFromProbs, pmiFromConditional, dieExample, topPairs
  };
});
