# Fair Scales, Honest Models: feature scaling, generalization, L1 and L2, visualised

A scroll-driven visual introduction to **feature scaling** (normalization and standardization), **generalization**, and
**L1 / L2 regularization** for the course *Introduction to ML for Language Technologies* (MA students with a background in
translation studies). It follows the same pattern as the sibling pages `../pmi/`, `../decision_trees/` and
`../linear-and-logistic-regression/`: a figure pinned beside (on phones: above) short text steps, grouped into chapters.

The story, in two parts.

**Part 1, units (chapters 1 to 4).** 40 made-up people in two groups, A and B, who differ mainly in height; their weights
overlap almost completely. Distance adds up squared gaps (0.10 m against 20 kg), so on metres and kilograms k-means splits by
weight and recovers only about half of the groups. Measure height in centimetres and the answer changes completely. After
min-max normalization or standardization k-means finds the true groups. A new person is scaled with the *training* numbers.
One extreme value squeezes min-max more than it squeezes z-scores.

**Part 2, memorising (chapters 5 to 8).** 15 made-up training essays and 40 fresh test essays. A polynomial's degree sweeps
from underfitting to overfitting (training error only falls, test error is U-shaped). *Generalization* is the goal,
*regularization* is one tool: L2 (ridge) shrinks every coefficient and none reaches 0; L1 (lasso) sets many exactly to 0.
An optional two-coefficient picture shows why a diamond has corners and a circle has none. The last chapter shows that a
penalty depends on units unless the features are standardized first. The recap puts the vocabulary side by side.

All data is synthetic and the page says so. Nothing is real.

## Files

| file | what it is |
|---|---|
| `index.html` | the page: layout, styles, all prose (edit freely; numbers are `{{placeholders}}`) |
| `app.js` | the scroll engine, the nine chapters' figures, controls, tooltips |
| `sg-math.js` | pure maths (UMD: `window.SGM` in the browser, `module.exports` in node): seeded random numbers, the made-up people and essays, distance, min-max and z-score scalers (fitted on training rows, applied to any rows), k-means, polynomial features, least squares by Householder QR, ridge in closed form, lasso by feature-sign search |
| `sg-math.test.js` | unit tests, run with `node sg-math.test.js` |
| `../vendor/katex/` | local KaTeX, shared with the other pages (the page works offline) |

## Open it

Double-click `index.html`. No build step, no server, no internet needed.

## Tests

```bash
node sg-math.test.js
```

The tests assert the story, not just the code: the two groups do not overlap in height but overlap in weight; the
instructor's example (gaps 0.10 and 20, squared 0.01 and 400, weight 99.9975 % of the squared distance); raw k-means matches
the true groups only 52.5 % of the time and is exactly a split by weight; min-max and z-score both recover 100 %; height in
centimetres gives a different, correct answer and weight in grams breaks it again; a new person is judged with the training
mean and spread; one extreme value squeezes min-max more than z-scores; training error never rises with the degree while test
error has an interior minimum; ridge shrinks monotonically with no exact zeros; lasso satisfies its optimality (KKT)
conditions at every lambda, gets exact zeros that never come back as lambda grows, and has an interior best test error;
the same ridge penalty crushes a fraction-valued feature but not the same feature as a percent, and standardizing removes the
difference; in the two-coefficient toy L1 lands exactly on an axis and L2 never does.

## How the numbers get into the prose

Every number in a step card is a placeholder such as `{{rawAgree}}` or `{{bestDeg}}` that `app.js` fills from `sg-math.js`
when the page loads. Captions under the figures are built in `app.js` from the same module. If you change the data, the
text follows; nothing is typed in twice. The only literals in the prose are the instructor's own example numbers
(1.75 m, 85 kg and 1.65 m, 65 kg), which the tests also check.

## Design notes

- **Terminology.** *Feature scaling* is the umbrella; *normalization* means min-max (the page notes that the word also names
  other recipes, such as scaling a vector to length 1); *standardization* means the z-score. *Generalization* is the goal,
  *regularization* one method. People have a "body weight"; models have "coefficients" (weights), to keep the two apart.
- **Fair comparison.** Every k-means run starts from the same two people (`INIT` in `sg-math.js`), so only the scaling differs.
  The people are made up so that the story is unmistakable (see the tests), not so that any real group is described.
- **Scenes are pure functions** of (chapter step, scroll progress, user state). Scrolling backwards, fast scrolling and jumping
  with the dot navigation or `#ch5` in the address all just redraw. Sliders and toggles follow the page until you touch
  them; "Follow scroll" gives control back.
- **Colour and shape.** Blue and orange are the two clusters (or the training and fresh essays); circle or diamond is the true
  group (or the fresh essay), so colour is never the only cue. Purple is what you control or pick, teal the best, red a mistake.
- **Equal scales on purpose.** Chapters 2 and 4 draw height and weight on the same scale (1 unit across = 1 unit up), the
  picture k-means actually works with. The scatter in chapters 1 and 3 uses honest axes.
- **Lasso is solved exactly** (feature-sign search), not by plain coordinate descent: with the columns x, x², ... x¹² nearly
  collinear, coordinate descent crawls and returns wrong zeros at small penalties. The polynomial columns are powers of the
  centred sentence length, each standardized with the training essays' mean and spread.
- **Mobile.** A compact sticky figure of about 54 % of the viewport; a step activates once it is below it. SVG text is at
  least 9 px at 375 px wide; controls sit under the figure; `prefers-reduced-motion` shows every scene in its finished state.
- No links to notebooks; the footer says the data is invented and credits R2D3 for the inspiration.
