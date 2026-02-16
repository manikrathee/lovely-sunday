# Lovely Sunday — Astro Static Site on AWS (S3 + CloudFront + Route 53 + Hover)

This repository is an Astro static site configured for directory-style output and trailing slashes, which is ideal for S3 + CloudFront hosting.

- `output: "static"`
- `build.format: "directory"`
- `trailingSlash: "always"`

---

## Notes (what this README now includes)

This README contains:
- Full local dev/build/deploy command list
- End-to-end AWS setup notes for S3 + CloudFront + ACM
- DNS setup instructions for both Route 53 + Hover models
- Verification commands (`curl`, `dig`) and a copy/paste quick reference

If you just need the shortest path, use sections **4) Deploy commands** and **5) DNS setup details (Route 53 + Hover)**.

---


## Capture mirror assets

Astro now serves captured assets directly from `capture/assets/downloads` via a symlink mounted at `public/assets/downloads`.

```bash
# Create/update the symlink used by Astro
npm run prepare:capture-assets

# Validate mirrored coverage against capture manifests
npm run validate:capture-assets
# Optional CI gate (fails if any mirrored file is missing locally)
npm run validate:capture-assets -- --strict
```

`validate:capture-assets` checks:
- manifest count parity between `capture/manifests/summary.json` and `capture/manifests/assets_manifest.json`
- every successful asset points to `assets/downloads/...` and exists on disk
- outbound shopping/social links flagged in `failed_url_recheck_report.json` remain external

---

## 1) Prerequisites

Install locally:

```bash
# Node (20+ recommended)
node -v
npm -v

# AWS CLI (v2)
aws --version

# Authenticate AWS CLI
aws configure
```

Required AWS resources:
- S3 bucket for site files
- CloudFront distribution with the S3 bucket as origin
- ACM certificate in `us-east-1` for your domain(s)
- Route 53 hosted zone (recommended), with domain registered at Hover

---

## 2) Local development and build commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build static output into dist/
npm run build

# Preview production build locally
npm run preview
```

Build with your canonical production URL:

```bash
SITE_URL=https://www.yourdomain.com npm run build
```

---

## 3) One-time AWS setup

> Replace placeholders (`YOUR_*`) before running commands.

### 3.1 Create S3 bucket

```bash
AWS_REGION=us-east-1
BUCKET=www.yourdomain.com

aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$AWS_REGION"
```

If your region is **not** `us-east-1`, use:

```bash
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region YOUR_REGION \
  --create-bucket-configuration LocationConstraint=YOUR_REGION
```

Block public access (recommended with CloudFront + OAC):

```bash
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
```

### 3.2 Request ACM certificate (CloudFront must use `us-east-1`)

```bash
aws acm request-certificate \
  --region us-east-1 \
  --domain-name yourdomain.com \
  --subject-alternative-names "*.yourdomain.com" "www.yourdomain.com" \
  --validation-method DNS
```

Then complete DNS validation records (CNAMEs) in Route 53 (or Hover if not delegated yet).

### 3.3 Create CloudFront distribution

Create distribution using:
- Origin: S3 bucket
- Origin Access Control (OAC): enabled
- Alternate domain names (CNAMEs): `yourdomain.com`, `www.yourdomain.com`
- Viewer certificate: ACM cert from `us-east-1`
- Default root object: `index.html`

(You can create this in AWS Console; CLI is possible but verbose.)

### 3.4 Grant CloudFront read access to S3 bucket

Attach bucket policy (replace placeholders):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::www.yourdomain.com/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/E123ABC456DEF"
        }
      }
    }
  ]
}
```

Apply it:

```bash
aws s3api put-bucket-policy \
  --bucket "$BUCKET" \
  --policy file://bucket-policy.json
```

---

## 4) Deploy commands (repeat for every release)

```bash
# 1) Build
SITE_URL=https://www.yourdomain.com npm run build

# 2) Upload to S3 (HTML revalidates, hashed assets are immutable)
S3_BUCKET=www.yourdomain.com AWS_REGION=us-east-1 npm run deploy:s3

# 3) Invalidate CloudFront cache (optional but recommended)
aws cloudfront create-invalidation \
  --distribution-id E123ABC456DEF \
  --paths "/*"

# 4) Verify every captured URL on the deployed host
VERIFY_BASE_URL=https://www.yourdomain.com npm run verify:urls

# 5) One command: upload, optional invalidation, and URL verification
S3_BUCKET=www.yourdomain.com \
AWS_REGION=us-east-1 \
VERIFY_BASE_URL=https://www.yourdomain.com \
CLOUDFRONT_DISTRIBUTION_ID=E123ABC456DEF \
npm run deploy:production
```

