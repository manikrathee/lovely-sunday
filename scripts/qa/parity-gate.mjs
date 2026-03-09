#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (!arg.startsWith("--")) continue;
    const [key, value] = arg.includes("=")
        ? arg.split("=", 2)
        : [arg, process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "true"];
    args.set(key, value);
}

const distDir = path.resolve(repoRoot, args.get("--dist") || "dist");
const snapshotsPath = path.resolve(
    repoRoot,
    args.get("--snapshots") || "capture/manifests/verification_live_snapshots.json",
);
const reportPath = path.resolve(
    repoRoot,
    args.get("--report") || "capture/manifests/verification_report.json",
);
const pageJsonDir = path.resolve(repoRoot, args.get("--page-json-dir") || "capture/page_json");
const rewriteMapPath = path.resolve(
    repoRoot,
    args.get("--rewrite-map") || "capture/manifests/internal_url_rewrite_map.json",
);

const issues = [];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeRawPathname(raw) {
    if (!raw || raw === "/") return "/";
    const [pathOnly] = raw.split("?");
    const withLeadingSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
    return withLeadingSlash.replace(/\/+$/, "");
}

function normalizePathname(raw) {
    return normalizeRawPathname(raw).replace(/\/{2,}/g, "/");
}

function normalizeCanonical(raw) {
    if (!raw) return null;
    try {
        const url = new URL(raw);
        return normalizeRawPathname(url.pathname);
    } catch {
        return normalizeRawPathname(raw);
    }
}

function decodeHtml(value) {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&#x2F;/gi, "/")
        .replace(/&nbsp;/g, " ");
}

function extractPageMetrics(html) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    const htmlTagCount = (html.match(/<html\b/gi) || []).length;
    const bodyTagCount = (html.match(/<body\b/gi) || []).length;
    const mainTagCount = (html.match(/<main\b/gi) || []).length;
    const hasSquarespace =
        /(?:\bsqs-[a-z0-9_-]+\b|data-sqsp-|assets\.squarespace\.com|Powered by Squarespace)/i.test(html);

    return {
        bodyTagCount,
        hasSquarespace,
        h1Count,
        htmlTagCount,
        mainTagCount,
        title: titleMatch ? decodeHtml(titleMatch[1].replace(/\s+/g, " ").trim()) : null,
    };
}

function readPngDimensions(filePath) {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 24) {
        throw new Error(`File too small to be a valid PNG: ${filePath} (${buffer.length} bytes)`);
    }
    if (buffer.toString("ascii", 1, 4) !== "PNG") {
        throw new Error(`Not a PNG file: ${filePath}`);
    }
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
    };
}

if (!fs.existsSync(distDir)) {
    console.error(`✖ Missing dist directory: ${distDir}. Run \`astro build\` before parity check.`);
    process.exit(1);
}

// Gracefully skip when capture artifacts are not present (fresh clone, CI without snapshots)
const requiredArtifacts = [reportPath, snapshotsPath, pageJsonDir];
const missingArtifacts = requiredArtifacts.filter((p) => !fs.existsSync(p));
if (missingArtifacts.length > 0) {
    console.log(
        `⚠ Parity QA gate skipped: missing capture artifacts (${missingArtifacts.map((p) => path.relative(repoRoot, p)).join(", ")}). Run the capture workflow first to enable parity checks.`,
    );
    process.exit(0);
}

const verificationReport = readJson(reportPath);
if ((verificationReport.summary?.mismatches ?? 0) > 0 || (verificationReport.summary?.errors ?? 0) > 0) {
    issues.push(
        `Capture verification_report.json is not clean (mismatches=${verificationReport.summary?.mismatches ?? 0}, errors=${verificationReport.summary?.errors ?? 0}).`,
    );
}

const snapshots = readJson(snapshotsPath).pages || [];
const expectedPages = snapshots.filter((page) => page.status === "success" && page.live);
const rewriteMap = fs.existsSync(rewriteMapPath) ? readJson(rewriteMapPath).rewriteMap || {} : {};
const legacyLookbookSingleToSlug = new Map();
const legacyLookbookDoubleToSlug = new Map();

for (const [singleUrl, doubleUrl] of Object.entries(rewriteMap)) {
    try {
        const singlePath = normalizeRawPathname(new URL(singleUrl).pathname);
        const doublePath = normalizeRawPathname(new URL(doubleUrl).pathname);
        const slug = doublePath.split("/").filter(Boolean).at(-1);
        if (!slug) continue;
        legacyLookbookSingleToSlug.set(singlePath, slug);
        legacyLookbookDoubleToSlug.set(doublePath, slug);
    } catch (error) {
        issues.push(`Invalid rewrite-map entry (${singleUrl} -> ${doubleUrl}): ${error.message}`);
    }
}

