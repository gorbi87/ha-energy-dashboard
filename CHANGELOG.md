# Changelog

## [1.4.2] - 2026-09-15

### Fixed
- **Bug:** `loadSettings()` hat `rateEntity` (Strompreis-Sensor fuer dynamische Tarife) bei jedem
  Laden bedingungslos ueberschrieben, auch wenn im Storage noch nichts gespeichert war — dadurch
  fiel die Anzeige nach dem Umbau auf v1.4.0 auf "Fester Wert" zurueck, obwohl ein Sensor konfiguriert
  war. Wird jetzt wie alle anderen Felder nur ueberschrieben, wenn der Storage-Key tatsaechlich gesetzt ist.
- `setVal()` in `populateSettingsForm()` liess Zahlenfelder mit Wert `0` leer (truthy-Check statt
  Praesenz-Check) — betraf z.B. eine Grundgebuehr von 0 EUR.
- Waermepumpe-Toggle wurde durch eine zu allgemeine CSS-Regel (`.settings-field label`, die auch den
  Toggle-Wrapper traf, da er zufaellig ebenfalls ein `<label>` ist) auf 160px Breite gezogen statt 42px.

### Added
- Kurze Beschreibung unter jedem Feld/jeder Sensor-Gruppe in den Einstellungen.

### Data-Loss-Hinweis
- Beim Aufraeumen der 38 alten Helper in v1.4.0 wurden `Grundgebuehr` und `Strompreis-Entitaet`
  (die kein `config.js`-Aequivalent haben) mitgeloescht, ohne vorher migriert zu werden. Werte
  liessen sich ueber die HA-Historie der geloeschten Entities rekonstruieren, muessen aber einmalig
  ueber die Einstellungen-Seite neu eingetragen werden.

---

## [1.4.1] - 2026-09-15

### Added
- Aktualisierungsintervall (bisher nur in `config.js` als `ui.refreshInterval`) jetzt in den
  Einstellungen editierbar (Sekunden, wirkt sofort nach dem Speichern ohne Reload).

### Note
- `ui.animationSpeed`, `ui.chartHeight` und `ui.locale` bleiben vorerst nur in `config.js`
  dokumentiert — sie werden im Code aktuell gar nicht ausgelesen, wären also totes UI gewesen.

---

## [1.4.0] - 2026-09-15

### Changed
- Einstellungen-Persistenz komplett auf einen eigenen Backend-Endpunkt umgestellt
  (`/api/ha_energy_dashboard/settings`, JSON-Datei über HA's `Store`-Helper) statt HA-Helper-Entities.
  Alle 38 `energyboard_*`-Helper (7 aus v1.2.x + 31 aus v1.3.0) entfallen ersatzlos — die
  Einstellungen-Seite funktioniert direkt nach der Installation, ohne jegliches Setup.
- Grund: `input_text` ist bei HA auf 255 Zeichen begrenzt, zu wenig für die kombinierten
  Energie-/Kosten-Entity-IDs aus v1.3.0.

### Setup
- Da der neue Endpunkt Teil des Python-Backends ist, braucht dieses Update (anders als reine
  HTML/CSS/JS-Änderungen) einen **HA-Neustart**.
- Bereits über v1.3.0 angelegte `energyboard_*`-Helper können danach gelöscht werden — sie werden
  nicht mehr gelesen.

---

## [1.3.0] - 2026-09-15

### Added
- Wärmepumpe-Tab per Schalter in den Einstellungen ein-/ausschaltbar (Tab, Stat-Karte und
  Flow-Diagramm-Knoten werden ausgeblendet, keine Anfragen mehr an nicht vorhandene Sensoren).
- Energie-Aggregate (Tag/Woche/Monat/Jahr, 6 Kategorien) und Kosten-Sensoren (Tag/Woche/Monat/Jahr,
  Strompreis- und Vergütungs-Sensor) jetzt über die Einstellungen-Seite konfigurierbar statt nur
  per Hand in `config.js`.

---

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
