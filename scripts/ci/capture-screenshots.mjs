#!/usr/bin/env node
/**
 * Take full-page screenshots of every page at desktop and mobile viewports.
 * Handles lazy-loaded images, animation settling, and font loading.
 *
 * Usage:
 *   node capture-screenshots.mjs --pages=pages.json [--output=screenshots/] [--base=http://localhost:4321] [--concurrency=3]
 */
import { readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const pagesFile = args.find((a) => a.startsWith("--pages="))?.split("=")[1];
const outputDir = args.find((a) => a.startsWith("--output="))?.split("=")[1] ?? "screenshots";
const baseUrl = args.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:4321";
const concurrency = parseInt(args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? "5", 10);

if (!pagesFile) {
  console.error("Usage: capture-screenshots.mjs --pages=<file>");
  process.exit(1);
}

const pages = JSON.parse(readFileSync(pagesFile, "utf8"));

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

function routeToFilename(route) {
  if (route === "/") return "index.png";
  return route.replace(/^\//, "").replace(/\//g, "--") + ".png";
}

/** Scroll the page incrementally to trigger lazy-loaded images */
async function triggerLazyImages(page) {
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    let scrollHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    let y = 0;

    while (y < scrollHeight) {
      window.scrollTo(0, y);
      await delay(150);
      y += Math.floor(viewportHeight * 0.7);
      // Content may grow as images load
      scrollHeight = document.body.scrollHeight;
    }

    // Scroll to absolute bottom to catch anything remaining
    window.scrollTo(0, document.body.scrollHeight);
    await delay(200);
  });
}

/** Wait for all <img> elements to finish loading */
async function waitForImages(page) {
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll("img"));
    await Promise.allSettled(
      imgs
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
              setTimeout(resolve, 5000);
            })
        )
    );
  });
}

/** Force all CSS animations/transitions to their settled state */
async function settleAnimations(page) {
  await page.evaluate(() => {
    // Force post cards visible
    document.querySelectorAll(".post-card").forEach((el) => el.classList.add("is-visible"));
    // Force legacy gallery slides visible
    document
      .querySelectorAll(".sqs-gallery-design-autocolumns-slide")
      .forEach((el) => el.classList.add("is-visible"));
    // Force page transition complete
    const fade = document.querySelector(".transition-fade");
    if (fade) {
      fade.style.opacity = "1";
      fade.style.transform = "translate3d(0, 0, 0)";
      fade.style.animation = "none";
    }
  });
}

async function capturePage(browser, route, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const filename = routeToFilename(route);
  const dir = join(outputDir, viewport.name);
  mkdirSync(dir, { recursive: true });
  const outputPath = join(dir, filename);

  try {
    // Navigate and wait for network to settle
    await page.goto(`${baseUrl}${route}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for fonts
    await page.evaluate(() => document.fonts.ready);

    // Scroll to trigger lazy images
    await triggerLazyImages(page);

    // Wait for all images to load
    await waitForImages(page);

    // Force-settle animations
    await settleAnimations(page);

    // Let CSS transitions finish
    await page.waitForTimeout(1500);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    // Take full-page screenshot
    await page.screenshot({ fullPage: true, path: outputPath });
    console.log(`  [${viewport.name}] ${route} -> ${outputPath}`);
  } catch (err) {
    console.warn(`  [${viewport.name}] SKIP ${route}: ${err.message}`);
  } finally {
    await context.close();
  }
}

async function run() {
  console.log(`Capturing ${pages.length} pages x ${VIEWPORTS.length} viewports (concurrency: ${concurrency})`);
  const browser = await chromium.launch();

  // Build work queue: all page+viewport combinations
  const queue = [];
  for (const route of pages) {
    for (const viewport of VIEWPORTS) {
      queue.push({ route, viewport });
    }
  }

  // Process with concurrency pool
  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const item = queue[idx++];
      await capturePage(browser, item.route, item.viewport);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);

  await browser.close();
  console.log(`Done. ${queue.length} screenshots saved to ${outputDir}/`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
