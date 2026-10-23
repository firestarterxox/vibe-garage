#!/usr/bin/env python3
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import bench  # noqa: E402
import client  # noqa: E402
import pricing  # noqa: E402
from mock_server import start_mock_server  # noqa: E402


class Autodetect(unittest.TestCase):
    def test_probe_order(self):
        self.assertEqual(
            [url for _, url in client.CANDIDATES],
            ["http://localhost:11434/v1", "http://localhost:1234/v1",
             "http://localhost:9931/v1", "http://localhost:8080/v1"],
        )

    def test_first_answering_candidate_wins(self):
        seen = []

        def fake_list(url, timeout=2.0):
            seen.append(url)
            if ":9931" in url:
                return ["tiny-model"]
            raise client.ClientError("refused")

        with mock.patch.object(client, "list_models", side_effect=fake_list):
            name, url, models = client.autodetect()
        self.assertEqual((name, url, models), ("llamacpp", "http://localhost:9931/v1", ["tiny-model"]))
        self.assertEqual(len(seen), 3)

    def test_no_backend_exits_2(self):
        err = io.StringIO()
        with mock.patch.object(client, "autodetect", return_value=(None, None, None)), redirect_stderr(err):
            self.assertEqual(bench.main(["--quiet"]), 2)
        self.assertIn("localhost:9931", err.getvalue())

    def test_detect_backend(self):
        self.assertEqual(client.detect_backend("http://localhost:8080/v1/"), "llamacpp")
        self.assertEqual(client.detect_backend("https://api.example.com/v1"), "custom")


class PricingAndPrivacy(unittest.TestCase):
    def test_price_lookup(self):
        prices = {"models": {"gpt-4o-mini": {"input_cost_per_token": 1e-7, "output_cost_per_token": 2e-7},
                             "xai/grok-x": {"input_cost_per_token": 1e-6, "output_cost_per_token": 1e-6}}}
        self.assertEqual(pricing.find_model_price(prices, "gpt-4o-mini")[0], "gpt-4o-mini")
        self.assertEqual(pricing.find_model_price(prices, "grok-x")[0], "xai/grok-x")
        self.assertEqual(pricing.find_model_price(prices, "gpt-4o-mini-latest")[0], "gpt-4o-mini")
        self.assertIsNone(pricing.find_model_price(prices, "gpt-4o")[0])
        self.assertAlmostEqual(pricing.run_cost_usd(prices["models"]["gpt-4o-mini"], 1000, 500), 2e-4)

    def test_credentials_never_exported(self):
        httpd, base = start_mock_server()
        try:
            port = httpd.server_address[1]
            leaky = "http://user:hunter2@127.0.0.1:%d/v1" % port
            with tempfile.TemporaryDirectory() as tmp, redirect_stdout(io.StringIO()):
                with mock.patch.object(client, "list_models", return_value=["mock-model"]):
                    rc = bench.main(["--base-url", leaky, "--model", "mock-model", "--out", tmp,
                                     "--max-tasks", "1", "--quiet"])
                self.assertEqual(rc, 0)
                data = json.loads((Path(tmp) / "latest.json").read_text())
                self.assertEqual(data["run"]["base_url"], "http://127.0.0.1:%d/v1" % port)
                for f in Path(tmp).iterdir():
                    self.assertNotIn("hunter2", f.read_text())
        finally:
            httpd.shutdown()
            httpd.server_close()


if __name__ == "__main__":
    unittest.main()
