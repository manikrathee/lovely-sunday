#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { load } from "cheerio";

const repoRoot = resolve(import.meta.dirname, "..");
const distDir = resolve(repoRoot, "dist");
const productionOrigin = new URL(process.env.SITE_URL ?? "https://lovelysunday.co").origin;
const issues = [];

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function requireFile(relativePath) {
  const path = resolve(distDir, relativePath);
  if (!existsSync(path)) {
    issues.push(`Missing generated artifact: dist/${relativePath}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

const doubleSlashRoute = "lookbook-double/looks/babes-day/index.html";
const doubleSlashHtml = requireFile(doubleSlashRoute);
if (doubleSlashHtml) {
  const $ = load(doubleSlashHtml);
  if ($("main").length !== 1) issues.push(`${doubleSlashRoute}: expected one main landmark`);
  if ($("h1").length !== 1) issues.push(`${doubleSlashRoute}: expected one H1`);
  if (!$("h1").text().trim()) issues.push(`${doubleSlashRoute}: H1 must have text`);
}

const builtFiles = walk(distDir);
for (const file of builtFiles.filter(
  (path) => path.endsWith(".html") && relative(distDir, path) !== "admin/index.html",
)) {
  const html = readFileSync(file, "utf8");
  const $ = load(html);
  const label = relative(repoRoot, file);

  if ($("title").length !== 1) issues.push(`${label}: expected exactly one title`);
  if ($('link[rel="canonical"]').length !== 1) issues.push(`${label}: expected exactly one canonical`);
  if ($('meta[name="description"]').length !== 1) issues.push(`${label}: expected one description`);
  if ($('meta[property="og:title"]').length !== 1) issues.push(`${label}: expected one og:title`);
  if ($('meta[name="twitter:card"]').length !== 1) issues.push(`${label}: expected one twitter:card`);

  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical && new URL(canonical).origin !== productionOrigin) {
    issues.push(
      `${label}: canonical is not on the production origin ${productionOrigin} (${canonical})`,
    );
  }

  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      JSON.parse($(script).text());
    } catch (error) {
      issues.push(`${label}: invalid JSON-LD (${error.message})`);
    }
  }

  if (html.includes("AgentationToolbar") || html.includes("agentation")) {
    issues.push(`${label}: Agentation leaked into a production build`);
  }
}

const robots = requireFile("robots.txt");
for (const expected of ["User-agent: GPTBot", "User-agent: ClaudeBot", "Sitemap:"]) {
  if (robots && !robots.includes(expected)) issues.push(`robots.txt missing ${expected}`);
}

for (const artifact of [
  "llms.txt",
  "llms-full.txt",
  ".well-known/llm.md",
  "sitemap-index.xml",
  "index.md",
]) {
  requireFile(artifact);
}

if (issues.length > 0) {
  console.error(`✖ Built-site validation failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log("✓ Built-site validation passed: routes, SEO, AI discovery, and dev-only tooling.");
