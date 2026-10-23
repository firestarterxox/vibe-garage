// Copy buttons for code blocks on long-form guide pages.
(function () {
  "use strict";
  const status = document.getElementById("copy-status");
  const say = (msg) => { if (status) { status.textContent = ""; setTimeout(() => { status.textContent = msg; }, 30); } };
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
  }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return fallbackCopy(text);
  }
  document.querySelectorAll(".doc .code-wrap").forEach((wrap, i) => {
    const code = wrap.querySelector("pre code");
    if (!code) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost sm copy";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code block " + (i + 1));
    let timer;
    btn.addEventListener("click", () => {
      copy(code.textContent.replace(/\n$/, "")).then(() => {
        btn.textContent = "Copied"; say("Code copied to clipboard");
      }, () => {
        btn.textContent = "Copy failed"; say("Could not copy. Select the code and copy it manually.");
      }).finally(() => { clearTimeout(timer); timer = setTimeout(() => { btn.textContent = "Copy"; }, 2000); });
    });
    wrap.appendChild(btn);
  });
})();
