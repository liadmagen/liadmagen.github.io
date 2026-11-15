# From a Number to a Yes: storyboard

A scroll-driven page in the pattern of `../pmi/` and `../decision_trees/`: a figure pinned beside the text
(above it on phones), short step cards, six chapters, a dot navigation on the right. Scroll position scrubs the
figure, and every figure is a pure function of (step, progress, user state).

- **Audience:** MA students of language technology with a BA in translation studies: strong on language, weak on
  math notation. Plain words before symbols, at most about 70 words per card, at most four steps per chapter,
  formulas typeset with the local KaTeX.
- **Data:** synthetic. 40 made-up essays (x = average sentence length in words, y = a teacher's readability rating,
  0 to 100; "readable" means a rating of at least 60) and 34 made-up emails (x = how often "free" appears).
- **Numbers:** all computed in the browser by `lr-math.js` (unit-tested). Prose uses `{{placeholders}}`.

## Chapters and steps

| ch | step (`data-scene`) | beat | figure | controls |
|---|---|---|---|---|
| 1 Data and a line | `data` | 40 made-up essays; the drift | dots appear left to right | |
| | `draw` | predict first, then draw your line | two drag handles; caption: your line and its loss (mean squared error) | two sliders (line height at 8 and 26 words), reset |
| 2 How wrong is a line? | `squares` | residuals become real squares | segments drop, squares grow; caption: average square | |
| | `number` | every line has one number (MSE); the best scores about 80 | a line sweeps through five bad lines to the best one; its true MSE is shown all along | |
| 3 Finding the best line | `hotcold` | the model feels downhill | left: the line being tried; right: the loss map (log colour, exact rings), ball rolling | |
| | `valley` | why the valley is long and thin | a point slides along the valley floor; the line only pivots | |
| | `rate` | learning rate: too small, just right, too big | all three loss curves on a log axis | three buttons choose the highlighted curve |
| | `machine` | the finished line, slope in words, a new essay | stair of 1-word steps (each costs about 2.2 points); new essay at 12 words | |
| 4 A different question | `pivot` | from a rating to yes/no | the score axis melts into two rows (1 = readable, 0 = not) | |
| | `fails` | predict, then see the line leave the 0 to 1 range | line fitted to the 0/1 labels, out-of-range parts in red | predict buttons (in the card) |
| 5 Squish, then decide | `squish` | z is evidence; the S-curve makes it a probability | left: z against sentence length; right: the sideways S-curve sharing the z axis; a probe | |
| | `decide` | threshold 0.5, decision boundary, 33 of 40 | curve, regions, boundary, circled mistakes | |
| | `logloss` (optional) | the penalty is minus the log of the probability given to the right answer | 40 essays on the penalty curve; "sure and wrong" is tall | |
| | `odds` (optional) | each extra word multiplies the odds by about 0.63 | two probes on the curve and two odds bars | |
| 6 Spam and recap | `spam` | same machine on 34 made-up emails; slide the threshold | emails, curve, threshold, flagged region, red rings; caption: caught, missed, false alarms | threshold slider ("flag more" to "flag less"), predict buttons |
| | `lenses` | number vs. probability; more features; softmax and networks ahead | two panels, each with a probe | |

## Engine (in `app.js`)

- Each chapter has its own sticky `<svg>`, a caption line (HTML) and optional controls under it; captions never sit on the plot.
- A step arrives when its top reaches the middle of the screen (60% of the screen height on phones, where the figure is pinned
  in the top half); `q` runs from 0 to 1 over the next stretch of scrolling and scrubs the animation.
- The figure is rebuilt at the phone/desktop breakpoint; every chapter's build and render is wrapped in `try/catch`.
- Shared user state: your line (drawn in chapter 1, reused by chapters 2 and 3), the learning-rate choice and the spam threshold.
  A revision counter makes every figure redraw when it changes, so nothing goes stale.
- `prefers-reduced-motion`: scenes show their finished state.

## Credits

Structure inspired by R2D3's visual introduction to machine learning; further reading: Jurafsky & Martin,
*Speech and Language Processing*, chapter 5.
