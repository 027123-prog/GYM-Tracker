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

## Android

Die signierte APK liegt nach `./android/Build.ps1` in `android/build/out/`. Der Build
benötigt JDK 17, Android SDK Platform 35 und Build Tools 35.0.0. Der Tracker läuft
ab Android 11 lokal. Browserdaten lassen sich über **Export** im Browser und
**Import** in der Android-App übernehmen. Das Zahnrad in der Kopfzeile öffnet
die Einstellung **Kalenderdesign**.

Ab 2.22.1 findet **Einstellungen → Nach Updates suchen** die aktuelle
Android-Version auf GitHub. Beim ersten In-App-Update kann Android einmalig
nach der Freigabe für Installationen durch HardGainWAF fragen. Das Training
selbst funktioniert offline.

Für eine neue Version `package.json` und `package-lock.json` aktualisieren und
die APK mit derselben App-ID und demselben Schlüssel bauen. Die Versionsnummer
bestimmt den Android-Versioncode. Die signierte Release-Datei
`HardGainWAF-<Version>.apk` an das GitHub-Release `android-v<Version>` hängen und
das vollständige Release als **Latest** veröffentlichen. Die App prüft Dateigröße,
SHA-256, App-ID, Versionscode und Signatur vor der Android-Installationsbestätigung.

Der Schlüssel liegt unter `%LOCALAPPDATA%/HardGainWAF/signing`. Die dort
gespeicherte Passwortdatei ist über Windows DPAPI an den Benutzer und Rechner gebunden.

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
Der obere Trapez ist beim Kreuzheben und Low Row als Mitwirkung, bei Row Plate
und Face Pull als leichte Stabilisierung berücksichtigt. Die Kataloggewichte
sind vereinfachte Darstellungsregeln; eigene bestätigte Zuordnungen bleiben erhalten.
Die Ergänzung stützt sich auf beobachtete Mitwirkung bei
[Kreuzhebevarianten](https://pubmed.ncbi.nlm.nih.gov/11932579/) und
[Rudervarianten](https://pubmed.ncbi.nlm.nih.gov/12613134/); die konkreten
Gewichte der App sind eigene Heuristik und keine aus EMG abgelesenen Prozente.
Explizit markierte Aufwärmsätze zählen nicht als Arbeitssätze. Erfasste RIR
fließen ein; freie Kommentare erzeugen keine erfundene Reserve. Kleine Restwerte
bleiben neutral, und Berechnung sowie 3D nutzen dieselbe Farbkurve.
Auch auf der Startseite laufen die letzten Farbstufen weicher in volles Rot;
Zeitskala und Neutralgrenze bleiben gleich.
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
ergänzt durch ein flaches Relief beidseits der Lendenwirbelsäule.
Die Arme stehen leicht vom Rumpf ab. In den Übungsdetails startet die Figur
mit der Ansicht aus der Kachel. Antippen einer Muskelzeile dreht die Figur
zur passenden Seite und hebt die Region kurz goldfarben hervor.
Der obere Trapez setzt seine Farbe nur als kurze, weiche beidseitige Projektion
am Nackenansatz direkt über der Schulterlinie fort. Der obere Hals, das Gesicht,
der vordere Hals und der Hinterkopf bleiben neutral.
`scripts/build-diego-anatomy.mjs` bereitet die heruntergeladene Quelle reproduzierbar
auf und komprimiert Texturen und Geometrie für den Webeinsatz.

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
