#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const MANIFEST_URL_FILE = process.env.MANIFEST_URL_FILE ?? 'capture/manifests/all_urls.txt';
const VERIFY_BASE_URL = process.env.VERIFY_BASE_URL ?? process.env.SITE_URL ?? '';
const REPORT_FILE = process.env.VERIFICATION_REPORT_FILE ?? 'capture/manifests/post_deploy_verification_report.json';
const CONCURRENCY = Number(process.env.VERIFICATION_CONCURRENCY ?? '8');
const TIMEOUT_MS = Number(process.env.VERIFICATION_TIMEOUT_MS ?? '15000');

if (!VERIFY_BASE_URL) {
  console.error('[verify] VERIFY_BASE_URL (or SITE_URL) is required.');
  process.exit(1);
}

const baseUrl = new URL(VERIFY_BASE_URL.endsWith('/') ? VERIFY_BASE_URL : `${VERIFY_BASE_URL}/`);

const parseManifest = async () => {
  const raw = await readFile(MANIFEST_URL_FILE, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = [];
  for (const source of lines) {
    try {
      const sourceUrl = new URL(source);
      const target = new URL(sourceUrl.pathname + sourceUrl.search, baseUrl);
      entries.push({ source, target: target.toString() });
    } catch {
      console.warn(`[verify] SKIP invalid URL in manifest: ${source}`);
    }
  }
  return entries;
};

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'lovely-sunday-post-deploy-verifier/1.0',
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const runPool = async (urls) => {
  const results = new Array(urls.length);
  let index = 0;

  const worker = async () => {
    while (index < urls.length) {
      const current = index;
      index += 1;
      const item = urls[current];
      const outcome = await fetchWithTimeout(item.target);
      results[current] = { ...item, ...outcome };
      const mark = outcome.ok ? 'OK' : 'FAIL';
      console.log(`[verify] ${mark} ${outcome.status} ${item.target}`);
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker());
  await Promise.all(workers);

  return results;
};

const urls = await parseManifest();
const results = await runPool(urls);
const failed = results.filter((item) => !item.ok);

const summary = {
  checkedAt: new Date().toISOString(),
  manifestFile: MANIFEST_URL_FILE,
  verifyBaseUrl: baseUrl.toString(),
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
};

const report = { summary, failed, results };
const reportPath = resolve(REPORT_FILE);
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`[verify] Wrote report to ${REPORT_FILE}`);
console.log(`[verify] Passed ${summary.passed}/${summary.total}`);

if (failed.length > 0) {
  process.exit(1);
}
