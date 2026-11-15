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

Die Startseite enthält eine drehbare Muskelkarte. Die Rotabstufungen schätzen die
Trainingsbelastung der letzten zwei Wochen anhand von relativer Last, Umfang und
Zeitabstand. Vorherige vergleichbare Einheiten berücksichtigen die persönliche
Progression. Die Figur steht zwischen vier schmalen Kennzahlenkacheln auf der Startseite und dreht
sich ohne sichtbare Texte oder Bedienelemente. Ziehen/Wischen bleibt möglich;
reduzierte Bewegung wird respektiert. Quellen und Lizenzen sind über den Link
am Seitenende erreichbar.

Anatomiequellen und separate Modelllizenzen stehen in `public/anatomy/`.
Persönliche Trainingswerte sind nicht Teil der Grafikdateien.
Die freigegebene Figur „Male Full Body Ecorche“ von Diego Luján García (CC BY 4.0)
verwendet einen neutralen MakeHuman-Kopf (CC0). Helle Sehnenanteile innerhalb
zugeordneter Muskelflächen werden mitgefärbt; übrige Stützflächen bleiben neutral.
24 sichtbare Trainingsbereiche werden eingefärbt, darunter obere, mittlere und
untere Brust mit vereinfachten übungsspezifischen Schwerpunkten. Rückenstrecker und tiefe
Hüftbeuger besitzen in dieser Figur keine eigene sichtbare Außenfläche.
`scripts/build-diego-anatomy.mjs` bereitet die heruntergeladene Quelle reproduzierbar
auf; Form und Oberflächendetails bleiben erhalten, Texturen und Geometrie werden
für den Webeinsatz komprimiert.

Für Übungen mit zwei gleichen Hanteln unter **Übung bearbeiten → Belastungsart →
Zwei Einzelgewichte** umstellen. Danach nur das Gewicht einer Hantel eingeben:
20 kg werden als 2 × 20 kg gespeichert und mit 40 kg Gesamtlast ausgewertet.
Gewichtsvorschläge zeigen Einzelgewichte; Diagramme und Trainingsvolumen verwenden
die Gesamtlast. Bestehende Trainingswerte bleiben beim Umstellen erhalten.

Trainingsdaten bleiben im lokalen Browserspeicher. Über die Datenverwaltung in
der App lassen sie sich als JSON exportieren und wieder importieren. Vor einem
Import erstellt HardGainWAF zusätzlich eine lokale Wiederherstellungskopie.

Plan-Dateien im Format `hardgainwaf-training-plans` werden über denselben
Import eingelesen. Sie aktualisieren ausschließlich die enthaltenen Vorlagen
anhand ihrer IDs und ergänzen fehlende Übungen. Vorhandene Übungseinstellungen,
Workouts, Satzwerte, Kraftwerte und das laufende Training bleiben erhalten.
Andere Vorlagen werden nicht entfernt. Wiederholter Planimport erzeugt keine
Duplikate. Eine vollständige Sicherungsdatei ersetzt weiterhin den Datenstand.

Persönliche JSON-Backups, `backups/`, Build-Ausgaben und lokale Werkzeuge werden
nicht in Git eingecheckt.
