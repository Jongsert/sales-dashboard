/* ========================================================================
   Filters — Global filter bar + apply logic
   Period: month / quarter / year / all / custom
   Multi-selects: team, user, pipeline, dealType, productType, status
   Cascade: selecting a team narrows users to that team automatically
   ======================================================================== */
(function () {
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

  /* ----- Period preset application ----- */
  function applyPreset(preset, year, sub) {
    const today = new Date();
    const useYear = year || today.getFullYear();
    let from = null, to = null, label = '';
    switch (preset) {
      case 'today':
        from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        label = 'Today';
        break;
      case 'thisWeek': {
        const day = today.getDay() || 7;
        from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (day - 1));
        to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59);
        label = 'This week';
        break;
      }
      case 'thisMonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
        label = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
        break;
      case 'thisQuarter': {
        const q = Math.floor(today.getMonth() / 3);
        from = new Date(today.getFullYear(), q * 3, 1);
        to = new Date(today.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
        label = `Q${q + 1} ${today.getFullYear()}`;
        break;
      }
      case 'ytd':
        from = new Date(today.getFullYear(), 0, 1);
        to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        label = `${today.getFullYear()} YTD`;
        break;
      case 'lastWeek': {
        const day = today.getDay() || 7;
        const lastMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (day - 1) - 7);
        from = lastMonday;
        to = new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate() + 6, 23, 59, 59);
        label = 'Last week';
        break;
      }
      case 'lastMonth': {
        const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        from = lm;
        to = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
        label = `${MONTH_NAMES[lm.getMonth()]} ${lm.getFullYear()}`;
        break;
      }
      case 'lastQuarter': {
        const q = Math.floor(today.getMonth() / 3) - 1;
        const baseY = q < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const baseQ = q < 0 ? 3 : q;
        from = new Date(baseY, baseQ * 3, 1);
        to = new Date(baseY, baseQ * 3 + 3, 0, 23, 59, 59);
        label = `Q${baseQ + 1} ${baseY}`;
        break;
      }
      case 'lastYear':
        from = new Date(today.getFullYear() - 1, 0, 1);
        to = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59);
        label = `${today.getFullYear() - 1} (full year)`;
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
        // from/to already in STATE; keep
        from = STATE.period.from;
        to = STATE.period.to;
        label = (from ? from.toISOString().slice(0, 10) : '...') + ' → ' + (to ? to.toISOString().slice(0, 10) : '...');
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
    container.innerHTML = `
      <div class="f-group">
        <span class="f-label">Period</span>
        <div class="period-picker">
          <button id="periodTrigger" class="ms-trigger has-value" type="button">📅 Period</button>
          <div class="period-panel" id="periodPanel"></div>
        </div>
      </div>
      <div class="f-group">
        <span class="f-label">Team</span>
        <div class="ms-dropdown" data-filter="team"></div>
      </div>
      <div class="f-group">
        <span class="f-label">User</span>
        <div class="ms-dropdown" data-filter="user"></div>
      </div>
      <div class="f-group">
        <span class="f-label">Pipeline</span>
        <div class="ms-dropdown" data-filter="pipeline"></div>
      </div>
      <div class="f-group">
        <span class="f-label">Deal Type</span>
        <div class="ms-dropdown" data-filter="dealType"></div>
      </div>
      <div class="f-group">
        <span class="f-label">Product Type</span>
        <div class="ms-dropdown" data-filter="productType"></div>
      </div>
      <div class="f-group">
        <span class="f-label">Status</span>
        <div class="ms-dropdown" data-filter="status"></div>
      </div>
      <div class="f-group" style="margin-left:auto;">
        <span class="f-label">&nbsp;</span>
        <button id="resetFiltersBtn" class="btn btn-ghost btn-sm">Reset</button>
      </div>
    `;

    setupPeriodPicker(container, onChange);

    container.querySelector('#resetFiltersBtn').addEventListener('click', () => {
      ['team', 'user', 'pipeline', 'dealType', 'productType', 'status'].forEach(k => STATE[k].clear());
      if (STATE.msHandles.user && STATE.allDeals) {
        const allUsers = Array.from(new Set(STATE.allDeals.map(d => d.responsible).filter(Boolean)))
          .sort((a, b) => String(a).localeCompare(String(b)));
        STATE.msHandles.user.setOptions(allUsers);
      }
      Object.values(STATE.msHandles).forEach(h => h && h.rerender());
      applyPreset('ytd');
      updatePeriodTrigger();
      onChange && onChange();
    });

    applyPreset('ytd');
    updatePeriodTrigger();
    return container;
  }

  function updatePeriodTrigger() {
    const t = document.getElementById('periodTrigger');
    if (!t) return;
    t.textContent = '📅 ' + (STATE.period.label || 'Select period');
  }

  /* ----- Period picker UI ----- */
  function setupPeriodPicker(container, onChange) {
    const trigger = container.querySelector('#periodTrigger');
    const panel = container.querySelector('#periodPanel');
    const today = new Date();
    const baseYear = today.getFullYear();

    function renderPanel() {
      const yp = STATE.period.year || baseYear;
      const presets = [
        { key: 'today', lbl: 'Today' },
        { key: 'thisWeek', lbl: 'This week' },
        { key: 'thisMonth', lbl: 'This month' },
        { key: 'thisQuarter', lbl: 'This quarter' },
        { key: 'ytd', lbl: 'Year-to-date' },
        { key: 'lastWeek', lbl: 'Last week' },
        { key: 'lastMonth', lbl: 'Last month' },
        { key: 'lastQuarter', lbl: 'Last quarter' },
        { key: 'lastYear', lbl: 'Last year' },
        { key: 'all', lbl: 'All time' },
      ];
      const years = [baseYear - 2, baseYear - 1, baseYear, baseYear + 1];
      const fromVal = STATE.period.from ? STATE.period.from.toISOString().slice(0, 10) : '';
      const toVal = STATE.period.to ? STATE.period.to.toISOString().slice(0, 10) : '';

      panel.innerHTML = `
        <div class="pp-section">
          <div class="pp-section-title">Quick presets</div>
          <div class="pp-presets">
            ${presets.map(p => `<button class="pp-btn ${STATE.period.preset === p.key ? 'active' : ''}" data-pp-preset="${p.key}">${p.lbl}</button>`).join('')}
          </div>
        </div>
        <div class="pp-section">
          <div class="pp-section-title">By year</div>
          <div class="pp-years">
            ${years.map(y => `<button class="pp-btn ${STATE.period.preset === 'year' && STATE.period.year === y ? 'active' : ''}" data-pp-year="${y}">${y}</button>`).join('')}
          </div>
          <div class="pp-section-sub">Quarter in ${yp}</div>
          <div class="pp-quarters">
            ${[1,2,3,4].map(q => `<button class="pp-btn ${STATE.period.preset === 'quarter' && STATE.period.year === yp && STATE.period.sub === q ? 'active' : ''}" data-pp-q="${q}" data-pp-y="${yp}">Q${q}</button>`).join('')}
          </div>
          <div class="pp-section-sub">Month in ${yp}</div>
          <div class="pp-months">
            ${MONTH_NAMES.map((m, i) => `<button class="pp-btn ${STATE.period.preset === 'month' && STATE.period.year === yp && STATE.period.sub === i + 1 ? 'active' : ''}" data-pp-m="${i + 1}" data-pp-y="${yp}">${m}</button>`).join('')}
          </div>
        </div>
        <div class="pp-section">
          <div class="pp-section-title">Custom range</div>
          <div class="pp-custom">
            <input type="date" id="ppFrom" class="date-input" value="${fromVal}">
            <span class="pp-arrow">→</span>
            <input type="date" id="ppTo" class="date-input" value="${toVal}">
          </div>
        </div>
      `;

      panel.querySelectorAll('[data-pp-preset]').forEach(b => b.addEventListener('click', () => {
        applyPreset(b.dataset.ppPreset);
        renderPanel();
        updatePeriodTrigger();
        onChange && onChange();
      }));
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
        STATE.period.from = fromEl.value ? new Date(fromEl.value) : null;
        STATE.period.to = toEl.value ? new Date(toEl.value + 'T23:59:59') : null;
        STATE.period.label = (fromEl.value || '...') + ' → ' + (toEl.value || '...');
        renderPanel();
        updatePeriodTrigger();
        onChange && onChange();
      }
      fromEl.addEventListener('change', commitCustom);
      toEl.addEventListener('change', commitCustom);
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = !panel.classList.contains('open');
      document.querySelectorAll('.period-panel.open, .ms-panel.open').forEach(el => el.classList.remove('open'));
      if (opening) {
        renderPanel();
        panel.classList.add('open');
      }
    });
    panel.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => panel.classList.remove('open'));
  }

  /* ----- Re-build multi-select option lists from current data ----- */
  function refreshMultiSelects(deals, onChange) {
    STATE.allDeals = deals;
    function uniques(rows, key) {
      const set = new Set();
      rows.forEach(d => { if (d[key]) set.add(d[key]); });
      return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
    }

    // User options depend on Team selection (cascade)
    function getUserOptions() {
      if (STATE.team.size === 0) return uniques(deals, 'responsible');
      const inTeam = deals.filter(d => STATE.team.has(d.team));
      return uniques(inTeam, 'responsible');
    }

    // Team filter — special: also refresh User options on change
    const teamEl = document.querySelector('[data-filter="team"]');
    STATE.msHandles.team = App.UI.buildMultiSelect(
      teamEl,
      uniques(deals, 'team'),
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

    // Pipeline / Product Type — flat, alphabetical
    [['pipeline', 'pipeline'], ['productType', 'productType']].forEach(([key, field]) => {
      const el = document.querySelector(`[data-filter="${key}"]`);
      if (!el) return;
      STATE.msHandles[key] = App.UI.buildMultiSelect(
        el, uniques(deals, field), STATE[key], () => onChange && onChange()
      );
    });

    // Deal Type — grouped: New (New Sell, Up sell, Cross sell) / Renew (Re-New Same, MACD, Up sell, Decrease) / Other
    const dealTypeEl = document.querySelector('[data-filter="dealType"]');
    if (dealTypeEl) {
      STATE.msHandles.dealType = App.UI.buildMultiSelect(
        dealTypeEl, buildDealTypeOptions(deals), STATE.dealType, () => onChange && onChange()
      );
    }

    // Status (fixed list)
    const statusEl = document.querySelector('[data-filter="status"]');
    if (statusEl) {
      STATE.msHandles.status = App.UI.buildMultiSelect(
        statusEl, ['Won', 'Commit', 'Upside', 'Open', 'Lost'], STATE.status, () => onChange && onChange()
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

  /* ----- Build grouped Deal Type options (preserves intentional order) ----- */
  function buildDealTypeOptions(deals) {
    const present = new Set();
    deals.forEach(d => { if (d.dealType) present.add(d.dealType); });
    const newItems = NEW_TYPES_ORDER.filter(t => present.has(t));
    const renewItems = RENEW_TYPES_ORDER.filter(t => present.has(t));
    const otherItems = Array.from(present)
      .filter(t => !NEW_TYPES.has(t) && !RENEW_TYPES.has(t))
      .sort((a, b) => String(a).localeCompare(String(b)));
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
    open: (d) => d.status === 'Open',
    lost: (d) => d.status === 'Lost',
    closed: (d) => d.status === 'Won' || d.status === 'Lost',
  };

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
    Matchers,
    MONTH_NAMES,
    RENEW_PIPES, RENEW_TYPES, NEW_TYPES,
  };
})();
