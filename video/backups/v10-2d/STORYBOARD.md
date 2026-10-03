# HerCova — "Reaching her in time" · 15s brand film

**Format** 1920×1080 · 30 fps · 450 frames · H.264 (+ reflowed 1080×1920 cut)
**Framework** HyperFrames (HTML + GSAP, deterministic seek)
**One story:** a mother who could be anywhere, and help that reaches her in time.
**Tone:** warm, human, hopeful, premium. Never scary, never clinical. No feature list, no phone calls.

## Brand (from the MamaALERT / HerCova website codebase)

| Token | Value | Use in film |
|---|---|---|
| purple-800 | `#3d1152` | deepest ground, headings |
| purple-700 | `#52276e` | secondary ground |
| purple-600 | `#7b2fa8` | the logo arc, the line of care |
| purple-200 | `#e4d4f0` | soft rules, muted text on dark |
| purple-50  | `#f4edf9` | light ground, end card |
| orange-500 | `#ee7b1e` | THE accent: the logo figure, one CTA, the line's leading light |
| ash        | `#f1f1f3` | neutral ground |
| font       | Open Sauce One (editorial), fallback Inter | all type |

Devices borrowed from the site: the corner-anchored purple light over photographs (Continuity section),
the tick-arc gauge (Why HerCova · 70% card), glass node chips + travelling light on paths (ReachGraph),
the soft white notification card "Danger sign · Her care team is alerted" (AlertStream),
the orange pill CTA with a purple-800 label.

## Voiceover (warm female, ~35 words)

> Every seven minutes, a woman in Nigeria dies in pregnancy or childbirth.
> HerCova stays beside her, and when a danger sign appears, her care team is alerted.
> Care that reaches her anywhere. Enroll at hercovahealth.com.

## Beats

| # | Time | Picture | On-screen text | Sound |
|---|---|---|---|---|
| 1 | 0–3s **The stakes** | Deep plum. A ring of 60 ticks (the site's gauge) sweeps like a clock face while the B&W expectant mother fades in behind, slow push-in. | **Every 7 minutes** / a woman in Nigeria dies in pregnancy or childbirth. · tiny source: *WHO and partners, 2025* | soft whoosh on text, gentle tick as the ring completes; music enters low |
| 2 | 3–9s **The bridge** | Dissolve to the mother in golden light, far horizon behind her (she could be anywhere). One luminous purple→orange line draws in from the far edge and flows toward her, passing four glass nodes that light as it passes: monitoring (pulse), education (book), early warning (bell), care support (stethoscope). Icons only, no labels. Slow parallax. | *(one line)* **HerCova stays beside her.** | soft swell rising as the line connects to her |
| 3 | 9–12s **She reaches care** | The line's end blooms into the site's notification card: *Her care team is alerted*. Card lifts away; dissolve to the golden-light mother and newborn, warm and close. | card copy only | reassuring chime on the card |
| 4 | 12–15s **The promise** | Light lilac → plum end card. Logo mark draws (arc, then figure), wordmark rises, tagline, orange pill CTA. Disclaimer small at the foot. | **HerCova** · *Care that reaches her anywhere.* · [Enroll at hercovahealth.com] · *HerCova does not diagnose. In an emergency, call 112.* | light sparkle on the logo; music resolves, fade out |

Captions: word-synced, bottom-centre, max ~6 words per line, hidden during the end card (where the same words are on screen).

## Facts check (only these are allowed)

- "one woman in Nigeria dies in pregnancy or childbirth every 7 minutes (WHO and partners, 2025)". Matches `apps/web/src/landing/content/stats.ts` `NIGERIA_DAILY`.
- Tagline "Care that reaches her anywhere." Matches `ABOUT_HERCOVA.heading` on the site.
- CTA "Enroll at hercovahealth.com"; disclaimer "HerCova does not diagnose. In an emergency, call 112."
- No other numbers, no product names, no efficacy claims.

## Motion rules

- All timing lives in one config (`TIMING` in `index.html`), in seconds, derived from the VO word timestamps.
- Springs / expo-out eases for entrances; stagger 60–90 ms; nothing hard-cuts (cross-dissolves ≥ 0.5s).
- Subtle animated film grain over everything, soft diffuse shadows tinted plum (the site's LIFT recipe).
- Photos: slow Ken Burns push (1.00 → 1.06), and the foreground moves faster than the background for parallax.
- The line of care is one SVG path drawn with stroke-dashoffset, with an orange travelling highlight.
