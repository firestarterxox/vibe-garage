/* Vibe Garage sample data. ALL FICTIONAL.
   This is the single swappable data layer: replace with real data (e.g. data/projects.json,
   data/discussions.json generated from GitHub Discussions) and app.js picks it up via VG.api. */
window.VG_DATA = {
  stats: { projects: 2418, posts: 9730, online: 128, newbies: 312 },
  tools: [
    { name: "Cursor", color: "#9b7bff" }, { name: "Claude", color: "#ff9a3d" }, { name: "Grok", color: "#f1eff7" },
    { name: "Replit", color: "#ff6a3d" }, { name: "Bolt", color: "#2ee6d6" }, { name: "Copilot", color: "#7fb4ff" },
    { name: "Windsurf", color: "#3ef0b0" }, { name: "v0", color: "#ffffff" }, { name: "Lovable", color: "#ff4fa3" }
  ],
  members: [
    { handle: "pixelpilgrim", name: "Pia", bio: "Ex-barista, now building tiny apps at 1 a.m. Cursor + Claude main. Ask me about prompts.", badges: ["🏅 top helper", "⭐ 120 assists", "🔥 challenge winner #14", "🌱 newbie mentor"] },
    { handle: "fernwhisper" }, { handle: "lofi_lu" }, { handle: "dicegoblin" }, { handle: "haiku_hank" },
    { handle: "ops_ollie" }, { handle: "cloudkid" }, { handle: "studybuddy" }, { handle: "newbie_nova" },
    { handle: "garden_gwen" }, { handle: "mod_marisol" }
  ],
  projects: [
    { id: "mood-ring-todo", name: "Mood Ring To-Do", by: "pixelpilgrim", kind: "todo", pitch: "A to-do list that shifts color with how overwhelmed you feel. Calm teal to send-help magenta.", tools: ["Cursor","Claude"], tags: ["web app","productivity"], fb: "gentle", likes: 412, comments: 38, url: "https://example.com/mood-ring-todo", repo: "pixelpilgrim/mood-ring-todo", example: true,
      code: "// tint the whole board by task load\nfunction moodColor(tasks) {\n  const load = tasks.filter(t => !t.done).length;\n  if (load < 3) return \"#2ee6d6\";  // chill\n  if (load < 7) return \"#ffd166\";  // busy\n  return \"#ff4fa3\";                 // send help\n}",
      prompts: ["Build a minimalist to-do app in vanilla JS where the background color shifts from teal to magenta as unfinished tasks pile up.", "Add a soft fade animation when the color changes and save tasks to localStorage."] },
    { id: "plant-gossip", name: "Plant Gossip", by: "fernwhisper", kind: "chat", pitch: "Your houseplants text you passive-aggressive reminders to water them.", tools: ["Replit","Grok"], tags: ["bot","fun"], fb: "vibes", likes: 389, comments: 51, url: "https://example.com/plant-gossip", repo: "fernwhisper/plant-gossip", example: true, prompts: ["Write a tiny Python bot that sends a cheeky SMS-style message when a plant hasn't been watered in N days. Give each plant a personality."] },
    { id: "synth-sketch", name: "Synth Sketch", by: "lofi_lu", kind: "music", pitch: "Draw a squiggle, hear it as a melody. Browser-only, no install.", tools: ["Claude","Bolt"], tags: ["music","creative"], fb: "tear", likes: 301, comments: 27, url: "https://example.com/synth-sketch", repo: "lofi_lu/synth-sketch", example: true, prompts: ["Make a canvas where the y-position of a drawn line maps to pitch using the Web Audio API."] },
    { id: "couch-quest", name: "Couch Quest", by: "dicegoblin", kind: "game", pitch: "A cozy 2D roguelike that takes place entirely inside your sofa cushions.", tools: ["Cursor","Grok"], tags: ["game"], fb: "gentle", likes: 276, comments: 44, url: "https://example.com/couch-quest", repo: "dicegoblin/couch-quest", example: true, prompts: ["Generate a tile-based dungeon where every room is themed like the inside of a couch: lost coins, crumbs, a remote-control boss."] },
    { id: "receipt-poet", name: "Receipt Poet", by: "haiku_hank", kind: "poem", pitch: "Snap a grocery receipt, get a haiku about your week.", tools: ["Replit","Claude"], tags: ["ai","fun"], fb: "vibes", likes: 244, comments: 19, url: "https://example.com/receipt-poet", repo: "haiku_hank/receipt-poet", example: true, prompts: ["Read text from a receipt photo and turn the items into a 5-7-5 haiku."] },
    { id: "standup-sidekick", name: "Stand-up Sidekick", by: "ops_ollie", kind: "chart", pitch: "A chat bot that writes your daily stand-up from yesterday's commits.", tools: ["Cursor","Copilot"], tags: ["bot","productivity"], fb: "tear", likes: 198, comments: 33, url: "https://example.com/standup-sidekick", repo: "ops_ollie/standup-sidekick", example: true, prompts: ["Summarize yesterday's git commits into three friendly bullet points for a stand-up."] },
    { id: "tiny-weather-pet", name: "Tiny Weather Pet", by: "cloudkid", kind: "weather", pitch: "A pixel pet that dresses for today's forecast.", tools: ["Bolt","Grok"], tags: ["web app","creative"], fb: "gentle", likes: 171, comments: 12, url: "https://example.com/tiny-weather-pet", repo: "cloudkid/tiny-weather-pet", example: true, prompts: ["Pixel-art pet that wears a raincoat, sunglasses or a scarf depending on weather data."] },
    { id: "flashdeck-live", name: "Flashdeck Live", by: "studybuddy", kind: "cards", pitch: "Turn any lecture notes into a spaced-repetition deck in one paste.", tools: ["Claude","Replit"], tags: ["learning","web app"], fb: "vibes", likes: 150, comments: 9, url: "https://example.com/flashdeck-live", repo: "studybuddy/flashdeck-live", example: true, prompts: ["Parse pasted notes into question/answer cards and schedule reviews with a simple SM-2 algorithm."] }
  ],
  channels: [
    { id: "show-and-tell", name: "Show & Tell", icon: "palette", blurb: "Share what you made, finished or not." },
    { id: "help-me-unstick", name: "Help Me Unstick", icon: "puzzle", blurb: "Stuck? Describe it, someone's been there." },
    { id: "prompt-craft", name: "Prompt Craft", icon: "wand-sparkles", blurb: "Prompts, patterns and clever tricks." },
    { id: "tools-and-models", name: "Tools & Models", icon: "wrench", blurb: "Editors, agents, models, setups." },
    { id: "newbie-corner", name: "Newbie Corner", icon: "sprout", blurb: "No question too basic. Ever." },
    { id: "off-topic-lounge", name: "Off-Topic Lounge", icon: "sofa", blurb: "Desk setups, snacks, late-night chat." }
  ],
  threads: [
    { id: "ai-rewrites-whole-file", channel: "help-me-unstick", title: "My AI keeps rewriting my whole file when I ask for one tiny fix", fb: "gentle", by: "newbie_nova", replies: 23, ago: "12m ago", tools: ["Cursor"], example: true },
    { id: "lofi-weather-radio", channel: "show-and-tell", title: "I made a lo-fi radio that picks songs by the weather", fb: "vibes", by: "lofi_lu", replies: 41, ago: "38m ago", example: true },
    { id: "explain-it-back", channel: "prompt-craft", title: "The 'explain it back to me first' trick saved my weekend", fb: "gentle", by: "pixelpilgrim", replies: 67, ago: "1h ago", example: true },
    { id: "cursor-vs-replit", channel: "tools-and-models", title: "Cursor vs. Replit for a first full-stack app?", fb: "tear", by: "ops_ollie", replies: 88, ago: "2h ago", example: true },
    { id: "what-is-api-key", channel: "newbie-corner", title: "What even is an API key and why does everyone say hide it?", fb: "gentle", by: "garden_gwen", replies: 54, ago: "3h ago", example: true },
    { id: "desk-setup-2am", channel: "off-topic-lounge", title: "Post your desk setup at 2 a.m.", fb: "vibes", by: "cloudkid", replies: 112, ago: "5h ago", example: true },
    { id: "couch-quest-devlog-3", channel: "show-and-tell", title: "Couch Quest devlog #3: the remote-control boss is alive", fb: "tear", by: "dicegoblin", replies: 29, ago: "6h ago", example: true },
    { id: "blank-white-page", channel: "help-me-unstick", title: "Deployed my app and it's a blank white page 😭", fb: "gentle", by: "studybuddy", replies: 0, ago: "8m ago", example: true }
  ],
  posts: {
    "ai-rewrites-whole-file": [
      { by: "newbie_nova", badges: ["🌱 newbie"], ago: "2h ago", html: "<p>Every time I ask it to change a button color, it rewrites like 300 lines and breaks my login page. Am I doing something wrong? I've been vibe coding for 2 weeks so please be gentle 🙏</p>", helped: 4, love: 12 },
      { by: "pixelpilgrim", badges: ["🏅 top helper", "⭐ 120 assists"], ago: "1h ago", pinned: true, helped: 58, love: 31,
        html: "<p>Totally normal, and super fixable! Three things that changed everything for me:</p><ol><li><b>Point at the exact spot.</b> Select only the lines you want changed, or name the function.</li><li><b>Say what NOT to touch:</b> <code>\"Only change the button style. Don't modify any other functions.\"</code></li><li><b>Commit before every ask.</b> If it goes sideways, you can undo in one click.</li></ol><pre class=\"code\"><span class=\"c\"># the save-point habit</span>\ngit add -A &amp;&amp; git commit -m <span class=\"s\">\"before AI edit\"</span></pre>" },
      { by: "garden_gwen", badges: ["🌱 newbie"], ago: "52m ago", html: "<p>Saving this whole thread. The commit-first tip is gold, I lost a whole afternoon last week 😅</p>", helped: 9, love: 14 },
      { by: "mod_marisol", badges: ["🛡 volunteer mod", "🏅 helper"], ago: "40m ago", html: "<p>Welcome to the garage, Nova! 💜 There's a beginner guide on exactly this in <a href=\"learn.html\">Learn → Small asks, big wins</a>. No question is too basic in here.</p>", helped: 21, love: 40 },
      { by: "newbie_nova", badges: ["🌱 newbie"], ago: "10m ago", html: "<p>IT WORKED. Changed one button, nothing else exploded. Thank you all, this place is the best 😭✨</p>", helped: 3, love: 47 }
    ]
  },
  challenges: [
    { status: "live", num: 17, title: "Tiny tools for tired people", blurb: "Build something useful in under 100 prompts.", kind: "todo", seed: "c17" },
    { status: "judging", num: 16, title: "One-screen games", blurb: "A complete game that fits on a single screen. No scrolling allowed.", kind: "game", seed: "c16" },
    { status: "done", num: 15, title: "Explain it like I'm five", blurb: "An app that teaches one concept to a total beginner.", kind: "cards", seed: "c15" },
    { status: "done", num: 14, title: "Retro OS vibes", blurb: "Rebuild a piece of a vintage desktop in the browser.", kind: "chart", seed: "c14" },
    { status: "done", num: 13, title: "Your city, but data", blurb: "Visualize something about where you live.", kind: "weather", seed: "c13" },
    { status: "done", num: 12, title: "No-keyboard November", blurb: "Build an app using only voice prompts.", kind: "music", seed: "c12" }
  ],
  guides: [
    { cat: "Start here", title: "What is vibe coding, anyway?", time: "5 min", icon: "sprout", color: "#3ef08f" },
    { cat: "Workflow", title: "Small asks, big wins: keeping AI edits tiny", time: "7 min", icon: "puzzle", color: "#2ee6d6" },
    { cat: "Safety", title: "Hide your API keys: a no-jargon guide", time: "6 min", icon: "lock", color: "#ff9a3d" },
    { cat: "Prompting", title: "The 'explain it back first' trick", time: "4 min", icon: "wand-sparkles", color: "#ff4fa3" },
    { cat: "Shipping", title: "From localhost to a real link in 10 minutes", time: "9 min", icon: "rocket", color: "#9b7bff" },
    { cat: "Debugging", title: "When it's a blank white page: a checklist", time: "5 min", icon: "terminal", color: "#ffd166" }
  ]
};
