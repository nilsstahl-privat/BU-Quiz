# Wer ist es? · Live-Quiz fuer den BU-Abschluss-Gottesdienst

Ein eigenes Quiz im Kahoot-Stil mit drei Seiten:

- `index.html` ist die Mitmach-Seite fuer die Handys der Gaeste. Hinter dem QR-Code liegt genau diese Seite.
- `screen.html` ist die Leinwand-Seite fuer den Beamer mit Frage, Countdown, Leaderboard und Sieger-Podium.
- `control.html` ist die Regie-Seite, ueber die du Runden startest, aufloest und das Leaderboard zeigst.

Die Punkte werden im Hintergrund mit Zeitbonus berechnet. Wer richtig und schnell antwortet, bekommt mehr Punkte. Die maximale Punktzahl pro Frage liegt bei tausend.

## Was du einmalig einrichten musst

Du brauchst zwei kostenlose Dinge: ein Firebase-Projekt fuer die Live-Synchronisierung und ein GitHub-Repository fuer das Hosting. Plane dafuer ungefaehr zwanzig Minuten ein.

### Schritt 1: Firebase-Projekt anlegen

1. Gehe auf https://console.firebase.google.com und melde dich mit einem Google-Konto an.
2. Klicke auf "Projekt hinzufuegen", gib einen Namen ein, zum Beispiel "bu-quiz", und schliesse die Schritte ab. Google Analytics kannst du dabei deaktivieren.
3. Klicke in der linken Leiste auf "Build" und dann auf "Realtime Database". Wichtig ist die Realtime Database, nicht Firestore.
4. Klicke auf "Datenbank erstellen". Waehle als Standort am besten "europe-west1" (Belgien). Starte im "Testmodus".
5. Wechsle danach in den Reiter "Regeln" der Realtime Database und trage genau das Folgende ein, dann auf "Veroeffentlichen":

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Diese Regeln erlauben waehrend des Events offenen Zugriff. Das ist fuer einen einmaligen Gottesdienst voellig ausreichend. Nach dem Event kannst du die Regeln wieder auf `false` setzen oder das Projekt loeschen.

### Schritt 2: Die Firebase-Zugangsdaten in das Projekt eintragen

1. Klicke in Firebase oben links auf das Zahnrad und dann auf "Projekteinstellungen".
2. Scrolle zum Abschnitt "Meine Apps" und klicke auf das Web-Symbol mit den spitzen Klammern, um eine Web-App zu registrieren. Gib einen Namen ein und bestaetige. Hosting musst du nicht aktivieren.
3. Firebase zeigt dir nun ein Objekt namens `firebaseConfig` mit Werten wie `apiKey`, `databaseURL` und so weiter.
4. Oeffne die Datei `shared.js` und ersetze den Block ganz oben durch deine echten Werte. Achte besonders auf `databaseURL`. Diese Adresse findest du auch oben in der Realtime Database und sie sieht ungefaehr so aus: `https://bu-quiz-default-rtdb.europe-west1.firebasedatabase.app`. Wenn die `databaseURL` im angezeigten Objekt fehlt, kopiere sie aus der Realtime Database und trage sie von Hand ein.

### Schritt 3: Auf GitHub Pages hochladen

1. Lege auf https://github.com ein neues, oeffentliches Repository an, zum Beispiel "bu-quiz".
2. Lade alle Dateien aus diesem Ordner hoch. Am einfachsten geht das ueber "Add file" und dann "Upload files", wo du die Dateien per Drag and Drop hineinziehst. Die `questions.json` muss mit hochgeladen werden.
3. Gehe im Repository auf "Settings", dann in der linken Leiste auf "Pages". Waehle bei "Branch" den Zweig "main" und den Ordner "/ (root)" und speichere.
4. Nach ein bis zwei Minuten zeigt GitHub dir die Adresse deiner Seite. Sie sieht so aus: `https://deinname.github.io/bu-quiz/`.

Damit hast du drei Adressen:

- Mitmach-Seite und QR-Ziel: `https://deinname.github.io/bu-quiz/`
- Leinwand: `https://deinname.github.io/bu-quiz/screen.html`
- Regie: `https://deinname.github.io/bu-quiz/control.html`

Den QR-Code fuer die Gaeste musst du nicht selbst erzeugen. Die Leinwand-Seite zeigt ihn in der Lobby automatisch an und er zeigt auf die Mitmach-Seite.

## Ablauf am Eventtag

1. Oeffne auf dem Beamer-Laptop die Leinwand-Seite und lege sie in den Vollbildmodus. In der Lobby erscheinen der QR-Code und die Namen der Beigetretenen.
2. Oeffne auf deinem eigenen Geraet, zum Beispiel Handy oder Tablet, die Regie-Seite.
3. Die Gaeste scannen den QR-Code, geben ihren Namen ein und sind in der Lobby.
4. Wenn alle da sind, klickst du in der Regie auf "Spiel starten". Die erste Frage laeuft mit dreissig Sekunden Countdown.
5. Nach Ablauf der Zeit loest die Regie automatisch auf, du kannst aber jederzeit "Jetzt aufloesen" druecken. Danach zeigst du mit "Leaderboard zeigen" den Zwischenstand und mit "Naechste Frage" geht es weiter.
6. Nach der letzten Frage waehlst du "Spiel beenden". Auf der Leinwand erscheint das Sieger-Podium mit Konfetti.

Wenn etwas durcheinandergeraet, kannst du in der Regie zu jeder Frage springen, einzelne Spieler entfernen, mit "Zur Lobby" zurueck oder mit "Alles zuruecksetzen" komplett neu starten.

## Die richtigen Antworten spaeter eintragen

Aktuell sind in `questions.json` zufaellige Loesungen markiert. Sobald du die echten Antworten hast, oeffnest du `questions.json` und setzt bei jeder Frage das Feld `correct` auf die richtige Position in der Liste `options`. Die Zaehlung beginnt bei null. Bei `"options": ["Lisa", "Johanna", "Jonas", "Jaron", "Jesaja", "Jonathan"]` bedeutet also:

- 0 ist Lisa
- 1 ist Johanna
- 2 ist Jonas
- 3 ist Jaron
- 4 ist Jesaja
- 5 ist Jonathan

Du kannst auch die Fragetexte aendern, Fragen hinzufuegen oder die Zeit pro Frage ueber `questionDurationSeconds` anpassen. Nach jeder Aenderung laedst du die `questions.json` erneut auf GitHub hoch.

## Vorher testen

Teste den kompletten Ablauf einmal in Ruhe, am besten mit zwei oder drei Handys. Oeffne dafuer Regie und Leinwand am Laptop und tritt mit den Handys ueber den QR-Code bei. So siehst du, ob alles synchron laeuft, bevor es im Gottesdienst ernst wird.

Ein lokaler Test direkt von der Festplatte funktioniert wegen der Browser-Sicherheit oft nicht, weil die `questions.json` dann nicht geladen werden darf. Am einfachsten testest du direkt auf GitHub Pages. Wer mag, kann lokal einen kleinen Server starten, zum Beispiel mit `python3 -m http.server` im Projektordner, und dann `http://localhost:8000` aufrufen.

## Kleiner Hinweis zur Fairness

Die richtigen Loesungen stehen in der `questions.json`, die technisch versierte Gaeste im Quelltext einsehen koennten. Fuer eine Gemeindegruppe ist das in der Praxis kein Problem. Wenn du das ganz ausschliessen willst, sag Bescheid, dann trenne ich die Loesungen in eine separate Datei, die nur die Regie kennt.
