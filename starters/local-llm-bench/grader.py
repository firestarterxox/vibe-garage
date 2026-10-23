"""Pure rule-based grading. No I/O, no mutated globals, deterministic."""
import json
import re
import threading

_THINK_RE = re.compile(r"<think>[\s\S]*?</think>", re.I)
_FENCE_RE = re.compile(r"```(?:[a-zA-Z0-9_+-]*)\s*\n?([\s\S]*?)```")
_NUM_RE = re.compile(r"[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[-+]?\d+(?:\.\d+)?")


def strip_think(text):
    return _THINK_RE.sub("", text or "").strip()


def normalize_text(s):
    s = re.sub(r"\s+", " ", (s or "").strip().lower()).strip("'\"`").rstrip(".")
    return s.strip()


def extract_json(text):
    blob = text or ""
    m = _FENCE_RE.search(blob)
    if m:
        blob = m.group(1)
    decoder = json.JSONDecoder()
    for i, ch in enumerate(blob):
        if ch in "{[":
            try:
                obj, _ = decoder.raw_decode(blob[i:])
                return obj
            except json.JSONDecodeError:
                continue
    return None


def extract_number(text):
    m = _NUM_RE.search((text or "").replace("$", " "))
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def extract_pattern(text):
    blob = (text or "").strip()
    m = _FENCE_RE.search(blob)
    if m:
        pat = m.group(1).strip()
    else:
        pat = next((ln.strip() for ln in blob.splitlines() if ln.strip()), blob)
    pat = pat.strip().strip("`").strip()
    if len(pat) >= 2 and pat.startswith("/") and pat.rfind("/") > 0:
        pat = pat[1 : pat.rfind("/")]
    if len(pat) >= 2 and pat[0] == pat[-1] and pat[0] in "\"'":
        pat = pat[1:-1]
    if (pat.startswith("r'") and pat.endswith("'")) or (pat.startswith('r"') and pat.endswith('"')):
        pat = pat[2:-1]
    return pat.strip()


def _path_get(obj, path):
    cur = obj
    for part in path.split("."):
        if isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return None, False
        elif isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None, False
    return cur, True


def _json_equal(expected, actual):
    if expected is None:
        return actual is None
    if isinstance(expected, bool) or isinstance(actual, bool):
        return expected == actual
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        try:
            return abs(float(expected) - float(actual)) <= 0.01
        except (TypeError, ValueError):
            return False
    if isinstance(expected, str) and isinstance(actual, str):
        return normalize_text(expected) == normalize_text(actual)
    return expected == actual


def _fullmatch_timeout(pattern, text, timeout=0.4):
    box = []

    def run():
        try:
            box.append(bool(re.fullmatch(pattern, text)))
        except Exception as exc:
            box.append(exc)

    th = threading.Thread(target=run, daemon=True)
    th.start()
    th.join(timeout)
    if th.is_alive() or not box:
        return "timeout"
    return box[0]


def _ok(ctype, passed, detail):
    return {"type": ctype, "pass": bool(passed), "detail": detail}


def _flags(spec):
    spec = (spec or "").lower()
    return (re.I if "i" in spec else 0) | (re.M if "m" in spec else 0) | (re.S if "s" in spec else 0)


def _needles(values, case_sensitive):
    return values if case_sensitive else [str(v).lower() for v in values]


