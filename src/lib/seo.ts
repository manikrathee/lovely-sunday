export type SeoPageType =
  | "website"
  | "article"
  | "collection"
  | "profile"
  | "contact"
  | "confirmation";

export interface SeoBuildInput {
  pathname: string;
  siteOrigin: string;
  siteName: string;
  title?: string;
  description?: string;
  image?: string;
  pageType?: SeoPageType;
  publishedTime?: string;
  modifiedTime?: string;
}

const SITE_LOCALE = "en_US";
const BRAND_AUTHOR = "Lovely Sunday";

const normalizePathname = (pathname: string): string => {
  const [pathOnly] = pathname.split("?");
  if (!pathOnly || pathOnly === "/") return "/";
  return `/${pathOnly.replace(/^\/+|\/+$/g, "")}`;
};

const slugToWords = (value: string): string =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (value: string): string =>
  value
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const cleanDescription = (description?: string): string | undefined => {
  if (!description) return undefined;
  return description.replace(/\s+/g, " ").trim().slice(0, 160);
};

const inferDescriptionFromPath = (pathname: string, siteName: string): string => {
  if (pathname === "/") {
    return "Explore minimalist fashion editorials, lookbooks, and travel-inspired style stories on Lovely Sunday.";
  }

  const segments = pathname.split("/").filter(Boolean);
  const parent = segments[0];
  const lastSegment = segments[segments.length - 1];
  const humanized = titleCase(slugToWords(lastSegment));

  if (parent === "work") return `${humanized} — a featured style story from ${siteName}.`;
  if (parent === "news") return `${humanized} — latest updates and editorial notes from ${siteName}.`;
  if (parent === "sold") return `${humanized} — archived piece from the ${siteName} collection.`;
  if (parent === "about-lovely-sunday") return `Meet the creator behind ${siteName} and learn the story behind the editorial style.`;
  if (parent === "contact") return `Get in touch with ${siteName} for collaborations, commissions, and styling inquiries.`;

  return `${humanized} on ${siteName}.`;
};


const strategistNarrative = (pathname: string, siteName: string): string => {
  if (pathname === "/") return `Discover curated fashion editorials and visual stories from ${siteName}.`;
  const segments = pathname.split("/").filter(Boolean);
  return `Explore ${titleCase(slugToWords(segments[segments.length - 1] || "story"))} on ${siteName}.`;
};

const strategistIntent = (pathname: string, siteName: string): string => {
  if (pathname.startsWith("/contact")) return `Contact ${siteName} for collaborations, commissions, and editorial inquiries.`;
  if (pathname.startsWith("/about")) return `Learn about ${siteName}, the creative process, and the founder's style perspective.`;
  return inferDescriptionFromPath(pathname, siteName);
};

const strategistSERP = (pathname: string, siteName: string): string => {
  if (pathname.startsWith("/work/")) return `View this ${siteName} work entry featuring styling notes, imagery, and creative direction.`;
  if (pathname.startsWith("/news/")) return `Read the latest ${siteName} update with behind-the-scenes context and announcements.`;
  return inferDescriptionFromPath(pathname, siteName);
};

const blendGeneratedDescription = (pathname: string, siteName: string): string => {
  const candidates = [
    strategistNarrative(pathname, siteName),
    strategistIntent(pathname, siteName),
    strategistSERP(pathname, siteName),
  ].map((value) => cleanDescription(value) || "").filter(Boolean);

  return candidates.sort((a, b) => b.length - a.length)[0] || inferDescriptionFromPath(pathname, siteName);
};

const inferPageType = (pathname: string, pageType?: SeoPageType): SeoPageType => {
  if (pageType) return pageType;
  if (pathname === "/") return "website";
  if (pathname.startsWith("/work/") || pathname.startsWith("/news/") || pathname.startsWith("/sold/")) {
    return "article";
  }
  if (pathname === "/about-lovely-sunday") return "profile";
  if (pathname.startsWith("/contact")) return pathname.includes("thanks") ? "confirmation" : "contact";
  return "collection";
};

const breadcrumbItems = (pathname: string, siteOrigin: string) => {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = [{ name: "Home", item: new URL("/", siteOrigin).toString() }];
  let rollingPath = "";

  for (const segment of segments) {
    rollingPath += `/${segment}`;
    crumbs.push({
      name: titleCase(slugToWords(segment)),
      item: new URL(`${rollingPath}/`, siteOrigin).toString(),
    });
  }

  return crumbs;
};

export interface GeneratedSeoMeta {
  canonical: string;
  title: string;
  description: string;
  openGraphType: "website" | "article";
  robots: string;
  locale: string;
  author: string;
  jsonLd: string[];
}

export const buildSeoMeta = ({
  pathname,
  siteOrigin,
  siteName,
  title,
  description,
  image,
  pageType,
  publishedTime,
  modifiedTime,
}: SeoBuildInput): GeneratedSeoMeta => {
  const normalizedPath = normalizePathname(pathname);
  const canonical = new URL(normalizedPath === "/" ? "/" : `${normalizedPath}/`, siteOrigin).toString();
  const resolvedTitle = title?.trim() || siteName;
  const resolvedDescription =
    cleanDescription(description) || blendGeneratedDescription(normalizedPath, siteName);
  const resolvedPageType = inferPageType(normalizedPath, pageType);
  const openGraphType = resolvedPageType === "article" ? "article" : "website";
  const robots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

  const pageSchemaTypeByKind: Record<SeoPageType, string> = {
    website: "WebSite",
    article: "Article",
    collection: "CollectionPage",
    profile: "ProfilePage",
    contact: "ContactPage",
    confirmation: "WebPage",
  };

  const pageSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": pageSchemaTypeByKind[resolvedPageType],
    name: resolvedTitle,
    description: resolvedDescription,
    url: canonical,
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: siteName,
      url: new URL("/", siteOrigin).toString(),
    },
  };

  if (image) {
    pageSchema.image = image;
  }

  if (resolvedPageType === "article") {
    pageSchema.author = { "@type": "Organization", name: BRAND_AUTHOR };
    if (publishedTime) pageSchema.datePublished = publishedTime;
    if (modifiedTime) pageSchema.dateModified = modifiedTime;
  }

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems(normalizedPath, siteOrigin).map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  };

  return {
    canonical,
    title: resolvedTitle,
    description: resolvedDescription,
    openGraphType,
    robots,
    locale: SITE_LOCALE,
    author: BRAND_AUTHOR,
    jsonLd: [JSON.stringify(pageSchema), JSON.stringify(breadcrumbs)],
  };
};
