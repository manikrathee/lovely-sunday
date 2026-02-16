import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf-8"));

const summary = await readJson("capture/manifests/summary.json");
const assetsManifest = await readJson("capture/manifests/assets_manifest.json");
const failedRecheck = await readJson(
  "capture/manifests/failed_url_recheck_report.json",
);

const expectedQueued = summary.assets?.queued;
const expectedDownloaded = summary.assets?.downloaded;
const manifestTotal = assetsManifest.summary?.total;
const manifestSuccess = assetsManifest.summary?.success;

if (expectedQueued !== manifestTotal) {
  throw new Error(
    `Mismatch: summary.assets.queued=${expectedQueued} but manifest.summary.total=${manifestTotal}`,
  );
}

if (expectedDownloaded !== manifestSuccess) {
  throw new Error(
    `Mismatch: summary.assets.downloaded=${expectedDownloaded} but manifest.summary.success=${manifestSuccess}`,
  );
}

const successfulAssets = assetsManifest.assets.filter(
  (entry) => entry.status === "success",
);

let missingAssetCount = 0;
for (const entry of successfulAssets) {
  if (!entry.file?.startsWith("assets/downloads/")) {
    throw new Error(
      `Asset is not wired to capture/assets/downloads: ${entry.url} -> ${entry.file}`,
    );
  }

  const fullPath = path.join(repoRoot, "capture", entry.file);

  try {
    await access(fullPath);
  } catch {
    missingAssetCount += 1;
  }
}

const mirroredAssetUrls = new Set(assetsManifest.assets.map((entry) => entry.url));
const outboundEntries = failedRecheck.entries.filter(
  (entry) => entry.recheck_status === "outbound_link_not_static_asset",
);

for (const entry of outboundEntries) {
  if (mirroredAssetUrls.has(entry.url)) {
    throw new Error(
      `Outbound link should remain external but is present in asset manifest: ${entry.url}`,
    );
  }
}

const foundAssetCount = successfulAssets.length - missingAssetCount;

if (strict && missingAssetCount > 0) {
  throw new Error(
    `Strict mode failed: ${missingAssetCount} mirrored asset file(s) are missing from capture/assets/downloads.`,
  );
}

console.log(`Manifest totals match summary (${manifestTotal} assets).`);
console.log(
  `Mirror coverage on disk: ${foundAssetCount}/${successfulAssets.length} assets present${strict ? "" : " (informational)"}.`,
);
console.log(
  `Validated ${outboundEntries.length} outbound shopping/social links remain external.`,
);
