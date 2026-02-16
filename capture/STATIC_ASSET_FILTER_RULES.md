# Static Asset Filter Rules

This document defines the static asset filtering behavior used by the capture/build pipeline in `capture/_config/lovelysunday_capture.py`.

The goal is to mirror only static assets while leaving runtime APIs and external destination links untouched.

## Rule Order

1. **Reject unsupported schemes / missing host**
   - Non-HTTP(S) URLs (`mailto:`, `tel:`, etc.) and malformed URLs are ignored.
2. **Reject runtime hosts**
   - Any URL on the runtime blocklist (`RUNTIME_HOST_BLOCKLIST`) is excluded.
   - These are telemetry, analytics, or API services and are not static artifacts.
3. **Reject first-party API routes**
   - URLs on `lovelysunday.co` / `www.lovelysunday.co` with `/api/` path are excluded.
4. **Allow known static hosts**
   - Hosts in `STATIC_HOST_ALLOWLIST` are included (CDN/static/font providers).
5. **Allow known static URL patterns**
   - URLs with static file extensions (`.css`, `.js`, `.png`, `.woff2`, etc.) or known provider static patterns are included.
6. **Allow static resource initiator types**
   - Resource entries with initiators in the asset allowlist (`img`, `image`, `link`, `script`, `css`, `font`, `video`, `audio`) are included when not API routes.
7. **Default exclude**
   - Anything else is treated as non-static/outbound and excluded from mirroring.

## Relation to Recheck Outcomes

These rules align with `capture/manifests/failed_url_recheck_report.json` outcomes:

- `filtered_runtime_endpoint_not_static_asset`: excluded by runtime host and API-path filters.
- `outbound_link_not_static_asset`: excluded by default non-static/outbound rule.

## Pipeline Outputs

When `capture/_config/lovelysunday_capture.py` runs, it now writes:

- `capture/manifests/asset_filter_rules.json`

That manifest records the active allow/block lists and ordered rule descriptions used during that run.
