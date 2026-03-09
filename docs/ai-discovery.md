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

The site now ships three AI-discovery layers:

- `astro.config.mjs` customizes generated `llms.txt`, `/.well-known/llm.md`, and `robots.txt`.
- `src/lib/siteMeta.ts` is the source for keywords, AI hints, and organization schema details.
- `public/llms-full.txt` is the hand-authored longform summary for crawlers that want a compact site briefing.

Keep these in sync when the brand voice, primary sections, or contact details change.
