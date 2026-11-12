#!/usr/bin/env python3
"""Auditable import and coding gate for the Weibo/Dianping comparison.

Reads analyst-supplied platform exports or verified public-page transcripts. It
does not bypass authentication or site access controls.
"""

import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

FIELDS = ["platform", "kind", "url", "record_id", "text", "published_at",
          "collected_at", "query", "restaurant_id", "restaurant_name", "city",
          "source_method", "verified", "topic_codes", "stance",
          "prior_knowledge", "first_person"]
PLATFORMS = {"微博": "weibo.com", "大众点评": "dianping.com"}
TOPICS = {"安全", "价格", "口味", "加工方式", "知情权", "便利", "校园"}
STANCE = {"支持/接受", "反对/不满", "条件接受", "中性/询问", "无法判断"}
KNOWLEDGE = {"事前知道", "事前不知道", "无法判断"}
HINTS = {
    "安全": ["安全", "卫生", "添加剂", "保质期", "过期", "健康"],
    "价格": ["价格", "贵", "便宜", "性价比", "值不值"],
    "口味": ["口味", "好吃", "难吃", "味道", "口感", "新鲜"],
    "加工方式": ["预制", "现炒", "现做", "料理包", "中央厨房", "复热", "加热"],
    "知情权": ["知情", "明示", "公开", "告知", "标注", "隐瞒", "透明"],
    "便利": ["方便", "省时", "快捷", "效率"],
    "校园": ["校园", "学校", "学生", "食堂", "家长"],
}


def read_rows(path):
    path = Path(path)
    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as stream:
            return list(csv.DictReader(stream))
    if path.suffix.lower() in {".jsonl", ".ndjson"}:
        with path.open(encoding="utf-8") as stream:
            return [json.loads(line) for line in stream if line.strip()]
    raise ValueError("Input must be .csv or .jsonl")


def write_csv(path, rows, fields):
    with Path(path).open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def canonical_url(value):
    parsed = urlparse((value or "").strip())
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{parsed.path.rstrip('/')}" if parsed.scheme in {"http", "https"} else ""


def platform_host(host, platform):
    domain = PLATFORMS.get(platform)
    return bool(domain and host and (host == domain or host.endswith("." + domain)))


def record_key(row):
    platform = (row.get("platform") or "").strip()
    rec_id = (row.get("record_id") or "").strip()
    if rec_id:
        return platform, rec_id
    url = canonical_url(row.get("url"))
    text = re.sub(r"\s+", "", row.get("text") or "")
    if url and text:
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:20]
        return platform, f"{url}#{digest}"
    return None


def validate(row, index):
    errors = []
    platform = (row.get("platform") or "").strip()
    if platform not in PLATFORMS:
        errors.append("invalid_platform")
    url = canonical_url(row.get("url"))
    if not url or not platform_host(urlparse(url).hostname, platform):
        errors.append("invalid_platform_url")
    if len((row.get("text") or "").strip()) < 8:
        errors.append("missing_or_short_text")
    for field in ("published_at", "collected_at"):
        try:
            date.fromisoformat((row.get(field) or "").strip()[:10])
        except ValueError:
            errors.append(f"invalid_{field}")
    if (row.get("verified") or "").strip().lower() != "yes":
        errors.append("unverified")
    topics = {x.strip() for x in (row.get("topic_codes") or "").split("|") if x.strip()}
    if not topics or not topics <= TOPICS:
        errors.append("uncoded_or_invalid_topics")
    if (row.get("stance") or "").strip() not in STANCE:
        errors.append("uncoded_or_invalid_stance")
    if (row.get("prior_knowledge") or "").strip() not in KNOWLEDGE:
        errors.append("uncoded_or_invalid_prior_knowledge")
    if (row.get("first_person") or "").strip().lower() not in {"yes", "no", "unclear"}:
        errors.append("uncoded_first_person")
    if not (row.get("source_method") or "").strip():
        errors.append("missing_source_method")
    if platform == "大众点评" and (row.get("city") or "").strip() != "北京":
        errors.append("dianping_outside_beijing_frame")
    if platform == "大众点评" and not (row.get("restaurant_id") or "").strip():
        errors.append("missing_restaurant_id")
    return {"row": index, "errors": errors}


