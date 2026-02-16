#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import mimetypes
import os
import pathlib
import re
import subprocess
import threading
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

ALLOWED_HOSTS = {"www.lovelysunday.co", "lovelysunday.co"}
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
)
DESKTOP_VIEWPORT = (1440, 900)
MOBILE_VIEWPORT = (390, 844)
STATIC_EXTENSIONS = {
    ".css",
    ".js",
    ".mjs",
    ".json",
    ".xml",
    ".map",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".avif",
    ".svg",
    ".ico",
    ".bmp",
    ".tif",
    ".tiff",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".mp4",
    ".webm",
    ".mov",
    ".mp3",
    ".m4a",
    ".wav",
    ".pdf",
}
STATIC_HOST_ALLOWLIST = {
    # Legacy platform CDN hosts (source site assets).
    "assets.squarespace.com",
    "images.squarespace-cdn.com",
    "static1.squarespace.com",
    "definitions.sqspcdn.com",
    "use.typekit.com",
    "p.typekit.net",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "ajax.googleapis.com",
    "maps.gstatic.com",
}
RUNTIME_HOST_BLOCKLIST = {
    "featureassets.org",
    "prodregistryv2.org",
    "cdn.mxpnl.com",
    "www.google-analytics.com",
    "www.googletagmanager.com",
    "log.pinterest.com",
    "graph.facebook.com",
    "clanker-events.squarespace.com",  # Legacy platform telemetry.
}

