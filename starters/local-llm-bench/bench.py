#!/usr/bin/env python3
"""Local LLM Bench — run a synthetic IT task pack against an OpenAI-compatible endpoint."""
import argparse
import hashlib
import json
import math
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from urllib.parse import urlparse

import client
import export
import grader
import pricing

ROOT = Path(__file__).resolve().parent
DEFAULT_COMPARE = "gpt-4o-mini,claude-haiku-4-5,gemini-2.5-flash"


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_tasks(tasks_dir, only=None, max_tasks=None):
    path = Path(tasks_dir)
    files = sorted(p for p in path.glob("*.json") if p.is_file())
    if not files:
        raise SystemExit("no task JSON files in %s" % path)
    wanted = {p.strip() for p in only.split(",") if p.strip()} if only else None
    tasks, used = [], []
    for fp in files:
        with fp.open(encoding="utf-8") as f:
            task = json.load(f)
        task["id"] = task.get("id") or fp.stem
        if wanted is not None and task["id"] not in wanted:
            continue
        tasks.append(task)
        used.append(fp)
        if max_tasks and len(tasks) >= max_tasks:
            break
    if wanted is not None:
        missing = wanted - {t["id"] for t in tasks}
        if missing:
            raise SystemExit("unknown --only id(s): %s" % ", ".join(sorted(missing)))
    return tasks, used


def task_pack_hash(files):
    h = hashlib.sha256()
    for fp in sorted(files, key=lambda p: p.name):
        h.update(fp.name.encode("utf-8") + b"\0")
        h.update(fp.read_bytes())
    return h.hexdigest()


def public_url(url):
    """Scheme, host, port and path only, so credentials or query strings never reach exports."""
    parsed = urlparse(url)
    if not parsed.scheme:
        return url
    netloc = parsed.hostname or ""
    if parsed.port:
        netloc += ":%d" % parsed.port
    return "%s://%s%s" % (parsed.scheme, netloc, parsed.path.rstrip("/"))


def build_messages(task):
    messages = []
    if task.get("system"):
        messages.append({"role": "system", "content": task["system"]})
    user = task.get("prompt") or ""
    extra = task.get("input")
    if extra:
        user = (user + "\n\n" + extra) if user else extra
    messages.append({"role": "user", "content": user})
    return messages


def no_backend_message():
    return (
        "No local OpenAI-compatible server found.\n\n"
        "Tried, in order:\n"
        + "".join("  %-10s %s\n" % (name, url) for name, url in client.CANDIDATES)
        + "\n"
        "Start one of those, or pass --base-url and --model.\n"
        "See HOW-TO-RUN.md for copy-paste commands.\n"
    )


def resolve_endpoint(args, api_key):
    if args.base_url:
        base = args.base_url.rstrip("/")
        try:
            models = client.list_models(base, api_key=api_key, timeout=min(args.timeout, 10))
        except Exception:
            models = []
        model = args.model or (models[0] if models else None)
        if not model:
            print("Could not list models at %s; pass --model." % base, file=sys.stderr)
            return None, None, None
        return client.detect_backend(base), base, model
    name, url, models = client.autodetect(timeout=2.0)
    if not url:
        return None, None, None
    model = args.model or (models[0] if models else None)
    if not model:
        print("Server at %s listed no models; pass --model." % url, file=sys.stderr)
        return None, None, None
    return name, url, model


