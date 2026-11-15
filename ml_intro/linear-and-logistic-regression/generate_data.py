"""Frozen data + fits for the scrollytelling page 'From a Number to a Yes'.

Run:  uv run --no-project --with numpy python generate_data.py
Writes: data.json  (embedded verbatim into index.html as DATA)

Everything is seeded and reproducible. The page contains no live math beyond
plugging frozen parameters into formulas, so the visuals are stable forever.
"""
import json

import numpy as np

rng = np.random.default_rng(2026)
sig = lambda z: 1.0 / (1.0 + np.exp(-z))

# ---------------------------------------------------------------- Act 1: essays
N = 40
x = rng.uniform(6.0, 28.0, N)                    # avg sentence length (words)
y = 104.0 - 2.9 * x + rng.normal(0.0, 8.5, N)   # readability score 0-100
y = np.clip(y, 4.0, 100.0)
o = np.argsort(x)
x, y = x[o], y[o]

X = np.column_stack([np.ones(N), x])
b0_ols, b1_ols = map(float, np.linalg.lstsq(X, y, rcond=None)[0])


def mse(b0, b1, xs=None, ys=None):
    xs = x if xs is None else xs
    ys = y if ys is None else ys
    return float(np.mean((ys - (b0 + b1 * xs)) ** 2))


MSE_OLS = mse(b0_ols, b1_ols)
DEFAULT_LINE = [128.0, -3.6]     # the "reasonable but wrong" line (s03 fallback)
START = [125.0, -0.8]           # gradient-descent start: confidently wrong slope
START_LOSS = mse(*START)

# ------------------------- gradient descent on the MSE (standardized features)
# GD is run on z = (x - mean)/std (as sklearn does internally), but every step is
# recorded in RAW (b0, b1) space, so the path drawn on the raw loss map is a
# true descent path. This keeps the three learning-rate regimes clean:
#   small -> crawls, good -> calm descent, large -> overshoots and explodes.
XBAR, XSD = float(x.mean()), float(x.std())
z = (x - XBAR) / XSD


def gd(alpha, max_steps=60, stop_below=None, min_steps=10):
    a, b = START[0] + START[1] * XBAR, START[1] * XSD
    traj = []
    for i in range(max_steps):
        b0_raw = a - b * XBAR / XSD
        b1_raw = b / XSD
        traj.append([b0_raw, b1_raw, mse(b0_raw, b1_raw)])
        e = y - (a + b * z)
        a -= alpha * (-2.0 * np.mean(e))
        b -= alpha * (-2.0 * np.mean(z * e))
        if not (np.isfinite(a) and np.isfinite(b)) or abs(a) > 1e4 or abs(b) > 1e4:
            break
        if stop_below is not None and i >= min_steps and traj[-1][2] < stop_below:
            break
    return traj


def pad(t, n=60):
    return t + [t[-1]] * (n - len(t)) if len(t) < n else t[:n]


cands = sorted(set(
    [round(float(a), 4) for a in np.concatenate([np.linspace(0.002, 0.05, 25),
                                                 np.linspace(0.06, 0.49, 12),
                                                 np.linspace(1.1, 1.6, 11)])]
))
runs = {a: gd(a) for a in cands}

small = next((a for a in cands if 0.6 * START_LOSS < runs[a][-1][2] < 0.85 * START_LOSS), None)
large = next((a for a in cands if runs[a][-1][2] > 2.5 * START_LOSS), None)
good = None
for a in reversed(cands):          # largest alpha whose *arrival* takes 18-45 calm steps
    t = gd(a, stop_below=1.02 * MSE_OLS, min_steps=10)
    L = [s[2] for s in t]
    mono = all(L[i + 1] <= L[i] + 1e-9 for i in range(len(L) - 1))
    if 18 <= len(t) <= 45 and mono and L[-1] < 1.05 * MSE_OLS:
        good = a
        break
assert small and good and large, f"alpha buckets failed: {small}, {good}, {large}"

traj_small, traj_good, traj_large = pad(runs[small]), gd(good, stop_below=1.02 * MSE_OLS, min_steps=10), pad(runs[large])

r3 = lambda t: [[round(a, 4), round(b, 4), round(l, 1)] for a, b, l in t]

# loss-surface grid (for the s05 contour map)
B0_LO, B0_HI = min(START[0], b0_ols) - 10, max(START[0], b0_ols) + 10
B1_LO, B1_HI = min(START[1], b1_ols) - 2, max(START[1], b1_ols) + 2
gb0 = np.linspace(B0_LO, B0_HI, 33)
gb1 = np.linspace(B1_LO, B1_HI, 33)
LOSS = [[mse(a, b) for a in gb0] for b in gb1]

