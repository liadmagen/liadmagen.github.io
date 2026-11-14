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

  /* Every co-occurrence "event": an unordered pair of vocabulary tokens that
     sit within `windowSize` positions of each other IN THE SAME SENTENCE.
     Stopwords (anything outside VOCAB) are never targets, but they still
     occupy positions and so widen the gap between neighbours.
     Returns [{s: sentence index, i: left token position, j: right token
     position, wi: vocab index of left word, wj: vocab index of right word}]. */
  function pairEvents(corpus, windowSize, vocab) {
    const sents = (corpus || CORPUS).map(tokenize);
    const w = windowSize || WINDOW;
    const voc = vocab || VOCAB;
    const index = {};
    voc.forEach((word, i) => { index[word] = i; });
    const out = [];
    sents.forEach((toks, s) => {
      for (let i = 0; i < toks.length; i++) {
        const wi = index[toks[i]];
        if (wi === undefined) continue;
        for (let d = 1; d <= w; d++) {
          const j = i + d;
          if (j >= toks.length) break;
          const wj = index[toks[j]];
          if (wj === undefined) continue;
          out.push({ s, i, j, wi, wj });
        }
      }
    });
    return out;
  }

  /* Co-occurrence matrix F over VOCAB. Every pair event adds 1 to BOTH F[a][b]
     and F[b][a] (symmetric matrix). So:
       F[x][y]   = count(x, y), the number of pairs of x with y  (x != y)
       row sum   = count(x), the number of "pair ends" that x occupies
       N         = sum of all cells = 2 * #pairs  (every pair has two ends)
     and P(x,y) = F[x][y] / N, P(x) = count(x) / N are proper distributions. */
  function buildCooccurrence(corpus, windowSize) {
    const w = windowSize || WINDOW;
    const vocab = VOCAB.slice();
    const index = {};
    vocab.forEach((word, i) => { index[word] = i; });
    const V = vocab.length;
    const F = [];
    for (let i = 0; i < V; i++) F.push(new Array(V).fill(0));
    const events = pairEvents(corpus, w, vocab);
    events.forEach((e) => { F[e.wi][e.wj] += 1; F[e.wj][e.wi] += 1; });
    return { vocab, index, F, N: totalN(F), pairs: events.length, events, windowSize: w, nSentences: (corpus || CORPUS).length };
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

  /* Expected number of pairs of x with y if words paired up by pure chance:
     count(x) * count(y) / N. */
  function expectedCount(F, i, j) {
    const rs = rowSums(F), cs = colSums(F), N = totalN(F);
    return (rs[i] * cs[j]) / N;
  }

  /* PMI from raw counts: PMI = log2( count(x,y) * N / (count(x) * count(y)) ).
     count(x,y) = 0 gives log(0) = -Infinity. */
  function pmiFromCounts(fij, fi, fj, N) {
    if (fij <= 0 || fi <= 0 || fj <= 0) return -Infinity;
    return log2((fij * N) / (fi * fj));
  }

  function pmi(F, i, j) {
    const rs = rowSums(F), cs = colSums(F);
    return pmiFromCounts(F[i][j], rs[i], cs[j], totalN(F));
  }

  /* PMI for every cell. The diagonal (a word paired with itself) is not a
     meaningful question for this counting scheme, so it is NaN ("n/a"), not
     -Infinity. Off-diagonal cells with count 0 are -Infinity. */
  function pmiMatrix(F) {
    const rs = rowSums(F), cs = colSums(F), N = totalN(F);
    return F.map((row, i) => row.map((f, j) => (i === j ? NaN : pmiFromCounts(f, rs[i], cs[j], N))));
  }

  /* PPMI: positive PMI = max(PMI, 0). Clips negatives, -Infinity and NaN to 0. */
  function ppmi(x) { return x > 0 ? x : 0; }

  function ppmiMatrix(F) {
    return pmiMatrix(F).map(row => row.map(ppmi));
  }

  /* Mutual information: I(X,Y) = sum_x sum_y p(x,y) * PMI(x,y) = E[PMI], the
     average PMI weighted by how often each pair happens (0 * log 0 := 0). */
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

  /* Everything the page ever shows about one pair of words. */
  function pairStats(F, vocab, i, j) {
    const rs = rowSums(F), cs = colSums(F), N = totalN(F);
    const f = F[i][j];
    const expected = N > 0 ? (rs[i] * cs[j]) / N : 0;
    const p = pmiFromCounts(f, rs[i], cs[j], N);
    return {
      a: vocab[i], b: vocab[j], i, j, f,
      ci: rs[i], cj: cs[j], N,
      expected,
      ratio: expected > 0 ? f / expected : NaN,
      pmi: p, ppmi: ppmi(p), pij: N > 0 ? f / N : 0
    };
  }

  /* All observed unordered pairs (i < j, count >= minCount (default 1)) with
     their stats, sorted by raw count ('count') or by PMI ('pmi'). Ties are
     broken by the other measure and then alphabetically, so order is stable. */
  function topPairs(F, vocab, k, sortBy, minCount) {
    const min = Math.max(1, minCount || 1);
    const out = [];
    for (let i = 0; i < F.length; i++) {
      for (let j = i + 1; j < F[i].length; j++) {
        if (F[i][j] < min) continue;
        out.push(pairStats(F, vocab, i, j));
      }
    }
    const byPmi = sortBy === 'pmi';
    out.sort((x, y) => {
      const d = byPmi ? (y.pmi - x.pmi) || (y.f - x.f) : (y.f - x.f) || (y.pmi - x.pmi);
      return d || (x.a + x.b < y.a + y.b ? -1 : 1);
    });
    return k ? out.slice(0, k) : out;
  }

  /* Context-distribution smoothing (Levy, Goldberg & Dagan 2015): the context
     word's probability is estimated from count(y)^alpha instead of count(y):
       P_alpha(y) = count(y)^alpha / sum_w count(w)^alpha
       PMI_alpha(x,y) = log2( P(x,y) / (P(x) * P_alpha(y)) )
     alpha < 1 gives rare context words a little extra probability, which
     lowers their (inflated) PMI. Not symmetric in x and y any more. */
  function pmiSmoothed(F, i, j, alpha) {
    const rs = rowSums(F), cs = colSums(F), N = totalN(F);
    const a = alpha === undefined ? 0.75 : alpha;
    if (F[i][j] <= 0 || rs[i] <= 0 || cs[j] <= 0) return -Infinity;
    let z = 0;
    for (let w = 0; w < cs.length; w++) z += Math.pow(cs[w], a);
    const pxy = F[i][j] / N, px = rs[i] / N, pyA = Math.pow(cs[j], a) / z;
    return log2(pxy / (px * pyA));
  }

  /* --- chance, made tangible: the shuffle experiment -------------------------
     The corpus has `pairs` pairs and N = 2*pairs "pair ends". Put one chip per
     end into a bag (word w appears count(w) times), shuffle, and deal the chips
     back out two at a time. Each deal is "what pairs would look like if words
     paired up purely by chance". */
  function shuffledPairs(F, rng) {
    const rs = rowSums(F);
    const chips = [];
    rs.forEach((c, w) => { for (let k = 0; k < c; k++) chips.push(w); });
    for (let k = chips.length - 1; k > 0; k--) {
      const r = Math.floor(rng() * (k + 1));
      const t = chips[k]; chips[k] = chips[r]; chips[r] = t;
    }
    const out = [];
    for (let k = 0; k + 1 < chips.length; k += 2) out.push([chips[k], chips[k + 1]]);
    return out;
  }
  function countPairIn(pairList, i, j) {
    let n = 0;
    pairList.forEach((p) => { if ((p[0] === i && p[1] === j) || (p[0] === j && p[1] === i)) n++; });
    return n;
  }
  /* counts of pair (i,j) in `trials` seeded shuffles, in order */
  function shuffleCounts(F, i, j, trials, seed) {
    const rng = mulberry32(seed === undefined ? 1 : seed);
    const out = [];
    for (let t = 0; t < trials; t++) out.push(countPairIn(shuffledPairs(F, rng), i, j));
    return out;
  }

  /* --- a real 2-D map of the words: truncated SVD of the PPMI matrix -------------
     PPMI is symmetric, so its SVD comes from a symmetric eigendecomposition
     (cyclic Jacobi rotations: tiny, dependency-free, deterministic). */
  function symmetricEigen(A) {
    const n = A.length;
    const a = A.map(r => r.slice());
    const V = [];
    for (let i = 0; i < n; i++) { V.push(new Array(n).fill(0)); V[i][i] = 1; }
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
      if (off < 1e-26) break;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          const apq = a[p][q];
          if (Math.abs(apq) < 1e-300) continue;
          const theta = (a[q][q] - a[p][p]) / (2 * apq);
          const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          const c = 1 / Math.sqrt(t * t + 1), s = t * c;
          for (let k = 0; k < n; k++) {
            const akp = a[k][p], akq = a[k][q];
            a[k][p] = c * akp - s * akq;
            a[k][q] = s * akp + c * akq;
          }
          for (let k = 0; k < n; k++) {
            const apk = a[p][k], aqk = a[q][k];
            a[p][k] = c * apk - s * aqk;
            a[q][k] = s * apk + c * aqk;
          }
          for (let k = 0; k < n; k++) {
            const vkp = V[k][p], vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq;
            V[k][q] = s * vkp + c * vkq;
          }
        }
      }
    }
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    order.sort((x, y) => Math.abs(a[y][y]) - Math.abs(a[x][x]) || x - y);
    const values = order.map(k => a[k][k]);
    const vectors = order.map((k) => {
      const v = V.map(row => row[k]);
      // deterministic sign: the largest-magnitude component is positive
      let big = 0;
      for (let i = 1; i < n; i++) if (Math.abs(v[i]) > Math.abs(v[big]) + 1e-12) big = i;
      return v[big] < 0 ? v.map(x => -x) : v;
    });
    return { values, vectors };
  }

  /* Word coordinates = U_k * sqrt(sigma_k), the usual SVD embedding. For a
     symmetric matrix, U = the eigenvectors and sigma = |eigenvalues|.
     `dims` is either a number k (use the k biggest directions) or an array of
     direction indices (0 = biggest), e.g. [0, 2]. */
  function embed(M, dims) {
    const { values, vectors } = symmetricEigen(M);
    const use = Array.isArray(dims) ? dims : Array.from({ length: dims || 2 }, (_, k) => k);
    const coords = M.map((_, i) => use.map(c => vectors[c][i] * Math.sqrt(Math.abs(values[c]))));
    return { coords, values, vectors, dims: use };
  }

  function cosine(u, v) {
    let d = 0, a = 0, b = 0;
    for (let k = 0; k < u.length; k++) { d += u[k] * v[k]; a += u[k] * u[k]; b += v[k] * v[k]; }
    return a > 0 && b > 0 ? d / Math.sqrt(a * b) : 0;
  }

  return {
    CORPUS, VOCAB, WINDOW,
    log2, tokenize, mulberry32,
    buildCooccurrence, rowSums, colSums, totalN,
    pairEvents, jointProb, marginalProb, expectedCount,
    pmiFromCounts, pmi, pmiMatrix, ppmi, ppmiMatrix, mutualInformation, pmiSmoothed,
    pmiFromProbs, pmiFromConditional, dieExample, pairStats, topPairs,
    shuffledPairs, countPairIn, shuffleCounts, symmetricEigen, embed, cosine
  };
});
