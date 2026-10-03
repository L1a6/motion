/*
 * HerCova — "Care that reaches her". One clock for the whole film.
 * No score for now (picture + sound design only), but the cuts keep the 90 BPM grid they were built on: a beat
 * is 0.6667 s, a bar 2.6667 s. After the opening, every section sits SH seconds later than its bar line.
 */
(function (g) {
  const BEAT = 60 / 90;
  const BAR = BEAT * 4;
  const SH = 7.9; // the opening (0 → 10.6) pushed the rest of the film back by this much
  const bar = (n) => +(0.625 + BAR * n + SH).toFixed(3);
  const beat = (n) => +(0.625 + BEAT * n + SH).toFixed(3);
  const X = BEAT * 2; // the glass holds two beats longer for the voice; everything after it moves with it
  const after = (v) => +(v + X).toFixed(3);
  g.HC_T = {
    BEAT, BAR, bar, beat, SH,
    duration: after(64.5),
    S: {
      open: [0, 10.6], //                          the hook: the lilac rebuild of animation.mp4's first ten seconds
      phone: { span: [10.6, bar(3)], in: 2.95 + SH, island: bar(2), dive: 7.25 + SH }, // the 3D phone, the dive
      ui: [bar(3), bar(5)], //       16.525  her app, floating in the light
      flute: [bar(5), after(bar(5) + 4.713)], // 21.858  the fluted glass: the problem (every 7 minutes…)
      type: [after(bar(5) + 4.713), after(bar(9) - 0.72)], // 27.904  kinetic type: the promise (…early.) → the dot
      dash: [after(bar(9) - 0.72), after(bar(11) - 0.62)], // 33.238 → 38.571  the care-team dashboard on deep lilac
      mark: { whip: after(bar(11) - 0.62) }, //                            the vertical whip into the drum
      drum: [after(bar(11)), after(bar(14))], //   39.191  what HerCova does: the word drum, elastic text
      testi: [after(bar(14)), after(bar(16) + 2.0)], // 47.191  a clinician: the liquid-glass testimonial (16-10)
      close: [after(bar(16) + 2.0), after(bar(19))], // 54.525  care that reaches her, anywhere → the dot
      end: [after(bar(19)), after(64.5)], //       60.525  the Scene sting: pill → dot → hercovahealth.com
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
