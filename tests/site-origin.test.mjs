import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("local and deployment defaults use the configured apex production origin", () => {
  const astroConfig = readFileSync(resolve(root, "astro.config.mjs"), "utf8");
  const deployWorkflow = readFileSync(resolve(root, ".github/workflows/deploy.yml"), "utf8");

  assert.match(
    astroConfig,
    /process\.env\.SITE_URL \?\? "https:\/\/lovelysunday\.co"/,
  );
  assert.match(
    deployWorkflow,
    /vars\.SITE_URL \|\| 'https:\/\/lovelysunday\.co'/,
  );
  assert.doesNotMatch(astroConfig, /https:\/\/www\.lovelysunday\.co/);
  assert.doesNotMatch(deployWorkflow, /https:\/\/www\.lovelysunday\.co/);
});
