export interface SeoComputationInput {
  pathname: string;
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  type?: "website" | "article";
}

export interface ComputedSeoMeta {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    image: string;
    type: "website" | "article";
    siteName: string;
  };
  twitter: {
    card: "summary_large_image";
    title: string;
    description: string;
    image: string;
  };
  jsonLd: string[];
}

const SITE_NAME = "Lovely Sunday";
const SITE_URL = "https://www.lovelysunday.co";
const DEFAULT_DESCRIPTION =
  "Lovely Sunday is a style and travel journal sharing fashion lookbooks, city stories, and visual inspiration.";

const normalizePathname = (pathname: string): string => {
  const [pathOnly] = pathname.split("?");
  const collapsed = pathOnly.replace(/\/{2,}/g, "/");
  if (!collapsed || collapsed === "/") return "/";
  return collapsed.replace(/\/$/, "");
};

const toAbsoluteUrl = (value: string): string => {
  try {
    return new URL(value).toString();
  } catch {
    return new URL(value.startsWith("/") ? value : `/${value}`, SITE_URL).toString();
  }
};

const humanizeSegment = (segment: string): string =>
  segment
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const buildTitle = (pathname: string, providedTitle?: string): string => {
  if (providedTitle?.trim()) return providedTitle.trim();
  if (pathname === "/") return `${SITE_NAME} | Style, Travel & Lookbook Journal`;

  const segments = pathname.split("/").filter(Boolean);
  const tail = segments.at(-1);
  return tail ? `${humanizeSegment(tail)} | ${SITE_NAME}` : SITE_NAME;
};

const clampDescription = (value: string): string => {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 155) return trimmed;
  return `${trimmed.slice(0, 152).trimEnd()}…`;
};

const buildDescription = (pathname: string, title: string, providedDescription?: string): string => {
  if (providedDescription?.trim()) return clampDescription(providedDescription);

  const routeLabel = pathname === "/" ? "home" : pathname.split("/").filter(Boolean)[0] ?? "page";

  // Multi-pass metadata synthesis:
  // 1) Brand voice, 2) user intent, 3) route semantics.
  const brandPass = `${title} on ${SITE_NAME}, a visual destination for personal style, travel stories, and curated lookbook photography.`;
  const intentPass = `Explore ${title.toLowerCase()} with outfit inspiration, destination context, and practical styling ideas from ${SITE_NAME}.`;
  const routePass =
    routeLabel === "lookbook" || routeLabel === "looks"
      ? `Discover ${title.toLowerCase()} in a fashion lookbook with outfit details, styling references, and editorial photography.`
      : routeLabel === "daily-diary" || routeLabel === "news"
        ? `Read ${title.toLowerCase()} for fresh updates, style notes, and travel highlights from ${SITE_NAME}.`
        : brandPass;

  const candidates = [intentPass, routePass, brandPass, DEFAULT_DESCRIPTION];
  return clampDescription(candidates.find((candidate) => candidate.length >= 90) ?? DEFAULT_DESCRIPTION);
};

const buildJsonLd = (meta: {
  title: string;
  description: string;
  canonical: string;
  type: "website" | "article";
}): string[] => {
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "en",
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  };

  const webpage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: meta.title,
    url: meta.canonical,
    description: meta.description,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  const article =
    meta.type === "article"
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: meta.title,
          description: meta.description,
          mainEntityOfPage: meta.canonical,
          author: {
            "@type": "Organization",
            name: SITE_NAME,
          },
        }
      : null;

  return [website, organization, webpage, article]
    .filter(Boolean)
    .map((entry) => JSON.stringify(entry));
};

export const computeSeoMeta = (input: SeoComputationInput): ComputedSeoMeta => {
  const pathname = normalizePathname(input.pathname);
  const title = buildTitle(pathname, input.title);
  const description = buildDescription(pathname, title, input.description);
  const canonical = toAbsoluteUrl(input.canonical || pathname);
  const normalizedPath = pathname.replace(/^\//, "");
  const fallbackOgImage = toAbsoluteUrl(`/open-graph/${normalizedPath || "index"}.png`);
  const image = toAbsoluteUrl(input.ogImage || fallbackOgImage);
  const type = input.type || (pathname.includes("/look") || pathname.includes("/news/") || pathname.includes("/work/") || pathname.includes("/sold/") ? "article" : "website");

  const jsonLd = buildJsonLd({
    title,
    description,
    canonical,
    type,
  });

  return {
    title,
    description,
    canonical,
    robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
    openGraph: {
      title,
      description,
      url: canonical,
      image,
      type,
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      image,
    },
    jsonLd,
  };
};

const escapeAttribute = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const renderSeoHeadTags = (meta: ComputedSeoMeta): string => {
  const tags = [
    `<title>${escapeAttribute(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(meta.description)}">`,
    `<meta name="robots" content="${escapeAttribute(meta.robots)}">`,
    `<link rel="canonical" href="${escapeAttribute(meta.canonical)}">`,
    `<meta property="og:site_name" content="${escapeAttribute(meta.openGraph.siteName)}">`,
    `<meta property="og:type" content="${escapeAttribute(meta.openGraph.type)}">`,
    `<meta property="og:title" content="${escapeAttribute(meta.openGraph.title)}">`,
    `<meta property="og:description" content="${escapeAttribute(meta.openGraph.description)}">`,
    `<meta property="og:url" content="${escapeAttribute(meta.openGraph.url)}">`,
    `<meta property="og:image" content="${escapeAttribute(meta.openGraph.image)}">`,
    `<meta name="twitter:card" content="${escapeAttribute(meta.twitter.card)}">`,
    `<meta name="twitter:title" content="${escapeAttribute(meta.twitter.title)}">`,
    `<meta name="twitter:description" content="${escapeAttribute(meta.twitter.description)}">`,
    `<meta name="twitter:image" content="${escapeAttribute(meta.twitter.image)}">`,
    ...meta.jsonLd.map((entry) => `<script type="application/ld+json">${entry}</script>`),
  ];

  return tags.join("\n");
};

export const injectSeoIntoLegacyHtml = (rawHtml: string, seoHeadTags: string): string => {
  const cleanupPatterns = [
    /<title[\s\S]*?<\/title>/gi,
    /<meta[^>]+name=["']description["'][^>]*>/gi,
    /<meta[^>]+name=["']robots["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi,
    /<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi,
    /<link[^>]+rel=["']canonical["'][^>]*>/gi,
    /<script[^>]+type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi,
  ];

  const cleaned = cleanupPatterns.reduce(
    (acc, pattern) => acc.replace(pattern, ""),
    rawHtml,
  );

  if (/<head[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<head[^>]*>/i, (match) => `${match}\n${seoHeadTags}\n`);
  }

  return `<head>${seoHeadTags}</head>${cleaned}`;
};
