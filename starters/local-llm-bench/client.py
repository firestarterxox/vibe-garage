"""Tiny urllib client for OpenAI-compatible /models and /chat/completions."""
import json
import socket
import urllib.error
import urllib.request

CANDIDATES = [
    ("ollama", "http://localhost:11434/v1"),
    ("lmstudio", "http://localhost:1234/v1"),
    ("llamacpp", "http://localhost:9931/v1"),  # current llama-server default
    ("llamacpp", "http://localhost:8080/v1"),  # older llama.cpp builds and Docker images
]


class ClientError(Exception):
    pass


def detect_backend(base_url):
    url = (base_url or "").rstrip("/").lower()
    for name, candidate in CANDIDATES:
        if url == candidate.lower():
            return name
    return "custom"


def _headers(api_key, extra=None):
    h = {"Accept": "application/json", "User-Agent": "local-llm-bench"}
    if extra:
        h.update(extra)
    if api_key:
        h["Authorization"] = "Bearer %s" % api_key
    return h


def http_json(method, url, api_key=None, body=None, timeout=30, extra_headers=None):
    headers = _headers(api_key, extra_headers)
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        raise ClientError("HTTP %s for %s: %s" % (exc.code, url, raw[:300])) from exc
    except urllib.error.URLError as exc:
        raise ClientError("request failed for %s: %s" % (url, exc.reason)) from exc
    except (socket.timeout, TimeoutError) as exc:
        raise ClientError("timeout for %s" % url) from exc
    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        raise ClientError("non-JSON response from %s: %s" % (url, raw[:200])) from exc


def list_models(base_url, api_key=None, timeout=2.0):
    data = http_json("GET", base_url.rstrip("/") + "/models", api_key=api_key, timeout=timeout)
    items = data.get("data") if isinstance(data, dict) else None
    out = []
    for item in items or []:
        if isinstance(item, dict) and item.get("id"):
            out.append(item["id"])
        elif isinstance(item, str):
            out.append(item)
    return out


def chat_completion(base_url, model, messages, api_key=None, temperature=0, max_tokens=512,
                    timeout=120, extra_headers=None):
    data = http_json(
        "POST", base_url.rstrip("/") + "/chat/completions", api_key=api_key,
        body={"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens},
        timeout=timeout, extra_headers=extra_headers,
    )
    content = ""
    choices = data.get("choices") if isinstance(data, dict) else None
    if choices:
        content = (choices[0].get("message") or {}).get("content") or ""
    usage = data.get("usage") if isinstance(data, dict) else None
    if usage is not None and not isinstance(usage, dict):
        usage = None
    return {"content": content, "usage": usage, "raw": data}


def autodetect(timeout=2.0):
    for name, url in CANDIDATES:
        try:
            return name, url, list_models(url, timeout=timeout)
        except Exception:
            continue
    return None, None, None
