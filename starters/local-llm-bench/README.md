# Local LLM Bench

Local LLM Bench is a small Python 3 harness that sends a synthetic pack of about 20 IT / small-business tasks to any OpenAI-compatible `POST {base_url}/chat/completions` endpoint (Ollama, LM Studio, llama.cpp server, Cloudflare Workers AI, OpenRouter) and grades each reply with **rules only** — no AI judge. The pack is invented demo data and a small sample; it is not a general model ranking. The model is what is being tested.

## Requirements

- Python 3.9 or newer
- Nothing to install (standard library only)

Run commands from this folder: `starters/local-llm-bench/`.

## Quickstart

### Ollama (~2 minutes)

```bash
ollama serve            # skip if the Ollama app is already running
ollama pull qwen2.5:0.5b
python3 bench.py
```

Ollama's OpenAI-compatible base URL is `http://localhost:11434/v1`. Pass `--model qwen2.5:0.5b` if more than one model is loaded.

### LM Studio (~2 minutes)

Start the local server in the **Developer** tab, load a model, then:

```bash
python3 bench.py
```

LM Studio typically listens on `http://localhost:1234/v1`.

### llama.cpp (~2 minutes)

```bash
llama-server -m model.gguf
python3 bench.py
```

Current `llama-server` builds listen on `http://localhost:9931/v1` by default. Older builds and many Docker images use `http://localhost:8080/v1`; the harness checks both.

### Cloudflare Workers AI

Base URL:

`https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1`

```bash
export BENCH_API_KEY='<token>'
python3 bench.py \
  --base-url "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1" \
  --model "@cf/meta/llama-3.1-8b-instruct"
```

