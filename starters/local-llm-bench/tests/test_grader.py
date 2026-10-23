#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import grader  # noqa: E402

ANSWERS = json.loads((Path(__file__).resolve().parent / "mock_answers.json").read_text(encoding="utf-8"))
TASKS_DIR = ROOT / "tasks"


def load_tasks():
    tasks = []
    for fp in sorted(TASKS_DIR.glob("*.json")):
        with fp.open(encoding="utf-8") as f:
            tasks.append(json.load(f))
    return tasks


class CheckTypes(unittest.TestCase):
    def test_exact_pass_fail(self):
        task = {"checks": [{"type": "exact", "value": "Hello", "normalize": True}]}
        self.assertTrue(grader.grade(task, "HELLO.")["pass"])
        self.assertFalse(grader.grade(task, "goodbye")["pass"])
        raw = {"checks": [{"type": "exact", "value": "AbC", "normalize": False}]}
        self.assertTrue(grader.grade(raw, "AbC")["pass"])
        self.assertFalse(grader.grade(raw, "abc")["pass"])

    def test_one_of_pass_fail(self):
        task = {"checks": [{"type": "one_of", "values": ["hardware", "software"]}]}
        self.assertTrue(grader.grade(task, "`Hardware`")["pass"])
        self.assertFalse(grader.grade(task, "billing")["pass"])

    def test_contains_all_pass_fail(self):
        task = {"checks": [{"type": "contains_all", "values": ["alpha", "beta"], "case_sensitive": False}]}
        self.assertTrue(grader.grade(task, "Beta and ALPHA")["pass"])
        self.assertFalse(grader.grade(task, "alpha only")["pass"])
        cs = {"checks": [{"type": "contains_all", "values": ["Alpha"], "case_sensitive": True}]}
        self.assertFalse(grader.grade(cs, "alpha")["pass"])

    def test_contains_none_pass_fail(self):
        task = {"checks": [{"type": "contains_none", "values": ["DROP", "DELETE"], "case_sensitive": False}]}
        self.assertTrue(grader.grade(task, "SELECT 1")["pass"])
        self.assertFalse(grader.grade(task, "please DELETE this")["pass"])

    def test_regex_pass_fail(self):
        task = {"checks": [{"type": "regex", "pattern": "find\\s+/var/log.*\\+100M", "flags": "i"}]}
        self.assertTrue(grader.grade(task, "find /var/log -size +100M")["pass"])
        self.assertFalse(grader.grade(task, "ls /var/log")["pass"])

    def test_json_pass_fail(self):
        task = {
            "checks": [
                {
                    "type": "json",
                    "keys": ["customer", "customer.email"],
                    "required": {"customer.email": "jane.example@example.com", "total": 10, "ok": True, "missing": None},
                }
            ]
        }
        good = 'Here you go:\n```json\n{"customer": {"email": "Jane.Example@example.com"}, "total": 10.004, "ok": true, "missing": null}\n```'
        self.assertTrue(grader.grade(task, good)["pass"])
        bad = '{"customer": {"email": "other@example.com"}, "total": 10, "ok": true, "missing": null}'
        self.assertFalse(grader.grade(task, bad)["pass"])
        self.assertFalse(grader.grade(task, "no json here")["pass"])

    def test_json_array_and_index_paths(self):
        task = {
            "checks": [
                {
                    "type": "json",
                    "keys": ["name", "email"],
                    "required": {"0.email": "a@example.com", "1.name": "B"},
                }
            ]
        }
        good = '[{"name":"A","email":"a@example.com"},{"name":"B","email":"b@example.org"}]'
        self.assertTrue(grader.grade(task, good)["pass"])
        self.assertFalse(grader.grade(task, '[{"name":"A"}]')["pass"])

    def test_number_pass_fail(self):
        task = {"checks": [{"type": "number", "value": 43.30, "tolerance": 0.01}]}
        self.assertTrue(grader.grade(task, "Total is $43.30")["pass"])
        self.assertFalse(grader.grade(task, "1,234 then 43.30")["pass"])
        self.assertTrue(grader.grade(task, "$43.30")["pass"])
        self.assertFalse(grader.grade(task, "12.00")["pass"])
        self.assertFalse(grader.grade(task, "nope")["pass"])

    def test_regex_run_pass_fail(self):
        task = {
            "checks": [
                {
                    "type": "regex_run",
                    "should_match": ["INC-000001", "INC-123456"],
                    "should_not_match": ["inc-123456", "INC-12"],
                }
            ]
        }
        self.assertTrue(grader.grade(task, "```\nINC-[0-9]{6}\n```")["pass"])
        self.assertFalse(grader.grade(task, "INC-.*")["pass"])
        long_pat = "a" * 301
        self.assertFalse(grader.grade(task, long_pat)["pass"])

    def test_max_words_pass_fail(self):
        task = {"checks": [{"type": "max_words", "value": 5}]}
        self.assertTrue(grader.grade(task, "one two three")["pass"])
        self.assertFalse(grader.grade(task, "one two three four five six")["pass"])

    def test_unknown_type(self):
        task = {"checks": [{"type": "nope"}]}
        r = grader.grade(task, "anything")
        self.assertFalse(r["pass"])
        self.assertEqual(r["checks"][0]["detail"], "unknown check type")

    def test_strips_think_blocks(self):
        task = {"checks": [{"type": "exact", "value": "yes", "normalize": True}]}
        self.assertTrue(grader.grade(task, "<think>say no</think>\nyes")["pass"])
        self.assertFalse(grader.grade(task, "<think>yes</think>\nno")["pass"])

    def test_all_must_pass(self):
        task = {
            "checks": [
                {"type": "contains_all", "values": ["keep"]},
                {"type": "max_words", "value": 2},
            ]
        }
        self.assertTrue(grader.grade(task, "keep this")["pass"])
        self.assertFalse(grader.grade(task, "keep this extra")["pass"])


class TaskPack(unittest.TestCase):
    def test_every_task_passes_correct_answer(self):
        tasks = load_tasks()
        self.assertGreaterEqual(len(tasks), 18)
        missing = []
        for task in tasks:
            tid = task["id"]
            self.assertTrue(task.get("synthetic"), tid)
            ans = ANSWERS.get(tid, {}).get("correct")
            self.assertIsNotNone(ans, "no mock answer for %s" % tid)
            r = grader.grade(task, ans)
            if not r["pass"]:
                missing.append((tid, r["checks"]))
        self.assertEqual(missing, [])

    def test_every_task_fails_empty_string(self):
        for task in load_tasks():
            r = grader.grade(task, "")
            self.assertFalse(r["pass"], task["id"])

    def test_wrong_answers_fail_when_present(self):
        by_id = {t["id"]: t for t in load_tasks()}
        for tid, spec in ANSWERS.items():
            if "wrong" not in spec:
                continue
            r = grader.grade(by_id[tid], spec["wrong"])
            self.assertFalse(r["pass"], tid)


if __name__ == "__main__":
    unittest.main()
