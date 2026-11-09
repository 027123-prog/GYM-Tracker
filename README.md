# HardGainWAF

HardGainWAF ist ein mobiler, lokal arbeitender Gym-Tracker mit Trainingsvorlagen,
Satzprotokoll, Maschinen-Setup, Kommentaren, Verlauf und Kraftwerten.

## Start

- `HardGainWAF - Firefox.vbs` startet die gebaute App unter
  `http://127.0.0.1:4175/`.
- `HardGainWAF Dev Shell.cmd` öffnet die Entwicklungsumgebung.
- Die veröffentlichte App liegt unter
  `https://027123-prog.github.io/GYM-Tracker/`.

## Entwicklung

```powershell
npm install
npm run dev
npm test
npm run build
```

## Workouts bearbeiten

**Korrigieren** öffnet ein abgeschlossenes Workout wieder als laufendes Training.
Sätze und die zuletzt gewählte Übung bleiben erhalten. Danach das Workout wie
gewohnt erneut abschließen.

Um eine ganze Übung samt Sätzen umzusortieren: Übung öffnen → **Übung verschieben**
→ **Neue Position** wählen → **Verschieben**. Das ändert die Reihenfolge in diesem
Workout; die Vorlage bleibt erhalten.

## Daten

Für Übungen mit zwei gleichen Hanteln unter **Übung bearbeiten → Belastungsart →
Zwei Einzelgewichte** umstellen. Danach nur das Gewicht einer Hantel eingeben:
20 kg werden als 2 × 20 kg gespeichert und mit 40 kg Gesamtlast ausgewertet.
Gewichtsvorschläge zeigen Einzelgewichte; Diagramme und Trainingsvolumen verwenden
die Gesamtlast. Bestehende Trainingswerte bleiben beim Umstellen erhalten.

Trainingsdaten bleiben im lokalen Browserspeicher. Über die Datenverwaltung in
der App lassen sie sich als JSON exportieren und wieder importieren. Vor einem
Import erstellt HardGainWAF zusätzlich eine lokale Wiederherstellungskopie.

Persönliche JSON-Backups, `backups/`, Build-Ausgaben und lokale Werkzeuge werden
nicht in Git eingecheckt.
