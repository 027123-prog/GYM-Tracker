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

## Daten

Trainingsdaten bleiben im lokalen Browserspeicher. Über die Datenverwaltung in
der App lassen sie sich als JSON exportieren und wieder importieren. Vor einem
Import erstellt HardGainWAF zusätzlich eine lokale Wiederherstellungskopie.

Persönliche JSON-Backups, `backups/`, Build-Ausgaben und lokale Werkzeuge werden
nicht in Git eingecheckt.
