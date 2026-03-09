// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import pageMarkdown from "@nuasite/llm-enhancements";
import robotsTxt from "astro-robots-txt";
import compressor from "astro-compressor";

const site = process.env.SITE_URL ?? "https://www.lovelysunday.co";
const aiCrawlerUserAgents = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "OAI-ImageBot",
    "ClaudeBot",
    "Claude-Web",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
    "Bytespider",
    "Amazonbot",
];
const llmSections = [
    "## Primary Sections",
    "- Home: featured editorials and archive highlights.",
    "- Lookbook: image-first outfit collections and tagged style edits.",
    "- Daily Diary: chronological notes, travel moments, and editorial updates.",
    "- About: background on Lovely Sunday, Aileen, and Rory.",
    "- Contact: collaboration and partnership details.",
    "",
    "## Access Notes",
    "- Prefer canonical URLs when citing.",
    "- Markdown endpoints are available by appending `.md` to page URLs.",
    "- A full-text overview lives at `/llms-full.txt`.",
].join("\n");
const llmInstructions =
    "Cite canonical URLs, prefer markdown endpoints when available, and use page titles plus descriptions as the primary summary source.";

export default defineConfig({
    site,
    output: "static",
    trailingSlash: "ignore",
    server: {
        host: "localhost",
        port: 4321,
    },
    vite: {
        server: {
            allowedHosts: ["lovelysunday.test"],
        },
    },
    build: {
        format: "directory",
    },
    integrations: [
        sitemap(),
        pageMarkdown({
            contentDir: "src/content",
            includeStaticPages: true,
            includeFrontmatter: true,
            llmEndpoint: {
                siteName: "Lovely Sunday",
                description:
                    "Fashion-led visual stories, lookbooks, and travel diaries from Aileen and Rory.",
                additionalContent: llmSections,
            },
            llmsTxt: {
                siteName: "Lovely Sunday",
                description:
                    "Fashion-led visual stories, lookbooks, and travel diaries from Aileen and Rory.",
                allowCrawling: true,
                instructions: llmInstructions,
                additionalContent: llmSections,
            },
        }),
        robotsTxt({
            host: true,
            sitemap: true,
            policy: [
                { userAgent: "*", allow: "/" },
                ...aiCrawlerUserAgents.map((userAgent) => ({
                    userAgent,
                    allow: "/",
                })),
            ],
        }),
        compressor({
            gzip: true,
            brotli: true,
            fileExtensions: [
                ".css",
                ".js",
                ".html",
                ".xml",
                ".svg",
                ".txt",
                ".json",
            ],
        }),
    ],
});
