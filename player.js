/* =========================================================================
   player.js  ·  Spieler-Seite (index.html)
   ========================================================================= */

const el = function (id) { return document.getElementById(id); };

// Identitaet des Spielers bleibt bei einem Neuladen erhalten
let playerId = localStorage.getItem("bu_player_id");
if (!playerId) {
  playerId = "p_" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem("bu_player_id", playerId);
}
let myName = localStorage.getItem("bu_player_name") || "";

let myScore = 0;
let answeredQuestion = -1;   // Index der Frage, die ich beantwortet habe
let timerLoop = null;

async function init() {
  await loadQuiz();

  el("joinBtn").addEventListener("click", joinGame);
  el("nameInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") joinGame();
  });

  // War ich schon dabei? Dann direkt ins Spiel.
  if (myName) {
    el("nameInput").value = myName;
    const snap = await playersRef.child(playerId).once("value");
    if (snap.exists()) {
      enterGame();
      return;
    }
  }
  el("joinView").classList.remove("hidden");
  el("nameInput").focus();
}

function joinGame() {
  const name = el("nameInput").value.trim();
  if (name.length < 1) {
    el("nameInput").focus();
    return;
  }
  myName = name.slice(0, 24);
  localStorage.setItem("bu_player_name", myName);

  playersRef.child(playerId).update({
    name: myName,
    joinedAt: firebase.database.ServerValue.TIMESTAMP
  });
  // Punktestand nur anlegen, wenn noch keiner da ist
  playersRef.child(playerId).child("score").transaction(function (s) {
    return s || 0;
  });

  enterGame();
}

function enterGame() {
  el("joinView").classList.add("hidden");
  el("gameView").classList.remove("hidden");
  el("youName").textContent = myName;

  // eigenen Punktestand live anzeigen
  playersRef.child(playerId).child("score").on("value", function (snap) {
    myScore = snap.val() || 0;
    el("youScore").textContent = myScore + " Pkt";
  });

  // Spielzustand verfolgen
  gameRef.on("value", function (snap) {
    render(snap.val() || {});
  });
}

function render(game) {
  const state = game.state || "lobby";
  stopTimer();
  if (revealRef) { revealRef.off(); revealRef = null; }

  // alle Teilansichten ausblenden
  ["pLobby", "pQuestion", "pWaiting", "pReveal", "pBoard", "pEnded"].forEach(function (id) {
    el(id).classList.add("hidden");
  });

  if (state === "lobby") {
    el("pLobby").classList.remove("hidden");
    return;
  }

  if (state === "question") {
    const qi = game.currentQuestion;
    if (answeredQuestion === qi) {
      el("pWaiting").classList.remove("hidden");
      return;
    }
    showQuestion(game);
    return;
  }

  if (state === "reveal") {
    showReveal(game);
    return;
  }

  if (state === "leaderboard") {
    el("pBoard").classList.remove("hidden");
    showMyRank();
    return;
  }

  if (state === "ended") {
    el("pEnded").classList.remove("hidden");
    el("endScore").textContent = myScore + " Punkte";
    showMyRank("endRank");
    return;
  }
}

function showQuestion(game) {
  const qi = game.currentQuestion;
  const q = QUIZ.questions[qi];
  if (!q) return;
  const opts = quizOptions(q);

  el("pQuestion").classList.remove("hidden");
  el("qCounter").textContent = "Frage " + (qi + 1) + " / " + QUIZ.questions.length;
  el("qText").textContent = q.text;

  const list = el("optionsList");
  list.innerHTML = "";
  opts.forEach(function (name, i) {
    const b = document.createElement("button");
    b.className = "opt bg" + i;
    b.innerHTML = '<span class="shape">' + OPTION_SHAPES[i] + "</span><span>" + esc(name) + "</span>";
    b.addEventListener("click", function () { sendAnswer(qi, i, game); });
    list.appendChild(b);
  });

  // Sicherheitscheck: vielleicht habe ich nach einem Neuladen schon geantwortet
  answersRef.child(qi).child(playerId).once("value", function (snap) {
    if (snap.exists()) {
      answeredQuestion = qi;
      el("pQuestion").classList.add("hidden");
      el("pWaiting").classList.remove("hidden");
    }
  });

  startTimer(game, function () {
    // Zeit abgelaufen, ohne Antwort: in den Wartemodus
    if (answeredQuestion !== qi) {
      el("pQuestion").classList.add("hidden");
      el("pWaiting").classList.remove("hidden");
    }
  });
}

