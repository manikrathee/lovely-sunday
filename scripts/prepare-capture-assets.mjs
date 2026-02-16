import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const mirrorSource = path.join(repoRoot, "capture", "assets", "downloads");
const publicAssetsDir = path.join(repoRoot, "public", "assets");
const mirrorTarget = path.join(publicAssetsDir, "downloads");

await mkdir(publicAssetsDir, { recursive: true });

let shouldCreateLink = true;

try {
  const stat = await lstat(mirrorTarget);

  if (stat.isSymbolicLink()) {
    const existingLink = await readlink(mirrorTarget);
    const resolvedExistingLink = path.resolve(publicAssetsDir, existingLink);

    if (resolvedExistingLink === mirrorSource) {
      shouldCreateLink = false;
      console.log("Mirror asset symlink already configured.");
    }
  }

  if (shouldCreateLink) {
    await rm(mirrorTarget, { recursive: true, force: true });
  }
} catch {
  // Target does not exist yet.
}

if (shouldCreateLink) {
  const relativeSource = path.relative(publicAssetsDir, mirrorSource);
  await symlink(relativeSource, mirrorTarget, "dir");
  console.log(`Created mirror asset symlink: ${mirrorTarget} -> ${relativeSource}`);
}
