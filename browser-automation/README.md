# TeraBox browser automation

Lokale Browser-Automation für TeraBox mit einem persistenten Chrome-Profil und lokalem CDP-Port.

## Zweck

Dieser Modus ergänzt den bestehenden TeraBox-SIN-Client um einen Browser-basierten Weg für bereits normal angemeldete TeraBox-Webkonten. Authentifizierungsdaten werden nicht in Quellcode, Logs oder Git exportiert.

## Installation

```bash
cd browser-automation
npm install
npm run start
```

Beim ersten Start im geöffneten Chrome-Fenster normal bei TeraBox anmelden. Das lokale Profil bleibt danach erhalten.

## Befehle

```bash
npm run status
npm run snapshot
npm run upload -- /absolute/path/datei.zip
npm run mkdir -- "Neuer Ordner"
```

## Lokale Daten

Folgende Verzeichnisse sind absichtlich von Git ausgeschlossen:

- `browser-profile/`
- `data/`
- `downloads/`

Standardmäßig verwendet der Starter weiterhin `~/terabox-sin/browser-profile`, damit er mit der bereits getesteten Mac-i9-Installation kompatibel ist.

Der lokale CDP-Endpunkt ist `http://127.0.0.1:9225`.
