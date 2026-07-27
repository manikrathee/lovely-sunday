#!/usr/bin/env bash
set -euo pipefail

S3_URI="${S3_URI:-}"
S3_BUCKET="${S3_BUCKET:-}"
DIST_DIR="${DIST_DIR:-dist}"
AWS_REGION="${AWS_REGION:-}"
HASHED_ASSET_PREFIX="${HASHED_ASSET_PREFIX:-_astro}"

if [[ -z "$S3_URI" && -n "$S3_BUCKET" ]]; then
  S3_URI="s3://$S3_BUCKET"
fi

if [[ -z "$S3_URI" ]]; then
  echo "[deploy] S3_URI is required (example: S3_URI=s3://lovelysunday/site/)." >&2
  echo "[deploy] S3_BUCKET remains supported for backward compatibility." >&2
  exit 1
fi

if [[ "$S3_URI" != s3://* ]]; then
  echo "[deploy] S3_URI must start with s3:// (received: $S3_URI)." >&2
  exit 1
fi

if [[ ! -d "$DIST_DIR" ]]; then
  echo "[deploy] Build directory '$DIST_DIR' does not exist. Run 'npm run build' first." >&2
  exit 1
fi

region_args=()
if [[ -n "$AWS_REGION" ]]; then
  region_args+=(--region "$AWS_REGION")
fi

echo "[deploy] Uploading non-hashed files with revalidation cache headers..."
aws s3 sync "$DIST_DIR/" "$S3_URI" \
  --delete \
  --exclude "$HASHED_ASSET_PREFIX/*" \
  --cache-control "public,max-age=0,must-revalidate" \
  ${region_args[@]+"${region_args[@]}"}

echo "[deploy] Uploading hashed assets with immutable cache headers..."
aws s3 sync "$DIST_DIR/" "$S3_URI" \
  --exclude "*" \
  --include "$HASHED_ASSET_PREFIX/*" \
  --cache-control "public,max-age=31536000,immutable" \
  ${region_args[@]+"${region_args[@]}"}

echo "[deploy] S3 deploy complete: $S3_URI"
