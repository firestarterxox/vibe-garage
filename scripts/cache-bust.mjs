#!/usr/bin/env node
// Adds or refreshes ?v=<hash> on every page's links to the shared CSS and JS in assets/,
// so browsers fetch a new copy as soon as the file changes. The version is the first
// 10 hex characters of the file's SHA-256, so unchanged files keep their URL.
// Run after editing anything in assets/:  node scripts/cache-bust.mjs
// Idempotent: a second run changes nothing.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = ["style.css", "config.js", "data.js", "icons.js", "art.js", "app.js", "guide.js"];

const version = Object.fromEntries(
  ASSETS.map((f) => [f, createHash("sha256").update(readFileSync(join(ROOT, "assets", f))).digest("hex").slice(0, 10)]),
);
const names = ASSETS.map((f) => f.replace(/[.]/g, "\\.")).join("|");
// (href|src)="[/]assets/<file>[?v=...]"
const ref = new RegExp(`((?:href|src)="/?assets/(${names}))(?:\\?v=[0-9a-f]+)?"`, "g");

let changed = 0;
for (const page of readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort()) {
  const path = join(ROOT, page);
  const before = readFileSync(path, "utf8");
  const after = before.replace(ref, (_m, attr, file) => `${attr}?v=${version[file]}"`);
  if (after !== before) {
    writeFileSync(path, after);
    changed++;
    console.log(`updated ${page}`);
  }
}
console.log(changed ? `${changed} page(s) updated` : "all pages already current");
