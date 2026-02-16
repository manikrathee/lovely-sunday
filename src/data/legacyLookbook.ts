export const validDoubleSlashLookbookPaths = [
  '/lookbook//looks/babes-day/',
  '/lookbook//looks/culottes/',
  '/lookbook//looks/get-ouai-sted/',
  '/lookbook//looks/pink-pumps/',
  '/lookbook//looks/sequin-dresses/',
] as const;

export const capturedSingleSlashLookbook404Paths = [
  '/lookbook/looks/babes-day/',
  '/lookbook/looks/culottes/',
  '/lookbook/looks/get-ouai-sted/',
  '/lookbook/looks/pink-pumps/',
  '/lookbook/looks/sequin-dresses/',
] as const;

export const internalUrlRewriteMap: Record<string, string> = {
  '/lookbook/looks/babes-day/': '/lookbook//looks/babes-day/',
  '/lookbook/looks/culottes/': '/lookbook//looks/culottes/',
  '/lookbook/looks/get-ouai-sted/': '/lookbook//looks/get-ouai-sted/',
  '/lookbook/looks/pink-pumps/': '/lookbook//looks/pink-pumps/',
  '/lookbook/looks/sequin-dresses/': '/lookbook//looks/sequin-dresses/',
};

export function normalizePathname(pathname: string): string {
  if (!pathname.startsWith('/')) {
    return `/${pathname}`;
  }

  return pathname;
}

export function rewriteLegacyLookbookPath(pathname: string): string {
  const normalizedPathname = normalizePathname(pathname);
  const slashTerminatedPathname = normalizedPathname.endsWith('/')
    ? normalizedPathname
    : `${normalizedPathname}/`;

  return internalUrlRewriteMap[slashTerminatedPathname] ?? slashTerminatedPathname;
}

/**
 * Extract the slug portion from a legacy lookbook path.
 * Works for both single-slash (/lookbook/looks/slug/) and
 * double-slash (/lookbook//looks/slug/) variants.
 */
export function extractLookbookSlug(path: string): string {
  return path.replace(/^\/lookbook\/{1,2}looks\//, '').replace(/\/$/, '');
}

/**
 * Given a single-slash legacy lookbook path, return the path to the
 * corresponding double-slash page that is actually generated at build time.
 * This avoids linking to double-slash URLs that browsers normalise away.
 */
export function correctedLookbookPath(singleSlashPath: string): string {
  const slug = extractLookbookSlug(singleSlashPath);
  return `/lookbook-double/looks/${slug}/`;
}
