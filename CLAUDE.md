# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Astro static site deployed to AWS (S3 + CloudFront + Route 53). Uses Caddy as a local reverse proxy in dev. Outputs to `dist/` for S3 upload.

## Commands

```bash
npm install                    # Install dependencies
npm run dev                    # Start Astro dev server + Caddy proxy together
npm run dev:astro              # Astro dev server only (no Caddy)
npm run build                  # astro build + qa:parity gate
npm run build:astro            # Astro build only (skip parity check)
npm run qa:parity              # Run parity gate + gallery orientation checks
npm run deploy:production      # Full deploy to S3 + CloudFront + URL verification
npm run deploy:s3              # S3 upload only
npm run verify:urls            # Verify post-deploy URLs respond correctly
npm run check:routes           # Verify route manifest is complete
```

### Capture asset management

```bash
npm run prepare:capture-assets   # Create/update symlink from capture/ into public/
npm run validate:capture-assets  # Validate mirrored coverage vs manifests
npm run validate:capture-assets -- --strict  # CI gate (fails on missing files)
```

## Architecture

`src/` structure:

- `pages/` — Astro page routes (file-based routing). Includes catch-all `[...slug].astro` for dynamic CMS routes.
- `components/` — Astro and React components (`AnnouncementBar`, `Header`, `Footer`, `PostCard`, `ImageBlock`, `LinkBlock`, etc.)
- `content/` — CMS content collections (Astro content layer)
- `data/` — structured data files consumed by pages
- `layouts/` — page layout wrappers
- `lib/` — shared TypeScript utilities
- `styles/` — global CSS
- `templates/` — reusable content templates

`capture/` holds mirrored external assets and manifests. A symlink mounts `capture/assets/downloads` into `public/assets/downloads` so Astro serves them statically.

The build runs `astro build` then a `qa:parity` gate that checks manifest parity and gallery orientation integrity before the build succeeds.

Deployment (`scripts/deploy-and-verify.sh`) uploads to S3, invalidates CloudFront, and runs URL verification.
