/* Slides 36-47: Model Evaluation, ROC/AUC, k-fold CV */
addSlides(String.raw`
<!-- ================= 36 · DIVIDER ================= -->
<section class="slide center divider" id="s36" data-accent="purple">
  <h1 class="big"><span class="w step">Model</span> <span class="w step">Evaluation</span></h1>
</section>

<!-- ================= 37 · GOLDEN RULE ================= -->
<section class="slide" id="s37" data-accent="purple" data-autoplay="1400">
  <h1 class="ttl">The golden rule of evaluation</h1>
  <div class="body">
    <div class="step" style="margin-bottom:22px">
      <div style="display:flex; height:64px; border-radius:10px; overflow:hidden; max-width:900px; font-size:18px; color:#fff; font-weight:bold">
        <div class="step" style="flex:8; background:var(--purple); display:flex; align-items:center; justify-content:center">TRAIN (80%)</div>
        <div class="step" style="flex:2; background:var(--coral); display:flex; align-items:center; justify-content:center">TEST (20%)</div>
      </div>
    </div>
    <ul class="bl">
      <li class="step">Measure the learning algorithm's performance on <b>unseen test data</b></li>
      <li class="step">Train and test data must be <b>drawn from the same distribution</b> — and hopefully represent the real world</li>
      <li class="step"><b>Never tune on the test set</b> — that's leakage; the test score would be a lie</li>
    </ul>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 38 · METRICS DEPEND ON THE TASK ================= -->
<section class="slide" id="s38" data-accent="purple">
  <h1 class="ttl">Performance measurement depends on the problem</h1>
  <div class="body">
    <div class="grid2">
      <div class="card accent step"><h3>Classification</h3>
        Accuracy · Precision · Recall · F1-score · MCC · Cohen's κ · <b>AUC / ROC</b> …</div>
      <div class="card step"><h3>Regression</h3>
        <div class="math sm">$$\mathrm{MSE} = \frac{1}{n}\sum_{i=1}^{n}(y_i - \hat y_i)^2$$</div>
        Mean Squared Error (also: MAE, $R^2$)</div>
    </div>
    <p class="note step">A classifier that is "accurate" may still be useless — the metric must match the <b>costs</b> of each mistake (spam in your inbox vs. real mail in the spam folder).</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 39 · CONFUSION MATRIX ================= -->
<section class="slide" id="s39" data-accent="purple" data-autoplay="1100">
  <h1 class="ttl">Binary classification — the confusion matrix</h1>
  <div class="body">
    <div class="cols">
      <div class="col" style="text-align:center">
        <table class="cm step">
          <tr><th></th><th>Predicted: Yes</th><th>Predicted: No</th></tr>
          <tr><td class="lab">Actual: Yes</td><td data-cell="tp"><b>TP</b><br><span class="muted">correct yes</span><br><span class="chip tp step">spam→spam</span> <span class="chip tp step">spam→spam</span> <span class="chip tp step">spam→spam</span> <span class="chip tp step">spam→spam</span></td><td data-cell="fn"><b>FN</b><br><span class="muted">missed yes</span><br><span class="chip fn step">spam→ham</span></td></tr>
          <tr><td class="lab">Actual: No</td><td data-cell="fp"><b>FP</b><br><span class="muted">false alarm</span><br><span class="chip fp step">ham→spam</span> <span class="chip fp step">ham→spam</span></td><td data-cell="tn"><b>TN</b><br><span class="muted">correct no</span><br><span class="chip tn step">ham→ham</span> <span class="chip tn step">ham→ham</span> <span class="chip tn step">ham→ham</span></td></tr>
        </table>
      </div>
      <div class="col">
        <ul class="bl small">
          <li class="step">Every test prediction lands in exactly <b>one cell</b></li>
          <li class="step"><b class="y">TP / TN</b> = correct · <b class="n">FP / FN</b> = the two kinds of errors</li>
          <li class="step">Which error is worse depends on the task: FP (ham→spam) vs. FN (spam→ham)</li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 40 · METRICS + GLOW ================= -->
<section class="slide" id="s40a" data-accent="purple">
  <h1 class="ttl">Metric 1 of 5 — Accuracy <span class="sub">· which cells does it use?</span></h1>
  <div class="body">
    <div class="cols">
      <div class="col" style="text-align:center">
        <table class="cm step" data-glow="tp tn">
          <tr><th></th><th>Pred. Yes</th><th>Pred. No</th></tr>
          <tr><td class="lab">Actual Yes</td><td data-cell="tp"><b>TP</b></td><td data-cell="fn"><b>FN</b></td></tr>
          <tr><td class="lab">Actual No</td><td data-cell="fp"><b>FP</b></td><td data-cell="tn"><b>TN</b></td></tr>
        </table>
        <p class="note step">only the <b>diagonal</b> is used: TP + TN</p>
      </div>
      <div class="col">
        <div class="math step" style="font-size:30px; text-align:left">$$\mathrm{Accuracy} = \frac{TP + TN}{TP + FP + FN + TN}$$</div>
        <p class="ans step">"Of <b>all</b> predictions, how many were right?" — simple, but misleading when classes are imbalanced (see the paradox slide).</p>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<section class="slide" id="s40b" data-accent="purple">
  <h1 class="ttl">Metric 2 of 5 — Precision <span class="sub">· which cells does it use?</span></h1>
  <div class="body">
    <div class="cols">
      <div class="col" style="text-align:center">
        <table class="cm step" data-glow="tp fp">
          <tr><th></th><th>Pred. Yes</th><th>Pred. No</th></tr>
          <tr><td class="lab">Actual Yes</td><td data-cell="tp"><b>TP</b></td><td data-cell="fn"><b>FN</b></td></tr>
          <tr><td class="lab">Actual No</td><td data-cell="fp"><b>FP</b></td><td data-cell="tn"><b>TN</b></td></tr>
        </table>
        <p class="note step">uses the <b>"Pred. Yes" column</b>: TP + FP</p>
      </div>
      <div class="col">
        <div class="math step" style="font-size:30px; text-align:left">$$\mathrm{Precision} = \frac{TP}{TP + FP}$$</div>
        <p class="ans step">"Of everything we predicted <b>Yes</b>, how much was actually Yes?" — high precision = few false alarms (FP).</p>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<section class="slide" id="s40c" data-accent="purple">
  <h1 class="ttl">Metric 3 of 5 — Recall (Sensitivity) <span class="sub">· which cells does it use?</span></h1>
  <div class="body">
    <div class="cols">
      <div class="col" style="text-align:center">
        <table class="cm step" data-glow="tp fn">
          <tr><th></th><th>Pred. Yes</th><th>Pred. No</th></tr>
          <tr><td class="lab">Actual Yes</td><td data-cell="tp"><b>TP</b></td><td data-cell="fn"><b>FN</b></td></tr>
          <tr><td class="lab">Actual No</td><td data-cell="fp"><b>FP</b></td><td data-cell="tn"><b>TN</b></td></tr>
        </table>
        <p class="note step">uses the <b>"Actual Yes" row</b>: TP + FN</p>
      </div>
      <div class="col">
        <div class="math step" style="font-size:30px; text-align:left">$$\mathrm{Recall} = \frac{TP}{TP + FN}$$</div>
        <p class="ans step">"Of everything that <b>actually was</b> Yes, how much did we find?" — high recall = few missed cases (FN).</p>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<section class="slide" id="s40d" data-accent="purple">
  <h1 class="ttl">Metric 4 of 5 — F1-score <span class="sub">· which cells does it use?</span></h1>
  <div class="body">
    <div class="cols">
      <div class="col" style="text-align:center">
        <table class="cm step" data-at="3" data-glow="tp fp fn">
          <tr><th></th><th>Pred. Yes</th><th>Pred. No</th></tr>
          <tr><td class="lab">Actual Yes</td><td data-cell="tp"><b>TP</b></td><td data-cell="fn"><b>FN</b></td></tr>
          <tr><td class="lab">Actual No</td><td data-cell="fp"><b>FP</b></td><td data-cell="tn"><b>TN</b></td></tr>
        </table>
        <p class="note step" data-at="4">uses TP, FP, FN — <b>everything except TN</b></p>
      </div>
      <div class="col">
        <div class="math step" data-at="1" style="font-size:30px; text-align:left">$$F_1 = 2\,\frac{\mathrm{Precision}\cdot\mathrm{Recall}}{\mathrm{Precision}+\mathrm{Recall}} = \frac{2\,TP}{2\,TP + FP + FN}$$</div>
        <p class="ans step" data-at="2">The <b>harmonic mean</b> of precision &amp; recall — balances both, punishes a model that is good at only one of them.</p>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<section class="slide" id="s40e" data-accent="purple">
  <h1 class="ttl">Metric 5 of 5 — MCC <span class="sub">· the only one using ALL 4 cells</span></h1>
  <div class="body">
    <div class="cols">
      <div class="col" style="text-align:center">
        <table class="cm step" data-glow="tp fp fn tn">
          <tr><th></th><th>Pred. Yes</th><th>Pred. No</th></tr>
          <tr><td class="lab">Actual Yes</td><td data-cell="tp"><b>TP</b></td><td data-cell="fn"><b>FN</b></td></tr>
          <tr><td class="lab">Actual No</td><td data-cell="fp"><b>FP</b></td><td data-cell="tn"><b>TN</b></td></tr>
        </table>
        <p class="note step"><b>all four cells glow</b> — TP, FP, FN, TN</p>
      </div>
      <div class="col">
        <div class="math step" style="font-size:26px; text-align:left">$$\mathrm{MCC} = \frac{TP\cdot TN - FP\cdot FN}{\sqrt{(TP+FP)(TP+FN)(TN+FP)(TN+FN)}}$$</div>
        <p class="ans step">Correlation between prediction and truth: range <b>−1 … +1</b>, 0 = random guessing. Because it uses <b>all four cells</b>, it stays reliable even on <b>imbalanced</b> data.</p>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 41 · WORKED EXAMPLE ================= -->
<section class="slide" id="s41" data-accent="purple" data-autoplay="1400">
  <h1 class="ttl">Worked example — 100 test emails</h1>
  <div class="body">
    <div class="cols">
      <div class="col" style="text-align:center">
        <table class="cm step">
          <tr><th></th><th>Pred. spam</th><th>Pred. ham</th></tr>
          <tr><td class="lab">Actual spam (50)</td><td data-cell="tp" class="step"><b>TP = 30</b></td><td data-cell="fn" class="step"><b>FN = 20</b></td></tr>
          <tr><td class="lab">Actual ham (50)</td><td data-cell="fp" class="step"><b>FP = 10</b></td><td data-cell="tn" class="step"><b>TN = 40</b></td></tr>
        </table>
      </div>
      <div class="col">
        <ul class="bl small">
          <li class="step">Accuracy = (30+40)/100 = <b>0.70</b></li>
          <li class="step">Precision = 30/40 = <b>0.75</b></li>
          <li class="step">Recall = 30/50 = <b>0.60</b></li>
          <li class="step">F1 = 2·(0.75·0.60)/(0.75+0.60) = <b>0.667</b></li>
          <li class="step">MCC = (30·40 − 10·20)/√(40·50·50·60) ≈ <b>0.408</b></li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 42 · IMBALANCED CLASSES ================= -->
<section class="slide" id="s42" data-accent="purple" data-hook="imb">
  <h1 class="ttl">Evaluating unbalanced classes — the accuracy paradox</h1>
  <div class="body">
    <div class="cols">
      <div class="col">
        <ul class="bl small">
          <li class="step">Real data is often skewed — drag the slider: <b>% of ham</b> in 100 emails</li>
          <li class="step">Fixed model (TPR = 0.6, FPR = 0.1) — watch which metrics survive the imbalance</li>
          <li class="step">Accuracy stays high… while precision / F1 / MCC collapse</li>
        </ul>
        <input type="range" class="imb-slider keep" min="50" max="99" step="1" value="95" style="max-width:440px">
        <table class="data step" style="font-size:14px; margin-top:12px; max-width:480px">
          <tr><th>1,000 emails, 10 spam</th><th>Model A: always "ham"</th><th>Model B: real filter</th></tr>
          <tr><td>Accuracy</td><td><b>99.0%</b></td><td>97.8%</td></tr>
          <tr><td>Precision</td><td>undefined (0/0)</td><td>28.6% (8/28)</td></tr>
          <tr><td>Recall</td><td><b>0%</b></td><td>80% (8/10)</td></tr>
          <tr><td>F1 / MCC</td><td>0 / 0</td><td>0.42 / 0.47</td></tr>
        </table>
        <p class="note step">Model A "wins" on accuracy while catching <b>zero spam</b> — accuracy hides the problem.</p>
      </div>
      <div class="col">
        <div class="barRow"><span class="lab">Accuracy</span><div class="track"><div class="fill imb-acc" style="background:var(--purple)"></div></div><span class="val imb-v-acc"></span></div>
        <div class="barRow"><span class="lab">Precision</span><div class="track"><div class="fill imb-prec" style="background:var(--lblue)"></div></div><span class="val imb-v-prec"></span></div>
        <div class="barRow"><span class="lab">Recall</span><div class="track"><div class="fill imb-rec" style="background:var(--teal)"></div></div><span class="val imb-v-rec"></span></div>
        <div class="barRow"><span class="lab">F1</span><div class="track"><div class="fill imb-f1" style="background:var(--orange)"></div></div><span class="val imb-v-f1"></span></div>
        <div class="barRow"><span class="lab">MCC</span><div class="track"><div class="fill imb-mcc" style="background:var(--coral)"></div></div><span class="val imb-v-mcc"></span></div>
        <p class="imb-msg note keep" style="margin-top:8px"></p>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 43 · MULTICLASS ================= -->
<section class="slide" id="s43" data-accent="purple">
  <h1 class="ttl">From binary to multi-class — how to get one score?</h1>
  <div class="body">
    <div class="cols">
      <div class="col" style="text-align:center">
        <table class="cm step" style="font-size:16px">
          <tr><th></th><th>A</th><th>B</th><th>C</th></tr>
          <tr><td class="lab">A</td><td><b>12</b></td><td class="step">2</td><td class="step">1</td></tr>
          <tr><td class="lab">B</td><td class="step">3</td><td><b>10</b></td><td class="step">2</td></tr>
          <tr><td class="lab">C</td><td class="step">0</td><td class="step">4</td><td><b>8</b></td></tr>
        </table>
        <p class="note step">the 3×3 confusion matrix generalizes the 2×2</p>
      </div>
      <div class="col">
        <ul class="bl small">
          <li class="step">Single score via <b>weighted / macro / micro</b> average of per-class precision, recall, F1 (or accuracy)</li>
          <li class="step">Cohen's κ — agreement beyond chance:<div class="math sm" style="text-align:left">$$\kappa = \frac{p_o - p_e}{1 - p_e}$$</div></li>
          <li class="step"><b>Aggregated AUROC:</b> one ROC per class (one-vs-rest), averaged — the multi-class AUC</li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 44 · ROC ================= -->
<section class="slide" id="s44" data-accent="purple" data-hook="roc" data-roc-auto data-autoplay="1700">
  <h1 class="ttl">ROC curve — sweeping the classification threshold</h1>
  <div class="body">
    <div class="cols">
      <div class="col" style="text-align:center">
        <canvas class="plot roc-canvas step" width="470" height="390"></canvas>
      </div>
      <div class="col">
        <p class="step" style="font-size:18px">A classifier outputs a <b>score</b>; the threshold turns it into Yes/No. Sweep the threshold from 1 → 0 and plot <b>TPR vs. FPR</b>:</p>
        <input type="range" class="roc-slider keep" min="0" max="1" step="0.01" value="1">
        <p class="readout step keep">threshold <b class="roc-th">1.00</b> · TPR <b class="roc-tpr"></b> · FPR <b class="roc-fpr"></b></p>
        <table class="cm step keep" style="font-size:15px; margin:10px 0">
          <tr><th></th><th>Pred +</th><th>Pred −</th></tr>
          <tr><td class="lab">Actual +</td><td data-cell="tp">TP <b class="roc-tp"></b></td><td data-cell="fn">FN <b class="roc-fn"></b></td></tr>
          <tr><td class="lab">Actual −</td><td data-cell="fp">FP <b class="roc-fp"></b></td><td data-cell="tn">TN <b class="roc-tn"></b></td></tr>
        </table>
        <p class="note step">The diagonal = random guessing. The further <b>up-left</b>, the better.</p>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 45 · AUC ================= -->
<section class="slide" id="s45" data-accent="purple" data-hook="auc" data-autoplay="1700">
  <h1 class="ttl">AUC — one number for the whole curve</h1>
  <div class="body">
    <div class="cols">
      <div class="col" style="text-align:center">
        <canvas class="plot auc-canvas step" width="480" height="400"></canvas>
        <p class="step keep"><button class="btn auc-btn keep" data-m="A">Model A</button> <button class="btn auc-btn keep" data-m="B">Model B</button></p>
      </div>
      <div class="col">
        <ul class="bl small">
          <li class="step">$$\mathrm{AUC}$$ = <b>Area Under the ROC Curve</b>: the probability that a random positive is ranked above a random negative</li>
          <li class="step">AUC = 0.5 → random · AUC = 1.0 → perfect · AUC &lt; 0.5 → worse than random</li>
          <li class="step">Threshold-independent — ideal for <b>imbalanced</b> data</li>
          <li class="step">Multi-class: average the per-class (one-vs-rest) ROC curves → aggregated AUROC</li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 46 · K-FOLD CV ================= -->
<section class="slide" id="s46" data-accent="purple" data-hook="kfold" data-autoplay="1300">
  <h1 class="ttl">k-fold cross-validation — use every point for testing (once)</h1>
  <div class="body">
    <div class="folds step keep">
      <div class="fold">fold 1</div><div class="fold">fold 2</div><div class="fold">fold 3</div><div class="fold">fold 4</div><div class="fold">fold 5</div>
    </div>
    <ul class="bl small">
      <li class="step">Split the data into <b>k folds</b>; each round one fold is the <b>test</b> set (purple), the rest train</li>
      <li class="step">Rotate → after k rounds <b>every point was tested exactly once</b></li>
      <li class="step">Report the <b>average score ± std</b> over the k folds — much more robust than a single train/test split</li>
      <li class="step">Typical: k = 5 or 10 · stratified k-fold keeps the class balance in every fold</li>
    </ul>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 47 · WRAP-UP ================= -->
<section class="slide" id="s47" data-accent="purple">
  <h1 class="ttl">Takeaways &amp; self-check</h1>
  <div class="body">
    <ul class="bl small tight">
      <li class="step">Language models assign probabilities to word sequences via the <b>chain rule</b> (n-grams approximate it)</li>
      <li class="step"><b>Decision trees</b> split greedily on the feature with best Gini/entropy gain; <b>forests</b> average many trees (bagging) or focus on mistakes (boosting)</li>
      <li class="step">Evaluate on <b>unseen data</b>; pick the metric that matches the error costs; read <b>ROC/AUC</b>; use <b>k-fold CV</b> for a robust score</li>
    </ul>
    <div class="cards3">
      <div class="card flip3 step"><div class="front"><h3>Q1</h3>What kind of questions does a decision tree ask?</div><div class="back"><b>A:</b> binary questions about a single feature ("Reputation ≥ 90?").</div></div>
      <div class="card flip3 step"><div class="front"><h3>Q2</h3>"95% accuracy" on data that is 95% ham — good model?</div><div class="back"><b>A:</b> No — a dummy gets that for free. Check precision / recall / F1 / MCC / AUC.</div></div>
      <div class="card flip3 step"><div class="front"><h3>Q3</h3>What does AUC = 0.5 mean?</div><div class="back"><b>A:</b> The model ranks positives vs. negatives no better than chance.</div></div>
    </div>
    <p class="note step">click a card to flip it · FH Campus Wien — Introduction to Machine Learning for Language Processing</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>
`);
