Original prompt: PLEASE IMPLEMENT THIS PLAN: 月下ノ刃デモ改善プラン v1

- Started implementation with a visual-first pass that keeps the one-button counter concept intact.
- Extended duel state to carry UI emphasis, input hint, phase progress, and callout copy.
- Added viewport mode plumbing and an immediate initial render so the stage is visible from the first frame.
- Reworked the HUD/hero copy so the stage shows "Tap / Space" guidance and a snapshot-driven callout instead of stale fixed copy.
- Verified desktop and portrait-mobile screenshots for initial, strike, success, and fail states from a fresh dev server on port 4174.
- Note: the production build still emits the existing large-chunk warning; the experience bundle increased slightly but did not introduce new build failures.
- Replaced the one-button duel flow with a realtime 3D arena combat controller that supports movement, enemy telegraphs, vulnerability windows, restart flow, and camera snapshots.
- Added deterministic hooks (`window.render_game_to_text`, `window.advanceTime`) plus keyboard, pointer, touch-stick, and fullscreen plumbing inside the experience layer.
- Rebuilt the scene into a 3/4-view arena with floor depth cues, telegraph markers, contact shadows, and 3D slash trails so depth is part of play, not just decoration.
- Implemented the contest-upgrade pass: 5-round run state, score/streak/miss tracking, clearer next-action HUD, mobile touch guide, Web Audio SFX, Vibe Jam widget/CSP updates, and WebGL failure fallback.
- Found and fixed a dash resolution bug during Playwright validation: dash attacks now lock their attack anchor/direction at telegraph start so sideways movement can actually create a punish window.
- Verification notes: `npm run build` passes with the existing >500 kB chunk warning; experience gzip is ~132.79 kB. Playwright success route reached round 2 with score 1,788, failure route reaches 3-miss game over, mobile portrait renders without console errors, and forced WebGL failure shows the fallback panel.
- Started the nonverbal UI pass: replaced visible copy-driven DOM with icon/numeric HUD surfaces, CSS-only status/action glyphs, a ghost-stick/tap/key onboarding overlay, and textless WebGL fallback controls while keeping snapshot copy for debug/accessibility labels.
- Verification notes for the nonverbal UI pass: `npm run build` passes with the existing >500 kB chunk warning; Playwright desktop/mobile screenshots show numeric HUD plus ghost controls; `#app.innerText` stays limited to `1/5`, `0`, `×1`, and `0/3` across title/combat/fallback; no console errors in the final combat-state check.
