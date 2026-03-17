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
cp /config/www/community/ha-energy-dashboard/config.example.js \
   /config/www/community/ha-energy-dashboard/config.js
```

Dann `config.js` mit den eigenen Entity-IDs und einem Long-Lived Access Token befüllen (siehe unten).

> **Wichtig:** `config.js` wird bei HACS-Updates nicht überschrieben.

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

## Updates

Updates werden in HACS unter **Updates verfügbar** angezeigt und können dort direkt installiert werden. Die eigene `config.js` bleibt dabei erhalten.

---

## Lizenz

MIT License
