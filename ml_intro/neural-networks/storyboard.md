# From a Yes to a Network: storyboard

A scroll-driven page in the pattern of `../linear-and-logistic-regression/`, `../pmi/` and `../decision_trees/`: a figure pinned beside
the text (above it on phones), short step cards, eight chapters, a dot navigation on the right. Scroll position scrubs the figure, and every
figure is a pure function of (step, progress, user state).

- **Role:** the sequel to *From a Number to a Yes*. It starts where that page ends (linear regression wrapped in a sigmoid) and ends where the
  word2vec reading begins. Students already know linear regression and regularization (ElasticNet), so chapter 1 is a quick re-pivot, not a re-teach.
- **Audience:** MA students of language technology with a BA in translation studies. Plain words before symbols, at most about 70 words per card
  (tested at 80), at most two new bold terms per card, formulas typeset with the local KaTeX.
- **Data:** the movie-review example from the course slides (six features, weights `[2.5, -5.0, -1.2, 0.5, 2.0, 0.7]`, bias 0.1, z = 0.833,
  sigma(z) = 0.70), the cheese/bread/goat/sheep co-occurrence matrix from the slides, and synthetic data: 12 separable points, 80 points in four XOR blobs,
  a 14-word corpus. The page says so.
- **Numbers:** everything is computed in the browser by `nn-math.js` (unit-tested). Prose uses `{{placeholders}}`.
- **Framing of the last chapters** follows the teacher's own introduction to the word2vec session: a word representation can be learned by
  factorising a co-occurrence table or by a prediction task; a Markov chain is a graph of next-word probabilities; a neural network with a
  vocabulary-sized inner matrix and a one-hot input learns rows for which similar words (hotel, motel) are near each other, measured by cosine similarity.

## Chapters and steps

| ch | step (`data-scene`) | beat | figure | controls |
|---|---|---|---|---|
| 1 One yes/no machine | `review` | weight each feature, add up, squish: z = 0.83 gives 70% positive | waterfall of the six pieces of evidence, then the sigmoid with a probe | positive-words and negative-words sliders |
| | `loss` | the penalty is minus the log of the probability given to the right answer | penalty curve, review marked | true label: positive / negative |
| | `reg` (optional) | on perfectly separable data the weight never stops growing; a penalty (ElasticNet's idea) stops it | data and sigmoid, weight against training step | penalty: none / small / large (scroll scrubs training) |
| | `softmax` | the sigmoid for many classes; one-hot target; same penalty | score bars into probability bars | three score sliders |
| 2 A neuron | `neuron` | the review model drawn as a node: inputs, weighted edges, sum, activation, output | live neuron diagram | sigmoid / ReLU |
| | `bio` (optional) | 1943, 1958; a network is a chain of learned bendings, not a model of the brain | timeline, real vs. artificial neuron | |
| 3 One neuron is not enough | `xor` | predict first: one straight line gets at best 75% on XOR blobs | blobs, the single neuron's line and regions | predict buttons (in the card) |
| | `hidden` | each hidden neuron draws a line; the output combines them | trained regions, dashed hidden lines | 0 / 2 / 3 / 8 hidden neurons |
| | `space` | seen through the hidden neurons the points are separable by one line | points morph from input space to hidden space | |
| 4 Layers and the forward pass | `layers` | input size = features, output size = classes, hidden size = your choice; the translation question | 6-4-3 layer diagram with size badges | predict buttons |
| | `forward` | multiply, add, squish, layer after layer; nothing is learned | trained 2-2-1 network with live numbers, input on the learned regions | two input sliders |
| 5 Learning | `backprop` | forward, loss, blame flows backwards, weights nudged | the same network, four phases scrubbed by scroll | |
| | `train` | an epoch; the loss falls while the regions bend | regions and loss curve scrubbed over 400 epochs | |
| | `choices` | training learns weights and biases only; hyper-parameters and the loss follow the task | two cards and a loss table | |
| 6 Words as numbers | `onehot` | every pair of one-hot words has cosine similarity 0 | one-hot grid and cosine table | |
| | `company` | the company a word keeps; the slides' counts and cosines (0.80 ... 0.04) | count matrix, cosine matrix, two rows as bars | pair selector |
| | `dense` | two routes to dense vectors: count then compress (SVD, PMI page), or learn to predict | two lanes | |
| 7 From counting to a network | `markov` | a Markov chain is a table of what follows what; "motel pool" is exactly 0 | word graph, edge thickness = probability | word selector; predict buttons |
| | `lookup` | one-hot times an inner matrix picks one row: an embedding layer is a lookup table | one-hot column times a 14 x 2 matrix | word selector |
| | `bigram` | predict the next word; labels come free; compared with the Markov table | network, probability bars, Markov ticks | word selector |
| 8 Similar words, nearby rows | `nearby` | scroll to train: arrows turn; hotel-motel and goat-sheep point the same way; the unseen pair gets a probability | word vectors as arrows, cosine bars, unseen-pair box | |
| | `next` | what to look for in word2vec: both-sided windows (skip-gram, CBOW), negative sampling, evaluation, what came next | checklist | |

## Engine

- `kit.js` is the scroll engine, drawing kit, tooltips, placeholders and predict boxes; each `ch-*.js` calls `NNKIT.register('chN', build)`;
  `app.js` boots. Each chapter has its own sticky `<svg id="vizN">`, a caption line (`capN`) and optional controls (`ctlN`) below it; captions never sit on the plot.
- A step arrives when its top reaches the middle of the screen (66% on phones, where the figure is pinned in the top half); `q` runs from 0 to 1 over
  the next stretch of scrolling and scrubs the animation. The figure is rebuilt at the phone/desktop breakpoint; every build and render is wrapped in `try/catch`.
- Control groups inside a chapter's controls are shown only at their step (`data-for`). A shared state object (`NNKIT.S`) holds the sliders and
  selections, and a revision counter makes every figure redraw when it changes.
- Colours: purple = the thing you move, blue = "yes" and evidence for, orange = "no", evidence against and error, red = blame flowing backwards, teal = the
  final result. Classes also differ by shape (circle / diamond) and words always carry labels.
- `prefers-reduced-motion`: scenes show their finished state.

## Credits

Structure inspired by R2D3's visual introduction to machine learning; further reading: Jurafsky & Martin, *Speech and Language Processing*, chapters 5 to 7;
Jay Alammar, *The Illustrated Word2vec*; Lena Voita's NLP course.