# ---------------------------------------------------------- Act 2: readability
labels_read = (y >= 60).astype(int)             # 1 = readable


def fit_logistic(xs, ls, iters=4000, lr=0.5):
    xm, xd = float(xs.mean()), float(xs.std())
    z = (np.asarray(xs, float) - xm) / xd
    ls = np.asarray(ls, float)
    a = b = 0.0
    for _ in range(iters):
        p = sig(a + b * z)
        g = p - ls
        a -= lr * float(g.mean())
        b -= lr * float((g * z).mean())
    B1 = b / xd
    B0 = a - B1 * xm
    return float(B0), float(B1)


lr_B0, lr_B1 = fit_logistic(x, labels_read)
pred_p = sig(lr_B0 + lr_B1 * x)
n_correct = int(((pred_p >= 0.5) == labels_read).sum())
boundary_x = -lr_B0 / lr_B1

# the "old machine" fitted to the 0/1 labels (scene s09)
b0_ll, b1_ll = map(float, np.linalg.lstsq(np.column_stack([np.ones(N), x]),
                                          labels_read.astype(float), rcond=None)[0])
ll_at = lambda xv: b0_ll + b1_ll * xv

# ------------------------------------------------------------- spam cameo (s12)
n_spam = 34
counts = np.minimum(rng.poisson(2.8, n_spam), 9).astype(int)
p_true = sig(-3.1 + 1.05 * counts)
spam_labels = (rng.random(n_spam) < p_true).astype(int)
sp_B0, sp_B1 = fit_logistic(counts, spam_labels)
spam_p_at = [round(float(sig(sp_B0 + sp_B1 * c)), 3) for c in range(10)]

data = {
    "essays": {"x": [round(v, 2) for v in x], "y": [round(v, 1) for v in y], "n": N},
    "ols": {"b0": round(b0_ols, 3), "b1": round(b1_ols, 3), "mse": round(MSE_OLS, 1)},
    "defaultLine": DEFAULT_LINE,
    "start": START,
    "startLoss": round(START_LOSS, 1),
    "gd": {
        "small": small, "good": good, "large": large,
        "trajSmall": r3(traj_small), "trajGood": r3(traj_good), "trajLarge": r3(traj_large),
    },
    "grid": {
        "b0": [round(v, 2) for v in gb0], "b1": [round(v, 2) for v in gb1],
        "loss": [[round(v, 1) for v in row] for row in LOSS],
    },
    "readability": {
        "labels": labels_read.tolist(),
        "b0": round(lr_B0, 3), "b1": round(lr_B1, 3),
        "nCorrect": n_correct, "n": N,
        "boundaryX": round(boundary_x, 1),
    },
    "linOnLabels": {"b0": round(b0_ll, 3), "b1": round(b1_ll, 3),
                    "yAt6": round(ll_at(6.0), 2), "yAt28": round(ll_at(28.0), 2)},
    "spam": {"counts": counts.tolist(), "labels": spam_labels.tolist(),
             "b0": round(sp_B0, 3), "b1": round(sp_B1, 3), "pAt": spam_p_at},
}

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, separators=(",", ":"))

with open("data.js", "w", encoding="utf-8") as f:
    f.write("const DATA = ")
    json.dump(data, f, separators=(",", ":"))
    f.write(";\n")

print("OLS fit:            y = %.2f %+.2f x   (MSE %.1f)" % (b0_ols, b1_ols, MSE_OLS))
print("GD alphas:          small=%.6g  good=%.6g  large=%.6g" % (small, good, large))
print("  small final loss: %.1f  (start %.1f)" % (traj_small[-1][2], START_LOSS))
print("  good  final loss: %.1f  (%d steps)" % (traj_good[-1][2], len(traj_good)))
print("  large final loss: %.1f" % traj_large[-1][2])
print("readable labels:    %d of %d" % (labels_read.sum(), N))
print("logistic fit:       P = sigma(%.3f %+.3f x)" % (lr_B0, lr_B1))
print("  boundary x:       %.1f   correct@0.5: %d/%d" % (boundary_x, n_correct, N))
print("line on labels:     y = %.2f %+.2f x   (at x=6: %.2f, at x=28: %.2f)" % (b0_ll, b1_ll, ll_at(6.0), ll_at(28.0)))
print("spam toy:           %d emails, %d spam" % (n_spam, spam_labels.sum()))
print("spam fit:           P = sigma(%.2f %+.2f count), pAt=%s" % (sp_B0, sp_B1, spam_p_at))
