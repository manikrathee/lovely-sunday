import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(process.cwd());

const allUrlsPath = resolve(repoRoot, "capture/manifests/all_urls.txt");
const pageJsonDir = resolve(repoRoot, "capture/page_json");

if (!existsSync(allUrlsPath)) {
  console.error(`Manifest file not found: ${allUrlsPath}`);
  process.exit(1);
}

if (!existsSync(pageJsonDir)) {
  console.error(`Page JSON directory not found: ${pageJsonDir}`);
  process.exit(1);
}

const manifestUrls = readFileSync(allUrlsPath, "utf-8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const pageJsonUrls = new Set();

for (const fileName of readdirSync(pageJsonDir)) {
  if (!fileName.endsWith(".json")) {
    continue;
  }

  const json = JSON.parse(readFileSync(resolve(pageJsonDir, fileName), "utf-8"));
  if (!json.url) {
    throw new Error(`Missing 'url' in ${fileName}`);
  }

  pageJsonUrls.add(json.url);
}

const manifestUrlSet = new Set(manifestUrls);
const missingFromCapture = manifestUrls.filter((url) => !pageJsonUrls.has(url));
const extraInCapture = [...pageJsonUrls].filter((url) => !manifestUrlSet.has(url));

if (missingFromCapture.length > 0 || extraInCapture.length > 0) {
  console.error("Route manifest mismatch detected.");
  if (missingFromCapture.length > 0) {
    console.error("Missing page_json entries for:");
    for (const url of missingFromCapture) {
      console.error(` - ${url}`);
    }
  }
  if (extraInCapture.length > 0) {
    console.error("Extra page_json entries not in manifest:");
    for (const url of extraInCapture) {
      console.error(` - ${url}`);
    }
  }
  process.exit(1);
}

console.log(`Route manifest is in sync: ${manifestUrls.length} routes.`);
