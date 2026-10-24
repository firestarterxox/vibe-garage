#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import bench  # noqa: E402
from mock_server import start_mock_server  # noqa: E402

TASK_COUNT = len(list((ROOT / "tasks").glob("*.json")))


def _stop(httpd):
    httpd.shutdown()
    httpd.server_close()


class EndToEnd(unittest.TestCase):
    def test_full_run_exports_and_schema(self):
        httpd, base = start_mock_server()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                rc = bench.main(
                    [
                        "--base-url",
                        base,
                        "--model",
                        "mock-model",
                        "--tasks",
                        str(ROOT / "tasks"),
                        "--out",
                        tmp,
                        "--quiet",
                        "--timeout",
                        "5",
                    ]
                )
                self.assertEqual(rc, 0)
                out = Path(tmp)
                self.assertTrue((out / "latest.json").is_file())
                self.assertTrue((out / "latest.md").is_file())
                self.assertTrue((out / "latest.csv").is_file())
                stamped = list(out.glob("results-*.json"))
                self.assertTrue(stamped)
                payload = json.loads((out / "latest.json").read_text(encoding="utf-8"))
                self.assertEqual(payload.get("schema_version"), 1)
                self.assertEqual(payload.get("tool"), "local-llm-bench")
                for key in ("run", "summary", "prices", "results"):
                    self.assertIn(key, payload)
                run = payload["run"]
                for key in ("started_at", "finished_at", "base_url", "backend", "model", "temperature", "task_pack"):
                    self.assertIn(key, run)
                self.assertEqual(run["backend"], "custom")
                self.assertEqual(run["model"], "mock-model")
                pack = run["task_pack"]
                self.assertEqual(pack["count"], TASK_COUNT)
                self.assertEqual(len(pack.get("hash") or ""), 64)
                summary = payload["summary"]
                for key in (
                    "passed",
                    "total",
                    "pass_rate",
                    "prompt_tokens",
                    "completion_tokens",
                    "tokens_estimated",
                    "latency_ms_median",
                ):
                    self.assertIn(key, summary)
                self.assertEqual(summary["total"], TASK_COUNT)
                self.assertEqual(summary["passed"], TASK_COUNT)
                self.assertFalse(summary["tokens_estimated"])
                prices = payload["prices"]
                for key in ("source", "license", "as_of", "compare"):
                    self.assertIn(key, prices)
                self.assertEqual(prices["license"], "MIT")
                self.assertTrue(prices["compare"])
                self.assertEqual(len(payload["results"]), TASK_COUNT)
                for row in payload["results"]:
                    for key in (
                        "task_id",
                        "title",
                        "category",
                        "pass",
                        "checks",
                        "latency_ms",
                        "prompt_tokens",
                        "completion_tokens",
                        "tokens_estimated",
                        "error",
                        "output",
                    ):
                        self.assertIn(key, row)
                    self.assertTrue(row["pass"], row["task_id"])
                    self.assertFalse(row["tokens_estimated"])
                    self.assertTrue(row["output"])
                with (out / "latest.csv").open(encoding="utf-8", newline="") as f:
                    rows = list(csv.DictReader(f))
                self.assertEqual(len(rows), TASK_COUNT)
                md = (out / "latest.md").read_text(encoding="utf-8")
                self.assertIn("Synthetic task pack", md)
                self.assertIn("LiteLLM", md)
        finally:
            _stop(httpd)

    def test_usage_missing_marks_estimated(self):
        httpd, base = start_mock_server(omit_usage=True)
        try:
            with tempfile.TemporaryDirectory() as tmp:
                rc = bench.main(
                    [
                        "--base-url",
                        base,
                        "--model",
                        "mock-model",
                        "--tasks",
                        str(ROOT / "tasks"),
                        "--out",
                        tmp,
                        "--quiet",
                        "--timeout",
                        "5",
                        "--max-tasks",
                        "3",
                    ]
                )
                self.assertEqual(rc, 0)
                payload = json.loads((Path(tmp) / "latest.json").read_text(encoding="utf-8"))
                self.assertTrue(payload["summary"]["tokens_estimated"])
                self.assertEqual(len(payload["results"]), 3)
                for row in payload["results"]:
                    self.assertTrue(row["tokens_estimated"], row["task_id"])
                    self.assertGreater(row["prompt_tokens"], 0)
                    self.assertGreater(row["completion_tokens"], 0)
                    self.assertTrue(row["pass"], row["task_id"])
        finally:
            _stop(httpd)

    def test_wrong_answers_reduce_pass_rate(self):
        httpd, base = start_mock_server(wrong=True)
        try:
            with tempfile.TemporaryDirectory() as tmp:
                rc = bench.main(
                    [
                        "--base-url",
                        base,
                        "--model",
                        "mock-model",
                        "--tasks",
                        str(ROOT / "tasks"),
                        "--only",
                        "ticket-triage,email-intent,injection-triage",
                        "--out",
                        tmp,
                        "--quiet",
                        "--timeout",
                        "5",
                    ]
                )
                self.assertEqual(rc, 0)
                payload = json.loads((Path(tmp) / "latest.json").read_text(encoding="utf-8"))
                self.assertEqual(payload["summary"]["passed"], 0)
                self.assertEqual(payload["summary"]["total"], 3)
        finally:
            _stop(httpd)

    def test_list_tasks_no_server(self):
        from io import StringIO
        from contextlib import redirect_stdout

        buf = StringIO()
        with redirect_stdout(buf):
            rc = bench.main(["--tasks", str(ROOT / "tasks"), "--list-tasks"])
        self.assertEqual(rc, 0)
        self.assertIn("ticket-triage", buf.getvalue())

    def test_one_errored_task_still_exits_0(self):
        httpd, base = start_mock_server()
        real = bench.client.chat_completion

        def flaky(*a, **kw):
            if (kw.get("extra_headers") or {}).get("X-Bench-Task") == "date-normalize":
                raise bench.client.ClientError("HTTP 500 for test")
            return real(*a, **kw)

        try:
            with tempfile.TemporaryDirectory() as tmp, mock.patch.object(bench.client, "chat_completion", flaky):
                rc = bench.main(["--base-url", base, "--model", "mock-model", "--tasks", str(ROOT / "tasks"),
                                 "--only", "ticket-triage,date-normalize", "--out", tmp, "--quiet",
                                 "--timeout", "5"])
                self.assertEqual(rc, 0)
                payload = json.loads((Path(tmp) / "latest.json").read_text(encoding="utf-8"))
                errors = {r["task_id"]: r["error"] for r in payload["results"]}
                self.assertIsNone(errors["ticket-triage"])
                self.assertTrue(errors["date-normalize"])
        finally:
            _stop(httpd)

    def test_http_error_records_fail_and_continues(self):
        httpd, base = start_mock_server()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                rc = bench.main(
                    [
                        "--base-url",
                        base + "/does-not-exist",
                        "--model",
                        "mock-model",
                        "--tasks",
                        str(ROOT / "tasks"),
                        "--only",
                        "ticket-triage,date-normalize",
                        "--out",
                        tmp,
                        "--quiet",
                        "--timeout",
                        "2",
                    ]
                )
                self.assertEqual(rc, bench.EXIT_ALL_ERRORED)  # every task errored
                payload = json.loads((Path(tmp) / "latest.json").read_text(encoding="utf-8"))
                self.assertEqual(payload["summary"]["total"], 2)
                self.assertEqual(payload["summary"]["passed"], 0)
                for row in payload["results"]:
                    self.assertFalse(row["pass"])
                    self.assertTrue(row["error"])
        finally:
            _stop(httpd)


if __name__ == "__main__":
    unittest.main()
