---
title: AI Discovery Metadata
read_when:
  - "Changing site-wide SEO, robots, or llms output"
  - "Editing Astro head metadata"
tags:
  - seo
  - llms
  - robots
---

The site ships and validates four discovery layers:

- `astro.config.mjs` generates `llms.txt`, `/.well-known/llm.md`, per-route Markdown, `robots.txt`, and the XML sitemap.
- `src/lib/siteMeta.ts` is the source for keywords, AI hints, and organization schema details.
- `src/layouts/Layout.astro` renders canonical, description, Open Graph, Twitter, AI-hint metadata, and JSON-LD into every standard and rebuilt legacy route.
- `public/llms-full.txt` is the hand-authored longform summary for crawlers that want a compact site briefing.

Keep these in sync when the brand voice, primary sections, or contact details change.

`npm run build` runs `scripts/validate-built-site.mjs` after route parity checks. The validator confirms:

- every HTML document has one title, canonical URL, description, Open Graph title, and Twitter card;
- canonical URLs use the production origin;
- every JSON-LD block parses;
- `robots.txt`, `llms.txt`, `llms-full.txt`, `/.well-known/llm.md`, sitemap, and route Markdown exist;
- development-only Agentation code is absent from production HTML;
- the legacy double-slash lookbook regression route renders a main landmark and H1.
