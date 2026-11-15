# From a Number to a Yes — storyboard

An R2D3-style scrollytelling page: a **sticky D3 visualization** beside **scrolling text steps**.
Scroll position *scrubs* every animation (forward *and* backward). Two steps are interactive.

- **Files:** `index.html` (self-contained), `d3.min.js` (vendored, offline-friendly), `generate_data.py` + `data.json` (frozen data & fits — the numbers in the page are real fits, not hand-waved).
- **Narrative:** mirrors session 06 (MLT25 slides + the spam notebook). Act 1 = linear regression on essay scores. Act 2 = the pivot to "readable or not?" (slide 26). Spam "free"-count cameo = notebook Part 2.
- **Prose lives in the HTML steps** — edit text directly there. Dynamic numbers (fits, error counts) are computed from `DATA` and injected into chips, so text stays true if data is regenerated.
- **Accessibility:** `prefers-reduced-motion` → scenes snap instead of scrubbing; all narrative is real HTML; slider is a real `<input>`.

## Engine (in `index.html`)

- Steps carry `data-scene="s01"…"s13"`. A rAF loop finds the step containing the viewport middle → active scene + progress `p ∈ [0,1]`.
- Every scene is an **idempotent `render(p)`** — it sets the full state of the figure from scratch each frame. That's what makes scrolling backward work for free.
- `body[data-scene]` + CSS gates interactivity (drag handles in s02, slider in s12).
- Chips (HTML overlays on the figure) show live numbers: squared error, loss, ŷ, counts.

## Scenes

| # | id | Beat | Visual (scrubbed by scroll) | Data / fit |
|---|----|------|------------------------------|------------|
| 1 | `s01` | Meet the data: 40 essays, one hunch (longer sentences → lower score) | Axes draw; dots pop in one by one | `essays` (x = avg sentence length, y = readability 0–100) |
| 2 | `s02` | **Predict, then draw your own line** (interactive) | Two drag handles; chip shows your total squared error live | user line → `state.yl` |
| 3 | `s03` | How wrong is a line? residual → **literal squares** | Residual segments drop, then squares grow, staggered; chip sums the total | residuals of your line (or default gray line if untouched) |
| 4 | `s04` | Every line has one number; we want the smallest | Sweep candidate lines, chip counts each error; ends on "somewhere is the best line" | candidate lines around the OLS fit |
| 5 | `s05` | Hot & cold: **gradient descent**; the model feels the slope under its feet | Data fades (the model is "blind"); line updates step-by-step; right panel = loss landscape with ball rolling to the valley | `gd.trajGood` (real GD on MSE), loss grid |
| 6 | `s06` | Step size = **learning rate**: too small crawls, too large explodes, just right settles | Loss-vs-step curves, three regimes in sequence | `gd.trajSmall/Large/Good` |
| 7 | `s07` | The machine assembled: `ŷ = β₀ + β₁x` → a NUMBER | Final line; new essay (12-word sentences) slides in; line outputs ŷ | OLS fit |
| 8 | `s08` | **The pivot:** we don't want a score, we want yes/no | y-axis melts; dots collapse into two colored strips (readable / not readable) | `readability.labels` (score ≥ 60) |
| 9 | `s09` | The number machine fails | Line fitted to the 0/1 labels predicts 1.2 and −0.1 — outside the probability zone (drawn as a shaded band) | `linOnLabels` fit |
| 10 | `s10` | **Squish the line** through the S-curve: σ(z) = 1/(1+e⁻ᶻ) | The straight line bends into the fitted sigmoid; outputs land in [0,1] | logistic fit (readability) |
| 11 | `s11` | From probability to **decision**: 0.5 threshold, decision boundary, errors circled | Curve + dashed 0.5 line + vertical boundary; dots colored by prediction; misclassified ringed & ✕; chip "n/40 correct" | logistic fit + `nCorrect` |
| 12 | `s12` | Same machine, new problem: spam — **slide the threshold** (interactive) | Essay dots swap to emails (x = times "free" appears); fitted curve; slider 0.1–0.9 re-colors and updates chips (caught / missed / false alarms) | `spam` toy fit (≈ boundary at "free" ×3–4) |
| 13 | `s13` | Same machine, two lenses: number vs. probability; softmax + NN teaser | Split panels: line → number, sigmoid → probability; equation chips | OLS + logistic fits |

## Notes

- Prose numbers ("≈ 104 − 2.9 × sentence length", "37/40") come from `data.json` — regenerate via `generate_data.py` (seeded, reproducible) and re-paste `DATA` in `index.html` if needed.
- The threshold-slider scene deliberately mirrors the notebook's *Modify* task (0.5 → 0.8, "what would your email provider do?").
- Credits in footer: R2D3 inspiration, the spam notebook on GitHub, Jurafsky & Martin ch. 5.
