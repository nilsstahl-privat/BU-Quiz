/* =========================================================================
   control.js  ·  Regie-Seite (control.html)
   ========================================================================= */

const el = function (id) { return document.getElementById(id); };

let current = null;          // aktueller Spielzustand
let autoTimer = null;        // automatisches Aufloesen bei Zeitablauf
let durationSeconds = 30;

async function init() {
  await loadQuiz();
  durationSeconds = QUIZ.questionDurationSeconds || 30;
  el("durInput").value = durationSeconds;
  el("totalQ").textContent = QUIZ.questions.length;

  buildJumpButtons();
  buildLinks();

  el("durInput").addEventListener("change", function () {
    const v = parseInt(el("durInput").value, 10);
    durationSeconds = clamp(isNaN(v) ? 30 : v, 5, 300);
    el("durInput").value = durationSeconds;
  });

  el("btnStart").addEventListener("click", function () { startQuestion(0); });
  el("btnReveal").addEventListener("click", revealNow);
  el("btnBoard").addEventListener("click", function () { gameRef.update({ state: "leaderboard" }); });
  el("btnNext").addEventListener("click", nextQuestion);
  el("btnEnd").addEventListener("click", function () { gameRef.update({ state: "ended" }); });
  el("btnLobby").addEventListener("click", function () { gameRef.update({ state: "lobby" }); });
  el("btnReset").addEventListener("click", resetGame);

  // Spielzustand verfolgen
  gameRef.on("value", function (snap) {
    current = snap.val() || { state: "lobby", currentQuestion: -1 };
    renderState();
    armAutoReveal();
  });

  // Spielerliste live
  playersRef.on("value", function (snap) {
    renderPlayers(snap);
  });

  // Antwortzahl der aktuellen Frage live
  gameRef.child("currentQuestion").on("value", function (s) {
    const qi = s.val();
    bindAnswerCount(qi);
  });
}

let answerCountRef = null;
function bindAnswerCount(qi) {
  if (answerCountRef) answerCountRef.off();
  if (qi === null || qi === undefined || qi < 0) { el("ansCount").textContent = "0"; return; }
  answerCountRef = answersRef.child(qi);
  answerCountRef.on("value", function (snap) {
    el("ansCount").textContent = snap.numChildren();
  });
}

function renderState() {
  const state = current.state || "lobby";
  const qi = current.currentQuestion;
  const labels = {
    lobby: "Lobby offen",
    question: "Frage laeuft",
    reveal: "Aufgeloest",
    leaderboard: "Leaderboard",
    ended: "Spiel beendet"
  };
  el("statePill").querySelector(".txt").textContent = labels[state] || state;

  if (state !== "lobby" && state !== "ended" && qi >= 0 && QUIZ.questions[qi]) {
    const q = QUIZ.questions[qi];
    el("nowQ").textContent = "Frage " + (qi + 1) + ": " + q.text;
    el("nowAnswer").textContent = "Richtige Antwort: " + esc(quizOptions(q)[q.correct]);
  } else {
    el("nowQ").textContent = state === "ended" ? "Das Spiel ist zu Ende." : "Noch keine Frage gestartet.";
    el("nowAnswer").textContent = "";
  }

  // Buttons je nach Zustand
  const last = qi >= QUIZ.questions.length - 1;
  el("btnStart").disabled = !(state === "lobby");
  el("btnReveal").disabled = !(state === "question");
  el("btnBoard").disabled = !(state === "reveal" || state === "leaderboard");
  el("btnNext").disabled = !(state === "reveal" || state === "leaderboard") || last;
  el("btnEnd").disabled = state === "lobby" || state === "ended";

  el("btnNext").textContent = last ? "Letzte Frage erreicht" : "Naechste Frage";

  // Sprung-Buttons markieren
  document.querySelectorAll(".q-jump button").forEach(function (b) {
    const idx = parseInt(b.dataset.idx, 10);
    b.classList.toggle("active", idx === qi && (state === "question" || state === "reveal"));
  });
}

function buildJumpButtons() {
  const box = el("qJump");
  box.innerHTML = "";
  QUIZ.questions.forEach(function (q, i) {
    const b = document.createElement("button");
    b.textContent = (i + 1);
    b.dataset.idx = i;
    b.title = q.text;
    b.addEventListener("click", function () { startQuestion(i); });
    box.appendChild(b);
  });
}

