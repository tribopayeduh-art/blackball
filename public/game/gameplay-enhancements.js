(function () {
  "use strict";

  function installArenaTheme() {
    if (!window.loadState || typeof window.loadState.preload !== "function") return;

    var theme =
      window.blackBallTheme === "london" || window.blackBallTheme === "vegas"
        ? window.blackBallTheme
        : "ruby";
    var suffix = "-" + theme + ".png";

    var themedImages = {
      pockets: "assets/img/pockets.png",
      cloth: "assets/img/cloth" + suffix,
      tableTop: "assets/img/tableTop" + suffix,
      guiPanel1: "assets/img/guiPanel1" + suffix,
      guiPanel2: "assets/img/guiPanel2" + suffix,
      rackBG: "assets/img/rackBG" + suffix,
      powerBarBG: "assets/img/powerBarBG" + suffix,
      powerBarBase: "assets/img/powerBarBase" + suffix,
      powerBarTop: "assets/img/powerBarTop" + suffix,
      panel: "assets/img/panel" + suffix,
      panel2: "assets/img/panel2" + suffix,
      panel3: "assets/img/panel3" + suffix,
      panel4: "assets/img/panel4d" + suffix,
    };
    var themedSheets = {
      menuButton: "assets/img/menuButton" + suffix,
      turnArrow: "assets/img/turnArrow" + suffix,
    };
    var originalPreload = window.loadState.preload;

    window.loadState.preload = function () {
      var loader = this.load;
      var originalImage = loader.image;
      var originalSheet = loader.spritesheet;

      loader.image = function (key, url) {
        if (themedImages[key]) arguments[1] = themedImages[key];
        return originalImage.apply(loader, arguments);
      };
      loader.spritesheet = function (key, url) {
        if (themedSheets[key]) arguments[1] = themedSheets[key];
        return originalSheet.apply(loader, arguments);
      };

      try {
        return originalPreload.apply(this, arguments);
      } finally {
        loader.image = originalImage;
        loader.spritesheet = originalSheet;
      }
    };
  }

  installArenaTheme();

  if (!window.playState || typeof window.playState.update !== "function") return;

  var originalUpdate = window.playState.update;
  var lastCueOwner = "";
  var lastBotShot = "";

  function applyCue(info, owner) {
    if (!info || owner === lastCueOwner) return;
    lastCueOwner = owner;
    var texture = owner === "p2" ? "bbBotCue" : "cue";
    try {
      if (info.cue && typeof info.cue.loadTexture === "function") {
        info.cue.loadTexture(texture);
      }
      if (info.powerBarCue && typeof info.powerBarCue.loadTexture === "function") {
        info.powerBarCue.loadTexture(texture);
      }
    } catch (error) {}
  }

  function tuneBot(info) {
    if (!info || info.turn !== "p2" || !window.projectInfo) return;
    var shotKey = String(info.turn) + ":" + String(info.shotNum || 0);
    if (shotKey === lastBotShot) return;
    lastBotShot = shotKey;

    // O bot continua forte, mas alterna entre uma leitura boa e uma leitura
    // profissional. A própria simulação do jogo acrescenta variação de mira
    // e potência, evitando sequências perfeitas e repetitivas.
    window.projectInfo.aiRating = Math.random() < 0.72 ? 4 : 5;
    window.projectInfo.levelName = "1player_" + window.projectInfo.aiRating;
  }

  window.playState.update = function () {
    var info = this && this.gameInfo;
    if (info) {
      applyCue(info, info.turn === "p2" ? "p2" : "p1");
      tuneBot(info);
    }
    return originalUpdate.apply(this, arguments);
  };
})();
