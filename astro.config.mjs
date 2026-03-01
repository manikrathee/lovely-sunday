// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import pageMarkdown from "@nuasite/llm-enhancements";
import robotsTxt from "astro-robots-txt";
import compressor from "astro-compressor";

const site = process.env.SITE_URL ?? "https://example.com";

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
            llmEndpoint: true,
            llmsTxt: true,
        }),
        robotsTxt({
            host: true,
            policy: [{ userAgent: "*", allow: "/" }],
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
