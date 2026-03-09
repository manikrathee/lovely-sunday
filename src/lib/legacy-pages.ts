import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "cheerio";

type CaptureMetadata = {
  rawHtmlFile: string;
};

type CaptureImage = {
  alt?: string;
  height?: number | null;
  src?: string | null;
  width?: number | null;
};

type CaptureLink = {
  href: string;
  text?: string;
};

type CapturePageJson = {
  url: string;
  canonical: string | null;
  title: string;
  headings?: Record<string, string[]>;
  images?: CaptureImage[];
  links?: CaptureLink[];
  mainText?: string;
  meta?: {
    description?: string | null;
  };
  openGraph?: {
    description?: string | null;
  };
  paragraphs?: string[];
  _capture: CaptureMetadata;
};

export type LegacyImage = {
  alt: string;
  height?: number;
  src: string;
  width?: number;
};

export type LegacyLink = {
  external: boolean;
  href: string;
  label: string;
};

export type LegacyView = {
  description: string;
  eyebrow: string;
  heroImage?: LegacyImage;
  images: LegacyImage[];
  kind: "gallery" | "home" | "list" | "page";
  links: LegacyLink[];
  paragraphs: string[];
  title: string;
};

export type LegacyPage = {
  url: string;
  sourcePathname: string;
  pathname: string;
  canonical: string | null;
  title: string;
  view: LegacyView;
};

const repoRoot = resolve(process.cwd());
const captureDir = resolve(repoRoot, "capture");
const manifestsDir = resolve(repoRoot, "capture/manifests");
const pageJsonDir = resolve(repoRoot, "capture/page_json");
const noscriptPattern = /<noscript[\s\S]*?<\/noscript>/gi;
const siteOrigin = "https://www.lovelysunday.co";
const utilityPaths = new Set([
  "/",
  "/about-lovely-sunday",
  "/cart",
  "/contact-lovely-sunday",
  "/daily-diary",
  "/index",
  "/lookbook",
  "/looks",
  "/news",
  "/search",
    "/shop",
]);
const homeHeroImage: LegacyImage = {
    alt: "Lovely Sunday",
    height: 439,
    src: "/img/lovely-sunday-logo.svg",
    width: 1000,
};

function normalizeSourcePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function normalizePathname(pathname: string): string {
  const normalizedSourcePathname = normalizeSourcePathname(pathname);
  return normalizedSourcePathname.replace(/\/{2,}/g, "/");
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value: string | null | undefined): string {
  const title = normalizeWhitespace(value).replace(/\s+[—-]\s+LovelySunday$/i, "");
  return title || "Lovely Sunday";
}

function buildLegacyHref(href: string): string {
  if (!href) return "/";

  if (/^(mailto:|tel:)/i.test(href)) {
    return href;
  }

  try {
    const candidate = new URL(href, siteOrigin);
    const isInternal = /(^|\.)lovelysunday\.co$/i.test(candidate.hostname);
    if (!isInternal) {
      return candidate.toString();
    }

    const path = normalizePathname(candidate.pathname || "/");
    const query = candidate.search || "";
    const hash = candidate.hash || "";

    return `${path}${query}${hash}`;
  } catch {
    return href;
  }
}

function isContentImage(image: CaptureImage | undefined): image is Required<Pick<CaptureImage, "src">> &
  CaptureImage {
  const src = image?.src?.trim();
  if (!src || src.startsWith("data:")) {
    return false;
  }

  return (
    !src.includes("logo-1000px") &&
    !src.includes("/universal/images-v6/icons/") &&
    !src.includes("maps.googleapis.com") &&
    !src.includes("maps.gstatic.com")
  );
}

