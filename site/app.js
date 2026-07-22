// rsc landing — copy-to-clipboard. No dependencies. Progressive enhancement:
// if JS is off, the command text is still visible and selectable.
(function () {
  "use strict";

  function flash(btn, labelDone) {
    var prev = btn.getAttribute("data-label") || btn.textContent;
    btn.classList.add("copied");
    btn.textContent = labelDone;
    window.setTimeout(function () {
      btn.classList.remove("copied");
      btn.textContent = prev;
    }, 1600);
  }

  async function copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fall through */ }
    // Fallback for non-secure contexts / older browsers
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-copy]");
    if (!btn) return;
    var sel = btn.getAttribute("data-copy");
    var src = sel ? document.querySelector(sel) : null;
    var text = src ? (src.getAttribute("data-copy-text") || src.textContent) : btn.getAttribute("data-copy-text");
    if (!text) return;
    if (!btn.getAttribute("data-label")) btn.setAttribute("data-label", btn.textContent);
    copy(text.trim()).then(function (ok) {
      flash(btn, ok ? (btn.getAttribute("data-done") || "Copied ✓") : "Press ⌘/Ctrl+C");
    });
  });

  // year in footer
  var y = document.getElementById("yr");
  if (y) y.textContent = String(new Date().getFullYear());
})();
