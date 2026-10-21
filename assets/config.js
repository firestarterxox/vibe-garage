/* Vibe Garage backend config: GitHub Discussions + giscus. Shared by the front end and scripts/sync-discussions.mjs. */
window.VG_CONFIG = {
  repo: "firestarterxox/vibe-garage",
  repoId: "R_kgDOVRg6Zw",
  siteUrl: "https://firestarterxox.github.io/vibe-garage/",
  // Site channel -> GitHub Discussion category names, in order of preference.
  // The first name is the dedicated category; later names are GitHub's default categories used until the dedicated one exists.
  channels: {
    "show-and-tell":    ["Show & Tell", "Show and tell"],
    "help-me-unstick":  ["Help Me Unstick", "Q&A"],
    "prompt-craft":     ["Prompt Craft", "Ideas"],
    "tools-and-models": ["Tools & Models"],
    "newbie-corner":    ["Newbie Corner"],
    "off-topic-lounge": ["Off-Topic Lounge", "General"]
  },
  projectsCategory: ["Projects", "Show and tell"],
  announcementsCategory: ["Announcements"],
  // Fallback slugs (GitHub's defaults). Real slugs come from data/discussions.json once the sync runs.
  fallbackSlugs: { "Show and tell": "show-and-tell", "Q&A": "q-a", "Ideas": "ideas", "General": "general", "Announcements": "announcements" },
  projectMarker: "<!-- vibe-garage:project -->",
  giscus: { enabled: true, theme: "https://firestarterxox.github.io/vibe-garage/assets/giscus-theme.css" }
};
