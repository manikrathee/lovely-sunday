# Lovely Sunday brand research

Non-production brand strategy and creative exploration files.

- `lovely-sunday-brand-identity.html` — standalone report
- `lovely-sunday-brand-identity.json` — editable report source
- `previews/` — desktop and mobile report verification captures

This directory intentionally sits outside `src/` and `public/`. Astro does not
copy or build it into the production site.

To regenerate the report with the `build-startup-brand` skill:

```bash
node ~/.agents/skills/build-startup-brand/scripts/generate_report.mjs \
  brand-research/lovely-sunday-brand-identity.json \
  brand-research/lovely-sunday-brand-identity.html
```
