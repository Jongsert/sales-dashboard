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
  function applyPreset(preset) {
    const today = new Date();
    let from = null, to = null;
    switch (preset) {
      case 'month':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'quarter': {
        const q = Math.floor(today.getMonth() / 3);
        from = new Date(today.getFullYear(), q * 3, 1);
        to = new Date(today.getFullYear(), q * 3 + 3, 0);
        break;
      }
      case 'year':
        from = new Date(today.getFullYear(), 0, 1);
        to = new Date(today.getFullYear(), 11, 31);
        break;
      case 'all':
        from = null; to = null;
        break;
    }
    STATE.period.preset = preset;
    STATE.period.from = from;
    STATE.period.to = to;
    const fromInput = document.getElementById('dateFrom');
    const toInput = document.getElementById('dateTo');
    if (fromInput) fromInput.value = from ? from.toISOString().slice(0, 10) : '';
    if (toInput) toInput.value = to ? to.toISOString().slice(0, 10) : '';
  }

  /* ----- Build the filter UI inside a container element ----- */
  function build(container, onChange) {
    container.innerHTML = `
      <div class="f-group">
        <span class="f-label">Period</span>
        <div class="preset-group">
          <button class="preset-btn" data-preset="month">Month</button>
          <button class="preset-btn" data-preset="quarter">Quarter</button>
          <button class="preset-btn active" data-preset="year">Year</button>
          <button class="preset-btn" data-preset="all">All</button>
          <button class="preset-btn" data-preset="custom">Custom</button>
        </div>
      </div>
      <div class="f-group" id="customDateGroup" style="display:none">
        <span class="f-label">From — To</span>
        <div style="display:flex; gap:4px;">
          <input type="date" id="dateFrom" class="date-input">
          <input type="date" id="dateTo" class="date-input">
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

    // Period buttons
    container.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const p = btn.dataset.preset;
        const customGroup = container.querySelector('#customDateGroup');
        customGroup.style.display = p === 'custom' ? '' : 'none';
        if (p !== 'custom') applyPreset(p);
        onChange && onChange();
      });
    });

    container.querySelector('#dateFrom').addEventListener('change', e => {
      STATE.period.from = e.target.value ? new Date(e.target.value) : null;
      onChange && onChange();
    });
    container.querySelector('#dateTo').addEventListener('change', e => {
      STATE.period.to = e.target.value ? new Date(e.target.value + 'T23:59:59') : null;
      onChange && onChange();
    });

    container.querySelector('#resetFiltersBtn').addEventListener('click', () => {
      ['team', 'user', 'pipeline', 'dealType', 'productType', 'status'].forEach(k => STATE[k].clear());
      // Restore User dropdown to show ALL users (since team cleared)
      if (STATE.msHandles.user && STATE.allDeals) {
        const allUsers = Array.from(new Set(STATE.allDeals.map(d => d.responsible).filter(Boolean)))
          .sort((a, b) => String(a).localeCompare(String(b)));
        STATE.msHandles.user.setOptions(allUsers);
      }
      Object.values(STATE.msHandles).forEach(h => h && h.rerender());
      container.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === 'year'));
      applyPreset('year');
      container.querySelector('#customDateGroup').style.display = 'none';
      onChange && onChange();
    });

    applyPreset('year');
    return container;
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
