# 🔋 Leneda Energy Dashboard - Installation Guide

## Was du bekommst

Eine **1:1 Kopie** des Leneda Energy Dashboards mit:

✅ **Exakt gleiches Design** - Dunkles Theme, gleiche Farben, gleiches Layout  
✅ **Navigation Tabs** - Dashboard, Sensors, Invoice, Settings  
✅ **Zeitauswahl** - Yesterday, This Week, Last Week, Month, Year, Custom  
✅ **Statistik-Karten** - Consumption, Production, Exported, Self-Consumed  
✅ **Animiertes Energy Flow Diagramm** - Mit Haus, Grid, Solar und Live-Daten  
✅ **Key Metrics Sidebar** - Self-Sufficiency, Peak Power, Gas, etc.  
✅ **Energy Profile Chart** - Interaktives Balkendiagramm mit ApexCharts  
✅ **Responsive Design** - Funktioniert auf Desktop, Tablet, Mobile  

---

## 📦 Dateien im Paket

```
leneda-app/
├── index.html      - Hauptseite mit kompletter UI-Struktur
├── styles.css      - Exakte Kopie des Leneda-Designs
├── app.js          - JavaScript mit HA-Integration & Animationen
├── config.js       - Deine Sensor-Konfiguration
└── README.md       - Diese Anleitung
```

---

## 🚀 Installation (3 Methoden)

### **Methode 1: Als Home Assistant Panel** ⭐ EMPFOHLEN

Das Dashboard läuft als eigenständiges Panel in Home Assistant.

#### Schritt 1: Dateien hochladen

**Via File Editor:**
1. Öffne **File Editor** in Home Assistant
2. Erstelle Ordner: `/config/www/leneda-dashboard/`
3. Lade alle Dateien in diesen Ordner hoch:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`

**Via SSH:**
```bash
mkdir -p /config/www/leneda-dashboard
cd /config/www/leneda-dashboard
# Kopiere alle Dateien hierher
```

#### Schritt 2: Panel registrieren

Füge in deine `/config/configuration.yaml` ein:

```yaml
panel_iframe:
  leneda_dashboard:
    title: "Leneda Energy"
    icon: mdi:lightning-bolt
    url: /local/leneda-dashboard/index.html
    require_admin: false
