import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

type CaptureMetadata = {
  rawHtmlFile: string;
};

type CapturePageJson = {
  url: string;
  canonical: string;
  title: string;
  _capture: CaptureMetadata;
};

export type CapturedPage = {
  url: string;
  pathname: string;
  canonical: string;
  title: string;
  rawHtml: string;
};

const repoRoot = resolve(process.cwd());
const manifestsDir = resolve(repoRoot, "capture/manifests");
const pageJsonDir = resolve(repoRoot, "capture/page_json");

function toPathname(url: string): string {
  return new URL(url).pathname;
}

export function loadCapturedPages(): CapturedPage[] {
  const manifestUrls = readFileSync(resolve(manifestsDir, "all_urls.txt"), "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const pagesByUrl = new Map<string, CapturedPage>();

  for (const fileName of readdirSync(pageJsonDir)) {
    if (!fileName.endsWith(".json")) {
      continue;
    }

    const filePath = resolve(pageJsonDir, fileName);
    const pageJson = JSON.parse(readFileSync(filePath, "utf-8")) as CapturePageJson;

    const rawHtmlPath = resolve(repoRoot, "capture", pageJson._capture.rawHtmlFile);
    const rawHtml = readFileSync(rawHtmlPath, "utf-8");

    pagesByUrl.set(pageJson.url, {
      url: pageJson.url,
      pathname: toPathname(pageJson.url),
      canonical: pageJson.canonical,
      title: pageJson.title,
      rawHtml,
    });
  }

  const capturedPages = manifestUrls.map((url) => {
    const page = pagesByUrl.get(url);
    if (!page) {
      throw new Error(`Missing capture/page_json entry for URL: ${url}`);
    }

    return page;
  });

  if (capturedPages.length !== manifestUrls.length) {
    throw new Error(
      `Captured route count mismatch. Manifest has ${manifestUrls.length}, built ${capturedPages.length}.`,
    );
  }

  return capturedPages;
}
