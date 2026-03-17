# ⚡ QUICKSTART - Leneda Dashboard in 5 Minuten

## 📋 Was du brauchst

- ✅ Home Assistant installiert
- ✅ File Editor Add-on (oder SSH-Zugriff)
- ✅ Energie-Sensoren (Solar/Verbrauch/Grid)

---

## 🚀 Installation in 3 Schritten

### **SCHRITT 1: Dateien hochladen** (2 Minuten)

**Via File Editor:**

1. Öffne **File Editor** in Home Assistant
2. Klicke auf 📁 **Ordner-Symbol** → **Neuer Ordner**
3. Erstelle: `www/leneda-dashboard`
4. Lade **alle 5 Dateien** in diesen Ordner hoch:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
   - `README.md`

**Ergebnis:** `/config/www/leneda-dashboard/index.html` sollte existieren

---

### **SCHRITT 2: Panel registrieren** (1 Minute)

1. Öffne `/config/configuration.yaml`
2. Füge am Ende hinzu:

```yaml
panel_iframe:
  leneda_dashboard:
    title: "Leneda Energy"
    icon: mdi:lightning-bolt
    url: /local/leneda-dashboard/index.html
    require_admin: false
```

3. **Speichern!** 💾

---

### **SCHRITT 3: Home Assistant neustarten** (1 Minute)

1. **Developer Tools** → **YAML** → **Restart Home Assistant**
2. Warte 30-60 Sekunden
3. **Refresh Browser** (F5)

✅ **FERTIG!** Das Dashboard erscheint jetzt in der Sidebar! 🎉

---

## ⚙️ Sensoren konfigurieren (1 Minute)

**WICHTIG:** Passe `config.js` an deine Sensoren an!

### Deine Entity-IDs finden:

1. **Developer Tools** → **States** (Zustände)
2. Suche nach: `solar`, `energy`, `consumption`
3. Kopiere die **Entity-ID** (z.B. `sensor.solar_house_consumption_daily`)

### config.js bearbeiten:

Öffne `/config/www/leneda-dashboard/config.js` und trage ein:

```javascript
entities: {
    consumption: 'sensor.DEIN_VERBRAUCH_SENSOR',    // ← HIER ändern!
    production: 'sensor.DEINE_PV_PRODUKTION',       // ← HIER ändern!
    exported: 'sensor.DEINE_EINSPEISUNG',           // ← HIER ändern!
    grid_import: 'sensor.DEIN_NETZBEZUG',           // ← HIER ändern!
}
```

**Beispiel mit deinen SolarEdge Sensoren:**

```javascript
entities: {
    consumption: 'sensor.solar_house_consumption_daily',
    production: 'sensor.solar_panel_to_house_daily',
    exported: 'sensor.solar_exported_power_daily',
    grid_import: 'sensor.solar_imported_power_daily',
}
```

**Speichern** → **Browser Refresh** (Strg + Shift + R)

---

## ✅ Fertig!

Dein Dashboard sollte jetzt funktionieren mit:

- ✅ Navigation oben (Dashboard, Sensors, Invoice, Settings)
- ✅ Zeitauswahl (Yesterday, This Week, etc.)
- ✅ 4 Statistik-Karten mit echten Werten
- ✅ Animiertes Energy Flow Diagramm
- ✅ Key Metrics Sidebar
- ✅ Energy Profile Chart

---

## 🐛 Funktioniert nicht?

### Dashboard lädt nicht / 404 Error

```bash
# Prüfe Dateipfad:
ls -la /config/www/leneda-dashboard/
# Du solltest sehen: index.html, styles.css, app.js, config.js
```

**Fix:**
- Dateien richtig hochgeladen?
- URL in `configuration.yaml` korrekt: `/local/leneda-dashboard/index.html`
- HA neu gestartet?

### Keine Daten / alles 0,00

**Fix:**
1. Öffne Browser Console (F12 → Console)
2. Prüfe Entity-IDs:
   ```javascript
   // Steht dort sowas?
   Failed to fetch: sensor.xyz
   ```
3. **Entity-IDs in config.js korrigieren!**

### Panel nicht in Sidebar

**Fix:**
1. YAML Syntax prüfen:
   ```
   Developer Tools → YAML → Check Configuration
   ```
2. Logs ansehen:
   ```
   Settings → System → Logs
   ```
3. Browser-Cache leeren: **Strg + Shift + R**

---

## 📱 Bonus: Als iFrame Karte

Willst du das Dashboard in einem bestehenden Dashboard anzeigen?

1. Neues Dashboard öffnen
2. **Karte hinzufügen** → **Nach unten scrollen** → **iFrame**
3. Eintragen:
   ```yaml
   type: iframe
   url: /local/leneda-dashboard/index.html
   aspect_ratio: "16:9"
   ```

---

## 🎨 Design anpassen

### Farben ändern

Öffne `styles.css`, suche nach `:root` und ändere:

```css
:root {
    --accent-blue: #4a9eff;      /* Hauptfarbe */
    --accent-red: #ef4444;       /* Consumption */
    --accent-green: #10b981;     /* Production */
}
```

### Animation schneller/langsamer

In `config.js`:

```javascript
ui: {
    animationSpeed: 2.0,    // 2x schneller
    // oder
    animationSpeed: 0.5,    // 2x langsamer
}
```

---

## 📖 Mehr Details?

Vollständige Anleitung: **README.md** lesen!

- Alle Features erklärt
- Fehlerbehebung im Detail
- FAQ
- Roadmap

---

## 🎯 Das war's!

**Du hast jetzt ein funktionierendes Leneda Energy Dashboard!** ⚡

Bei Problemen: README.md lesen oder Browser Console (F12) prüfen.

**Viel Spaß mit deinem neuen Dashboard! 🚀**
