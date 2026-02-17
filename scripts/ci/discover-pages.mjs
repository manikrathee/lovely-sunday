#!/usr/bin/env node
/**
 * Scan dist/ for all built pages and output their routes.
 *
 * Usage:
 *   node discover-pages.mjs [--format=json|lines] [--dist=./dist]
 */
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const args = process.argv.slice(2);
const format = args.find((a) => a.startsWith("--format="))?.split("=")[1] ?? "json";
const distDir = args.find((a) => a.startsWith("--dist="))?.split("=")[1] ?? "./dist";

const EXCLUDE_DIRS = new Set(["_astro", "open-graph"]);

function walk(dir) {
  const routes = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      routes.push(...walk(join(dir, entry.name)));
    } else if (entry.name === "index.html") {
      const rel = relative(distDir, dir);
      routes.push(rel === "" ? "/" : `/${rel}`);
    }
  }
  return routes;
}

const routes = walk(distDir).sort();

if (format === "lines") {
  process.stdout.write(routes.join("\n") + "\n");
} else {
  process.stdout.write(JSON.stringify(routes, null, 2) + "\n");
}
