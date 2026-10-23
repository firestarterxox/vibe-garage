"""Tiny stdlib client for OpenAI-compatible /models and /chat/completions."""
import base64
import http.client
import json
import re
import socket
import ssl
import threading
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit

CANDIDATES = [
    ("ollama", "http://localhost:11434/v1"),
    ("lmstudio", "http://localhost:1234/v1"),
    ("llamacpp", "http://localhost:9931/v1"),  # current llama-server default
    ("llamacpp", "http://localhost:8080/v1"),  # older llama.cpp builds and Docker images
]
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
PORT_BACKENDS = {11434: "ollama", 1234: "lmstudio", 9931: "llamacpp", 8080: "llamacpp"}
CONNECT_TIMEOUT = 5.0
SECRET_PARAMS = {"api_key", "apikey", "api-key", "key", "token", "access_token", "secret",
                 "password", "auth"}
REDACTED = "REDACTED"


class ClientError(Exception):
    """The server answered, but not usefully (HTTP error, bad JSON, read timeout)."""


class ConnectionFailed(ClientError):
    """Nothing usable answered: invalid URL, DNS failure, refused or connect timeout."""


# ---------------------------------------------------------------- redaction

def public_url(url):
    """The URL with userinfo removed and secret-looking query values replaced.

    Every URL that reaches the terminal, a log line, an exception or an export goes through here.
    """
    text = str(url or "")
    try:
        parts = urlsplit(text)
    except ValueError:
        return _redact_loose(text)
    if not parts.scheme or not parts.netloc:
        return _redact_loose(text)
    netloc = parts.netloc.rsplit("@", 1)[-1]
    query = ""
    if parts.query:
        pairs = parse_qsl(parts.query, keep_blank_values=True)
        query = "?" + urlencode([(k, REDACTED if k.lower() in SECRET_PARAMS else v) for k, v in pairs],
                                safe=REDACTED)
    return "%s://%s%s%s" % (parts.scheme, netloc, parts.path.rstrip("/"), query)


_SECRET_QS = re.compile(r"(?i)\b(%s)=[^&\s'\"#]*" % "|".join(re.escape(p) for p in sorted(SECRET_PARAMS)))
_URL_RE = re.compile(r"[A-Za-z][A-Za-z0-9+.-]*://[^\s'\"<>]+")


def _redact_loose(text):
    text = re.sub(r"(//)[^/@\s]*@", r"\1", text)
    return _SECRET_QS.sub(lambda m: "%s=%s" % (m.group(1), REDACTED), text)


def redact_text(text):
    """Redact every URL inside free text (exception messages, server error bodies)."""
    return _redact_loose(_URL_RE.sub(lambda m: public_url(m.group(0)), str(text)))


# ---------------------------------------------------------------- URLs and auth

def split_endpoint(base_url):
    """Return (scheme, host, port, path, query, auth_header) or raise ConnectionFailed."""
    try:
        parts = urlsplit(str(base_url or "").strip())
        port = parts.port
    except ValueError as exc:
        raise ConnectionFailed("invalid URL %s: %s" % (public_url(base_url), exc)) from None
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ConnectionFailed("invalid URL %s: expected http(s)://host[:port]/v1" % public_url(base_url))
    auth = None
    if parts.username is not None or parts.password is not None:
        user, pw = unquote(parts.username or ""), unquote(parts.password or "")
        if pw:
            auth = "Basic " + base64.b64encode(("%s:%s" % (user, pw)).encode("utf-8")).decode("ascii")
        elif user:
            auth = "Bearer " + user  # token passed as the URL username
    port = port or (443 if parts.scheme == "https" else 80)
    return parts.scheme, parts.hostname, port, parts.path.rstrip("/"), parts.query, auth


def detect_backend(base_url):
    try:
        scheme, host, port, _path, _q, _a = split_endpoint(base_url)
    except ConnectionFailed:
        return "custom"
    if scheme == "http" and host.lower() in LOCAL_HOSTS:
        return PORT_BACKENDS.get(port, "custom")
    return "custom"


def _headers(api_key, extra=None, url_auth=None):
    h = {"Accept": "application/json", "User-Agent": "local-llm-bench"}
    if extra:
        h.update(extra)
    if api_key:
        h["Authorization"] = "Bearer %s" % api_key
    elif url_auth:
        h["Authorization"] = url_auth
    return h


# ---------------------------------------------------------------- transport

