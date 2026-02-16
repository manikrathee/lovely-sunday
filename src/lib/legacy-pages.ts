import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

type CaptureMetadata = {
  rawHtmlFile: string;
};

type CapturePageJson = {
  url: string;
  canonical: string | null;
  title: string;
  _capture: CaptureMetadata;
};

export type LegacyPage = {
  url: string;
  sourcePathname: string;
  pathname: string;
  canonical: string | null;
  title: string;
  rawHtml: string;
};

const repoRoot = resolve(process.cwd());
const captureDir = resolve(repoRoot, "capture");
const manifestsDir = resolve(repoRoot, "capture/manifests");
const pageJsonDir = resolve(repoRoot, "capture/page_json");
const noscriptPattern = /<noscript[\s\S]*?<\/noscript>/gi;

function normalizeSourcePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function normalizePathname(pathname: string): string {
  const normalizedSourcePathname = normalizeSourcePathname(pathname);
  return normalizedSourcePathname.replace(/\/{2,}/g, "/");
}

let _cache: LegacyPage[] | null = null;
let _cacheBySourcePathname: Map<string, LegacyPage> | null = null;

export function loadLegacyPages(): LegacyPage[] {
  if (_cache) {
    return _cache;
  }

  const manifestUrls = readFileSync(resolve(manifestsDir, "all_urls.txt"), "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const pagesByUrl = new Map<string, LegacyPage>();

  for (const fileName of readdirSync(pageJsonDir)) {
    if (!fileName.endsWith(".json")) {
      continue;
    }

    const filePath = resolve(pageJsonDir, fileName);
    const pageJson = JSON.parse(readFileSync(filePath, "utf-8")) as CapturePageJson;

    const rawHtmlPath = resolve(captureDir, pageJson._capture.rawHtmlFile);

    // Guard against path traversal: resolved path must stay within capture/
    if (!rawHtmlPath.startsWith(captureDir + "/")) {
      throw new Error(
        `Refusing to read rawHtmlFile outside capture directory: ${pageJson._capture.rawHtmlFile}`,
      );
    }

    const rawHtml = readFileSync(rawHtmlPath, "utf-8").replace(noscriptPattern, "");
    const sourcePathname = normalizeSourcePathname(new URL(pageJson.url).pathname);

    pagesByUrl.set(pageJson.url, {
      url: pageJson.url,
      sourcePathname,
      pathname: normalizePathname(sourcePathname),
      canonical: pageJson.canonical,
      title: pageJson.title,
      rawHtml,
    });
  }

  _cache = manifestUrls.map((url) => {
    const page = pagesByUrl.get(url);
    if (!page) {
      throw new Error(`Missing capture/page_json entry for URL: ${url}`);
    }

    return page;
  });
  _cacheBySourcePathname = new Map(_cache.map((page) => [page.sourcePathname, page]));

  return _cache;
}

export function getLegacyPageBySourcePathname(pathname: string): LegacyPage | undefined {
  const pages = loadLegacyPages();
  void pages;
  return _cacheBySourcePathname?.get(normalizeSourcePathname(pathname));
}
