/* Slides 28-35: Decision Trees (part 2) + Ensembles */
addSlides(String.raw`
<!-- ================= 28 · GINI ================= -->
<section class="slide" id="s28" data-accent="orange" data-hook="curve">
  <h1 class="ttl">Splitting criterion 1 — Gini Impurity <span class="sub">(lower is better)</span></h1>
  <div class="body">
    <div class="cols">
      <div class="col">
        <p class="step" style="font-size:20px">Measures <b>misclassification frequency</b> of a node. With $p_k$ = share of class $k$ in the node:</p>
        <div class="math step" style="font-size:28px">$$G = 1 - \sum_{k=1}^{K} p_k^{\,2}$$</div>
        <ul class="bl small">
          <li class="step">Worked root: 1 × Y, 3 × N → $p_Y = 0.25$, $p_N = 0.75$</li>
          <li class="step">$$G = 1 - (0.25^2 + 0.75^2) = 1 - 0.625 = \textcolor{#EF8900}{0.375}$$</li>
          <li class="step">Worst case 50/50 → $G = 0.5$ · pure node → $G = 0$</li>
        </ul>
        <p class="note step">Drag the slider: watch $G(p)$ — maximal impurity in the middle, zero at the extremes.</p>
      </div>
      <div class="col" style="text-align:center">
        <canvas class="plot curve-canvas step" width="440" height="280"></canvas>
        <input type="range" class="curve-slider keep" data-fn="gini" min="0" max="1" step="0.01" value="0.5">
        <span class="curve-val readout keep"></span>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 28b · WHICH QUESTION SPLITS BEST ================= -->
<section class="slide" id="s28b" data-accent="orange" data-autoplay="1500">
  <h1 class="ttl">Which question splits the data best? — score every candidate</h1>
  <div class="body">
    <div class="cols">
      <div class="col">
        <p class="step" style="font-size:20px">Parent node: <b>1 × Y, 3 × N</b> → $p = (0.25,\, 0.75)$<br>
        <span class="math sm" style="text-align:left">$$G_{parent} = 1 - 0.25^2 - 0.75^2 = \textcolor{#EF8900}{0.375}$$</span></p>
        <p class="step" style="font-size:20px">Weighted impurity of a split:
        <span class="math sm" style="text-align:left">$$G_{split} = \frac{n_L}{n}G_L + \frac{n_R}{n}G_R$$</span></p>
        <p class="note step">Pick the question with the <b>lowest weighted Gini</b> (highest gain), then recurse on each branch — greedy.</p>
      </div>
      <div class="col">
        <table class="data" style="font-size:17px">
          <tr><th>Candidate question</th><th>Yes branch</th><th>No branch</th><th>Weighted G</th><th></th></tr>
          <tr class="step"><td>Reputation ≥ 90?</td><td>{Y, N}: G = 0.5 (n=2)</td><td>{N, N}: G = 0 (n=2)</td><td><b>0.25</b></td><td class="y">✓ best</td></tr>
          <tr class="step"><td>Flexible = 1?</td><td>{Y, N}: G = 0.5 (n=2)</td><td>{N, N}: G = 0 (n=2)</td><td><b>0.25</b></td><td class="y">✓ tie</td></tr>
          <tr class="step"><td>Distance &lt; 5,000?</td><td>{Y, N, N}: G = 0.444 (n=3)</td><td>{N}: G = 0 (n=1)</td><td>0.333</td><td class="n">✗ worse</td></tr>
        </table>
        <p class="note step">On this toy data several splits are near-perfect — with real data no single question is clean; the tree simply takes the best available and recurses.</p>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 29 · ENTROPY / INFORMATION GAIN ================= -->
<section class="slide" id="s29" data-accent="orange" data-hook="curve">
  <h1 class="ttl">Splitting criterion 2 — Entropy &amp; Information Gain <span class="sub">(lower is better)</span></h1>
  <div class="body">
    <div class="cols">
      <div class="col">
        <p class="step" style="font-size:20px">Entropy measures <b>unpredictability / disorder</b> of a node:</p>
        <div class="math step" style="font-size:28px">$$H = -\sum_{k=1}^{K} p_k \log_2 p_k$$</div>
        <ul class="bl small">
          <li class="step">Root: $H = -(0.25\log_2 0.25 + 0.75\log_2 0.75) = \textcolor{#0088A9}{0.811}$</li>
          <li class="step">Split "Reputation ≥ 90?": children are {N,N} → $H=0$ and {Y,N} → $H=1$, weighted: $\frac{2}{4}\cdot 0 + \frac{2}{4}\cdot 1 = 0.5$</li>
          <li class="step">$$IG = H_{parent} - \sum_{c} \frac{n_c}{n} H_c = 0.811 - 0.5 = \textcolor{#EF8900}{0.311}$$</li>
        </ul>
      </div>
      <div class="col" style="text-align:center">
        <canvas class="plot curve-canvas step" width="440" height="280"></canvas>
        <input type="range" class="curve-slider keep" data-fn="entropy" data-compare="1" min="0" max="1" step="0.01" value="0.5">
        <span class="curve-val readout keep"></span>
        <p class="note">Both curves on one plot (entropy peaks at 1.0, Gini at 0.5): they are almost proportional — in practice they usually pick the <b>same split</b>.</p>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 30 · COST OF SPLITS ================= -->
<section class="slide" id="s30" data-accent="orange" data-autoplay="1200">
  <h1 class="ttl">Diving deeper — what does "best split" cost?</h1>
  <div class="body">
    <div class="cols">
      <div class="col">
        <table class="data step">
          <tr><th>Feature \\ candidate values</th><th>score?</th></tr>
          <tr class="step"><td>Distance: 3,000 / 3,500 / 4,000 / 8,000</td><td>4 × Gini</td></tr>
          <tr class="step"><td>Reputation: 80 / 90 / 100</td><td>3 × Gini</td></tr>
          <tr class="step"><td>Flexible: 0 / 1</td><td>2 × Gini</td></tr>
        </table>
        <p class="note step">Every node scores <b>every feature × every value</b> → high computation when features are many.</p>
      </div>
      <div class="col">
        <div class="card step"><h3>Random Forest trick</h3>At each node, consider only a <b>random subset</b> of the features — each tree becomes different, and the forest votes.</div>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 31 · BOUNDARIES IN HIGHER DIMS ================= -->
<section class="slide" id="s31" data-accent="orange">
  <h1 class="ttl">Decision boundaries in higher dimensions</h1>
  <div class="body">
    <div class="math step" style="font-size:28px">$$\hat y = \beta_0 + \beta_1 x_1 + \beta_2 x_2 + \dots + \beta_k x_k$$</div>
    <ul class="bl">
      <li class="step">With $k$ features the boundary lives in $k$-dimensional space — <b>hard to visualize</b> (for classification: a staircase; for regression: a piecewise-constant surface)</li>
      <li class="step">So instead of <i>looking</i> at the model, we ask: <b>how well does it predict?</b></li>
      <li class="step">→ We need a proper way to <b>evaluate</b> our model — that's the next section.</li>
    </ul>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 32 · RANDOM FOREST ================= -->
<section class="slide" id="s32" data-accent="orange" data-autoplay="1300">
  <h1 class="ttl">Ensemble Models — Random Forest: many trees, one vote</h1>
  <div class="body" style="align-items:center">
    <div style="display:flex; gap:26px; align-items:center; justify-content:center">
      <div class="step" style="text-align:center"><svg viewBox="0 0 140 120" width="120"><rect class="node q" x="35" y="8" width="70" height="26" rx="6"/><line class="edge" x1="55" y1="34" x2="30" y2="70"/><line class="edge" x1="85" y1="34" x2="110" y2="70"/><rect class="node leafY" x="8" y="70" width="44" height="24" rx="6"/><text x="30" y="87">Y</text><rect class="node leafN" x="88" y="70" width="44" height="24" rx="6"/><text x="110" y="87">N</text></svg><div class="muted" style="font-size:14px">tree 1</div></div>
      <div class="step" style="text-align:center"><svg viewBox="0 0 140 120" width="120"><rect class="node q" x="35" y="8" width="70" height="26" rx="6"/><line class="edge" x1="55" y1="34" x2="30" y2="70"/><line class="edge" x1="85" y1="34" x2="110" y2="70"/><rect class="node leafN" x="8" y="70" width="44" height="24" rx="6"/><text x="30" y="87">N</text><rect class="node leafN" x="88" y="70" width="44" height="24" rx="6"/><text x="110" y="87">N</text></svg><div class="muted" style="font-size:14px">tree 2</div></div>
      <div class="step" style="text-align:center"><svg viewBox="0 0 140 120" width="120"><rect class="node q" x="35" y="8" width="70" height="26" rx="6"/><line class="edge" x1="55" y1="34" x2="30" y2="70"/><line class="edge" x1="85" y1="34" x2="110" y2="70"/><rect class="node leafN" x="8" y="70" width="44" height="24" rx="6"/><text x="30" y="87">N</text><rect class="node leafY" x="88" y="70" width="44" height="24" rx="6"/><text x="110" y="87">Y</text></svg><div class="muted" style="font-size:14px">tree 3</div></div>
      <div class="step" style="font-size:34px; color:var(--orange); padding:0 6px">→</div>
      <div class="card step" style="border-color:var(--purple); min-width:300px">
        <h3 style="color:var(--purple)">Aggregate</h3>
        <p style="margin:8px 0"><span class="pill" style="background:var(--teal)">tree 1: Y</span>
        <span class="pill" style="background:var(--coral)">tree 2: N</span>
        <span class="pill" style="background:var(--coral)">tree 3: N</span></p>
        <p class="step" style="font-size:22px; margin-top:8px">Majority vote → <b class="n">N</b></p>
      </div>
    </div>
    <p class="note step" style="max-width:1000px; text-align:center">Random Forest: create <b>many</b> decision trees (each on a bootstrap sample + a random subset of features), combine outputs by <b>voting</b> (classification), <b>averaging</b> (regression), or weighted voting.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 33 · BOOTSTRAPPING ================= -->
<section class="slide" id="s33" data-accent="orange" data-autoplay="1500">
  <h1 class="ttl">Bootstrapping — sample <i>with replacement</i></h1>
  <div class="body">
    <svg viewBox="0 0 900 210" style="width:100%; max-width:980px; margin:0 auto; display:block">
      <g class="step">
        <text class="elab" x="450" y="22" text-anchor="middle" font-size="17" font-weight="bold">original dataset</text>
        <circle class="pt" cx="90" cy="60" r="13" fill="var(--orange)"/><circle class="pt" cx="190" cy="60" r="13" fill="var(--orange)"/>
        <circle class="pt" cx="290" cy="60" r="13" fill="var(--orange)"/><circle class="pt" cx="390" cy="60" r="13" fill="var(--orange)"/>
        <circle class="pt" cx="490" cy="60" r="13" fill="var(--orange)"/><circle class="pt" cx="590" cy="60" r="13" fill="var(--orange)"/>
        <circle class="pt" cx="690" cy="60" r="13" fill="var(--orange)"/><circle class="pt" cx="790" cy="60" r="13" fill="var(--orange)"/>
      </g>
      <g class="step">
        <text class="elab" x="450" y="122" text-anchor="middle" font-size="17" font-weight="bold">bootstrap sample — note the duplicates (circled)</text>
        <circle class="pt" cx="90" cy="160" r="13" fill="var(--lblue)"/><circle class="pt" cx="190" cy="160" r="13" fill="var(--lblue)"/>
        <circle class="ring" cx="290" cy="160" r="20"/><circle class="pt" cx="290" cy="160" r="13" fill="var(--lblue)"/>
        <circle class="pt" cx="390" cy="160" r="13" fill="var(--lblue)"/><circle class="pt" cx="490" cy="160" r="13" fill="var(--lblue)"/>
        <circle class="pt" cx="590" cy="160" r="13" fill="var(--lblue)"/>
        <circle class="ring" cx="690" cy="160" r="20"/><circle class="pt" cx="690" cy="160" r="13" fill="var(--lblue)"/>
        <circle class="pt" cx="790" cy="160" r="13" fill="var(--lblue)"/>
        <text class="elab" x="815" y="165" font-size="13">← drawn twice</text>
      </g>
    </svg>
    <ul class="bl small" style="max-width:980px; margin:6px auto 0">
      <li class="step">Draw $n$ points <b>with replacement</b> → a bootstrap sample; on average only ~63% of the original points appear</li>
      <li class="step">Compute your statistic on <b>many</b> bootstraps → the <b>bootstrap distribution</b> = the uncertainty of that statistic</li>
    </ul>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 33b · BAGGING ================= -->
<section class="slide" id="s33b" data-accent="orange" data-autoplay="1400">
  <h1 class="ttl">Bagging = Bootstrap AGGregating — one model per bootstrap</h1>
  <div class="body" style="align-items:center">
    <div style="display:flex; flex-direction:column; gap:14px; width:100%; max-width:980px">
      <div class="step" style="display:flex; align-items:center; gap:18px">
        <svg viewBox="0 0 280 36" width="280"><circle class="pt" cx="18" cy="18" r="9" fill="var(--lblue)"/><circle class="ring" cx="50" cy="18" r="14"/><circle class="pt" cx="50" cy="18" r="9" fill="var(--lblue)"/><circle class="pt" cx="82" cy="18" r="9" fill="var(--lblue)"/><circle class="pt" cx="114" cy="18" r="9" fill="var(--lblue)"/><circle class="pt" cx="146" cy="18" r="9" fill="var(--lblue)"/><circle class="pt" cx="178" cy="18" r="9" fill="var(--lblue)"/><circle class="pt" cx="210" cy="18" r="9" fill="var(--lblue)"/><circle class="pt" cx="242" cy="18" r="9" fill="var(--lblue)"/></svg>
        <span style="font-size:24px; color:var(--orange)">→</span>
        <div class="card" style="padding:8px 20px">Model 1 <span class="muted" style="font-size:14px">trained on bootstrap 1</span></div>
      </div>
      <div class="step" style="display:flex; align-items:center; gap:18px">
        <svg viewBox="0 0 280 36" width="280"><circle class="pt" cx="18" cy="18" r="9" fill="var(--teal)"/><circle class="pt" cx="50" cy="18" r="9" fill="var(--teal)"/><circle class="ring" cx="82" cy="18" r="14"/><circle class="pt" cx="82" cy="18" r="9" fill="var(--teal)"/><circle class="ring" cx="114" cy="18" r="14"/><circle class="pt" cx="114" cy="18" r="9" fill="var(--teal)"/><circle class="pt" cx="146" cy="18" r="9" fill="var(--teal)"/><circle class="pt" cx="178" cy="18" r="9" fill="var(--teal)"/><circle class="pt" cx="210" cy="18" r="9" fill="var(--teal)"/><circle class="pt" cx="242" cy="18" r="9" fill="var(--teal)"/></svg>
        <span style="font-size:24px; color:var(--orange)">→</span>
        <div class="card" style="padding:8px 20px">Model 2 <span class="muted" style="font-size:14px">trained on bootstrap 2</span></div>
      </div>
      <div class="step" style="display:flex; align-items:center; gap:18px">
        <svg viewBox="0 0 280 36" width="280"><circle class="pt" cx="18" cy="18" r="9" fill="var(--purple)"/><circle class="pt" cx="50" cy="18" r="9" fill="var(--purple)"/><circle class="pt" cx="82" cy="18" r="9" fill="var(--purple)"/><circle class="ring" cx="114" cy="18" r="14"/><circle class="pt" cx="114" cy="18" r="9" fill="var(--purple)"/><circle class="pt" cx="146" cy="18" r="9" fill="var(--purple)"/><circle class="pt" cx="178" cy="18" r="9" fill="var(--purple)"/><circle class="ring" cx="210" cy="18" r="14"/><circle class="pt" cx="210" cy="18" r="9" fill="var(--purple)"/><circle class="pt" cx="242" cy="18" r="9" fill="var(--purple)"/></svg>
        <span style="font-size:24px; color:var(--orange)">→</span>
        <div class="card" style="padding:8px 20px">Model 3 <span class="muted" style="font-size:14px">trained on bootstrap 3</span></div>
      </div>
      <div class="step" style="display:flex; align-items:center; gap:18px; justify-content:center; margin-top:4px">
        <span style="font-size:24px; color:var(--purple)">↓</span>
        <div class="card" style="border-color:var(--purple); padding:10px 26px"><h3 style="color:var(--purple)">Aggregated model</h3><span style="font-size:17px">average (regression) · majority vote (classification)</span></div>
      </div>
    </div>
    <p class="note step">All models train <b>in parallel</b> and independently — bagging reduces <b>variance</b>.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 34 · BOOSTING ================= -->
<section class="slide" id="s34" data-accent="orange" data-autoplay="1500">
  <h1 class="ttl">Boosting — sequential, and it focuses on the mistakes</h1>
  <div class="body">
    <div class="cols" style="align-items:center">
      <div class="col">
        <svg viewBox="0 0 520 300" style="width:100%">
          <g class="step">
            <circle class="pt" cx="80" cy="60" r="10" fill="var(--teal)"/><circle class="pt" cx="160" cy="90" r="10" fill="var(--teal)"/>
            <circle class="pt" cx="260" cy="50" r="10" fill="var(--teal)"/><circle class="pt" cx="360" cy="100" r="10" fill="var(--teal)"/>
            <circle class="pt" cx="440" cy="70" r="10" fill="var(--teal)"/>
            <circle class="pt" cx="120" cy="220" r="10" fill="var(--coral)"/><circle class="pt" cx="220" cy="240" r="10" fill="var(--coral)"/>
            <circle class="pt" cx="320" cy="200" r="10" fill="var(--coral)"/><circle class="pt" cx="400" cy="230" r="10" fill="var(--coral)"/>
            <circle class="pt" cx="480" cy="210" r="10" fill="var(--coral)"/>
            <text class="elab" x="14" y="30" fill="var(--teal)">spam</text><text class="elab" x="14" y="270" fill="var(--coral)">ham</text>
          </g>
          <line class="split step" x1="30" y1="150" x2="500" y2="150"/>
          <text class="elab step" x="380" y="140">model 1 (a stump)</text>
          <circle class="ring step" cx="200" cy="120" r="15"/><circle class="pt" cx="200" cy="120" r="10" fill="var(--coral)"/>
          <circle class="ring step" cx="380" cy="130" r="15"/><circle class="pt" cx="380" cy="130" r="10" fill="var(--coral)"/>
          <circle class="ring step" cx="300" cy="180" r="15"/>
          <text class="elab step" x="60" y="170">misclassified → weight ↑</text>
        </svg>
      </div>
      <div class="col">
        <ul class="bl small">
          <li class="step">Models train <b>one after another</b> (sequential)</li>
          <li class="step">Each new model focuses on the samples the previous ones <b>misclassified</b> — their weight grows</li>
          <li class="step">Correctly classified samples get a <b>lower</b> weight</li>
          <li class="step">Final prediction: <b>weighted vote</b> of all models; repeat $k$ times or until a stopping condition</li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 35 · BAGGING VS BOOSTING ================= -->
<section class="slide" id="s35" data-accent="orange">
  <h1 class="ttl">Bagging vs. Boosting — the trade-off at a glance</h1>
  <div class="body">
    <table class="data" style="font-size:19px">
      <tr><th></th><th>Bagging (Random Forest)</th><th>Boosting</th></tr>
      <tr class="step"><td><b>Training</b></td><td>parallel</td><td>sequential</td></tr>
      <tr class="step"><td><b>Sampling</b></td><td>random, with replacement</td><td>adaptive re-weighting of samples</td></tr>
      <tr class="step"><td><b>Aggregation</b></td><td>averaging / voting</td><td>weighted voting</td></tr>
      <tr class="step"><td><b>Bias–variance</b></td><td>reduces <b>variance</b></td><td>reduces <b>bias</b></td></tr>
      <tr class="step"><td><b>Overfitting</b></td><td>less prone</td><td>performs generally better, but may overfit</td></tr>
    </table>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>
`);
