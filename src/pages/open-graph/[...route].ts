import { getCollection } from "astro:content";
import { OGImageRoute } from "astro-og-canvas";

type OgPage = {
    title?: string;
    description?: string;
};

type CollectionLike = Array<{
    slug: string;
    data: OgPage;
}>;

const pagesCollection = await getCollection("pages");
const newsCollection = await getCollection("news");
const workCollection = await getCollection("work");
const soldCollection = await getCollection("sold");

const mapCollection = (
    entries: CollectionLike,
    prefix: "news" | "work" | "sold",
) =>
    Object.fromEntries(
        entries.map((entry) => [
            `${prefix}/${entry.slug}`,
            {
                title: entry.data.title,
                description: entry.data.description,
            },
        ]),
    );

const allPages: Record<string, OgPage> = Object.fromEntries(
    pagesCollection.map((entry) => [
        entry.slug,
        {
            title: entry.data.title,
            description: entry.data.description,
        },
    ]),
);

const pages: Record<string, OgPage> = {
    index: allPages.index ?? {
        title: "Clay Astro",
        description: "A minimalist, image-first photoblog.",
    },
    ...Object.fromEntries(
        Object.entries(allPages).filter(([slug]) => slug !== "index"),
    ),
    ...mapCollection(newsCollection, "news"),
    ...mapCollection(workCollection, "work"),
    ...mapCollection(soldCollection, "sold"),
    "contact/thanks": {
        title: "Thanks for reaching out",
        description: "Your message has been received.",
    },
};

export const { getStaticPaths, GET } = await OGImageRoute({
    param: "route",
    pages,
    getImageOptions: (_path, page) => ({
        title: page.title ?? "Clay Astro",
        description: page.description,
        bgGradient: [
            [31, 26, 22],
            [89, 73, 56],
        ],
        border: {
            color: [213, 181, 134],
            width: 14,
            side: "inline-start",
        },
    }),
});
