# Ops: activating automatic Discussions sync

`sync-and-deploy.yml` is a GitHub Actions workflow that rebuilds `data/discussions.json` and `data/projects.json`
from GitHub Discussions (on every discussion/comment event + hourly) and deploys the site to Pages.

It lives here because the CLI token used to publish lacks the `workflow` scope. To activate:
1. Move it to `.github/workflows/sync-and-deploy.yml` (web UI: Add file > Create new file, paste contents), or grant the CLI `workflow` scope (`gh auth refresh -h github.com -s workflow`) and push.
2. Settings > Pages > Build and deployment > Source: **GitHub Actions**.
Until then, `node scripts/sync-discussions.mjs` (uses the `gh` CLI locally) refreshes the JSON snapshot, which is committed.
