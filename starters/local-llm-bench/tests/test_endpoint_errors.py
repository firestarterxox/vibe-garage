#!/usr/bin/env python3
"""Bad endpoints fail fast and cleanly, and no credential from --base-url is ever printed or exported."""
import base64
import csv
import io
import json
import socket
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import bench  # noqa: E402
import client  # noqa: E402
from mock_server import start_mock_server  # noqa: E402

SECRETS = ("FAKEKEY123", "FAKEKEY456", "hunter2", "sk-FAKE", "pw@", "TOKENVAL")


def closed_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def run(argv):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        try:
            rc = bench.main(argv)
        except SystemExit as exc:  # argparse / unknown --only
            rc = exc.code
    return rc, out.getvalue(), err.getvalue()


class SecretFree(unittest.TestCase):
    def assertNoSecret(self, *texts):
        for text in texts:
            for secret in SECRETS:
                self.assertNotIn(secret, text)

    def assertNoSecretInDir(self, path):
        for f in Path(path).iterdir():
            self.assertNoSecret(f.read_text(encoding="utf-8"))


class Redaction(SecretFree):
    def test_public_url_strips_userinfo_and_secret_params(self):
        url = ("http://sk-FAKEKEY123:pw@127.0.0.1:9931/v1?api_key=FAKEKEY456&APIKEY=a&Key=b&token=c"
               "&access_token=d&secret=e&password=f&auth=g&model=keep")
        shown = client.public_url(url)
        self.assertNoSecret(shown)
        for v in ("=a", "=b", "=c", "=d", "=e", "=f", "=g"):
            self.assertNotIn(v + "&", shown + "&")
        self.assertTrue(shown.startswith("http://127.0.0.1:9931/v1?"))
        self.assertIn("model=keep", shown)

    def test_redact_text_inside_messages(self):
        msg = "boom at https://u:hunter2@api.example.com/v1?token=TOKENVAL and api_key=FAKEKEY456"
        self.assertNoSecret(client.redact_text(msg))
        self.assertNoSecret(client.public_url("no-scheme?api_key=FAKEKEY456"))


class BadEndpoints(SecretFree):
    def _unreachable(self, url, extra=()):
        rc, out, err = run(["--base-url", url, "--out", "unused-dir", *extra])
        self.assertEqual(rc, 2, err)
        self.assertIn("error:", err)
        self.assertNotIn("Passed", out + err)
        self.assertNotIn("Tried, in order", err)  # explicit --base-url: no autodetect list
        self.assertNoSecret(out, err)
        self.assertFalse(Path("unused-dir").exists())
        return err

    def test_tess_repro_creds_and_query_no_model(self):
        port = closed_port()
        err = self._unreachable("http://sk-FAKEKEY123:pw@127.0.0.1:%d/v1?api_key=FAKEKEY456" % port)
        self.assertIn("127.0.0.1:%d" % port, err)

    def test_query_key_only(self):
        self._unreachable("http://127.0.0.1:%d/v1?api_key=FAKEKEY456" % closed_port())

    def test_userinfo_only(self):
        self._unreachable("http://user:hunter2@127.0.0.1:%d/v1" % closed_port())

    def test_refused_with_model(self):
        err = self._unreachable("http://127.0.0.1:9/v1?token=TOKENVAL", ["--model", "m"])
        self.assertIn("cannot connect", err)

    def test_not_a_url(self):
        err = self._unreachable("not-a-url", ["--model", "m"])
        self.assertIn("invalid URL", err)

    def test_non_resolving_host_is_fast(self):
        # Some sandboxes and resolvers answer every name with a fake IP that never connects,
        # so accept either a DNS error or a connect timeout; both must come within the connect timeout.
        t0 = time.monotonic()
        err = self._unreachable("http://user:hunter2@no-such-host.invalid:8080/v1",
                                ["--model", "m", "--connect-timeout", "2"])
        self.assertLess(time.monotonic() - t0, 4)
        self.assertTrue("DNS lookup failed" in err or "connect timed out" in err, err)

    def test_dns_error_is_reported(self):
        with mock.patch.object(client.socket, "getaddrinfo",
                               side_effect=socket.gaierror(-2, "Name or service not known")):
            err = self._unreachable("http://user:hunter2@no-such-host.invalid/v1", ["--model", "m"])
        self.assertIn("DNS lookup failed for no-such-host.invalid", err)

    def test_hanging_dns_stops_at_connect_timeout(self):
        def slow(*_a, **_k):
            time.sleep(5)
            raise socket.gaierror("too slow")

        t0 = time.monotonic()
        with mock.patch.object(client.socket, "getaddrinfo", side_effect=slow):
            err = self._unreachable("http://slow.example.com/v1", ["--model", "m", "--connect-timeout", "0.5"])
        self.assertLess(time.monotonic() - t0, 2.5)
        self.assertIn("timed out", err)

    def test_models_404_without_model_is_redacted(self):
        httpd, base = start_mock_server()
        try:
            port = httpd.server_address[1]
            url = "http://sk-FAKEKEY123:pw@127.0.0.1:%d/v1/does-not-exist?api_key=FAKEKEY456" % port
            rc, out, err = run(["--base-url", url, "--out", "unused-dir"])
            self.assertEqual(rc, 2)
            self.assertIn("Could not list models", err)
            self.assertNoSecret(out, err)
        finally:
            httpd.shutdown()
            httpd.server_close()

    def test_connection_lost_mid_run_aborts(self):
        httpd, base = start_mock_server()
        try:
            port = httpd.server_address[1]
            url = "http://user:hunter2@127.0.0.1:%d/v1?api_key=FAKEKEY456" % port
            real = client.chat_completion
            calls = []

            def flaky(base_url, *a, **k):
                calls.append(1)
                if len(calls) == 1:
                    return real(base_url, *a, **k)
                return real("http://user:hunter2@127.0.0.1:%d/v1?api_key=FAKEKEY456" % closed_port(), *a, **k)

            with tempfile.TemporaryDirectory() as tmp, mock.patch.object(client, "chat_completion", flaky):
                rc, out, err = run(["--base-url", url, "--model", "mock-model", "--out", tmp, "--max-tasks", "5"])
                self.assertEqual(rc, 3, err)
                self.assertEqual(len(calls), 2)  # stopped at the first connection error
                self.assertIn("run aborted after 1 of 5", err)
                self.assertNotIn("Passed", out + err)
                self.assertEqual(list(Path(tmp).iterdir()), [])
                self.assertNoSecret(out, err)
        finally:
            httpd.shutdown()
            httpd.server_close()


