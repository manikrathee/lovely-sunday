// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import pageMarkdown from "@nuasite/llm-enhancements";
import robotsTxt from "astro-robots-txt";
import compressor from "astro-compressor";
// @ts-expect-error astro-imagetools does not publish declarations in exports map.
import { astroImageTools } from "astro-imagetools";

const site = process.env.SITE_URL ?? "https://example.com";

export default defineConfig({
    site,
    output: "static",
    trailingSlash: "always",
    build: {
        format: "directory",
    },
    integrations: [
        sitemap(),
        pageMarkdown({
            contentDir: "src/content",
            includeStaticPages: true,
            includeFrontmatter: true,
            llmEndpoint: true,
            llmsTxt: true,
        }),
        robotsTxt({
            host: true,
            policy: [{ userAgent: "*", allow: "/" }],
        }),
        astroImageTools,
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