def audit(rows):
    issues = [validate(row, i + 2) for i, row in enumerate(rows)]
    keys = [record_key(row) for row in rows]
    seen = set()
    duplicates = []
    for i, key in enumerate(keys):
        if key in seen:
            duplicates.append(i + 2)
        elif key:
            seen.add(key)
    issue_counts = Counter(error for item in issues for error in item["errors"])
    platform_counts = Counter((row.get("platform") or "").strip() for row in rows)
    valid = [row for row, item, key in zip(rows, issues, keys) if not item["errors"] and key]
    deduped = list({record_key(row): row for row in valid}.values())
    return {
        "input_rows": len(rows),
        "raw_by_platform": dict(platform_counts),
        "valid_unique_by_platform": dict(Counter(row["platform"].strip() for row in deduped)),
        "duplicate_rows": duplicates,
        "issue_counts": dict(issue_counts),
        "row_issues": [item for item in issues if item["errors"]][:100],
    }, deduped


def report(rows, study):
    status, valid = audit(rows)
    minimum = int(study["minimum_verified_coded_per_platform"])
    blockers = []
    if study.get("status") != "frozen" or not study.get("start_date") or not study.get("end_date"):
        blockers.append("采样时间窗口与北京门店抽样框尚未冻结")
    if "待冻结" in study.get("dianping_restaurant_frame", "待冻结"):
        blockers.append("大众点评北京门店抽样框尚未冻结")
    eligible = []
    if study.get("start_date") and study.get("end_date"):
        eligible = [r for r in valid if study["start_date"] <= r["published_at"][:10] <= study["end_date"]]
    else:
        eligible = valid
    by_platform = defaultdict(list)
    for row in eligible:
        by_platform[row["platform"].strip()].append(row)
    for platform in PLATFORMS:
        if len(by_platform[platform]) < minimum:
            blockers.append(f"{platform}合格样本 {len(by_platform[platform])} 条，低于预设 {minimum} 条")
    if blockers:
        return {"status": "blocked", "blockers": blockers, "audit": status,
                "note": "未输出平台议题占比；不得将其他平台或论文汇总数替代。"}
    result = {"status": "ready", "window": [study["start_date"], study["end_date"]],
              "audit": status, "platforms": {}}
    for platform, items in by_platform.items():
        topics = Counter(code for row in items for code in set(row["topic_codes"].split("|")))
        stance = Counter(row["stance"] for row in items)
        knowledge = Counter(row["prior_knowledge"] for row in items)
        result["platforms"][platform] = {"n": len(items),
            "topics": {code: {"n": topics[code], "pct": round(100 * topics[code] / len(items), 2)} for code in sorted(TOPICS)},
            "stance": dict(stance), "prior_knowledge": dict(knowledge)}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("template"); p.add_argument("output")
    p = sub.add_parser("suggest"); p.add_argument("input"); p.add_argument("output")
    p = sub.add_parser("audit"); p.add_argument("input")
    p = sub.add_parser("report"); p.add_argument("input"); p.add_argument("output")
    args = parser.parse_args()
    if args.command == "template":
        write_csv(args.output, [], FIELDS)
        return
    rows = read_rows(args.input)
    if args.command == "suggest":
        out = []
        for row in rows:
            text = row.get("text") or ""
            row = dict(row)
            row["topic_suggestions_not_coded"] = "|".join(topic for topic, words in HINTS.items() if any(word in text for word in words))
            out.append(row)
        write_csv(args.output, out, list(dict.fromkeys(FIELDS + ["topic_suggestions_not_coded"] + list(rows[0].keys() if rows else []))))
        return
    if args.command == "audit":
        print(json.dumps(audit(rows)[0], ensure_ascii=False, indent=2))
        return
    study = json.loads((Path(__file__).parent / "study.json").read_text(encoding="utf-8"))
    result = report(rows, study)
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "blockers": result.get("blockers", [])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
