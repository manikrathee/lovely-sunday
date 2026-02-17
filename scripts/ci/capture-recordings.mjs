#!/usr/bin/env node
/**
 * Create short screen recordings (10-20s) of 1-2 representative pages showing
 * page load, scroll behavior, and a quick hover interaction.
 *
 * Usage:
 *   node capture-recordings.mjs --routes=routes.json [--output=recordings/] [--base=http://localhost:4321]
 */
import { readFileSync, mkdirSync, renameSync } from "fs";
import { join } from "path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const routesFile = args.find((a) => a.startsWith("--routes="))?.split("=")[1];
const outputDir = args.find((a) => a.startsWith("--output="))?.split("=")[1] ?? "recordings";
const baseUrl = args.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:4321";

if (!routesFile) {
  console.error("Usage: capture-recordings.mjs --routes=<file>");
  process.exit(1);
}

const routes = JSON.parse(readFileSync(routesFile, "utf8"));
mkdirSync(outputDir, { recursive: true });

function routeToFilename(route) {
  if (route === "/") return "index.webm";
  return route.replace(/^\//, "").replace(/\//g, "--") + ".webm";
}

/** Quick scroll: fast down, pause, fast back up (~6s total) */
async function scrollDemo(page) {
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const scrollHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    const step = Math.floor(viewportHeight * 0.8);
    let y = 0;

    while (y < scrollHeight) {
      y = Math.min(y + step, scrollHeight);
      window.scrollTo({ top: y, behavior: "smooth" });
      await delay(400);
    }

    await delay(800);

    window.scrollTo({ top: 0, behavior: "smooth" });
    await delay(1000);
  });
}

/** Quick hover: one nav link + one post card (~3s total) */
async function hoverDemo(page) {
  const navLink = await page.$(".site-head a");
  if (navLink) {
    const box = await navLink.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
      await page.waitForTimeout(500);
    }
  }

  const card = await page.$(".post-card");
  if (card) {
    const box = await card.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
      await page.waitForTimeout(500);
    }
  }

  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
}

async function recordPage(browser, route) {
  const tempDir = join(outputDir, ".tmp");
  mkdirSync(tempDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: tempDir, size: { width: 1440, height: 900 } },
  });

  const page = await context.newPage();

  try {
    // Navigate — captures page load animation (~2s with network settle)
    await page.goto(`${baseUrl}${route}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    // Brief landing state pause
    await page.waitForTimeout(1500);

    // Quick scroll down and back (~6s)
    await scrollDemo(page);

    // Quick hover demo (~3s)
    await hoverDemo(page);

    // Brief closing pause
    await page.waitForTimeout(500);
  } catch (err) {
    console.warn(`  SKIP ${route}: ${err.message}`);
  }

  await context.close();

  const videoPath = await page.video()?.path();
  if (videoPath) {
    const dest = join(outputDir, routeToFilename(route));
    renameSync(videoPath, dest);
    console.log(`  ${route} -> ${dest}`);
  }
}

async function run() {
  console.log(`Recording ${routes.length} pages`);
  const browser = await chromium.launch();

  // Record pages in parallel (only 1-2 pages, safe to parallelize)
  await Promise.all(routes.map((route) => recordPage(browser, route)));

  await browser.close();
  console.log(`Done. ${routes.length} recordings saved to ${outputDir}/`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
