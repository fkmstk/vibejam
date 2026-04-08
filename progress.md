Original prompt: PLEASE IMPLEMENT THIS PLAN: 月下ノ刃デモ改善プラン v1

- Started implementation with a visual-first pass that keeps the one-button counter concept intact.
- Extended duel state to carry UI emphasis, input hint, phase progress, and callout copy.
- Added viewport mode plumbing and an immediate initial render so the stage is visible from the first frame.
- Reworked the HUD/hero copy so the stage shows "Tap / Space" guidance and a snapshot-driven callout instead of stale fixed copy.
- Verified desktop and portrait-mobile screenshots for initial, strike, success, and fail states from a fresh dev server on port 4174.
- Note: the production build still emits the existing large-chunk warning; the experience bundle increased slightly but did not introduce new build failures.