class CredentialsInUrl(SecretFree):
    def _run_against(self, userinfo, query=""):
        httpd, base = start_mock_server()
        try:
            port = httpd.server_address[1]
            url = "http://%s@127.0.0.1:%d/v1%s" % (userinfo, port, query)
            with tempfile.TemporaryDirectory() as tmp:
                rc, out, err = run(["--base-url", url, "--model", "mock-model", "--out", tmp, "--max-tasks", "2"])
                self.assertEqual(rc, 0, err)
                self.assertIn("Passed 2/2", out)
                self.assertNoSecret(out, err)
                self.assertNoSecretInDir(tmp)
                data = json.loads((Path(tmp) / "latest.json").read_text())
                self.assertTrue(data["run"]["base_url"].startswith("http://127.0.0.1:%d/v1" % port))
            for path in httpd.seen_paths:
                self.assertNotIn("@", path)
            return httpd.seen_auth
        finally:
            httpd.shutdown()
            httpd.server_close()

    def test_user_password_becomes_basic_auth(self):
        seen = self._run_against("user:hunter2", "?api_key=FAKEKEY456")
        expected = "Basic " + base64.b64encode(b"user:hunter2").decode()
        self.assertTrue(seen)
        self.assertTrue(all(a == expected for a in seen))

    def test_token_username_becomes_bearer(self):
        seen = self._run_against("sk-FAKEKEY123")
        self.assertTrue(all(a == "Bearer sk-FAKEKEY123" for a in seen))

    def test_env_key_wins_over_url(self):
        with mock.patch.dict("os.environ", {"BENCH_API_KEY": "envtoken"}):
            seen = self._run_against("user:hunter2")
        self.assertTrue(all(a == "Bearer envtoken" for a in seen))


class Minor(unittest.TestCase):
    def test_backend_labels_for_explicit_local_urls(self):
        self.assertEqual(client.detect_backend("http://127.0.0.1:9931/v1"), "llamacpp")
        self.assertEqual(client.detect_backend("http://localhost:8080/v1"), "llamacpp")
        self.assertEqual(client.detect_backend("http://127.0.0.1:11434/v1"), "ollama")
        self.assertEqual(client.detect_backend("http://localhost:1234/v1/"), "lmstudio")
        self.assertEqual(client.detect_backend("http://127.0.0.1:5000/v1"), "custom")
        self.assertEqual(client.detect_backend("not-a-url"), "custom")

    def test_unknown_model_warns_but_runs(self):
        httpd, base = start_mock_server()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                rc, out, err = run(["--base-url", base, "--model", "no-such-model", "--out", tmp,
                                    "--max-tasks", "1", "--quiet"])
            self.assertEqual(rc, 0)
            self.assertIn("warning: model 'no-such-model' is not in the list", err)
            self.assertIn("mock-model", err)
        finally:
            httpd.shutdown()
            httpd.server_close()

    def test_failed_requests_have_no_tokens_or_cost(self):
        httpd, base = start_mock_server()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                rc, out, err = run(["--base-url", base + "/does-not-exist", "--model", "mock-model",
                                    "--out", tmp, "--only", "ticket-triage"])
                self.assertEqual(rc, 0)
                data = json.loads((Path(tmp) / "latest.json").read_text())
                row = data["results"][0]
                self.assertIsNone(row["prompt_tokens"])
                self.assertIsNone(row["completion_tokens"])
                self.assertEqual(data["summary"]["prompt_tokens"], 0)
                with (Path(tmp) / "latest.csv").open(newline="") as f:
                    crow = next(csv.DictReader(f))
                self.assertEqual(crow["prompt_tokens"], "")
                self.assertTrue(all(crow[k] == "" for k in crow if k.startswith("cost_")))
                md = (Path(tmp) / "latest.md").read_text()
                self.assertIn("| ticket-triage | triage | FAIL |", md)
                self.assertIn("| - | - | - |", md)
                line = [l for l in out.splitlines() if l.startswith("ticket-triage")][0]
                self.assertNotIn("$", line)
                self.assertEqual(line.split()[-3:], ["-", "-", "-"])
        finally:
            httpd.shutdown()
            httpd.server_close()

    def test_quiet_prints_one_line_with_paths(self):
        httpd, base = start_mock_server()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                rc, out, err = run(["--base-url", base, "--model", "mock-model", "--out", tmp,
                                    "--max-tasks", "1", "--quiet"])
            self.assertEqual(rc, 0)
            lines = out.strip().splitlines()
            self.assertEqual(len(lines), 1)
            self.assertIn(".md", lines[0])
            self.assertIn(".csv", lines[0])
            self.assertIn(".json", lines[0])
        finally:
            httpd.shutdown()
            httpd.server_close()

    def test_every_flag_has_help(self):
        for action in bench.build_parser()._actions:
            self.assertTrue(action.help, action.option_strings)


if __name__ == "__main__":
    unittest.main()