def run_task(task, base_url, model, api_key, args):
    messages = build_messages(task)
    t0 = time.perf_counter()
    error, content, usage = None, "", None
    try:
        resp = client.chat_completion(
            base_url, model, messages, api_key=api_key, temperature=args.temperature,
            max_tokens=int(task.get("max_tokens") or 512), timeout=args.timeout,
            extra_headers={"X-Bench-Task": task["id"]},
        )
        content, usage = resp.get("content") or "", resp.get("usage")
    except Exception as exc:
        error = str(exc).replace(base_url.rstrip("/"), public_url(base_url))
    latency_ms = int(round((time.perf_counter() - t0) * 1000))
    graded = {"pass": False, "checks": []} if error else grader.grade(task, content)
    if usage and usage.get("prompt_tokens") is not None and usage.get("completion_tokens") is not None:
        pt, ct, est = int(usage.get("prompt_tokens") or 0), int(usage.get("completion_tokens") or 0), False
    else:
        prompt_text = "\n".join(m.get("content") or "" for m in messages)
        pt, ct, est = math.ceil(len(prompt_text) / 4), math.ceil(len(content) / 4), True
    return {
        "task_id": task["id"], "title": task.get("title") or task["id"],
        "category": task.get("category") or "", "pass": bool(graded["pass"]) and error is None,
        "checks": graded["checks"], "latency_ms": latency_ms, "prompt_tokens": pt,
        "completion_tokens": ct, "tokens_estimated": est, "error": error, "output": content,
    }


def summarize(results):
    total = len(results)
    passed = sum(1 for r in results if r["pass"])
    lat = [r["latency_ms"] for r in results]
    return {
        "passed": passed, "total": total, "pass_rate": (passed / total) if total else 0.0,
        "prompt_tokens": sum(r["prompt_tokens"] for r in results),
        "completion_tokens": sum(r["completion_tokens"] for r in results),
        "tokens_estimated": any(r["tokens_estimated"] for r in results),
        "latency_ms_median": int(median(lat)) if lat else 0,
    }


def parse_args(argv):
    p = argparse.ArgumentParser(description="Run Local LLM Bench against an OpenAI-compatible endpoint.")
    p.add_argument("--base-url", help="API base including /v1")
    p.add_argument("--model")
    p.add_argument("--api-key-env", default="BENCH_API_KEY")
    p.add_argument("--tasks", default=str(ROOT / "tasks"))
    p.add_argument("--only")
    p.add_argument("--out", default="results")
    p.add_argument("--compare", default=DEFAULT_COMPARE)
    p.add_argument("--timeout", type=float, default=120)
    p.add_argument("--temperature", type=float, default=0)
    p.add_argument("--max-tasks", type=int, default=None)
    p.add_argument("--quiet", action="store_true")
    p.add_argument("--list-tasks", action="store_true")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(sys.argv[1:] if argv is None else argv)
    tasks, files = load_tasks(args.tasks, only=args.only, max_tasks=args.max_tasks)
    if args.list_tasks:
        for t in tasks:
            print("%s\t%s\t%s" % (t["id"], t.get("category") or "", t.get("title") or ""))
        return 0
    api_key = os.environ.get(args.api_key_env) or None
    backend, base_url, model = resolve_endpoint(args, api_key)
    if not base_url:
        sys.stderr.write(no_backend_message())
        return 2
    if not args.quiet:
        print("Backend: %s  %s  model: %s  tasks: %d\n" % (backend, public_url(base_url), model, len(tasks)))
    started = utc_now()
    results = [run_task(t, base_url, model, api_key, args) for t in tasks]
    finished = utc_now()
    summary = summarize(results)
    try:
        prices = pricing.load_prices()
    except FileNotFoundError:
        prices = {"source": "", "license": "MIT", "fetched": "unknown", "models": {}}
    compare_names = [p.strip() for p in (args.compare or "").split(",") if p.strip()]
    compare_rows = pricing.compare_costs(prices, compare_names, summary["prompt_tokens"], summary["completion_tokens"])
    prices_meta = {"source": prices.get("source"), "license": "MIT", "as_of": prices.get("fetched")}
    host = public_url(base_url)
    payload = {
        "schema_version": 1, "tool": "local-llm-bench",
        "run": {
            "started_at": started, "finished_at": finished, "base_url": host, "backend": backend,
            "model": model, "temperature": args.temperature,
            "task_pack": {"count": len(tasks), "hash": task_pack_hash(files)},
        },
        "summary": summary,
        "prices": {"source": prices_meta["source"], "license": "MIT", "as_of": prices_meta["as_of"],
                   "compare": compare_rows},
        "results": results,
    }
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    export.write_all(args.out, stamp, payload, results, summary, compare_rows, prices_meta, quiet=args.quiet)
    return 0


if __name__ == "__main__":
    sys.exit(main())
