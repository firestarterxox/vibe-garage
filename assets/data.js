/* Vibe Garage static site constants: tool list for tags and forum channel definitions.
   Real projects and threads come from data/projects.json and data/discussions.json (synced from GitHub Discussions). */
window.VG_DATA = {
  tools: [
    { name: "Cursor", color: "#9b7bff" }, { name: "Claude", color: "#ff9a3d" }, { name: "Grok", color: "#f1eff7" },
    { name: "Replit", color: "#ff6a3d" }, { name: "Bolt", color: "#2ee6d6" }, { name: "Copilot", color: "#7fb4ff" },
    { name: "Windsurf", color: "#3ef0b0" }, { name: "v0", color: "#ffffff" }, { name: "Lovable", color: "#ff4fa3" }
  ],
  channels: [
    { id: "show-and-tell", name: "Show & Tell", icon: "palette", blurb: "Share what you made, finished or not." },
    { id: "help-me-unstick", name: "Help Me Unstick", icon: "puzzle", blurb: "Stuck? Describe it, someone's been there." },
    { id: "prompt-craft", name: "Prompt Craft", icon: "wand-sparkles", blurb: "Prompts, patterns and clever tricks." },
    { id: "tools-and-models", name: "Tools & Models", icon: "wrench", blurb: "Editors, agents, models, setups." },
    { id: "newbie-corner", name: "Newbie Corner", icon: "sprout", blurb: "No question too basic. Ever." },
    { id: "off-topic-lounge", name: "Off-Topic Lounge", icon: "sofa", blurb: "Desk setups, snacks, late-night chat." }
  ],
  members: [], projects: [], threads: [], posts: {}, challenges: [], guides: []
};
