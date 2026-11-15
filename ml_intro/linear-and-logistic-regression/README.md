# From a Number to a Yes: linear and logistic regression, visualised

A scroll-driven visual introduction to linear and logistic regression for the course
*Introduction to ML for Language Technologies* (MA students with a background in translation studies).
It follows the same pattern as the sibling pages `../pmi/` and `../decision_trees/`: a figure pinned beside
(on phones: above) short text steps, grouped into chapters.

The story: 40 made-up essays, a line you draw yourself, how wrong a line is (mean squared error),
gradient descent and the learning rate, the finished line read in words, the pivot to a yes/no question,
the sigmoid and the decision boundary, log-loss and odds (optional), a spam filter with a threshold slider,
and a recap of the "two lenses" (number vs. probability).

All data is synthetic: 40 invented essays (average sentence length vs. a teacher's readability rating)
and 34 invented emails (how often the word "free" appears, spam or not). The page never calls them real.

## Files

| file | what it is |
|---|---|
| `index.html` | the page: layout, styles, all prose (edit freely; numbers are `{{placeholders}}`) |
| `app.js` | the scroll engine, the six chapters' figures, controls, tooltips |
| `lr-math.js` | pure maths (UMD: `window.LRM` in the browser, `module.exports` in node): the two frozen datasets, least squares, mean squared error, gradient descent paths, loss-map ellipses, logistic fit, log-loss, confusion counts |
| `lr-math.test.js` | unit tests, run with `node lr-math.test.js` |
| `../vendor/katex/` | local KaTeX, shared with the other pages (the page works offline) |
| `generate_data.py`, `data.js`, `data.json` | provenance only: how the datasets were generated (seeded numpy) and the numbers that run produced. The page does not load them; `lr-math.test.js` checks that the JavaScript recomputes the same numbers |
| `storyboard.md` | the chapter-by-chapter spec this build follows |

## Open it

Double-click `index.html`. No build step, no server, no internet needed.

## Tests

```bash
node lr-math.test.js
```

The tests assert, among others: the frozen arrays equal `data.js`; the best line (about 93.3 - 2.19 x, mean squared
error about 80.4); the three gradient-descent paths (crawl, calm, explode); the line fitted to 0/1 labels (1.07 at 6 words,
-0.23 at 28); the logistic fit (about 6.96 - 0.457 x, boundary about 15.2 words, 33 of 40 correct); the spam fit
(P at 3 occurrences about 0.54) and the monotone behaviour of the threshold slider.

## How the numbers get into the prose

Every number in a step card is a placeholder such as `{{mse}}` or `{{nCorrect}}` that `app.js` fills from `lr-math.js`
when the page loads (`{{t:...}}` gives a TeX-safe minus). Captions under the figures are built in `app.js` from the same
module. If you change the data or the fits, the text follows; nothing is typed in twice.

## Regenerate the data (optional)

```bash
uv run --no-project --with numpy python generate_data.py
```

This rewrites `data.js` and `data.json`. To change the page's data, paste the new `essays` and `spam` arrays into
`lr-math.js` (the tests will tell you if anything drifts).

## Design notes

- **One quantity everywhere.** "How wrong is a line" is always the *mean* squared error (the average squared miss),
  in the caption of the drawing step, the squares, the sweep, the descent and the learning-rate curves.
- **Scenes are pure functions** of (chapter step, scroll progress, user state). Scrolling backwards, fast scrolling and
  jumping with the dot navigation all just redraw. The user's line and the spam threshold live in one small state object.
- **Gradient descent runs on rescaled x** (as real tools do) and every step is converted back to the raw intercept and
  slope, so the path can be drawn on the raw loss map. The map's rings are exact: the loss is a quadratic, so its level
  sets are ellipses (`lossEllipse` in `lr-math.js`).
- **Controls**: the line has two drag handles (pointer events with capture, touch-friendly, also keyboard-operable) and two
  sliders; the spam threshold is a labelled range input ("flag more" on the left, "flag less" on the right).
- `prefers-reduced-motion` shows every scene in its finished state.
