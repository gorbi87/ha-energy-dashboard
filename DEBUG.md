# 🐛 Leneda Dashboard - Debugging Guide

## Problem: Dashboard zeigt Demo-Daten statt echte Werte

### Schritt 1: Browser Console öffnen

1. **Drücke F12** (oder Rechtsklick → "Untersuchen")
2. Gehe zum **Console** Tab
3. **Refresh** die Seite (Strg + R)

### Schritt 2: Console Logs prüfen

Du solltest diese Meldungen sehen:

```
✅ ERFOLG - Echte Daten geladen:
🚀 Starting Leneda Dashboard...
🔋 Leneda Dashboard initializing...
✅ Config loaded: {entities: {...}}
📡 Loading data from Home Assistant...
✅ Loaded sensor.xyz: 12.34
✅ Dashboard updated with real data
✅ Auto-refresh enabled (every 30s)
```

```
⚠️ WARNUNG - Keine Verbindung zu HA:
⚠️ Could not load sensor.xyz: 401
❌ Error loading from HA: ...
📊 Using demo data
```

---

## Fix 1: Entity-IDs in config.js prüfen

### Problem: Falsche Sensor-Namen

Öffne `/config/www/leneda-dashboard/config.js` und prüfe:

```javascript
entities: {
    consumption: 'sensor.solar_house_consumption_daily',  // ← Ist das korrekt?
    production: 'sensor.solar_panel_to_house_daily',      // ← Existiert dieser Sensor?
    exported: 'sensor.solar_exported_power_daily',        // ← Richtig geschrieben?
    grid_import: 'sensor.solar_imported_power_daily',     // ← Stimmt das?
}
```

### ✅ So findest du die KORREKTEN Entity-IDs:

1. **Developer Tools** → **Zustände** (States)
2. Suche nach: `solar` oder `energy` oder `power`
3. **Kopiere die exakte Entity-ID**

**Beispiele:**
```
❌ FALSCH: sensor.solar_power
✅ RICHTIG: sensor.solaredge_ac_power

❌ FALSCH: sensor.house_consumption
✅ RICHTIG: sensor.solar_house_consumption_daily
```

---

## Fix 2: Sensoren existieren prüfen

### Test in Home Assistant:

1. Gehe zu **Developer Tools** → **Zustände**
2. Suche nach deinem Sensor (z.B. `sensor.solar_house_consumption_daily`)
3. Prüfe:
   - ✅ Sensor existiert?
   - ✅ Hat einen Wert (nicht `unknown` oder `unavailable`)?
   - ✅ Ist die Zahl gültig (z.B. `12.34` nicht `error`)?

### Häufige Probleme:

```
Sensor: unavailable
→ Integration ist offline oder Sensor defekt

Sensor: unknown
→ Sensor hat noch keine Daten gesammelt (warte 5 Minuten)

Sensor: 0.0
→ Sensor funktioniert, aber aktuell kein Wert (z.B. nachts bei Solar)
```

---

## Fix 3: Dashboard neu laden

Nach Änderungen an `config.js`:

1. **Speichern** der Datei
2. **Browser:** Strg + Shift + R (Hard Refresh)
3. **F12** → Console prüfen

Du solltest sehen:
```
✅ Config loaded: {entities: {...}}
✅ Loaded sensor.xyz: 12.34
```

---

## Fix 4: CORS / Auth Probleme

### Symptom: 401 Unauthorized oder CORS Error

Das Dashboard läuft als **iFrame** und kann nicht direkt auf die HA API zugreifen.

### Lösung A: Über HA Ingress (empfohlen)

Dashboard läuft bereits INNERHALB von Home Assistant → **Sollte funktionieren!**

### Lösung B: Long-Lived Access Token (falls externe Seite)

1. **Profil** → **Long-Lived Access Tokens**
2. **Token erstellen** → Kopieren
3. In `config.js` hinzufügen:

```javascript
homeAssistant: {
    url: 'http://homeassistant.local:8123',
    token: 'DEIN_TOKEN_HIER'  // ← Einfügen!
}
```

**ACHTUNG:** Token ist wie ein Passwort - NICHT öffentlich teilen!

---

## Fix 5: Buttons funktionieren nicht

### Problem: "Last Week", "Settings" etc. tun nichts

**Das ist NORMAL!** Diese Features sind noch nicht implementiert:

- ✅ **Yesterday** - Funktioniert (zeigt aktuelle Daten)
- ⏳ **This Week / Last Week** - Coming Soon (zeigt aktuell Demo-Chart)
- ⏳ **Sensors Tab** - Coming Soon (Alert erscheint)
- ⏳ **Invoice Tab** - Coming Soon (Alert erscheint)
- ⏳ **Settings Tab** - Coming Soon (Alert erscheint)

**Chart Toggle (kW / kWh)** - Funktioniert (ändert Y-Achse Label)

---

## Debugging Checkliste

Gehe diese Liste durch:

```
□ 1. Browser Console geöffnet (F12)
□ 2. Logs zeigen "✅ Loaded sensor.xyz: 12.34"?
□ 3. Entity-IDs in config.js sind EXAKT wie in HA States?
□ 4. Sensoren in HA haben gültige Werte (nicht unknown/unavailable)?
□ 5. config.js gespeichert?
□ 6. Browser hard-refreshed (Strg + Shift + R)?
□ 7. Dashboard zeigt jetzt echte Werte?
```

---

## Typische Console Logs erklärt

### ✅ ERFOLG:
```javascript
🚀 Starting Leneda Dashboard...
🔋 Leneda Dashboard initializing...
✅ Config loaded: {entities: {consumption: "sensor.xyz", ...}}
📡 Loading data from Home Assistant...
✅ Loaded sensor.solar_house_consumption_daily: 12.34
✅ Loaded sensor.solar_panel_to_house_daily: 8.76
✅ Dashboard updated with real data
✅ Auto-refresh enabled (every 30s)
```
**→ Dashboard funktioniert perfekt!**

### ⚠️ TEILWEISE:
```javascript
✅ Loaded sensor.solar_house_consumption_daily: 12.34
⚠️ Could not load sensor.wrong_name: 404
📊 Using demo data
```
**→ Einige Sensoren falsch, prüfe Entity-IDs!**

### ❌ FEHLER:
```javascript
❌ Error loading from HA: TypeError: Failed to fetch
📊 Using demo data
```
**→ Keine Verbindung zu HA, prüfe URL/Auth**

---

## Noch Probleme?

### Schritt-für-Schritt Test:

1. **Öffne Console** (F12)
2. **Kopiere & Füge ein:**

```javascript
// Test: Sensor direkt abfragen
fetch('/api/states/sensor.solar_house_consumption_daily')
  .then(r => r.json())
  .then(d => console.log('✅ Sensor works:', d.state))
  .catch(e => console.error('❌ Sensor failed:', e));
```

3. **Enter drücken**
4. **Ergebnis:**

```
✅ Sensor works: 12.34
→ Sensor ist OK, Problem liegt woanders!

❌ Sensor failed: 404 Not Found
→ Sensor-Name ist FALSCH! Prüfe Entity-ID!

❌ Sensor failed: NetworkError
→ Dashboard kann nicht auf API zugreifen
```

---

## Kontakt

Wenn gar nichts hilft, teile:

1. **Console Logs** (F12 → Console → Screenshot)
2. **Entity-IDs** aus config.js (anonymisiert)
3. **Sensor Status** aus Developer Tools → States

Dann können wir das Problem genau lokalisieren! 🔍
