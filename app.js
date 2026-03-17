// Energy Dashboard v2.1 — Home Assistant Integration
// Auth via localStorage tokens + WebSocket for history/statistics

class EnergyDashboard {
  constructor() {
    this.config = window.DASHBOARD_CONFIG || {};
    this.token = null;
    this.ws = null;
    this.wsId = 1;
    this.wsPending = {};
    this.chart = null;
    this.currentPeriod = 'today';
    this.currentTab = 'dashboard';
    this.currentChartUnit = 'kwh';
    this.chartConsumption = [];
    this.chartProduction = [];
    this.chartHeatpump = [];
    this.powerData = {};
    this.energyData = {};
    this._entityCache = null;
    this._entityCacheTime = 0;
    this._refreshTimers = [];
    this._lastVisible = Date.now();
    this._customRange = null;
    this.heatpumpData = {};
    this.init();
  }

  // ── Wärmepumpe Entitäten ────────────────────────────────────
  _wpEntities = {
    power:            'sensor.daikin_heizung_leistung',
    electricTotal:    'sensor.warmepumpe_elektrische_energie_gesamt',
    electricDaily:    'sensor.warmepumpe_elektrische_energie_taglich',
    electricMonthly:  'sensor.warmepumpe_elektrische_energie_monatlich',
    electricYearly:   'sensor.warmepumpe_elektrische_energie_jahrlich',
    heatingDaily:     'sensor.warmepumpe_elektrische_energie_heizen_taglich',
    heatingTotal:     'sensor.warmepumpe_elektrische_energie_heizen_gesamt',
    dhwDaily:         'sensor.warmepumpe_elektrische_energie_dhw_taglich',
    dhwTotal:         'sensor.warmepumpe_elektrische_energie_dhw_gesamt',
    thermalDaily:     'sensor.warmepumpe_thermische_energie_taglich',
    thermalTotal:     'sensor.warmepumpe_thermische_energie_gesamt',
    heaterDaily:      'sensor.warmepumpe_heizstab_verbrauch_taglich',
    heaterTotal:      'sensor.warmepumpe_heizstab_gesamtverbrauch',
  };

  // ── Auth ──────────────────────────────────────────────────────

  async init() {
    await this.authenticate();
    if (!this.token) {
      console.error('Dashboard: No valid authentication. Set accessToken in config.js');
      return;
    }
    this.setupEventListeners();
    await this.connectWebSocket();
    await this.loadSettings();
    this.populateSettingsForm();
    await this.loadCurrentPower();
    await this.switchPeriod('today');
    this.startAutoRefresh();
  }

