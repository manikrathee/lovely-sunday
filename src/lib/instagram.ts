export type InstagramMedia = {
  id: string;
  shortcode: string;
  caption: string;
  displayUrl: string;
  thumbnailUrl: string;
  permalink: string;
  timestamp?: string;
};

const INSTAGRAM_USERNAME = "_lovelysunday";
const PROFILE_ENDPOINT = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${INSTAGRAM_USERNAME}`;
const REQUEST_HEADERS = {
  "x-ig-app-id": "936619743392459",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

let mediaCache: InstagramMedia[] | null = null;

function normalizeText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCaptionFromNode(node: any): string {
  const edges = node?.edge_media_to_caption?.edges;
  if (!Array.isArray(edges) || edges.length === 0) {
    return "";
  }

  return edges[0]?.node?.text || "";
}

function mapToInstagramMedia(node: any): InstagramMedia {
  return {
    id: node.id,
    shortcode: node.shortcode,
    caption: getCaptionFromNode(node),
    displayUrl: node.display_url,
    thumbnailUrl: node.thumbnail_src || node.display_url,
    permalink: `https://www.instagram.com/p/${node.shortcode}/`,
    timestamp: node.taken_at_timestamp
      ? new Date(node.taken_at_timestamp * 1000).toISOString()
      : undefined,
  };
}

export async function getInstagramMedia(limit = 24): Promise<InstagramMedia[]> {
  if (mediaCache) {
    return mediaCache.slice(0, limit);
  }

  try {
    const response = await fetch(PROFILE_ENDPOINT, {
      headers: REQUEST_HEADERS,
    });

    if (!response.ok) {
      console.warn(`Instagram profile request failed: ${response.status}`);
      mediaCache = [];
      return mediaCache;
    }

    const payload = await response.json();
    const nodes =
      payload?.data?.user?.edge_owner_to_timeline_media?.edges?.map((edge: any) => edge?.node) ||
      [];

    mediaCache = nodes.filter(Boolean).map(mapToInstagramMedia);
    return mediaCache.slice(0, limit);
  } catch (error) {
    console.warn("Instagram media fetch failed", error);
    mediaCache = [];
    return mediaCache;
  }
}

export function getRelevantInstagramMedia(
  media: InstagramMedia[],
  context: {
    title?: string;
    description?: string;
    slug?: string;
  },
  limit = 6,
): InstagramMedia[] {
  if (media.length === 0) {
    return [];
  }

  const keywords = new Set(
    [context.title, context.description, context.slug]
      .map(normalizeText)
      .filter(Boolean)
      .flatMap((value) => value.split(" "))
      .filter((word) => word.length >= 4),
  );

  const scored = media
    .map((item, index) => {
      const haystack = normalizeText(item.caption);
      const score = Array.from(keywords).reduce((total, keyword) => {
        if (haystack.includes(keyword)) {
          return total + (keyword.length >= 7 ? 2 : 1);
        }
        return total;
      }, 0);

      return { item, score, index };
    })
    .sort((a, b) => {
      if (b.score === a.score) {
        return a.index - b.index;
      }
      return b.score - a.score;
    });

  const withMatches = scored.filter((entry) => entry.score > 0).map((entry) => entry.item);
  if (withMatches.length >= limit) {
    return withMatches.slice(0, limit);
  }

  const fallback = media.filter((item) => !withMatches.includes(item));
  return [...withMatches, ...fallback].slice(0, limit);
}
