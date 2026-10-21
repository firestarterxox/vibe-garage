# Vibe Garage
A community hub for people who build with AI: a project showcase, a forum with positive-only reactions, a 3-step submit form with an in-browser leaked-secret check, and community guidelines.

**Live site:** https://firestarterxox.github.io/vibe-garage/

## How it works
- **Sign in with GitHub.** There are no separate accounts. You post, reply and react with your own GitHub account.
- **Forum and project submissions run on [GitHub Discussions](https://github.com/firestarterxox/vibe-garage/discussions).** Forum threads are discussions; the submit form checks your post for API keys and passwords, then opens a pre-filled discussion for you to publish.
- **Replies and reactions on the site** are embedded with [giscus](https://giscus.app), which reads and writes the same GitHub Discussions.
- **Listings** (projects and threads) come from `data/projects.json` and `data/discussions.json`, generated from Discussions by `scripts/sync-discussions.mjs`. Until a project is posted, the site shows empty states instead of placeholder content.

## Tech
Plain HTML/CSS/vanilla JS, hosted on GitHub Pages. Backend config lives in `assets/config.js`. A sync-and-deploy workflow is staged in `ops/` (see `ops/README.md`).

Icons: [Lucide](https://lucide.dev) (ISC). Fonts: Google Fonts (OFL). Project cover art is generated in the browser.
