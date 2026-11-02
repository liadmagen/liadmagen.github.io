/* Slides 1-12: opening, recap, supervised-learning landscape */
addSlides(String.raw`
<!-- ================= 1 · TITLE ================= -->
<section class="slide center" id="s01" data-accent="blue">
  <div class="brand">FH Campus Wien · Introduction to Machine Learning for Language Processing</div>
  <h1 class="big"><span class="w step">Introduction</span> <span class="w step">to</span> <span class="w step">Machine</span> <span class="w step">Learning</span></h1>
  <p class="subtitle step">Modeling · Text Models &amp; Features</p>
  <p class="kicker step" style="margin-top:46px">Probabilistic language models · Decision trees &amp; random forests · Model evaluation</p>
</section>

<!-- ================= 2 · AGENDA ================= -->
<section class="slide" id="s02" data-accent="blue">
  <h1 class="ttl">Today's Agenda</h1>
  <div class="body">
    <div class="agenda">
      <a href="#s04"><span class="no">1</span>Last week — quick recap<span class="sm">supervised vs. unsupervised · features · TF-IDF (click to jump)</span></a>
      <a href="#s13"><span class="no">2</span>Probabilistic Language Models<span class="sm">how likely is a sentence? · chain rule · n-grams</span></a>
      <a href="#s19"><span class="no">3</span>Decision Trees &amp; Random Forests<span class="sm">our first classifier · Gini &amp; entropy · ensembles</span></a>
      <a href="#s36"><span class="no">4</span>Model Evaluation<span class="sm">confusion matrix · precision/recall/F1 · ROC &amp; AUC · k-fold CV</span></a>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 3 · OBJECTIVES ================= -->
<section class="slide" id="s03" data-accent="blue">
  <h1 class="ttl">By the end of this session you can…</h1>
  <div class="body">
    <ul class="bl">
      <li class="step">compute how likely a sentence is with a (n-gram) <span class="hl">language model</span></li>
      <li class="step">build, read and grow a <span class="hl">decision tree</span> — our first classifier — and combine many trees into a <span class="hl">random forest</span></li>
      <li class="step">pick the <span class="hl">right evaluation metric</span> for a classifier (accuracy is not always enough!)</li>
      <li class="step">read a <span class="hl">ROC curve</span>, interpret <span class="hl">AUC</span>, and run <span class="hl">k-fold cross-validation</span></li>
    </ul>
    <p class="note step">You already know the basics (supervised vs. unsupervised, feature functions, TF-IDF) — a 5-question recap gets us started.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 4-8 · RECAP ================= -->
<section class="slide" id="s04" data-accent="lblue">
  <h1 class="ttl">Last Week — Recap <span class="sub">1/5 · try to answer before clicking</span></h1>
  <div class="body">
    <p class="q">What is the difference between <b>supervised</b> and <b>unsupervised</b> learning?</p>
    <div class="ans step">Supervised learning trains on <b>labeled</b> examples (input → known output) and predicts labels for new inputs. Unsupervised learning gets <b>unlabeled</b> data and finds structure in it (clusters, patterns, density).</div>
    <p class="why step">Why today: decision trees &amp; language models are <b>supervised</b> — we always train on labeled data.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<section class="slide" id="s05" data-accent="lblue">
  <h1 class="ttl">Last Week — Recap <span class="sub">2/5</span></h1>
  <div class="body">
    <p class="q">In supervised learning — what is the difference between <b>classification</b> and <b>regression</b>?</p>
    <div class="ans step">Both predict an output from labeled examples. <b>Classification</b> predicts a <b>discrete class</b> (spam / ham); <b>regression</b> predicts a <b>continuous value</b> (price, temperature).</div>
    <p class="why step">Why today: our classifiers output classes — and the metrics differ per task (F1 vs. MSE).</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<section class="slide" id="s06" data-accent="lblue">
  <h1 class="ttl">Last Week — Recap <span class="sub">3/5</span></h1>
  <div class="body">
    <p class="q">In classification — binary vs. multiclass vs. <b>multilabel</b>?</p>
    <div class="ans step"><b>Binary:</b> two classes. <b>Multiclass:</b> one of k &gt; 2 mutually exclusive classes. <b>Multilabel:</b> several labels can be true <b>at the same time</b> per instance (e.g. a news article that is both <i>politics</i> and <i>economy</i>).</div>
    <p class="why step">Why today: evaluation metrics are defined for binary first — then extended to multiclass.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<section class="slide" id="s07" data-accent="lblue">
  <h1 class="ttl">Last Week — Recap <span class="sub">4/5</span></h1>
  <div class="body">
    <p class="q">What is a <b>"feature function"</b>?</p>
    <div class="ans step">A function $\varphi(x)$ that maps an instance $x$ (e.g. a document) to a <b>numeric feature vector</b> $\varphi(x) \in \mathbb{R}^d$ that a learning algorithm can compute with. "Garbage in, garbage out": the features largely decide what can be learned.</div>
    <p class="why step">Why today: a decision tree asks yes/no questions <b>about features</b> — feature quality drives every split.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<section class="slide" id="s08" data-accent="lblue">
  <h1 class="ttl">Last Week — Recap <span class="sub">5/5</span></h1>
  <div class="body">
    <p class="q">TF-IDF vs. plain word-count vector — what is the advantage?</p>
    <div class="ans step">Word counts only say <b>how often</b> a word occurs. TF-IDF additionally <b>down-weights words that appear in many documents</b> (via the IDF factor), so discriminative words — the ones that separate classes — get more weight.</div>
    <p class="why step">Why today: same idea inside trees — the best split is the feature that best <b>separates the classes</b>.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 9 · OUTPUT SPACE ================= -->
<section class="slide" id="s09" data-accent="lblue">
  <h1 class="ttl">Canonical Supervised Learning Types — by output space</h1>
  <div class="body">
    <div class="grid2">
      <div class="tile step"><span class="big">Continuous output</span>→ <b>Regression</b><br><span class="muted">predict a number: price, temperature, rating…</span></div>
      <div class="tile step"><span class="big">Discrete output</span>→ <b>Classification</b><br><span class="muted">predict a class: spam/ham, topic, sentiment…</span></div>
    </div>
    <p class="note step">The output space decides which algorithms and which evaluation metrics make sense.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 10 · OUTPUT SCOPES ================= -->
<section class="slide" id="s10" data-accent="lblue">
  <h1 class="ttl">Classification Output Scopes</h1>
  <div class="body">
    <div class="grid3">
      <div class="tile step"><span class="big">Binary</span><div class="math sm">$$\{-1,\,+1\}$$</div>spam vs. ham, fraud vs. legit</div>
      <div class="tile step"><span class="big">Multi-class</span><div class="math sm">$$\{1, 2, \dots, k\}$$</div>one label per instance: news topic, POS tag</div>
      <div class="tile step"><span class="big">Multi-label</span><div class="math sm">$$2^{\{1,\dots,k\}}$$</div>any subset of labels: article tags, symptoms</div>
    </div>
    <p class="note step">Multi-label = the <b>power set</b> of labels: each instance gets a subset of $\{1,\dots,k\}$. Regression output is simply $\hat y \in \mathbb{R}$.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 11 · REGRESSION ================= -->
<section class="slide" id="s11" data-accent="lblue">
  <h1 class="ttl">Regression — the continuous sibling</h1>
  <div class="body">
    <ul class="bl">
      <li class="step">Output: a real number $\hat y \in \mathbb{R}$ — price of a flat, tomorrow's temperature, document length</li>
      <li class="step">Prediction is a point on a <span class="hl">number line</span>; error = distance $\lvert y - \hat y \rvert$</li>
      <li class="step">Typical metric: <span class="hl">Mean Squared Error</span><div class="math">$$\mathrm{MSE} = \frac{1}{n}\sum_{i=1}^{n} (y_i - \hat y_i)^2$$</div></li>
    </ul>
    <p class="note step">Today we focus on <b>classification</b> — but remember the split: continuous → regression, discrete → classification.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 12 · POPULAR CLASSIFIERS ================= -->
<section class="slide" id="s12" data-accent="lblue">
  <h1 class="ttl">Popular Classifiers — today's focus in orange</h1>
  <div class="body">
    <div class="grid3">
      <div class="tile step">k-Nearest Neighbors<span class="note">classify by the labels of the k closest points</span></div>
      <div class="tile step hot pulse" style="border-color:var(--orange)"><b>Decision Trees</b><span class="note">← today: our first classifier</span></div>
      <div class="tile step">Forests &amp; Boosting<span class="note">many trees combined (Random Forest…)</span></div>
      <div class="tile step">Logistic Regression<span class="note">probabilistic, linear boundary</span></div>
      <div class="tile step">SVM<span class="note">max-margin hyperplane</span></div>
      <div class="tile step">Neural Networks<span class="note">later sessions</span></div>
    </div>
    <p class="note step">Practical toolkit: <span class="mono">scikit-learn</span> (Python) implements all of these with the same <span class="mono">fit() / predict()</span> interface.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>
`);
