# HerCova — brand film v3 ("In time")

**Format** 1920×1080 · 30 fps · ~48 s (flexible) · HyperFrames (HTML + GSAP + Three.js), deterministic seek
**Bar** Apple-standard 3D motion design. Every element earns its place; nothing decorative for its own sake.
**References** (in `assets/lottie/`): the SINT brand film (Vimeo 1060791132), `16-9.mp4` (fluted-glass gradient),
`List-16-9.json` (blurred word drum), `16-10.json` (frosted-glass testimonial), `Scene.json` (end sting).

## Look

- Backgrounds change with the scene: light lilac, deep lilac (sparingly), fluted-glass gradient, sharp full-bleed
  photography, the same photography blurred behind glass UI. Never one flat colour for the whole film.
- Materials: glossy purple, white porcelain, liquid glass; soft real shadows; HDRI-style studio reflections.
- Camera: one physical camera per 3D scene (spline keyframes, no speed kinks), true motion blur (sub-frame
  accumulation), depth of field, bloom on light, lens warp + vignette on crash zooms.
- Type: Open Sauce One, tight tracking. Orange `#ee7b1e` is only ever *her* (the pearl, her dot, the final period).
- Brand: purple `#7b2fa8`, lilac `#e6d8f4` / `#f3ebfa`, deep lilac `#3a2366`, white.

## Scenes

| # | Scene | Background | Effects used |
|---|---|---|---|
| 1 | **Pulse** — black, one orange pearl ignites and beats; a glass clock ring draws around it (trim path), a comet laps it. Small type: *Every 7 minutes,* | black → deep lilac | macro DOF, bloom, bounce (spring), trim path, echo text |
| 2 | **A woman** — crash zoom *through* the ring into a sharp full-bleed silhouette of a pregnant woman; *a woman in Nigeria dies in pregnancy or childbirth.* | full-bleed B&W photo | crash zoom, lens warp + vignette compensation, blur-in type |
| 3 | **One of many** — the photograph breaks into tiles that tumble into a 3D Nigeria; one pillar sinks; *About 200 women a day* counts up. Source line. | light lilac studio | shape morph, voxel shatter, spring landing, count-up, precise shadows |
| 4 | **HerCova** — crash zoom into her pin; out the other side the fluted-glass world; liquid text morph *HerCova → walks with her → Watching. → Guiding. → Early warning.* | fluted-glass gradient (16-9) | crash zoom, camera zoom + warp, liquid text morph, match cut |
| 5 | **What it does** — the word drum: *Danger-sign screening · Monitoring · Education & guidance · Healthcare alerts · Faster referral · Follow-up*; the active word lands with an elastic stretch | deep lilac | 3D drum + depth blur, elastic text, stagger |
| 6 | **The alert** — a 3D phone over her blurred home: a danger sign reported, a glass card lifts off the screen; whip pan to the care team's screen: *Her care team is alerted.* | blurred full-bleed photos | whip pan, liquid glass, match cut (the card), precise shadows |
| 7 | **A clinician** — the testimonial: sharp full-bleed portrait, frosted card, quote word-by-word | full-bleed photo | glass-morphism, blur-in words, camera ease-back |
| 8 | **In time** — *And she reaches care, in time.* over warm full-bleed mother & newborn; crash zoom out | warm full-bleed photo | crash zoom out, echo text |
| 9 | **End** — the Scene.json sting: pill → dot → *hercovahealth.com* with an orange period; logo | light → dark wipe | shape morph (pill → dot), wipes |

## Words (voice-over lines reused, placed per scene; music to be re-chosen)

Every seven minutes, a woman in Nigeria dies in pregnancy or childbirth. · HerCova walks with her. Watching,
guiding, and catching the warning signs early. · When a danger sign appears, her care team is alerted. · And she
reaches care, in time. · Care that reaches her, anywhere. · Learn more at HerCova Health dot com.

## Facts (only from `MamaALERT/apps/web/src/landing/content/stats.ts`, each shown with its source)

- One death every 7 minutes; about 200 women a day in Nigeria — *WHO and partners, 2025*.
- Feature names and the Detect → Respond → Refer → Follow up pathway come from the site's own content files.
- The testimonial needs a real clinician's words and consent; until then it carries clearly marked placeholder copy.
