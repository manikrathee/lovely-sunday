#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d "${DIST_DIR:-dist}" ]]; then
  echo "[deploy] dist output missing; building site..."
  npm run build
fi

"$(dirname "$0")/deploy-to-s3.sh"

if [[ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  region_args=()
  if [[ -n "${AWS_REGION:-}" ]]; then
    region_args+=(--region "$AWS_REGION")
  fi
  echo "[deploy] Invalidating CloudFront distribution ${CLOUDFRONT_DISTRIBUTION_ID}..."
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    ${region_args[@]+"${region_args[@]}"} >/dev/null
fi

node "$(dirname "$0")/verify-post-deploy-urls.mjs"
