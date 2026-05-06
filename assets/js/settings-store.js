/* ========================================================================
   Settings Store — localStorage persistence + Export/Import JSON
   Single source of truth for: targets, status/team mappings, column prefs,
   filter presets, snapshot history, deal comments.
   ======================================================================== */
(function () {
  const STORAGE_KEY = 'salesDashboard.settings.v1';
  const VERSION = 1;

  function getDefaults() {
    return {
      version: VERSION,
      updatedAt: new Date().toISOString(),
      exportedAt: null,
      exportedBy: '',

      // Sales people (auto-populated from data + user-added)
      users: [],   // [{ name: 'Sutasinee', team: 'Inside', active: true }]

      // Manual New Sell targets per year per user per month
      // newSellTargets[year][userName] = [12 monthly values]
      newSellTargets: {},

      // Sales Forecast (manual input) — same shape as newSellTargets
      salesForecast: {},

      // Renewal Estimate config per year
      // renewalEstimate[year] = { multiplier: 0.8, monthOverrides: {3: {skip:true}, 6: {multiplier:0.5}} }
      renewalEstimate: {},

      // Column visibility / order for detail modal
      columnPreferences: {
        detailModal: [
          { field: 'Deal Name', visible: true },
          { field: 'Company', visible: true },
          { field: 'Expected close date', visible: true },
          { field: 'Income', visible: true, align: 'right' },
          { field: 'Deal Type', visible: true },
          { field: 'Responsible', visible: true },
          { field: 'Product Type', visible: true },
        ],
      },

      // Last used filter preset
      filterPresets: {
        lastUsed: null,
      },

      // Status mapping override (Stage → Won/Commit/Upside/Open/Lost)
      statusMapping: {},

      // Team mapping override (Responsible → Team)
      teamMapping: {},

      // Column header remap (canonical field → header name in user's file)
      columnRemap: {},

      // UI preferences
      uiPreferences: {
        lastPage: 'overview',
        theme: 'light',
        language: 'th',
        compactMode: false,
        diffViewEnabled: true,
      },

      // Snapshot history (auto-recorded on each export)
      snapshots: [],

      // Per-deal comments (Deal ID → comment text)
      dealComments: {},
    };
  }

  let _state = null;

  function load() {
    if (_state) return _state;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        _state = mergeWithDefaults(parsed);
      } else {
        _state = getDefaults();
      }
    } catch (e) {
      console.warn('Settings load failed, using defaults', e);
      _state = getDefaults();
    }
    return _state;
  }

  function mergeWithDefaults(saved) {
    // Shallow merge to ensure new fields exist
    const defaults = getDefaults();
    const merged = Object.assign({}, defaults, saved);
    merged.columnPreferences = Object.assign({}, defaults.columnPreferences, saved.columnPreferences || {});
    merged.uiPreferences = Object.assign({}, defaults.uiPreferences, saved.uiPreferences || {});
    merged.filterPresets = Object.assign({}, defaults.filterPresets, saved.filterPresets || {});
    return merged;
  }

  function save() {
    if (!_state) return;
    _state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.warn('Settings save failed', e);
      App.UI && App.UI.toast('Failed to save settings: ' + e.message, 'error');
    }
  }

  function get(path) {
    const s = load();
    if (!path) return s;
    return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), s);
  }

  function set(path, value) {
    const s = load();
    const keys = path.split('.');
    let cur = s;
    for (let i = 0; i < keys.length - 1; i++) {
      if (cur[keys[i]] == null) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    save();
  }

  function update(updater) {
    const s = load();
    updater(s);
    save();
  }

  function reset() {
    _state = getDefaults();
    save();
  }

  /* ----- Export / Import ----- */
  function exportToFile() {
    const s = load();
    s.exportedAt = new Date().toISOString();
    save();

    const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
    const filename = `sales-dashboard-settings_${today}.json`;
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    return filename;
  }

  function importFromObject(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Invalid settings object');
    if (obj.version && obj.version > VERSION) {
      throw new Error(`Settings version ${obj.version} is newer than supported (${VERSION})`);
    }
    _state = mergeWithDefaults(obj);
    save();
  }

  /* ----- Snapshot ----- */
  function recordSnapshot(metrics) {
    const s = load();
    s.snapshots.push({
      date: new Date().toISOString().slice(0, 10),
      timestamp: Date.now(),
      ...metrics,
    });
    // Keep only last 52 weeks
    if (s.snapshots.length > 52) s.snapshots = s.snapshots.slice(-52);
    save();
  }

  /* ----- User management ----- */
  function addUser(name, team) {
    const s = load();
    if (!s.users.find(u => u.name === name)) {
      s.users.push({ name, team: team || 'Unassigned', active: true });
      save();
    }
  }

  function syncUsersFromDeals(deals) {
    const s = load();
    const seen = new Set(s.users.map(u => u.name));
    const teamLookup = {};
    deals.forEach(d => {
      if (d.responsible && !seen.has(d.responsible)) {
        seen.add(d.responsible);
        teamLookup[d.responsible] = d.team || 'Unassigned';
        s.users.push({
          name: d.responsible,
          team: d.team || 'Unassigned',
          active: true,
        });
      }
    });
    save();
  }

  /* ----- Targets API ----- */
  function getNewSellTarget(year, userName, month) {
    const s = load();
    const yearData = s.newSellTargets[year];
    if (!yearData || !yearData[userName]) return 0;
    return yearData[userName][month - 1] || 0;
  }
  function setNewSellTarget(year, userName, month, value) {
    const s = load();
    if (!s.newSellTargets[year]) s.newSellTargets[year] = {};
    if (!s.newSellTargets[year][userName]) s.newSellTargets[year][userName] = new Array(12).fill(0);
    s.newSellTargets[year][userName][month - 1] = parseFloat(value) || 0;
    save();
  }

  function getSalesForecast(year, userName, month) {
    const s = load();
    const yearData = s.salesForecast[year];
    if (!yearData || !yearData[userName]) return 0;
    return yearData[userName][month - 1] || 0;
  }
  function setSalesForecast(year, userName, month, value) {
    const s = load();
    if (!s.salesForecast[year]) s.salesForecast[year] = {};
    if (!s.salesForecast[year][userName]) s.salesForecast[year][userName] = new Array(12).fill(0);
    s.salesForecast[year][userName][month - 1] = parseFloat(value) || 0;
    save();
  }

  function getRenewalEstimate(year) {
    const s = load();
    return s.renewalEstimate[year] || { multiplier: 0.8, monthOverrides: {} };
  }
  function setRenewalEstimateMultiplier(year, value) {
    const s = load();
    if (!s.renewalEstimate[year]) s.renewalEstimate[year] = { multiplier: 0.8, monthOverrides: {} };
    s.renewalEstimate[year].multiplier = parseFloat(value) || 0;
    save();
  }
  function setRenewalEstimateMonthOverride(year, month, override) {
    const s = load();
    if (!s.renewalEstimate[year]) s.renewalEstimate[year] = { multiplier: 0.8, monthOverrides: {} };
    if (override === null) delete s.renewalEstimate[year].monthOverrides[month];
    else s.renewalEstimate[year].monthOverrides[month] = override;
    save();
  }

  /* ----- Comments ----- */
  function getDealComment(dealId) {
    return load().dealComments[String(dealId)] || '';
  }
  function setDealComment(dealId, text) {
    const s = load();
    if (text) s.dealComments[String(dealId)] = text;
    else delete s.dealComments[String(dealId)];
    save();
  }

  window.App = window.App || {};
  window.App.Settings = {
    load, save, get, set, update, reset,
    exportToFile, importFromObject,
    recordSnapshot,
    addUser, syncUsersFromDeals,
    getNewSellTarget, setNewSellTarget,
    getSalesForecast, setSalesForecast,
    getRenewalEstimate, setRenewalEstimateMultiplier, setRenewalEstimateMonthOverride,
    getDealComment, setDealComment,
    VERSION, STORAGE_KEY,
  };
})();
