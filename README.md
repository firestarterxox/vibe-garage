# Vibe Garage

A community hub for people who build with AI: a project showcase, a forum, challenges, guides, and builder profiles. There are no separate accounts. You post, reply, and react with your own GitHub account.

**Live site:** https://firestarterxox.github.io/vibe-garage/

## How it works

- **Forum and project submissions run on [GitHub Discussions](https://github.com/firestarterxox/vibe-garage/discussions).** The submit form checks a post for API keys and passwords in the browser, then opens a pre-filled discussion for you to publish.
- **Replies and reactions on a project or thread** are embedded with [giscus](https://giscus.app) (`repoId` `R_kgDOVRg6Zw`). giscus reads and writes the same GitHub Discussion.
- **Listings are a snapshot.** `scripts/sync-discussions.mjs` reads Discussions with `gh api graphql` (or `GITHUB_TOKEN` in Actions) and writes the JSON, Atom feed, sitemap, and `robots.txt` below. Until something is posted, the site shows an empty state instead of placeholder content.
- **Backend config** lives in `assets/config.js` (repo, category names, giscus theme, site URL, analytics). The sync script loads that same file.

The site is plain HTML, CSS, and vanilla JS on GitHub Pages. There is no build step and no npm install.

## Pages

| Page | Role |
| --- | --- |
| `index.html` | Home |
| `projects.html`, `project.html?id=gh-N` | Showcase and one project (giscus on the project page) |
| `forum.html`, `thread.html?id=gh-N` | Channels and one thread (giscus on the thread page) |
| `challenges.html` | Challenges, fed by `data/challenges.json` |
| `learn.html`, `learn.html?g=N` | Guide list and one guide, fed by `data/guides.json` |
| `profile.html`, `profile.html?u=<login>` | Builders directory and one member, fed by `data/members.json` |
| `submit.html` | Three-step project form with the leaked-secret check |
| `guidelines.html` | Community guidelines, reporting, mods |

## Posting conventions

The sync classifies a discussion from its title, category, and body.

- **Project.** Body contains `<!-- vibe-garage:project -->`, or the discussion is in a category literally named `Projects`. The submit form writes the marker and `### Pitch`, `### Tools`, `### Tags`, `### Feedback wanted`, `### Live link`, `### Repo`, `### Code`, and `### Prompts` sections. A title may start with `[project]`; the showcase drops that prefix.
- **Guide.** Title starts with `[Guide]`. Synced to `data/guides.json` (and still listed as a forum thread unless it is also a project).
- **Challenge.** Title starts with `[Challenge]`, or the discussion is in the **Polls** category. Synced to `data/challenges.json`.
- **Deadline.** A line `Deadline: YYYY-MM-DD` in the body sets `deadline`. Any other date shape is ignored.
- **Poll.** A GitHub Discussion poll is stored as `poll.question` and `poll.options[].option` / `totalVoteCount`. Thumbs-up reactions are stored separately as `thumbsUp` for challenges that are voted that way.
- **Status.** `open` or `closed`, from the discussion's closed flag.
- **Everything else** is a forum thread. Category names map to site channels in `assets/config.js`.

Feedback lines (`Feedback level:` / `Feedback wanted:`) map to `vibes`, `gentle`, or `tear`.

## Data files

All JSON files include `generated` (ISO time of the sync) and `real: true` on each record. An empty Discussions repo still produces valid files with empty arrays.

| File | Contents |
| --- | --- |
| `data/discussions.json` | Categories, channel map, and forum threads. Each thread has the full reaction breakdown. |
| `data/projects.json` | Showcase projects parsed from the `###` sections, plus the same reaction breakdown. `likes` is reaction total plus GitHub upvotes. |
| `data/members.json` | One row per discussion or comment author: `login`, `avatar`, `url`, `projects`, `threads`, `replies`, `reactions` (reactions received), `score`, `firstSeen`, `lastSeen`. |
| `data/challenges.json` | Challenge cards: title, author, body HTML, excerpt, labels, deadline, status, thumbs-up count, poll options and vote counts, reactions, dates, discussion URL. |
| `data/guides.json` | Guides: title (prefix removed), author, `bodyHTML`, excerpt, tags/labels, reactions, URL, dates. |
| `feed.xml` | Atom feed. Links are absolute URLs from `siteUrl` (`project.html?id=` or `thread.html?id=`). |
| `sitemap.xml` | Every root `*.html` page except `404.html`, plus each `project.html?id=` and `thread.html?id=` URL. Home is the site root. |
| `robots.txt` | `Allow: /` for all user agents, plus a `Sitemap:` line. |

### Reaction breakdown

Every project, thread, guide, and challenge stores all eight GitHub reaction types: `thumbsUp`, `thumbsDown`, `laugh`, `hooray`, `confused`, `heart`, `rocket`, `eyes`, plus `total`. `thumbs` is the same number as `thumbsUp`, kept so older readers still work.

### Leaderboard score

```
score = projects*10 + threads*3 + replies*1 + reactions
```

`reactions` is the total reactions received on that person's discussions and on their comments. A project counts as a project. Any other discussion (thread, guide, challenge, announcement) counts as a thread. Replies are comments they wrote.

`commentSample` in `members.json` is 50. The sync reads `comments(first: 50)`, so reply totals and comment-author rows cover the first 50 comments on each discussion. The `replies` field on a thread still uses GitHub's full comment count.

`firstSeen` / `lastSeen` are the earliest and latest `createdAt` among that person's discussions and sampled comments.

## Feed, sitemap, robots

- **Feed:** `https://firestarterxox.github.io/vibe-garage/feed.xml`
- **Sitemap:** `https://firestarterxox.github.io/vibe-garage/sitemap.xml`
- **Watch the repo:** https://github.com/firestarterxox/vibe-garage/subscription
- **Discussions:** https://github.com/firestarterxox/vibe-garage/discussions

The feed's `<updated>` time is the newest entry. With no discussions it stays `1970-01-01T00:00:00Z`, so an empty feed does not change on every run. Sitemap `<lastmod>` is set only on project and thread URLs, from that discussion's `updatedAt`.

## Refreshing the snapshot

**GitHub Actions is currently unavailable** because the account is under a billing lock. `.github/workflows/sync-and-deploy.yml` is still the workflow that syncs Discussions, commits the snapshot, and deploys GitHub Pages, but it cannot run until billing is restored.

Until then, refresh the snapshot from a checkout with the [`gh`](https://cli.github.com/) CLI logged in (`gh auth login`) or with `GITHUB_TOKEN` set:

```bash
./scripts/refresh.sh
```

`scripts/refresh.sh` (`set -euo pipefail`):

1. `cd` to the repo root.
2. `git pull --rebase`.
3. `node scripts/sync-discussions.mjs`.
4. If `data/`, `feed.xml`, `sitemap.xml`, or `robots.txt` changed beyond the JSON `"generated"` timestamp, `git add` those paths, commit `Sync discussions snapshot`, and `push`.

A run that only refreshes `"generated"` does not create a commit. The script does not deploy GitHub Pages. Pushing updates the files in the repo; the live site updates when the Actions workflow can run again.

To regenerate the files without committing:

```bash
node scripts/sync-discussions.mjs
```

The script calls `gh` with `FORCE_COLOR=0`, `NO_COLOR=1`, `CLICOLOR=0`, and `GH_FORCE_TTY=0`, then strips ANSI color codes before `JSON.parse`. That matters when the parent environment sets `FORCE_COLOR`, because `gh` will otherwise color its JSON and the parse will fail.

Auth order: `GITHUB_TOKEN` uses the GitHub GraphQL API directly. With no token, the script shells out to `gh`.

The sync keeps up to 300 discussions (6 pages of 50), newest update first.

## Analytics (optional, off by default)

[GoatCounter](https://www.goatcounter.com/) is a free, lightweight counter. It stays **off** until you set a site code.

In `assets/config.js`:

```js
analytics: { goatcounter: "" }
```

An empty string means analytics are disabled and no analytics script is loaded.

To enable:

1. Create a free site at https://www.goatcounter.com/.
2. Set `goatcounter` to the site code only, the subdomain of `https://CODE.goatcounter.com`. For `https://vibe-garage.goatcounter.com`, the flag is `"vibe-garage"`.
3. A non-empty code is what turns the counter on. The page should then include `https://gc.zgo.at/count.js` with `data-goatcounter="https://CODE.goatcounter.com/count"`. Leave the string empty and that script stays unloaded.

Set it back to `""` to turn analytics off again.

## Tech

Plain HTML, CSS, and vanilla JS. Icons: [Lucide](https://lucide.dev) (ISC), inlined. Fonts: Google Fonts (OFL). Project cover art is generated in the browser. `assets/og.png`, `assets/icon-192.png`, and `assets/icon-512.png` are the share image and icons.
