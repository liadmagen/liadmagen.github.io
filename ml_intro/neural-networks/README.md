# From a Yes to a Network: neural networks, visualised, and the stage for word2vec

A scroll-driven visual introduction to neural networks for the course *Introduction to ML for Language Technologies*
(MA students with a background in translation studies). It is the sequel to `../linear-and-logistic-regression/` and follows the same pattern
as that page and `../pmi/`: a figure pinned beside (on phones: above) short text steps, grouped into chapters.

The story: the logistic regression the students already know (a weighted sum squeezed by the sigmoid, using the movie-review example from the class slides),
the cross-entropy penalty, an optional look at why logistic regression needs regularization, softmax, the same machine drawn as a neuron,
why one neuron cannot solve XOR and what a hidden layer adds, layers and the forward pass, backpropagation and training, then the road to word vectors:
one-hot vectors and cosine similarity, a Markov chain of next-word probabilities, an embedding layer as a lookup table, and a tiny neural next-word model
whose two-number word vectors turn *hotel* and *motel* (and *goat* and *sheep*) the same way. The last step lists what to look for when reading about word2vec.

All data is synthetic except the movie-review numbers and the cheese/bread/goat/sheep co-occurrence matrix, which come from the course slides. The page says so.

## Files

| file | what it is |
|---|---|
| `index.html` | the page: layout, styles, all prose (edit freely; numbers are `{{placeholders}}`) |
| `kit.js` | shared engine: scroll logic, drawing helpers, KaTeX helpers, tooltips, placeholder filling, predict boxes (`window.NNKIT`) |
| `ch-neuron.js` | chapters 1 and 2: the weighted sum, the penalty, regularization, softmax, the neuron |
| `ch-network.js` | chapters 3, 4 and 5: XOR and hidden layers, layers and the forward pass, backpropagation and training |
| `ch-words.js` | chapters 6 and 7: one-hot vectors, co-occurrence rows and cosine, the Markov chain, the embedding layer, the next-word network |
| `ch-handoff.js` | chapter 8: word vectors appearing while the tiny network trains, and the hand-off to word2vec |
| `app.js` | boot: fills placeholders, typesets formulas, starts the engine |
| `nn-math.js` | pure maths (UMD: `window.NNM` in the browser, `module.exports` in node): the review example, softmax, the regularization demo, the small network with backpropagation, the XOR data, the corpus, the Markov table, the embedding trainer, cosine |
| `nn-math.test.js` | unit tests, run with `node nn-math.test.js` |
| `storyboard.md` | the chapter-by-chapter spec this build follows |
| `../vendor/katex/` | local KaTeX, shared with the other pages (the page works offline) |

Script order matters: KaTeX, `nn-math.js`, `kit.js`, the `ch-*.js` files, `app.js`. Classic `<script>` tags only (ES modules do not load from `file://`).

## Open it

Double-click `index.html`. No build step, no server, no internet needed. Everything is trained live in the browser at page load (about 70 ms).

## Tests

```bash
node nn-math.test.js
```

The tests assert, among others: the slide numbers (z = 0.833, sigma = 0.70, the six cheese-matrix cosine similarities); softmax and penalty properties;
that the weight grows forever without a penalty and settles with one; that backpropagation gradients equal finite differences; that one neuron stays at or below
80% on the XOR blobs while 2, 3 and 8 hidden neurons reach at least 95%; that training is deterministic; that *motel pool* never occurs in the corpus and has Markov
probability exactly 0 while the network gives it at least 50 times the probability of *goat pool*; that hotel-motel and goat-sheep have cosine similarity above 0.95
and hotel-goat below 0.3; that every `{{placeholder}}` in `index.html` is defined, every scene has a handler and every card stays short.

## How the numbers get into the prose

Every number in a step card is a placeholder such as `{{z}}` or `{{acc8}}`, filled by `kit.js` from `NNM.values(...)` when the page loads
(`{{t:...}}` gives a TeX-safe minus; `{{cc 0 1}}` takes arguments). Captions under the figures are built in the chapter files from the same module.
If you change the data or the training settings, the text follows; nothing is typed in twice.

## Design notes

- **Frozen seeds.** Every training run uses a seeded generator and frozen settings (`NET_CONFIGS`, `EMB`, `SEP_*` in `nn-math.js`), so everyone sees the same page.
  The XOR networks use sigmoid hidden units (so students meet no new function) and full-batch gradient descent. With only 2 hidden neurons some seeds get stuck
  (3 of the first 8 seeds I tried stayed below 95%), which is why the seeds are frozen: they were picked so that the 2, 3 and 8-neuron networks all pass, and the tests guard this.
- **Two dimensions on purpose.** The next-word model has a 2-number hidden layer so the vectors can be drawn. With so few dimensions, unrelated words can line up by luck
  (the card says real vectors have 50 to 1000 numbers), so the seed was chosen so the key pairs behave and unrelated ones (hotel, goat) do not. Words with the same followers
  (grass/hay, clean/cheap) also land on top of each other; the labels are fanned out with leader lines.
- **Early stopping.** The embedding model stops at 300 epochs: trained much longer it becomes more certain and gives unseen pairs a smaller probability.
- **Cosine similarity, never distance.** Captions say "cosine similarity"; the arrows from the origin make it visibly the angle between two vectors. Values above 0.995 are
  shown as "over 0.99" instead of a misleading 1.00.
- **Scenes are pure functions** of (chapter step, scroll progress, user state). Scrolling backwards, fast scrolling and jumping with the dot navigation all just redraw.
- `prefers-reduced-motion` shows every scene in its finished state.
