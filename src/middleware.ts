import type { MiddlewareHandler } from 'astro';
import {
  capturedSingleSlashLookbook404Paths,
  validDoubleSlashLookbookPaths,
  extractLookbookSlug,
} from './data/legacyLookbook';

const doubleSlashRewriteTargets = Object.fromEntries(
  validDoubleSlashLookbookPaths.map((path) => [
    path,
    `/lookbook-double/looks/${extractLookbookSlug(path)}/`,
  ]),
);

const singleSlashRewriteTargets = Object.fromEntries(
  capturedSingleSlashLookbook404Paths.map((path) => [
    path,
    `/lookbook-single/looks/${extractLookbookSlug(path)}/`,
  ]),
);

export const onRequest: MiddlewareHandler = async (context, next) => {
  const pathname = new URL(context.request.url).pathname;

  const doubleTarget = doubleSlashRewriteTargets[pathname];
  if (doubleTarget) {
    return context.rewrite(new URL(doubleTarget, context.url));
  }

  const singleTarget = singleSlashRewriteTargets[pathname];
  if (singleTarget) {
    return context.rewrite(new URL(singleTarget, context.url));
  }

  return next();
};
