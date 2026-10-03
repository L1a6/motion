/*
 * HerCova — "In time". The film's clock. One paused GSAP timeline carries one tween whose onUpdate renders the
 * frame: the 3D cut (film/gl/main.js, a module that registers window.__gl when its assets are in) and the DOM
 * captions. Every time comes from film/timing.js.
 */
window.__buildHercova = function () {
  'use strict';
  const T = window.HC_T;
  const tl = gsap.timeline({ paused: true });

  function renderAll(t) {
    if (window.__gl) window.__gl.render(t);
  }
  const clock = { t: 0 };
  tl.fromTo(clock, { t: 0 }, { t: T.duration, duration: T.duration, ease: 'none', onUpdate: () => renderAll(clock.t) }, 0);
  window.__hcRenderNow = () => renderAll(clock.t);
  return tl;
};
