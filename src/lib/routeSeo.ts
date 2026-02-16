interface RouteMetaInput {
  title?: string | null;
  canonical?: string | null;
  meta?: {
    description?: string | null;
    robots?: string | null;
  } | null;
  openGraph?: {
    title?: string | null;
    description?: string | null;
    image?: string | null;
    type?: string | null;
    url?: string | null;
  } | null;
  twitter?: {
    card?: "summary" | "summary_large_image" | "app" | "player" | null;
    title?: string | null;
    description?: string | null;
    image?: string | null;
  } | null;
  jsonLd?: string[] | null;
}

export interface RouteSeoMeta {
  title?: string;
  canonical?: string;
  description?: string;
  robots?: string;
  openGraph: {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
    url?: string;
  };
  twitter: {
    card?: "summary" | "summary_large_image" | "app" | "player";
    title?: string;
    description?: string;
    image?: string;
  };
  jsonLd: string[];
}

const pageJsonModules = import.meta.glob<RouteMetaInput>("../../capture/page_json/*.json", {
  eager: true,
  import: "default",
});

const normalizePathname = (pathname: string): string => {
  const [pathOnly] = pathname.split("?");
  const collapsed = pathOnly.replace(/\/{2,}/g, "/");
  if (!collapsed || collapsed === "/") return "/";
  return collapsed.replace(/\/$/, "");
};

const canonicalToPath = (canonical?: string | null): string | null => {
  if (!canonical) return null;
  try {
    return normalizePathname(new URL(canonical).pathname || "/");
  } catch {
    return null;
  }
};

const routeSeoByPath = new Map<string, RouteSeoMeta>();

for (const data of Object.values(pageJsonModules)) {
  const path = canonicalToPath(data.canonical) || canonicalToPath(data.openGraph?.url);
  if (!path) continue;

  const existing = routeSeoByPath.get(path);
  if (existing && existing.canonical && data.canonical) {
    continue;
  }

  routeSeoByPath.set(path, {
    title: data.title ?? undefined,
    canonical: data.canonical ?? undefined,
    description: data.meta?.description ?? undefined,
    robots: data.meta?.robots ?? undefined,
    openGraph: {
      title: data.openGraph?.title ?? undefined,
      description: data.openGraph?.description ?? undefined,
      image: data.openGraph?.image ?? undefined,
      type: data.openGraph?.type ?? undefined,
      url: data.openGraph?.url ?? undefined,
    },
    twitter: {
      card: data.twitter?.card ?? undefined,
      title: data.twitter?.title ?? undefined,
      description: data.twitter?.description ?? undefined,
      image: data.twitter?.image ?? undefined,
    },
    jsonLd: data.jsonLd ?? [],
  });
}

if (routeSeoByPath.has("/index")) {
  const indexMeta = routeSeoByPath.get("/index");
  if (indexMeta) {
    routeSeoByPath.set("/", indexMeta);
  }
}

export const getRouteSeoMeta = (pathname: string): RouteSeoMeta | undefined =>
  routeSeoByPath.get(normalizePathname(pathname));