def _resolve(host, port, timeout):
    """getaddrinfo ignores socket timeouts, so run it in a thread and stop waiting after `timeout`."""
    found = {}

    def work():
        try:
            found["addrs"] = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except Exception as exc:  # noqa: BLE001
            found["error"] = exc

    t = threading.Thread(target=work, daemon=True)
    t.start()
    t.join(timeout)
    if t.is_alive():
        raise ConnectionFailed("DNS lookup for %s timed out after %.0f s" % (host, timeout))
    if "error" in found:
        raise ConnectionFailed("DNS lookup failed for %s: %s" % (host, found["error"]))
    return found["addrs"]


def _connect(host, port, connect_timeout):
    last = None
    for family, socktype, proto, _canon, addr in _resolve(host, port, connect_timeout):
        sock = socket.socket(family, socktype, proto)
        sock.settimeout(connect_timeout)
        try:
            sock.connect(addr)
            return sock
        except socket.timeout:
            last = "connect timed out after %.0f s" % connect_timeout
        except OSError as exc:
            last = exc.strerror or str(exc)
        sock.close()
    raise ConnectionFailed("cannot connect to %s:%d: %s" % (host, port, last or "no addresses"))


class _Conn(http.client.HTTPConnection):
    def __init__(self, host, port, connect_timeout, read_timeout):
        super().__init__(host, port, timeout=read_timeout)
        self._ct, self._rt = connect_timeout, read_timeout

    def connect(self):
        self.sock = _connect(self.host, self.port, self._ct)
        self.sock.settimeout(self._rt)


class _TLSConn(_Conn):
    def connect(self):
        raw = _connect(self.host, self.port, self._ct)
        try:
            self.sock = ssl.create_default_context().wrap_socket(raw, server_hostname=self.host)
        except (ssl.SSLError, OSError) as exc:
            raw.close()
            raise ConnectionFailed("TLS handshake with %s failed: %s" % (self.host, exc)) from None
        self.sock.settimeout(self._rt)


def http_json(method, url, api_key=None, body=None, timeout=30, extra_headers=None,
              connect_timeout=CONNECT_TIMEOUT):
    """Request `url`; userinfo in the URL becomes an Authorization header, never part of the request line."""
    scheme, host, port, path, query, url_auth = split_endpoint(url)
    shown = public_url(url)
    headers = _headers(api_key, extra_headers, url_auth)
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    target = quote(path or "/", safe="/%:@!$&'()*+,;=-._~") + ("?" + query if query else "")
    conn = (_TLSConn if scheme == "https" else _Conn)(host, port, min(connect_timeout, timeout), timeout)
    try:
        conn.request(method, target, body=data, headers=headers)
        resp = conn.getresponse()
        status = resp.status
        raw = resp.read().decode("utf-8", errors="replace")
    except ConnectionFailed as exc:
        raise ConnectionFailed("request to %s failed: %s" % (shown, exc)) from None
    except (socket.timeout, TimeoutError):
        raise ClientError("timeout after %.0f s waiting for %s" % (timeout, shown)) from None
    except (ConnectionError, http.client.HTTPException, OSError) as exc:
        raise ConnectionFailed("request to %s failed: %s" % (shown, redact_text(exc))) from None
    finally:
        conn.close()
    if status >= 400:
        raise ClientError("HTTP %s for %s: %s" % (status, shown, redact_text(raw[:300])))
    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        raise ClientError("non-JSON response from %s: %s" % (shown, redact_text(raw[:200]))) from None


def _join(base_url, suffix):
    """Append a path segment before any query string."""
    parts = urlsplit(base_url)
    return parts._replace(path=parts.path.rstrip("/") + suffix).geturl()


def list_models(base_url, api_key=None, timeout=2.0, connect_timeout=CONNECT_TIMEOUT):
    data = http_json("GET", _join(base_url, "/models"), api_key=api_key, timeout=timeout,
                     connect_timeout=connect_timeout)
    items = data.get("data") if isinstance(data, dict) else None
    out = []
    for item in items or []:
        if isinstance(item, dict) and item.get("id"):
            out.append(item["id"])
        elif isinstance(item, str):
            out.append(item)
    return out


def chat_completion(base_url, model, messages, api_key=None, temperature=0, max_tokens=512,
                    timeout=120, extra_headers=None, connect_timeout=CONNECT_TIMEOUT):
    data = http_json(
        "POST", _join(base_url, "/chat/completions"), api_key=api_key,
        body={"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens},
        timeout=timeout, extra_headers=extra_headers, connect_timeout=connect_timeout,
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