`npm run deploy:s3` performs a two-pass upload:
- non-hashed files (`index.html`, route HTML, etc.) → `Cache-Control: public,max-age=0,must-revalidate`
- hashed Astro assets (`_astro/*`) → `Cache-Control: public,max-age=31536000,immutable`

`npm run verify:urls` reads `capture/manifests/all_urls.txt`, rewrites each path onto `VERIFY_BASE_URL`, and writes `capture/manifests/post_deploy_verification_report.json`.

---

## 5) DNS setup details (Route 53 + Hover)

You have two practical DNS models. Model A is strongly recommended.

## Model A (recommended): Route 53 hosts DNS, Hover remains registrar

### Step A1: Create Route 53 hosted zone

```bash
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference "$(date +%s)"
```

Get Route 53 name servers:

```bash
aws route53 list-hosted-zones-by-name --dns-name yourdomain.com
```

Or in console: Route 53 → Hosted zones → `yourdomain.com` → NS record.

### Step A2: Update nameservers at Hover

In Hover domain settings:
- Disable Hover DNS (if enabled)
- Set custom nameservers to the 4 Route 53 NS values

After this, Route 53 becomes authoritative DNS for your domain.

### Step A3: Create alias records in Route 53 to CloudFront

In Route 53 hosted zone create:
- `A` (Alias) for `yourdomain.com` → CloudFront distribution
- `AAAA` (Alias) for `yourdomain.com` → same distribution
- `A` (Alias) for `www.yourdomain.com` → CloudFront distribution
- `AAAA` (Alias) for `www.yourdomain.com` → same distribution

You can also add redirect behavior (optional):
- Force apex to `www` (or reverse) via CloudFront Function/Lambda@Edge + single canonical host.

## Model B (not preferred): Keep Hover DNS authoritative

If you keep DNS at Hover:
- `www` can be a CNAME to `dxxxxxxxxxxxx.cloudfront.net`.
- Apex (`yourdomain.com`) usually cannot be CNAME at many DNS providers; if Hover does not provide ALIAS/ANAME flattening for apex to CloudFront, apex routing is harder.

Practical outcome:
- Either use `www` as your only public host, or
- Move authoritative DNS to Route 53 (Model A).

---

## 6) CloudFront behavior for Astro static routing

Because this repo builds with directory format and trailing slashes, routes resolve to objects like:
- `/about/` → `/about/index.html`
- `/work/item/` → `/work/item/index.html`

CloudFront settings to verify:
- Default root object: `index.html`
- Compression: on (Brotli/Gzip)
- HTTPS redirect: on

Custom error response recommendations:
- 404 → `/404.html` (if you create one)
- Avoid broad SPA fallback unless intentionally desired

---

## 7) Environment variables

Used by this repository:

- `SITE_URL`: canonical site URL used by sitemap/robots/canonical metadata
- `PUBLIC_GA_MEASUREMENT_ID`: optional analytics
- `PUBLIC_TWITTER_HANDLE`: optional social metadata
- `S3_BUCKET`: target bucket for deploy scripts
- `AWS_REGION`: optional AWS region for CLI commands
- `VERIFY_BASE_URL`: deployed public base URL used by post-deploy checker
- `CLOUDFRONT_DISTRIBUTION_ID`: optional distribution for automatic invalidation in `deploy:production`

Example:

```bash
export SITE_URL=https://www.yourdomain.com
npm run build
```

---

## 8) Verification checklist

After first deployment:

```bash
# Check CloudFront hostname directly
curl -I https://dxxxxxxxxxxxx.cloudfront.net/

# Check your production host
curl -I https://www.yourdomain.com/
curl -I https://yourdomain.com/

# Confirm sitemap if enabled
curl -I https://www.yourdomain.com/sitemap-index.xml
```

DNS propagation check:

```bash
dig NS yourdomain.com +short
dig A yourdomain.com +short
dig A www.yourdomain.com +short
```

---

## 9) Repo commands quick reference

```bash
npm install
npm run dev
npm run build
npm run preview
SITE_URL=https://www.yourdomain.com npm run build
aws s3 sync dist/ s3://www.yourdomain.com --delete
aws cloudfront create-invalidation --distribution-id E123ABC456DEF --paths "/*"
```
