# From a Number to a Yes — linear & logistic regression, visualised

An R2D3-style scrollytelling page for the MLT *Modeling* session on linear & logistic
regression. A sticky D3 figure reacts to your scroll; two steps are interactive
(drag-your-own-line, spam threshold slider).

## Files

| file | what it is |
|---|---|
| `index.html` | the page — layout, scene engine, all 13 scenes (prose included, edit freely) |
| `d3.min.js` | D3 v7, vendored locally so the page works offline (no CDN needed) |
| `data.js` | the frozen dataset + all fitted numbers, loaded by the page (`const DATA = …`) |
| `generate_data.py` | regenerates `data.json` + `data.js` (seeded — same numbers every run) |
| `storyboard.md` | the scene-by-scene spec this build follows |

## Open it

Double-click `index.html` — that's it. No build step, no server, no internet needed.

## Host it (optional)

Any static host. GitHub Pages: push this folder to the `Modeling_course` repo and enable
Pages, or drop it into any `docs/` folder.

## Regenerate the data

```bash
uv run --no-project --with numpy python generate_data.py
```

If the numbers change (new seed), re-check the handful of prose spots that quote real
values: the fitted line in scene 7's card (`ŷ = 93.3 − 2.19·x`), scene 11's
"33 of 40", scene 9's "1.07 / −0.23", scene 12's "three times 'free'" claim.

## Design notes

- **Scenes are idempotent `render(p)` functions** — the scroll engine calls the active
  scene with progress `0…1` every frame, so scrolling backward re-renders earlier states
  for free. New scenes = new `data-scene` section + a `scenes.sXX` function.
- **Interactivity is CSS-gated** by `body[data-scene]` (drag handles in s02, slider in s12).
- `prefers-reduced-motion` snaps scenes to their end state instead of scrubbing.
- `window.__renderScene(id, p)` is a debug hook for testing individual scenes from the console.
