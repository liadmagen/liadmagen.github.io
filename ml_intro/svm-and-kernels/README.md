# The Widest Street: support vector machines and the kernel trick, visualised

A scroll-driven visual introduction to **support vector machines (SVMs)** and the **kernel trick** for the course
*Introduction to ML for Language Technologies* (MA students with a background in translation studies). It follows the
same pattern as the sibling pages `../scaling-and-generalization/`, `../linear-and-logistic-regression/`,
`../decision_trees/` and `../pmi/`: a figure pinned beside (on phones: above) short text steps, grouped into chapters.

The story, in nine chapters.

1. **Many lines.** Two made-up groups can be split by many straight lines. Five of them, all 100% right on the training
   dots; predict which does best on 200 fresh dots. The SVM's answer is the line with the widest empty street (the margin,
   width 2/‖w‖). Tilt a line yourself and watch the street width against the tilt.
2. **Support vectors.** Only the dots on the edge of the street matter. Remove the farthest dot: nothing changes. Slide a
   support vector: the street narrows and turns. Then drag, move (buttons or arrow keys), and remove dots yourself.
3. **Soft margin, C.** Overlapping groups; C is the price of a mistake. Smaller C: wider street, more support vectors, more
   tolerated mistakes. Link to the scaling and generalization page (smaller C is stronger regularization).
4. **No line fits.** A cluster inside a ring. The best straight SVM, and the best of all 360 directions, are barely
   better than guessing.
5. **Lift it.** The centrepiece: the ring data lifted into 3-D with z = x₁² + x₂². Scroll scrubs the lift and the camera
   tilt, a flat sheet appears, the circle where it cuts the bowl drops to the floor and, seen from above, separates the
   groups in 2-D. Afterwards drag to rotate (buttons and arrow keys as the keyboard alternative).
6. **The kernel trick.** An SVM only asks "how similar?". Colour maps of three similarity scores; a live numeric check that
   (x·y)² = φ(x)·φ(y) with φ(x) = (x₁², √2·x₁x₂, x₂²); the RBF kernel as a bump that fades with distance (γ).
7. **Kernels side by side.** Decision regions for linear, polynomial (degree 2 and 3) and RBF kernels on rings and on moons.
   RBF γ: small is too smooth, large makes islands around single dots; training against fresh accuracy.
8. **scikit-learn.** Five short snippets with copy buttons and their real outputs: fit and read `support_vectors_`;
   a scaling pipeline; `GridSearchCV` over C and γ; TF-IDF with `LinearSVC` for language identification (English, German,
   Spanish); the kernel trick by hand with `kernel="precomputed"`.
9. **Recap.** The four ideas, when SVMs shine and when not, rules of thumb.

All data is synthetic and the page says so. Nothing is real. No notebook links. Footer credit for the 3-D scene:
"Inspired by the classic 'polynomial kernel' 3-D animation of SVMs" (no names or URLs; the scene is drawn from scratch).

## Files

| file | what it is |
|---|---|
| `index.html` | the page: layout, styles, all prose (edit freely; numbers are `{{placeholders}}`) and the chapter 8 code snippets with their outputs |
| `app.js` | the scroll engine, the nine chapters' figures, controls, tooltips, the hand-rolled 3-D projection |
| `svm-math.js` | pure maths (UMD: `window.SVMM` in the browser, `module.exports` in node): seeded random numbers, the four made-up data sets (each with 200 fresh dots), kernels (linear, polynomial, RBF, `gamma="scale"`), an SMO solver in the style of libsvm, margins and lines, the 3-D lift |
| `svm-math.test.js` | unit tests, run with `node svm-math.test.js` |
| `../vendor/katex/` | local KaTeX, shared with the other pages (the page works offline) |

## Open it

Double-click `index.html`. No build step, no server, no internet needed.

## Tests

```bash
node svm-math.test.js
```

