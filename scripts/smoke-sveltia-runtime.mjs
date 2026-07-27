#!/usr/bin/env node
import assert from "node:assert/strict";

const origin = new URL(process.env.CMS_TEST_URL ?? "http://127.0.0.1:4321");

async function requireResponse(path, expectedType) {
  const url = new URL(path, origin);
  const response = await fetch(url);
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
  assert.match(
    response.headers.get("content-type") ?? "",
    expectedType,
    `${url} returned an unexpected content type`,
  );
  return response.text();
}

const html = await requireResponse("/admin/", /text\/html/i);
assert.match(html, /@sveltia\/cms@0\.164\.2\/dist\/sveltia-cms\.js/);
assert.match(html, /noindex, nofollow/);

const yaml = await requireResponse("/admin/config.yml", /(?:yaml|octet-stream|text\/plain)/i);
assert.match(yaml, /name:\s*github/);
assert.match(yaml, /repo:\s*manikrathee\/lovely-sunday/);
assert.match(yaml, /branch:\s*master/);

console.log(`✓ Sveltia CMS runtime passed at ${new URL("/admin/", origin)}`);
