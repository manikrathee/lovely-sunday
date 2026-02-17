#!/usr/bin/env node
/**
 * Map changed files from a PR diff to affected routes.
 *
 * Usage:
 *   node map-changes-to-routes.mjs --changes=changed.txt --pages=pages.json [--max=2]
 */
import { readFileSync } from "fs";

const args = process.argv.slice(2);
const changesFile = args.find((a) => a.startsWith("--changes="))?.split("=")[1];
const pagesFile = args.find((a) => a.startsWith("--pages="))?.split("=")[1];
const max = parseInt(args.find((a) => a.startsWith("--max="))?.split("=")[1] ?? "2", 10);

if (!changesFile || !pagesFile) {
  console.error("Usage: map-changes-to-routes.mjs --changes=<file> --pages=<file> [--max=N]");
  process.exit(1);
}

const changedFiles = readFileSync(changesFile, "utf8").trim().split("\n").filter(Boolean);
const allPages = JSON.parse(readFileSync(pagesFile, "utf8"));

// Files that affect every page
const GLOBAL_PATTERNS = [
  /^src\/layouts\//,
  /^src\/components\/Header\.astro$/,
  /^src\/components\/Footer\.astro$/,
  /^src\/styles\//,
  /^astro\.config\./,
  /^package\.json$/,
  /^postcss\.config\./,
];

// Pick a representative sample when global files change (homepage + one detail page)
function representativeSample(pages) {
  const sample = [];
  const pick = (predicate) => {
    const match = pages.find(predicate);
    if (match && !sample.includes(match)) sample.push(match);
  };

  pick((p) => p === "/");
  pick((p) => p.startsWith("/work/") && p !== "/work");

  return sample;
}

let affected = new Set();
let isGlobal = false;

for (const file of changedFiles) {
  // Check global patterns
  if (GLOBAL_PATTERNS.some((re) => re.test(file))) {
    isGlobal = true;
    break;
  }

  // Content collection files → specific routes
  const contentMatch = file.match(/^src\/content\/(work|news|sold)\/(.+)\.md$/);
  if (contentMatch) {
    const [, collection, slug] = contentMatch;
    affected.add(`/${collection}/${slug}`);
    continue;
  }

  // Content pages → map to specific routes
  const pageContentMatch = file.match(/^src\/content\/pages\/(.+)\.md$/);
  if (pageContentMatch) {
    const slug = pageContentMatch[1];
    if (slug === "index") {
      affected.add("/");
    } else {
      // Find matching pages
      for (const page of allPages) {
        if (page.includes(slug)) affected.add(page);
      }
    }
    continue;
  }

  // Dynamic page templates → all pages of that type
  if (file.match(/^src\/pages\/work\/\[/)) {
    allPages.filter((p) => p.startsWith("/work/")).forEach((p) => affected.add(p));
    continue;
  }
  if (file.match(/^src\/pages\/news\/\[/)) {
    allPages.filter((p) => p.startsWith("/news/")).forEach((p) => affected.add(p));
    continue;
  }
  if (file.match(/^src\/pages\/sold\/\[/)) {
    allPages.filter((p) => p.startsWith("/sold/")).forEach((p) => affected.add(p));
    continue;
  }
  if (file.match(/^src\/pages\/lookbook-/)) {
    allPages.filter((p) => p.startsWith("/lookbook-")).forEach((p) => affected.add(p));
    continue;
  }
  if (file.match(/^src\/pages\/\[\.\.\.slug\]/)) {
    isGlobal = true;
    break;
  }

  // Specific static pages
  const staticPageMatch = file.match(/^src\/pages\/(.+)\.astro$/);
  if (staticPageMatch) {
    const route = "/" + staticPageMatch[1].replace(/\/index$/, "");
    if (allPages.includes(route === "/" ? "/" : route)) {
      affected.add(route);
    }
    continue;
  }

  // Components that affect specific page types
  if (file.includes("PostCard.astro") || file.includes("post-card.css")) {
    // Listing pages that show cards
    for (const p of allPages) {
      if (["/work", "/news", "/sold"].some((prefix) => p === prefix || p === `/${prefix.slice(1)}`)) {
        affected.add(p);
      }
    }
    affected.add("/");
    continue;
  }
  if (file.includes("PostLayout.astro")) {
    allPages.filter((p) => /^\/(work|news|sold)\//.test(p)).forEach((p) => affected.add(p));
    continue;
  }
  if (file.includes("LegacyHtmlPage.astro") || file.includes("legacy-gallery.css")) {
    isGlobal = true;
    break;
  }

  // Image/public assets
  if (file.startsWith("public/")) {
    affected.add("/");
    continue;
  }
}

let result;
if (isGlobal) {
  result = representativeSample(allPages);
} else {
  // Validate routes exist in build output
  result = [...affected].filter((r) => allPages.includes(r)).sort();
}

// If nothing matched, fall back to homepage
if (result.length === 0) {
  result = ["/"];
}

// Cap at max
result = result.slice(0, max);

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