The tests assert the story, not just the code. Separable data: 100% on training and fresh dots; the margin equals 2/‖w‖ and
equals the widest street found by brute force over directions; support vectors sit exactly half a street from the line; every
non-support dot has weight exactly 0; the optimality (KKT) conditions hold for the hard margin, every C and several kernels.
Removing a non-support dot changes nothing (to 1e-6), removing or moving a support vector does. Five lines separate the
training dots but their streets are narrower and they do worse on fresh dots. Overlapping data: smaller C gives a wider street,
more support vectors and more tolerated mistakes, and C = 1 is within a point of the best fresh accuracy. Rings: a line is
near chance (the best of 360 directions and every threshold reaches 75%); z = x₁² + x₂² and a flat sheet z = c separate them,
and a linear SVM on the lifted points gets everything right. Kernel identity (x·y)² = φ(x)·φ(y) on 200 random pairs, and a kernel
SVM equals a linear SVM trained on the explicitly lifted points. Large γ memorises (training about 100%, fresh accuracy falls
by 20 points or more), tiny γ underfits. Results match scikit-learn 1.9.1 `SVC` on the same points (reference values recorded
from a real run: support vectors, coefficients, margins, accuracies). Finally a page/module consistency test: every
`{{placeholder}}` has a case in `app.js`, the only external links are the scikit-learn guide and the R2D3 credit, no notebooks,
KaTeX is local, the first snippet's points are exactly the page's dots.

## How the numbers get into the prose

Every number in a step card is a placeholder such as `{{sepMargin}}` or `{{gBigFresh}}` that `app.js` fills from `svm-math.js`
when the page loads. Captions under the figures are built in `app.js` from the same module. If you change the data, the text
follows; nothing is typed in twice. The only literals in the prose are C = 1 (the scikit-learn default) and the sample
sentences and outputs in the chapter 8 snippets, which are real program output (below).

## scikit-learn snippets: verified

Every snippet in chapter 8 was run with `uv run --no-project --with scikit-learn --with numpy python snippet.py`, using
**scikit-learn 1.9.1** (numpy 2.5.5), and the outputs on the page are the exact outputs of those runs. The page's own SMO solver
agrees with `SVC` on the page's points (same support vectors, same accuracies; margins within the solver tolerance of 1e-3).
Snippet 1 uses the page's own 20 dots: the support vectors scikit-learn prints (rows 19, 2 and 16) are the three ringed dots of
chapters 1 and 2. The other snippets use `make_circles` and `make_moons`, so their numbers are scikit-learn's, not the page's.
Other versions can differ in the last digits. Every sentence in the language-identification snippet was checked to be correct
in its language (English, German, Spanish).

## Design notes

- **Colour and shape.** Blue circles are group A, orange diamonds group B, so colour is never the only cue. Teal is the best
  (the widest street, the separating sheet), dark is the model's own line and support-vector rings, purple is what you control,
  red is a mistake, grey is a candidate. The street is a shaded band with dashed edges and a solid centre.
- **Equal scales.** Every 2-D figure draws one unit across as one unit up, so a street looks as wide as it is.
- **The 3-D scene** is an orthographic projection written by hand (yaw about the vertical axis, then an elevation tilt). Drawing
  order is exact, not approximate: with the camera above the floor, dots above the sheet are always in front of it and dots below
  are always behind, so the sheet is drawn between the two groups. At 90 degrees of elevation the scene is exactly the 2-D picture.
  Drag rotates with the mouse; on touch only horizontal drags rotate (vertical swipes keep scrolling the page), and the buttons and
  arrow keys always work. "Follow scroll" gives control back to the page.
- **Scenes are pure functions** of (chapter step, scroll progress, user state). Scrolling backwards, fast scrolling and jumping
  with the dot navigation or `#ch5` in the address all just redraw. Sliders and toggles follow the page until you touch them.
- **Code blocks** scroll inside their own box (never the page), are keyboard-focusable, and have a copy button (with a fallback
  where the clipboard API is unavailable, such as some `file://` setups).
- **Mobile.** A compact sticky figure of about 54 % of the viewport; a step activates once it is below it. SVG text is at least
  9 px at 375 px wide; controls sit under the figure; `prefers-reduced-motion` shows every scene in its finished state.
- **The solver.** An SMO in the style of libsvm (second-order working-set selection, tolerance 1e-3, the same dual problem as
  scikit-learn's `SVC`), deterministic. A hard margin is approximated by C = 1000.
