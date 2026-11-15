/**
 * Homepage data selection.
 *
 * Pulls Aileen's own photo shoots out of the captured legacy pages and shapes
 * them for the hero mosaic and the journal post list. Everything here is pure
 * selection; the components decide how it is laid out.
 */
import { loadLegacyPages, type LegacyImage, type LegacyPage } from "./legacy-pages";

export type Orientation = "portrait" | "landscape" | "square";

export type HomeImage = LegacyImage & {
  orientation: Orientation;
};

export type HomePost = {
  pathname: string;
  title: string;
  /** "Lookbook" | "Editorial" */
  eyebrow: string;
  main: HomeImage;
  thumbs: HomeImage[];
  /** Remaining frames of the shoot, not shown on the card (hero picks from these first). */
  extra: HomeImage[];
  /** Total photographs on the post page (for an optional "12 photos" meta). */
  photoCount: number;
};

/** Named cells of the hero mosaic (see home.css `.home-hero__photo--*`). */
export type HeroSlot = "a" | "b" | "c" | "d" | "e";

export type HeroPhoto = HomeImage & {
  slot: HeroSlot;
  href: string;
  postTitle: string;
};

/** Utility and index routes that are never journal posts. */
const EXCLUDED_PATHNAMES = new Set([
  "/",
  "/index",
  "/lookbook",
  "/daily-diary",
  "/about-lovely-sunday",
  "/contact-lovely-sunday",
  "/search",
  "/cart",
  "/shop",
  "/looks",
]);

const EXCLUDED_PREFIXES = ["/lookbook/tag/"];

/**
 * Lookbook "looks" whose captured images are press photos, street-style pins or
 * shopping collages rather than Aileen's own photography. They stay reachable
 * from /lookbook but are not surfaced on the homepage (brief: no product grids,
 * shopping collages or press photos).
 */
const NOT_OWN_PHOTOGRAPHY = new Set([
  "/lookbook/balmain-blazer",
  "/lookbook/dresses-over-denim",
  "/lookbook/kate-spade-pink-feather-clutch",
  "/lookbook/looks/beretrainbow",
  "/lookbook/looks/nord-sale-16",
  "/lookbook/oh-my-pearls",
  "/lookbook/what-is-your-passion",
]);

/**
 * Shoots the owner called out, in display order. Everything else follows in
 * capture-manifest order.
 */
const FEATURED_ORDER = [
  "/purple-lace",
  "/lavender-dreams-in-paris",
  "/flowers-bora-bora",
  "/wheat-field-sunset",
  "/exploring-a-german-castle",
  "/lookbook/ysl-studio-paris-france",
  "/pink-colouttes",
  "/grey-skirt-with-detailed-top",
];

/**
 * Hand-picked hero frames, keyed by post, matched against the image filename.
 * Only needed where the automatic pick (first unseen frame of the right
 * orientation) lands on a detail shot instead of a portrait of Aileen.
 */
const HERO_PREFERRED_FRAME: Record<string, string> = {
  "/purple-lace": "Purple+Lace-58",
};

/** Product thumbnails and sidebar chrome are small; real shoot frames are not. */
const MIN_PHOTO_SIDE = 600;
const MIN_IMAGES_PER_POST = 4;
const DEFAULT_POST_LIMIT = 12;

/** Squarespace CDN renditions we can request with `?format=<n>w`. */
const CDN_WIDTHS = [300, 500, 750, 1000, 1500, 2500] as const;

const FILENAME_ALT = /\.(jpe?g|png|gif|webp|heic)$/i;
const CAMERA_ALT = /^(IMG|MVIMG|DSC|L\d{6,}|G\d{6,}|public|Adjustments|image-asset|\d{5,}|[0-9A-F]{8}-)/i;

export function cleanTitle(title: string): string {
  return title
    .replace(/\s+from Lookbook$/i, "")
    .replace(/\s+[—-]\s+LovelySunday$/i, "")
    .trim();
}

export function orientationOf(image: LegacyImage): Orientation {
  const { width, height } = image;
  if (!width || !height) return "portrait";
  if (Math.abs(width - height) <= Math.max(width, height) * 0.08) return "square";
  return height > width ? "portrait" : "landscape";
}

/** Rewrites a Squarespace CDN URL to a specific rendition width. */
export function cdnSrc(src: string, width: number): string {
  if (!/squarespace-cdn\.com/i.test(src)) return src;
  const [base] = src.split("?", 1);
  return `${base}?format=${width}w`;
}

/**
 * Builds a `srcset` from CDN renditions that do not exceed the source width.
 * Always includes the smallest requested width so there is at least one entry.
 */
export function buildSrcSet(image: LegacyImage, widths: readonly number[]): string | undefined {
  if (!/squarespace-cdn\.com/i.test(image.src)) return undefined;
  const sorted = [...widths].filter((w) => CDN_WIDTHS.includes(w as (typeof CDN_WIDTHS)[number])).sort((a, b) => a - b);
  const usable = sorted.filter((w, index) => index === 0 || !image.width || w <= image.width);
  if (usable.length === 0) return undefined;
  return usable.map((w) => `${cdnSrc(image.src, w)} ${w}w`).join(", ");
}

function isFilenameAlt(alt: string): boolean {
  return (
    !alt ||
    alt === "Lovely Sunday gallery image" ||
    alt === "Lovely Sunday image" ||
    FILENAME_ALT.test(alt) ||
    CAMERA_ALT.test(alt)
  );
}