function buildLinks() {
  const base = new URL(".", location.href).href;
  el("linkPlayer").textContent = base.replace(/^https?:\/\//, "");
  el("linkScreen").href = base + "screen.html";
  el("linkScreen").textContent = (base + "screen.html").replace(/^https?:\/\//, "");
}

/* ---------- Aktionen ---------- */
function startQuestion(i) {
  if (i < 0 || i >= QUIZ.questions.length) return;
  gameRef.update({
    state: "question",
    currentQuestion: i,
    startedAt: firebase.database.ServerValue.TIMESTAMP,
    durationMs: durationSeconds * 1000
  });
}

function nextQuestion() {
  const i = (current.currentQuestion || 0) + 1;
  if (i >= QUIZ.questions.length) {
    gameRef.update({ state: "ended" });
  } else {
    startQuestion(i);
  }
}

function revealNow() {
  gameRef.update({ state: "reveal" });
  scoreQuestion(current.currentQuestion);
}

function armAutoReveal() {
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  if (current.state !== "question") return;
  const dur = current.durationMs || durationMsDefault();
  const start = current.startedAt || serverNow();
  const remaining = Math.max(0, start + dur - serverNow());
  autoTimer = setTimeout(function () {
    // nur aufloesen, wenn wirklich noch dieselbe Frage laeuft
    gameRef.once("value", function (snap) {
      const g = snap.val() || {};
      if (g.state === "question" && g.currentQuestion === current.currentQuestion) {
        gameRef.update({ state: "reveal" });
        scoreQuestion(current.currentQuestion);
      }
    });
  }, remaining + 200);
}

// Punkte einer Frage berechnen, genau einmal
async function scoreQuestion(qi) {
  if (qi === null || qi === undefined || qi < 0) return;
  const guardRef = gameRef.child("scoredQuestions/" + qi);
  const tx = await guardRef.transaction(function (cur) {
    if (cur) return; // schon ausgewertet, Transaktion abbrechen
    return true;
  });
  if (!tx.committed) return;

  const gameSnap = await gameRef.once("value");
  const g = gameSnap.val() || {};
  const startedAt = g.startedAt || 0;
  const durationMs = g.durationMs || durationMsDefault();
  const q = QUIZ.questions[qi];
  const correct = (q && q.correct !== undefined) ? q.correct : -1;

  const ansSnap = await answersRef.child(qi).once("value");
  ansSnap.forEach(function (child) {
    const a = child.val();
    const pid = child.key;
    const isCorrect = (a.choice === correct);
    const elapsed = (a.at && startedAt) ? (a.at - startedAt) : durationMs;
    const pts = computePoints(isCorrect, elapsed, durationMs);
    if (pts > 0) {
      playersRef.child(pid).child("score").set(firebase.database.ServerValue.increment(pts));
    }
    answersRef.child(qi).child(pid).update({ correct: isCorrect, points: pts });
  });
}

function resetGame() {
  if (!confirm("Wirklich das ganze Spiel zuruecksetzen? Alle Spieler und Punkte werden geloescht.")) return;
  playersRef.remove();
  answersRef.remove();
  gameRef.set({
    state: "lobby",
    currentQuestion: -1,
    startedAt: 0,
    durationMs: durationSeconds * 1000
  });
}

/* ---------- Spielerliste ---------- */
function renderPlayers(snap) {
  const arr = [];
  snap.forEach(function (c) {
    const v = c.val();
    arr.push({ id: c.key, name: v.name || "?", score: v.score || 0 });
  });
  arr.sort(function (a, b) { return b.score - a.score; });
  el("playerCount").textContent = arr.length;

  const box = el("playerList");
  box.innerHTML = "";
  if (arr.length === 0) {
    box.innerHTML = '<div class="empty">Noch niemand beigetreten.</div>';
    return;
  }
  arr.forEach(function (p, i) {
    const row = document.createElement("div");
    row.className = "prow";
    row.innerHTML =
      '<span class="rank">' + (i + 1) + '</span>' +
      '<span class="pn">' + esc(p.name) + '</span>' +
      '<span class="ps">' + p.score + '</span>';
    const kick = document.createElement("button");
    kick.className = "kick";
    kick.textContent = "\u00d7";
    kick.title = "Spieler entfernen";
    kick.addEventListener("click", function () {
      if (confirm("Spieler " + p.name + " entfernen?")) playersRef.child(p.id).remove();
    });
    row.appendChild(kick);
    box.appendChild(row);
  });
}

init();
