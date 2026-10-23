"""Terminal table plus Markdown, CSV and JSON result exports."""
import csv
import json
import os
import shutil
import sys
from pathlib import Path

from pricing import fmt_usd, run_cost_usd

HEADERS = ["Task", "Category", "Pass", "Latency ms", "In tok", "Out tok"]
CSV_FIELDS = [
    "task_id", "title", "category", "pass", "latency_ms",
    "prompt_tokens", "completion_tokens", "tokens_estimated", "error",
]


def _color():
    return sys.stdout.isatty() and not os.environ.get("NO_COLOR")


def _pass_label(passed):
    text = "PASS" if passed else "FAIL"
    if not _color():
        return text
    return "\033[%sm%s\033[0m" % ("32" if passed else "31", text)


def _fmt_row(row, widths, right):
    out = []
    for i, cell in enumerate(row):
        s = str(cell)
        out.append(s.rjust(widths[i]) if right[i] else s.ljust(widths[i]))
    return "  ".join(out)


def _tok(value):
    """Token cell: "-" when the request failed and nothing was counted."""
    return "-" if value is None else str(value)


def _row_cost(result, compare_rows):
    """Cost of one task at the first --compare model's list price ("n/a" if unpriced, "-" if it failed)."""
    if result.get("error") or result.get("prompt_tokens") is None:
        return "-"
    if not compare_rows or compare_rows[0].get("input_cost_per_token") is None:
        return "n/a"
    return fmt_usd(run_cost_usd(compare_rows[0], result.get("prompt_tokens"), result.get("completion_tokens")))


def _cost_header(compare_rows):
    return "If paid (%s)" % compare_rows[0]["model"] if compare_rows else "If paid"


def _as_of(meta):
    return (meta or {}).get("as_of") or "unknown"


def print_table(results, summary, compare_rows, prices_meta, quiet=False):
    if quiet:
        return
    rows = [
        [
            r["task_id"], r.get("category") or "", "PASS" if r["pass"] else "FAIL",
            str(r.get("latency_ms") or 0), _tok(r.get("prompt_tokens")),
            _tok(r.get("completion_tokens")), _row_cost(r, compare_rows),
        ]
        for r in results
    ]
    headers = HEADERS + [_cost_header(compare_rows)]
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell)))
    right = [False, False, False, True, True, True, True]
    print(_fmt_row(headers, widths, right))
    print("  ".join("-" * w for w in widths))
    for row, raw in zip(rows, results):
        display = list(row)
        label = _pass_label(raw["pass"])
        display[2] = label + (" " * (widths[2] - len(row[2])))
        print(_fmt_row(display, widths, right))
    total, passed = summary["total"], summary["passed"]
    pct = (100.0 * passed / total) if total else 0.0
    print("")
    print("Passed %d/%d (%.1f%%)   tokens in=%d out=%d" % (
        passed, total, pct, summary["prompt_tokens"], summary["completion_tokens"]))
    print("")
    print("Cost if you paid (same token counts):")
    for row in compare_rows:
        print("  %-28s  %s" % (row["model"], fmt_usd(row["run_cost_usd"])))
    print("")
    print("Prices: LiteLLM model_prices_and_context_window.json (MIT), as of %s" % _as_of(prices_meta))


def _cost_col(name):
    return "cost_" + "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in name)


def write_csv(path, results, compare_rows):
    cost_fields = [_cost_col(c["model"]) for c in compare_rows]
    fields = CSV_FIELDS + cost_fields
    with Path(path).open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in results:
            row = {k: r.get(k) for k in CSV_FIELDS}
            row["pass"] = "true" if r.get("pass") else "false"
            row["tokens_estimated"] = "true" if r.get("tokens_estimated") else "false"
            row["error"] = r.get("error") or ""
            failed = bool(r.get("error")) or r.get("prompt_tokens") is None
            if failed:
                row["prompt_tokens"] = row["completion_tokens"] = ""
            for c, col in zip(compare_rows, cost_fields):
                spec = {
                    "input_cost_per_token": c.get("input_cost_per_token"),
                    "output_cost_per_token": c.get("output_cost_per_token"),
                }
                if failed or (spec["input_cost_per_token"] is None and spec["output_cost_per_token"] is None):
                    row[col] = ""
                else:
                    val = run_cost_usd(spec, r.get("prompt_tokens") or 0, r.get("completion_tokens") or 0)
                    row[col] = "" if val is None else ("%.10f" % val).rstrip("0").rstrip(".")
            w.writerow(row)


def write_json(path, payload):
    with Path(path).open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")


def write_markdown(path, payload, compare_rows, prices_meta):
    run, summary = payload["run"], payload["summary"]
    total, passed = summary["total"], summary["passed"]
    pct = (100.0 * passed / total) if total else 0.0
    lines = [
        "# Local LLM Bench results", "",
        "- Model: %s" % run.get("model"),
        "- Endpoint: %s" % run.get("base_url"),
        "- Date: %s" % run.get("finished_at"),
        "- Pass rate: %d/%d (%.1f%%)" % (passed, total, pct), "",
        "| Task | Category | Pass | Latency ms | In tok | Out tok | %s |" % _cost_header(compare_rows),
        "| --- | --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for r in payload["results"]:
        lines.append("| %s | %s | %s | %s | %s | %s | %s |" % (
            r["task_id"], r.get("category") or "", "PASS" if r["pass"] else "FAIL",
            r.get("latency_ms") or 0, _tok(r.get("prompt_tokens")), _tok(r.get("completion_tokens")),
            _row_cost(r, compare_rows)))
    if summary.get("tokens_estimated"):
        lines.append("Some token counts were estimated (server sent no usage).")
    lines += ["", "## Cost if you paid (whole run, same token counts)", "", "| Model | Run cost |", "| --- | ---: |"]
    lines += ["| %s | %s |" % (c["model"], fmt_usd(c["run_cost_usd"])) for c in compare_rows]
    lines += ["", "Prices: LiteLLM model_prices_and_context_window.json (MIT), as of %s" % _as_of(prices_meta),
              "", "Synthetic task pack; small sample; rule-based grading.", ""]
    Path(path).write_text("\n".join(lines), encoding="utf-8")


def write_all(out_dir, stamp, payload, results, summary, compare_rows, prices_meta, quiet=False):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    stamped = {ext: out / ("results-%s.%s" % (stamp, ext)) for ext in ("md", "csv", "json")}
    write_markdown(stamped["md"], payload, compare_rows, prices_meta)
    write_csv(stamped["csv"], results, compare_rows)
    write_json(stamped["json"], payload)
    for ext in stamped:
        shutil.copyfile(stamped[ext], out / ("latest.%s" % ext))
    print_table(results, summary, compare_rows, prices_meta, quiet=quiet)
    if quiet:
        print("Wrote %s, %s, %s (passed %d/%d)" % (stamped["md"], stamped["csv"], stamped["json"],
                                                    summary["passed"], summary["total"]))
    else:
        print("")
        print("Wrote %s (+ .csv, .json) and %s" % (stamped["md"], out / "latest.md"))
    return stamped
