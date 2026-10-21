# Agent notes

## Code graph (graphify)
- A code-only graph of this repo lives in `graphify-out/` (gitignored). The post-commit hook rebuilds it. No LLM and no API keys are used. `.graphifyignore` keeps secrets, keys and env files out of it.
- Lookup rules for agents:
  1. Exact names (a function, var, file or string you already know): use `rg`.
  2. Relationships (what calls, loads, instantiates, extends or connects to X; where is X set up): run `tools/graphify/gq "<question>"` once. Output is at most 8 lines of `file:line symbol (relation)`, about 400 tokens max. Use `--more 1` for the next page.
  3. If that one `gq` call doesn't answer it, go back to `rg`. Don't keep re-querying.
  4. Never run raw `graphify query`. Its output is unbounded (thousands of tokens).
- Always open the cited `file:line` before relying on it.
