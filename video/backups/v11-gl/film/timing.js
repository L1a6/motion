/*
 * HerCova — "In time". THE timing config: every second of the film lives here, read by film/core.js (type,
 * DOM, audio placement) and film/gl/*.js (the 3D shots). Word times come from assets/audio/words.js.
 *
 *  1 pulse   0.0 – 3.9   black; her orange pearl ignites on her heartbeat; a glass clock ring draws round it
 *  2 woman   3.4 – 13.0  crash zoom through the ring into her silhouette; she breaks into tiles that land as
 *                        a 3D Nigeria; about 200 women a day
 *  3 glass   12.6 – 19.7 crash zoom into her pin; the fluted-glass world; the camera flies through the words
 *  4 drum    19.5 – 25.2 what HerCova does, on a 3D word drum
 *  5 alert   25.0 – 31.2 her phone: a danger sign; whip pan to her care team's screen
 *  6 doctor  31.0 – 36.7 a clinician's words on frosted glass
 *  7 time    36.5 – 41.2 and she reaches care, in time
 *  8 end     41.0 – 48.0 hercovahealth.com; the mark
 */
(function (g) {
  const T = {
    duration: 48,
    vo: [
      { id: 'vo1', at: 1.9, text: 'Every seven minutes, a woman in Nigeria dies in pregnancy or childbirth.' },
      { id: 'vo2', at: 13.2, text: 'HerCova walks with her. Watching, guiding, and catching the warning signs early.' },
      { id: 'vo3', at: 27.4, text: 'When a danger sign appears, her care team is alerted.' },
      { id: 'vo4', at: 37.0, text: 'And she reaches care, in time.' },
      { id: 'vo5', at: 41.4, text: 'Care that reaches her, anywhere.', trim: 2.35 },
      { id: 'vo6', at: 44.2, text: 'Learn more at HerCova Health dot com.' },
    ],
    heartbeat: { at: 0.2, beats: [0.121, 1.044, 1.837, 2.419, 3.333] }, // onsets inside sfx-heartbeat.wav
    shots: {
      pulse: [0, 3.9],
      woman: [3.4, 13.0],
      glass: [12.6, 19.7],
      drum: [19.5, 25.2],
      phone: [25.0, 27.35],
      console: [27.0, 31.2],
      doctor: [31.0, 36.7],
      time: [36.5, 41.2],
      end: [41.0, 48.0],
    },
    // pulse
    ignite: 0.3,
    ring: [0.95, 2.1],
    // woman
    through: [3.4, 3.9],   // crash zoom through the ring
    shatter: 7.7,          // the photograph breaks into tiles
    land: [8.0, 10.1],     // tiles fly into Nigeria
    tilt: [9.2, 10.6],
    count: [10.3, 11.5],   // about 200 women a day
    lost: 11.6,
    dive: [12.6, 13.1],    // crash zoom into her pin
    // sound: [time, file (assets/audio/mix/sfx-*.wav), volume, what it marks] — placed by scripts/place_audio.mjs
    sfx: [
      [0.2, 'heartbeat', 0.5, 'her heartbeat'], [0.3, 'ignite', 0.35, 'her pearl ignites'], [0.95, 'swish', 0.25, 'the clock ring draws'],
      [1.35, 'tickrun', 0.18, 'the ticks spring in'], [2.05, 'shimmer', 0.2, 'the comet'], [3.38, 'whoosh', 0.55, 'crash zoom through the ring'],
      [3.45, 'dive', 0.35, 'into her pearl'], [3.9, 'lowhit', 0.35, 'her silhouette'],
      [7.62, 'dissolve', 0.5, 'she breaks into tiles'], [8.0, 'swell', 0.3, 'the tiles fly'], [9.3, 'bloom', 0.32, 'Nigeria lands'],
      [10.3, 'tickrun', 0.28, 'about 200'], [11.6, 'lowhit', 0.45, 'one pillar sinks'], [11.62, 'ripple', 0.3, 'its ring spreads'],
      [12.62, 'whoosh', 0.5, 'crash zoom into her pin'], [12.7, 'dive', 0.4, 'into her pin'],
      [13.1, 'bloom', 0.28, 'the fluted glass'], [13.1, 'typehit', 0.3, 'HerCova'], [13.45, 'swish', 0.28, 'through the word'],
      [13.8, 'typehit', 0.26, 'walks with her'], [14.81, 'swish', 0.28, 'through the word'], [15.16, 'typehit', 0.3, 'Watching'],
      [15.57, 'swish', 0.28, 'through the word'], [15.92, 'typehit', 0.3, 'Guiding'], [16.88, 'swish', 0.28, 'through the word'],
      [17.23, 'typehit', 0.3, 'Catching warning signs early'], [19.43, 'whip', 0.55, 'whip to the drum'],
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [19.95 + k * 0.62, 'tick', 0.22, 'the drum steps']),
      [24.95, 'whoosh', 0.45, 'crash zoom to her phone'], [25.55, 'click', 0.5, 'she taps'], [25.9, 'alert', 0.32, 'a danger sign'],
      [26.45, 'uipop', 0.4, 'the card lifts off'], [27.0, 'whip', 0.6, 'whip to her care team'], [27.64, 'notify', 0.45, 'the flag lands'],
      [30.25, 'click', 0.5, 'claimed'], [30.3, 'uipop', 0.32, 'claimed'], [31.0, 'whoosh', 0.45, 'crash zoom to the clinician'],
      [31.3, 'swish', 0.3, 'the glass card settles'], [34.05, 'pop', 0.3, 'the heart'], [36.5, 'whip', 0.55, 'whip to her'],
      [36.55, 'whoosh', 0.45, 'crash zoom out'], [39.1, 'typehit', 0.45, 'in time'], [39.52, 'pop', 0.35, 'her pearl drops'],
      [41.0, 'whoosh', 0.42, 'into the mark'], [41.1, 'logo', 0.42, 'the mark rises'], [41.75, 'sparkle', 0.3, 'her figure'],
      [43.8, 'swish', 0.5, 'dark wipe'], [44.1, 'swish', 0.4, 'light wipe'], [44.3, 'zip', 0.3, 'the pill slides in'],
      [45.1, 'shimmer', 0.35, 'the dot writes the address'], [46.16, 'pop', 0.45, 'the full stop'], [46.5, 'softclick', 0.35, 'com'],
      [47.55, 'whoosh', 0.42, 'last wipe'],
    ],
  };
  g.HC_T = T;
})(typeof window !== 'undefined' ? window : globalThis);
