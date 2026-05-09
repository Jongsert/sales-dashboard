/* ========================================================================
   Filters — Global filter bar + apply logic
   Period: month / quarter / year / all / custom
   Multi-selects: team, user, pipeline, dealType, productType, status
   Cascade: selecting a team narrows users to that team automatically
   ======================================================================== */
(function () {
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Local-time YYYY-MM-DD (avoid UTC shift on positive timezones like Thailand UTC+7)
  function toLocalISODate(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const STATE = {
    deals: [],            // raw, not filtered
    parsed: null,         // last parse result (from data-parser)
    period: { preset: 'year', from: null, to: null },
    team: new Set(),
    user: new Set(),
    pipeline: new Set(),
    dealType: new Set(),
    productType: new Set(),
    status: new Set(),
    msHandles: {},        // multi-select handles for re-render
  };

  /* ----- Period preset application -----
     Boundary convention: from = 00:00:00 (start of day), to = 23:59:59 (end
     of day). Both ends are INCLUSIVE — a deal whose expectedClose is exactly
     `to` matches the period. The downstream filter uses
       d.expectedClose >= from && d.expectedClose <= to
     so this convention must hold for every preset below. */
  function applyPreset(preset, year, sub) {
    const today = new Date();
    const useYear = year || today.getFullYear();
    let from = null, to = null, label = '';
    switch (preset) {
      case 'thisMonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
        label = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
        break;
      case 'lastMonth': {
        const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        from = lm;
        to = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
        label = `${MONTH_NAMES[lm.getMonth()]} ${lm.getFullYear()}`;
        break;
      }
      case 'nextMonth': {
        const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        from = nm;
        to = new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59);
        label = `${MONTH_NAMES[nm.getMonth()]} ${nm.getFullYear()}`;
        break;
      }
      case 'mtd':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        label = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()} (MTD)`;
        break;
      case 'thisQuarter': {
        const q = Math.floor(today.getMonth() / 3);
        from = new Date(today.getFullYear(), q * 3, 1);
        to = new Date(today.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
        label = `Q${q + 1} ${today.getFullYear()}`;
        break;
      }
      case 'lastQuarter': {
        const cq = Math.floor(today.getMonth() / 3);
        const q = cq - 1;
        const baseY = q < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const baseQ = q < 0 ? 3 : q;
        from = new Date(baseY, baseQ * 3, 1);
        to = new Date(baseY, baseQ * 3 + 3, 0, 23, 59, 59);
        label = `Q${baseQ + 1} ${baseY}`;
        break;
      }
      case 'nextQuarter': {
        const cq = Math.floor(today.getMonth() / 3);
        const q = cq + 1;
        const baseY = q > 3 ? today.getFullYear() + 1 : today.getFullYear();
        const baseQ = q > 3 ? 0 : q;
        from = new Date(baseY, baseQ * 3, 1);
        to = new Date(baseY, baseQ * 3 + 3, 0, 23, 59, 59);
        label = `Q${baseQ + 1} ${baseY}`;
        break;
      }
      case 'qtd': {
        const q = Math.floor(today.getMonth() / 3);
        from = new Date(today.getFullYear(), q * 3, 1);
        to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        label = `Q${q + 1} ${today.getFullYear()} (QTD)`;
        break;
      }
      case 'thisYear':
        from = new Date(today.getFullYear(), 0, 1);
        to = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
        label = `${today.getFullYear()} (full year)`;
        break;
      case 'lastYear':
        from = new Date(today.getFullYear() - 1, 0, 1);
        to = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59);
        label = `${today.getFullYear() - 1} (full year)`;
        break;
      case 'nextYear':
        from = new Date(today.getFullYear() + 1, 0, 1);
        to = new Date(today.getFullYear() + 1, 11, 31, 23, 59, 59);
        label = `${today.getFullYear() + 1} (full year)`;
        break;
      case 'ytd':
        from = new Date(today.getFullYear(), 0, 1);
        to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        label = `${today.getFullYear()} YTD`;
        break;
      case 'all':
        from = null; to = null;
        label = 'All time';
        break;
      case 'year':
        from = new Date(useYear, 0, 1);
        to = new Date(useYear, 11, 31, 23, 59, 59);
        label = `${useYear} (full year)`;
        break;
      case 'quarter': {
        const q = sub - 1;
        from = new Date(useYear, q * 3, 1);
        to = new Date(useYear, q * 3 + 3, 0, 23, 59, 59);
        label = `Q${sub} ${useYear}`;
        break;
      }
      case 'month': {
        const m = sub - 1;
        from = new Date(useYear, m, 1);
        to = new Date(useYear, m + 1, 0, 23, 59, 59);
        label = `${MONTH_NAMES[m]} ${useYear}`;
        break;
      }
      case 'custom':
        from = STATE.period.from;
        to = STATE.period.to;
        label = (from ? toLocalISODate(from) : '...') + ' → ' + (to ? toLocalISODate(to) : '...');
        break;
    }
    STATE.period.preset = preset;
    STATE.period.year = useYear;
    STATE.period.sub = sub;
    STATE.period.from = from;
    STATE.period.to = to;
    STATE.period.label = label;
  }

  /* ----- Build the filter UI inside a container element ----- */
  function build(container, onChange) {
    const tr = (App.i18n && App.i18n.t) ? App.i18n.t : (k, f) => f || k;
    container.innerHTML = `
      <div class="f-group">
        <span class="f-label" data-i18n="filter.period">Period</span>
        <div class="period-picker">
          <button id="periodTrigger" class="ms-trigger has-value" type="button">📅 Period</button>
          <div class="period-panel" id="periodPanel"></div>
        </div>
      </div>
      <div class="f-group">
        <span class="f-label" data-i18n="filter.team">Team</span>
        <div class="ms-dropdown" data-filter="team"></div>
      </div>
      <div class="f-group">
        <span class="f-label" data-i18n="filter.user">User</span>
        <div class="ms-dropdown" data-filter="user"></div>
      </div>
      <div class="f-group">
        <span class="f-label" data-i18n="filter.pipeline">Pipeline</span>
        <div class="ms-dropdown" data-filter="pipeline"></div>
      </div>
      <div class="f-group">
        <span class="f-label" data-i18n="filter.dealType">Deal Type</span>
        <div class="ms-dropdown" data-filter="dealType"></div>
      </div>
      <div class="f-group">
        <span class="f-label" data-i18n="filter.productType">Product Type</span>
        <div class="ms-dropdown" data-filter="productType"></div>
      </div>
      <div class="f-group">
        <span class="f-label" data-i18n="filter.status">Status</span>
        <div class="ms-dropdown" data-filter="status"></div>
      </div>
      <div class="f-group" style="margin-left:auto;">
        <span class="f-label">&nbsp;</span>
        <button id="resetFiltersBtn" class="btn btn-ghost btn-sm" data-i18n="btn.reset">Reset</button>
      </div>
    `;
    if (App.i18n) App.i18n.apply(container);

    setupPeriodPicker(container, onChange);

    container.querySelector('#resetFiltersBtn').addEventListener('click', () => {
      ['team', 'user', 'pipeline', 'dealType', 'productType', 'status'].forEach(k => STATE[k].clear());
      if (STATE.msHandles.user && STATE.allDeals) {
        const allUsers = Array.from(new Set(STATE.allDeals.map(d => d.responsible).filter(Boolean)))
          .sort((a, b) => String(a).localeCompare(String(b)));
        STATE.msHandles.user.setOptions(allUsers);
      }
      Object.values(STATE.msHandles).forEach(h => h && h.rerender());
      applyPreset('thisYear');
      updatePeriodTrigger();
      onChange && onChange();
    });

    applyPreset('thisYear');
    updatePeriodTrigger();
    return container;
  }

  function updatePeriodTrigger() {
    const t = document.getElementById('periodTrigger');
    if (!t) return;
    t.textContent = '📅 ' + (STATE.period.label || 'Select period');
  }

  /* ----- Period picker UI ----- */
  // Quarter→months mapping for cascading
  const QUARTER_MONTHS = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };

  // Compute available years from data (auto-detect — falls back to today ± 2 if empty)
  function dataYears() {
    const today = new Date();
    if (!STATE.allDeals || STATE.allDeals.length === 0) {
      return [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];
    }
    const years = new Set();
    STATE.allDeals.forEach(d => {
      if (d.expectedClose) years.add(d.expectedClose.getFullYear());
    });
    return Array.from(years).sort((a, b) => a - b);
  }

  function setupPeriodPicker(container, onChange) {
    const trigger = container.querySelector('#periodTrigger');
    const panel = container.querySelector('#periodPanel');
    const today = new Date();

    function renderPanel() {
      const yp = STATE.period.year || today.getFullYear();
      const qp = (STATE.period.preset === 'quarter' || STATE.period.preset === 'month')
        ? STATE.period.sub && Math.ceil((STATE.period.sub) / 3)
        : null;
      const isQuarterSelected = STATE.period.preset === 'quarter' && STATE.period.year === yp;
      const isMonthSelected = STATE.period.preset === 'month' && STATE.period.year === yp;
      const selectedQuarter = isQuarterSelected ? STATE.period.sub : (isMonthSelected ? Math.ceil(STATE.period.sub / 3) : null);
      const isYearActive = STATE.period.preset === 'year';

      const tr = (App.i18n && App.i18n.t) ? App.i18n.t : (k, f) => f || k;
      const presets = [
        'thisMonth', 'lastMonth', 'nextMonth', 'mtd',
        'thisQuarter', 'lastQuarter', 'nextQuarter', 'qtd',
        'thisYear', 'lastYear', 'nextYear', 'ytd',
        'all',
      ].map(key => ({ key, lbl: tr('period.' + key) }));

      const years = dataYears();
      const fromVal = STATE.period.from ? toLocalISODate(STATE.period.from) : '';
      const toVal   = STATE.period.to   ? toLocalISODate(STATE.period.to)   : '';

      // Cascade: if a quarter is selected, only show months in that quarter
      const monthList = selectedQuarter ? QUARTER_MONTHS[selectedQuarter] : [1,2,3,4,5,6,7,8,9,10,11,12];

      panel.innerHTML = `
        <div class="pp-section">
          <div class="pp-section-title">${tr('period.quickPreset')}</div>
          <select id="ppQuickSelect" class="pp-select">
            <option value="">${tr('period.selectPreset')}</option>
            ${presets.map(p => `<option value="${p.key}" ${STATE.period.preset === p.key ? 'selected' : ''}>${p.lbl}</option>`).join('')}
          </select>
        </div>

        <div class="pp-section">
          <div class="pp-section-title">${tr('period.byYear')}</div>
          <div class="pp-years">
            ${years.length === 0
              ? '<span style="font-size:11px; color:var(--text-muted);">No data — upload a file first</span>'
              : years.map(y => `<button class="pp-btn ${(STATE.period.year === y && (isYearActive || isQuarterSelected || isMonthSelected)) ? 'active' : ''}" data-pp-year="${y}">${y}</button>`).join('')}
          </div>
        </div>

        ${(isYearActive || isQuarterSelected || isMonthSelected) ? `
          <div class="pp-section">
            <div class="pp-section-sub">Quarter in ${yp} <small>(click to narrow)</small></div>
            <div class="pp-quarters">
              ${[1,2,3,4].map(q => `<button class="pp-btn ${selectedQuarter === q ? 'active' : ''}" data-pp-q="${q}" data-pp-y="${yp}">Q${q}</button>`).join('')}
            </div>
            <div class="pp-section-sub">${selectedQuarter ? `Month in Q${selectedQuarter} ${yp}` : `Month in ${yp}`}</div>
            <div class="pp-months">
              ${monthList.map(m => `<button class="pp-btn ${isMonthSelected && STATE.period.sub === m ? 'active' : ''}" data-pp-m="${m}" data-pp-y="${yp}">${MONTH_NAMES[m - 1]}</button>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="pp-section">
          <div class="pp-section-title">${tr('period.custom')}</div>
          <div class="pp-custom">
            <input type="text" id="ppFrom" class="date-input" value="${fromVal}" placeholder="YYYY-MM-DD" autocomplete="off">
            <span class="pp-arrow">→</span>
            <input type="text" id="ppTo" class="date-input" value="${toVal}" placeholder="YYYY-MM-DD" autocomplete="off">
          </div>
        </div>
      `;

      panel.querySelector('#ppQuickSelect').addEventListener('change', (e) => {
        if (!e.target.value) return;
        applyPreset(e.target.value);
        renderPanel();
        updatePeriodTrigger();
        onChange && onChange();
      });
      panel.querySelectorAll('[data-pp-year]').forEach(b => b.addEventListener('click', () => {
        applyPreset('year', parseInt(b.dataset.ppYear));
        renderPanel();
        updatePeriodTrigger();
        onChange && onChange();
      }));
      panel.querySelectorAll('[data-pp-q]').forEach(b => b.addEventListener('click', () => {
        applyPreset('quarter', parseInt(b.dataset.ppY), parseInt(b.dataset.ppQ));
        renderPanel();
        updatePeriodTrigger();
        onChange && onChange();
      }));
      panel.querySelectorAll('[data-pp-m]').forEach(b => b.addEventListener('click', () => {
        applyPreset('month', parseInt(b.dataset.ppY), parseInt(b.dataset.ppM));
        renderPanel();
        updatePeriodTrigger();
        onChange && onChange();
      }));
      const fromEl = panel.querySelector('#ppFrom');
      const toEl = panel.querySelector('#ppTo');
      function commitCustom() {
        STATE.period.preset = 'custom';
        // Append T-time to force local-time parsing (avoid UTC interpretation)
        STATE.period.from = fromEl.value ? new Date(fromEl.value + 'T00:00:00') : null;
        STATE.period.to = toEl.value ? new Date(toEl.value + 'T23:59:59') : null;
        STATE.period.label = (fromEl.value || '...') + ' → ' + (toEl.value || '...');
        renderPanel();
        updatePeriodTrigger();
        onChange && onChange();
      }
      fromEl.addEventListener('change', commitCustom);
      toEl.addEventListener('change', commitCustom);
      // Attach custom calendar picker (replaces native date input)
      if (App.UI && App.UI.attachDatePicker) {
        App.UI.attachDatePicker(fromEl);
        App.UI.attachDatePicker(toEl);
      }
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = !panel.classList.contains('open');
      document.querySelectorAll('.period-panel.open, .ms-panel.open').forEach(el => el.classList.remove('open'));
      if (opening) {
        renderPanel();
        panel.classList.add('open');
      } else {
        trigger.blur();
      }
    });
    panel.addEventListener('click', e => e.stopPropagation());
    // Close on outside mousedown — capture phase so child stopPropagation doesn't block.
    // Don't close if click is inside the calendar popup (which is appended to body, not panel).
    document.addEventListener('mousedown', (e) => {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target)) return;
      if (trigger.contains(e.target)) return;
      const cal = document.querySelector('.cal-panel');
      if (cal && cal.contains(e.target)) return;
      panel.classList.remove('open');
      trigger.blur();
    }, true);
  }

  /* ----- Re-build multi-select option lists from current data ----- */
  function refreshMultiSelects(deals, onChange) {
    STATE.allDeals = deals;

    // Returns [{ value, count }] sorted alphabetically — drives count badges
    // shown next to each filter option.
    function uniquesWithCount(rows, key) {
      const counts = {};
      rows.forEach(d => {
        const v = d[key];
        if (v) counts[v] = (counts[v] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([value, count]) => ({ value, count }));
    }

    // Team options: union of (teams present in deal data) + (teams configured
    // in settings, even if empty/no users yet). Empty teams get count = 0.
    function teamOptions() {
      const counts = {};
      deals.forEach(d => { if (d.team) counts[d.team] = (counts[d.team] || 0) + 1; });
      try {
        const settings = App.Settings && App.Settings.load && App.Settings.load();
        if (settings && Array.isArray(settings.teams)) {
          settings.teams.forEach(t => {
            if (t && t.name && !(t.name in counts)) counts[t.name] = 0;
          });
        }
      } catch (_) {}
      return Object.entries(counts)
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([value, count]) => ({ value, count }));
    }

    // User options depend on Team selection (cascade), with deal counts.
    function getUserOptions() {
      const scope = STATE.team.size === 0 ? deals : deals.filter(d => STATE.team.has(d.team));
      return uniquesWithCount(scope, 'responsible');
    }

    // Team filter — special: also refresh User options on change
    const teamEl = document.querySelector('[data-filter="team"]');
    STATE.msHandles.team = App.UI.buildMultiSelect(
      teamEl,
      teamOptions(),
      STATE.team,
      () => {
        // Recompute User options based on selected teams
        const newUserOpts = getUserOptions();
        if (STATE.msHandles.user) {
          STATE.msHandles.user.setOptions(newUserOpts);
          // Drop any selected users that are no longer valid
          Array.from(STATE.user).forEach(u => {
            if (!newUserOpts.includes(u)) STATE.user.delete(u);
          });
          STATE.msHandles.user.rerender();
        }
        onChange && onChange();
      }
    );

    // User
    const userEl = document.querySelector('[data-filter="user"]');
    STATE.msHandles.user = App.UI.buildMultiSelect(
      userEl, getUserOptions(), STATE.user, () => onChange && onChange()
    );

    // Pipeline / Product Type — flat, alphabetical, with count badges
    [['pipeline', 'pipeline'], ['productType', 'productType']].forEach(([key, field]) => {
      const el = document.querySelector(`[data-filter="${key}"]`);
      if (!el) return;
      STATE.msHandles[key] = App.UI.buildMultiSelect(
        el, uniquesWithCount(deals, field), STATE[key], () => onChange && onChange()
      );
    });

    // Deal Type — grouped: New (New Sell, Up sell, Cross sell) / Renew (Re-New Same, MACD, Up sell, Decrease) / Other
    const dealTypeEl = document.querySelector('[data-filter="dealType"]');
    if (dealTypeEl) {
      STATE.msHandles.dealType = App.UI.buildMultiSelect(
        dealTypeEl, buildDealTypeOptions(deals), STATE.dealType, () => onChange && onChange()
      );
    }

    // Status (fixed canonical list, with deal counts).
    // Source of truth = App.StatusMapping.LIST so adding a new status (e.g.
    // 'Unmapped' added in v1.9.9) automatically propagates here.
    const statusEl = document.querySelector('[data-filter="status"]');
    if (statusEl) {
      const statusCounts = {};
      deals.forEach(d => { if (d.status) statusCounts[d.status] = (statusCounts[d.status] || 0) + 1; });
      const statusList = (App.StatusMapping && App.StatusMapping.LIST) || ['Won', 'Commit', 'Upside', 'Open', 'Lost'];
      const statusOpts = statusList.map(s => ({ value: s, count: statusCounts[s] || 0 }));
      STATE.msHandles.status = App.UI.buildMultiSelect(
        statusEl, statusOpts, STATE.status, () => onChange && onChange()
      );
    }
  }

  /* ----- Apply current filter state to a deal array ----- */
  function apply(deals, opts = {}) {
    const f = STATE;
    const from = f.period.from, to = f.period.to;

    // Team→User cascade: if team selected and user empty, restrict to users in that team
    let userFilter = f.user;
    if (!opts.skipUserTeam && f.team.size > 0 && f.user.size === 0) {
      userFilter = new Set();
      deals.forEach(d => {
        if (d.responsible && f.team.has(d.team)) userFilter.add(d.responsible);
      });
    }

    return deals.filter(d => {
      if (from || to) {
        if (!d.expectedClose) return false;
        if (from && d.expectedClose < from) return false;
        if (to && d.expectedClose > to) return false;
      }
      if (!opts.skipUserTeam && f.team.size > 0 && !f.team.has(d.team)) return false;
      if (!opts.skipUserTeam && userFilter.size > 0 && !userFilter.has(d.responsible)) return false;
      if (f.pipeline.size > 0 && !f.pipeline.has(d.pipeline)) return false;
      if (f.dealType.size > 0 && !f.dealType.has(d.dealType)) return false;
      if (f.productType.size > 0 && !f.productType.has(d.productType)) return false;
      if (f.status.size > 0 && !f.status.has(d.status)) return false;
      return true;
    });
  }

  /* ----- Hardcoded scope: exclude End Customer = "1-To-All (Online)" ----- */
  function dashboardScope(deals) {
    return deals.filter(d => d.endCustomer !== '1-To-All (Online)');
  }

  /* ----- Aggregate helpers ----- */
  function aggregateByMonth(deals, predicate, valueFn, fromDate, toDate) {
    if (!fromDate || !toDate) {
      let min = null, max = null;
      deals.forEach(d => {
        if (predicate(d) && d.expectedClose) {
          if (!min || d.expectedClose < min) min = d.expectedClose;
          if (!max || d.expectedClose > max) max = d.expectedClose;
        }
      });
      if (!min) return { labels: [], data: [] };
      fromDate = new Date(min.getFullYear(), min.getMonth(), 1);
      toDate = new Date(max.getFullYear(), max.getMonth() + 1, 0);
    }
    const labels = [];
    const buckets = {};
    let cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    while (cur <= toDate) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      labels.push({ key, lbl: `${MONTH_NAMES[cur.getMonth()]} ${cur.getFullYear()}` });
      buckets[key] = 0;
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    for (const d of deals) {
      if (!predicate(d) || !d.expectedClose) continue;
      const key = `${d.expectedClose.getFullYear()}-${String(d.expectedClose.getMonth() + 1).padStart(2, '0')}`;
      if (key in buckets) buckets[key] += valueFn(d);
    }
    return { labels: labels.map(l => l.lbl), data: labels.map(l => buckets[l.key]) };
  }

  function aggregateByMonthMulti(deals, predicates, valueFn, fromDate, toDate) {
    // predicates = { Won: fn, Commit: fn, ... } returns { labels, datasets: { Won: [..], Commit: [..] } }
    const result = { labels: [], datasets: {} };
    Object.keys(predicates).forEach(k => result.datasets[k] = []);
    if (!fromDate || !toDate) {
      let min = null, max = null;
      deals.forEach(d => {
        if (d.expectedClose) {
          if (!min || d.expectedClose < min) min = d.expectedClose;
          if (!max || d.expectedClose > max) max = d.expectedClose;
        }
      });
      if (!min) return result;
      fromDate = new Date(min.getFullYear(), min.getMonth(), 1);
      toDate = new Date(max.getFullYear(), max.getMonth() + 1, 0);
    }
    const labels = [];
    const buckets = {};
    let cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    while (cur <= toDate) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      labels.push({ key, lbl: `${MONTH_NAMES[cur.getMonth()]} ${cur.getFullYear()}` });
      buckets[key] = {};
      Object.keys(predicates).forEach(p => buckets[key][p] = 0);
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    for (const d of deals) {
      if (!d.expectedClose) continue;
      const key = `${d.expectedClose.getFullYear()}-${String(d.expectedClose.getMonth() + 1).padStart(2, '0')}`;
      if (!(key in buckets)) continue;
      Object.entries(predicates).forEach(([k, pred]) => {
        if (pred(d)) buckets[key][k] += valueFn(d);
      });
    }
    result.labels = labels.map(l => l.lbl);
    Object.keys(predicates).forEach(p => {
      result.datasets[p] = labels.map(l => buckets[l.key][p]);
    });
    return result;
  }

  /* ----- Common matchers ----- */
  const RENEW_PIPES = new Set(['Subscription Renew', 'Auto Renew']);
  const NEW_TYPES_ORDER = ['New Sell', 'Up sell', 'Cross sell'];
  const RENEW_TYPES_ORDER = ['Re-New Same', 'Re-New MACD', 'Re-New Up sell', 'Re-New Decrease'];
  const RENEW_TYPES = new Set(RENEW_TYPES_ORDER);
  const NEW_TYPES = new Set(NEW_TYPES_ORDER);

  /* ----- Build grouped Deal Type options (preserves intentional order, with counts) ----- */
  function buildDealTypeOptions(deals) {
    const counts = {};
    deals.forEach(d => { if (d.dealType) counts[d.dealType] = (counts[d.dealType] || 0) + 1; });
    function withCount(t) { return { value: t, count: counts[t] }; }
    const newItems = NEW_TYPES_ORDER.filter(t => counts[t]).map(withCount);
    const renewItems = RENEW_TYPES_ORDER.filter(t => counts[t]).map(withCount);
    const otherItems = Object.keys(counts)
      .filter(t => !NEW_TYPES.has(t) && !RENEW_TYPES.has(t))
      .sort((a, b) => String(a).localeCompare(String(b)))
      .map(withCount);
    const result = [];
    if (newItems.length) {
      result.push({ _group: 'New' });
      result.push(...newItems);
    }
    if (renewItems.length) {
      result.push({ _group: 'Renew' });
      result.push(...renewItems);
    }
    if (otherItems.length) {
      result.push({ _group: 'Other' });
      result.push(...otherItems);
    }
    return result;
  }

  const Matchers = {
    isRenew: (d) => RENEW_PIPES.has(d.pipeline) && RENEW_TYPES.has(d.dealType),
    isNew: (d) => NEW_TYPES.has(d.dealType),
    won: (d) => d.status === 'Won',
    commit: (d) => d.status === 'Commit',
    upside: (d) => d.status === 'Upside',
    // open: NARROW — only deals literally at status 'Open'. Use inFlight() if
    // you mean "any deal still in the pipeline (Open/Commit/Upside)".
    open: (d) => d.status === 'Open',
    lost: (d) => d.status === 'Lost',
    // closed: deal reached a TERMINAL status (Won or Lost). Commit and Upside
    // are NOT "closed" — they're still in flight, just at higher confidence.
    closed: (d) => d.status === 'Won' || d.status === 'Lost',
    // inFlight: BROAD "open pipeline" — any deal not yet closed. This is what
    // most KPI cards mean when they say "Open Renew Pipeline" / "Open New
    // Pipeline". Use this instead of hardcoding the 3-status OR check.
    inFlight: (d) => d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside',
  };

  /* ----- URL state encoding/decoding ----- */
  function encodeFilterState() {
    const params = new URLSearchParams();
    if (STATE.period.preset && STATE.period.preset !== 'thisYear') {
      params.set('p', STATE.period.preset);
      if (STATE.period.year && STATE.period.preset !== 'thisYear') params.set('y', STATE.period.year);
      if (STATE.period.sub) params.set('s', STATE.period.sub);
      if (STATE.period.preset === 'custom') {
        if (STATE.period.from) params.set('from', toLocalISODate(STATE.period.from));
        if (STATE.period.to) params.set('to', toLocalISODate(STATE.period.to));
      }
    }
    ['team', 'user', 'pipeline', 'dealType', 'productType', 'status'].forEach(key => {
      if (STATE[key].size > 0) {
        params.set(key, Array.from(STATE[key]).join('|'));   // pipe to allow commas in names
      }
    });
    return params.toString();
  }
  function decodeFilterState(queryString) {
    const params = new URLSearchParams(queryString);
    const preset = params.get('p');
    if (preset) {
      const year = params.get('y') ? parseInt(params.get('y')) : undefined;
      const sub = params.get('s') ? parseInt(params.get('s')) : undefined;
      if (preset === 'custom') {
        STATE.period.preset = 'custom';
        STATE.period.from = params.get('from') ? new Date(params.get('from') + 'T00:00:00') : null;
        STATE.period.to = params.get('to') ? new Date(params.get('to') + 'T23:59:59') : null;
        STATE.period.label = (params.get('from') || '...') + ' → ' + (params.get('to') || '...');
      } else {
        applyPreset(preset, year, sub);
      }
    }
    ['team', 'user', 'pipeline', 'dealType', 'productType', 'status'].forEach(key => {
      STATE[key].clear();
      const val = params.get(key);
      if (val) val.split('|').forEach(v => STATE[key].add(v));
    });
  }

  window.App = window.App || {};
  window.App.Filters = {
    STATE,
    build,
    refreshMultiSelects,
    apply,
    dashboardScope,
    aggregateByMonth,
    aggregateByMonthMulti,
    applyPreset,
    encodeFilterState,
    decodeFilterState,
    Matchers,
    MONTH_NAMES,
    RENEW_PIPES, RENEW_TYPES, NEW_TYPES,
  };
})();
