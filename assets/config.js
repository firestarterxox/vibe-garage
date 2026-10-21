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
  fallbackSlugs: { "Show and tell": "show-and-tell", "Q&A": "q-a", "Ideas": "ideas", "General": "general", "Announcements": "announcements", "Tools & Models": "tools-models", "Newbie Corner": "newbie-corner" },
  // Discussion category IDs (from giscus.app/api/discussions/categories). giscus maps by discussion number, so these are reference/fallback only.
  categoryIds: { "Announcements": "DIC_kwDOVRg6Z84DJNda", "General": "DIC_kwDOVRg6Z84DJNdb", "Ideas": "DIC_kwDOVRg6Z84DJNdd", "Newbie Corner": "DIC_kwDOVRg6Z84DJOmr", "Polls": "DIC_kwDOVRg6Z84DJNdf", "Q&A": "DIC_kwDOVRg6Z84DJNdc", "Show and tell": "DIC_kwDOVRg6Z84DJNde", "Tools & Models": "DIC_kwDOVRg6Z84DJOmq" },
  projectMarker: "<!-- vibe-garage:project -->",
  giscus: { enabled: true, theme: "https://firestarterxox.github.io/vibe-garage/assets/giscus-theme.css" },
  // GoatCounter site code: the subdomain of https://<code>.goatcounter.com.
  // An empty string keeps analytics off, and no analytics script is loaded.
  analytics: { goatcounter: "" }
};
