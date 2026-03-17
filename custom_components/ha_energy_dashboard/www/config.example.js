// Energy Dashboard - Konfiguration
// Kopiere diese Datei zu config.js und passe die Werte an.
// WICHTIG: config.js NIEMALS ins Git commiten (steht in .gitignore)

window.DASHBOARD_CONFIG = {
  // Optional: Long-Lived Access Token (HA Profil → Langlebige Zugriffstoken)
  // Nur nötig wenn localStorage-Auth nicht funktioniert
  accessToken: 'DEIN_LONG_LIVED_ACCESS_TOKEN',

  // Sensor Entity-IDs
  entities: {
    // Echtzeit-Leistung (W) — für Energy Flow Anzeige
    power: {
      consumption:      'sensor.solar_house_consumption_w',
      production:       'sensor.solar_panel_production_w',
      grid_import:      'sensor.solar_imported_power_w',
      grid_export:      'sensor.solar_exported_power_w',
      battery_charge:   'sensor.solar_battery_in_w',
      battery_discharge:'sensor.solar_battery_to_house_w',
    },

    // Energie-Aggregate (kWh) pro Zeitraum — für Statistik-Karten
    energy: {
      consumption: {
        daily:   'sensor.solar_house_consumption_daily',
        weekly:  'sensor.solar_house_consumption_weekly',
        monthly: 'sensor.solar_house_consumption_monthly',
        yearly:  'sensor.solar_house_consumption_yearly',
      },
      production: {
        daily:   'sensor.solar_panel_production_daily',
        weekly:  'sensor.solar_panel_production_weekly',
        monthly: 'sensor.solar_panel_production_monthly',
        yearly:  'sensor.solar_panel_production_yearly',
      },
      grid_import: {
        daily:   'sensor.solar_imported_power_daily',
        weekly:  'sensor.solar_imported_power_weekly',
        monthly: 'sensor.solar_imported_power_monthly',
        yearly:  'sensor.solar_imported_power_yearly',
      },
      grid_export: {
        daily:   'sensor.solar_exported_power_daily',
        weekly:  'sensor.solar_exported_power_weekly',
        monthly: 'sensor.solar_exported_power_monthly',
        yearly:  'sensor.solar_exported_power_yearly',
      },
      battery_charge: {
        daily:   'sensor.solar_battery_in_daily',
        weekly:  'sensor.solar_battery_in_weekly',
        monthly: 'sensor.solar_battery_in_monthly',
        yearly:  'sensor.solar_battery_in_yearly',
      },
      battery_discharge: {
        daily:   'sensor.solar_battery_out_daily',
        weekly:  'sensor.solar_battery_out_weekly',
        monthly: 'sensor.solar_battery_out_monthly',
        yearly:  'sensor.solar_battery_out_yearly',
      },
    },

    // Batterie-Status
    battery_soc: 'sensor.solaredge_b1_state_of_energy',

    // Kosten-Sensoren
    cost: {
      daily:   'sensor.solaredge_m1_imported_kwh_daily_energy_cost',
      weekly:  'sensor.solaredge_m1_imported_kwh_weekly_energy_cost',
      monthly: 'sensor.solaredge_m1_imported_kwh_monthly_energy_cost',
      yearly:  'sensor.solaredge_m1_imported_kwh_yearly_energy_cost',
      rate:    'sensor.solar_accounting_cost_rate',
      compensation: 'sensor.solar_accounting_compensation_rate',
    },

    // Kumulative kWh-Sensoren — für History-Berechnungen vergangener Zeiträume
    cumulative: {
      consumption: 'sensor.solar_house_consumption_kwh',
      production:  'sensor.solar_panel_production_kwh',
      grid_import: 'sensor.solar_imported_power_kwh',
      grid_export: 'sensor.solar_exported_power_kwh',
    },
  },

  // Fester Strompreis (€/kWh) — Fallback für Zeiträume ohne dynamischen Tarif
  fixedElectricityRate: 0.25,

  ui: {
    refreshInterval: 30000,
    animationSpeed: 1.5,
    chartHeight: 350,
    locale: 'de-DE',
  },
};