const screenshotByPath = new Map();
for (const entry of fs.readdirSync(pageJsonDir)) {
    if (!entry.endsWith(".json")) continue;
    try {
        const payload = readJson(path.join(pageJsonDir, entry));
        if (!payload.url) continue;
        const routePath = normalizeRawPathname(new URL(payload.url).pathname);
        screenshotByPath.set(routePath, {
            desktop: payload._capture?.desktopScreenshot,
            mobile: payload._capture?.mobileScreenshot,
        });
    } catch (error) {
        issues.push(`page_json/${entry}: failed to parse (${error.message}).`);
    }
}

for (const page of expectedPages) {
    let routePath;
    try {
        routePath = normalizeRawPathname(new URL(page.url).pathname);
    } catch (error) {
        issues.push(`Malformed URL in snapshots: ${JSON.stringify(page.url)} (${error.message}).`);
        continue;
    }

    const normalizedRoutePath = normalizePathname(routePath);
    const legacyDoubleSlug = legacyLookbookDoubleToSlug.get(routePath);
    const legacySingleSlug = legacyLookbookSingleToSlug.get(routePath);
    let htmlPath;
    if (legacyDoubleSlug) {
        htmlPath = path.join(distDir, "lookbook-double", "looks", legacyDoubleSlug, "index.html");
    } else if (legacySingleSlug) {
        htmlPath = path.join(distDir, "lookbook-single", "looks", legacySingleSlug, "index.html");
    } else {
        htmlPath =
            normalizedRoutePath === "/"
                ? path.join(distDir, "index.html")
                : path.join(distDir, normalizedRoutePath.slice(1), "index.html");
    }

    if (!fs.existsSync(htmlPath)) {
        issues.push(`${routePath}: missing built output file (${path.relative(repoRoot, htmlPath)}).`);
        continue;
    }

    const html = fs.readFileSync(htmlPath, "utf8");
    const actual = extractPageMetrics(html);

    if (!actual.title) {
        issues.push(`${routePath}: missing document title.`);
    }

    if (actual.htmlTagCount > 1 || actual.bodyTagCount > 1) {
        issues.push(
            `${routePath}: invalid document structure (html tags=${actual.htmlTagCount}, body tags=${actual.bodyTagCount}).`,
        );
    }

    if (actual.mainTagCount === 0) {
        issues.push(`${routePath}: missing <main> landmark.`);
    }

    if (actual.h1Count > 1) {
        issues.push(`${routePath}: multiple H1 elements detected (${actual.h1Count}).`);
    }

    if (actual.hasSquarespace) {
        issues.push(`${routePath}: legacy Squarespace markup leaked into built output.`);
    }

    const screenshots = screenshotByPath.get(routePath);
    if (!screenshots?.desktop || !screenshots?.mobile) {
        issues.push(`${routePath}: missing baseline screenshot metadata in capture/page_json.`);
        continue;
    }

    const desktopPath = path.resolve(repoRoot, "capture", screenshots.desktop);
    const mobilePath = path.resolve(repoRoot, "capture", screenshots.mobile);
    if (!fs.existsSync(desktopPath) || !fs.existsSync(mobilePath)) {
        issues.push(
            `${routePath}: missing baseline screenshot files (desktop=${screenshots.desktop}, mobile=${screenshots.mobile}).`,
        );
        continue;
    }

    try {
        const desktopDim = readPngDimensions(desktopPath);
        const mobileDim = readPngDimensions(mobilePath);
        if (desktopDim.width <= mobileDim.width) {
            issues.push(
                `${routePath}: screenshot regression guard failed (desktop width ${desktopDim.width}px should exceed mobile width ${mobileDim.width}px).`,
            );
        }
    } catch (error) {
        issues.push(`${routePath}: unable to validate screenshot metadata (${error.message}).`);
    }
}

if (issues.length > 0) {
    console.error(`\n✖ Parity QA gate failed with ${issues.length} issue(s):`);
    for (const issue of issues) {
        console.error(`  - ${issue}`);
    }
    process.exit(1);
}

console.log(`✓ Parity QA gate passed for ${expectedPages.length} routes.`);
