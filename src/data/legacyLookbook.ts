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