function parseDimensions(rawDimensions: string | undefined): Pick<LegacyImage, "width" | "height"> {
  const match = rawDimensions?.match(/(\d+)x(\d+)/i);
  if (!match) {
    return {};
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  return {
    height: Number.isFinite(height) ? height : undefined,
    width: Number.isFinite(width) ? width : undefined,
  };
}

function extractGalleryImages(rawHtml: string): LegacyImage[] {
  const $ = load(rawHtml);
  const seen = new Set<string>();
  const images: LegacyImage[] = [];

  $("#page .sqs-gallery-design-autocolumns-slide img, #page img").each((_index, element) => {
    const source =
      $(element).attr("data-image") ||
      $(element).attr("data-src") ||
      $(element).attr("src");

    if (!source || seen.has(source)) {
      return;
    }

    seen.add(source);

    images.push({
      alt: normalizeWhitespace($(element).attr("alt")) || "Lovely Sunday gallery image",
      src: source,
      ...parseDimensions($(element).attr("data-image-dimensions")),
    });
  });

  return images;
}

function extractParagraphs(pageJson: CapturePageJson, rawHtml: string): string[] {
  const fromCapture = (pageJson.paragraphs ?? []).map((entry) => normalizeWhitespace(entry));
  const $ = load(rawHtml);
  const fromHtml = [
    ...$("#page .sqs-html-content p, #sideTrayBlocks .sqs-html-content p")
      .map((_index, element) => normalizeWhitespace($(element).text()))
      .get(),
    normalizeWhitespace(pageJson.mainText),
  ];

  const seen = new Set<string>();

  return [...fromCapture, ...fromHtml].filter((entry) => {
    if (!entry || seen.has(entry)) {
      return false;
    }

    seen.add(entry);
    return true;
  });
}

function extractLinks(pageJson: CapturePageJson, sourcePathname: string): LegacyLink[] {
  const seen = new Set<string>();

  return (pageJson.links ?? [])
    .map((link) => {
      const label = normalizeWhitespace(link.text);
      const href = buildLegacyHref(link.href);
      const external = /^https?:\/\//i.test(href) && !href.includes("lovelysunday.co");
      const pathname = external ? "" : normalizePathname(href.split(/[?#]/, 1)[0] || "/");

      return { external, href, label, pathname };
    })
    .filter((link) => {
      if (!link.label || /^\d+$/.test(link.label)) {
        return false;
      }

      if (link.external || !link.pathname) {
        return false;
      }

      if (
        link.pathname === sourcePathname ||
        utilityPaths.has(link.pathname) ||
        link.pathname.includes("/tag/")
      ) {
        return false;
      }

      if (seen.has(link.pathname)) {
        return false;
      }

      seen.add(link.pathname);
      return true;
    })
    .map(({ external, href, label }) => ({ external, href, label }))
    .slice(0, 12);
}

function inferEyebrow(sourcePathname: string, kind: LegacyView["kind"]): string {
  if (kind === "home") {
    return "Home";
  }

  if (sourcePathname.startsWith("/lookbook")) {
    return "Lookbook";
  }

  if (sourcePathname === "/daily-diary") {
    return "Archive";
  }

  return kind === "gallery" ? "Editorial" : "Page";
}

function buildLegacyView(
  pageJson: CapturePageJson,
  rawHtml: string,
  sourcePathname: string,
): LegacyView {
  const galleryImages = extractGalleryImages(rawHtml);
  const paragraphs = extractParagraphs(pageJson, rawHtml);
  const links = extractLinks(pageJson, sourcePathname);
  const contentImages = (pageJson.images ?? [])
    .filter(isContentImage)
    .map((image) => ({
      alt: normalizeWhitespace(image.alt) || "Lovely Sunday image",
      height: image.height ?? undefined,
      src: image.src,
      width: image.width ?? undefined,
    }));

  const kind: LegacyView["kind"] =
    sourcePathname === "/" || sourcePathname === "/index"
      ? "home"
      : galleryImages.length > 1
        ? "gallery"
        : links.length > 3
          ? "list"
          : "page";

  const titleSource =
    kind === "home"
      ? pageJson.headings?.h1?.[0] || pageJson.headings?.h2?.[0] || pageJson.title
      : pageJson.headings?.h1?.[0] || pageJson.title;
  const title = normalizeTitle(titleSource);
  const description = normalizeWhitespace(
    pageJson.meta?.description || pageJson.openGraph?.description || paragraphs[0],
  );
  const bodyParagraphs = paragraphs.filter((paragraph) => paragraph !== description);
  const heroImage = kind === "gallery" ? undefined : kind === "home" ? homeHeroImage : contentImages[0];

  return {
    description,
    eyebrow: inferEyebrow(sourcePathname, kind),
    heroImage,
    images: galleryImages.length > 0 ? galleryImages : contentImages.slice(heroImage ? 1 : 0, 13),
    kind,
    links,
    paragraphs: bodyParagraphs,
    title,
  };
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
      title: normalizeTitle(pageJson.title),
      view: buildLegacyView(pageJson, rawHtml, sourcePathname),
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
