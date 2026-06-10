/* =========================================================================
   shared.js  ·  gemeinsame Logik fuer Spieler-, Leinwand- und Regie-Seite
   ========================================================================= */

/* -------------------------------------------------------------------------
   1) FIREBASE-KONFIGURATION
   Trage hier die Werte aus deinem Firebase-Projekt ein (siehe README.md).
   Wichtig: Du brauchst eine "Realtime Database", nicht Firestore.
   Die databaseURL findest du in der Firebase-Konsole bei der Realtime Database.
   ------------------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "DEINE_API_KEY",
  authDomain: "DEIN_PROJEKT.firebaseapp.com",
  databaseURL: "https://DEIN_PROJEKT-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "DEIN_PROJEKT",
  storageBucket: "DEIN_PROJEKT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* -------------------------------------------------------------------------
   2) SPIELRAUM
   Alle drei Seiten benutzen denselben Raum. Aendere den Namen, wenn du ein
   komplett frisches Spiel willst, ohne die Regie-Seite zum Zuruecksetzen
   zu benutzen.
   ------------------------------------------------------------------------- */
const ROOM = "bu-abschluss";
const gameRef = db.ref("rooms/" + ROOM + "/game");
const playersRef = db.ref("rooms/" + ROOM + "/players");
const answersRef = db.ref("rooms/" + ROOM + "/answers");

/* -------------------------------------------------------------------------
   3) ZEIT-SYNCHRONISIERUNG
   Damit der Countdown auf allen Geraeten gleich laeuft, rechnen wir den
   Versatz zwischen lokaler Uhr und Server-Uhr mit ein.
   ------------------------------------------------------------------------- */
let serverOffset = 0;
db.ref(".info/serverTimeOffset").on("value", function (snap) {
  serverOffset = snap.val() || 0;
});
function serverNow() {
  return Date.now() + serverOffset;
}

/* -------------------------------------------------------------------------
   4) FRAGEN LADEN
   ------------------------------------------------------------------------- */
let QUIZ = null;
async function loadQuiz() {
  if (QUIZ) return QUIZ;
  const res = await fetch("questions.json", { cache: "no-store" });
  QUIZ = await res.json();
  return QUIZ;
}
function quizOptions(question) {
  if (question && Array.isArray(question.options)) return question.options;
  return QUIZ.options;
}
function durationMsDefault() {
  return (QUIZ.questionDurationSeconds || 30) * 1000;
}

/* -------------------------------------------------------------------------
   5) PUNKTE im Kahoot-Stil mit Zeitbonus
   Richtig und sofort = volle Punkte. Richtig kurz vor Schluss = halbe Punkte.
   Falsch oder keine Antwort = 0.
   ------------------------------------------------------------------------- */
const BASE_POINTS = 1000;
function computePoints(isCorrect, elapsedMs, durationMs) {
  if (!isCorrect) return 0;
  const ratio = Math.max(0, Math.min(1, elapsedMs / durationMs));
  return Math.round(BASE_POINTS * (1 - ratio / 2));
}

/* -------------------------------------------------------------------------
   6) DARSTELLUNG DER ANTWORTEN
   Sechs feste Farben und Formen, fuer alle Seiten gleich.
   ------------------------------------------------------------------------- */
const OPTION_SHAPES = ["\u25CF", "\u25B2", "\u25A0", "\u25C6", "\u2605", "\u2B22"];

/* -------------------------------------------------------------------------
   7) KLEINE HELFER
   ------------------------------------------------------------------------- */
function esc(s) {
  return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
