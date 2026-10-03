/*
 * HerCova — "The distance between her and care". THE timing config.
 *
 * Every second of the film lives here, read by index.html + film.js (picture) and by
 * scripts/build_audio.mjs (sound). Word-level times come from assets/audio/words.js
 * (ElevenLabs alignment), so the picture follows her voice exactly.
 *
 * SHOTS  (ground: light lilac; the product chapter on the brand purple)
 *  1 heartbeat   0.0 – 2.9    her heartbeat enters as one line, spikes on the first beat, then draws
 *                             her silhouette; the outline closes on her dot, on her heart
 *  2 her         2.6 – 6.4    her photograph fills the drawing from her heart; "Every 7 minutes," set
 *                             behind her; a 3D clock ring orbits her
 *  3 one of many 6.2 – 9.3    her photograph dissolves into particles that become Nigeria, dot by dot
 *  4 dive        9.2 – 10.0   the camera dives into her dot; the frame floods with the brand purple
 *  5 the line    10.0 – 11.9  the line of care arrives, circles her, and leads to her phone
 *  6 portal      11.7 – 16.6  her HerCova portal: check-in, guidance, a danger sign reported
 *  7 console     16.5 – 20.9  the care-team console: a red flag lands; a nurse claims it; referral
 *  8 home        20.9 – 25.6  help runs home along the line; light lilac floods back out of her;
 *                             she reaches care — mother and newborn, the film's first colour
 *  9 logo        25.5 – 33.0  the line becomes the logo; "Care that reaches her anywhere."; the address
 */
(function (g) {
  const T = {
    duration: 33.0,

    // Voiceover (ElevenLabs v3, voice: Lily). vo5 is trimmed after "anywhere." (its old CTA tail is cut);
    // vo6 is the gentle sign-off, with the address on screen.
    vo: [
      { id: 'vo1', at: 3.3, text: 'Every seven minutes, a woman in Nigeria dies in pregnancy or childbirth.' },
      { id: 'vo2', at: 10.55, text: 'HerCova walks with her. Watching, guiding, and catching the warning signs early.' },
      { id: 'vo3', at: 17.25, text: 'When a danger sign appears, her care team is alerted.' },
      { id: 'vo4', at: 22.2, text: 'And she reaches care, in time.' },
      { id: 'vo5', at: 26.3, text: 'Care that reaches her, anywhere.', trim: 2.35 },
      { id: 'vo6', at: 28.85, text: 'Learn more at HerCova Health dot com.' },
    ],

    heartbeat: { at: 0.35, beats: [0.121, 1.044, 1.837, 2.419, 3.333] }, // onsets detected in the file

    s1: { label: 1.0, iris: [2.62, 3.32] },
    s2: { popOut: 3.36, ring: [4.25, 6.12], dissolve: 6.24 },
    s3: { fly: [6.3, 8.4], outline: [7.3, 8.7], lost: 8.66, typeOut: 9.12 },
    s4: { dive: [9.2, 10.0] },
    s5: { handoff: 10.0, enter: [10.05, 11.05], toPhone: [11.05, 11.9] },
    s6: { phoneIn: 11.85, checkTap: 12.95, guide: 13.37, scroll: 14.62, yesTap: 15.36, danger: 15.72, surge: [16.05, 16.55] },
    s7: { toConsole: [16.45, 16.92], consoleIn: 17.0, cursorIn: 18.85, referral: 20.55 },
    s8: { overview: [21.15, 21.85], pulse: [21.35, 22.2], flyHome: [21.9, 22.62], bloom: [22.56, 23.34], close: [24.98, 25.56] },
    s9: { handoff: 25.56, swoosh: 25.7, lockup: [26.1, 26.85], letters: 26.25, domain: 28.8 },
  };

  g.HERCOVA_TIMING = T;
})(typeof window !== 'undefined' ? window : globalThis);
