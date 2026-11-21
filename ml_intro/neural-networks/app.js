/* Boot for "From a Yes to a Network". Runs after nn-math.js, kit.js and the chapter files (ch-*.js) have loaded and registered
   their chapters: fills the {{placeholders}} in the prose, typesets the formulas, wires the predict boxes, starts the scroll engine. */
(function () {
  'use strict';
  const K = window.NNKIT;
  if (!K) { console.error('kit.js did not load'); return; }
  K.fillPlaceholders();
  K.renderMath(document.body);
  K.bindPredict();
  K.start();
})();
