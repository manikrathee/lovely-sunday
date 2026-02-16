# LovelySunday Astro Rebuild Plan (Final)

## 1) Scope + Fidelity Rules
- Use captured source of truth only; do not add Astro-only features not present on source site.
- Canonical route inventory:
  - `/Users/manikrathee/Developer/lovely-sunday/capture/lovelysunday-run4/manifests/all_urls.txt`
  - 55 URLs total (47 sitemap + nav-only + nav double-slash variants).
- Verified parity:
  - `/Users/manikrathee/Developer/lovely-sunday/capture/lovelysunday-run4/manifests/verification_report.json`
  - 55/55 checks match on title/canonical/H1/image-count.

## 2) Content Ingestion
- Parse from:
  - `/Users/manikrathee/Developer/lovely-sunday/capture/lovelysunday-run4/page_json`
  - `/Users/manikrathee/Developer/lovely-sunday/capture/lovelysunday-run4/raw_html`
- Build Astro content collections with:
  - `slug`, `sourceUrl`, `title`, `canonical`, `meta`, `headings`, `mainText`
  - `paragraphs`, `links`, `images`, `stylesheets`, `scripts`, `jsonLd`.

## 3) Route Build
- Preserve exact route behavior, including legacy oddities:
  - Keep valid double-slash nav targets (`/lookbook//looks/...`) available.
  - Keep single-slash lookbook variants as captured (they render source 404 page state).
- Internal rewrite map for known nav correction cases:
  - `/Users/manikrathee/Developer/lovely-sunday/capture/lovelysunday-run4/manifests/internal_url_rewrite_map.json`

## 4) Assets
- Use downloaded mirror:
  - `/Users/manikrathee/Developer/lovely-sunday/capture/lovelysunday-run4/assets/downloads`
- Manifest:
  - `/Users/manikrathee/Developer/lovely-sunday/capture/lovelysunday-run4/manifests/assets_manifest.json`
- Status:
  - 724 queued, 724 downloaded, 0 failed.
- Do not mirror outbound shopping/social links as local files.

## 5) Templates + Layout
- Build reusable Astro components:
  - `SiteHeader`, `SiteFooter`, `PostLayout`, `ImageBlock`, `LinkBlock`.
- Recreate typography/spacing/image rhythm using desktop + mobile screenshots as visual baseline.

## 6) SEO + Metadata
- Carry through exactly:
  - title tags, canonical URLs, OG/Twitter tags, JSON-LD blocks.
- Inject per-route head metadata from page JSON.

## 7) QA Gate for Astro
- Per route compare:
  - title/canonical/H1/image-count
  - screenshot-level visual checks (desktop + mobile).
- Block deploy if route output diverges from capture manifest.

## 8) S3 Deployment
- Build static site (`dist/`), upload to new LovelySunday S3 bucket.
- Use immutable cache headers for hashed assets.
- Validate post-deploy URLs against `all_urls.txt`.

## 9) Prior Failed URL Recheck Outcome
- Source failed set: 140 URLs from older run.
- Recheck report:
  - `/Users/manikrathee/Developer/lovely-sunday/capture/lovelysunday-run4/manifests/failed_url_recheck_report.json`
- Result:
  - 5 internal lookbook URLs fixed via rewrite map.
  - 104 runtime telemetry/API endpoints filtered as non-static assets.
  - 31 outbound links classified as non-static external links.
