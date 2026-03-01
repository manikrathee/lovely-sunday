const INSTAGRAM_APP_ID = "936619743392459";
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface InstagramPost {
  id: string;
  shortcode: string;
  permalink: string;
  imageUrl: string;
  caption: string;
  timestamp: string;
}

interface InstagramApiEdge {
  node?: {
    id?: string;
    shortcode?: string;
    display_url?: string;
    taken_at_timestamp?: number;
    edge_media_to_caption?: {
      edges?: Array<{ node?: { text?: string } }>;
    };
  };
}

let cachedPostsPromise: Promise<InstagramPost[]> | null = null;

function parseApiPayload(payload: unknown): InstagramPost[] {
  const edges =
    (payload as { data?: { user?: { edge_owner_to_timeline_media?: { edges?: InstagramApiEdge[] } } } })
      ?.data?.user?.edge_owner_to_timeline_media?.edges ?? [];

  return edges
    .map((edge) => edge?.node)
    .filter(Boolean)
    .map((node) => {
      const caption = node?.edge_media_to_caption?.edges?.[0]?.node?.text ?? "";
      const shortcode = node?.shortcode ?? "";
      return {
        id: node?.id ?? shortcode,
        shortcode,
        permalink: `https://www.instagram.com/p/${shortcode}/`,
        imageUrl: node?.display_url ?? "",
        caption,
        timestamp: node?.taken_at_timestamp
          ? new Date(node.taken_at_timestamp * 1000).toISOString()
          : new Date(0).toISOString(),
      };
    })
    .filter((post) => post.shortcode && post.imageUrl);
}

function parseHtmlFallback(html: string): InstagramPost[] {
  const sharedDataMatch = html.match(/window\._sharedData\s*=\s*(\{[\s\S]*?\});<\/script>/i);
  if (!sharedDataMatch) return [];

  try {
    const parsed = JSON.parse(sharedDataMatch[1]);
    const edges =
      parsed?.entry_data?.ProfilePage?.[0]?.graphql?.user?.edge_owner_to_timeline_media?.edges ?? [];

    return edges
      .map((edge: InstagramApiEdge) => edge?.node)
      .filter(Boolean)
      .map((node: NonNullable<InstagramApiEdge["node"]>) => {
        const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text ?? "";
        const shortcode = node.shortcode ?? "";
        return {
          id: node.id ?? shortcode,
          shortcode,
          permalink: `https://www.instagram.com/p/${shortcode}/`,
          imageUrl: node.display_url ?? "",
          caption,
          timestamp: node.taken_at_timestamp
            ? new Date(node.taken_at_timestamp * 1000).toISOString()
            : new Date(0).toISOString(),
        };
      })
      .filter((post: InstagramPost) => post.shortcode && post.imageUrl);
  } catch {
    return [];
  }
}

async function fetchInstagramPosts(username: string): Promise<InstagramPost[]> {
  const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        "x-ig-app-id": INSTAGRAM_APP_ID,
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
    });

    if (response.ok) {
      const payload = await response.json();
      const posts = parseApiPayload(payload);
      if (posts.length > 0) return posts;
    }
  } catch {
    // Fallback below.
  }

  try {
    const htmlResponse = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html",
      },
    });

    if (!htmlResponse.ok) return [];
    const html = await htmlResponse.text();
    return parseHtmlFallback(html);
  } catch {
    return [];
  }
}

export async function getInstagramPosts(username: string, limit = 8): Promise<InstagramPost[]> {
  if (!cachedPostsPromise) {
    cachedPostsPromise = fetchInstagramPosts(username);
  }

  const posts = await cachedPostsPromise;
  return posts.slice(0, limit);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export async function getRelevantInstagramPosts(
  username: string,
  context: Array<string | undefined>,
  limit = 6,
): Promise<InstagramPost[]> {
  const posts = await getInstagramPosts(username, 24);
  if (posts.length <= limit) return posts;

  const contextTokens = new Set(tokenize(context.filter(Boolean).join(" ")));
  if (contextTokens.size === 0) return posts.slice(0, limit);

  const scored = posts.map((post, index) => {
    const captionTokens = new Set(tokenize(post.caption));
    let score = 0;

    for (const token of contextTokens) {
      if (captionTokens.has(token)) score += 1;
    }

    return { post, index, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored.slice(0, limit).map((entry) => entry.post);
}
