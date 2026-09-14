(function () {
  "use strict";

  var STORAGE_KEY = "black-ball:cue-skin";
  var cues = Array.isArray(window.BLACK_BALL_CUES) ? window.BLACK_BALL_CUES : [];
  var params = new URLSearchParams(window.location.search);
  var requested = params.get("cue");
  var requestedBot = params.get("botCue");
  var requestedTheme = params.get("theme");
  var embedded = params.get("embedded") === "1";

  function findCue(slug) {
    for (var i = 0; i < cues.length; i += 1) {
      if (cues[i].slug === slug) return cues[i];
    }
    return null;
  }

  function readStoredCue() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function storeCue(slug) {
    try {
      window.localStorage.setItem(STORAGE_KEY, slug);
    } catch (error) {}
  }

  var storedBeforeLoad = readStoredCue();
  var selected = findCue(requested) || findCue(storedBeforeLoad) || findCue("starter") || cues[0];
  var botSelected = findCue(requestedBot);
  if (!botSelected || (selected && botSelected.slug === selected.slug)) {
    botSelected =
      cues.find(function (cue) {
        return !selected || cue.slug !== selected.slug;
      }) || selected;
  }
  window.blackBallCueSkin = selected ? selected.slug : "starter";
  window.blackBallBotCueSkin = botSelected ? botSelected.slug : "oak";
  window.blackBallTheme =
    requestedTheme === "london" || requestedTheme === "vegas" ? requestedTheme : "ruby";
  document.documentElement.setAttribute("data-theme", window.blackBallTheme);
  window.blackBallCueCatalog = cues;
  storeCue(window.blackBallCueSkin);

  function setPanelOpen(root, open) {
    root.classList.toggle("is-open", open);
    var toggle = root.querySelector(".bb-cue-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function chooseCue(slug) {
    var cue = findCue(slug);
    if (!cue) return;
    var changed = cue.slug !== window.blackBallCueSkin;
    window.blackBallCueSkin = cue.slug;
    storeCue(cue.slug);
    var url = new URL(window.location.href);
    url.searchParams.set("cue", cue.slug);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (changed) window.location.reload();
  }

  window.blackBallSelectCue = chooseCue;

  function renderSelector() {
    if (embedded) return;
    if (!cues.length || document.getElementById("bb-cue-selector")) return;

    var root = document.createElement("section");
    root.id = "bb-cue-selector";
    root.className = "bb-cue-selector" + (embedded ? " is-embedded" : "");
    root.setAttribute("aria-label", "Seletor de tacos");

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "bb-cue-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<span class="bb-cue-ball">8</span><span>TACO</span>';
    root.appendChild(toggle);

    var panel = document.createElement("div");
    panel.className = "bb-cue-panel";
    panel.innerHTML =
      '<div class="bb-cue-heading"><div><strong>ESCOLHA SEU TACO</strong><small>Todos liberados no modo teste</small></div><button type="button" class="bb-cue-close" aria-label="Fechar">×</button></div>';

    var grid = document.createElement("div");
    grid.className = "bb-cue-grid";
    cues.forEach(function (cue) {
      var button = document.createElement("button");
      var active = cue.slug === window.blackBallCueSkin;
      button.type = "button";
      button.className = "bb-cue-option" + (active ? " is-active" : "");
      button.setAttribute("data-cue", cue.slug);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.style.setProperty("--cue-color", cue.color);
      button.innerHTML =
        '<span class="bb-cue-preview"><img src="' +
        cue.asset +
        '" alt=""></span>' +
        '<span class="bb-cue-copy"><strong>' +
        cue.name +
        "</strong><small>" +
        cue.rarity +
        "</small></span>" +
        (active ? '<span class="bb-cue-check">✓</span>' : "");
      button.addEventListener("click", function () {
        chooseCue(cue.slug);
      });
      grid.appendChild(button);
    });
    panel.appendChild(grid);
    root.appendChild(panel);
    document.body.appendChild(root);

    toggle.addEventListener("click", function () {
      setPanelOpen(root, !root.classList.contains("is-open"));
    });
    panel.querySelector(".bb-cue-close").addEventListener("click", function () {
      setPanelOpen(root, false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setPanelOpen(root, false);
    });

    if (!embedded && !requested && !storedBeforeLoad) setPanelOpen(root, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSelector);
  } else {
    renderSelector();
  }
})();
