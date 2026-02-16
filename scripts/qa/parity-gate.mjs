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

const issues = [];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizePathname(raw) {
    if (!raw || raw === "/") return "/";
    const normalized = raw.replace(/\/+/g, "/").replace(/\/+$/, "");
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function normalizeCanonical(raw) {
    if (!raw) return null;
    try {
        const url = new URL(raw);
        return normalizePathname(url.pathname);
    } catch {
        return normalizePathname(raw);
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

    // Match canonical link regardless of attribute order (rel before href, or href before rel)
    const canonicalMatch =
        html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
        html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);

    const h1 = [];
    const h1Regex = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
    for (const match of html.matchAll(h1Regex)) {
        const text = decodeHtml(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
        if (text) h1.push(text);
    }

    const imageCount = (html.match(/<img\b/gi) || []).length;

    return {
        title: titleMatch ? decodeHtml(titleMatch[1].replace(/\s+/g, " ").trim()) : null,
        canonical: canonicalMatch ? canonicalMatch[1].trim() : null,
        h1,
        imageCount,
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

const screenshotByPath = new Map();
for (const entry of fs.readdirSync(pageJsonDir)) {
    if (!entry.endsWith(".json")) continue;
    try {
        const payload = readJson(path.join(pageJsonDir, entry));
        if (!payload.url) continue;
        const routePath = normalizePathname(new URL(payload.url).pathname);
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
        routePath = normalizePathname(new URL(page.url).pathname);
    } catch (error) {
        issues.push(`Malformed URL in snapshots: ${JSON.stringify(page.url)} (${error.message}).`);
        continue;
    }

    const htmlPath =
        routePath === "/"
            ? path.join(distDir, "index.html")
            : path.join(distDir, routePath.slice(1), "index.html");

    if (!fs.existsSync(htmlPath)) {
        issues.push(`${routePath}: missing built output file (${path.relative(repoRoot, htmlPath)}).`);
        continue;
    }

    const html = fs.readFileSync(htmlPath, "utf8");
    const actual = extractPageMetrics(html);
    const expected = page.live;

    if ((expected.title ?? null) !== actual.title) {
        issues.push(`${routePath}: title mismatch (expected=${JSON.stringify(expected.title)}, actual=${JSON.stringify(actual.title)}).`);
    }

    const expectedCanonical = normalizeCanonical(expected.canonical);
    const actualCanonical = normalizeCanonical(actual.canonical);
    if (expectedCanonical !== actualCanonical) {
        issues.push(
            `${routePath}: canonical mismatch (expected=${JSON.stringify(expected.canonical)}, actual=${JSON.stringify(actual.canonical)}).`,
        );
    }

    const expectedH1 = Array.isArray(expected.h1) ? expected.h1.map((item) => String(item).trim()) : [];
    if (JSON.stringify(expectedH1) !== JSON.stringify(actual.h1)) {
        issues.push(`${routePath}: H1 mismatch (expected=${JSON.stringify(expectedH1)}, actual=${JSON.stringify(actual.h1)}).`);
    }

    if ((expected.imageCount ?? 0) !== actual.imageCount) {
        issues.push(
            `${routePath}: image-count mismatch (expected=${expected.imageCount ?? 0}, actual=${actual.imageCount}).`,
        );
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
