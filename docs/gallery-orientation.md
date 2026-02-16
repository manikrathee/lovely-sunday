---
title: Gallery Orientation Policy
read_when:
  - "Adding or editing lookbook posts"
  - "Fixing gallery layout imbalance"
tags:
  - gallery
  - qa
---

Gallery posts on Lovely Sunday pair photos only when they share the same orientation. When two slides appear side by side in a 50/50 row, both images must either be landscape or portrait; mixed pairs get promoted to full-width so the layout stays balanced.

To enforce the rule, the build now runs `npm run check:gallery-orientations`. The script under `scripts/check-gallery-orientations.mjs` mirrors the browser pairing logic and fails the build if it finds adjacent half-spans with different `data-image-dimensions`.

When working with legacy Squarespace content, keep the `data-image-dimensions` attributes intact so the orientation helper can work, and rely on the inline script in `LegacyHtmlPage.astro` to mark up balanced pairs automatically.