Workers AI includes a daily free allocation; usage beyond that is billed. See [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

### OpenRouter

```bash
export BENCH_API_KEY='<token>'
python3 bench.py \
  --base-url "https://openrouter.ai/api/v1" \
  --model "google/gemma-4-26b-a4b-it:free"
```

Free-route (`:free`) models are rate-limited, and the free lineup changes often; if that id is gone, pick a current `:free` model from [openrouter.ai/models](https://openrouter.ai/models). See [OpenRouter limits](https://openrouter.ai/docs/api_reference/limits).

Never pass an API key as a CLI flag. The harness reads the key only from the environment variable named by `--api-key-env` (default `BENCH_API_KEY`) and never prints it.

With no arguments, the harness probes these in order (`GET /models`, 2 second timeout each) and uses the first server that answers, with the first model it lists:

1. Ollama: `http://localhost:11434/v1`
2. LM Studio: `http://localhost:1234/v1`
3. llama.cpp: `http://localhost:9931/v1` (current `llama-server` default)
4. llama.cpp: `http://localhost:8080/v1` (older builds and Docker)

If none answer, it prints a short message and exits 2. Use `--base-url` and `--model` to pick something else.

## How grading works

Before checks run, `<think>...</think>` blocks are stripped. A task passes only if **every** check passes.

| Type | What it does |
| --- | --- |
| `exact` | Whole output equals `value`. Optional `normalize` (default true): lowercase, strip, collapse whitespace, strip surrounding quotes/backticks and a trailing period. |
| `one_of` | Normalized output equals one of `values`. |
| `contains_all` | Output contains every string in `values` (`case_sensitive` default false). |
| `contains_none` | Output contains none of `values`. |
| `regex` | `re.search` of `pattern`; `flags` may include `i`, `m`, `s`. |
| `json` | Parse the first JSON object/array (fences and leading prose allowed). Every path in `keys` must exist. Every `required` path must equal its value (strings normalized; numbers ±0.01). Dotted paths such as `customer.email` and `0.email` work. |
| `number` | First number in the output (commas and `$` allowed) compared to `value` within `tolerance`. |
| `regex_run` | Extract a regex from a code fence or the first line, reject patterns longer than 300 characters, then `re.fullmatch` each `should_match` / `should_not_match` case in a child process. If that takes longer than `timeout` seconds (default 2), the child is killed and the check fails with `regex timed out`. |
| `max_words` | Word count of the output is ≤ `value`. |

Unknown check types fail with detail `unknown check type`.

## Add a task

1. Copy a file in `tasks/`.
2. Give it a new `id`, a strict `prompt` (ask for a single unambiguous format), `"synthetic": true`, and `checks`.
3. Use invented names, `example.com` / `example.org` / `example.net` mail, placeholder client names instead of IP addresses (`client-a`), and `555-01xx` phones.
4. Add a correct answer in `tests/mock_answers.json`.
5. Run one task: `python3 bench.py --only your-id`

## Outputs

Default directory: `results/`.

- `results-<UTC timestamp>.md` / `.csv` / `.json`
- copies named `latest.md` / `latest.csv` / `latest.json`

The terminal table lists Task, Category, Pass, Latency ms, In tok, Out tok and **If paid** (that task's cost at the first `--compare` model's list price), then pass count, token totals, and a whole-run **cost if you paid** block for every `--compare` model.

Exit codes:

- `0`: the run completed and at least one task got an answer from the model, including runs where tasks failed grading or some tasks errored.
- `1`: an unknown `--only` id or an empty task folder. (Command-line usage errors exit 2, which is argparse's default.)
- `2`: nothing to run against. Either autodetect found no server, or the `--base-url` you gave is invalid, refused the connection, fails DNS, times out on connect, rejected the credentials (HTTP 401 or 403 from `GET /models` prints `authentication failed (HTTP 401): check BENCH_API_KEY or URL credentials`), or has no models and you didn't pass `--model`. Before the run, the harness checks the endpoint with one `GET /models` call (5 second timeout). If that fails, it prints the error and runs nothing.
- `3`: the run was aborted because the server stopped accepting connections partway through. It stops at the first connection error, prints which task hit it, and writes no results.
- `4`: every task errored (an HTTP error such as 500, a read timeout past `--timeout`, or an unreadable response), so the model answered nothing. Results are still written so you can inspect them, and stderr prints `error: all N tasks failed with an error; first error (task <id>): <message>`.

HTTP errors and slow answers that go past `--timeout` don't abort the run; they're recorded as failed tasks. A failed task shows `-` for tokens and cost in the table and Markdown, blank cells in the CSV, and `null` in the JSON.

`HTTP_PROXY` / `HTTPS_PROXY` (and lowercase variants) are ignored: the tool is local-first and always connects straight to the `--base-url` host.

DNS lookup and connect get their own short timeout (`--connect-timeout`, 5 s by default), separate from `--timeout`, so a host that doesn't resolve fails in seconds instead of minutes.

If `/models` lists models and `--model` isn't one of them, the harness prints a warning and runs anyway, since llama.cpp accepts any model name.

**Credentials:** you can pass `--base-url` with `user:password@` or `token@`. The harness strips that part from the request URL and sends it as an `Authorization` header instead: `Basic` for user:password, `Bearer` for a token alone. A key in `BENCH_API_KEY` takes priority. Every URL the harness prints or exports has userinfo removed and secret-looking query values (`api_key`, `key`, `token`, `access_token`, `secret`, `password`, `auth`) replaced with `REDACTED`. If a server echoes credentials back in an error body, the key itself, URL credentials, `Bearer`/`Basic` tokens and secret-named JSON fields (such as `"api_key": "..."`) are replaced with `REDACTED` too, in terminal output and in the exported files.

CSV columns: `task_id,title,category,pass,latency_ms,prompt_tokens,completion_tokens,tokens_estimated,error` plus `cost_<model>` for each compare model.

If the server omits `usage`, tokens are estimated as `ceil(chars/4)` and `tokens_estimated` is true.

## JSON schema v1

```json
{
  "schema_version": 1,
  "tool": "local-llm-bench",
  "run": {
    "started_at": "ISO8601 UTC",
    "finished_at": "ISO8601 UTC",
    "base_url": "http://localhost:9931/v1",
    "backend": "ollama|lmstudio|llamacpp|custom",
    "model": "string",
    "temperature": 0,
    "task_pack": {"count": 20, "hash": "sha256 of the sorted task files"}
  },
  "summary": {
    "passed": 0,
    "total": 0,
    "pass_rate": 0.0,
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "tokens_estimated": false,
    "latency_ms_median": 0
  },
  "prices": {
    "source": "url",
    "license": "MIT",
    "as_of": "YYYY-MM-DD",
    "compare": [
      {
        "model": "gpt-4o-mini",
        "priced_as": "gpt-4o-mini (LiteLLM key, null if not found)",
        "input_cost_per_token": 0.0,
        "output_cost_per_token": 0.0,
        "run_cost_usd": 0.0
      }
    ]
  },
  "results": [
    {
      "task_id": "ticket-triage",
      "title": "string",
      "category": "string",
      "pass": true,
      "checks": [{"type": "exact", "pass": true, "detail": "string"}],
      "latency_ms": 0,
      "prompt_tokens": 0,
      "completion_tokens": 0,
      "tokens_estimated": false,
      "error": null,
      "output": "raw model text"
    }
  ]
}
```

`pass_rate` is `passed / total` in the range 0 to 1. Raw model output is included so you can verify grading.

## Cost column caveat

The vendored snapshot is **prices as of 2026-10-23** (the `fetched` field in `data/prices.json`). Refresh it with the script below.

The cost column is what **the same token counts** would cost at list prices from a third-party LiteLLM snapshot. Different tokenizers count differently, so it is an estimate. Prices change; check the provider's own page before you spend money.

## Refreshing prices

```bash
python3 scripts/refresh_prices.py
```

The script downloads LiteLLM's file (about 3 MB), keeps the short allowlist in `KEEP` (exact LiteLLM keys), and writes `data/prices.json` with today's date as `fetched`. That date is printed as "prices as of" under every run. `--also key1,key2` adds keys; `--keep-all` keeps every priced chat model. A `--compare` name matches the exact key, then the key without a provider prefix (`grok-4.6` finds `xai/grok-4.6`), then without `-latest`. Unmatched names show `n/a`.

## Running the tests

```bash
python3 -m unittest discover -s tests
```

Tests start a stdlib mock server on `127.0.0.1` (ephemeral port). They do not need a real LLM.

## CLI flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `--base-url` | autodetect | OpenAI-compatible base including `/v1` |
| `--model` | first listed | Model id |
| `--api-key-env` | `BENCH_API_KEY` | Env var that holds the key |
| `--tasks` | `tasks/` | Task directory |
| `--only` | all | Comma-separated task ids |
| `--out` | `results/` | Export directory |
| `--compare` | `gpt-4o-mini,claude-haiku-4-5,gemini-2.5-flash` | Cost-column models |
| `--timeout` | 120 | Per-request read timeout in seconds (how long a model may take) |
| `--connect-timeout` | 5 | Seconds for DNS lookup and TCP/TLS connect |
| `--temperature` | 0 | Sampling temperature |
| `--max-tasks` | unlimited | Cap |
| `--quiet` | off | Skip the table; print one line with the export paths |
| `--list-tasks` | off | Print ids and exit |

## Credits

Built with Grok Build.

Price data is a trimmed snapshot of [BerriAI/litellm](https://github.com/BerriAI/litellm) `model_prices_and_context_window.json`, MIT licensed. The LiteLLM `enterprise/` tree is excluded and is not used. See `data/LITELLM-LICENSE.txt`.
