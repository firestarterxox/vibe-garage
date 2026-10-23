"""Load the vendored LiteLLM price snapshot and compute cost-if-you-paid."""
import json
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parent / "data" / "prices.json"


def load_prices(path=None):
    with Path(path or DEFAULT_PATH).open(encoding="utf-8") as f:
        return json.load(f)


def find_model_price(prices, name):
    """Exact key, then the same name without a provider prefix, then without a -latest suffix."""
    models = (prices or {}).get("models") or {}
    if not name:
        return None, None
    by_leaf = {}
    for key in models:
        by_leaf.setdefault(key.split("/")[-1].lower(), key)
    leaf = name.split("/")[-1].lower()
    for candidate in (name, leaf, leaf[:-7] if leaf.endswith("-latest") else None):
        if candidate and candidate in models:
            return candidate, models[candidate]
        if candidate and candidate.lower() in by_leaf:
            key = by_leaf[candidate.lower()]
            return key, models[key]
    return None, None


def run_cost_usd(spec, prompt_tokens, completion_tokens):
    if not spec:
        return None
    try:
        inp = float(spec.get("input_cost_per_token") or 0)
        out = float(spec.get("output_cost_per_token") or 0)
    except (TypeError, ValueError):
        return None
    return (prompt_tokens or 0) * inp + (completion_tokens or 0) * out


def compare_costs(prices, names, prompt_tokens, completion_tokens):
    rows = []
    for name in names:
        name = name.strip()
        if not name:
            continue
        key, spec = find_model_price(prices, name)
        rows.append({
            "model": name,
            "priced_as": key,
            "input_cost_per_token": (spec or {}).get("input_cost_per_token"),
            "output_cost_per_token": (spec or {}).get("output_cost_per_token"),
            "run_cost_usd": run_cost_usd(spec, prompt_tokens, completion_tokens) if spec else None,
        })
    return rows


def fmt_usd(value):
    return "n/a" if value is None else "$%.6f" % value
