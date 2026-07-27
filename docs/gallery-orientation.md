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

Rebuilt legacy galleries use a more immersive editorial layout:

- consecutive portrait images form a two-column row;
- landscape, square, unknown, and unpaired portrait images span the full gallery width;
- the gallery expands beyond the text measure up to `1440px`;
- gutters remain between `10px` and `18px`, including on mobile.

To enforce the rule, the build runs `npm run check:gallery-orientations`. The script under `scripts/check-gallery-orientations.mjs` checks both captured Squarespace galleries and rebuilt legacy gallery frames. It fails the build if adjacent half-spans have different orientations.

When working with legacy content, keep width and height metadata intact. `LegacyHtmlPage.astro` uses those dimensions to assign orientation and span classes before render.