ASSET_INITIATOR_ALLOWLIST = {"img", "image", "link", "script", "css", "font", "video", "audio"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_text(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: pathlib.Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_json(path: pathlib.Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run_cmd(
    cmd: list[str],
    env: dict[str, str],
    timeout: int = 180,
    check: bool = True,
) -> str:
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env,
        timeout=timeout,
        errors="replace",
    )
    if check and proc.returncode != 0:
        raise RuntimeError(
            f"command failed ({proc.returncode}): {' '.join(cmd)}\n"
            f"stderr: {proc.stderr.strip()}"
        )
    return proc.stdout.strip()


def agent_browser(session: str, args: list[str], env: dict[str, str], timeout: int = 180) -> str:
    cmd = ["agent-browser", "--session", session, *args]
    return run_cmd(cmd, env=env, timeout=timeout, check=True)


def normalize_url(raw: str, *, default_scheme: str = "https", force_https: bool = False) -> str | None:
    value = (raw or "").strip()
    if not value:
        return None

    parsed = urllib.parse.urlparse(value)
    if not parsed.scheme:
        if parsed.netloc:
            parsed = parsed._replace(scheme=default_scheme)
        else:
            parsed = urllib.parse.urlparse(f"{default_scheme}://{value}")
    if not parsed.netloc:
        return None

    host = parsed.hostname.lower() if parsed.hostname else ""
    if not host:
        return None
    if not re.fullmatch(r"[a-z0-9.-]+", host):
        return None

    scheme = "https" if force_https else (parsed.scheme.lower() if parsed.scheme else default_scheme.lower())
    port = f":{parsed.port}" if parsed.port else ""
    if (scheme == "http" and parsed.port == 80) or (scheme == "https" and parsed.port == 443):
        port = ""
    netloc = f"{host}{port}"

    path = parsed.path or "/"
    if not path.startswith("/"):
        path = "/" + path
    if path != "/" and path.endswith("/"):
        path = path[:-1]

    normalized = urllib.parse.urlunparse(
        (
            scheme,
            netloc,
            path,
            "",
            parsed.query,
            "",
        )
    )
    return normalized


def normalize_crawl_url(raw: str) -> str | None:
    # Canonicalize crawl inventory to HTTPS to avoid duplicate HTTP/HTTPS page fetches.
    return normalize_url(raw, force_https=True)


def looks_like_static_url(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path or ""
    suffix = pathlib.Path(path).suffix.lower()
    if suffix in STATIC_EXTENSIONS:
        return True
    if (parsed.hostname or "").lower() == "images.squarespace-cdn.com" and "/content/" in path:
        return True
    if (parsed.hostname or "").lower() in {"fonts.googleapis.com", "use.typekit.com"} and "/css" in path:
        return True
    return False


def classify_asset_url(resource_url: str, initiator_type: str | None) -> tuple[bool, str]:
    parsed = urllib.parse.urlparse(resource_url)
    scheme = (parsed.scheme or "").lower()
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    initiator = (initiator_type or "").lower()

    if scheme and scheme not in {"http", "https"}:
        return False, "unsupported_scheme"
    if not host:
        return False, "missing_host"
    if host in RUNTIME_HOST_BLOCKLIST:
        return False, "runtime_host_blocklist"
    if host in ALLOWED_HOSTS and path.startswith("/api/"):
        return False, "internal_api_endpoint"
    if host in STATIC_HOST_ALLOWLIST:
        return True, "static_host_allowlist"
    if looks_like_static_url(resource_url):
        return True, "static_extension_or_provider_rule"
    if initiator in ASSET_INITIATOR_ALLOWLIST and "/api/" not in path:
        return True, "asset_initiator_allowlist"
    return False, "non_static_or_outbound"


def resource_entry_download_candidate(resource_url: str, initiator_type: str | None) -> bool:
    include, _ = classify_asset_url(resource_url, initiator_type)
    return include


def is_internal(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname.lower() if parsed.hostname else ""
    return host in ALLOWED_HOSTS


def page_id_from_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path.strip("/")
    if not path:
        path = "home"
    if parsed.query:
        path = f"{path}-{parsed.query}"
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", path).strip("-").lower() or "home"
    slug = slug[:72]
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]
    return f"{slug}-{digest}"


def sanitize_segment(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("._")
    return cleaned or "file"


def fetch_url(url: str, timeout: int = 90) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        return resp.read()


def parse_sitemap_urls(xml_bytes: bytes) -> list[str]:
    root = ET.fromstring(xml_bytes)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    loc_nodes = root.findall(".//sm:url/sm:loc", ns)
    urls = []
    for node in loc_nodes:
        if node.text:
            normalized = normalize_crawl_url(node.text)
            if normalized:
                urls.append(normalized)
    return sorted(set(urls))


def collect_nav_urls(site_url: str, nav_js: str, env: dict[str, str]) -> list[str]:
    session = "nav-inventory"
    agent_browser(session, ["open", site_url], env=env, timeout=120)
    raw = agent_browser(session, ["eval", nav_js], env=env, timeout=120)
    parsed = json.loads(raw)
    if isinstance(parsed, str):
        parsed = json.loads(parsed)
    urls = []
    for value in parsed:
        normalized = normalize_crawl_url(value)
        if normalized and is_internal(normalized):
            urls.append(normalized)
    return sorted(set(urls))


def set_viewport(session: str, width: int, height: int, env: dict[str, str]) -> None:
    agent_browser(session, ["set", "viewport", str(width), str(height)], env=env, timeout=45)


def crawl_worker(
    worker_id: int,
    urls: list[str],
    page_js: str,
    output: pathlib.Path,
    env: dict[str, str],
    progress_lock: threading.Lock,
) -> list[dict[str, Any]]:
    session = f"agent-{worker_id}"
    records: list[dict[str, Any]] = []

    for index, url in enumerate(urls, start=1):
        record: dict[str, Any] = {
            "worker": worker_id,
            "url": url,
            "requestedAt": utc_now(),
            "status": "error",
        }
        page_id = page_id_from_url(url)
        record["pageId"] = page_id

        desktop_png = output / "screenshots" / "desktop" / f"{page_id}.png"
        mobile_png = output / "screenshots" / "mobile" / f"{page_id}.png"
        html_file = output / "raw_html" / f"{page_id}.html"
        json_file = output / "page_json" / f"{page_id}.json"
        desktop_png_rel = desktop_png.relative_to(output).as_posix()
        mobile_png_rel = mobile_png.relative_to(output).as_posix()
        html_file_rel = html_file.relative_to(output).as_posix()
        json_file_rel = json_file.relative_to(output).as_posix()

        try:
            set_viewport(session, *DESKTOP_VIEWPORT, env=env)
            agent_browser(session, ["open", url], env=env, timeout=150)
            agent_browser(session, ["wait", "1200"], env=env, timeout=45)
            agent_browser(session, ["screenshot", "--full", str(desktop_png)], env=env, timeout=180)

            html = agent_browser(session, ["get", "html", "html"], env=env, timeout=150)
            write_text(html_file, html + ("\n" if not html.endswith("\n") else ""))

            page_raw = agent_browser(session, ["eval", page_js], env=env, timeout=180)
            page_data = json.loads(page_raw)

            set_viewport(session, *MOBILE_VIEWPORT, env=env)
            agent_browser(session, ["screenshot", "--full", str(mobile_png)], env=env, timeout=180)
            set_viewport(session, *DESKTOP_VIEWPORT, env=env)
            page_data["_capture"] = {
                "requestedUrl": url,
                "pageId": page_id,
                "worker": worker_id,
                "capturedAt": utc_now(),
                "desktopScreenshot": desktop_png_rel,
                "mobileScreenshot": mobile_png_rel,
                "rawHtmlFile": html_file_rel,
            }
            write_json(json_file, page_data)

            record["status"] = "success"
            record["jsonFile"] = json_file_rel
            record["rawHtmlFile"] = html_file_rel
            record["desktopScreenshot"] = desktop_png_rel
            record["mobileScreenshot"] = mobile_png_rel
            record["finalUrl"] = page_data.get("url")
            record["title"] = page_data.get("title")
            record["counts"] = page_data.get("counts", {})
        except Exception as exc:  # noqa: BLE001
            record["error"] = str(exc)

        records.append(record)
        with progress_lock:
            print(f"[crawl] worker={worker_id} page={index}/{len(urls)} status={record['status']} url={url}")

    return records


def collect_asset_urls(page_json_files: list[pathlib.Path]) -> list[str]:
    urls: set[str] = set()

    def add(value: Any, initiator_hint: str | None = None) -> None:
        if isinstance(value, list):
            for item in value:
                add(item, initiator_hint)
            return
        if not isinstance(value, str):
            return
        normalized = normalize_url(value)
        if normalized:
            include, _ = classify_asset_url(normalized, initiator_hint)
            if include:
                urls.add(normalized)

    for page_file in page_json_files:
        data = json.loads(read_text(page_file))
        for image in data.get("images", []):
            add(image.get("src"), "image")
            add(image.get("srcset", []), "image")
        for video in data.get("videos", []):
            add(video.get("src"), "video")
        for script in data.get("scripts", []):
            add(script.get("src"), "script")
        for stylesheet in data.get("stylesheets", []):
            add(stylesheet.get("href"), "css")
        add(data.get("icons", []), "image")
        for resource in data.get("resourceEntries", []):
            name = resource.get("name")
            initiator = resource.get("initiatorType")
            if isinstance(name, str) and resource_entry_download_candidate(name, initiator):
                add(name, initiator)
        add(data.get("openGraph", {}).get("image"), "image")
        add(data.get("twitter", {}).get("image"), "image")

    return sorted(urls)


def asset_target_path(root: pathlib.Path, url: str, content_type: str | None) -> pathlib.Path:
    parsed = urllib.parse.urlparse(url)
    host = sanitize_segment(parsed.netloc or "unknown-host")

    parts = [sanitize_segment(part) for part in parsed.path.split("/") if part and part not in {".", ".."}]
    if not parts:
        parts = ["index"]
    if parsed.path.endswith("/"):
        parts.append("index")

    filename = parts[-1]
    suffix = pathlib.Path(filename).suffix
    if not suffix and content_type:
        guessed = mimetypes.guess_extension(content_type.split(";")[0].strip().lower() or "")
        if guessed:
            filename = f"{filename}{guessed}"
            parts[-1] = filename

    if parsed.query:
        qhash = hashlib.sha1(parsed.query.encode("utf-8")).hexdigest()[:8]
        stem = pathlib.Path(parts[-1]).stem
        ext = pathlib.Path(parts[-1]).suffix
        parts[-1] = f"{stem}__q{qhash}{ext}"

    return root / host / pathlib.Path(*parts)


def download_one_asset(url: str, download_root: pathlib.Path, output_root: pathlib.Path) -> dict[str, Any]:
    started_at = utc_now()
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:  # noqa: S310
            body = resp.read()
            status = getattr(resp, "status", 200)
            content_type = resp.headers.get("Content-Type", "")
        target = asset_target_path(download_root, url, content_type)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        digest = hashlib.sha256(body).hexdigest()
        return {
            "url": url,
            "status": "success",
            "httpStatus": status,
            "contentType": content_type,
            "bytes": len(body),
            "sha256": digest,
            "file": target.relative_to(output_root).as_posix(),
            "startedAt": started_at,
            "completedAt": utc_now(),
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "url": url,
            "status": "error",
            "error": str(exc),
            "startedAt": started_at,
            "completedAt": utc_now(),
        }


def verify_worker(
    worker_id: int,
    urls: list[str],
    verify_js: str,
    env: dict[str, str],
    progress_lock: threading.Lock,
) -> list[dict[str, Any]]:
    session = f"verify-{worker_id}"
    records: list[dict[str, Any]] = []

    for index, url in enumerate(urls, start=1):
        item: dict[str, Any] = {"url": url, "worker": worker_id, "status": "error"}
        try:
            set_viewport(session, *DESKTOP_VIEWPORT, env=env)
            agent_browser(session, ["open", url], env=env, timeout=150)
            agent_browser(session, ["wait", "1200"], env=env, timeout=45)
            raw = agent_browser(session, ["eval", verify_js], env=env, timeout=120)
            item["live"] = json.loads(raw)
            item["status"] = "success"
        except Exception as exc:  # noqa: BLE001
            item["error"] = str(exc)

        records.append(item)
        with progress_lock:
            print(f"[verify] worker={worker_id} page={index}/{len(urls)} status={item['status']} url={url}")

    return records


def compare_live_to_capture(
    crawl_records: list[dict[str, Any]],
    verify_records: list[dict[str, Any]],
    output_root: pathlib.Path,
) -> dict[str, Any]:
    by_url: dict[str, dict[str, Any]] = {}
    for record in crawl_records:
        if record.get("status") == "success":
            by_url[record["url"]] = record

    mismatches = []
    matches = 0
    errors = 0

    for verify_item in verify_records:
        url = verify_item["url"]
        if verify_item.get("status") != "success":
            errors += 1
            mismatches.append({"url": url, "status": "verify_error", "error": verify_item.get("error")})
            continue

        crawl_record = by_url.get(url)
        if not crawl_record:
            errors += 1
            mismatches.append({"url": url, "status": "missing_capture_record"})
            continue

        page_file = pathlib.Path(crawl_record["jsonFile"])
        if not page_file.is_absolute():
            page_file = output_root / page_file
        captured = json.loads(read_text(page_file))
        live = verify_item["live"]

        issues = []
        if (captured.get("title") or "").strip() != (live.get("title") or "").strip():
            issues.append("title")
        if normalize_url(captured.get("canonical") or "") != normalize_url(live.get("canonical") or ""):
            issues.append("canonical")
        captured_h1 = [h.strip() for h in captured.get("headings", {}).get("h1", []) if h and h.strip()]
        live_h1 = [h.strip() for h in live.get("h1", []) if h and h.strip()]
        if captured_h1 != live_h1:
            issues.append("h1")
        if captured.get("counts", {}).get("images") != live.get("imageCount"):
            issues.append("imageCount")

        if issues:
            mismatches.append(
                {
                    "url": url,
                    "status": "mismatch",
                    "fields": issues,
                    "captured": {
                        "title": captured.get("title"),
                        "canonical": captured.get("canonical"),
                        "h1": captured_h1,
                        "imageCount": captured.get("counts", {}).get("images"),
                    },
                    "live": {
                        "title": live.get("title"),
                        "canonical": live.get("canonical"),
                        "h1": live_h1,
                        "imageCount": live.get("imageCount"),
                    },
                }
            )
        else:
            matches += 1

    return {
        "summary": {
            "totalChecked": len(verify_records),
            "matches": matches,
            "mismatches": len([m for m in mismatches if m.get("status") == "mismatch"]),
            "errors": errors,
        },
        "details": mismatches,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Headless Chrome crawler for lovelysunday.co")
    parser.add_argument("--site", default="https://www.lovelysunday.co/", help="Base site URL")
    parser.add_argument("--workers", type=int, default=4, help="Parallel agent workers")
    parser.add_argument("--asset-workers", type=int, default=8, help="Parallel asset download workers")
    parser.add_argument("--output", default="", help="Output directory (default: capture/lovelysunday-<timestamp>)")
    return parser.parse_args()


def build_asset_filter_rules() -> dict[str, Any]:
    return {
        "generatedAt": utc_now(),
        "runtimeHostBlocklist": sorted(RUNTIME_HOST_BLOCKLIST),
        "staticHostAllowlist": sorted(STATIC_HOST_ALLOWLIST),
        "allowedAssetInitiatorTypes": sorted(ASSET_INITIATOR_ALLOWLIST),
        "rules": [
            {
                "id": "reject_runtime_hosts",
                "result": "exclude",
                "description": "Block telemetry/API providers that are runtime-only and not static mirror candidates.",
            },
            {
                "id": "reject_internal_api_paths",
                "result": "exclude",
                "description": "Block first-party /api/ endpoints from static asset mirroring.",
            },
            {
                "id": "allow_known_static_hosts",
                "result": "include",
                "description": "Allow static CDNs and font providers used by captured pages.",
            },
            {
                "id": "allow_static_extension_or_provider_pattern",
                "result": "include",
                "description": "Allow URLs that match known static extensions/provider patterns.",
            },
            {
                "id": "allow_asset_initiator_types",
                "result": "include",
                "description": "Allow non-API resources discovered via static asset initiator types.",
            },
            {
                "id": "exclude_non_static_or_outbound",
                "result": "exclude",
                "description": "Exclude unresolved non-static URLs so outbound destinations remain outbound links.",
            },
        ],
        "recheckSource": "capture/manifests/failed_url_recheck_report.json",
    }


def main() -> int:
    args = parse_args()
    start = time.time()

    scripts_dir = pathlib.Path(__file__).resolve().parent
    capture_root = scripts_dir.parent
    repo_root = capture_root.parent
    output_dir = pathlib.Path(args.output) if args.output else (capture_root / f"lovelysunday-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
    for rel in [
        "manifests",
        "logs",
        "raw_html",
        "page_json",
        "screenshots/desktop",
        "screenshots/mobile",
        "assets/downloads",
    ]:
        (output_dir / rel).mkdir(parents=True, exist_ok=True)

    env = dict(os.environ)
    env["HOME"] = "/tmp"

    nav_js = read_text(scripts_dir / "nav_extract.js")
    page_js = read_text(scripts_dir / "page_extract.js")
    verify_js = read_text(scripts_dir / "page_verify.js")

    site_url = normalize_url(args.site) or "https://www.lovelysunday.co/"
    sitemap_url = urllib.parse.urljoin(site_url, "/sitemap.xml")
    print(f"[start] site={site_url} workers={args.workers} output={output_dir}")

    sitemap_bytes = fetch_url(sitemap_url)
    write_text(output_dir / "manifests" / "sitemap.xml", sitemap_bytes.decode("utf-8", errors="replace"))
    sitemap_urls = parse_sitemap_urls(sitemap_bytes)
    write_text(output_dir / "manifests" / "sitemap_urls.txt", "\n".join(sitemap_urls) + "\n")
    print(f"[inventory] sitemap URLs: {len(sitemap_urls)}")

    nav_urls = collect_nav_urls(site_url, nav_js, env=env)
    write_text(output_dir / "manifests" / "nav_urls.txt", "\n".join(nav_urls) + "\n")
    print(f"[inventory] nav URLs (internal): {len(nav_urls)}")

    all_urls = sorted(set(sitemap_urls + nav_urls))
    write_text(output_dir / "manifests" / "all_urls.txt", "\n".join(all_urls) + "\n")
    print(f"[inventory] total canonical URLs: {len(all_urls)}")

    chunks = [all_urls[i :: max(args.workers, 1)] for i in range(max(args.workers, 1))]
    progress_lock = threading.Lock()

    crawl_records: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(args.workers, 1)) as executor:
        futures = []
        for worker_id, chunk in enumerate(chunks, start=1):
            if not chunk:
                continue
            futures.append(
                executor.submit(
                    crawl_worker,
                    worker_id,
                    chunk,
                    page_js,
                    output_dir,
                    env,
                    progress_lock,
                )
            )
        for future in concurrent.futures.as_completed(futures):
            crawl_records.extend(future.result())

    crawl_records.sort(key=lambda item: item["url"])
    write_json(output_dir / "manifests" / "crawl_results.json", {"generatedAt": utc_now(), "pages": crawl_records})
    successful = [item for item in crawl_records if item.get("status") == "success"]
    failed = [item for item in crawl_records if item.get("status") != "success"]
    print(f"[crawl] success={len(successful)} failed={len(failed)}")

    page_json_files = [output_dir / pathlib.Path(item["jsonFile"]) for item in successful if item.get("jsonFile")]
    asset_urls = collect_asset_urls(page_json_files)
    write_text(output_dir / "manifests" / "asset_urls.txt", "\n".join(asset_urls) + "\n")
    write_json(output_dir / "manifests" / "asset_filter_rules.json", build_asset_filter_rules())
    print(f"[assets] unique URLs queued for download: {len(asset_urls)}")

    download_root = output_dir / "assets" / "downloads"
    asset_records: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(args.asset_workers, 1)) as executor:
        futures = [executor.submit(download_one_asset, url, download_root, output_dir) for url in asset_urls]
        for future in concurrent.futures.as_completed(futures):
            asset_records.append(future.result())
    asset_records.sort(key=lambda item: item["url"])
    write_json(
        output_dir / "manifests" / "assets_manifest.json",
        {
            "generatedAt": utc_now(),
            "summary": {
                "total": len(asset_records),
                "success": len([item for item in asset_records if item.get("status") == "success"]),
                "failed": len([item for item in asset_records if item.get("status") != "success"]),
            },
            "assets": asset_records,
        },
    )

    verify_records: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(args.workers, 1)) as executor:
        futures = []
        for worker_id, chunk in enumerate(chunks, start=1):
            if not chunk:
                continue
            futures.append(executor.submit(verify_worker, worker_id, chunk, verify_js, env, progress_lock))
        for future in concurrent.futures.as_completed(futures):
            verify_records.extend(future.result())
    verify_records.sort(key=lambda item: item["url"])
    write_json(output_dir / "manifests" / "verification_live_snapshots.json", {"pages": verify_records})

    verification_report = compare_live_to_capture(crawl_records, verify_records, output_dir)
    write_json(output_dir / "manifests" / "verification_report.json", verification_report)

    try:
        output_dir_display = output_dir.relative_to(repo_root).as_posix()
    except ValueError:
        output_dir_display = output_dir.as_posix()

    summary = {
        "generatedAt": utc_now(),
        "durationSeconds": round(time.time() - start, 2),
        "site": site_url,
        "inventory": {
            "sitemapUrls": len(sitemap_urls),
            "navUrls": len(nav_urls),
            "canonicalUrls": len(all_urls),
        },
        "crawl": {
            "success": len(successful),
            "failed": len(failed),
        },
        "assets": {
            "queued": len(asset_urls),
            "downloaded": len([item for item in asset_records if item.get("status") == "success"]),
            "failed": len([item for item in asset_records if item.get("status") != "success"]),
        },
        "verification": verification_report["summary"],
        "outputDir": output_dir_display,
    }
    write_json(output_dir / "manifests" / "summary.json", summary)

    print("[done] summary")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