function describeImage(image: LegacyImage, title: string, index: number): HomeImage {
  const alt = isFilenameAlt(image.alt) ? `${title}, photo ${index + 1}` : image.alt;
  return { ...image, alt, orientation: orientationOf(image) };
}

function isPhotoSized(image: LegacyImage): boolean {
  if (!image.width || !image.height) return true;
  return Math.min(image.width, image.height) >= MIN_PHOTO_SIDE;
}

function isCandidatePost(page: LegacyPage): boolean {
  const { view, sourcePathname, pathname } = page;
  if (view.kind !== "gallery") return false;
  if (sourcePathname.includes("//")) return false;
  if (view.title === "LovelySunday" || page.title === "LovelySunday") return false;
  if (EXCLUDED_PATHNAMES.has(pathname)) return false;
  if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  if (NOT_OWN_PHOTOGRAPHY.has(pathname)) return false;
  return view.images.length >= MIN_IMAGES_PER_POST;
}

let _posts: HomePost[] | null = null;

/**
 * Every homepage-eligible post, ordered: owner-featured shoots first, then the
 * remaining shoots in capture-manifest order.
 */
export function getAllHomePosts(): HomePost[] {
  if (_posts) return _posts;

  const candidates = loadLegacyPages().filter(isCandidatePost);

  // Lookbook captures drag sidebar images from other posts into their gallery.
  // An image that appears on several pages belongs to the page that leads with it.
  const ownerBySrc = new Map<string, string>();
  const countBySrc = new Map<string, number>();
  for (const page of candidates) {
    for (const [index, image] of page.view.images.entries()) {
      countBySrc.set(image.src, (countBySrc.get(image.src) ?? 0) + 1);
      if (index === 0 && !ownerBySrc.has(image.src)) ownerBySrc.set(image.src, page.pathname);
    }
  }

  const posts: HomePost[] = [];

  for (const page of candidates) {
    const title = cleanTitle(page.view.title);
    const seen = new Set<string>();
    const frames: LegacyImage[] = [];

    for (const image of page.view.images) {
      if (seen.has(image.src)) continue;
      const shared = (countBySrc.get(image.src) ?? 0) > 1;
      if (shared && ownerBySrc.get(image.src) !== page.pathname) continue;
      if (!isPhotoSized(image)) continue;
      seen.add(image.src);
      frames.push(image);
    }

    const lead = page.view.heroImage ?? frames[0];
    if (!lead) continue;
    const rest = frames.filter((image) => image.src !== lead.src);
    if (rest.length < MIN_IMAGES_PER_POST - 1) continue;

    posts.push({
      pathname: page.pathname,
      title,
      eyebrow: page.pathname.startsWith("/lookbook") ? "Lookbook" : "Editorial",
      main: describeImage(lead, title, 0),
      thumbs: rest.slice(0, 3).map((image, index) => describeImage(image, title, index + 1)),
      extra: rest.slice(3).map((image, index) => describeImage(image, title, index + 4)),
      photoCount: frames.length,
    });
  }

  const rank = new Map(FEATURED_ORDER.map((pathname, index) => [pathname, index]));
  posts.sort((a, b) => {
    const ra = rank.get(a.pathname) ?? Number.POSITIVE_INFINITY;
    const rb = rank.get(b.pathname) ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return 0; // stable: keeps manifest order for the rest
  });

  _posts = posts;
  return posts;
}

export function getHomePosts(limit = DEFAULT_POST_LIMIT): HomePost[] {
  return getAllHomePosts().slice(0, limit);
}

/**
 * Hero mosaic: one photograph per featured shoot, matched to the orientation
 * each mosaic cell wants. Slots are filled in visual-priority order so the two
 * big portrait cells get the strongest shoots. Frames the post card does not
 * show are preferred so the hero and the list directly below do not repeat.
 */
const HERO_PLAN: Array<{ slot: HeroSlot; wants: Orientation | "any" }> = [
  { slot: "a", wants: "portrait" },
  { slot: "c", wants: "portrait" },
  { slot: "b", wants: "landscape" },
  { slot: "d", wants: "any" },
  { slot: "e", wants: "landscape" },
];

function pickByOrientation(frames: HomeImage[], wants: Orientation | "any"): HomeImage | undefined {
  const sized = frames.filter((image) => image.width && image.height);
  if (wants === "any") {
    return (
      sized.find((image) => image.orientation === "square") ??
      sized.find((image) => image.orientation === "portrait") ??
      sized[0]
    );
  }
  return sized.find((image) => image.orientation === wants);
}

export function getHeroPhotos(): HeroPhoto[] {
  const posts = getAllHomePosts();
  const used = new Set<string>();
  const photos: HeroPhoto[] = [];

  for (const { slot, wants } of HERO_PLAN) {
    for (const post of posts) {
      if (used.has(post.pathname)) continue;
      const frames = [...post.extra, ...post.thumbs, post.main];
      const preferred = HERO_PREFERRED_FRAME[post.pathname];
      const curated = preferred
        ? frames.find(
            (frame) =>
              frame.src.includes(preferred) && (wants === "any" || frame.orientation === wants),
          )
        : undefined;
      const image = curated ?? pickByOrientation(frames, wants);
      if (!image) continue;
      used.add(post.pathname);
      photos.push({ ...image, slot, href: post.pathname, postTitle: post.title });
      break;
    }
  }

  // Render in document/reading order (a, b, c, d, e) regardless of fill order.
  const order: HeroSlot[] = ["a", "b", "c", "d", "e"];
  return photos.sort((x, y) => order.indexOf(x.slot) - order.indexOf(y.slot));
}
