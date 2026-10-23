# How to run

Commands assume the current directory is `starters/local-llm-bench/`. Python 3.9+, nothing to install.

## Autodetect order

`python3 bench.py` with no flags uses the first server that answers `GET /v1/models`:

1. Ollama: `http://localhost:11434/v1`
2. LM Studio: `http://localhost:1234/v1`
3. llama.cpp: `http://localhost:9931/v1` (current `llama-server` default)
4. llama.cpp: `http://localhost:8080/v1` (older builds and Docker)

If nothing answers, it exits with code 2 and prints this list. With an explicit `--base-url`, it checks only that URL and prints the actual error instead.

## Tests (mock server, no real model)

```bash
python3 -m unittest discover -s tests
```

## Ollama

```bash
ollama serve            # skip if the Ollama app is already running
ollama pull qwen2.5:0.5b
python3 bench.py
python3 bench.py --model qwen2.5:0.5b
```

## LM Studio

Start the local server in the Developer tab and load a model, then:

```bash
python3 bench.py
python3 bench.py --base-url http://localhost:1234/v1 --model <model-id>
```

## llama.cpp

Current builds listen on port 9931 by default; older builds and Docker images use 8080. Autodetect tries 9931, then 8080.

```bash
llama-server -m model.gguf
python3 bench.py
python3 bench.py --base-url http://localhost:9931/v1 --model model.gguf
python3 bench.py --base-url http://localhost:8080/v1 --model model.gguf
```

If nothing is listening on the port you name, the harness prints `error: request to http://localhost:8080/v1/models failed: ... Connection refused` and exits 2 without running anything. Older builds use `--port 8080`; current ones default to 9931.

## Hosted endpoint

```bash
export BENCH_API_KEY='<token>'
python3 bench.py --base-url https://openrouter.ai/api/v1 --model google/gemma-4-26b-a4b-it:free
python3 bench.py --base-url "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1" --model "@cf/meta/llama-3.1-8b-instruct"
```

## Cost-column models

```bash
python3 bench.py --compare gpt-4o-mini,claude-haiku-4-5,gemini-2.5-flash
python3 bench.py --compare gpt-4o,claude-sonnet-4-5,gemini-2.5-pro
```

## Export location

```bash
python3 bench.py --out results
python3 bench.py --out results --quiet
ls results/latest.md results/latest.csv results/latest.json
```

Use a relative `--out` path in shared notes. Files are `results-<UTC>.{md,csv,json}` plus `latest.*` copies.

## Refresh prices

```bash
python3 scripts/refresh_prices.py
python3 scripts/refresh_prices.py --also gpt-4.1-mini,mistral/mistral-small-latest
python3 scripts/refresh_prices.py --keep-all
```

## One task

```bash
python3 bench.py --list-tasks
python3 bench.py --only ticket-triage,date-normalize
python3 bench.py --max-tasks 3
```
