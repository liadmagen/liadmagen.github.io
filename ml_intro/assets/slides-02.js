/* Slides 19-27: Decision Trees (part 1) */
addSlides(String.raw`
<!-- ================= 19 · DIVIDER ================= -->
<section class="slide center divider" id="s19" data-accent="orange">
  <h1 class="big"><span class="w step">Decision</span> <span class="w step">Trees</span></h1>
  <p class="subtitle step">&amp; Random Forests — our first classifier</p>
</section>

<!-- ================= 20 · MOTIVATION ================= -->
<section class="slide" id="s20" data-accent="orange">
  <h1 class="ttl">Machine Learning through Decision Trees — how do <i>you</i> decide?</h1>
  <div class="body">
    <p class="step" style="font-size:21px; margin-bottom:16px">Problem: <b>choose a master's programme</b>. You weigh city, reputation, flexibility… and decide. A decision tree learns exactly such questions from data.</p>
    <table class="data step" style="max-width:820px">
      <tr><th>Programme</th><th>City</th><th>Reputation</th><th>Flexible</th><th>Decision</th></tr>
      <tr><td>MLT</td><td>Amsterdam</td><td>100</td><td>Y</td><td class="y">Y</td></tr>
      <tr><td>NLP</td><td>New York</td><td>80</td><td>N</td><td class="n">N</td></tr>
      <tr><td>ABC</td><td>Linz</td><td>90</td><td>N</td><td class="n">N</td></tr>
      <tr><td>ETC</td><td>Vienna</td><td>100</td><td>Y</td><td class="n">N</td></tr>
    </table>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 21 · FEATURES ================= -->
<section class="slide" id="s21" data-accent="orange">
  <h1 class="ttl">Decision Tree — Features: turn everything into numbers</h1>
  <div class="body">
    <table class="data step" style="max-width:860px">
      <tr><th>Programme</th><th>Distance (km)</th><th>Reputation</th><th>Flexible (0/1)</th><th>Decision</th></tr>
      <tr><td>MLT</td><td>3,000</td><td>100</td><td>1</td><td class="y">Y</td></tr>
      <tr><td>NLP</td><td>4,000</td><td>80</td><td>0</td><td class="n">N</td></tr>
      <tr><td>ABC</td><td>8,000</td><td>90</td><td>0</td><td class="n">N</td></tr>
      <tr><td>ETC</td><td>3,500</td><td>100</td><td>1</td><td class="n">N</td></tr>
    </table>
    <ul class="bl small" style="margin-top:18px">
      <li class="step">Every instance becomes a feature vector $\varphi(x) = (\text{distance}, \text{reputation}, \text{flexible})$</li>
      <li class="step">Trees ask <b>binary questions about one feature</b>: "Reputation ≥ 90?", "Flexible = 1?"</li>
    </ul>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 22 · BASIC IDEA ================= -->
<section class="slide" id="s22" data-accent="orange" data-autoplay="1400">
  <h1 class="ttl">Decision Tree — Basic Idea</h1>
  <div class="body">
    <ul class="bl" style="font-size:24px">
      <li class="step">1 · Begin the tree with a <b>root node</b> (all training data)</li>
      <li class="step">2 · Identify a <b>binary question</b> for splitting the data</li>
      <li class="step">3 · <b>Split</b> the data into two subsets based on the question</li>
      <li class="step">4 · <b>Repeat</b> — questions and splits — until nodes can't be split further; the final nodes are <b>leaf nodes</b> (the prediction)</li>
    </ul>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 23 · ANIMATED TREE BUILD ================= -->
<section class="slide" id="s23" data-accent="orange" data-autoplay="1500">
  <h1 class="ttl">Watch the tree grow — from the programme table</h1>
  <div class="body">
    <div class="cols" style="align-items:center">
      <div class="col">
        <svg viewBox="0 0 680 430" style="width:100%; max-width:680px">
          <g class="step">
            <rect class="node q" x="230" y="18" width="180" height="50" rx="10"/>
            <text x="320" y="49">Reputation ≥ 90?</text>
          </g>
          <g class="step">
            <line class="edge" x1="282" y1="68" x2="152" y2="196"/>
            <text class="elab" x="196" y="130">No</text>
            <rect class="node leafN" x="82" y="196" width="140" height="50" rx="10"/>
            <text x="152" y="228">N (NLP, ABC)</text>
          </g>
          <g class="step">
            <line class="edge" x1="358" y1="68" x2="488" y2="196"/>
            <text class="elab" x="448" y="130">Yes</text>
            <rect class="node q" x="418" y="196" width="140" height="50" rx="10"/>
            <text x="488" y="228">Flexible = 1?</text>
          </g>
          <g class="step">
            <line class="edge" x1="458" y1="246" x2="392" y2="336"/>
            <text class="elab" x="398" y="296">Yes</text>
            <line class="edge" x1="518" y1="246" x2="586" y2="336"/>
            <text class="elab" x="566" y="296">No</text>
          </g>
          <g class="step">
            <rect class="node leafY" x="322" y="336" width="140" height="50" rx="10"/>
            <text x="392" y="368">Y (MLT)</text>
            <rect class="node leafN" x="516" y="336" width="140" height="50" rx="10"/>
            <text x="586" y="368">N (ETC)</text>
          </g>
        </svg>
      </div>
      <div class="col">
        <ul class="bl small">
          <li class="step">Root: all 4 programmes</li>
          <li class="step">Best question: <b>Reputation ≥ 90?</b> — separates the data</li>
          <li class="step">"No" branch is already pure → leaf <b>N</b></li>
          <li class="step">"Yes" branch still mixed → ask <b>Flexible = 1?</b></li>
          <li class="step">Both leaves pure → stop. Prediction = leaf label</li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 24 · WORKED EXAMPLE: ROWS INTO BRANCHES ================= -->
<section class="slide" id="s24" data-accent="orange" data-autoplay="1300">
  <h1 class="ttl">Same example — the rows literally flow into the branches</h1>
  <div class="body">
    <div class="cols">
      <div class="col">
        <table class="data" style="font-size:17px">
          <tr><th></th><th>Rep</th><th>Flex</th><th>Dec</th></tr>
          <tr class="step"><td>MLT</td><td>100</td><td>1</td><td class="y">Y</td></tr>
          <tr class="step"><td>NLP</td><td>80</td><td>0</td><td class="n">N</td></tr>
          <tr class="step"><td>ABC</td><td>90</td><td>0</td><td class="n">N</td></tr>
          <tr class="step"><td>ETC</td><td>100</td><td>1</td><td class="n">N</td></tr>
        </table>
        <p class="note step">Root question: <b>Reputation ≥ 90?</b></p>
      </div>
      <div class="col">
        <div class="card step" style="border-color:var(--coral)"><h3 style="color:var(--coral)">No → leaf N</h3>
          <span class="chip fp step">NLP (80)</span> <span class="chip fp step">ABC (90)</span></div>
        <div class="card step" style="margin-top:14px; border-color:var(--amber)"><h3 style="color:var(--amber)">Yes → still mixed, split again</h3>
          <span class="chip tn step">MLT (100)</span> <span class="chip tn step">ETC (100)</span>
          <p class="note step">Next question: <b>Flexible = 1?</b> → MLT: <b class="y">Y</b>, ETC: <b class="n">N</b></p></div>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 25 · DECISION BOUNDARY ================= -->
<section class="slide" id="s25" data-accent="orange" data-autoplay="1500">
  <h1 class="ttl">Decision Tree &amp; Decision Boundary — the staircase</h1>
  <div class="body">
    <div class="cols" style="align-items:center">
      <div class="col">
        <svg viewBox="0 0 640 440" style="width:100%">
          <!-- axes -->
          <g class="step">
            <line x1="80" y1="380" x2="620" y2="380" stroke="#c9ced6" stroke-width="2"/>
            <line x1="80" y1="380" x2="80" y2="60" stroke="#c9ced6" stroke-width="2"/>
            <text class="elab" x="330" y="415">Reputation →</text>
            <text class="elab" x="20" y="70">Flexible ↑</text>
            <text class="elab" x="470" y="402">100</text><text class="elab" x="120" y="402">80</text>
            <text class="elab" x="50" y="125">1</text><text class="elab" x="50" y="325">0</text>
          </g>
          <!-- points: MLT(100,1,Y) ETC(100,0,N) NLP(80,0,N) ABC(90,0,N); x: rep 75..105 -> 80..600 ; flex1 y=120, flex0 y=320 -->
          <g class="step">
            <circle class="pt" cx="513" cy="120" r="11" fill="var(--teal)"/>
            <circle class="pt" cx="513" cy="320" r="11" fill="var(--coral)"/>
            <circle class="pt" cx="166" cy="320" r="11" fill="var(--coral)"/>
            <circle class="pt" cx="340" cy="320" r="11" fill="var(--coral)"/>
            <text class="elab" x="524" y="112">MLT·Y</text><text class="elab" x="524" y="332">ETC·N</text>
            <text class="elab" x="120" y="345">NLP·N</text><text class="elab" x="300" y="345">ABC·N</text>
          </g>
          <!-- vertical split at rep=90 -> x=340 -->
          <line class="split step" x1="340" y1="70" x2="340" y2="380"/>
          <!-- left region = N -->
          <rect class="regionN step" x="80" y="60" width="260" height="320"/>
          <text class="elab step" x="160" y="220" font-size="26" fill="var(--coral)" font-weight="bold">N region</text>
          <!-- horizontal split at flex=0.5 -> y=220, only right side -->
          <line class="split step" x1="340" y1="220" x2="620" y2="220"/>
          <rect class="regionY step" x="340" y="60" width="280" height="160"/>
          <text class="elab step" x="420" y="140" font-size="26" fill="var(--teal)" font-weight="bold">Y region</text>
          <text class="elab step" x="360" y="300" font-size="20" fill="var(--coral)">N (rep≥90 but not flexible)</text>
        </svg>
      </div>
      <div class="col">
        <ul class="bl small">
          <li class="step">Each split = one <b>axis-parallel line</b></li>
          <li class="step">The boundary is a <b>staircase</b> of rectangles — never diagonal</li>
          <li class="step">New instance? Walk from the root down the tree = find its rectangle</li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 26 · DIGGING DEEPER ================= -->
<section class="slide" id="s26" data-accent="orange">
  <h1 class="ttl">Digging deeper — the four questions that matter</h1>
  <div class="body">
    <ul class="bl">
      <li class="step"><b>Does the model pick the best value?</b><br><span class="ans" style="display:block">It scores every candidate split (Gini / entropy) and picks the best — but <i>greedily</i>, step by step.</span></li>
      <li class="step"><b>How does it decide which column to choose?</b><br><span class="ans" style="display:block">The feature with the highest information gain (largest impurity reduction).</span></li>
      <li class="step"><b>Does the order of the features matter? Is there randomization?</b><br><span class="ans" style="display:block">Yes — greedy order changes the tree. Random Forests exploit this: each tree sees a random subset of features.</span></li>
      <li class="step"><b>Can we do better than one tree?</b><br><span class="ans" style="display:block">Yes — combine many trees: <b>Random Forest</b> (later in this section).</span></li>
    </ul>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 27 · BUILDING ALGORITHM (recursive flowchart) ================= -->
<section class="slide" id="s27" data-accent="orange" data-autoplay="1400">
  <h1 class="ttl">Decision Tree Building Algorithm — recursive, with exit criteria</h1>
  <div class="body">
    <div class="flowwrap">
      <svg style="position:absolute; left:60px; top:40px; width:170px; height:400px; overflow:visible" viewBox="0 0 170 400">
        <path class="step" d="M 140 320 C 30 320, 30 140, 128 140" fill="none" stroke="var(--purple)" stroke-width="3" stroke-dasharray="9 7" marker-end="url(#ah)"/>
        <defs><marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="var(--purple)"/></marker></defs>
        <text class="looplab step" x="8" y="235">recurse on each subset</text>
      </svg>
      <div class="flowcol">
        <div class="flowbox head step">Training data at this node</div>
        <div class="flowarrow step">↓</div>
        <div class="flowbox step">Score <b>every candidate split</b><br><span class="muted" style="font-size:15px">Gini impurity · Entropy / information gain · Variance reduction (regression)</span></div>
        <div class="flowarrow step">↓</div>
        <div class="flowbox step">Pick the <b>best question</b> (lowest weighted impurity)</div>
        <div class="flowarrow step">↓</div>
        <div class="flowbox step">Split into <b>left / right</b> subset</div>
        <div class="flowarrow step">↓</div>
        <div class="flowbox leaf step">Leaf = predict the majority class</div>
      </div>
      <div class="stopbox step">
        <h3>⏹ Exit criteria — stop splitting when…</h3>
        · the node is <b>pure</b> (one class only)<br>
        · <b>max depth</b> reached<br>
        · <b>min samples</b> per node reached<br>
        · no split improves impurity
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>
`);
