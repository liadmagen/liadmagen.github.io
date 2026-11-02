/* ============================================================
   anims.js — interactive animation hooks, called by deck.js
   HOOKS[name](step, maxStep, slideElement)
   ============================================================ */
(function () {
  const TEAL = '#0088A9', CORAL = '#F26B43', PURPLE = '#7D5C9E',
        ORANGE = '#EF8900', GRAY = '#c9ced6', INK = '#4A4D53';

  /* ---------- generic impurity curve (Gini / entropy) ---------- */
  function impurity(fn, p) {
    if (p <= 0 || p >= 1) return fn === 'gini' ? 0 : 0;
    if (fn === 'gini') return 1 - (p * p + (1 - p) * (1 - p));      // = 2p(1-p)
    const lp = Math.log2(p), lq = Math.log2(1 - p);
    return -(p * lp + (1 - p) * lq);
  }

  HOOKS.curve = function (step, max, slide) {
    const slider = slide.querySelector('.curve-slider');
    const canvas = slide.querySelector('.curve-canvas');
    const val = slide.querySelector('.curve-val');
    if (!slider || !canvas) return;
    const fn = slider.getAttribute('data-fn') || 'gini';
    const compare = slider.getAttribute('data-compare') === '1';
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, L = 46, B = 38, T = 16, R = 14;
    const maxY = (fn === 'gini' && !compare) ? 0.5 : 1.0;
    const X = p => L + p * (W - L - R);
    const Y = v => H - B - (v / maxY) * (H - T - B);

    function draw(p) {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = GRAY; ctx.fillStyle = INK; ctx.lineWidth = 1;
      ctx.font = '12px Verdana';
      // axes
      ctx.beginPath(); ctx.moveTo(L, T - 6); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
      // gridlines
      ctx.strokeStyle = '#edf0f4';
      for (let g = 0; g <= 4; g++) {
        const gx = L + g * 0.25 * (W - L - R), gy = H - B - g * 0.25 * (H - T - B);
        ctx.beginPath(); ctx.moveTo(gx, H - B); ctx.lineTo(gx, T); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(L, gy); ctx.lineTo(W - R, gy); ctx.stroke();
        ctx.fillText((g * 0.25).toFixed(2).replace('0.', '.'), gx - 8, H - B + 16);
        ctx.fillText((g * maxY / 4).toFixed(2).replace(/^0/, ''), 6, gy + 4);
      }
      // curve(s)
      function curve(f, color, width, dash) {
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.setLineDash(dash ? [7, 6] : []);
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const q = i / 100, y = impurity(f, q);
          i === 0 ? ctx.moveTo(X(q), Y(y)) : ctx.lineTo(X(q), Y(y));
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
      if (compare) { curve('gini', ORANGE, 2.5, true); curve('entropy', TEAL, 3, false); }
      else curve(fn, fn === 'gini' ? ORANGE : TEAL, 3, false);
      // marker(s)
      const y = impurity(fn, p);
      ctx.fillStyle = CORAL;
      ctx.beginPath(); ctx.arc(X(p), Y(y), 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      if (compare) {
        const g = impurity('gini', p);
        ctx.fillStyle = ORANGE;
        ctx.beginPath(); ctx.arc(X(p), Y(g), 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.stroke();
        if (val) val.textContent = 'p = ' + p.toFixed(2) + '  →  H = ' + y.toFixed(3) + '   ·   G = ' + g.toFixed(3);
      } else if (val) {
        val.textContent = 'p = ' + p.toFixed(2) + '  →  ' +
          (fn === 'gini' ? 'G' : 'H') + ' = ' + y.toFixed(3);
      }
    }
    if (!slider._bound) {
      slider._bound = true;
      slider.addEventListener('input', () => draw(parseFloat(slider.value)));
      slider.value = 0.5;
    }
    draw(parseFloat(slider.value));
  };

  /* ---------- ROC tracer ---------- */
  // 12 scored examples (spam=1): score + true label
  const ROC_DATA = [
    { s: .95, y: 1 }, { s: .85, y: 1 }, { s: .78, y: 0 }, { s: .70, y: 1 },
    { s: .62, y: 0 }, { s: .55, y: 1 }, { s: .48, y: 0 }, { s: .40, y: 1 },
    { s: .33, y: 0 }, { s: .25, y: 0 }, { s: .15, y: 1 }, { s: .08, y: 0 }
  ];
  function rocPoints(data) {
    const P = data.filter(p => p.y === 1).length, N = data.length - P;
    const ths = [...new Set(data.map(p => p.s))].sort((a, b) => b - a);
    const pts = [{ fpr: 0, tpr: 0, th: 1.01 }];
    for (const t of ths) {
      let tp = 0, fp = 0;
      for (const p of data) if (p.s >= t) (p.y === 1 ? tp++ : fp++);
      pts.push({ fpr: fp / N, tpr: tp / P, th: t });
    }
    return pts;
  }
  const ROC_PTS = rocPoints(ROC_DATA);

  HOOKS.roc = function (step, max, slide) {
    const canvas = slide.querySelector('.roc-canvas');
    const slider = slide.querySelector('.roc-slider');
    if (!canvas || !slider) return;
    // autoplay slides walk the threshold down through the steps
    if (slide.hasAttribute('data-roc-auto') && step >= 1 && max > 1) {
      slider.value = (1 - (step - 1) / (max - 1)).toFixed(2);
    }
    if (!slider._bound) {
      slider._bound = true;
      slider.addEventListener('input', () => HOOKS.roc(slide._rocStep || 0, slide._max, slide));
    }
    slide._rocStep = step; slide._max = max;
    renderROC(slide, parseFloat(slider.value));
  };

  function renderROC(slide, th) {
    const canvas = slide.querySelector('.roc-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, L = 52, B = 42, T = 18, R = 16;
    const X = f => L + f * (W - L - R), Y = t => H - B - t * (H - T - B);
    ctx.clearRect(0, 0, W, H);
    ctx.font = '12px Verdana'; ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(L, T - 6); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.strokeStyle = GRAY; ctx.stroke();
    ctx.strokeStyle = '#edf0f4';
    for (let g = 0; g <= 4; g++) {
      ctx.beginPath(); ctx.moveTo(X(g / 4), H - B); ctx.lineTo(X(g / 4), T); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L, Y(g / 4)); ctx.lineTo(W - R, Y(g / 4)); ctx.stroke();
      ctx.fillText((g / 4).toFixed(2).replace('0.', '.'), X(g / 4) - 8, H - B + 16);
      ctx.fillText((g / 4).toFixed(2).replace('0.', '.'), 14, Y(g / 4) + 4);
    }
    ctx.fillText('FPR →', W - R - 40, H - B + 30);
    ctx.save(); ctx.translate(14, T + 30); ctx.rotate(-Math.PI / 2); ctx.fillText('TPR →', 0, 0); ctx.restore();
    // random diagonal
    ctx.strokeStyle = GRAY; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke();
    ctx.setLineDash([]);
    // polyline up to current threshold
    const upto = ROC_PTS.filter(p => p.th >= th - 1e-9);
    ctx.strokeStyle = PURPLE; ctx.lineWidth = 3;
    ctx.beginPath();
    upto.forEach((p, i) => i === 0 ? ctx.moveTo(X(p.fpr), Y(p.tpr)) : ctx.lineTo(X(p.fpr), Y(p.tpr)));
    ctx.stroke();
    // current point
    const cp = upto[upto.length - 1];
    ctx.fillStyle = CORAL;
    ctx.beginPath(); ctx.arc(X(cp.fpr), Y(cp.tpr), 8, 0, Math.PI * 2); ctx.fill();
    // metrics readout
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const p of ROC_DATA) {
      const pred = p.s >= th ? 1 : 0;
      if (pred === 1 && p.y === 1) tp++; else if (pred === 1) fp++;
      else if (p.y === 1) fn++; else tn++;
    }
    const set = (cls, v) => { const e = slide.querySelector('.' + cls); if (e) e.textContent = v; };
    set('roc-tpr', (tp / 6).toFixed(2)); set('roc-fpr', (fp / 6).toFixed(2));
    set('roc-tp', tp); set('roc-fp', fp); set('roc-fn', fn); set('roc-tn', tn);
    set('roc-th', th.toFixed(2));
  }

  /* ---------- AUC comparison ---------- */
  const AUC_A = [{ s: .90, y: 1 }, { s: .82, y: 1 }, { s: .75, y: 1 }, { s: .66, y: 1 }, { s: .58, y: 1 }, { s: .45, y: 0 }, { s: .70, y: 0 }, { s: .50, y: 0 }, { s: .38, y: 0 }, { s: .30, y: 0 }, { s: .20, y: 0 }, { s: .10, y: 0 }];
  const AUC_B = [{ s: .75, y: 1 }, { s: .60, y: 1 }, { s: .55, y: 0 }, { s: .50, y: 1 }, { s: .40, y: 0 }, { s: .30, y: 1 }, { s: .65, y: 0 }, { s: .52, y: 0 }, { s: .45, y: 0 }, { s: .35, y: 0 }, { s: .25, y: 0 }, { s: .15, y: 0 }];
  function aucOf(pts) {
    let a = 0;
    for (let i = 1; i < pts.length; i++)
      a += (pts[i].fpr - pts[i - 1].fpr) * (pts[i].tpr + pts[i - 1].tpr) / 2;
    return a;
  }
  HOOKS.auc = function (step, max, slide) {
    const canvas = slide.querySelector('.auc-canvas');
    if (!canvas) return;
    slide._aucStep = step;
    const focus = (slide._aucFocus || 'A');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, L = 52, B = 42, T = 18, R = 16;
    const X = f => L + f * (W - L - R), Y = t => H - B - t * (H - T - B);
    const cA = rocPoints(AUC_A), cB = rocPoints(AUC_B);
    ctx.clearRect(0, 0, W, H);
    ctx.font = '12px Verdana'; ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(L, T - 6); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.strokeStyle = GRAY; ctx.stroke();
    ctx.strokeStyle = '#edf0f4';
    for (let g = 0; g <= 4; g++) {
      ctx.beginPath(); ctx.moveTo(X(g / 4), H - B); ctx.lineTo(X(g / 4), T); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L, Y(g / 4)); ctx.lineTo(W - R, Y(g / 4)); ctx.stroke();
      ctx.fillText((g / 4).toFixed(2).replace('0.', '.'), X(g / 4) - 8, H - B + 16);
      ctx.fillText((g / 4).toFixed(2).replace('0.', '.'), 14, Y(g / 4) + 4);
    }
    ctx.strokeStyle = GRAY; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = INK; ctx.fillText('0.5 = random guessing', X(0.52), Y(0.52) - 8);

    function path(pts, color, width) {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(X(p.fpr), Y(p.tpr)) : ctx.lineTo(X(p.fpr), Y(p.tpr)));
      ctx.stroke();
    }
    if (step >= 2) path(cA, focus === 'A' ? TEAL : '#9fc6d4', focus === 'A' ? 3.5 : 2);
    if (step >= 3) path(cB, focus === 'B' ? CORAL : '#f0b7a6', focus === 'B' ? 3.5 : 2);
    if (step >= 4) { // shade AUC of focused model
      const pts = focus === "A" ? cA : cB;
      const col = focus === 'A' ? 'rgba(0,136,169,.20)' : 'rgba(242,107,67,.20)';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      pts.forEach(p => ctx.lineTo(X(p.fpr), Y(p.tpr)));
      ctx.lineTo(X(1), Y(0)); ctx.closePath(); ctx.fill();
    }
    if (step >= 5) {
      ctx.font = 'bold 15px Verdana';
      ctx.fillStyle = TEAL; ctx.fillText('Model A: AUC = ' + aucOf(cA).toFixed(2), L + 12, T + 22);
      ctx.fillStyle = CORAL; ctx.fillText('Model B: AUC = ' + aucOf(cB).toFixed(2), L + 12, T + 44);
    }
    // bind toggle buttons once
    if (!slide._aucBound) {
      slide._aucBound = true;
      slide.querySelectorAll('.auc-btn').forEach(b => {
        b.addEventListener('click', () => {
          slide._aucFocus = b.getAttribute('data-m');
          HOOKS.auc(slide._aucStep || 5, max, slide);
        });
      });
    }
  };

  /* ---------- class-imbalance paradox ----------
     Fixed model operating point: TPR = 0.6, FPR = 0.1.
     Slider sets % ham (negatives) in a 100-item dataset;
     all four metrics are recomputed on every slider move. */
  HOOKS.imb = function (step, max, slide) {
    const slider = slide.querySelector('.imb-slider');
    if (!slider) return;
    if (!slider._bound) {
      slider._bound = true;
      slider.addEventListener('input', () => HOOKS.imb(0, 0, slide));
    }
    const neg = parseInt(slider.value, 10);       // % ham
    const pos = 100 - neg;                          // spam count out of 100
    const TPR = 0.6, FPR = 0.1;
    const tp = TPR * pos, fn = (1 - TPR) * pos;
    const fp = FPR * neg, tn = (1 - FPR) * neg;
    const acc = (tp + tn) / 100;
    const prec = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const rec = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1 = (prec + rec) > 0 ? 2 * prec * rec / (prec + rec) : 0;
    const den = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
    const mcc = den > 0 ? (tp * tn - fp * fn) / den : 0;
    const set = (fillCls, valCls, v) => {
      const f = slide.querySelector('.' + fillCls), t = slide.querySelector('.' + valCls);
      if (f) f.style.width = Math.max(1.5, v * 100) + '%';
      if (t) t.textContent = v.toFixed(2);
    };
    set('imb-acc', 'imb-v-acc', acc);
    set('imb-prec', 'imb-v-prec', prec);
    set('imb-rec', 'imb-v-rec', rec);
    set('imb-f1', 'imb-v-f1', f1);
    set('imb-mcc', 'imb-v-mcc', (mcc + 1) / 2);    // MCC in [-1,1] -> [0,1] for the bar
    const msg = slide.querySelector('.imb-msg');
    if (msg) msg.textContent = 'Dataset: ' + neg + ' ham / ' + pos + ' spam (of 100) · fixed model TPR=0.6, FPR=0.1 · ' +
      'accuracy = ' + (acc * 100).toFixed(0) + '% but precision = ' + (prec * 100).toFixed(0) + '%, F1 = ' + f1.toFixed(2) + ', MCC = ' + mcc.toFixed(2);
  };

  /* ---------- k-fold cross-validation ---------- */
  HOOKS.kfold = function (step, max, slide) {
    const folds = slide.querySelectorAll('.fold');
    if (!folds.length) return;
    folds.forEach(f => f.classList.remove('test', 'train'));
    if (step >= 1 && step <= folds.length) {
      folds.forEach((f, i) => f.classList.add(i === step - 1 ? 'test' : 'train'));
    }
  };
})();