def _grade_check(check, output):
    ctype = check.get("type")
    if not ctype:
        return _ok("unknown", False, "unknown check type")

    if ctype == "exact":
        do_norm = check.get("normalize", True)
        got = normalize_text(output) if do_norm else output.strip()
        exp = normalize_text(check.get("value", "")) if do_norm else check.get("value", "")
        return _ok(ctype, got == exp, "match" if got == exp else "expected %r got %r" % (exp, got))

    if ctype == "one_of":
        values = check.get("values") or []
        got = normalize_text(output)
        passed = any(got == normalize_text(str(v)) for v in values)
        return _ok(ctype, passed, "match" if passed else "got %r not in %s" % (got, values))

    if ctype in ("contains_all", "contains_none"):
        values = check.get("values") or []
        cs = bool(check.get("case_sensitive", False))
        hay = output if cs else output.lower()
        hit = [v for v, n in zip(values, _needles(values, cs)) if n in hay]
        if ctype == "contains_all":
            missing = [v for v in values if v not in hit]
            return _ok(ctype, not missing, "ok" if not missing else "missing %s" % missing)
        return _ok(ctype, not hit, "ok" if not hit else "found forbidden %s" % hit)

    if ctype == "regex":
        pattern = check.get("pattern") or ""
        try:
            rx = re.compile(pattern, _flags(check.get("flags") or ""))
        except re.error as exc:
            return _ok(ctype, False, "bad pattern: %s" % exc)
        m = rx.search(output)
        return _ok(ctype, bool(m), "matched" if m else "no match for %s" % pattern)

    if ctype == "json":
        obj = extract_json(output)
        if obj is None:
            return _ok(ctype, False, "no JSON found")
        keys, required, problems = check.get("keys") or [], check.get("required") or {}, []
        if isinstance(obj, list):
            if not obj:
                problems.append("empty array")
            else:
                for i, item in enumerate(obj):
                    for k in keys:
                        if not _path_get(item, k)[1]:
                            problems.append("missing %s on item %d" % (k, i))
        else:
            for k in keys:
                if not _path_get(obj, k)[1]:
                    problems.append("missing key %s" % k)
        for path, expected in required.items():
            actual, ok = _path_get(obj, path)
            if not ok:
                problems.append("missing required %s" % path)
            elif not _json_equal(expected, actual):
                problems.append("%s: expected %r got %r" % (path, expected, actual))
        return _ok(ctype, not problems, "ok" if not problems else "; ".join(problems))

    if ctype == "number":
        got = extract_number(output)
        if got is None:
            return _ok(ctype, False, "no number found")
        want, tol = float(check.get("value")), float(check.get("tolerance", 0.01))
        passed = abs(got - want) <= tol
        return _ok(ctype, passed, "got %s" % got if passed else "expected %s±%s got %s" % (want, tol, got))

    if ctype == "regex_run":
        pat = extract_pattern(output)
        if not pat:
            return _ok(ctype, False, "no pattern extracted")
        if len(pat) > 300:
            return _ok(ctype, False, "pattern longer than 300 chars")
        try:
            re.compile(pat)
        except re.error as exc:
            return _ok(ctype, False, "does not compile: %s" % exc)
        problems = []
        for want_match, cases in ((True, check.get("should_match") or []), (False, check.get("should_not_match") or [])):
            for case in cases:
                r = _fullmatch_timeout(pat, str(case))
                if r == "timeout":
                    problems.append("timeout matching %r" % case)
                elif isinstance(r, Exception):
                    problems.append("error on %r: %s" % (case, r))
                elif bool(r) != want_match:
                    problems.append(("should match %r" if want_match else "should not match %r") % case)
        return _ok(ctype, not problems, "ok (%s)" % pat if not problems else "; ".join(problems))

    if ctype == "max_words":
        limit, n = int(check.get("value", 0)), len(output.split())
        return _ok(ctype, n <= limit, "%d words" % n if n <= limit else "%d words > %d" % (n, limit))

    return _ok(str(ctype), False, "unknown check type")


def grade(task, output):
    """Grade `output` against `task["checks"]`. Task passes iff every check passes."""
    cleaned = strip_think(output if output is not None else "")
    checks = []
    for check in task.get("checks") or []:
        if not isinstance(check, dict):
            checks.append(_ok("unknown", False, "unknown check type"))
        else:
            checks.append(_grade_check(check, cleaned))
    return {"pass": bool(checks) and all(c["pass"] for c in checks), "checks": checks}
