# ⚡ Quickstart

## Was du brauchst

- [HACS](https://hacs.xyz/) installiert
- Deine Energie-Sensoren (Solar/Verbrauch/Netz) — Entity-IDs findest du unter
  **Entwicklerwerkzeuge → Zustände**, Suche nach `solar`, `energy`, `consumption`

---

## Installation (2 Schritte)

### 1. Über HACS installieren

1. HACS → drei Punkte oben rechts → **Eigene Repositories**
2. URL: `https://github.com/gorbi87/ha-energy-dashboard`, Kategorie: **Integration**
3. In HACS nach **HA Energy Dashboard** suchen → **Download**

### 2. Panel registrieren

In `configuration.yaml`:

```yaml
ha_energy_dashboard:

panel_custom:
  - name: energy-panel
    sidebar_title: Energie
    sidebar_icon: mdi:solar-power-variant
    module_url: /ha-energy-dashboard/panel.js
    embed_iframe: false
    require_admin: false
```

**Home Assistant neu starten.** In der Sidebar erscheint "Energie".

---

## Sensoren eintragen (kein Datei-Zugriff nötig)

Im Dashboard oben rechts auf **Einstellungen** klicken:

1. Sensoren eintragen (Verbrauch, Erzeugung, Netzbezug, Einspeisung, ...) — beim Tippen erscheint
   eine Autocomplete-Liste passender Entities aus deiner HA-Instanz
2. Falls keine Wärmepumpe vorhanden: **Wärmepumpe-Tab anzeigen** ausschalten
3. **Speichern** klicken

Fertig — die Werte werden serverseitig gespeichert und gelten für alle Geräte, ganz ohne `config.js`.

> Nur falls du den Access Token oder UI-Feinheiten setzen willst, gibt es zusätzlich eine
> optionale `config.js` — siehe README.md, Abschnitt "Konfiguration".

---

## Fehlerbehebung

**Panel taucht nicht in der Sidebar auf**
- `configuration.yaml`-Syntax prüfen: Entwicklerwerkzeuge → YAML → Konfiguration prüfen
- Home Assistant wirklich neu gestartet (nicht nur Browser-Reload)?
- Logs: Einstellungen → System → Protokolle, nach `ha_energy_dashboard` suchen

**Panel ist da, aber oben abgeschnitten / Inhalt fehlt**
- Browser hart neu laden (Strg+Shift+R)
- Browser-Konsole (F12) auf Fehler prüfen

**Keine Daten / alles zeigt 0,00**
- Einstellungen-Seite öffnen, Entity-IDs prüfen (Autocomplete zeigt nur existierende Sensoren)
- F12 → Console: Fehler wie `API 404` oder `API 401` weisen auf falsche Entity-ID bzw. Auth-Problem hin

---

## Mehr Details

Vollständige Anleitung mit allen Optionen: **README.md**
