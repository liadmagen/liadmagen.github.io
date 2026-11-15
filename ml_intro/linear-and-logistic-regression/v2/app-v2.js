/* ============================================================
   v2 — "From a Number to a Yes" rebuilt on anime.js (vanilla JS, no D3)
   Same 13 scenes & data as v1; animations are anime.js timelines
   triggered per step by IntersectionObserver (scroll = trigger).
   ============================================================ */
(() => {
"use strict";

/* ---------- anime resolution (v4 UMD: anime.animate(t, p) · v3: anime({targets,...})) ---------- */
function resolveAnime() {
  if (typeof window.anime === 'function') return (t, p) => window.anime(Object.assign({}, p, { targets: t }));
  if (window.anime && typeof window.anime.animate === 'function') return (t, p) => window.anime.animate(t, p);
  if (window.animejs && typeof window.animejs.anime === 'function') return (t, p) => window.animejs.anime(Object.assign({}, p, { targets: t }));
  return null;
}
const anime = resolveAnime();
const stagger = (window.anime && window.anime.stagger) || ((v) => v);
const A = (t, p) => { if (anime) { try { anime(t, p); } catch (_) {} } };

/* ---------- data ---------- */
const E = DATA.essays, OLS = DATA.ols, GD = DATA.gd, GRID = DATA.grid,
      READ = DATA.readability, LL = DATA.linOnLabels, SP = DATA.spam;
const N = E.n;
const lab = READ.labels;
const sig = z => 1 / (1 + Math.exp(-z));
const C = { ink: "#4a5060", blue: "#0072B2", verm: "#D55E00", orange: "#E69F00",
            green: "#009E73", red: "#b91c1c", gray: "#9aa0a6", muted: "#6d7280" };

/* ---------- svg helpers ---------- */
const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('chart');
const S = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  (parent || svg).appendChild(n);
  return n;
};
const txt = (parent, x, y, str, attrs) => {
  const t = S('text', Object.assign({ x, y }, attrs || {}), parent);
  t.textContent = str; return t;
};
const sc = (dom, ran) => {
  const f = v => ran[0] + (v - dom[0]) / (dom[1] - dom[0]) * (ran[1] - ran[0]);
  f.invert = v => dom[0] + (v - ran[0]) / (ran[1] - ran[0]) * (dom[1] - dom[0]);
  return f;
};
const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hex = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const mix = (c1, c2, t) => { const a = hex(c1), b = hex(c2); return 'rgb(' + a.map((v,i)=>Math.round(lerp(v,b[i],t))).join(',') + ')'; };
const fmtI = v => Math.round(v).toLocaleString('en-US');
const mseOf = (b0, b1) => E.x.reduce((s, xv, i) => s + (E.y[i] - (b0 + b1 * xv)) ** 2, 0) / N;

/* ---------- geometry (same canvas as v1) ---------- */
const W = 680, H = 560, M = { t: 34, r: 30, b: 58, l: 64 };
const IW = W - M.l - M.r, IH = H - M.t - M.b;
const xE  = sc([5, 29], [M.l, W - M.r]);
const ySc = sc([0, 105], [M.t + IH, M.t]);
const yPr = sc([-0.45, 1.45], [M.t + IH, M.t]);
const xSp = sc([-0.6, 9.6], [M.l, W - M.r]);
const L5 = [M.l, M.l + IW * 0.50], C5 = [M.l + IW * 0.62, W - M.r];
const xE5 = sc([5, 29], L5);
const cB0 = sc([GRID.b0[0], GRID.b0[GRID.b0.length - 1]], C5);
const cB1 = sc([GRID.b1[0], GRID.b1[GRID.b1.length - 1]], [M.t + IH - 6, M.t + 40]);
const maxIt = Math.max(GD.trajSmall.length, GD.trajGood.length, GD.trajLarge.length);
const xSt = sc([0, maxIt], [M.l + 18, W - M.r - 18]);
const yLs = sc([0, 3400], [M.t + IH, M.t + 10]);

/* ---------- layers ---------- */
const L = {};
['axes1','axes2','axesSp','zone','strips','heat','ball','loss','ghost','resid','squares',
 'model','user','dots','spam','marks','extras','coda','handles'].forEach(k => { L[k] = S('g', {}); });
const show = keys => Object.keys(L).forEach(k => L[k].style.opacity = keys.includes(k) ? 1 : 0);

/* axes act 1 */
(function () {
  const g = L.axes1;
  S('line', { x1: M.l, x2: W - M.r, y1: ySc(0), y2: ySc(0), stroke: '#c9c4b8' }, g);
  [6, 10, 14, 18, 22, 26].forEach(t => {
    S('line', { x1: xE(t), x2: xE(t), y1: ySc(0) - 4, y2: ySc(0) + 4, stroke: '#c9c4b8' }, g);
    txt(g, xE(t), ySc(0) + 19, String(t), { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11 });
  });
  txt(g, (M.l + W - M.r) / 2, H - 14, 'average sentence length (words)', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
  S('line', { x1: xE(5), x2: xE(5), y1: M.t, y2: M.t + IH, stroke: '#c9c4b8' }, g);
  [0, 20, 40, 60, 80, 100].forEach(t => {
    S('line', { x1: xE(5) - 4, x2: xE(5) + 4, y1: ySc(t), y2: ySc(t), stroke: '#c9c4b8' }, g);
    txt(g, xE(5) - 9, ySc(t) + 4, String(t), { 'text-anchor': 'end', fill: C.muted, 'font-size': 11 });
  });
  const t = txt(g, 14, M.t + IH / 2, 'readability score (0–100)', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
  t.setAttribute('transform', `rotate(-90 14 ${M.t + IH / 2})`);
})();
/* axes act 2 (probability) */
(function () {
  const g = L.axes2;
  S('line', { x1: M.l, x2: W - M.r, y1: yPr(-0.45), y2: yPr(-0.45), stroke: '#c9c4b8' }, g);
  [6, 10, 14, 18, 22, 26].forEach(t => {
    S('line', { x1: xE(t), x2: xE(t), y1: yPr(-0.45) - 4, y2: yPr(-0.45) + 4, stroke: '#c9c4b8' }, g);
    txt(g, xE(t), yPr(-0.45) + 19, String(t), { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11 });
  });
  txt(g, (M.l + W - M.r) / 2, H - 14, 'average sentence length (words)', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
  S('line', { x1: xE(5), x2: xE(5), y1: M.t, y2: M.t + IH, stroke: '#c9c4b8' }, g);
  ['0', '0.5', '1'].forEach(t => {
    S('line', { x1: xE(5) - 4, x2: xE(5) + 4, y1: yPr(+t), y2: yPr(+t), stroke: '#c9c4b8' }, g);
    txt(g, xE(5) - 9, yPr(+t) + 4, t, { 'text-anchor': 'end', fill: C.muted, 'font-size': 11 });
  });
  const t = txt(g, 14, M.t + IH / 2, 'probability', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
  t.setAttribute('transform', `rotate(-90 14 ${M.t + IH / 2})`);
})();
/* spam axes */
(function () {
  const g = L.axesSp;
  S('line', { x1: M.l, x2: W - M.r, y1: yPr(-0.45), y2: yPr(-0.45), stroke: '#c9c4b8' }, g);
  for (let i = 0; i <= 9; i++) {
    S('line', { x1: xSp(i), x2: xSp(i), y1: yPr(-0.45) - 4, y2: yPr(-0.45) + 4, stroke: '#c9c4b8' }, g);
    txt(g, xSp(i), yPr(-0.45) + 19, String(i), { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11 });
  }
  txt(g, (M.l + W - M.r) / 2, H - 14, 'times “free” appears in the email', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
  S('line', { x1: xSp(-0.6), x2: xSp(-0.6), y1: M.t, y2: M.t + IH, stroke: '#c9c4b8' }, g);
  ['0', '0.5', '1'].forEach(t => {
    S('line', { x1: xSp(-0.6) - 4, x2: xSp(-0.6) + 4, y1: yPr(+t), y2: yPr(+t), stroke: '#c9c4b8' }, g);
    txt(g, xSp(-0.6) - 9, yPr(+t) + 4, t, { 'text-anchor': 'end', fill: C.muted, 'font-size': 11 });
  });
  const t = txt(g, 14, M.t + IH / 2, 'P(spam)', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
  t.setAttribute('transform', `rotate(-90 14 ${M.t + IH / 2})`);
})();
/* zone + strips */
(function () {
  const z = L.zone;
  S('rect', { x: M.l, width: IW, y: yPr(1), height: yPr(0) - yPr(1), fill: '#f1efe8' }, z);
  [[1, '1'], [0, '0']].forEach(([v, t]) => {
    S('line', { x1: M.l, x2: W - M.r, y1: yPr(v), y2: yPr(v), stroke: '#c9c4b8', 'stroke-dasharray': '2 4' }, z);
    txt(z, W - M.r + 6, yPr(v) + 4, t, { fill: C.muted, 'font-size': 11 });
  });
  txt(z, W - M.r - 8, yPr(1) - 8, 'the probability zone: 0 … 1', { 'text-anchor': 'end', fill: C.muted, 'font-size': 11.5 });
  const st = L.strips;
  S('rect', { x: M.l, width: IW, y: yPr(1), height: yPr(0.72) - yPr(1), fill: C.blue, 'fill-opacity': 0.06 }, st);
  S('rect', { x: M.l, width: IW, y: yPr(0.28), height: yPr(0) - yPr(0.28), fill: C.orange, 'fill-opacity': 0.08 }, st);
  txt(st, W - M.r - 8, yPr(0.93), 'readable', { 'text-anchor': 'end', fill: C.blue, 'font-size': 12 });
  txt(st, W - M.r - 8, yPr(0.07), 'not readable', { 'text-anchor': 'end', fill: '#b47400', 'font-size': 12 });
})();
/* dots */
const dots = E.x.map((x, i) => S('circle', { r: 5.4, fill: C.ink, stroke: '#fff', 'stroke-width': 1 }, L.dots));
const posScore = i => [xE(E.x[i]), ySc(E.y[i])];
const posStrip = i => [xE(E.x[i]), yPr(lab[i] ? 0.86 : 0.14)];
const fillRead = i => lab[i] ? C.blue : C.orange;
/* spam dots */
const SPJ = (() => {
  const groups = {};
  SP.counts.forEach((c, i) => { const k = c + '-' + SP.labels[i]; (groups[k] = groups[k] || []).push(i); });
  const y = new Array(SP.counts.length).fill(0);
  Object.values(groups).forEach(gn => gn.forEach((i, j) => { y[i] = (j - (gn.length - 1) / 2) * 9; }));
  return y;
})();
const spamDots = SP.counts.map((c, i) => S('circle', { r: 5.4, stroke: '#fff', 'stroke-width': 1, fill: SP.labels[i] ? C.verm : C.blue }, L.spam));
const posSpam = i => [xSp(SP.counts[i]), yPr(SP.labels[i] ? 0.86 : 0.14) + SPJ[i]];
/* lines */
const lineD = (b0, b1, xs, ys, x0 = 5, x1 = 29) => `M${xs(x0)},${ys(b0 + b1 * x0)}L${xs(x1)},${ys(b0 + b1 * x1)}`;
const curveD = (f, xs, ys, x0, x1, step = 0.25) => {
  let d = '';
  for (let x = x0; x <= x1 + 1e-9; x += step) d += (d ? 'L' : 'M') + xs(x).toFixed(2) + ',' + ys(f(x)).toFixed(2);
  return d;
};
const modeline = S('path', { fill: 'none', stroke: C.blue, 'stroke-width': 3 }, L.model);
const userline = S('path', { fill: 'none', stroke: C.verm, 'stroke-width': 2.6 }, L.user);
const CANDS = [[100,-1.2],[150,-3.9],[60,-1.8],[118,-2.9],[135,-4.4],[OLS.b0-6, OLS.b1+0.6]];
const ghost = CANDS.map(([b0, b1]) => S('path', { fill: 'none', stroke: C.gray, 'stroke-width': 2, d: lineD(b0, b1, xE, ySc) }, L.ghost));
const ghostBest = S('path', { fill: 'none', stroke: C.green, 'stroke-width': 2.4, 'stroke-dasharray': '6 5', opacity: 0, d: lineD(OLS.b0, OLS.b1, xE, ySc) }, L.ghost);
const resids = E.x.map((x, i) => S('line', { stroke: C.verm, 'stroke-width': 1.4, 'stroke-opacity': 0.85, opacity: 0 }, L.resid));
const squares = E.x.map((x, i) => S('rect', { fill: C.verm, 'fill-opacity': 0.13, stroke: C.verm, 'stroke-opacity': 0.45, 'stroke-width': 1, opacity: 0 }, L.squares));
/* heat landscape (hot-cold scene) */
(function () {
  const g = L.heat;
  const lo = OLS.mse * 0.98, hi = OLS.mse * 7;
  const gw = (C5[1] - C5[0]) / (GRID.b0.length - 1), gh = (cB1(GRID.b1[0]) - cB1(GRID.b1[GRID.b1.length - 1])) / (GRID.b1.length - 1);
  GRID.b1.forEach((b1, j) => GRID.b0.forEach((b0, i) => {
    const l = GRID.loss[j][i];
    S('rect', {
      x: cB0(b0) - gw / 2, y: cB1(b1) - gh / 2, width: gw + 0.6, height: gh + 0.6,
      fill: mix('#fee391', '#d73027', clamp01((l - lo) / (hi - lo)))
    }, g);
  }));
  S('rect', { x: C5[0], y: cB1(GRID.b1[GRID.b1.length - 1]) - gh / 2, width: C5[1] - C5[0], height: cB1(GRID.b1[0]) - cB1(GRID.b1[GRID.b1.length - 1]) + gh, fill: 'none', stroke: '#b8b2a4' }, g);
  txt(g, (C5[0] + C5[1]) / 2, M.t + 16, 'the loss landscape — color = error (red = hot, yellow = cold)', { 'text-anchor': 'middle', fill: '#4a4f5a', 'font-size': 12, 'font-weight': 600 });
  txt(g, (C5[0] + C5[1]) / 2, M.t + IH + 18, 'w₁ →', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
  const t = txt(g, C5[0] - 16, (M.t + 40 + M.t + IH - 6) / 2, 'w₂ →', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
  t.setAttribute('transform', `rotate(-90 ${C5[0] - 16} ${(M.t + 40 + M.t + IH - 6) / 2})`);
  S('path', { d: 'M-6,-6L6,6M-6,6L6,-6', transform: `translate(${cB0(OLS.b0)},${cB1(OLS.b1)})`, stroke: '#fff', 'stroke-width': 2.6, fill: 'none' }, g);
  S('line', { x1: L5[0], x2: L5[1], y1: ySc(0), y2: ySc(0), stroke: '#c9c4b8' }, g);
  [0, 50, 100].forEach(v => {
    S('line', { x1: L5[0], x2: L5[0] - 4, y1: ySc(v), y2: ySc(v), stroke: '#c9c4b8' }, g);
    txt(g, L5[0] - 8, ySc(v) + 4, String(v), { 'text-anchor': 'end', fill: C.muted, 'font-size': 11 });
  });
  txt(g, (L5[0] + L5[1]) / 2, M.t + 16, 'the model’s current line', { 'text-anchor': 'middle', fill: '#4a4f5a', 'font-size': 12, 'font-weight': 600 });
  txt(g, (L5[0] + L5[1]) / 2, M.t + IH + 18, 'sentence length →', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
})();
const ballTrail = S('path', { fill: 'none', stroke: '#1f2430', 'stroke-width': 2, opacity: 0.9 }, L.ball);
const ball = S('circle', { r: 6.5, fill: '#1f2430', stroke: '#fff', 'stroke-width': 1.6, opacity: 0 }, L.ball);
/* loss curves (learning rate) */
(function () {
  const g = L.loss;
  S('line', { x1: M.l + 18, x2: W - M.r - 18, y1: yLs(0), y2: yLs(0), stroke: '#c9c4b8' }, g);
  S('line', { x1: M.l + 18, x2: M.l + 18, y1: yLs(0), y2: yLs(3400), stroke: '#c9c4b8' }, g);
  for (let t = 0; t <= 60; t += 20) {
    S('line', { x1: xSt(t), x2: xSt(t), y1: yLs(0) - 4, y2: yLs(0) + 4, stroke: '#c9c4b8' }, g);
    txt(g, xSt(t), yLs(0) + 19, String(t), { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11 });
  }
  [0, 1000, 2000, 3000].forEach(v => {
    S('line', { x1: M.l + 14, x2: M.l + 18, y1: yLs(v), y2: yLs(v), stroke: '#c9c4b8' }, g);
    txt(g, M.l + 10, yLs(v) + 4, String(v), { 'text-anchor': 'end', fill: C.muted, 'font-size': 11 });
  });
  txt(g, (M.l + W - M.r) / 2, H - 14, 'training step →', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
  const t = txt(g, 14, M.t + IH / 2, 'loss (squared error)', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
  t.setAttribute('transform', `rotate(-90 14 ${M.t + IH / 2})`);
})();
const REGIMES = [
  { key: 'trajSmall', color: C.gray, label: 'α = 0.002 — too small: crawls forever' },
  { key: 'trajLarge', color: C.verm, label: 'α = 1.1 — too large: overshoots, loss explodes' },
  { key: 'trajGood',  color: C.blue, label: 'α = 0.099 — just right: settles at the bottom' }
];
const regimePaths = REGIMES.map(r => {
  const d = GD[r.key].map((t, i) => (i ? 'L' : 'M') + xSt(i).toFixed(1) + ',' + yLs(Math.min(3400, t[2])).toFixed(1)).join('');
  return S('path', { d, fill: 'none', stroke: r.color, 'stroke-width': 2.6, opacity: 0 }, L.loss);
});
const regimeDots = REGIMES.map(r => S('circle', { r: 5, fill: r.color, stroke: '#fff', 'stroke-width': 1.4, opacity: 0 }, L.loss));
const regimeLbls = REGIMES.map((r, k) => txt(L.loss, 60, 60 + k * 24, r.label, { fill: r.color, 'font-size': 12, 'font-weight': 'bold', opacity: 0 }));
/* extras */
const ex = L.extras;
const eGuide = S('line', { stroke: C.muted, 'stroke-dasharray': '4 4', opacity: 0 }, ex);
const eDot = S('circle', { r: 7, fill: '#fff', stroke: C.blue, 'stroke-width': 2.4, opacity: 0 }, ex);
const eLbl = txt(ex, 0, 0, '', { 'font-size': 13, 'font-weight': 600, fill: C.blue, opacity: 0 });
const llL1 = txt(ex, 0, 0, '', { 'font-size': 12.5, 'font-weight': 600, fill: C.red, 'text-anchor': 'middle', opacity: 0 });
const llL2 = txt(ex, 0, 0, '', { 'font-size': 12.5, 'font-weight': 600, fill: C.red, 'text-anchor': 'middle', opacity: 0 });
const tLine = S('line', { stroke: C.red, 'stroke-dasharray': '5 4', 'stroke-width': 1.6, opacity: 0 }, ex);
const tLbl = txt(ex, 0, 0, '', { 'font-size': 11.5, fill: C.red, opacity: 0 });
const bLine = S('line', { stroke: C.verm, 'stroke-dasharray': '5 4', 'stroke-width': 1.6, opacity: 0 }, ex);
const bLbl = txt(ex, 0, 0, '', { 'font-size': 11.5, fill: C.verm, 'text-anchor': 'middle', opacity: 0 });
/* misclassification marks */
const misIdx = [];
for (let i = 0; i < N; i++) if (((sig(READ.b0 + READ.b1 * E.x[i]) >= 0.5) ? 1 : 0) !== lab[i]) misIdx.push(i);
const marks = misIdx.map(i => {
  const g = S('g', { opacity: 0 }, L.marks);
  S('circle', { r: 9.5, fill: 'none', stroke: C.red, 'stroke-width': 1.8 }, g);
  S('path', { d: 'M-4.5,-4.5L4.5,4.5M-4.5,4.5L4.5,-4.5', stroke: C.red, 'stroke-width': 1.8 }, g);
  return g;
});
/* coda */
const codaGs = (() => {
  const g = L.coda;
  const yTop = M.t + 70, yBot = M.t + IH - 46;
  const xCl = sc([5, 29], [M.l + 26, M.l + IW * 0.40]);
  const xCr = sc([5, 29], [M.l + IW * 0.62, W - M.r - 26]);
  const yCl = sc([0, 105], [yBot, yTop]);
  const yCr = sc([-0.05, 1.05], [yBot, yTop]);
  S('line', { x1: W / 2, x2: W / 2, y1: yTop - 28, y2: yBot + 34, stroke: '#dcd8cf' }, g);
  const Lc = S('g', { opacity: 0 }, g), Rc = S('g', { opacity: 0 }, g);
  txt(Lc, (xCl(5) + xCl(29)) / 2, yTop - 36, 'the number machine', { 'text-anchor': 'middle', fill: '#4a4f5a', 'font-size': 12, 'font-weight': 600 });
  S('line', { x1: xCl(5), x2: xCl(29), y1: yBot, y2: yBot, stroke: '#c9c4b8' }, Lc);
  S('path', { fill: 'none', stroke: C.blue, 'stroke-width': 2.6, d: lineD(OLS.b0, OLS.b1, xCl, yCl) }, Lc);
  const p12 = OLS.b0 + OLS.b1 * 12;
  S('circle', { cx: xCl(12), cy: yCl(p12), r: 6, fill: '#fff', stroke: C.blue, 'stroke-width': 2.2 }, Lc);
  txt(Lc, xCl(12) + 10, yCl(p12) + 4, 'ŷ ≈ ' + Math.round(p12), { 'font-size': 12.5, fill: C.blue });
  txt(Lc, (xCl(5) + xCl(29)) / 2, yBot + 20, 'linear: ŷ = β0 + β1·x', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 12 });
  txt(Rc, (xCr(5) + xCr(29)) / 2, yTop - 36, 'the probability machine', { 'text-anchor': 'middle', fill: '#4a4f5a', 'font-size': 12, 'font-weight': 600 });
  S('line', { x1: xCr(5), x2: xCr(29), y1: yBot, y2: yBot, stroke: '#c9c4b8' }, Rc);
  S('path', { fill: 'none', stroke: C.verm, 'stroke-width': 2.6, d: curveD(x => sig(READ.b0 + READ.b1 * x), xCr, yCr, 5, 29) }, Rc);
  S('circle', { cx: xCr(8), cy: yCr(sig(READ.b0 + READ.b1 * 8)), r: 6, fill: '#fff', stroke: C.verm, 'stroke-width': 2.2 }, Rc);
  txt(Rc, xCr(8) + 10, yCr(sig(READ.b0 + READ.b1 * 8)) + 4, 'P ≈ 0.96', { 'font-size': 12.5, fill: C.verm });
  txt(Rc, (xCr(5) + xCr(29)) / 2, yBot + 20, 'logistic: P = σ(β0 + β1·x)', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 12 });
  return [Lc, Rc];
})();
/* drag handles */
const Sstate = { userLine: null, hy: [ySc(128 - 3.6 * 8), ySc(128 - 3.6 * 26)], slider: 0.5 };
const handles = [0, 1].map(i => S('circle', { r: 10, 'class': 'handle', cx: xE(i ? 26 : 8), cy: Sstate.hy[i] }, L.handles));
function lineFromHandles() {
  const y1 = ySc.invert(Sstate.hy[0]), y2 = ySc.invert(Sstate.hy[1]);
  const b1 = (y2 - y1) / 18;
  return { b0: y1 - b1 * 8, b1 };
}
function svgPoint(ev) {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  return { x: (ev.clientX - r.left) / r.width * vb.width, y: (ev.clientY - r.top) / r.height * vb.height };
}
handles.forEach((h, i) => {
  h.addEventListener('pointerdown', ev => {
    h.setPointerCapture(ev.pointerId);
    const move = e2 => {
      const pt = svgPoint(e2);
      Sstate.hy[i] = Math.max(M.t + 10, Math.min(M.t + IH - 10, pt.y));
      Sstate.userLine = lineFromHandles();
      renderActive();
    };
    const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); };
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
  });
});

/* ---------- chip / hud ---------- */
const chipEl = document.getElementById('chip'), hudEl = document.getElementById('hud');
const setChip = html => { chipEl.innerHTML = html; };
const setHud = (act, n, title) => { hudEl.textContent = `Act ${act} · ${n}/13 — ${title}`; };

/* ---------- scenes ---------- */
const scenes = {};
const resetExtras = () => [eGuide, eDot, eLbl, llL1, llL2, tLine, tLbl, bLine, bLbl].forEach(e => e.setAttribute('opacity', 0));

scenes.s01 = () => {
  show(['axes1', 'dots']);
  setHud(1, 1, 'forty essays, one hunch');
  dots.forEach((d, i) => { d.setAttribute('cx', posScore(i)[0]); d.setAttribute('cy', posScore(i)[1]); d.setAttribute('fill', C.ink); d.setAttribute('fill-opacity', 0); });
  A(dots, { fillOpacity: [0, 1], duration: 700, delay: stagger(28), easing: 'easeOutQuad' });
  setChip(`<span class='lbl'>40 essays · sentence length vs. readability — can one number predict the other?</span>`);
};

scenes.s02 = () => {
  show(['axes1', 'dots', 'user', 'handles']);
  setHud(1, 2, 'draw your best line');
  dots.forEach((d, i) => { d.setAttribute('cx', posScore(i)[0]); d.setAttribute('cy', posScore(i)[1]); d.setAttribute('fill-opacity', 1); d.setAttribute('fill', C.ink); });
  const Ln = Sstate.userLine || { b0: DATA.defaultLine[0], b1: DATA.defaultLine[1] };
  userline.setAttribute('d', lineD(Ln.b0, Ln.b1, xE, ySc));
  userline.setAttribute('stroke-dasharray', Sstate.userLine ? '' : '6 5');
  userline.setAttribute('stroke-opacity', Sstate.userLine ? 1 : 0.65);
  handles.forEach((h, i) => h.setAttribute('cy', Sstate.hy[i]));
  A(userline, { opacity: [0, 1], duration: 500 });
  setChip(Sstate.userLine
    ? `your line — total squared error: <b>${fmtI(mseOf(Sstate.userLine.b0, Sstate.userLine.b1))}</b> <span class="lbl">(lower = better)</span>`
    : 'drag the two handles to draw your own line');
};

scenes.s03 = () => {
  show(['axes1', 'dots', 'user', 'resid', 'squares']);
  setHud(1, 3, 'residuals → squares');
  const Ln = Sstate.userLine || { b0: DATA.defaultLine[0], b1: DATA.defaultLine[1] };
  dots.forEach((d, i) => { d.setAttribute('cx', posScore(i)[0]); d.setAttribute('cy', posScore(i)[1]); d.setAttribute('fill-opacity', 1); });
  userline.setAttribute('d', lineD(Ln.b0, Ln.b1, xE, ySc)); userline.setAttribute('stroke-dasharray', ''); userline.setAttribute('stroke-opacity', 1);
  const total = E.x.reduce((s, xv, i) => s + (E.y[i] - (Ln.b0 + Ln.b1 * xv)) ** 2, 0);
  resids.forEach((r, i) => {
    const yl = ySc(Ln.b0 + Ln.b1 * E.x[i]);
    r.setAttribute('x1', xE(E.x[i])); r.setAttribute('x2', xE(E.x[i]));
    r.setAttribute('y1', ySc(E.y[i])); r.setAttribute('y2', yl); r.setAttribute('opacity', 0.85);
  });
  squares.forEach((q, i) => {
    const yd = ySc(E.y[i]), yl = ySc(Ln.b0 + Ln.b1 * E.x[i]);
    const side = Math.abs(yd - yl);
    q.setAttribute('x', xE(E.x[i])); q.setAttribute('width', 0); q.setAttribute('height', 0);
    q.setAttribute('y', Math.min(yd, yl)); q.setAttribute('opacity', 1);
    A(q, { width: [0, side], height: [0, side], duration: 650, delay: stagger(24), easing: 'easeOutBack(2)' });
  });
  A(resids, { opacity: [0, 0.85], duration: 500, delay: stagger(18) });
  setChip(`total squared error of this line ≈ <b>${fmtI(total)}</b> — squares can’t cancel out, big misses punished more`);
};

scenes.s04 = () => {
  show(['axes1', 'dots', 'ghost']);
  setHud(1, 4, 'every line has a number');
  dots.forEach((d, i) => { d.setAttribute('cx', posScore(i)[0]); d.setAttribute('cy', posScore(i)[1]); d.setAttribute('fill-opacity', 1); });
  ghost.forEach(g => g.setAttribute('opacity', 0.07));
  ghostBest.setAttribute('opacity', 0);
  A(ghost, { opacity: [0.07, 0.95], duration: 500, delay: stagger(320), easing: 'easeInOutQuad', direction: 'alternate', loop: 2, complete: () => {
    ghost.forEach(g => g.setAttribute('opacity', 0.07));
    A(ghostBest, { opacity: [0, 0.9], duration: 600 });
  }});
  setChip(`every line has a total squared error — one of them is <b>the best</b>; the model must find it blind`);
};

/* ---- s05: HOT & COLD — the rebuilt gradient-descent scene ---- */
scenes.s05 = () => {
  show(['heat', 'ball', 'model']);
  setHud(1, 5, 'the hot–cold game (gradient descent)');
  const T = GD.trajGood;
  const setLine = idx => {
    const b0 = T[idx][0], b1 = T[idx][1];
    modeline.setAttribute('d', lineD(b0, b1, xE5, ySc));
    modeline.setAttribute('stroke', C.blue);
  };
  setLine(0);
  ballTrail.setAttribute('d', 'M' + T.map(t => cB0(t[0]).toFixed(1) + ',' + cB1(t[1]).toFixed(1)).join('L'));
  let tl = 3000; try { tl = ballTrail.getTotalLength(); } catch (_) {}
  ballTrail.setAttribute('stroke-dasharray', String(tl));
  ballTrail.setAttribute('stroke-dashoffset', String(tl));
  ball.setAttribute('opacity', 1);
  ball.style.transform = '';
  const xs = T.map(t => cB0(t[0])), ys = T.map(t => cB1(t[1]));
  A(ballTrail, { strokeDashoffset: [tl, 0], duration: 4200, easing: 'easeInOutQuad' });
  A(ball, { translateX: xs, translateY: ys, duration: 4200, easing: 'easeInOutQuad' });
  A({ dummy: 1 }, { dummy: [0, 1], duration: 4200, easing: 'linear', update: self => {
    const p = (self.progress || 0) / 100;
    setLine(Math.min(T.length - 1, Math.round(p * (T.length - 1))));
  }});
  const last = T[T.length - 1];
  setChip(`the ball feels the slope, steps downhill, repeats — loss: <b>${fmtI(last[2])}</b> <span class="lbl">← colder… arrived at the minimum</span>`);
};

scenes.s06 = () => {
  show(['loss']);
  setHud(1, 6, 'learning rate');
  regimePaths.forEach(p => { p.setAttribute('opacity', 0); });
  regimeDots.forEach(d => d.setAttribute('opacity', 0));
  regimeLbls.forEach(l => l.setAttribute('opacity', 0));
  REGIMES.forEach((r, k) => {
    const path = regimePaths[k], T = GD[r.key];
    let len = 2000; try { len = path.getTotalLength(); } catch (_) {}
    path.setAttribute('stroke-dasharray', String(len));
    path.setAttribute('stroke-dashoffset', String(len));
    const last = T[T.length - 1];
    regimeDots[k].setAttribute('cx', xSt(T.length - 1)); regimeDots[k].setAttribute('cy', yLs(Math.min(3400, last[2])));
    A(path, { opacity: [0, 1], strokeDashoffset: [len, 0], duration: 1400, delay: k * 1500, easing: 'easeInOutQuad' });
    A(regimeDots[k], { opacity: [0, 1], duration: 400, delay: k * 1500 + 1300 });
    A(regimeLbls[k], { opacity: [0, 1], translateY: [8, 0], duration: 400, delay: k * 1500 + 1200 });
  });
  setChip(`${REGIMES[2].label}<br><span class="lbl">loss now: <b style="color:${REGIMES[2].color}">${fmtI(GD.trajGood[GD.trajGood.length-1][2])}</b> — every training run is this story</span>`);
};

scenes.s07 = () => {
  show(['axes1', 'dots', 'model', 'extras']);
  setHud(1, 7, 'the machine, assembled');
  resetExtras();
  dots.forEach((d, i) => { d.setAttribute('cx', posScore(i)[0]); d.setAttribute('cy', posScore(i)[1]); d.setAttribute('fill-opacity', 1); });
  modeline.setAttribute('d', lineD(OLS.b0, OLS.b1, xE, ySc)); modeline.setAttribute('stroke', C.blue);
  const pred = OLS.b0 + OLS.b1 * 12;
  eGuide.setAttribute('x1', xE(12)); eGuide.setAttribute('x2', xE(12));
  eGuide.setAttribute('y1', ySc(0)); eGuide.setAttribute('y2', ySc(pred));
  eDot.setAttribute('cx', xE(12)); eDot.setAttribute('cy', ySc(pred));
  eLbl.setAttribute('x', xE(12) + 12); eLbl.setAttribute('y', ySc(pred) - 10);
  eLbl.textContent = 'ŷ ≈ ' + Math.round(pred);
  A(eGuide, { opacity: [0, 1], duration: 500 });
  A(eDot, { opacity: [0, 1], cy: [ySc(0), ySc(pred)], duration: 900, delay: 300, easing: 'easeOutQuad' });
  A(eLbl, { opacity: [0, 1], duration: 500, delay: 900 });
  setChip(`the finished model: <b>ŷ = ${OLS.b0.toFixed(1)} − ${Math.abs(OLS.b1).toFixed(2)}·x</b> — feed it 12-word sentences: <b>ŷ ≈ ${Math.round(pred)}</b>`);
};

scenes.s08 = () => {
  show(['axes2', 'zone', 'strips', 'dots']);
  setHud(2, 8, 'a different question');
  dots.forEach((d, i) => {
    d.setAttribute('cx', posScore(i)[0]); d.setAttribute('cy', posScore(i)[1]); d.setAttribute('fill', C.ink); d.setAttribute('fill-opacity', 1);
  });
  A(dots, { cy: (d, i) => posStrip(i)[1], fill: (d, i) => fillRead(i), duration: 900, delay: stagger(18), easing: 'easeInOutQuad' });
  setChip('<span class="lbl">same essays — new question: readable for a first-year, yes or no? → two rows, label only</span>');
};

scenes.s09 = () => {
  show(['axes2', 'zone', 'strips', 'dots', 'model', 'extras']);
  setHud(2, 9, 'the number machine fails');
  resetExtras();
  dots.forEach((d, i) => { d.setAttribute('cx', posStrip(i)[0]); d.setAttribute('cy', posStrip(i)[1]); d.setAttribute('fill', fillRead(i)); d.setAttribute('fill-opacity', 1); });
  modeline.setAttribute('d', lineD(LL.b0, LL.b1, xE, yPr));
  modeline.setAttribute('stroke', C.gray); modeline.setAttribute('stroke-dasharray', '7 5'); modeline.setAttribute('opacity', 0);
  llL1.setAttribute('x', xE(6)); llL1.setAttribute('y', yPr(LL.yAt6) - 12); llL1.textContent = LL.yAt6.toFixed(2);
  llL2.setAttribute('x', xE(28)); llL2.setAttribute('y', yPr(LL.yAt28) + 20); llL2.textContent = '−' + Math.abs(LL.yAt28).toFixed(2);
  A(modeline, { opacity: [0, 1], duration: 700 });
  A([llL1, llL2], { opacity: [0, 1], duration: 500, delay: 600 });
  setChip(`point the old machine at the labels: <b>${LL.yAt6.toFixed(2)}</b> and <b>−0.23</b> readable?! outside 0…1 — meaningless`);
};

scenes.s10 = () => {
  show(['axes2', 'zone', 'strips', 'dots', 'model']);
  setHud(2, 10, 'squish the line (sigmoid)');
  dots.forEach((d, i) => { d.setAttribute('cx', posStrip(i)[0]); d.setAttribute('cy', posStrip(i)[1]); d.setAttribute('fill', fillRead(i)); d.setAttribute('fill-opacity', 1); });
  modeline.setAttribute('d', lineD(LL.b0, LL.b1, xE, yPr));
  modeline.setAttribute('stroke', C.gray); modeline.setAttribute('stroke-dasharray', '7 5'); modeline.setAttribute('opacity', 1);
  const sigD = curveD(x => sig(READ.b0 + READ.b1 * x), xE, yPr, 5, 29);
  A(modeline, { opacity: [1, 0], duration: 500, complete: () => {
    modeline.setAttribute('d', sigD);
    modeline.setAttribute('stroke', C.blue); modeline.setAttribute('stroke-dasharray', '');
    let len = 1500; try { len = modeline.getTotalLength(); } catch (_) {}
    modeline.setAttribute('stroke-dasharray', String(len));
    modeline.setAttribute('stroke-dashoffset', String(len));
    A(modeline, { opacity: [0, 1], strokeDashoffset: [len, 0], duration: 1100, easing: 'easeInOutQuad' });
  }});
  setChip('σ(z) = 1 / (1 + e<sup>−z</sup>) — any score, however wild, lands in <b>0…1</b>: a probability');
};

scenes.s11 = () => {
  show(['axes2', 'zone', 'strips', 'dots', 'model', 'marks', 'extras']);
  setHud(2, 11, 'decision boundary');
  resetExtras();
  dots.forEach((d, i) => { d.setAttribute('cx', posStrip(i)[0]); d.setAttribute('cy', posStrip(i)[1]); d.setAttribute('fill', fillRead(i)); d.setAttribute('fill-opacity', 1); });
  modeline.setAttribute('d', curveD(x => sig(READ.b0 + READ.b1 * x), xE, yPr, 5, 29));
  modeline.setAttribute('stroke', C.blue); modeline.setAttribute('stroke-dasharray', ''); modeline.setAttribute('opacity', 1);
  tLine.setAttribute('x1', M.l); tLine.setAttribute('x2', W - M.r); tLine.setAttribute('y1', yPr(0.5)); tLine.setAttribute('y2', yPr(0.5));
  tLbl.setAttribute('x', W - M.r - 6); tLbl.setAttribute('y', yPr(0.5) - 7); tLbl.textContent = 'threshold 0.5';
  bLine.setAttribute('x1', xE(READ.boundaryX)); bLine.setAttribute('x2', xE(READ.boundaryX));
  bLine.setAttribute('y1', yPr(0)); bLine.setAttribute('y2', yPr(1));
  bLbl.setAttribute('x', xE(READ.boundaryX)); bLbl.setAttribute('y', yPr(1) - 12);
  bLbl.textContent = `decision boundary ≈ ${READ.boundaryX.toFixed(0)}-word sentences`;
  A(tLine, { opacity: [0, 1], duration: 400 });
  A(tLbl, { opacity: [0, 1], duration: 400, delay: 150 });
  A(bLine, { opacity: [0, 1], duration: 500, delay: 500 });
  A(bLbl, { opacity: [0, 1], duration: 500, delay: 650 });
  marks.forEach((g, k) => {
    const p = posStrip(misIdx[k]);
    g.setAttribute('transform', `translate(${p[0]},${p[1]})`);
  });
  A(marks, { opacity: [0, 1], duration: 500, delay: stagger(120, { start: 900 }), easing: 'easeOutBack(2)' });
  setChip(`decide: P ≥ 0.5 → readable — <b>${READ.nCorrect} of ${READ.n}</b> correct <span class="lbl">· circled = its mistakes</span>`);
};

scenes.s12 = () => {
  show(['axesSp', 'zone', 'spam', 'model', 'extras']);
  setHud(2, 12, 'spam — slide the threshold');
  resetExtras();
  spamDots.forEach((d, i) => {
    d.setAttribute('cx', posSpam(i)[0]); d.setAttribute('cy', posSpam(i)[1]);
    d.setAttribute('fill', SP.labels[i] ? C.verm : '#7fb4d8'); d.setAttribute('opacity', 0);
  });
  A(spamDots, { opacity: [0, 1], duration: 500, delay: stagger(25), easing: 'easeOutQuad' });
  modeline.setAttribute('d', curveD(x => sig(SP.b0 + SP.b1 * x), xSp, yPr, -0.5, 9.5));
  modeline.setAttribute('stroke', C.verm); modeline.setAttribute('stroke-dasharray', ''); modeline.setAttribute('opacity', 1);
  paintThreshold();
  setChip('<span class="lbl">same machine, new problem: P(spam) from one word — slide the threshold</span>');
};
function paintThreshold() {
  const s = Sstate.slider;
  tLine.setAttribute('x1', M.l); tLine.setAttribute('x2', W - M.r); tLine.setAttribute('y1', yPr(s)); tLine.setAttribute('y2', yPr(s)); tLine.setAttribute('opacity', 1);
  tLbl.setAttribute('x', W - M.r - 6); tLbl.setAttribute('y', yPr(s) - 7); tLbl.textContent = 'threshold ' + s.toFixed(2); tLbl.setAttribute('opacity', 1);
  let caught = 0, missed = 0, alarms = 0;
  SP.counts.forEach((c, i) => {
    const pred = sig(SP.b0 + SP.b1 * c) >= s;
    const wrong = pred !== !!SP.labels[i];
    spamDots[i].setAttribute('stroke', wrong ? C.red : '#fff');
    spamDots[i].setAttribute('stroke-width', wrong ? 2.6 : 1);
    if (pred && SP.labels[i]) caught++;
    if (!pred && SP.labels[i]) missed++;
    if (pred && !SP.labels[i]) alarms++;
  });
  const nSp = SP.labels.reduce((a, b) => a + b, 0), nOk = SP.labels.length - nSp;
  setChip(`caught <b>${caught}/${nSp}</b> spam · missed <b>${missed}</b> · false alarms <b>${alarms}/${nOk}</b> <span class="lbl">· red ring = mistake</span>`);
}
document.getElementById('threshold').addEventListener('input', ev => { Sstate.slider = +ev.target.value; if (activeId === 's12') paintThreshold(); });

scenes.s13 = () => {
  show(['coda']);
  setHud(3, 13, 'same machine, two lenses');
  A(codaGs[0], { opacity: [0, 1], translateX: [-14, 0], duration: 700, easing: 'easeOutQuad' });
  A(codaGs[1], { opacity: [0, 1], translateX: [14, 0], duration: 700, delay: 350, easing: 'easeOutQuad' });
  setChip('linear regression: features → <b>a number</b> · logistic regression: the same sum wrapped in σ → <b>a probability</b>');
};

/* ---------- engine ---------- */
const stepEls = Array.from(document.querySelectorAll('.step'));
let activeId = null;
window.__renderScene = id => { document.body.dataset.scene = id; activeId = id; if (scenes[id]) scenes[id](); };
function renderActive() { if (activeId && scenes[activeId]) scenes[activeId](); }
function activate(id) {
  if (id === activeId) return;
  activeId = id;
  document.body.dataset.scene = id;
  if (scenes[id]) scenes[id]();
}
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) activate(en.target.dataset.scene); });
  }, { threshold: 0.55 });
  stepEls.forEach(el => io.observe(el));
} else {
  const onScroll = () => {
    const mid = window.innerHeight * 0.5;
    for (const el of stepEls) {
      const r = el.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { activate(el.dataset.scene); break; }
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
document.body.dataset.scene = 's01';
scenes.s01();
})();
