#!/usr/bin/env python3
"""Download LiteLLM's model_prices_and_context_window.json and keep a short allowlist.

Usage:
  python3 scripts/refresh_prices.py                 # default allowlist
  python3 scripts/refresh_prices.py --also o3-pro   # add more model keys
  python3 scripts/refresh_prices.py --keep-all      # every chat model with per-token prices
"""
import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SRC = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
OUT = Path(__file__).resolve().parents[1] / "data" / "prices.json"

# Exact LiteLLM keys. Edit freely; unknown keys are reported and skipped.
KEEP = [
    "gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
    "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-chat-latest", "o3", "o3-mini", "o4-mini",
    "claude-haiku-4-5", "claude-sonnet-4-5", "claude-sonnet-4-6", "claude-opus-4-5",
    "claude-opus-4-6", "claude-opus-4-7", "claude-opus-4-8",
    "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro",
    "vertex_ai/gemini-2.0-flash", "vertex_ai/gemini-2.0-flash-lite", "vertex_ai/claude-3-5-haiku",
    "mistral/mistral-small-latest", "mistral/mistral-medium-latest", "mistral/mistral-large-latest",
    "mistral/open-mistral-nemo", "deepseek-chat",
    "xai/grok-4.3", "xai/grok-4.5", "xai/grok-4.6", "xai/grok-4.7", "xai/grok-4.20",
]


def priced_chat(spec):
    if not isinstance(spec, dict) or spec.get("mode") != "chat":
        return False
    try:
        float(spec["input_cost_per_token"])
        float(spec["output_cost_per_token"])
        return True
    except (KeyError, TypeError, ValueError):
        return False


def main(argv=None):
    p = argparse.ArgumentParser(description="Refresh the vendored LiteLLM price snapshot.")
    p.add_argument("--also", default="", help="comma-separated extra LiteLLM model keys")
    p.add_argument("--keep-all", action="store_true", help="keep every priced chat model (large file)")
    p.add_argument("--out", default=str(OUT))
    args = p.parse_args(argv)

    req = urllib.request.Request(SRC, headers={"User-Agent": "local-llm-bench-refresh"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print("download failed: %s" % exc, file=sys.stderr)
        return 1

    wanted = list(data) if args.keep_all else KEEP + [x.strip() for x in args.also.split(",") if x.strip()]
    models, missing = {}, []
    for name in wanted:
        spec = data.get(name)
        if name != "sample_spec" and priced_chat(spec):
            models[name] = {k: spec[k] for k in ("input_cost_per_token", "output_cost_per_token")}
        elif not args.keep_all:
            missing.append(name)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {"source": SRC, "license": "MIT",
               "fetched": datetime.now(timezone.utc).date().isoformat(), "models": models}
    out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print("kept %d models -> %s" % (len(models), out))
    if missing:
        print("not found or not priced (skipped): %s" % ", ".join(missing), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
