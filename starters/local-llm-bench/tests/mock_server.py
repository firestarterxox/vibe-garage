"""Stdlib OpenAI-compatible mock for GET /models and POST /chat/completions."""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ANSWERS_PATH = Path(__file__).resolve().parent / "mock_answers.json"
TASKS_DIR = ROOT / "tasks"


def load_answers():
    with ANSWERS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def load_tasks():
    tasks = []
    if TASKS_DIR.is_dir():
        for fp in sorted(TASKS_DIR.glob("*.json")):
            with fp.open(encoding="utf-8") as f:
                tasks.append(json.load(f))
    return tasks


def match_task_id(header_id, body_obj, answers, tasks):
    if header_id and header_id in answers:
        return header_id
    messages = (body_obj or {}).get("messages") or [] if isinstance(body_obj, dict) else []
    hay = json.dumps(body_obj or {}, ensure_ascii=False) + "\n" + " ".join(
        (m.get("content") or "") for m in messages if isinstance(m, dict)
    )
    for t in tasks:
        prompt = (t.get("prompt") or "").strip()[:80]
        extra = (t.get("input") or "").strip()[:80]
        if (prompt and prompt in hay) or (extra and extra in hay):
            return t.get("id")
    for tid in answers:
        if tid in hay:
            return tid
    return header_id


def pick_content(tid, answers, wrong):
    spec = answers.get(tid) or {}
    if wrong:
        return spec.get("wrong") or "WRONG"
    return spec.get("correct") or ""


def make_handler(answers, tasks, omit_usage=False, wrong=False):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status, payload):
            raw = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def log_message(self, _fmt, *_args):
            return

        def _record(self):
            self.server.seen_auth.append(self.headers.get("Authorization"))
            self.server.seen_paths.append(self.path)

        def do_GET(self):
            self._record()
            path = urlparse(self.path).path.rstrip("/") or "/"
            if path in ("/v1/models", "/models"):
                self._send(200, {"object": "list", "data": [
                    {"id": "mock-model", "object": "model", "owned_by": "local-llm-bench"}
                ]})
                return
            self._send(404, {"error": {"message": "not found"}})

        def do_POST(self):
            self._record()
            parsed = urlparse(self.path)
            path = parsed.path.rstrip("/") or "/"
            if path not in ("/v1/chat/completions", "/chat/completions"):
                self._send(404, {"error": {"message": "not found"}})
                return
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b""
            try:
                body = json.loads(raw.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                self._send(400, {"error": {"message": "invalid json"}})
                return
            qs = parsed.query or ""
            use_wrong = wrong or "wrong=1" in qs
            skip_usage = omit_usage or "omit_usage=1" in qs
            tid = match_task_id(self.headers.get("X-Bench-Task"), body, answers, tasks)
            content = pick_content(tid, answers, use_wrong) if tid else "unknown task"
            payload = {
                "id": "chatcmpl-mock", "object": "chat.completion",
                "model": (body.get("model") if isinstance(body, dict) else None) or "mock-model",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
            }
            if not skip_usage:
                n_out = max(1, len(content) // 4)
                payload["usage"] = {"prompt_tokens": 42, "completion_tokens": n_out, "total_tokens": 42 + n_out}
            self._send(200, payload)

    return Handler


def start_mock_server(omit_usage=False, wrong=False, port=0):
    httpd = HTTPServer(("127.0.0.1", port), make_handler(load_answers(), load_tasks(), omit_usage, wrong))
    httpd.seen_auth, httpd.seen_paths = [], []
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d/v1" % httpd.server_address[1]


if __name__ == "__main__":
    import argparse
    import time

    p = argparse.ArgumentParser()
    p.add_argument("--omit-usage", action="store_true")
    p.add_argument("--wrong", action="store_true")
    p.add_argument("--port", type=int, default=0)
    args = p.parse_args()
    httpd, base = start_mock_server(omit_usage=args.omit_usage, wrong=args.wrong, port=args.port)
    print("mock listening at %s" % base, flush=True)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        httpd.shutdown()
        httpd.server_close()
