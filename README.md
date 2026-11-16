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

Neue und bearbeitete Sätze öffnen zunächst mit Auswahlkacheln. Erst der Stift
blendet die manuellen Felder und den Kommentar ein. Bereits gespeicherte
Körpergewichte werden wiederverwendet. Gewichte aus der Historie werden nur noch
aus den letzten sechs Einheiten innerhalb von 90 Tagen der neuesten Einheit
vorgeschlagen; noch nie verwendete, selbst hinterlegte Optionen bleiben verfügbar.
Die historischen Sätze werden dabei nicht gelöscht.

**Zuletzt** öffnet bei einer Übung ein kleines Fenster mit älteren und neueren
abgeschlossenen Einheiten. Gespeicherte Sätze zeigen ihre vorhandene Uhrzeit auch
im laufenden Training. Die Muskelkarte berücksichtigt bereits gespeicherte Sätze
laufender Workouts und berechnet Änderungen oder Löschungen unmittelbar neu;
als persönliche Vergleichsbasis dienen weiterhin abgeschlossene Einheiten.

## Daten

Die Übungsübersicht wechselt über einen kompakten Symbolbutton zwischen
**Graph → Zeilen → Körper → Graph**. Sein Symbol zeigt die aktuelle Ansicht.
Der Körpermodus
zeigt pro Übung deren geschätzte Muskelbeteiligung; auf der Diagrammseite folgt
unten die große Körperansicht mit einer von stark nach schwach sortierten Liste.
Hauptmuskeln, Mitwirkung und Stabilisierung verwenden dieselben Katalogrollen,
mit regionalen Schwerpunkten bei Brustübungen. Eine weichere Farbskala verringert
den sichtbaren Sprung zwischen Hauptarbeit und Mitwirkung, ohne ihre Gewichte
oder die Rangfolge zu ändern. Das ist ein Übungsprofil ohne
gemessene Aktivierungsprozente, unabhängig von Tagesform und Trainingshistorie.
Unbekannte Übungen und ungeklärte Varianten bleiben ausdrücklich ohne Zuordnung.
Die Bibliotheksvorschauen stehen still und starten vorn oder hinten, wo die
stärker beteiligten Muskelgruppen im Modell besser sichtbar sind. Jede Figur
lässt sich einzeln horizontal ziehen und bleibt in ihrer Position, auch nach
dem Scrollen aus dem sichtbaren Bereich. Tippen öffnet weiterhin die Details;
Pfeiltasten drehen die fokussierte Karte, Home stellt ihre Startseite wieder her.
Die Karten teilen einen WebGL-Renderer und ein Modell und zeichnen nur bei
Änderungen. Offscreen-Karten und Hintergrundtabs verbrauchen keine Zeichenzeit.
Die Sichtbarkeitsdaten werden mit `scripts/build-muscle-view-visibility.mjs`
aus dem vorhandenen Modell erzeugt; sie sind keine Aktivierungsmessung.

Die Startseite enthält eine drehbare Muskelkarte. Die Rotabstufungen schätzen die
aktuelle Trainingsbelastung anhand von relativer Last, Umfang und Zeitabstand.
Vorherige vergleichbare Einheiten bis 90 Tage berücksichtigen die persönliche
Progression. Die sichtbare Belastung klingt stündlich mit einer gewählten
Halbwertszeit von 24 Stunden ab; nur die letzten fünf Tage tragen zur Farbe bei.
Dies ist eine Darstellungsheuristik, keine gemessene Regenerationsdauer.
Hauptarbeit, Mitwirkung und Stabilisierung sind unterschiedlich gewichtet.
Explizit markierte Aufwärmsätze zählen nicht als Arbeitssätze. Erfasste RIR
fließen ein; freie Kommentare erzeugen keine erfundene Reserve. Kleine Restwerte
bleiben neutral, und Berechnung sowie 3D nutzen dieselbe Farbkurve.
Die Figur steht zwischen vier schmalen Kennzahlenkacheln auf der Startseite und dreht
sich ohne sichtbare Texte oder Bedienelemente. Ziehen/Wischen bleibt möglich;
reduzierte Bewegung wird respektiert. Quellen und Lizenzen sind über den Link
am Seitenende erreichbar.

Anatomiequellen und separate Modelllizenzen stehen in `public/anatomy/`.
Persönliche Trainingswerte sind nicht Teil der Grafikdateien.
Die freigegebene Figur „Male Full Body Ecorche“ von Diego Luján García (CC BY 4.0)
verwendet einen neutralen MakeHuman-Kopf (CC0). Helle Sehnenanteile innerhalb
zugeordneter Muskelflächen werden mitgefärbt; übrige Stützflächen bleiben neutral.
27 Trainingsbereiche sind sichtbar zugeordnet, darunter obere, mittlere und
untere Brust sowie der Serratus. Rückenstrecker im unteren Rücken und tiefe
Hüftbeuger werden als weiche, beidseitige Farbprojektionen auf den vorhandenen
Oberflächen sichtbar. Diese beiden Bereiche sind schematische Projektionen,
keine freigelegten anatomischen Muskelflächen. Die Körpergeometrie bleibt erhalten.
Der obere Trapez setzt seine Farbe als weiche, beidseitige Projektion am hinteren
Hals des Ersatzkopfs fort. Die bisherige Schnittkante endet dadurch nicht abrupt
in einem neutralen Nacken; Gesicht, vorderer Hals und Hinterkopf bleiben neutral.
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

## Aktualisieren

Die Adresse bleibt gleich. Ab 2.18 prüft die App beim Öffnen, bei Rückkehr in den
Vordergrund und minütlich eine cachefreie `version.json`. Bei neuer Version
erscheint „Aktualisieren“. Der Schalter speichert zuerst den aktuellen Stand,
lädt den App-Einstieg mit einer neuen Versionskennung und erhält die Workout-Route.
Ein laufendes Training wird nicht automatisch neu geladen. Veraltete Antworten
führen nicht zum Downgrade; offline bleibt die App benutzbar. Die 3D-Dateien
haben zusätzlich eine eigene Revisionskennung gegen veraltete Modell-Caches.

Zum Aktualisieren keine Browser-/Websitedaten löschen: Darin liegen auch die
Trainingsdaten. Vor deren Löschung immer exportieren. Ein Appupdate ersetzt
oder importiert keine Trainingsdaten.
