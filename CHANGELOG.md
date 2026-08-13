# Changelog

## [1.2.1] - 2026-08-13

### Fixed
- Panel-Inhalt wurde nach einem HA-Core-Update oben abgeschnitten (iframe kollabierte auf Mini-Höhe,
  da `height: 100%` nicht mehr zuverlässig durch den HA-Panel-Container vererbt wurde).
  `panel.js` misst die Höhe jetzt per JS (`getBoundingClientRect`/`resize`) statt sich auf CSS-Vererbung zu verlassen.

---

## [1.2.0] - 2026-03-17

### Fixed
- `config.js` wird nicht mehr aus dem HACS-Ordner geladen (würde bei Updates gelöscht).
  Konfiguration liegt jetzt dauerhaft in `/config/www/ha-energy-dashboard-config.js`.

---

## [1.1.0] - 2026-03-17

### Added
- Reset Zoom Button im Kosten-Tab (Rate Chart)

### Fixed
- HACS Integration-Typ statt Plugin (alle Dateien werden korrekt installiert)
- Kompatibilität mit HA 2026.x (`async_register_static_paths`)

---

## [1.0.0] - 2026-03-17

### Added
- Initiale Version
- Energy Flow Diagramm mit Solar, Batterie, Netz, Haus
- Zeiträume: Heute, Gestern, Diese Woche, Letzter Monat, Dieses Jahr, Benutzerdefiniert
- Statistik-Karten mit Verbrauch, Erzeugung, Einspeisung, Eigenverbrauch
- Wärmepumpe-Tab mit COP, Heizen/Warmwasser-Aufschlüsselung
- Kosten-Tab mit dynamischem Strompreis-Chart
- Interaktive Charts mit Zoom & Pan
- HACS-kompatibel
