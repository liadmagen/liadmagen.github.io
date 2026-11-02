/* Slides 13-18: Probabilistic Language Models */
addSlides(String.raw`
<!-- ================= 13 · DIVIDER ================= -->
<section class="slide center divider" id="s13" data-accent="teal">
  <h1 class="big"><span class="w step">Probabilistic</span> <span class="w step">Language</span> <span class="w step">Models</span></h1>
</section>

<!-- ================= 14 · LANGUAGE UNDERSTANDING ================= -->
<section class="slide" id="s14" data-accent="teal" data-autoplay="900">
  <h1 class="ttl">Language Understanding — how likely is this sentence?</h1>
  <div class="body" style="align-items:center">
    <p style="font-size:40px; letter-spacing:.04em">
      <span class="step" style="color:var(--teal)">the</span>
      <span class="step" style="color:var(--teal)">cat</span>
      <span class="step" style="color:var(--teal)">sits</span>
      <span class="step" style="color:var(--teal)">on</span>
      <span class="step" style="color:var(--teal)">the</span>
      <span class="step" style="color:var(--teal)">mat</span>
    </p>
    <p class="step" style="font-size:22px; margin-top:26px">…vs. <span style="color:var(--coral)">"mat the on sits cat the"</span> — same words, nonsense order.</p>
    <p class="step" style="font-size:26px; margin-top:26px">A good model assigns a <b>high probability</b> to the first, <b>≈ 0</b> to the second:</p>
    <p class="step" style="font-size:24px; margin-top:14px"><span class="pill">$$P(\text{the cat sits on the mat}) \approx 3\cdot 10^{-6}$$</span></p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 15 · WHAT IS A LANGUAGE MODEL ================= -->
<section class="slide" id="s15" data-accent="teal">
  <h1 class="ttl">What is a Language Model?</h1>
  <div class="body">
    <ul class="bl">
      <li class="step"><b>Goal:</b> compute the probability of a sentence / word sequence $w_1, w_2, \dots, w_n$
        <div class="math">$$P(w_1, w_2, \dots, w_n)$$</div></li>
      <li class="step"><b>Related task:</b> predict the next word given the previous ones
        <div class="math">$$P(w_5 \mid w_1, w_2, w_3, w_4)$$</div></li>
    </ul>
    <p class="ans step" style="text-align:center">A model that computes either of the above is called a <b>Language Model</b>.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 16 · CHAIN RULE ================= -->
<section class="slide" id="s16" data-accent="teal" data-autoplay="1600">
  <h1 class="ttl">The Chain Rule — decomposing a sentence probability</h1>
  <div class="body">
    <div class="math step" style="font-size:26px">$$P(w_1, w_2, \dots, w_n)$$</div>
    <div class="math step" style="font-size:26px">$$P(w_1, w_2, \dots, w_n) \;=\; \textcolor{#EF8900}{P(w_1)} \cdot \textcolor{#0088A9}{P(w_2 \mid w_1)} \cdot \textcolor{#7D5C9E}{P(w_3 \mid w_1, w_2)} \cdots P(w_n \mid w_1, \dots, w_{n-1})$$</div>
    <div class="math step" style="font-size:26px">$$\text{Markov assumption (bigram): } P(w_1, \dots, w_n) \approx \prod_{i=1}^{n} P(w_i \mid w_{i-1})$$</div>
    <p class="note step">Each factor is estimated from counts in a large corpus: $P(w_i \mid w_{i-1}) = \frac{\mathrm{count}(w_{i-1}, w_i)}{\mathrm{count}(w_{i-1})}$. Longer context (trigrams…) = better, but sparser counts.</p>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 17 · PROBABILITY TOOLBOX ================= -->
<section class="slide" id="s17" data-accent="teal">
  <h1 class="ttl">Probability toolbox — quick reminder</h1>
  <div class="body">
    <div class="cols">
      <div class="col">
        <ul class="bl">
          <li class="step"><b>Joint:</b> $P(A, B)$ — A and B happen together</li>
          <li class="step"><b>Conditional:</b> $P(A \mid B)$ — A, given that B happened</li>
          <li class="step"><b>Marginal:</b> $P(A) = \sum_B P(A, B)$ — ignore B</li>
        </ul>
      </div>
      <div class="col">
        <p class="step" style="font-size:20px; margin-bottom:6px"><b>Bayes' rule:</b></p>
        <div class="math step" style="font-size:28px">$$P(A \mid B) = \frac{\textcolor{#EF8900}{P(B \mid A)\, P(A)}}{\textcolor{#0088A9}{P(B)}}$$</div>
        <p class="note step">"Flip" a conditional probability — the basis of probabilistic classifiers (next session).</p>
      </div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>

<!-- ================= 18 · TYPES OF CLASSIFIERS ================= -->
<section class="slide" id="s18" data-accent="teal">
  <h1 class="ttl">Types of classifiers — where do models sit?</h1>
  <div class="body">
    <ul class="bl">
      <li class="step"><b>Generative</b> models $P(x, y)$ — learn how the data is generated, then use Bayes. &nbsp;<b>Discriminative</b> models $P(y \mid x)$ — learn the boundary directly.</li>
      <li class="step"><b>Probabilistic</b> (outputs a probability) vs. <b>non-probabilistic</b> (outputs a hard label)</li>
      <li class="step"><b>Linear</b> (straight decision boundary) vs. <b>non-linear</b> (arbitrary shapes)</li>
    </ul>
    <div class="cols" style="margin-top:18px">
      <div class="card accent step" style="--acc:var(--teal)"><h3>Language models (this section)</h3>generative · probabilistic · linear in log-space</div>
      <div class="card step" style="border-color:var(--orange)"><h3 style="color:var(--orange)">Decision trees (next section)</h3>discriminative · non-probabilistic · non-linear — our first classifier</div>
    </div>
  </div>
  <footer class="foot"><span>FH Campus Wien&nbsp;&nbsp;|</span><span class="num"></span></footer>
</section>
`);
