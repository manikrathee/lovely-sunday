import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { load as loadHtml } from "cheerio";
import { parse as parseYaml } from "yaml";

const root = resolve(import.meta.dirname, "..");
const adminHtmlPath = resolve(root, "public/admin/index.html");
const configPath = resolve(root, "public/admin/config.yml");
const config = parseYaml(readFileSync(configPath, "utf8"));

test("admin loads a pinned Sveltia CMS release", () => {
  const $ = loadHtml(readFileSync(adminHtmlPath, "utf8"));
  const scripts = $("script[src]").toArray().map((node) => $(node).attr("src"));

  assert.deepEqual(scripts, [
    "https://unpkg.com/@sveltia/cms@0.164.2/dist/sveltia-cms.js",
  ]);
  assert.equal($('meta[name="robots"]').attr("content"), "noindex, nofollow");
});

test("GitHub backend targets the production repository and branch", () => {
  assert.equal(config.backend.name, "github");
  assert.equal(config.backend.repo, "manikrathee/lovely-sunday");
  assert.equal(config.backend.branch, "master");
  assert.deepEqual(config.backend.auth_methods, ["token"]);
});

test("entry collections cover every Astro content directory", () => {
  const expected = ["news", "sold", "work"];
  const configured = config.collections
    .filter((collection) => collection.folder)
    .map((collection) => collection.name)
    .sort();

  assert.deepEqual(configured, expected);
  for (const name of expected) {
    const collection = config.collections.find((item) => item.name === name);
    assert.equal(collection.folder, `src/content/${name}`);
    assert.equal(collection.create, true);
    assert.ok(collection.fields.some((field) => field.name === "body"));
  }
});

test("file collection covers every managed page", () => {
  const pageDirectory = resolve(root, "src/content/pages");
  const expected = readdirSync(pageDirectory)
    .filter((name) => name.endsWith(".md"))
    .map((name) => `src/content/pages/${name}`)
    .sort();
  const pages = config.collections.find((collection) => collection.name === "pages");
  const configured = pages.files.map((file) => file.file).sort();

  assert.deepEqual(configured, expected);
  for (const page of pages.files) {
    assert.equal(existsSync(resolve(root, page.file)), true, `${page.file} must exist`);
    assert.ok(page.fields.some((field) => field.name === "title"));
    assert.ok(page.fields.some((field) => field.name === "body"));
  }
});

test("media paths map repository files to public URLs", () => {
  assert.equal(config.media_folder, "public/img");
  assert.equal(config.public_folder, "/img");
  assert.equal(existsSync(resolve(root, config.media_folder)), true);
});