function sendAnswer(qi, choice, game) {
  if (answeredQuestion === qi) return;
  answeredQuestion = qi;

  answersRef.child(qi).child(playerId).set({
    choice: choice,
    name: myName,
    at: firebase.database.ServerValue.TIMESTAMP
  });

  // Auswahl kurz hervorheben, dann in den Wartemodus
  const buttons = el("optionsList").querySelectorAll(".opt");
  buttons.forEach(function (b, idx) {
    b.disabled = true;
    if (idx === choice) b.classList.add("picked");
    else b.classList.add("dim");
  });
  stopTimer();
  setTimeout(function () {
    if ((gameStateCache() === "question")) {
      el("pQuestion").classList.add("hidden");
      el("pWaiting").classList.remove("hidden");
    }
  }, 650);
}

let _stateCache = "lobby";
gameRefStateCacheBind();
function gameRefStateCacheBind() {
  gameRef.child("state").on("value", function (s) { _stateCache = s.val() || "lobby"; });
}
function gameStateCache() { return _stateCache; }

let revealRef = null;
function showReveal(game) {
  const qi = game.currentQuestion;
  const q = QUIZ.questions[qi];
  if (!q) { el("pWaiting").classList.remove("hidden"); return; }

  el("pReveal").classList.remove("hidden");
  if (revealRef) revealRef.off();
  revealRef = answersRef.child(qi).child(playerId);
  revealRef.on("value", function (snap) {
    const a = snap.val();
    const banner = el("revealBanner");
    if (a && a.choice === q.correct) {
      banner.className = "result-banner good";
      const pts = (a.points !== undefined && a.points !== null) ? a.points : "...";
      banner.innerHTML = "Richtig! <span class=\"pts\">+" + pts + " Punkte</span>";
    } else if (a) {
      banner.className = "result-banner bad";
      banner.innerHTML = "Leider falsch <span class=\"pts\">Richtig war: " + esc(quizOptions(q)[q.correct]) + "</span>";
    } else {
      banner.className = "result-banner bad";
      banner.innerHTML = "Keine Antwort <span class=\"pts\">Richtig war: " + esc(quizOptions(q)[q.correct]) + "</span>";
    }
  });
}

function showMyRank(targetId) {
  playersRef.once("value", function (snap) {
    const arr = [];
    snap.forEach(function (c) {
      const v = c.val();
      arr.push({ id: c.key, name: v.name || "?", score: v.score || 0 });
    });
    arr.sort(function (a, b) { return b.score - a.score; });
    const pos = arr.findIndex(function (p) { return p.id === playerId; });
    const rank = pos >= 0 ? (pos + 1) : arr.length;
    if (targetId) {
      el(targetId).textContent = "Platz " + rank + " von " + arr.length;
    } else {
      el("myRank").textContent = "Platz " + rank;
      el("myScoreBoard").textContent = myScore + " Punkte";
    }
  });
}

/* ---------- Countdown ---------- */
function startTimer(game, onEnd) {
  const dur = game.durationMs || durationMsDefault();
  const start = game.startedAt || serverNow();
  const fill = el("pBarFill");
  function tick() {
    const remaining = Math.max(0, start + dur - serverNow());
    const frac = clamp(remaining / dur, 0, 1);
    const secs = Math.ceil(remaining / 1000);
    el("qTime").textContent = secs;
    if (fill) {
      fill.style.width = (frac * 100) + "%";
      fill.style.background = frac < 0.4 ? "#fde235" : "#6fc3c1";
    }
    if (remaining <= 0) {
      stopTimer();
      if (onEnd) onEnd();
      return;
    }
    timerLoop = requestAnimationFrame(tick);
  }
  tick();
}
function stopTimer() {
  if (timerLoop) { cancelAnimationFrame(timerLoop); timerLoop = null; }
}

init();
