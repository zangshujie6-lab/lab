#!/usr/bin/env python3
"""Fetch a supplied list of public pages, subject to robots and rate limits.

This harvests leads, not verified comments. No login, captcha, cookies, or
private endpoints are used. A person must inspect every candidate before it
can be marked verified in pipeline.py's formal input.
"""

import argparse
import csv
import hashlib
import json
import time
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib import error, request, robotparser
from urllib.parse import urlparse

AGENT = "YuzhicaiResearch/1.0 (public-page research; contact via project repository)"
ALLOWED = {"微博": "weibo.com", "大众点评": "dianping.com"}


def platform_host(host, platform):
    domain = ALLOWED.get(platform)
    return bool(domain and host and (host == domain or host.endswith("." + domain)))


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_jsonld = False
        self.scripts = []
        self.meta = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self.in_jsonld = True
        elif tag == "meta":
            key = attrs.get("property") or attrs.get("name")
            if key in {"og:description", "description", "og:title"}:
                self.meta[key] = attrs.get("content", "")

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_jsonld = False

    def handle_data(self, data):
        if self.in_jsonld:
            self.scripts.append(data)


def get_robots(host, timeout):
    robots = robotparser.RobotFileParser()
    robots.set_url(f"https://{host}/robots.txt")
    req = request.Request(robots.url, headers={"User-Agent": AGENT})
    with request.urlopen(req, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError(f"robots HTTP {response.status}")
        body = response.read(200_001)
        if len(body) > 200_000:
            raise ValueError("robots exceeds 200 KB limit")
    robots.parse(body.decode("utf-8", errors="replace").splitlines())
    return robots


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("manifest", help="CSV with platform,url,query,restaurant_id,restaurant_name,city")
    ap.add_argument("output_dir")
    ap.add_argument("--delay", type=float, default=3.0, help="minimum seconds between requests per host")
    ap.add_argument("--timeout", type=float, default=12.0)
    args = ap.parse_args()
    if args.delay < 1:
        ap.error("--delay must be at least 1 second")
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    raw = out / "raw_html"
    raw.mkdir(exist_ok=True)
    robots = {}
    last_request = {}
    with open(args.manifest, encoding="utf-8-sig", newline="") as stream:
        entries = list(csv.DictReader(stream))
    with (out / "fetch_log.jsonl").open("w", encoding="utf-8") as log:
        for entry in entries:
            platform = (entry.get("platform") or "").strip()
            url = (entry.get("url") or "").strip()
            parsed = urlparse(url)
            item = {"platform": platform, "url": url, "query": entry.get("query", ""),
                    "collected_at": date.today().isoformat(), "status": "skipped"}
            if parsed.scheme != "https" or not platform_host(parsed.hostname, platform):
                item["reason"] = "invalid platform URL"
                log.write(json.dumps(item, ensure_ascii=False) + "\n")
                continue
            host = parsed.hostname
            try:
                if host not in robots:
                    robots[host] = get_robots(host, args.timeout)
                if not robots[host].can_fetch(AGENT, url):
                    item["reason"] = "robots disallows or cannot be checked"
                    log.write(json.dumps(item, ensure_ascii=False) + "\n")
                    continue
                wait = args.delay - (time.monotonic() - last_request.get(host, -1e10))
                if wait > 0:
                    time.sleep(wait)
                last_request[host] = time.monotonic()
                req = request.Request(url, headers={"User-Agent": AGENT, "Accept": "text/html"})
                with request.urlopen(req, timeout=args.timeout) as response:
                    final_url = response.geturl()
                    if not platform_host(urlparse(final_url).hostname, platform):
                        raise ValueError("redirected off platform")
                    if "text/html" not in response.headers.get("Content-Type", ""):
                        raise ValueError("not HTML")
                    body = response.read(2_000_001)
                    if len(body) > 2_000_000:
                        raise ValueError("page exceeds 2 MB limit")
                digest = hashlib.sha256(body).hexdigest()
                (raw / f"{digest}.html").write_bytes(body)
                parser = PageParser()
                parser.feed(body.decode("utf-8", errors="replace"))
                item.update(status="fetched_unverified", sha256=digest, final_url=final_url,
                            meta=parser.meta, jsonld=parser.scripts,
                            note="Page content is a lead only; inspect original before coding")
            except error.HTTPError as exc:
                item.update(status="stopped", reason=f"HTTP {exc.code}")
                if exc.code in {401, 403, 429}:
                    robots[host].disallow_all = True
            except Exception as exc:
                item.update(status="failed", reason=f"{type(exc).__name__}: {exc}")
            log.write(json.dumps(item, ensure_ascii=False) + "\n")
            log.flush()


if __name__ == "__main__":
    main()
