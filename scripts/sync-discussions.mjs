#!/usr/bin/env node
// Pulls GitHub Discussions into static JSON (data/discussions.json + data/projects.json) for the static site.
// Auth: GITHUB_TOKEN env (GitHub Actions) or, locally, the `gh` CLI if it is logged in.
import fs from "node:fs"; import vm from "node:vm"; import { execFileSync } from "node:child_process";
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(new URL("../assets/config.js", import.meta.url), "utf8"), ctx);
const C = ctx.window.VG_CONFIG; const [owner, name] = (process.env.REPO || C.repo).split("/");
const Q = `query($owner:String!,$name:String!,$after:String){repository(owner:$owner,name:$name){
  discussionCategories(first:50){nodes{id name slug emoji}}
  pinnedDiscussions(first:10){nodes{discussion{number}}}
  discussions(first:50,after:$after,orderBy:{field:UPDATED_AT,direction:DESC}){pageInfo{hasNextPage endCursor}
    nodes{number title url body bodyHTML createdAt updatedAt upvoteCount locked
      author{login avatarUrl(size:80)} category{name slug} labels(first:10){nodes{name}}
      comments{totalCount} reactions{totalCount}
      heart:reactions(content:HEART){totalCount} hooray:reactions(content:HOORAY){totalCount} thumbs:reactions(content:THUMBS_UP){totalCount}}}}}`;
async function gql(variables) {
  if (process.env.GITHUB_TOKEN) {
    const r = await fetch("https://api.github.com/graphql", { method: "POST", headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: Q, variables }) });
    const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data;
  }
  const args = ["api", "graphql", "-f", `query=${Q}`, "-f", `owner=${variables.owner}`, "-f", `name=${variables.name}`]; if (variables.after) args.push("-f", `after=${variables.after}`);
  const j = JSON.parse(execFileSync("gh", args, { encoding: "utf8" })); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data;
}
const all = []; let cats = [], pinned = new Set(), after = null;
for (let page = 0; page < 6; page++) {
  const d = (await gql({ owner, name, after })).repository; cats = d.discussionCategories.nodes; d.pinnedDiscussions.nodes.forEach(p => pinned.add(p.discussion.number));
  all.push(...d.discussions.nodes); if (!d.discussions.pageInfo.hasNextPage) break; after = d.discussions.pageInfo.endCursor;
}
const catNames = new Set(cats.map(c => c.name));
// Pick the most specific existing category for each channel; map every category name -> channel id
const chanForCat = {}, channelCategory = {};
for (const [chan, names] of Object.entries(C.channels)) { const hit = names.find(n => catNames.has(n)); if (hit) { channelCategory[chan] = hit; chanForCat[hit] ??= chan; } }
const projCat = C.projectsCategory.find(n => catNames.has(n));
const annCat = C.announcementsCategory.find(n => catNames.has(n));
const FBMAP = [[/tear it apart/i, "tear"], [/gentle/i, "gentle"], [/just vibes|no critique/i, "vibes"]];
const fbOf = t => (FBMAP.find(([re]) => re.test(t || "")) || [, "gentle"])[1];
function sections(body) { const out = {}; const parts = (body || "").split(/^###\s+(.+)$/m); for (let i = 1; i < parts.length; i += 2) out[parts[i].trim().toLowerCase()] = parts[i + 1].trim(); return out; }
const list = s => (s || "").split(/[,\n]/).map(x => x.replace(/^[-*#\s]+/, "").trim()).filter(x => x && !/^_?no response_?$/i.test(x));
const strip = s => (s || "").replace(/^_?no response_?$/i, "").trim();
const threads = [], projects = [];
for (const d of all) {
  const isProject = (d.body || "").includes(C.projectMarker) || (projCat && d.category.name === projCat && projCat === "Projects");
  const by = d.author?.login || "ghost", avatar = d.author?.avatarUrl || "";
  const reactions = { heart: d.heart.totalCount, hooray: d.hooray.totalCount, thumbs: d.thumbs.totalCount, total: d.reactions.totalCount };
  if (isProject) {
    const s = sections(d.body); const code = (s["code"] || "").replace(/^```[\w-]*\n?|\n?```$/g, "");
    projects.push({ id: `gh-${d.number}`, number: d.number, name: d.title.replace(/^\[project\]\s*/i, ""), by, avatar, kind: "generic", pitch: strip(s["pitch"]) || "A fresh build from the garage.",
      tools: list(s["tools"]), tags: list(s["tags"]), fb: fbOf(s["feedback wanted"]), likes: reactions.total + d.upvoteCount, comments: d.comments.totalCount,
      url: strip(s["live link"]), repo: strip(s["repo"]).replace(/^https:\/\/github\.com\//, ""), code: strip(code), prompts: list(s["prompts"]).slice(0, 8),
      discussionUrl: d.url, createdAt: d.createdAt, real: true });
    continue;
  }
  const isAnn = annCat && d.category.name === annCat;
  threads.push({ id: `gh-${d.number}`, number: d.number, channel: isAnn ? "announcements" : (chanForCat[d.category.name] || "off-topic-lounge"), category: d.category.name,
    title: d.title, by, avatar, fb: fbOf((d.body.match(/feedback(?: level| wanted)?:\s*([^\n]+)/i) || [])[1]), replies: d.comments.totalCount, reactions,
    createdAt: d.createdAt, updatedAt: d.updatedAt, url: d.url, bodyHTML: d.bodyHTML, pinned: pinned.has(d.number), real: true });
}
threads.sort((a, b) => (b.pinned - a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
const now = new Date().toISOString();
fs.mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
const categories = cats.map(c => ({ name: c.name, slug: c.slug, emoji: c.emoji, channel: chanForCat[c.name] || (c.name === projCat ? "projects" : c.name === annCat ? "announcements" : null) }));
fs.writeFileSync(new URL("../data/discussions.json", import.meta.url), JSON.stringify({ generated: now, repo: `${owner}/${name}`, categories, channelCategory, projectsCategory: projCat || null, threads }, null, 1));
fs.writeFileSync(new URL("../data/projects.json", import.meta.url), JSON.stringify({ generated: now, projects }, null, 1));
console.log(`synced ${threads.length} threads, ${projects.length} projects, ${cats.length} categories`);
