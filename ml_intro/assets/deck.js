/* ============================================================
   deck.js — slide navigation + step engine + glow sync
   ============================================================ */
window.HOOKS = {};          // animation hooks, defined in anims.js
window.addSlides = function (html) {
  document.getElementById('deck').insertAdjacentHTML('beforeend', html);
};

let slides = [], cur = -1, step = 0, timer = null;

function collect() {
  slides = Array.from(document.querySelectorAll('.slide'));
  slides.forEach((s, i) => {
    s._idx = i;
    s._steps = Array.from(s.querySelectorAll('.step'));
    s._steps.forEach((e, k) => { e._i = e.hasAttribute('data-at') ? +e.getAttribute('data-at') : k + 1; });
    s._max = s._steps.reduce((m, e) => Math.max(m, e._i), 0);
    const n = s.querySelector('.num');
    if (n) n.textContent = (i + 1);
  });
}

function setStep(n) {
  const s = slides[cur];
  step = Math.max(0, Math.min(n, s._max));
  s._steps.forEach(e => e.classList.toggle('on', e._i <= step));
  // glow sync: any visible step with data-glow lights the matching [data-cell] elements
  s.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
  s.querySelectorAll('.step.on[data-glow]').forEach(e => {
    e.getAttribute('data-glow').split(/\s+/).forEach(c => {
      const t = s.querySelector('[data-cell="' + c + '"]');
      if (t) t.classList.add('glow');
    });
  });
  const h = s.getAttribute('data-hook');
  if (h && window.HOOKS[h]) window.HOOKS[h](step, s._max, s);
  updateHud();
}

function go(i, fromPrev) {
  if (i < 0 || i >= slides.length) return;
  clearInterval(timer); timer = null;
  cur = i;
  slides.forEach((s, k) => s.classList.toggle('active', k === cur));
  setStep(fromPrev ? slides[cur]._max : 0);
  const s = slides[cur];
  if (s.hasAttribute('data-autoplay')) {
    const ms = parseInt(s.getAttribute('data-autoplay'), 10) || 1400;
    timer = setInterval(() => {
      if (step < s._max) setStep(step + 1); else { clearInterval(timer); timer = null; }
    }, ms);
  }
  const p = document.getElementById('progressFill');
  if (p) p.style.width = (((cur + 1) / slides.length) * 100) + '%';
}

function next() {
  clearInterval(timer); timer = null;
  if (step < slides[cur]._max) setStep(step + 1); else go(cur + 1);
}
function prev() {
  clearInterval(timer); timer = null;
  if (step > 0) setStep(step - 1); else go(cur - 1, true);
}

function updateHud() {
  const c = document.getElementById('counter');
  if (c) c.textContent = (cur + 1) + ' / ' + slides.length;
}

function fit() {
  const st = document.getElementById('stage');
  const sc = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  st.style.transform = 'scale(' + sc + ')';
}

window.initDeck = function () {
  collect();
  fit();
  window.addEventListener('resize', fit);

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { go(0); }
    else if (e.key === 'End') { go(slides.length - 1, true); }
  });

  document.addEventListener('click', e => {
    // flip cards
    const card = e.target.closest('.flip3');
    if (card) { card.classList.toggle('flipped'); return; }
    // agenda anchors
    const a = e.target.closest('a[href^="#s"]');
    if (a) {
      const id = a.getAttribute('href').slice(1);
      const idx = slides.findIndex(s => s.id === id);
      if (idx >= 0) { e.preventDefault(); go(idx); }
      return;
    }
    // don't advance when interacting with controls
    if (e.target.closest('input, button, .keep, select, textarea')) return;
    next();
  });

  go(0);
};
