/* =========================================================================
   screen.js  ·  Leinwand-Seite (screen.html)
   ========================================================================= */

const el = function (id) { return document.getElementById(id); };

let ringLoop = null;
let answerCounts = {};      // pro Antwortindex die Anzahl
let totalAnswers = 0;
let confettiFired = false;

async function init() {
  await loadQuiz();
  el("screenTitle").firstChild.textContent = QUIZ.title || "Wer ist es?";
  el("screenSub").textContent = QUIZ.subtitle || "";

  buildQr();

  // Spielerzahl live
  playersRef.on("value", function (snap) {
    const players = snapToPlayers(snap);
    el("screenCount").textContent = players.length + (players.length === 1 ? " Spieler" : " Spieler");
    renderChips(players);
  });

  gameRef.on("value", function (snap) {
    render(snap.val() || {});
  });
}

function buildQr() {
  // Die Spieler-Seite liegt im selben Ordner als index.html
  const playerUrl = new URL(".", location.href).href;
  el("joinUrl").textContent = playerUrl.replace(/^https?:\/\//, "");
  try {
    el("qrcode").innerHTML = "";
    new QRCode(el("qrcode"), {
      text: playerUrl,
      width: 240,
      height: 240,
      colorDark: "#1b1238",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (e) {
    el("qrcode").textContent = "QR-Code konnte nicht geladen werden";
  }
}

function snapToPlayers(snap) {
  const arr = [];
  snap.forEach(function (c) {
    const v = c.val();
    arr.push({ id: c.key, name: v.name || "?", score: v.score || 0, joinedAt: v.joinedAt || 0 });
  });
  return arr;
}

function renderChips(players) {
  const box = el("playerChips");
  if (!box) return;
  const sorted = players.slice().sort(function (a, b) { return a.joinedAt - b.joinedAt; });
  box.innerHTML = "";
  sorted.forEach(function (p) {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = p.name;
    box.appendChild(c);
  });
  el("lobbyCount").textContent = players.length;
}

function render(game) {
  const state = game.state || "lobby";
  stopRing();

  ["sLobby", "sQuestion", "sBoard", "sEnded"].forEach(function (id) {
    el(id).classList.add("hidden");
  });

  if (state === "lobby") {
    el("sLobby").classList.remove("hidden");
    confettiFired = false;
    return;
  }

  if (state === "question") {
    showQuestion(game, false);
    return;
  }

  if (state === "reveal") {
    showQuestion(game, true);
    return;
  }

  if (state === "leaderboard") {
    showBoard();
    return;
  }

  if (state === "ended") {
    showEnded();
    return;
  }
}

function showQuestion(game, reveal) {
  const qi = game.currentQuestion;
  const q = QUIZ.questions[qi];
  if (!q) return;
  const opts = quizOptions(q);

  el("sQuestion").classList.remove("hidden");
  el("sQBig").textContent = q.text;

  // Live-Antworten zaehlen
  answersRef.child(qi).off();
  answersRef.child(qi).on("value", function (snap) {
    answerCounts = {};
    totalAnswers = 0;
    snap.forEach(function (c) {
      const a = c.val();
      answerCounts[a.choice] = (answerCounts[a.choice] || 0) + 1;
      totalAnswers++;
    });
    el("answerCount").textContent = totalAnswers + " Antworten";
    if (reveal) paintTiles(opts, q.correct, true);
  });

  // Kacheln aufbauen
  const grid = el("optGrid");
  grid.innerHTML = "";
  opts.forEach(function (name, i) {
    const t = document.createElement("div");
    t.className = "opt-tile bg" + i;
    t.dataset.idx = i;
    t.innerHTML = '<span class="shape">' + OPTION_SHAPES[i] +
      '</span><span class="lbl">' + esc(name) + '</span>' +
      '<span class="tally hidden"></span>';
    grid.appendChild(t);
  });

  if (reveal) {
    stopRing();
    el("timerWrap").classList.add("hidden");
    paintTiles(opts, q.correct, true);
  } else {
    el("timerWrap").classList.remove("hidden");
    startRing(game);
    paintTiles(opts, q.correct, false);
  }
}

function paintTiles(opts, correct, reveal) {
  const tiles = el("optGrid").querySelectorAll(".opt-tile");
  tiles.forEach(function (t) {
    const i = parseInt(t.dataset.idx, 10);
    const tally = t.querySelector(".tally");
    if (reveal) {
      tally.classList.remove("hidden");
      tally.textContent = (answerCounts[i] || 0);
      if (i === correct) t.classList.add("correct");
      else t.classList.add("dim");
    } else {
      tally.classList.add("hidden");
      t.classList.remove("correct", "dim");
    }
  });
}

function showBoard() {
  el("sBoard").classList.remove("hidden");
  el("boardTitle").textContent = "Leaderboard";
  playersRef.once("value", function (snap) {
    const arr = snapToPlayers(snap).sort(function (a, b) { return b.score - a.score; });
    const box = el("boardRows");
    box.innerHTML = "";
    arr.slice(0, 8).forEach(function (p, i) {
      const row = document.createElement("div");
      row.className = "row" + (i === 0 ? " top1" : "");
      row.style.animationDelay = (i * 0.06) + "s";
      row.innerHTML =
        '<span class="rank">' + (i + 1) + '</span>' +
        '<span class="pname">' + esc(p.name) + '</span>' +
        '<span class="pscore">' + p.score + '</span>';
      box.appendChild(row);
    });
    if (arr.length === 0) {
      box.innerHTML = '<div class="empty">Noch keine Punkte</div>';
    }
  });
}

function showEnded() {
  el("sEnded").classList.remove("hidden");
  playersRef.once("value", function (snap) {
    const arr = snapToPlayers(snap).sort(function (a, b) { return b.score - a.score; });
    const top = arr.slice(0, 3);
    const order = [1, 0, 2]; // Silber, Gold, Bronze fuer die Optik
    const crowns = ["\uD83E\uDD48", "\uD83D\uDC51", "\uD83E\uDD49"];
    const box = el("podium");
    box.innerHTML = "";
    order.forEach(function (rankIdx) {
      const p = top[rankIdx];
      const podClass = "pod pod" + (rankIdx + 1);
      const d = document.createElement("div");
      d.className = podClass;
      d.innerHTML =
        '<div class="crown">' + (p ? crowns[rankIdx] : "") + '</div>' +
        '<div class="pod-name">' + (p ? esc(p.name) : "-") + '</div>' +
        '<div class="pod-score">' + (p ? p.score + " Pkt" : "") + '</div>' +
        '<div class="bar">' + (rankIdx + 1) + '</div>';
      box.appendChild(d);
    });

    // Rest der Rangliste darunter
    const rest = el("boardRest");
    rest.innerHTML = "";
    arr.slice(3, 10).forEach(function (p, i) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML =
        '<span class="rank">' + (i + 4) + '</span>' +
        '<span class="pname">' + esc(p.name) + '</span>' +
        '<span class="pscore">' + p.score + '</span>';
      rest.appendChild(row);
    });

    if (!confettiFired && typeof confetti === "function") {
      confettiFired = true;
      fireConfetti();
    }
  });
}

function fireConfetti() {
  const colors = ["#fb5a5a", "#2d9cff", "#ffb020", "#1fbf75", "#9b5de5", "#f15bb5"];
  let count = 6;
  const shoot = function () {
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 }, colors: colors });
    if (--count > 0) setTimeout(shoot, 650);
  };
  shoot();
}

/* ---------- Countdown-Ring ---------- */
function startRing(game) {
  const dur = game.durationMs || durationMsDefault();
  const start = game.startedAt || serverNow();
  const circle = el("ringFg");
  const num = el("ringNum");
  const radius = 110;
  const circ = 2 * Math.PI * radius;
  circle.setAttribute("stroke-dasharray", circ);

  function tick() {
    const remaining = Math.max(0, start + dur - serverNow());
    const frac = clamp(remaining / dur, 0, 1);
    circle.setAttribute("stroke-dashoffset", circ * (1 - frac));
    const secs = Math.ceil(remaining / 1000);
    num.textContent = secs;
    // Farbe wechselt, wenn es knapp wird
    if (frac < 0.25) circle.style.stroke = "#fb5a5a";
    else if (frac < 0.5) circle.style.stroke = "#ffb020";
    else circle.style.stroke = "#ffd166";
    if (remaining <= 0) { stopRing(); return; }
    ringLoop = requestAnimationFrame(tick);
  }
  tick();
}
function stopRing() {
  if (ringLoop) { cancelAnimationFrame(ringLoop); ringLoop = null; }
}

init();
