# HA Energy Dashboard

Ein vollständiges Energie-Dashboard für Home Assistant mit Solar, Batterie, Netz und Wärmepumpe.

![Dashboard](preview.html)

## Features

- **Energy Flow** – Animiertes Echtzeit-Diagramm mit Haus, Solar, Netz und Batterie
- **Zeiträume** – Gestern, diese Woche, letzter Monat, dieses Jahr, benutzerdefiniert
- **Statistik-Karten** – Verbrauch, Erzeugung, Einspeisung, Eigenverbrauch, Autarkiegrad
- **Wärmepumpe-Tab** – COP, thermische Energie, Heizen/Warmwasser-Aufschlüsselung
- **Interaktive Charts** – Balken- und Liniendiagramme mit Zoom
- **Kosten** – Stromkosten mit dynamischem oder festem Tarif

---

## Installation via HACS

### Voraussetzungen

- [HACS](https://hacs.xyz/) installiert
- Home Assistant 2023.1 oder neuer

### Schritt 1: Repository hinzufügen

1. HACS öffnen → **Integrations** (oder **Frontend**) → drei Punkte oben rechts → **Custom Repositories**
2. URL eintragen: `https://github.com/gorbi87/ha-energy-dashboard`
3. Kategorie: **Plugin**
4. **Add** klicken

### Schritt 2: Dashboard installieren

1. In HACS nach **HA Energy Dashboard** suchen
2. **Download** klicken
3. HACS installiert die Dateien nach `/config/www/community/ha-energy-dashboard/`

### Schritt 3: Panel registrieren

In `/config/configuration.yaml` eintragen:

```yaml
panel_iframe:
  energy_dashboard:
    title: "Energie"
    icon: mdi:solar-power-variant
    url: /local/community/ha-energy-dashboard/index.html
    require_admin: false
```

Danach Home Assistant neu starten.

### Schritt 4: Konfiguration anlegen

```bash
# Via SSH oder File Editor:
cp /config/custom_components/ha_energy_dashboard/www/config.example.js \
   /config/www/ha-energy-dashboard-config.js
```

Dann `/config/www/ha-energy-dashboard-config.js` mit den eigenen Entity-IDs und einem Long-Lived Access Token befüllen (siehe unten).

> **Wichtig:** Die Konfiguration liegt in `/config/www/` — dieser Ordner wird von HACS nie angefasst, die Datei bleibt bei jedem Update erhalten.

---

## Konfiguration

### Long-Lived Access Token

1. HA Profil → **Sicherheit** → **Langlebige Zugriffstoken** → **Token erstellen**
2. Token in `config.js` bei `accessToken` eintragen

### Entity-IDs

`config.js` enthält alle nötigen Sensor-Zuordnungen. Die wichtigsten:

```javascript
entities: {
  power: {
    consumption:       'sensor.DEIN_VERBRAUCH_W',        // Watt
    production:        'sensor.DEINE_PV_LEISTUNG_W',     // Watt
    grid_import:       'sensor.DEIN_NETZBEZUG_W',        // Watt
    grid_export:       'sensor.DEINE_EINSPEISUNG_W',     // Watt
    battery_charge:    'sensor.DEINE_BATTERIE_LADEN_W',  // Watt (optional)
    battery_discharge: 'sensor.DEINE_BATTERIE_ENTLADEN_W', // Watt (optional)
  },
  cumulative: {
    consumption: 'sensor.VERBRAUCH_GESAMT_KWH',   // kWh, state_class: total
    production:  'sensor.PV_GESAMT_KWH',
    grid_import: 'sensor.NETZBEZUG_GESAMT_KWH',
    grid_export: 'sensor.EINSPEISUNG_GESAMT_KWH',
  },
  // ... weitere Sensoren in config.example.js dokumentiert
}
```

Die vollständige Konfiguration mit allen Optionen ist in `config.example.js` dokumentiert.

---

## Einstellungen-Seite (optional, empfohlen für mehrere Instanzen)

Alternativ zu `config.js` lassen sich die meisten Sensoren auch direkt im Dashboard unter **Einstellungen** eintragen — praktisch, wenn man das Dashboard auf einer zweiten HA-Instanz (z.B. bei Familie/Freunden) einrichtet, ohne Dateien anzufassen. Dafür müssen einmalig folgende Helper existieren. Am einfachsten: Block in `configuration.yaml` einfügen und HA neu starten.

```yaml
input_boolean:
  energyboard_heatpump_enabled:
    name: Energyboard Heatpump Enabled
    icon: mdi:heat-pump

input_number:
  energyboard_reference_limit:
    name: Energyboard Reference Limit
    min: 0
    max: 50
    step: 0.5
  energyboard_electricity_rate:
    name: Energyboard Electricity Rate
    min: 0
    max: 1
    step: 0.01
  energyboard_feed_in_rate:
    name: Energyboard Feed In Rate
    min: 0
    max: 1
    step: 0.01
  energyboard_base_fee:
    name: Energyboard Base Fee
    min: 0
    max: 100
    step: 0.01

input_text:
  energyboard_power_sensors:
    name: Energyboard Power Sensors
    max: 255
  energyboard_other_sensors:
    name: Energyboard Other Sensors
    max: 255
  energyboard_rate_entity:
    name: Energyboard Rate Entity
    max: 255
  energyboard_energy_consumption_daily:
    name: Energyboard Energy Consumption Daily
    max: 255
  energyboard_energy_consumption_weekly:
    name: Energyboard Energy Consumption Weekly
    max: 255
  energyboard_energy_consumption_monthly:
    name: Energyboard Energy Consumption Monthly
    max: 255
  energyboard_energy_consumption_yearly:
    name: Energyboard Energy Consumption Yearly
    max: 255
  energyboard_energy_production_daily:
    name: Energyboard Energy Production Daily
    max: 255
  energyboard_energy_production_weekly:
    name: Energyboard Energy Production Weekly
    max: 255
  energyboard_energy_production_monthly:
    name: Energyboard Energy Production Monthly
    max: 255
  energyboard_energy_production_yearly:
    name: Energyboard Energy Production Yearly
    max: 255
  energyboard_energy_grid_import_daily:
    name: Energyboard Energy Grid Import Daily
    max: 255
  energyboard_energy_grid_import_weekly:
    name: Energyboard Energy Grid Import Weekly
    max: 255
  energyboard_energy_grid_import_monthly:
    name: Energyboard Energy Grid Import Monthly
    max: 255
  energyboard_energy_grid_import_yearly:
    name: Energyboard Energy Grid Import Yearly
    max: 255
  energyboard_energy_grid_export_daily:
    name: Energyboard Energy Grid Export Daily
    max: 255
  energyboard_energy_grid_export_weekly:
    name: Energyboard Energy Grid Export Weekly
    max: 255
  energyboard_energy_grid_export_monthly:
    name: Energyboard Energy Grid Export Monthly
    max: 255
  energyboard_energy_grid_export_yearly:
    name: Energyboard Energy Grid Export Yearly
    max: 255
  energyboard_energy_battery_charge_daily:
    name: Energyboard Energy Battery Charge Daily
    max: 255
  energyboard_energy_battery_charge_weekly:
    name: Energyboard Energy Battery Charge Weekly
    max: 255
  energyboard_energy_battery_charge_monthly:
    name: Energyboard Energy Battery Charge Monthly
    max: 255
  energyboard_energy_battery_charge_yearly:
    name: Energyboard Energy Battery Charge Yearly
    max: 255
  energyboard_energy_battery_discharge_daily:
    name: Energyboard Energy Battery Discharge Daily
    max: 255
  energyboard_energy_battery_discharge_weekly:
    name: Energyboard Energy Battery Discharge Weekly
    max: 255
  energyboard_energy_battery_discharge_monthly:
    name: Energyboard Energy Battery Discharge Monthly
    max: 255
  energyboard_energy_battery_discharge_yearly:
    name: Energyboard Energy Battery Discharge Yearly
    max: 255
  energyboard_cost_daily:
    name: Energyboard Cost Daily
    max: 255
  energyboard_cost_weekly:
    name: Energyboard Cost Weekly
    max: 255
  energyboard_cost_monthly:
    name: Energyboard Cost Monthly
    max: 255
  energyboard_cost_yearly:
    name: Energyboard Cost Yearly
    max: 255
  energyboard_cost_rate:
    name: Energyboard Cost Rate
    max: 255
  energyboard_cost_compensation:
    name: Energyboard Cost Compensation
    max: 255
```

Danach im Dashboard unter **Einstellungen**:
- Sensoren eintragen (Leistung, kumulative Energie, Energie-Aggregate, Kosten) — Tippen zeigt eine Autocomplete-Liste passender HA-Entities
- **Wärmepumpe-Tab anzeigen** ausschalten, falls keine Wärmepumpe vorhanden ist (blendet Tab, Stat-Karte und Flow-Diagramm-Knoten aus)
- **Speichern** klicken

Werte, die hier eingetragen werden, überschreiben die Defaults aus `config.js`. Leer gelassene Felder fallen auf `config.js` zurück.

> Die Wärmepumpe selbst (13 Daikin-Sensoren) ist aktuell nur über den Schalter ein-/ausschaltbar, die Sensor-Zuordnung ist noch fest in `app.js` (`_wpEntities`) verdrahtet — für eine andere Wärmepumpen-Marke müsste das noch konfigurierbar gemacht werden.

---

## Updates

Updates werden in HACS unter **Updates verfügbar** angezeigt und können dort direkt installiert werden. Die eigene `config.js` bleibt dabei erhalten.

---

## Lizenz

MIT License