```

#### Schritt 3: Home Assistant neustarten

**Developer Tools** → **YAML** → **Restart Home Assistant**

✅ **Fertig!** Das Dashboard erscheint in der Sidebar!

---

### **Methode 2: Als Lovelace iFrame Card**

Zeige das Dashboard in einem Dashboard an.

1. Dateien wie oben hochladen nach `/config/www/leneda-dashboard/`
2. Neue Karte in Lovelace hinzufügen:

```yaml
type: iframe
url: /local/leneda-dashboard/index.html
aspect_ratio: 16:9
```

---

### **Methode 3: Standalone (außerhalb von HA)**

Nutze das Dashboard auf einem separaten Webserver.

1. Kopiere alle Dateien auf deinen Webserver
2. Passe in `config.js` die HA-URL an:
   ```javascript
   homeAssistant: {
       url: 'http://homeassistant.local:8123'
   }
   ```
3. Öffne `index.html` im Browser

---

## ⚙️ Konfiguration

### Schritt 1: Sensor-Zuordnung

Öffne `config.js` und trage deine **exakten Entity-IDs** ein:

```javascript
entities: {
    // PFLICHT - Diese Sensoren werden BENÖTIGT:
    consumption: 'sensor.solar_house_consumption_daily',
    production: 'sensor.solar_panel_to_house_daily',
    exported: 'sensor.solar_exported_power_daily',
    grid_import: 'sensor.solar_imported_power_daily',
    
    // OPTIONAL - Falls vorhanden:
    battery_charge: 'sensor.solar_battery_in_daily',
    battery_discharge: 'sensor.solar_battery_out_daily',
    battery_level: 'sensor.battery_level',      // in %
    peak_power: 'sensor.peak_power',            // in kW
    gas_energy: 'sensor.gas_energy',            // in kWh
    gas_volume: 'sensor.gas_volume',            // in m³
}
```

### Schritt 2: Entity-IDs finden

**So findest du deine exakten Sensor-Namen:**

1. **Entwicklerwerkzeuge** → **Zustände**
2. Suche nach: `solar`, `energy`, `power`, `consumption`
3. Kopiere die **exakte Entity-ID** (z.B. `sensor.solar_house_consumption_daily`)

**Häufige Sensor-Namen:**

| Typ | Beispiel-Entity-IDs |
|-----|---------------------|
| Verbrauch | `sensor.home_consumption`, `sensor.house_energy` |
| PV-Erzeugung | `sensor.solar_production`, `sensor.pv_power` |
| Netzbezug | `sensor.grid_import`, `sensor.imported_energy` |
| Einspeisung | `sensor.grid_export`, `sensor.exported_energy` |
| Batterie | `sensor.battery_charge`, `sensor.battery_soc` |

### Schritt 3: Zeiträume anpassen

Falls deine Sensoren andere Suffixe haben:

```javascript
periods: {
    yesterday: {
        suffix: '_daily'     // Ändere zu '_today' oder '_day' wenn nötig
    },
    this_month: {
        suffix: '_monthly'   // Oder '_month', '_current_month', etc.
    }
}
```

---

## 🎨 Anpassungen

### Farben ändern

In `styles.css`, ändere die CSS-Variablen:

```css
:root {
    --accent-blue: #4a9eff;      /* Hauptfarbe */
    --accent-red: #ef4444;       /* Consumption */
    --accent-green: #10b981;     /* Production */
    --accent-purple: #8b5cf6;    /* Self-Consumed */
}
```

### Energy Flow Animation

In `app.js`, passe die Animation an:

```javascript
ui: {
    animationSpeed: 1.0,    // Schneller: 2.0, Langsamer: 0.5
}
```

### Chart-Höhe

In `config.js`:

```javascript
ui: {
    chartHeight: 350,  // Höhe in Pixel
}
```

---

## 🔧 Fehlerbehebung

### Dashboard lädt nicht

**Problem:** Leere Seite oder 404 Error

**Lösung:**
1. Prüfe Dateipfad: `/config/www/leneda-dashboard/index.html`
2. Prüfe `configuration.yaml` Syntax:
   ```yaml
   panel_iframe:
     leneda_dashboard:
       url: /local/leneda-dashboard/index.html  # ← WICHTIG: /local/ nicht /www/
   ```
3. Home Assistant neustarten

### Keine Daten sichtbar

**Problem:** Dashboard zeigt "Loading" oder 0,00 Werte

**Lösung:**
1. **Prüfe Entity-IDs** in `config.js`:
   - Öffne **Entwicklerwerkzeuge** → **Zustände**
   - Suche deine Sensoren
   - Kopiere **exakte** Entity-ID (inkl. Suffix!)

2. **Browser-Konsole prüfen** (F12 → Console):
   ```
   Failed to fetch entity: sensor.xyz
   ```
   → Entity-ID ist falsch

3. **Prüfe Sensor-Werte**:
   - Haben die Sensoren gültige Zahlen?
   - Sind sie `available`? (nicht `unknown` oder `unavailable`)

### Chart zeigt keine Daten

**Problem:** Energy Profile Chart ist leer

**Lösung:**
1. Prüfe ob **ApexCharts** geladen wurde (F12 → Network)
2. Chart nutzt aktuell **Demo-Daten** 
3. Für echte Daten: Implementiere `getHistoricalData()` in `app.js`

### Energy Flow Animation läuft nicht

**Problem:** Statisches Bild, keine Animation

**Lösung:**
1. **JavaScript-Fehler?** F12 → Console
2. **Canvas nicht supported?** Sehr alte Browser
3. **Performance-Problem?** Reduziere `animationSpeed` in config.js

### Panel erscheint nicht in Sidebar

**Problem:** Nach Neustart kein neues Panel sichtbar

**Lösung:**
1. **YAML-Syntax prüfen**:
   ```bash
   # Developer Tools → YAML → Check Configuration
   ```
2. **Logs prüfen**:
   ```
   Settings → System → Logs
   # Suche nach "panel_iframe" Fehlern
   ```
3. **Browser-Cache leeren**: Strg + Shift + R

---

## 📊 Berechnete Werte

Das Dashboard berechnet automatisch:

### Self-Consumed (Eigenverbrauch)
```
= Production - Exported
= Erzeugung - Einspeisung
```

### Self-Sufficiency (Autarkiegrad)
```
= ((Consumption - Grid Import) / Consumption) × 100%
= ((Verbrauch - Netzbezug) / Verbrauch) × 100%
```

**Beispiel:**
- Verbrauch: 12,34 kWh
- Netzbezug: 6,89 kWh
- Autarkiegrad: ((12,34 - 6,89) / 12,34) × 100% = **44,2%**

---

## 🔄 Updates & Wartung

### Dashboard aktualisieren

1. Lade neue Versionen der Dateien herunter
2. Ersetze die alten Dateien in `/config/www/leneda-dashboard/`
3. **Wichtig:** Browser-Cache leeren! (Strg + Shift + R)

### Konfiguration sichern

Sichere `config.js` bevor du Updates machst:
```bash
cp /config/www/leneda-dashboard/config.js /config/backups/leneda-config.js
```

---

## 🎯 Roadmap / Geplante Features

- [ ] **Live-Daten aus HA** (aktuell: Demo-Daten in Chart)
- [ ] **Historische Charts** (Woche, Monat, Jahr)
- [ ] **Sensors Tab** (Detailansicht aller Sensoren)
- [ ] **Invoice Tab** (Kosten-Kalkulation)
- [ ] **Settings Tab** (UI-Einstellungen im Dashboard)
- [ ] **Custom Date Range** (Eigene Zeiträume wählen)
- [ ] **Export** (PDF/CSV Export der Daten)
- [ ] **Mehrsprachigkeit** (DE/EN/FR)

---

## ❓ FAQ

**F: Funktioniert das mit SolarEdge / Fronius / SMA?**  
A: Ja! Solange du Sensoren für Consumption, Production, Export hast.

**F: Brauche ich eine Batterie?**  
A: Nein, Battery-Sensoren sind optional. Dashboard funktioniert auch ohne.

**F: Kann ich monatliche statt tägliche Werte anzeigen?**  
A: Ja! Ändere in `config.js`:
```javascript
consumption: 'sensor.solar_house_consumption_monthly'
```

**F: Warum zeigt der Chart Demo-Daten?**  
A: Live-Daten aus HA History kommen in v2. Aktuell: Zufallsdaten zur Demo.

**F: Kann ich das Design anpassen?**  
A: Ja! Alle Farben in `styles.css` unter `:root` CSS-Variablen.

**F: Funktioniert das auf dem Handy?**  
A: Ja, vollständig responsive! Optimiert für Mobile, Tablet und Desktop.

---

## 🐛 Bug Reports & Feature Requests

Probleme gefunden? Ideen für neue Features?

1. **GitHub Issues** erstellen (falls Repository vorhanden)
2. **Screenshots** beifügen
3. **Browser-Console** Logs kopieren (F12 → Console)
4. **Entity-IDs** anonymisiert teilen

---

## 📜 Lizenz

Dieses Projekt ist **Open Source** und kostenlos nutzbar.

Basiert auf dem Design von [Leneda.lu](https://www.leneda.lu/) - Energy Monitoring Platform.

---

**Viel Erfolg mit deinem Leneda Dashboard! ⚡**

Bei Fragen einfach melden! 🚀