  async authenticate() {
    this._clientId = location.origin + '/';

    // 1. Config token (Long-Lived Access Token) — most reliable for panel_iframe
    if (this.config.accessToken) {
      this.token = this.config.accessToken;
      return;
    }

    // 2. Try localStorage tokens from HA frontend (desktop browser)
    const sources = ['hassTokens', 'dashboardTokens'];
    for (const key of sources) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const t = JSON.parse(raw);
          if (t.access_token && typeof t.access_token === 'string') {
            this.token = t.access_token;
            this._refreshToken = t.refresh_token;
            if (t.clientId) this._clientId = t.clientId;
            break;
          }
        }
      } catch (e) { /* ignore */ }
    }

    // 3. Check for OAuth callback (?code=...)
    if (!this.token) {
      const params = new URLSearchParams(location.search);
      const authCode = params.get('code');
      if (authCode) {
        await this._exchangeCode(authCode);
        history.replaceState(null, '', location.pathname);
      }
    }

    // 4. Verify token works
    if (this.token) {
      const valid = await this._testAuth();
      if (valid) return;
      // Token expired — try refresh
      if (this._refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) return;
      }
      this.token = null;
    }

    // 5. No valid auth — try OAuth flow (works on desktop, may not work in companion app)
    this._startOAuthFlow();
  }

  async _testAuth() {
    if (!this.token) return false;
    try {
      const res = await fetch('/api/', {
        headers: { 'Authorization': `Bearer ${this.token}` },
      });
      return res.ok;
    } catch (e) { return false; }
  }

  _startOAuthFlow() {
    const redirectUri = location.origin + location.pathname;
    const url = `/auth/authorize?client_id=${encodeURIComponent(this._clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    location.href = url;
  }

  async _exchangeCode(code) {
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: this._clientId,
      });
      const res = await fetch('/auth/token', { method: 'POST', body });
      if (!res.ok) return;
      const data = await res.json();
      this.token = data.access_token;
      this._refreshToken = data.refresh_token;
      try {
        localStorage.setItem('dashboardTokens', JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        }));
      } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
  }

  async refreshAccessToken() {
    if (!this._refreshToken) return false;
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this._clientId,
        refresh_token: this._refreshToken,
      });
      const res = await fetch('/auth/token', { method: 'POST', body });
      if (!res.ok) return false;
      const data = await res.json();
      this.token = data.access_token;
      if (data.refresh_token) this._refreshToken = data.refresh_token;
      try {
        localStorage.setItem('dashboardTokens', JSON.stringify({
          access_token: data.access_token,
          refresh_token: this._refreshToken,
        }));
      } catch (e) { /* ignore */ }
      return true;
    } catch (e) { return false; }
  }

  // ── REST API ──────────────────────────────────────────────────

  async fetchAPI(path, options = {}) {
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    headers['Content-Type'] = 'application/json';

    const fetchOpts = { headers, ...options };
    let res = await fetch(path, fetchOpts);
    if (res.status === 401) {
      const ok = await this.refreshAccessToken();
      if (ok) {
        headers['Authorization'] = `Bearer ${this.token}`;
        res = await fetch(path, { ...fetchOpts, headers });
      }
      if (res.status === 401) {
        localStorage.removeItem('dashboardTokens');
        this._startOAuthFlow();
        throw new Error('Re-authenticating...');
      }
    }
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json();
  }

  async getStateRaw(entityId) {
    try {
      const data = await this.fetchAPI(`/api/states/${entityId}`);
      return data.state ?? '';
    } catch (e) {
      return '';
    }
  }

  async callService(domain, service, data) {
    return this.fetchAPI(`/api/services/${domain}/${service}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getState(entityId) {
    try {
      const data = await this.fetchAPI(`/api/states/${entityId}`);
      return parseFloat(data.state) || 0;
    } catch (e) {
      console.warn(`State fetch failed: ${entityId}`, e.message);
      return 0;
    }
  }

  async getStates(entityIds) {
    const results = {};
    const promises = entityIds.filter(Boolean).map(async id => {
      results[id] = await this.getState(id);
    });
    await Promise.all(promises);
    return results;
  }

  // ── WebSocket ─────────────────────────────────────────────────

  connectWebSocket() {
    return new Promise((resolve) => {
      // Close stale socket first
      if (this.ws) {
        try { this.ws.onclose = null; this.ws.close(); } catch (_) {}
        this.ws = null;
      }
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      let resolved = false;
      const done = () => { if (!resolved) { resolved = true; resolve(); } };

      try {
        this.ws = new WebSocket(`${proto}//${location.host}/api/websocket`);
      } catch (e) {
        console.warn('WS create failed:', e.message);
        done();
        return;
      }

      this.ws.onopen = () => {};
      this.ws.onerror = () => { done(); };
      this.ws.onclose = () => {
        done();
        // Only auto-reconnect if page is visible
        if (document.visibilityState === 'visible') {
          setTimeout(() => this.connectWebSocket(), 5000);
        }
      };
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'auth_required') {
          if (!this.token) { console.error('WS: no token'); this.ws.close(); done(); return; }
          this.ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
        } else if (msg.type === 'auth_ok') {
          done();
        } else if (msg.type === 'auth_invalid') {
          console.error('WebSocket auth failed');
          done();
        } else if (msg.type === 'result' && this.wsPending[msg.id]) {
          const { resolve: res } = this.wsPending[msg.id];
          delete this.wsPending[msg.id];
          res(msg.success ? msg.result : null);
        }
      };
      setTimeout(done, 5000);
    });
  }

  wsCommand(cmd) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      const id = this.wsId++;
      cmd.id = id;
      this.wsPending[id] = { resolve, reject };
      this.ws.send(JSON.stringify(cmd));
      setTimeout(() => {
        if (this.wsPending[id]) {
          delete this.wsPending[id];
          resolve(null);
        }
      }, 15000);
    });
  }

  // ── Statistics API ────────────────────────────────────────────

  async getStatistics(entityId, startTime, endTime, period = 'hour') {
    try {
      const result = await this.wsCommand({
        type: 'recorder/statistics_during_period',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        statistic_ids: [entityId],
        period: period,
        types: ['change', 'sum', 'mean', 'state'],
      });
      return (result && result[entityId]) ? result[entityId] : [];
    } catch (e) {
      console.warn('Statistics fetch failed:', e.message);
      return [];
    }
  }

  // ── Data Loading ──────────────────────────────────────────────

  async loadCurrentPower() {
    const p = this.config.entities?.power;
    if (!p) return;

    const ids = Object.values(p).filter(Boolean);
    const states = await this.getStates(ids);

    this.powerData = {
      consumption:       Math.abs(states[p.consumption] || 0),
      production:        Math.abs(states[p.production] || 0),
      grid_import:       Math.abs(states[p.grid_import] || 0),
      grid_export:       Math.abs(states[p.grid_export] || 0),
      battery_charge:    Math.abs(states[p.battery_charge] || 0),
      battery_discharge: Math.abs(states[p.battery_discharge] || 0),
    };

    if (this.config.entities?.battery_soc) {
      this.powerData.battery_soc = await this.getState(this.config.entities.battery_soc);
    }

    // Wärmepumpe Echtzeit-Leistung
    try {
      this.powerData.heatpump = Math.abs(await this.getState(this._wpEntities.power) || 0);
    } catch (e) { this.powerData.heatpump = 0; }

    this.updateEnergyFlow();
  }

  // Period suffix mapping (fixed!)
  periodToSuffix(period) {
    const map = {
      yesterday: 'daily', today: 'daily',
      this_week: 'weekly', this_month: 'monthly', this_year: 'yearly',
    };
    return map[period] || null;
  }

  async loadPeriodData(period) {
    const energy = this.config.entities?.energy;
    const cost = this.config.entities?.cost;
    if (!energy) return;

    const suffix = this.periodToSuffix(period);

    // "yesterday" and all "last_*" periods: always use history
    // "this_*" periods: use aggregate sensors
    if (suffix && period !== 'yesterday') {
      // Current periods — use aggregate sensors directly
      const ids = [];
      const mapping = {};

      for (const [key, sensors] of Object.entries(energy)) {
        const id = sensors[suffix];
        if (id) { ids.push(id); mapping[id] = key; }
      }
      if (cost?.[suffix]) { ids.push(cost[suffix]); mapping[cost[suffix]] = '__cost'; }
      if (cost?.rate) { ids.push(cost.rate); mapping[cost.rate] = '__rate'; }
      if (cost?.compensation) { ids.push(cost.compensation); mapping[cost.compensation] = '__compensation'; }

      const states = await this.getStates(ids);
      this.energyData = {};
      for (const [id, value] of Object.entries(states)) {
        if (mapping[id]) this.energyData[mapping[id]] = value;
      }
    } else {
      // Past periods or yesterday — use statistics API
      await this.loadPeriodFromHistory(period);
    }

    // Wärmepumpe Energiedaten laden
    await this.loadHeatpumpPeriodData(period);

    this.calculateDerivedMetrics();

    // Dynamic rate calculation (if rateEntity is configured)
    if (this.config.rateEntity) {
      const { start, end } = this.getTimeBounds(period);
      const [rateMap, consumption15] = await Promise.all([
        this.loadDynamicRateHistory(start, end),
        this.loadConsumption15min(start, end),
      ]);
      if (rateMap && consumption15) {
        this.energyData.__dynamicCosts = this.calculateDynamicCosts(consumption15, rateMap);
      } else {
        this.energyData.__dynamicCosts = null;
      }
    } else {
      this.energyData.__dynamicCosts = null;
    }

    this.updateStatCards();
    this.updateFlowStats();
    this.updateKeyMetrics();
    this.updateInvoiceTab();
    this.updateHeatpumpTab();
  }

  async loadPeriodFromHistory(period) {
    const { start, end } = this.getTimeBounds(period);
    const cum = this.config.entities?.cumulative;
    const energy = this.config.entities?.energy;
    const cost = this.config.entities?.cost;
    this.energyData = {};

    // Use cumulative sensors — sum up 'change' values per period
    const spanDays = (end - start) / 86400000;
    const statPeriod = spanDays > 180 ? 'month'
                     : spanDays > 7 ? 'day' : 'hour';
    if (cum) {
      const promises = Object.entries(cum).map(async ([key, entityId]) => {
        if (!entityId) return;
        const stats = await this.getStatistics(entityId, start, end, statPeriod);
        if (stats.length > 0) {
          const total = stats.reduce((acc, s) => acc + Math.max(0, s.change ?? 0), 0);
          if (total > 0) {
            this.energyData[key] = total;
          }
        }
      });
      await Promise.all(promises);
    }

    // Also try to get battery data from daily sensors history
    if (energy?.battery_charge?.daily) {
      const stats = await this.getStatistics(energy.battery_charge.daily, start, end, 'hour');
      if (stats.length > 0) {
        const maxVal = Math.max(...stats.map(s => s.state ?? s.mean ?? 0));
        if (maxVal > 0) this.energyData.battery_charge = maxVal;
      }
    }
    if (energy?.battery_discharge?.daily) {
      const stats = await this.getStatistics(energy.battery_discharge.daily, start, end, 'hour');
      if (stats.length > 0) {
        const maxVal = Math.max(...stats.map(s => s.state ?? s.mean ?? 0));
        if (maxVal > 0) this.energyData.battery_discharge = maxVal;
      }
    }

    // Cost
    if (cost?.rate) {
      const rate = await this.getState(cost.rate);
      const compensation = cost.compensation ? await this.getState(cost.compensation) : 0;
      this.energyData.__rate = rate;
      this.energyData.__compensation = compensation;
      this.energyData.__cost = (this.energyData.grid_import || 0) * rate;
    }
  }

  async loadHeatpumpPeriodData(period) {
    const wp = this._wpEntities;

    // "Heute" — Daily-Sensoren direkt lesen (genau + schnell)
    if (period === 'today') {
      const ids = [
        wp.electricDaily, wp.heatingDaily, wp.dhwDaily,
        wp.thermalDaily, wp.heaterDaily,
      ];
      const states = await this.getStates(ids);
      this.heatpumpData = {
        electric:  states[wp.electricDaily] || 0,
        heating:   states[wp.heatingDaily] || 0,
        dhw:       states[wp.dhwDaily] || 0,
        thermal:   states[wp.thermalDaily] || 0,
        heater:    states[wp.heaterDaily] || 0,
      };
    } else {
      // Past periods — use statistics with cumulative sensor
      const { start, end } = this.getTimeBounds(period);
      const spanDays = (end - start) / 86400000;
      const statPeriod = spanDays > 180 ? 'month' : spanDays > 7 ? 'day' : 'hour';

      const [elecStats, thermalStats, heaterStats, heatingStats, dhwStats] = await Promise.all([
        this.getStatistics(wp.electricTotal, start, end, statPeriod),
        this.getStatistics(wp.thermalTotal, start, end, statPeriod),
        this.getStatistics(wp.heaterTotal, start, end, statPeriod),
        this.getStatistics(wp.heatingTotal, start, end, statPeriod),
        this.getStatistics(wp.dhwTotal, start, end, statPeriod),
      ]);

      const sum = (stats) => stats.reduce((acc, s) => acc + Math.max(0, s.change ?? 0), 0);
      this.heatpumpData = {
        electric: sum(elecStats),
        thermal:  sum(thermalStats),
        heater:   sum(heaterStats),
        heating:  sum(heatingStats) / 1000,  // Sensor in Wh → kWh
        dhw:      sum(dhwStats) / 1000,      // Sensor in Wh → kWh
      };
    }

    // COP berechnen
    this.heatpumpData.cop = this.heatpumpData.electric > 0
      ? this.heatpumpData.thermal / this.heatpumpData.electric
      : 0;
  }

  calculateDerivedMetrics() {
    const d = this.energyData;
    const production = d.production || 0;
    const consumption = d.consumption || 0;
    const exported = d.grid_export || 0;
    const imported = d.grid_import || 0;

    d.self_consumed = Math.max(0, production - exported);
    d.self_sufficiency = consumption > 0
      ? Math.min(100, Math.max(0, ((consumption - imported) / consumption) * 100))
      : 0;

    if (!d.__cost && d.__rate) {
      d.__cost = imported * d.__rate;
    }
    d.savings = d.self_consumed * (d.__rate || 0);
  }

  // ── Chart (Chart.js + chartjs-plugin-zoom) ──────────────────

  // Reference line plugin
  referenceLinePlugin = {
    id: 'referenceLine',
    afterDraw: (chart, args, options) => {
      const val = options.value;
      if (!val || val <= 0) return;
      const yScale = chart.scales.y;
      if (!yScale) return;
      const yPixel = yScale.getPixelForValue(val);
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.setLineDash([8, 4]);
      ctx.strokeStyle = options.color ?? '#d29922';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, yPixel);
      ctx.lineTo(chartArea.right, yPixel);
      ctx.stroke();
      ctx.setLineDash([]);
      const label = options.label ?? `Reference ${val} kW`;
      ctx.fillStyle = options.color ?? '#d29922';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, chartArea.right - 4, yPixel - 4);
      ctx.restore();
    },
  };

  async loadChartData(period) {
    const { start, end } = this.getTimeBounds(period);
    const chartPeriod = this.getChartAggregation(period);
    const cum = this.config.entities?.cumulative;
    if (!cum) return;

    const [consumptionStats, productionStats, wpStats] = await Promise.all([
      cum.consumption ? this.getStatistics(cum.consumption, start, end, chartPeriod) : [],
      cum.production ? this.getStatistics(cum.production, start, end, chartPeriod) : [],
      this.getStatistics(this._wpEntities.electricTotal, start, end, chartPeriod),
    ]);

    this.chartConsumption = this.statsToChartData(consumptionStats);
    this.chartProduction = this.statsToChartData(productionStats);
    this.chartHeatpump = this.statsToChartData(wpStats);

    // Clear cached kW data (lazy-loaded on toggle)
    this.chartConsumptionKw = null;
    this.chartProductionKw = null;
    this.currentChartUnit = 'kwh';

    document.querySelectorAll('.toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.unit === 'kwh');
    });
    const resetBtn = document.getElementById('reset-zoom-btn');
    if (resetBtn) resetBtn.style.display = 'none';

    this.renderChart();
  }

  statsToChartData(stats) {
    return stats.map(s => ({
      x: new Date(s.start).getTime(),
      y: Math.max(0, s.change ?? s.mean ?? 0),
    }));
  }

  async getHistory(entityId, startTime, endTime) {
    try {
      const start = startTime.toISOString();
      const end = endTime.toISOString();
      const data = await this.fetchAPI(
        `/api/history/period/${start}?filter_entity_id=${entityId}&end_time=${end}&minimal_response&no_attributes`
      );
      return (data && data[0]) ? data[0] : [];
    } catch (e) {
      console.warn('History fetch failed:', entityId, e.message);
      return [];
    }
  }

  // ── Dynamic Rate Calculation ─────────────────────────────────

  // Stichtag: ab hier gilt dynamischer Tarif
  _dynamicRateStart = new Date('2026-02-15T00:00:00+01:00');

  async loadDynamicRateHistory(start, end) {
    const rateEntity = this.config.rateEntity;
    if (!rateEntity) return null;
    // Zeitraum komplett vor Stichtag → kein dynamischer Tarif
    if (end <= this._dynamicRateStart) return null;

    const fetchStart = start < this._dynamicRateStart ? this._dynamicRateStart : start;
    const history = await this.getHistory(rateEntity, fetchStart, end);
    if (!history.length) return null;

    // State-Änderungen in sortierte Liste umwandeln
    const changes = [];
    for (const s of history) {
      const ts = s.lu ? s.lu * 1000 : new Date(s.last_changed || s.last_updated).getTime();
      const val = parseFloat(s.s ?? s.state);
      changes.push({ ts, rate: isNaN(val) ? null : val });
    }
    changes.sort((a, b) => a.ts - b.ts);

    // Zukünftige Preise aus Entity-Attribut rates[] laden
    let futureRates = [];
    try {
      const entityData = await this.fetchAPI(`/api/states/${rateEntity}`);
      const rates = entityData?.attributes?.rates;
      if (Array.isArray(rates)) {
        futureRates = rates;
      }
    } catch (e) {
      console.warn('Failed to fetch future rates:', e.message);
    }

    // 15-Min-Raster aufbauen: für jedes 15-Min-Intervall den gültigen Preis
    const rateMap = new Map();
    const interval = 15 * 60 * 1000;
    const gridStart = Math.floor(fetchStart.getTime() / interval) * interval;

    // Grid bis Ende des Tages erweitern wenn Zukunfts-Preise verfügbar
    const endOfDay = new Date(start);
    endOfDay.setDate(endOfDay.getDate() + 1);
    endOfDay.setHours(0, 0, 0, 0);
    const gridEnd = futureRates.length > 0
      ? Math.max(Math.ceil(end.getTime() / interval) * interval, endOfDay.getTime())
      : Math.ceil(end.getTime() / interval) * interval;

    for (let t = gridStart; t < gridEnd; t += interval) {
      // Finde den letzten bekannten Preis vor/bei diesem Zeitpunkt
      let rate = null;
      for (let i = changes.length - 1; i >= 0; i--) {
        if (changes[i].ts <= t + interval) {
          rate = changes[i].rate;
          break;
        }
      }
      rateMap.set(t, rate);
    }

    // Zukünftige Preise aus rates[] ins Raster einfügen (überschreibt ggf.)
    for (const r of futureRates) {
      const ts = Math.floor(new Date(r.start).getTime() / interval) * interval;
      if (ts >= gridStart && ts < gridEnd) {
        rateMap.set(ts, r.value_inc_vat);
      }
    }

    return rateMap;
  }

  async loadConsumption15min(start, end) {
    const cum = this.config.entities?.cumulative;
    if (!cum?.grid_import) return null;

    const stats = await this.getStatistics(cum.grid_import, start, end, '5minute');
    if (!stats.length) return null;

    // 3 × 5-Min-Buckets zu 15-Min-Buckets summieren
    // Max 5 kWh pro 5-Min-Intervall als Ausreißer-Filter (≙ 60 kW Dauerlast)
    const MAX_PER_5MIN = 5;
    const interval = 15 * 60 * 1000;
    const buckets = new Map();
    for (const s of stats) {
      const change = Math.max(0, s.change ?? 0);
      if (change > MAX_PER_5MIN) continue;  // Sensor-Reset / Ausreißer
      const ts = new Date(s.start).getTime();
      const bucket = Math.floor(ts / interval) * interval;
      buckets.set(bucket, (buckets.get(bucket) || 0) + change);
    }
    return buckets;
  }

  calculateDynamicCosts(consumption15min, rateMap) {
    let totalCost = 0;
    let totalKwh = 0;
    let missingSlots = 0;
    const data = [];

    for (const [ts, kwh] of consumption15min) {
      const rate = rateMap.get(ts) ?? null;
      if (rate === null) {
        missingSlots++;
        data.push({ x: ts, consumption: kwh, rate: null, cost: null });
      } else {
        const cost = kwh * rate;
        totalCost += cost;
        totalKwh += kwh;
        data.push({ x: ts, consumption: kwh, rate, cost });
      }
    }

    // Auch Preis-Datenpunkte ohne Verbrauch für die Linie erfassen
    for (const [ts, rate] of rateMap) {
      if (!consumption15min.has(ts) && rate !== null) {
        data.push({ x: ts, consumption: 0, rate, cost: 0 });
      }
    }
    data.sort((a, b) => a.x - b.x);

    const avgRate = totalKwh > 0 ? totalCost / totalKwh : 0;
    return { totalCost, avgRate, totalKwh, missingSlots, data };
  }

  async loadPowerChartData() {
    const pwr = this.config.entities?.power;
    if (!pwr?.consumption || !pwr?.production) return;
    const { start, end } = this.getTimeBounds(this.currentPeriod);

    // Short periods: use History API (raw state data, fine-grained)
    // Long periods: use Statistics API (mean values, available long-term)
    const useHistory = ['today', 'yesterday', 'this_week', 'last_week'].includes(this.currentPeriod);

    if (useHistory) {
      const [consHistory, prodHistory] = await Promise.all([
        this.getHistory(pwr.consumption, start, end),
        this.getHistory(pwr.production, start, end),
      ]);
      this.chartConsumptionKw = this.historyToChartData(consHistory, this.currentPeriod);
      this.chartProductionKw = this.historyToChartData(prodHistory, this.currentPeriod);
    } else {
      // Power sensors are template sensors without state_class, so no mean statistics.
      // Workaround: use cumulative kWh sensors and derive average kW from change values.
      // change_kWh per hour = average kW, change_kWh per day = average kW / 24
      const cum = this.config.entities?.cumulative;
      if (!cum?.consumption || !cum?.production) return;
      const days = (end - start) / 86400000;
      const useDailyStats = days > 14;
      const statPeriod = useDailyStats ? 'day' : 'hour';
      const hoursPerBucket = useDailyStats ? 24 : 1;
      const [consStats, prodStats] = await Promise.all([
        this.getStatistics(cum.consumption, start, end, statPeriod),
        this.getStatistics(cum.production, start, end, statPeriod),
      ]);
      this.chartConsumptionKw = this.statsToKwChartData(consStats, hoursPerBucket);
      this.chartProductionKw = this.statsToKwChartData(prodStats, hoursPerBucket);
    }
  }

  statsToKwChartData(stats, hoursPerBucket) {
    return stats
      .map(s => {
        const changeKwh = Math.max(0, s.change ?? 0);
        if (changeKwh <= 0) return null;
        let hours = hoursPerBucket;
        if (hoursPerBucket === 'month') {
          // Calculate actual hours in this month
          const d = new Date(s.start);
          const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          hours = daysInMonth * 24;
        }
        return { x: new Date(s.start).getTime(), y: changeKwh / hours };
      })
      .filter(Boolean);
  }

  statsToDailyMaxKw(stats) {
    // Group hourly change values by day, take the maximum kW per day
    const days = new Map();
    for (const s of stats) {
      const changeKwh = Math.max(0, s.change ?? 0);
      if (changeKwh <= 0) continue;
      const kw = changeKwh; // 1 hour bucket: kWh/1h = kW
      const d = new Date(s.start);
      const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (!days.has(dayKey) || kw > days.get(dayKey)) {
        days.set(dayKey, kw);
      }
    }
    const result = [];
    for (const [t, maxKw] of days) {
      result.push({ x: t, y: maxKw });
    }
    result.sort((a, b) => a.x - b.x);
    return result;
  }

  historyToChartData(history, period) {
    const raw = history
      .map(s => {
        const val = parseFloat(s.s ?? s.state);
        if (isNaN(val)) return null;
        return {
          x: new Date(s.lu ? s.lu * 1000 : s.last_updated || s.last_changed).getTime(),
          y: Math.max(0, val / 1000),
        };
      })
      .filter(Boolean);
    if (raw.length === 0) return [];

    // Bucket size depends on period — larger periods need larger buckets
    const bucketMinutes = {
      today: 5, yesterday: 5,
      this_week: 30, last_week: 30,
      this_month: 60, last_month: 60,
      this_year: 360, last_year: 360,
    };
    const bucketMs = (bucketMinutes[period] || 5) * 60 * 1000;
    const buckets = new Map();

    for (const pt of raw) {
      const key = Math.floor(pt.x / bucketMs) * bucketMs;
      if (!buckets.has(key)) {
        buckets.set(key, { sum: 0, count: 0 });
      }
      const b = buckets.get(key);
      b.sum += pt.y;
      b.count++;
    }

    const result = [];
    for (const [t, b] of buckets) {
      result.push({ x: t, y: b.sum / b.count });
    }
    result.sort((a, b) => a.x - b.x);
    return result;
  }

  downsample(data, threshold) {
    if (data.length <= threshold) return data;
    const step = (data.length - 2) / (threshold - 2);
    const result = [data[0]];
    for (let i = 1; i < threshold - 1; i++) {
      const start = Math.floor((i - 1) * step) + 1;
      const end = Math.min(Math.floor(i * step) + 1, data.length);
      let maxY = -Infinity, maxIdx = start;
      for (let j = start; j < end; j++) {
        if (data[j].y > maxY) { maxY = data[j].y; maxIdx = j; }
      }
      result.push(data[maxIdx]);
    }
    result.push(data[data.length - 1]);
    return result;
  }

  getChartAggregation(period) {
    if (['yesterday', 'today'].includes(period)) return 'hour';
    if (period === 'custom' && this._customRange) {
      const days = (this._customRange.end - this._customRange.start) / 86400000;
      if (days <= 2) return 'hour';
      if (days > 365) return 'month';
    }
    return 'day';
  }

  renderChart() {
    const periodLabel = this.getPeriodLabel(this.currentPeriod);
    this.setEl('chart-period', periodLabel);

    const isKw = this.currentChartUnit === 'kw';
    const unitLabel = isKw ? 'kW' : 'kWh';
    const consumption = isKw ? (this.chartConsumptionKw || []) : this.chartConsumption;
    const production = isKw ? (this.chartProductionKw || []) : this.chartProduction;
    const heatpump = isKw ? [] : (this.chartHeatpump || []);
    const chartPeriod = this.getChartAggregation(this.currentPeriod);
    const timeUnitMap = { hour: 'hour', day: 'day', month: 'month' };
    const timeUnit = timeUnitMap[chartPeriod] || 'day';
    const refKw = this.config.refLimit ?? 5;
    const { start: periodStart, end: periodEnd } = this.getTimeBounds(this.currentPeriod);

    // Highlight bars exceeding reference in kW mode
    const consBg = isKw
      ? consumption.map(d => d.y > refKw ? 'rgba(248, 81, 73, 1)' : 'rgba(248, 81, 73, 0.7)')
      : 'rgba(248, 81, 73, 0.55)';
    const consBorder = isKw
      ? consumption.map(d => d.y > refKw ? '#ff3b30' : '#f85149')
      : '#f85149';

    const config = {
      type: 'bar',
      data: {
        datasets: [
          {
            label: `Verbrauch (${unitLabel})`,
            data: consumption,
            backgroundColor: consBg,
            borderColor: consBorder,
            borderWidth: 1,
            borderRadius: isKw ? 2 : 4,
            barPercentage: isKw ? 0.9 : 0.7,
            categoryPercentage: isKw ? 0.9 : 0.8,
            stack: 'main',
          },
          {
            label: `Erzeugung (${unitLabel})`,
            data: production,
            backgroundColor: isKw ? 'rgba(63, 185, 80, 0.7)' : 'rgba(63, 185, 80, 0.55)',
            borderColor: '#3fb950',
            borderWidth: 1,
            borderRadius: isKw ? 2 : 4,
            barPercentage: isKw ? 0.9 : 0.7,
            categoryPercentage: isKw ? 0.9 : 0.8,
            stack: 'production',
          },
          ...(!isKw && heatpump.length > 0 ? [{
            label: `Wärmepumpe (${unitLabel})`,
            data: heatpump,
            backgroundColor: 'rgba(249, 115, 22, 0.55)',
            borderColor: '#f97316',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
            stack: 'heatpump',
          }] : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#8b949e',
              usePointStyle: true,
              pointStyle: 'rectRounded',
              padding: 16,
              font: { size: 12 },
              generateLabels: (chart) => {
                const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                if (isKw) {
                  labels.push({
                    text: `Referenz-Limit (${refKw} kW)`,
                    fillStyle: 'transparent',
                    strokeStyle: '#d29922',
                    lineWidth: 2,
                    lineDash: [6, 3],
                    pointStyle: 'line',
                    hidden: false,
                  });
                }
                return labels;
              },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(13, 17, 23, 0.95)',
            titleColor: '#e6edf3',
            bodyColor: '#b1bac4',
            borderColor: '#30363d',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const v = (ctx.parsed.y ?? 0).toFixed(2);
                return `${ctx.dataset.label}: ${v} ${unitLabel}`;
              },
            },
          },
          referenceLine: isKw
            ? { value: refKw, color: '#d29922', label: `Referenz-Limit ${refKw} kW` }
            : { value: 0 },
          zoom: {
            limits: {
              x: { min: periodStart.getTime(), max: periodEnd.getTime(), minRange: 60 * 60 * 1000 },
            },
            pan: { enabled: true, mode: 'x' },
            zoom: {
              wheel: { enabled: true, speed: 0.08 },
              pinch: { enabled: true },
              drag: { enabled: false },
              mode: 'x',
              onZoomComplete: ({ chart }) => {
                const resetBtn = document.getElementById('reset-zoom-btn');
                if (resetBtn) resetBtn.style.display = '';
              },
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: timeUnit,
              tooltipFormat: 'dd.MM.yyyy HH:mm', displayFormats: { hour: 'HH:mm', day: 'dd MMM', month: 'MMM yyyy' },
            },
            min: periodStart.getTime(),
            max: periodEnd.getTime(),
            ticks: { color: '#8b949e', maxTicksLimit: 14, font: { size: 10 }, maxRotation: 45 },
            grid: { color: 'rgba(48, 54, 61, 0.3)' },
            offset: true,
            stacked: true,
          },
          y: {
            beginAtZero: true,
            stacked: true,
            suggestedMax: isKw ? refKw * 1.2 : undefined,
            ticks: {
              color: '#8b949e',
              font: { size: 10 },
              callback: (v) => `${v} ${unitLabel}`,
            },
            grid: { color: 'rgba(48, 54, 61, 0.3)' },
          },
        },
      },
      plugins: [this.referenceLinePlugin],
    };

    if (this.chart) {
      this.chart.destroy();
    }
    const canvas = document.getElementById('energy-chart');
    if (canvas) {
      this.chart = new Chart(canvas, config);
    }
  }

  // ── Time Bounds ───────────────────────────────────────────────

  getTimeBounds(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start, end;

    switch (period) {
      case 'yesterday':
        start = new Date(today); start.setDate(start.getDate() - 1);
        end = new Date(today);
        break;
      case 'today':
        start = new Date(today);
        end = now;
        break;
      case 'this_week': {
        start = new Date(today);
        const dow = start.getDay() || 7;
        start.setDate(start.getDate() - dow + 1);
        end = now;
        break;
      }
      case 'last_week': {
        start = new Date(today);
        const dow2 = start.getDay() || 7;
        start.setDate(start.getDate() - dow2 - 6);
        end = new Date(start); end.setDate(end.getDate() + 7);
        break;
      }
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      case 'last_year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        if (this._customRange) {
          start = this._customRange.start;
          end = this._customRange.end;
        } else {
          start = new Date(today); start.setDate(start.getDate() - 7);
          end = now;
        }
        break;
      default:
        start = new Date(today); start.setDate(start.getDate() - 1);
        end = new Date(today);
    }
    return { start, end };
  }

  // ── UI Updates ────────────────────────────────────────────────

  updateStatCards() {
    const d = this.energyData;
    const fields = [
      ['consumption-value', d.consumption],
      ['production-value', d.production],
      ['exported-value', d.grid_export],
      ['self-consumed-value', d.self_consumed],
      ['heatpump-value', this.heatpumpData.electric],
    ];
    for (const [id, val] of fields) {
      const { value, unit } = this.formatEnergy(val || 0);
      this.setEl(id, value);
      const el = document.getElementById(id);
      if (el?.nextElementSibling?.classList.contains('stat-unit')) {
        el.nextElementSibling.textContent = unit;
      }
    }
    // WP COP sub-line
    const cop = this.heatpumpData.cop || 0;
    this.setEl('heatpump-cop', cop > 0 ? `COP ${cop.toFixed(1)}` : '');
  }

  updateFlowStats() {
    const d = this.energyData;
    const flowFields = [
      ['market-in', d.grid_import],
      ['market-out', d.grid_export],
      ['battery-charged', d.battery_charge],
      ['battery-discharged', d.battery_discharge],
    ];
    for (const [id, val] of flowFields) {
      const { value, unit } = this.formatEnergy(val || 0);
      this.setEl(id, value);
      const el = document.getElementById(id);
      if (el?.nextElementSibling?.classList.contains('flow-stat-unit')) {
        el.nextElementSibling.textContent = unit;
      }
    }
  }

  updateKeyMetrics() {
    const d = this.energyData;
    this.setEl('self-sufficiency', (d.self_sufficiency || 0).toFixed(1));
    const sc = this.formatEnergy(d.self_consumed || 0);
    this.setEl('self-consumed-metric', sc.value + ' ' + sc.unit);

    this.setEl('battery-soc', (this.powerData.battery_soc || 0).toFixed(0));
    const socBar = document.getElementById('battery-soc-bar');
    if (socBar) socBar.style.width = Math.min(100, this.powerData.battery_soc || 0) + '%';

    const ssBar = document.getElementById('self-sufficiency-bar');
    if (ssBar) ssBar.style.width = Math.min(100, d.self_sufficiency || 0) + '%';

    // Cost: use dynamic costs if available, otherwise fixed rate
    const monthlyFee = this.config.baseFee || 0;
    const { start: ps, end: pe } = this.getTimeBounds(this.currentPeriod);
    const days = Math.max(1, (pe - ps) / 86400000);
    const proratedFee = monthlyFee * (days / 30);
    let totalCost;
    if (d.__dynamicCosts) {
      totalCost = d.__dynamicCosts.totalCost + proratedFee;
    } else {
      const rate = this.config.electricityRate || d.__rate || 0;
      totalCost = (d.grid_import || 0) * rate + proratedFee;
    }
    this.setEl('energy-cost', totalCost.toFixed(2));
    this.setEl('energy-savings', (d.savings || 0).toFixed(2));
  }

  updateHeatpumpTab() {
    const hp = this.heatpumpData;
    this.setEl('wp-period-label', this.getPeriodLabel(this.currentPeriod));

    const fmt = (v) => { const f = this.formatEnergy(v || 0); return f.value; };
    this.setEl('wp-electric', fmt(hp.electric));
    this.setEl('wp-thermal', fmt(hp.thermal));
    this.setEl('wp-cop', hp.cop > 0 ? hp.cop.toFixed(1) : '—');
    this.setEl('wp-heater', fmt(hp.heater));

    // Breakdown bars
    const total = (hp.heating || 0) + (hp.dhw || 0);
    const heatingPct = total > 0 ? ((hp.heating || 0) / total * 100) : 0;
    const dhwPct = total > 0 ? ((hp.dhw || 0) / total * 100) : 0;
    const barH = document.getElementById('wp-bar-heating');
    const barD = document.getElementById('wp-bar-dhw');
    if (barH) barH.style.width = heatingPct + '%';
    if (barD) barD.style.width = dhwPct + '%';

    const fmtKwh = (v) => { const f = this.formatEnergy(v || 0); return f.value + ' ' + f.unit; };
    this.setEl('wp-heating-value', total > 0 ? `${fmtKwh(hp.heating)} (${heatingPct.toFixed(0)}%)` : '—');
    this.setEl('wp-dhw-value', total > 0 ? `${fmtKwh(hp.dhw)} (${dhwPct.toFixed(0)}%)` : '—');

    this.renderHeatpumpChart();
  }

  async renderHeatpumpChart() {
    const { start, end } = this.getTimeBounds(this.currentPeriod);
    const chartPeriod = this.getChartAggregation(this.currentPeriod);
    const wp = this._wpEntities;

    const [heatingStats, dhwStats] = await Promise.all([
      this.getStatistics(wp.heatingTotal, start, end, chartPeriod),
      this.getStatistics(wp.dhwTotal, start, end, chartPeriod),
    ]);
    const heatingData = this.statsToChartData(heatingStats).map(d => ({ ...d, y: d.y / 1000 }));  // Wh → kWh
    const dhwData = this.statsToChartData(dhwStats).map(d => ({ ...d, y: d.y / 1000 }));           // Wh → kWh

    const timeUnitMap = { hour: 'hour', day: 'day', month: 'month' };
    const timeUnit = timeUnitMap[chartPeriod] || 'day';

    if (this._wpChart) this._wpChart.destroy();
    const canvas = document.getElementById('wp-chart');
    if (!canvas) return;

    this._wpChart = new Chart(canvas, {
      type: 'bar',
      data: {
        datasets: [
          {
            label: 'Heizen (kWh)',
            data: heatingData,
            backgroundColor: 'rgba(249, 115, 22, 0.65)',
            borderColor: '#f97316',
            borderWidth: 1,
            borderRadius: 0,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
            stack: 'wp',
          },
          {
            label: 'Warmwasser (kWh)',
            data: dhwData,
            backgroundColor: 'rgba(59, 130, 246, 0.65)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
            stack: 'wp',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#8b949e', usePointStyle: true, pointStyle: 'rectRounded', padding: 16, font: { size: 12 } } },
          tooltip: {
            backgroundColor: 'rgba(13, 17, 23, 0.95)',
            titleColor: '#e6edf3', bodyColor: '#b1bac4',
            borderColor: '#30363d', borderWidth: 1, padding: 12, cornerRadius: 8,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(2)} kWh`,
              footer: (items) => {
                const sum = items.reduce((s, i) => s + (i.parsed.y ?? 0), 0);
                return `Gesamt: ${sum.toFixed(2)} kWh`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: timeUnit, tooltipFormat: 'dd.MM.yyyy HH:mm', displayFormats: { hour: 'HH:mm', day: 'dd MMM', month: 'MMM yyyy' } },
            min: start.getTime(), max: end.getTime(),
            ticks: { color: '#8b949e', maxTicksLimit: 14, font: { size: 10 }, maxRotation: 45 },
            grid: { color: 'rgba(48, 54, 61, 0.3)' },
            offset: true,
            stacked: true,
          },
          y: {
            beginAtZero: true,
            stacked: true,
            ticks: { color: '#8b949e', font: { size: 10 }, callback: (v) => `${v} kWh` },
            grid: { color: 'rgba(48, 54, 61, 0.3)' },
          },
        },
      },
    });
  }

  updateInvoiceTab() {
    const d = this.energyData;
    const dc = d.__dynamicCosts;
    const currentRate = this.config.electricityRate || d.__rate || 0;
    const fixedRate = this.config.fixedElectricityRate || currentRate;
    const rate = dc ? dc.avgRate : currentRate;
    const compensation = this.config.feedInRate || d.__compensation || 0;
    const imported = d.grid_import || 0;
    const exported = d.grid_export || 0;
    const consumption = d.consumption || 0;
    const selfConsumed = d.self_consumed || 0;

    // Netzbezug-Kosten: dynamische Kosten + Fixpreis-Fallback für Slots ohne Preis
    let importCost;
    let effectiveRate;
    if (dc) {
      const missingKwh = Math.max(0, imported - dc.totalKwh);
      importCost = dc.totalCost + missingKwh * fixedRate;
      effectiveRate = imported > 0 ? importCost / imported : dc.avgRate;
    } else {
      importCost = imported * fixedRate;
      effectiveRate = fixedRate;
    }
    const feedInRevenue = exported * compensation;
    const selfSavings = selfConsumed * effectiveRate;

    // Grundgebühr proration based on period length
    const monthlyBaseFee = this.config.baseFee || 0;
    const { start, end } = this.getTimeBounds(this.currentPeriod);
    const periodDays = Math.max(1, (end - start) / 86400000);
    const proratedBaseFee = monthlyBaseFee * (periodDays / 30);

    const toPay = importCost + proratedBaseFee - feedInRevenue;
    const solarTotal = selfSavings + feedInRevenue;

    const eur = (v) => v.toFixed(2) + ' €';
    const kwh = (v) => this.formatEnergy(v).value + ' ' + this.formatEnergy(v).unit;

    // Period label
    this.setEl('invoice-period-label', this.getPeriodLabel(this.currentPeriod));

    // Metric badges
    const fmtBadge = (v) => { const f = this.formatEnergy(v); return f.value + ' ' + f.unit; };
    this.setEl('inv-badge-consumption', fmtBadge(consumption));
    this.setEl('inv-badge-production', fmtBadge(d.production || 0));
    this.setEl('inv-badge-exported', fmtBadge(exported));
    this.setEl('inv-badge-imported', fmtBadge(imported));

    // Summary cards
    this.setEl('inv-total-cost', eur(importCost + proratedBaseFee));
    this.setEl('inv-total-revenue', eur(feedInRevenue));
    this.setEl('inv-total-savings', eur(selfSavings));
    this.setEl('inv-net-balance', eur(toPay));

    // Color net balance
    const netEl = document.getElementById('inv-net-balance');
    if (netEl) {
      netEl.style.color = toPay <= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }

    // Detail table
    this.setEl('inv-consumption-kwh', kwh(consumption));
    this.setEl('inv-import-kwh', kwh(imported));
    if (dc) {
      this.setEl('inv-import-rate', 'Ø ' + (effectiveRate * 100).toFixed(2) + ' ct/kWh');
    } else {
      this.setEl('inv-import-rate', (fixedRate * 100).toFixed(2) + ' ct/kWh');
    }
    this.setEl('inv-import-cost', eur(importCost));

    // Dynamic rate warning
    const warnEl = document.getElementById('inv-dynamic-warn');
    if (warnEl) {
      if (dc && dc.missingSlots > 0) {
        const missingKwh = Math.max(0, imported - dc.totalKwh);
        warnEl.textContent = dc.missingSlots + ' Intervalle ohne dyn. Preis (' + missingKwh.toFixed(1) + ' kWh mit Fixpreis ' + (fixedRate * 100).toFixed(2) + ' ct/kWh berechnet)';
        warnEl.style.display = '';
      } else {
        warnEl.style.display = 'none';
      }
    }

    // Grundgebühr row
    this.setEl('inv-base-fee-monthly', monthlyBaseFee.toFixed(2) + ' €/Monat');
    this.setEl('inv-base-fee-days', periodDays.toFixed(0) + ' Tage');
    this.setEl('inv-base-fee-cost', eur(proratedBaseFee));
    const baseFeeRow = document.getElementById('inv-base-fee-row');
    if (baseFeeRow) baseFeeRow.style.display = monthlyBaseFee > 0 ? '' : 'none';

    this.setEl('inv-export-kwh', kwh(exported));
    this.setEl('inv-export-rate', compensation.toFixed(4) + ' €/kWh');
    this.setEl('inv-export-revenue', '−' + eur(feedInRevenue));

    this.setEl('inv-self-kwh', kwh(selfConsumed));
    this.setEl('inv-self-rate', 'Ø ' + (effectiveRate * 100).toFixed(2) + ' ct/kWh');
    this.setEl('inv-self-savings', '−' + eur(selfSavings));

    this.setEl('inv-net-total', eur(toPay));
    const netTotalEl = document.getElementById('inv-net-total');
    if (netTotalEl) {
      netTotalEl.style.color = toPay <= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }

    // Wärmepumpe info rows
    const hp = this.heatpumpData || {};
    const wpElectric = hp.electric || 0;
    const wpHeating = hp.heating || 0;
    const wpDhw = hp.dhw || 0;
    const wpHeater = hp.heater || 0;
    const wpVisible = wpElectric > 0;
    const wpSection = document.getElementById('inv-wp-section');
    const wpRow = document.getElementById('inv-wp-row');
    if (wpSection) wpSection.style.display = wpVisible ? '' : 'none';
    if (wpRow) wpRow.style.display = wpVisible ? '' : 'none';
    if (wpVisible) {
      this.setEl('inv-wp-kwh', kwh(wpElectric));
      this.setEl('inv-wp-rate', 'Ø ' + (effectiveRate * 100).toFixed(2) + ' ct/kWh');
      this.setEl('inv-wp-cost', eur(wpElectric * effectiveRate));
      this.setEl('inv-wp-heating-kwh', kwh(wpHeating));
      this.setEl('inv-wp-heating-cost', eur(wpHeating * effectiveRate));
      this.setEl('inv-wp-dhw-kwh', kwh(wpDhw));
      this.setEl('inv-wp-dhw-cost', eur(wpDhw * effectiveRate));
      this.setEl('inv-wp-heater-kwh', kwh(wpHeater));
      this.setEl('inv-wp-heater-cost', eur(wpHeater * effectiveRate));
    }

    // Solar value card
    this.setEl('inv-solar-savings', eur(selfSavings));
    this.setEl('inv-solar-feed-in', eur(feedInRevenue));
    this.setEl('inv-solar-total', eur(solarTotal));

    // Rate chart
    this.renderRateChart(dc);
  }

  // Color function for rate: green (cheap) → yellow → red (expensive)
  _rateToColor(rate, minRate, maxRate, alpha = 1) {
    const range = maxRate - minRate || 0.01;
    const t = Math.max(0, Math.min(1, (rate - minRate) / range));
    let r, g, b;
    if (t <= 0.5) {
      const t2 = t * 2;
      r = Math.round(16 + t2 * (251 - 16));
      g = Math.round(185 + t2 * (191 - 185));
      b = Math.round(129 - t2 * 129);
    } else {
      const t2 = (t - 0.5) * 2;
      r = Math.round(251 - t2 * (251 - 239));
      g = Math.round(191 - t2 * (191 - 68));
      b = Math.round(0 + t2 * 68);
    }
    return alpha === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
  }

  renderRateChart(dc) {
    const canvas = document.getElementById('rate-chart');
    const section = document.querySelector('.invoice-chart-section');
    if (!canvas || !section) return;

    if (this._rateChart) { this._rateChart.destroy(); this._rateChart = null; }

    if (!dc || !dc.data || dc.data.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';

    const consumptionData = dc.data.map(d => ({ x: d.x, y: d.consumption }));
    const validRates = dc.data.filter(d => d.rate !== null).map(d => d.rate);
    const minRate = Math.min(...validRates);
    const maxRate = Math.max(...validRates);

    const rateData = dc.data
      .filter(d => d.rate !== null)
      .map(d => ({ x: d.x, y: d.rate * 100 }));

    // Per-point colors for rate line segments
    const ratePointColors = dc.data
      .filter(d => d.rate !== null)
      .map(d => this._rateToColor(d.rate, minRate, maxRate));
    const rateFillColors = dc.data
      .filter(d => d.rate !== null)
      .map(d => this._rateToColor(d.rate, minRate, maxRate, 0.15));

    const { start, end } = this.getTimeBounds(this.currentPeriod);
    const startMs = start.getTime();
    // Extend x-axis to end of day if future rate data exists
    const lastRateTs = rateData.length > 0 ? rateData[rateData.length - 1].x : 0;
    const endOfDay = new Date(start);
    endOfDay.setDate(endOfDay.getDate() + 1);
    endOfDay.setHours(0, 0, 0, 0);
    const endMs = lastRateTs > end.getTime() ? endOfDay.getTime() : end.getTime();

    const nowMs = Date.now();
    const nowLinePlugin = {
      id: 'nowLine',
      afterDraw(chart) {
        if (nowMs < startMs || nowMs > endMs) return;
        const xScale = chart.scales.x;
        const x = xScale.getPixelForValue(nowMs);
        const { top, bottom } = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        // Label
        ctx.setLineDash([]);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('Jetzt', x, top - 4);
        ctx.restore();
      },
    };

    this._rateChart = new Chart(canvas, {
      type: 'bar',
      data: {
        datasets: [
          {
            label: 'Verbrauch (kWh)',
            data: consumptionData,
            backgroundColor: 'rgba(248, 81, 73, 0.7)',
            borderColor: '#f85149',
            borderWidth: 1,
            borderRadius: 2,
            barPercentage: 0.85,
            categoryPercentage: 0.9,
            yAxisID: 'y',
            order: 2,
          },
          {
            label: 'Strompreis (ct/kWh)',
            data: rateData,
            type: 'line',
            segment: {
              borderColor: (ctx) => {
                const i = ctx.p1DataIndex;
                return ratePointColors[i] || '#fbbf24';
              },
              backgroundColor: (ctx) => {
                const i = ctx.p1DataIndex;
                return rateFillColors[i] || 'rgba(251,191,36,0.15)';
              },
            },
            borderColor: ratePointColors,
            pointBackgroundColor: ratePointColors,
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 8,
            fill: true,
            tension: 0.3,
            spanGaps: false,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: '#8b92a7', font: { size: 11 }, boxWidth: 12, padding: 15 },
          },
          tooltip: {
            backgroundColor: '#1a1f2e',
            titleColor: '#fff',
            bodyColor: '#8b92a7',
            borderColor: '#2a3342',
            borderWidth: 1,
            callbacks: {
              title: (items) => {
                if (!items.length) return '';
                const d = new Date(items[0].parsed.x);
                return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
              },
              label: (item) => {
                if (item.dataset.yAxisID === 'y1') return ' Preis: ' + item.parsed.y.toFixed(2) + ' ct/kWh';
                return ' Verbrauch: ' + item.parsed.y.toFixed(4) + ' kWh';
              },
            },
          },
          zoom: {
            limits: {
              x: { min: startMs, max: endMs },
            },
            pan: { enabled: true, mode: 'x' },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'x',
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'hour', tooltipFormat: 'dd.MM.yyyy HH:mm', displayFormats: { hour: 'HH:mm', day: 'dd MMM' } },
            min: startMs,
            max: endMs,
            grid: { color: 'rgba(42,51,66,0.5)' },
            ticks: { color: '#8b92a7', font: { size: 10 }, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            position: 'left',
            title: { display: true, text: 'kWh', color: '#8b92a7', font: { size: 11 } },
            grid: { color: 'rgba(42,51,66,0.3)' },
            ticks: { color: '#f85149', font: { size: 10 } },
          },
          y1: {
            beginAtZero: false,
            position: 'right',
            title: { display: true, text: 'ct/kWh', color: '#8b92a7', font: { size: 11 } },
            grid: { drawOnChartArea: false },
            ticks: { color: '#8b92a7', font: { size: 10 } },
          },
        },
      },
      plugins: [nowLinePlugin],
    });
  }

  renderHourlyGrid() {
    const grid = document.getElementById('inv-hourly-grid');
    const dc = this.energyData.__dynamicCosts;
    if (!grid || !dc || !dc.data.length) {
      if (grid) grid.innerHTML = '<div style="color:var(--text-secondary);font-size:0.8rem;padding:0.5rem">Keine dynamischen Preisdaten verfügbar</div>';
      return;
    }

    // Aggregate 15-min data to hourly
    const hourly = new Map();
    for (const d of dc.data) {
      const h = Math.floor(d.x / 3600000) * 3600000;
      if (!hourly.has(h)) hourly.set(h, { kwh: 0, cost: 0, rates: [], hasMissing: false });
      const entry = hourly.get(h);
      entry.kwh += d.consumption;
      if (d.rate !== null) {
        entry.cost += d.cost;
        entry.rates.push(d.rate);
      } else {
        entry.hasMissing = true;
      }
    }

    // Find min/max rate for color scale
    const allRates = [];
    for (const [, v] of hourly) {
      if (v.rates.length) allRates.push(...v.rates);
    }
    const minRate = Math.min(...allRates);
    const maxRate = Math.max(...allRates);
    const rateRange = maxRate - minRate || 0.01;

    const rateColor = (rate) => this._rateToColor(rate, minRate, maxRate);

    const sorted = [...hourly.entries()].sort((a, b) => a[0] - b[0]);
    let html = '';
    for (const [ts, v] of sorted) {
      const d = new Date(ts);
      const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const avgRate = v.rates.length ? v.rates.reduce((a, b) => a + b, 0) / v.rates.length : null;
      const bg = avgRate !== null
        ? rateColor(avgRate).replace('rgb', 'rgba').replace(')', ',0.15)')
        : 'rgba(100,100,100,0.1)';
      const priceColor = avgRate !== null ? rateColor(avgRate) : 'var(--text-secondary)';
      const priceText = avgRate !== null ? (avgRate * 100).toFixed(1) + ' ct' : '—';
      const kwhText = v.kwh >= 1 ? v.kwh.toFixed(2) + ' kWh' : (v.kwh * 1000).toFixed(0) + ' Wh';

      html += `<div class="inv-hourly-cell" style="background:${bg}">
        <div class="inv-h-time">${time}</div>
        <div class="inv-h-kwh">${kwhText}</div>
        <div class="inv-h-price" style="color:${priceColor}">${priceText}</div>
      </div>`;
    }
    grid.innerHTML = html;
  }

  updateEnergyFlow() {
    const p = this.powerData;
    const fmt = (v) => v >= 1000 ? (v / 1000).toFixed(1) + ' kW' : Math.round(v) + ' W';

    this.setEl('flow-solar-value', fmt(p.production || 0));
    this.setEl('flow-house-value', fmt(p.consumption || 0));
    this.setEl('flow-grid-value', fmt(
      (p.grid_import || 0) > (p.grid_export || 0) ? p.grid_import : p.grid_export
    ));
    this.setEl('flow-battery-value', fmt(
      (p.battery_charge || 0) > (p.battery_discharge || 0) ? p.battery_charge : p.battery_discharge
    ));
    this.setEl('flow-battery-soc', (p.battery_soc || 0).toFixed(0) + '%');

    const gridLabel = document.getElementById('flow-grid-label');
    if (gridLabel) gridLabel.textContent = (p.grid_export || 0) > 10 ? 'EXPORT' : 'IMPORT';

    const batLabel = document.getElementById('flow-battery-label');
    if (batLabel) batLabel.textContent = (p.battery_charge || 0) > 10 ? 'LADEN' : 'ENTLADEN';

    // Wärmepumpe
    this.setEl('flow-wp-value', fmt(p.heatpump || 0));

    this.updateFlowAnimations();
  }

  updateFlowAnimations() {
    const p = this.powerData;
    this.toggleFlow('flow-solar-house', p.production > 10);
    this.toggleFlow('flow-grid-house', p.grid_import > 10);
    this.toggleFlow('flow-house-grid', p.grid_export > 10);
    this.toggleFlow('flow-solar-battery', p.battery_charge > 10 && p.production > 10);
    this.toggleFlow('flow-battery-house', p.battery_discharge > 10);
    this.toggleFlow('flow-house-wp', p.heatpump > 10);
  }

  toggleFlow(id, active) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('flow-active', active);
      el.classList.toggle('flow-inactive', !active);
    }
  }

  // ── Event Listeners ───────────────────────────────────────────

  setupEventListeners() {
    // Expandable invoice rows
    document.getElementById('inv-import-row')?.addEventListener('click', () => {
      const row = document.getElementById('inv-import-row');
      const detail = document.getElementById('inv-import-detail');
      if (!row || !detail) return;
      const open = row.classList.toggle('open');
      detail.style.display = open ? '' : 'none';
      if (open) this.renderHourlyGrid();
    });

    document.getElementById('inv-wp-row')?.addEventListener('click', () => {
      const row = document.getElementById('inv-wp-row');
      const detail = document.getElementById('inv-wp-detail');
      if (!row || !detail) return;
      const open = row.classList.toggle('open');
      detail.style.display = open ? '' : 'none';
    });

    const popup = document.getElementById('custom-range-popup');
    const allCustomBtns = document.querySelectorAll('[data-period="custom"]');

    document.querySelectorAll('.time-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const period = e.target.dataset.period;
        if (period === 'custom') {
          // Toggle popup, position below clicked button
          popup.classList.toggle('open');
          if (popup.classList.contains('open')) {
            const rect = e.target.getBoundingClientRect();
            popup.style.top = (rect.bottom + window.scrollY + 4) + 'px';
            popup.style.left = Math.max(8, rect.right - popup.offsetWidth) + 'px';
            const today = new Date().toISOString().slice(0, 10);
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
            const startInput = document.getElementById('custom-range-start');
            const endInput = document.getElementById('custom-range-end');
            if (!startInput.value) startInput.value = weekAgo;
            if (!endInput.value) endInput.value = today;
          }
          return;
        }
        popup.classList.remove('open');
        // Sync active state across all time-btn sets
        document.querySelectorAll('.time-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.period === period);
        });
        // Reset custom button text
        allCustomBtns.forEach(b => b.textContent = 'Custom');
        this.switchPeriod(period);
      });
    });

    // Custom range apply
    document.getElementById('custom-range-apply')?.addEventListener('click', () => {
      const startVal = document.getElementById('custom-range-start').value;
      const endVal = document.getElementById('custom-range-end').value;
      if (!startVal || !endVal) return;
      const start = new Date(startVal + 'T00:00:00');
      const end = new Date(endVal + 'T23:59:59');
      if (start >= end) return;
      this._customRange = { start, end };
      popup.classList.remove('open');
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      // Show date range on all custom buttons
      const fmt = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      const label = `${fmt(start)} – ${fmt(end)}`;
      allCustomBtns.forEach(b => { b.classList.add('active'); b.textContent = label; });
      this.switchPeriod('custom');
    });

    // Close popup on outside click
    document.addEventListener('click', (e) => {
      const isCustomBtn = e.target.dataset?.period === 'custom';
      if (!popup.contains(e.target) && !isCustomBtn) {
        popup.classList.remove('open');
      }
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.currentTab = tab;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(tc => {
          tc.style.display = tc.dataset.tab === tab ? '' : 'none';
        });
        // Pause flow animations when not on dashboard (saves energy on Safari/iOS)
        const flowDiagram = document.querySelector('.flow-diagram');
        if (flowDiagram) {
          flowDiagram.classList.toggle('flow-paused', tab !== 'dashboard');
        }
      });
    });

    // kWh / kW toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentChartUnit = e.target.dataset.unit;
        if (this.currentChartUnit === 'kw' && !this.chartConsumptionKw) {
          this.setEl('chart-period', 'Lade Leistungsdaten…');
          await this.loadPowerChartData();
        }
        this.renderChart();
      });
    });

    // Settings tab
    this.initSettingsTab();

    // Reset Zoom button
    const resetBtn = document.getElementById('reset-zoom-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (this.chart) this.chart.resetZoom();
        resetBtn.style.display = 'none';
      });
    }
  }

  async switchPeriod(period) {
    this.currentPeriod = period;
    document.querySelectorAll('.stat-value span[id]').forEach(el => el.classList.add('loading-pulse'));

    await Promise.all([
      this.loadPeriodData(period),
      this.loadChartData(period),
    ]);

    document.querySelectorAll('.loading-pulse').forEach(el => el.classList.remove('loading-pulse'));
  }

  // ── Auto Refresh ──────────────────────────────────────────────

  startAutoRefresh() {
    // Clear any existing timers (prevent stacking)
    this._refreshTimers.forEach(id => clearInterval(id));
    this._refreshTimers = [];

    const interval = this.config.ui?.refreshInterval || 30000;
    this._refreshTimers.push(
      setInterval(() => {
        if (document.visibilityState === 'visible') this.loadCurrentPower();
      }, interval),
      setInterval(() => {
        if (document.visibilityState === 'visible') this.loadPeriodData(this.currentPeriod);
      }, 300000),
    );

    // Safari freezes/kills backgrounded pages (especially iframes).
    // visibilitychange may not fire inside iframes.
    // Heartbeat: runs every 10s. If >120s elapsed since last tick, page was frozen → reload.
    this._heartbeat = Date.now();
    this._refreshTimers.push(
      setInterval(() => {
        const now = Date.now();
        const gap = now - this._heartbeat;
        this._heartbeat = now;
        if (gap > 120000) {
          console.log('Page was frozen for ' + Math.round(gap / 1000) + 's, reloading...');
          location.reload();
        }
      }, 10000)
    );

    // Also try visibilitychange + pageshow as backup
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        document.body.classList.add('page-hidden');
      } else {
        document.body.classList.remove('page-hidden');
      }
    });
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) location.reload();
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  formatNumber(v) {
    if (v == null || isNaN(v)) return '0.00';
    return v.toFixed(v >= 100 ? 1 : 2);
  }

  // Format energy value with automatic kWh/MWh unit
  formatEnergy(v) {
    if (v == null || isNaN(v) || v === 0) return { value: '0.00', unit: 'kWh' };
    if (Math.abs(v) >= 1000) {
      const mwh = v / 1000;
      return { value: mwh.toFixed(2), unit: 'MWh' };
    }
    return { value: v.toFixed(v >= 100 ? 1 : 2), unit: 'kWh' };
  }

  // ── Settings ──────────────────────────────────────────────────

  // Helper entity IDs
  _settingsHelpers = {
    powerSensors: 'input_text.energyboard_power_sensors',
    otherSensors: 'input_text.energyboard_other_sensors',
    refLimit: 'input_number.energyboard_reference_limit',
    electricityRate: 'input_number.energyboard_electricity_rate',
    feedInRate: 'input_number.energyboard_feed_in_rate',
    baseFee: 'input_number.energyboard_base_fee',
    rateEntity: 'input_text.energyboard_rate_entity',
  };

  // Field mapping: form ID → config path
  _powerFields = [
    ['set-power-consumption', 'consumption'],
    ['set-power-production', 'production'],
    ['set-power-grid-import', 'grid_import'],
    ['set-power-grid-export', 'grid_export'],
    ['set-power-battery-charge', 'battery_charge'],
    ['set-power-battery-discharge', 'battery_discharge'],
  ];
  _otherFields = [
    ['set-cum-consumption', 'cum_consumption'],
    ['set-cum-production', 'cum_production'],
    ['set-cum-grid-import', 'cum_grid_import'],
    ['set-cum-grid-export', 'cum_grid_export'],
    ['set-battery-soc', 'battery_soc'],
  ];

  async loadSettings() {
    try {
      const [powerJson, otherJson, refLimit, elRate, fiRate] = await Promise.all([
        this.getStateRaw(this._settingsHelpers.powerSensors),
        this.getStateRaw(this._settingsHelpers.otherSensors),
        this.getStateRaw(this._settingsHelpers.refLimit),
        this.getStateRaw(this._settingsHelpers.electricityRate),
        this.getStateRaw(this._settingsHelpers.feedInRate),
      ]);

      // Parse power sensors JSON
      if (powerJson && powerJson !== 'unknown' && powerJson !== '') {
        try {
          const ps = JSON.parse(powerJson);
          if (!this.config.entities) this.config.entities = {};
          if (!this.config.entities.power) this.config.entities.power = {};
          const p = this.config.entities.power;
          if (ps.consumption) p.consumption = ps.consumption;
          if (ps.production) p.production = ps.production;
          if (ps.grid_import) p.grid_import = ps.grid_import;
          if (ps.grid_export) p.grid_export = ps.grid_export;
          if (ps.battery_charge) p.battery_charge = ps.battery_charge;
          if (ps.battery_discharge) p.battery_discharge = ps.battery_discharge;
        } catch (e) { /* invalid JSON, use config.js defaults */ }
      }

      // Parse other sensors JSON
      if (otherJson && otherJson !== 'unknown' && otherJson !== '') {
        try {
          const os = JSON.parse(otherJson);
          if (!this.config.entities) this.config.entities = {};
          if (!this.config.entities.cumulative) this.config.entities.cumulative = {};
          const c = this.config.entities.cumulative;
          if (os.cum_consumption) c.consumption = os.cum_consumption;
          if (os.cum_production) c.production = os.cum_production;
          if (os.cum_grid_import) c.grid_import = os.cum_grid_import;
          if (os.cum_grid_export) c.grid_export = os.cum_grid_export;
          if (os.battery_soc) this.config.entities.battery_soc = os.battery_soc;
        } catch (e) { /* invalid JSON, use config.js defaults */ }
      }

      // Numbers
      const rl = parseFloat(refLimit);
      if (!isNaN(rl) && rl > 0) this.config.refLimit = rl;
      const er = parseFloat(elRate);
      if (!isNaN(er) && er > 0) this.config.electricityRate = er;
      const fi = parseFloat(fiRate);
      if (!isNaN(fi) && fi > 0) this.config.feedInRate = fi;

      const bf = parseFloat(await this.getStateRaw(this._settingsHelpers.baseFee));
      if (!isNaN(bf) && bf >= 0) this.config.baseFee = bf;

      // Rate entity mode: if an entity is configured, read rate from it
      const rateEntityId = await this.getStateRaw(this._settingsHelpers.rateEntity);
      if (rateEntityId && rateEntityId !== 'unknown' && rateEntityId !== '') {
        this.config.rateEntity = rateEntityId;
        const entityRate = await this.getState(rateEntityId);
        if (entityRate > 0) this.config.electricityRate = entityRate;
      } else {
        this.config.rateEntity = '';
      }
    } catch (e) {
      console.warn('Settings load failed, using config.js defaults:', e.message);
    }
  }

  populateSettingsForm() {
    const p = this.config.entities?.power || {};
    const c = this.config.entities?.cumulative || {};

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };

    // Power sensors
    setVal('set-power-consumption', p.consumption);
    setVal('set-power-production', p.production);
    setVal('set-power-grid-import', p.grid_import);
    setVal('set-power-grid-export', p.grid_export);
    setVal('set-power-battery-charge', p.battery_charge);
    setVal('set-power-battery-discharge', p.battery_discharge);

    // Cumulative + battery
    setVal('set-cum-consumption', c.consumption);
    setVal('set-cum-production', c.production);
    setVal('set-cum-grid-import', c.grid_import);
    setVal('set-cum-grid-export', c.grid_export);
    setVal('set-battery-soc', this.config.entities?.battery_soc);

    // Numbers
    setVal('set-ref-limit', this.config.refLimit ?? 5);
    setVal('set-electricity-rate', this.config.electricityRate ?? 0.30);
    setVal('set-feed-in-rate', this.config.feedInRate ?? 0.08);
    setVal('set-base-fee', this.config.baseFee ?? 0);

    // Rate mode
    const hasEntity = this.config.rateEntity && this.config.rateEntity !== '';
    const modeSelect = document.getElementById('set-rate-mode');
    if (modeSelect) modeSelect.value = hasEntity ? 'entity' : 'fixed';
    setVal('set-rate-entity', this.config.rateEntity || '');
    this._updateRateModeUI();
  }

  _updateRateModeUI() {
    const mode = document.getElementById('set-rate-mode')?.value || 'fixed';
    const fixedInput = document.getElementById('set-electricity-rate');
    const entityWrap = document.querySelector('.rate-entity-wrap');
    if (fixedInput) fixedInput.style.display = mode === 'fixed' ? '' : 'none';
    if (entityWrap) entityWrap.style.display = mode === 'entity' ? '' : 'none';
  }

  async saveSettings() {
    const btn = document.getElementById('settings-save-btn');
    const status = document.getElementById('settings-status');
    btn.disabled = true;
    status.textContent = 'Speichere...';
    status.className = 'settings-status';

    try {
      const getVal = (id) => (document.getElementById(id)?.value || '').trim();

      // Build power sensors JSON
      const powerObj = {};
      for (const [id, key] of this._powerFields) {
        const v = getVal(id);
        if (v) powerObj[key] = v;
      }

      // Build other sensors JSON
      const otherObj = {};
      for (const [id, key] of this._otherFields) {
        const v = getVal(id);
        if (v) otherObj[key] = v;
      }

      // Save all to HA helpers
      await Promise.all([
        this.callService('input_text', 'set_value', {
          entity_id: this._settingsHelpers.powerSensors,
          value: JSON.stringify(powerObj),
        }),
        this.callService('input_text', 'set_value', {
          entity_id: this._settingsHelpers.otherSensors,
          value: JSON.stringify(otherObj),
        }),
        this.callService('input_number', 'set_value', {
          entity_id: this._settingsHelpers.refLimit,
          value: parseFloat(getVal('set-ref-limit')) || 5,
        }),
        this.callService('input_number', 'set_value', {
          entity_id: this._settingsHelpers.electricityRate,
          value: parseFloat(getVal('set-electricity-rate')) || 0.30,
        }),
        this.callService('input_number', 'set_value', {
          entity_id: this._settingsHelpers.feedInRate,
          value: parseFloat(getVal('set-feed-in-rate')) || 0.08,
        }),
        this.callService('input_number', 'set_value', {
          entity_id: this._settingsHelpers.baseFee,
          value: parseFloat(getVal('set-base-fee')) || 0,
        }),
        this.callService('input_text', 'set_value', {
          entity_id: this._settingsHelpers.rateEntity,
          value: getVal('set-rate-mode') === 'entity' ? getVal('set-rate-entity') : '',
        }),
      ]);

      // Update local config
      await this.loadSettings();
      status.textContent = 'Gespeichert!';
    } catch (e) {
      console.error('Save settings failed:', e);
      status.textContent = 'Fehler: ' + e.message;
      status.className = 'settings-status error';
    } finally {
      btn.disabled = false;
      setTimeout(() => { status.textContent = ''; }, 4000);
    }
  }

  // ── Entity Autocomplete ──────────────────────────────────────

  async fetchAllEntities() {
    const now = Date.now();
    if (this._entityCache && (now - this._entityCacheTime) < 300000) {
      return this._entityCache;
    }
    if (this._entityFetchPending) return this._entityFetchPending;
    this._entityFetchPending = (async () => {
      try {
        const all = await this.fetchAPI('/api/states');
        this._entityCache = all
          .filter(e => e.entity_id.startsWith('sensor.'))
          .map(e => ({
            id: e.entity_id,
            name: e.attributes?.friendly_name || '',
          }));
        this._entityCacheTime = Date.now();
        return this._entityCache;
      } catch (e) {
        return this._entityCache || [];
      } finally {
        this._entityFetchPending = null;
      }
    })();
    return this._entityFetchPending;
  }

  initSettingsTab() {
    document.getElementById('settings-save-btn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('set-rate-mode')?.addEventListener('change', () => this._updateRateModeUI());

    document.querySelectorAll('.entity-search').forEach(input => {
      const list = input.parentElement.querySelector('.autocomplete-list');
      let selectedIdx = -1;
      let debounceTimer = null;

      const showResults = async (query) => {
        const q = query.toLowerCase();
        if (q.length < 2) { list.classList.remove('open'); return; }
        const entities = await this.fetchAllEntities();
        const filtered = entities
          .filter(e => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
          .slice(0, 8);

        list.innerHTML = '';
        selectedIdx = -1;
        if (filtered.length === 0) { list.classList.remove('open'); return; }

        for (const e of filtered) {
          const div = document.createElement('div');
          div.className = 'autocomplete-item';
          div.innerHTML = `<span class="ac-id">${e.id}</span><span class="ac-name">${e.name}</span>`;
          div.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            input.value = e.id;
            list.classList.remove('open');
          });
          list.appendChild(div);
        }
        list.classList.add('open');
      };

      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => showResults(input.value), 300);
      });
      input.addEventListener('blur', () => {
        setTimeout(() => list.classList.remove('open'), 150);
      });
      input.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
          items.forEach((it, i) => it.classList.toggle('selected', i === selectedIdx));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIdx = Math.max(selectedIdx - 1, 0);
          items.forEach((it, i) => it.classList.toggle('selected', i === selectedIdx));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedIdx >= 0 && items[selectedIdx]) {
            input.value = items[selectedIdx].querySelector('.ac-id').textContent;
            list.classList.remove('open');
          }
        } else if (e.key === 'Escape') {
          list.classList.remove('open');
        }
      });
    });
  }

  getPeriodLabel(period) {
    if (period === 'custom' && this._customRange) {
      const fmt = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `${fmt(this._customRange.start)} – ${fmt(this._customRange.end)}`;
    }
    return {
      yesterday: 'Gestern', today: 'Heute',
      this_week: 'Diese Woche', last_week: 'Letzte Woche',
      this_month: 'Dieser Monat', last_month: 'Letzter Monat',
      this_year: 'Dieses Jahr', last_year: 'Letztes Jahr',
    }[period] || period;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new EnergyDashboard();
});
