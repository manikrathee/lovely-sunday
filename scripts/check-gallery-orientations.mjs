import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const distDir = path.resolve("dist");

async function requireDist() {
  try {
    await access(distDir);
  } catch (error) {
    console.error("dist directory missing. run `npm run build:astro` first.");
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function findHtmlFiles(root) {
  const htmlFiles = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
        htmlFiles.push(fullPath);
      }
    }
  }

  return htmlFiles;
}

const selectors = [
  ".site-page--gallery-list .slides.sqs-gallery-design-autocolumns .sqs-gallery-design-autocolumns-slide",
];

const orientationFor = (dimensionAttr) => {
  const match = String(dimensionAttr || "").match(/(\d+)x(\d+)/i);
  if (!match) return "unknown";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "unknown";
  }
  if (Math.abs(width - height) <= 24) return "square";
  return height > width ? "portrait" : "landscape";
};

async function runCheck() {
  if (!(await requireDist())) return;
  const htmlFiles = await findHtmlFiles(distDir);
  const problems = [];

  for (const file of htmlFiles) {
    const content = await readFile(file, "utf8");
    const $ = cheerio.load(content);
    const slides = $(selectors.join(", ")).toArray().map((slide) => {
      const $slide = $(slide);
      const img = $slide.find("img").first();
      const dims = img.attr("data-image-dimensions");
      return {
        halfSpan: $slide.hasClass("is-half-span"),
        orientation: orientationFor(dims),
      };
    });

    for (let i = 0; i < slides.length - 1; i += 1) {
      const current = slides[i];
      const next = slides[i + 1];
      if (current.halfSpan && next.halfSpan && current.orientation !== next.orientation) {
        problems.push({ file, index: i, current, next });
      }
    }
  }

  if (problems.length === 0) {
    console.log("gallery-orientation check passed");
    return;
  }

  console.error("gallery-orientation check failed:");
  for (const { file, index, current, next } of problems) {
    console.error(
      `${path.relative(process.cwd(), file)} @ slide ${index} → ${current.orientation} vs ${next.orientation}`,
    );
  }
  process.exitCode = 1;
}

runCheck();
