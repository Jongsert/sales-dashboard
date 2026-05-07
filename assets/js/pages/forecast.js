/* ========================================================================
   Page: Forecast — centerpiece for management meeting
   Combines: actual (won) + renewal estimate + sales forecast
   Sections: KPIs, monthly trajectory, cumulative, renewal estimate UI,
   sales forecast input, what-if scenario, detail table.
   ======================================================================== */
(function () {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const COLORS = {
    wonRenew:    '#259b24',
    wonNew:      '#f97316',
    renewEst:    'rgba(37, 155, 36, 0.30)',
    renewEstBd:  '#259b24',
    salesFcst:   'rgba(249, 115, 22, 0.30)',
    salesFcstBd: '#f97316',
    target:      '#2563eb',
    lastYear:    '#94a3b8',
    forecastTotal: '#8b5cf6',
  };

  const STATE = {
    year: new Date().getFullYear(),
    whatIf: {
      enabled: false,
      openRenew: 0.80,
      openNew: 0.40,
      commit: 0.90,
      upside: 0.50,
      salesAdj: 1.00,
    },
  };

  const charts = {};
  function destroyCharts() {
    Object.values(charts).forEach(c => c && c.destroy && c.destroy());
    Object.keys(charts).forEach(k => delete charts[k]);
  }

  function render(container, parsed) {
    destroyCharts();
    if (!parsed || !parsed.deals.length) {
      container.innerHTML = `
        <div class="placeholder-page">
          <div class="icon">🎯</div>
          <h2>Forecast</h2>
          <p>Upload Bitrix data to generate the forecast.</p>
          <button class="btn btn-primary btn-lg" data-action="upload">📥 Upload data</button>
        </div>`;
      container.querySelectorAll('[data-action="upload"]').forEach(b =>
        b.addEventListener('click', () => document.getElementById('fileInput').click())
      );
      return;
    }

    const settings = App.Settings.load();
    const deals = App.Filters.dashboardScope(App.Filters.apply(parsed.deals, { skipUserTeam: false }));
    const monthly = computeMonthly(STATE.year, deals, settings);
    const yearTotals = computeYearTotals(monthly);

    const yearOptions = [STATE.year - 2, STATE.year - 1, STATE.year, STATE.year + 1, STATE.year + 2];

    container.innerHTML = `
      <div class="section-title">
        Forecast — Year ${STATE.year}
        <span class="actions">
          <select id="forecastYear" class="select-input" style="font-weight:600;">
            ${yearOptions.map(y => `<option value="${y}" ${y === STATE.year ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <button class="btn btn-sm" id="forecastPrintBtn">🖨️ Print</button>
        </span>
      </div>

      <div class="kpi-grid" id="forecastKpis"></div>

      <div class="section-title">Monthly Trajectory — Won + Pipeline Forecast vs Target</div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Stacked: Actual + Forecast components</div>
            <div class="card-subtitle">เห็น Won (สี solid), Forecast (สี dashed), Target (เส้น), YoY (เส้น dashed)</div>
          </div>
          <div class="legend-row">
            <span class="legend-item"><span class="legend-swatch" style="background:${COLORS.wonRenew}"></span>Won Renew</span>
            <span class="legend-item"><span class="legend-swatch" style="background:${COLORS.wonNew}"></span>Won New</span>
            <span class="legend-item"><span class="legend-swatch" style="background:${COLORS.renewEst}; border:1px dashed ${COLORS.renewEstBd}"></span>Renewal Est.</span>
            <span class="legend-item"><span class="legend-swatch" style="background:${COLORS.salesFcst}; border:1px dashed ${COLORS.salesFcstBd}"></span>Sales Forecast</span>
            <span class="legend-item"><span class="legend-swatch" style="background:${COLORS.target}; height:3px;"></span>Target</span>
            <span class="legend-item"><span class="legend-swatch dashed"></span>${STATE.year - 1} Actual</span>
          </div>
        </div>
        <div class="chart-canvas-tall"><canvas id="forecastMonthlyChart"></canvas></div>
      </div>

      <div class="section-title">Cumulative Trajectory — สะสมทั้งปี</div>
      <div class="card">
        <div class="chart-canvas-tall"><canvas id="forecastCumulativeChart"></canvas></div>
      </div>

      <div class="section-title">Renewal Estimate Settings</div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🔄 Renewal Estimate = Open Renew × Multiplier</div>
            <div class="card-subtitle">ปรับ multiplier ทั้งปี หรือต่อเดือน · กด Skip ถ้าเดือนไหน renew ปิดหมดแล้ว</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <span style="font-size:12px; color:var(--text-muted);">Default multiplier:</span>
            <input id="renewMultiplier" type="number" min="0" max="200" step="5" value="${Math.round((settings.renewalEstimate[STATE.year]?.multiplier ?? 0.8) * 100)}" class="select-input" style="width:80px; text-align:right;"> %
            <button class="btn btn-sm" id="applyMultiplierBtn">Apply to all</button>
          </div>
        </div>
        <div id="renewEstTable"></div>
      </div>

      <div class="section-title">Sales Forecast — manual input per user × month</div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">✨ Sales Forecast (New Sell)</div>
            <div class="card-subtitle">Type predicted New Sell value per user per month · auto-saves on change</div>
          </div>
        </div>
        <div class="targets-wrap" style="max-height: 50vh;">
          <table class="targets-tbl" id="salesForecastTable"></table>
        </div>
      </div>

      <div class="section-title">
        What-if Scenario Analysis
        <span class="actions">
          <label class="toggle">
            <input type="checkbox" id="whatIfToggle" ${STATE.whatIf.enabled ? 'checked' : ''}>
            <span>Apply to charts &amp; KPIs</span>
          </label>
        </span>
      </div>
      <div class="card">
        <div class="whatif-grid">
          <div id="whatIfSliders"></div>
          <div>
            <div style="font-size:11px; color: var(--text-muted); margin-bottom:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Projected Year-End Revenue</div>
            <div class="scenario-grid" id="scenarioGrid"></div>
            <div id="gapAnalysis" style="margin-top:14px; padding:12px; background: var(--surface-2); border-radius: var(--radius-sm); font-size:12px;"></div>
          </div>
        </div>
      </div>

      <div class="section-title">
        Forecast Detail Table
        <span class="actions">
          <button class="btn btn-sm" id="exportForecastBtn">⬇️ Export CSV</button>
        </span>
      </div>
      <div class="card">
        <div style="overflow:auto; max-height: 70vh; border:1px solid var(--border); border-radius: var(--radius-sm);">
          <table class="forecast-detail-tbl" id="forecastDetailTable"></table>
        </div>
      </div>
    `;

    renderKPIs(yearTotals, parsed.deals, settings);
    renderMonthlyChart(monthly);
    renderCumulativeChart(monthly);
    renderRenewEstimateTable(monthly, settings);
    renderSalesForecastTable(settings);
    renderWhatIf(monthly, settings);
    renderDetailTable(monthly);

    // Wire controls
    document.getElementById('forecastYear').addEventListener('change', e => {
      STATE.year = parseInt(e.target.value);
      render(container, parsed);
    });
    document.getElementById('forecastPrintBtn').addEventListener('click', () => window.print());
    document.getElementById('renewMultiplier').addEventListener('change', e => {
      App.Settings.setRenewalEstimateMultiplier(STATE.year, (parseFloat(e.target.value) || 0) / 100);
      render(container, parsed);
    });
    document.getElementById('applyMultiplierBtn').addEventListener('click', () => {
      App.UI.confirm('Apply current multiplier to all months (clears all per-month overrides)?', () => {
        const s = App.Settings.load();
        if (s.renewalEstimate[STATE.year]) s.renewalEstimate[STATE.year].monthOverrides = {};
        App.Settings.save();
        render(container, parsed);
        App.UI.toast('Multiplier applied to all months', 'success');
      });
    });
    document.getElementById('whatIfToggle').addEventListener('change', e => {
      STATE.whatIf.enabled = e.target.checked;
      render(container, parsed);
    });
    document.getElementById('exportForecastBtn').addEventListener('click', () => exportCSV(monthly));
  }

  /* ----- Data computation ----- */
  function computeMonthly(year, deals, settings) {
    const Matchers = App.Filters.Matchers;
    const NEW_TYPES = App.Filters.NEW_TYPES;

    const months = new Array(12).fill(0).map((_, m) => ({
      month: m + 1,
      label: MONTHS[m],
      actualRenew: 0, actualNew: 0,
      lostRenew: 0,   lostNew: 0,
      openRenew: 0,   openNew: 0,
      commitRenew: 0, commitNew: 0,
      upsideRenew: 0, upsideNew: 0,
      renewTarget: 0, newTarget: 0,
      salesForecast: 0,
      lastYearActual: 0,
    }));

    deals.forEach(d => {
      if (!d.expectedClose) return;
      const dy = d.expectedClose.getFullYear();
      const dm = d.expectedClose.getMonth();
      const isRenew = Matchers.isRenew(d);
      const isNew = NEW_TYPES.has(d.dealType);
      if (!isRenew && !isNew) return;

      if (dy === year) {
        const m = months[dm];
        if (isRenew) m.renewTarget += d.renewTarget || 0;
        const status = d.status;
        if (isRenew) {
          if (status === 'Won')    m.actualRenew  += d.income;
          else if (status === 'Lost')   m.lostRenew    += d.income;
          else if (status === 'Open')   m.openRenew    += d.income;
          else if (status === 'Commit') m.commitRenew  += d.income;
          else if (status === 'Upside') m.upsideRenew  += d.income;
        }
        if (isNew) {
          if (status === 'Won')    m.actualNew  += d.income;
          else if (status === 'Lost')   m.lostNew    += d.income;
          else if (status === 'Open')   m.openNew    += d.income;
          else if (status === 'Commit') m.commitNew  += d.income;
          else if (status === 'Upside') m.upsideNew  += d.income;
        }
      } else if (dy === year - 1 && d.status === 'Won') {
        months[dm].lastYearActual += d.income;
      }
    });

    // Manual targets / forecast — apply user/team filter
    const usersList = settings.users || [];
    const F = App.Filters.STATE;
    const userTeam = {};
    usersList.forEach(u => userTeam[u.name] = u.team || 'Unassigned');

    function userPasses(userName) {
      if (F.user.size && !F.user.has(userName)) return false;
      if (F.team.size && !F.team.has(userTeam[userName] || 'Unassigned')) return false;
      return true;
    }

    const newTargets = settings.newSellTargets[year] || {};
    Object.entries(newTargets).forEach(([userName, arr]) => {
      if (!userPasses(userName) || !Array.isArray(arr)) return;
      arr.forEach((v, m) => { months[m].newTarget += v || 0; });
    });

    const salesFcst = settings.salesForecast[year] || {};
    Object.entries(salesFcst).forEach(([userName, arr]) => {
      if (!userPasses(userName) || !Array.isArray(arr)) return;
      arr.forEach((v, m) => { months[m].salesForecast += v || 0; });
    });

    // Renewal estimate
    const renewEst = settings.renewalEstimate[year] || {};
    const defaultMult = renewEst.multiplier !== undefined ? renewEst.multiplier : 0.8;
    const overrides = renewEst.monthOverrides || {};

    months.forEach((m, i) => {
      const o = overrides[i + 1];
      const skipped = !!(o && o.skip);
      const mult = skipped ? 0 : (o && o.multiplier !== undefined ? o.multiplier : defaultMult);
      m.renewalMultiplier = mult;
      m.skipped = skipped;
      m.renewalEstimate = m.openRenew * mult;
    });

    // What-if override
    if (STATE.whatIf.enabled) {
      const w = STATE.whatIf;
      months.forEach(m => {
        m.renewalEstimate = m.openRenew * w.openRenew + m.commitRenew * w.commit + m.upsideRenew * w.upside;
        m.salesForecast = m.salesForecast * w.salesAdj + (m.openNew * w.openNew);
      });
    }

    // Composite metrics
    months.forEach(m => {
      m.totalTarget = m.renewTarget + m.newTarget;
      m.actualRevenue = m.actualRenew + m.actualNew;
      m.forecastRevenue = m.actualRevenue + m.renewalEstimate + m.salesForecast;
    });

    return months;
  }

  function computeYearTotals(monthly) {
    const t = {
      renewTarget: 0, newTarget: 0, totalTarget: 0,
      actualRenew: 0, actualNew: 0, actualRevenue: 0,
      renewalEstimate: 0, salesForecast: 0,
      forecastRevenue: 0,
      lastYearActual: 0,
      openRenew: 0, openNew: 0,
      commitRenew: 0, commitNew: 0,
      upsideRenew: 0, upsideNew: 0,
    };
    monthly.forEach(m => {
      Object.keys(t).forEach(k => { if (m[k] !== undefined) t[k] += m[k]; });
    });
    return t;
  }

  /* ----- KPIs ----- */
  function renderKPIs(t, allDeals, settings) {
    const fmt = App.UI.fmt;
    const F = App.Filters;
    // YTD: months up to today
    const today = new Date();
    const isCurrentYear = STATE.year === today.getFullYear();
    const ytdMonth = isCurrentYear ? today.getMonth() + 1 : 12;

    const totalAchieve = t.totalTarget > 0 ? t.actualRevenue / t.totalTarget : 0;
    const forecastAchieve = t.totalTarget > 0 ? t.forecastRevenue / t.totalTarget : 0;
    const yoy = t.lastYearActual > 0 ? (t.actualRevenue - t.lastYearActual) / t.lastYearActual : 0;

    const cards = [
      { cls: 'target', primary: true, icon: '🎯', label: 'Total Target',
        value: fmt.THBFull(t.totalTarget),
        sub: `Renew ${fmt.THB(t.renewTarget)} + New ${fmt.THB(t.newTarget)}`, },
      { cls: 'won', primary: true, icon: '🏆', label: 'Actual Revenue (YTD)',
        value: fmt.THBFull(t.actualRevenue),
        sub: `${fmt.pct(totalAchieve)} of target through ${MONTHS[ytdMonth - 1]} ${STATE.year}` },
      { cls: 'commit', primary: true, icon: '🔮', label: 'Forecast Revenue (Year)',
        value: fmt.THBFull(t.forecastRevenue),
        sub: `${fmt.pct(forecastAchieve)} of target · ${STATE.whatIf.enabled ? 'What-if applied' : 'using default 80%'}` },
      { cls: 'upside', primary: true, icon: '📊', label: `YoY vs ${STATE.year - 1}`,
        value: (yoy >= 0 ? '+' : '') + fmt.pct(yoy),
        sub: `${STATE.year - 1} actual ${fmt.THB(t.lastYearActual)} ▶ ${STATE.year} ${fmt.THB(t.actualRevenue)}` },
    ];
    document.getElementById('forecastKpis').innerHTML = cards.map(k => `
      <div class="kpi-card ${k.cls}${k.primary ? ' kpi-primary' : ''}">
        <div class="kpi-label"><span>${k.icon}</span>${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-meta"><span>${k.sub}</span></div>
      </div>`).join('');
  }

  /* ----- Monthly chart ----- */
  function renderMonthlyChart(monthly) {
    const ctx = document.getElementById('forecastMonthlyChart').getContext('2d');
    charts.monthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthly.map(m => `${m.label} ${String(STATE.year).slice(2)}`),
        datasets: [
          { type: 'line', label: 'Total Target', data: monthly.map(m => m.totalTarget),
            borderColor: COLORS.target, backgroundColor: 'transparent', borderWidth: 2.5,
            pointRadius: 4, pointBackgroundColor: COLORS.target, tension: 0.25, order: 0,
            datalabels: { display: false } },
          { type: 'line', label: `${STATE.year - 1} Actual`, data: monthly.map(m => m.lastYearActual),
            borderColor: COLORS.lastYear, backgroundColor: 'transparent', borderWidth: 2,
            borderDash: [6, 4], pointRadius: 0, tension: 0.25, order: 0,
            datalabels: { display: false } },
          { type: 'bar', label: 'Won Renew', data: monthly.map(m => m.actualRenew),
            backgroundColor: COLORS.wonRenew, stack: 'A', order: 5, datalabels: { display: false } },
          { type: 'bar', label: 'Won New', data: monthly.map(m => m.actualNew),
            backgroundColor: COLORS.wonNew, stack: 'A', order: 5, datalabels: { display: false } },
          { type: 'bar', label: 'Renewal Est.', data: monthly.map(m => m.renewalEstimate),
            backgroundColor: COLORS.renewEst, borderColor: COLORS.renewEstBd, borderWidth: 1.5,
            borderDash: [4, 3], stack: 'A', order: 5, datalabels: { display: false } },
          { type: 'bar', label: 'Sales Forecast', data: monthly.map(m => m.salesForecast),
            backgroundColor: COLORS.salesFcst, borderColor: COLORS.salesFcstBd, borderWidth: 1.5,
            borderDash: [4, 3], stack: 'A', order: 5,
            datalabels: {
              display: ctx => monthly[ctx.dataIndex].totalTarget > 0,
              align: 'end', anchor: 'end', offset: -2, color: '#0f172a',
              font: { size: 9, weight: 'bold' },
              formatter: (val, ctx) => {
                const m = monthly[ctx.dataIndex];
                const total = m.forecastRevenue;
                if (total === 0) return '';
                return m.totalTarget > 0 ? `${(total / m.totalTarget * 100).toFixed(0)}%` : '';
              },
            },
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: c => `${c.dataset.label}: ${App.UI.fmt.THBExact(c.parsed.y)}` },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: v => App.UI.fmt.THB(v) }, grid: { color: '#f1f5f9' } },
        },
      },
    });
  }

  /* ----- Cumulative chart ----- */
  function renderCumulativeChart(monthly) {
    const accu = arr => arr.reduce((acc, v, i) => { acc.push((acc[i - 1] || 0) + v); return acc; }, []);
    const accuTarget = accu(monthly.map(m => m.totalTarget));
    const accuActual = accu(monthly.map(m => m.actualRevenue));
    const accuForecast = accu(monthly.map(m => m.forecastRevenue));
    const accuLY = accu(monthly.map(m => m.lastYearActual));

    const today = new Date();
    const isCurrentYear = STATE.year === today.getFullYear();
    const ytdMonth = isCurrentYear ? today.getMonth() + 1 : 12;

    const ctx = document.getElementById('forecastCumulativeChart').getContext('2d');
    charts.cumulative = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthly.map(m => `${m.label} ${String(STATE.year).slice(2)}`),
        datasets: [
          { label: 'Accu Target', data: accuTarget,
            borderColor: COLORS.target, borderWidth: 2.5, pointRadius: 3, tension: 0.2,
            backgroundColor: 'transparent', datalabels: { display: false } },
          { label: 'Accu Forecast', data: accuForecast,
            borderColor: COLORS.forecastTotal, backgroundColor: 'rgba(139,92,246,0.10)',
            borderWidth: 2, fill: '+1', borderDash: [3, 3], pointRadius: 3, tension: 0.2,
            datalabels: { display: false } },
          { label: 'Accu Actual (Won)',
            data: accuActual.map((v, i) => i < ytdMonth ? v : null),
            borderColor: COLORS.wonRenew, backgroundColor: 'rgba(37,155,36,0.20)',
            borderWidth: 3, fill: 'origin', pointRadius: 4, tension: 0.2, spanGaps: true,
            datalabels: { display: false } },
          { label: `Accu ${STATE.year - 1}`, data: accuLY,
            borderColor: COLORS.lastYear, borderDash: [6, 4], borderWidth: 2,
            pointRadius: 0, fill: false, tension: 0.2, datalabels: { display: false } },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', align: 'end', labels: { font: { size: 11 }, usePointStyle: true } },
          tooltip: {
            mode: 'index', intersect: false,
            callbacks: { label: c => c.parsed.y === null ? '' : `${c.dataset.label}: ${App.UI.fmt.THBExact(c.parsed.y)}` },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { ticks: { callback: v => App.UI.fmt.THB(v) }, grid: { color: '#f1f5f9' } },
        },
      },
    });
  }

  /* ----- Renewal Estimate table ----- */
  function renderRenewEstimateTable(monthly, settings) {
    const renewEst = settings.renewalEstimate[STATE.year] || {};
    const defaultMult = renewEst.multiplier !== undefined ? renewEst.multiplier : 0.8;
    const overrides = renewEst.monthOverrides || {};
    let totalEst = 0;
    monthly.forEach(m => totalEst += m.renewalEstimate);

    const html = `
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:90px;">Month</th>
            <th class="num" style="width:160px;">Open Renew</th>
            <th class="num" style="width:140px;">Multiplier</th>
            <th style="width:80px; text-align:center;">Skip</th>
            <th class="num" style="width:160px;">Estimate</th>
          </tr>
        </thead>
        <tbody>
          ${monthly.map((m, i) => {
            const month = i + 1;
            const o = overrides[month];
            const isOverridden = o && o.multiplier !== undefined;
            const skipped = !!(o && o.skip);
            const dispMult = skipped ? 0 : (isOverridden ? o.multiplier : defaultMult);
            return `
              <tr ${skipped ? 'style="opacity:0.55;"' : ''}>
                <td><strong>${m.label} ${String(STATE.year).slice(2)}</strong></td>
                <td class="num">${App.UI.fmt.comma(m.openRenew)}</td>
                <td>
                  <input type="number" class="select-input" min="0" max="200" step="5"
                    data-month-mult="${month}"
                    value="${Math.round(dispMult * 100)}"
                    style="width:70px; text-align:right; ${skipped ? 'pointer-events:none;' : ''}">
                  %
                  ${isOverridden && !skipped ? `<button class="btn btn-ghost btn-sm" data-clear-mult="${month}" style="padding:2px 6px;" title="Reset to default">×</button>` : ''}
                </td>
                <td style="text-align:center;">
                  <input type="checkbox" data-skip-month="${month}" ${skipped ? 'checked' : ''}>
                </td>
                <td class="num"><strong>${App.UI.fmt.comma(m.renewalEstimate)}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight:700;">
            <td colspan="4">Total Renewal Estimate</td>
            <td class="num" style="color: var(--won);">${App.UI.fmt.THBFull(totalEst)}</td>
          </tr>
        </tfoot>
      </table>
    `;
    document.getElementById('renewEstTable').innerHTML = html;

    // Wire handlers
    document.querySelectorAll('[data-month-mult]').forEach(inp => {
      inp.addEventListener('change', () => {
        const month = parseInt(inp.dataset.monthMult);
        const mult = (parseFloat(inp.value) || 0) / 100;
        const s = App.Settings.load();
        if (!s.renewalEstimate[STATE.year]) s.renewalEstimate[STATE.year] = { multiplier: 0.8, monthOverrides: {} };
        s.renewalEstimate[STATE.year].monthOverrides[month] = { multiplier: mult };
        App.Settings.save();
        const container = document.getElementById('main');
        render(container, App.STATE.parsed);
      });
    });
    document.querySelectorAll('[data-skip-month]').forEach(cb => {
      cb.addEventListener('change', () => {
        const month = parseInt(cb.dataset.skipMonth);
        App.Settings.setRenewalEstimateMonthOverride(STATE.year, month, cb.checked ? { skip: true } : null);
        const container = document.getElementById('main');
        render(container, App.STATE.parsed);
      });
    });
    document.querySelectorAll('[data-clear-mult]').forEach(btn => {
      btn.addEventListener('click', () => {
        const month = parseInt(btn.dataset.clearMult);
        App.Settings.setRenewalEstimateMonthOverride(STATE.year, month, null);
        const container = document.getElementById('main');
        render(container, App.STATE.parsed);
      });
    });
  }

  /* ----- Sales Forecast table ----- */
  function renderSalesForecastTable(settings) {
    const users = (settings.users || []).filter(u => u.active !== false);
    const teams = settings.teams || [];
    const F = App.Filters.STATE;
    const userTeamMap = {};
    users.forEach(u => userTeamMap[u.name] = u.team || 'Unassigned');

    function userPasses(name) {
      if (F.user.size && !F.user.has(name)) return false;
      if (F.team.size && !F.team.has(userTeamMap[name] || 'Unassigned')) return false;
      return true;
    }

    const visibleUsers = users.filter(u => userPasses(u.name));
    const grouped = {};
    visibleUsers.forEach(u => {
      const t = u.team || 'Unassigned';
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(u);
    });
    const teamNames = Object.keys(grouped);

    const monthTotals = new Array(12).fill(0);
    let grandTotal = 0;

    let body = '';
    teamNames.forEach(teamName => {
      const teamObj = teams.find(t => t.name === teamName);
      const teamColor = teamObj ? teamObj.color : '#94a3b8';
      const teamUsers = grouped[teamName];
      const teamMonthTotals = new Array(12).fill(0);
      let teamSum = 0;

      body += `<tr class="team-row">
        <td class="team-banner-name" colspan="2">
          <span class="team-color-dot-bn" style="background:${teamColor};"></span>
          <strong>${escapeHtml(teamName)}</strong>
        </td>
        <td class="team-banner-spacer" colspan="12"></td>
      </tr>`;

      teamUsers.forEach(u => {
        let userTotal = 0;
        let cells = '';
        for (let m = 0; m < 12; m++) {
          const val = App.Settings.getSalesForecast(STATE.year, u.name, m + 1);
          userTotal += val;
          teamMonthTotals[m] += val;
          monthTotals[m] += val;
          const display = val ? App.UI.fmt.comma(val) : '';
          cells += `<td class="input-cell"><input type="text" class="target-cell sf-cell"
            data-user="${escapeAttr(u.name)}" data-month="${m + 1}" data-raw="${val}"
            value="${display}" placeholder="0" inputmode="decimal"></td>`;
        }
        teamSum += userTotal;
        grandTotal += userTotal;
        body += `<tr><td>${escapeHtml(u.name)}</td>${cells}<td class="num user-total">${App.UI.fmt.comma(userTotal)}</td></tr>`;
      });

      body += `<tr class="team-total">
        <td>${escapeHtml(teamName)} subtotal</td>
        ${teamMonthTotals.map(v => `<td class="num">${App.UI.fmt.comma(v)}</td>`).join('')}
        <td class="num" style="background:${teamColor}30;">${App.UI.fmt.comma(teamSum)}</td>
      </tr>`;
    });

    const colgroup = `<colgroup>
      <col style="width:180px;">
      ${MONTHS.map(() => '<col style="width:110px;">').join('')}
      <col style="width:140px;">
    </colgroup>`;
    const head = `<thead><tr>
      <th>User</th>${MONTHS.map(m => `<th class="num">${m}</th>`).join('')}<th class="num">Year Total</th>
    </tr></thead>`;
    const foot = `<tfoot><tr class="grand-total">
      <td>All total</td>
      ${monthTotals.map(v => `<td class="num">${App.UI.fmt.comma(v)}</td>`).join('')}
      <td class="num" style="background: var(--primary-light); color: var(--primary-dark);">${App.UI.fmt.comma(grandTotal)}</td>
    </tr></tfoot>`;

    document.getElementById('salesForecastTable').innerHTML = colgroup + head + '<tbody>' + body + '</tbody>' + foot;

    document.querySelectorAll('.sf-cell').forEach(inp => {
      inp.addEventListener('focus', () => {
        inp.value = inp.dataset.raw === '0' ? '' : inp.dataset.raw;
        inp.select();
      });
      inp.addEventListener('blur', () => {
        const v = parseFloat(inp.value.replace(/,/g, '')) || 0;
        inp.dataset.raw = v;
        inp.value = v ? App.UI.fmt.comma(v) : '';
      });
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value.replace(/,/g, '')) || 0;
        App.Settings.setSalesForecast(STATE.year, inp.dataset.user, parseInt(inp.dataset.month), v);
        const container = document.getElementById('main');
        render(container, App.STATE.parsed);
      });
    });
  }

  /* ----- What-if scenario ----- */
  function renderWhatIf(monthly, settings) {
    const w = STATE.whatIf;
    const sliders = [
      { key: 'openRenew', label: 'Open Renew → Won', sub: 'โอกาสปิดดีลที่อยู่ใน Renew pipeline', min: 0, max: 100, val: w.openRenew * 100 },
      { key: 'openNew',   label: 'Open New → Won',   sub: 'โอกาสปิดดีลใหม่ที่กำลังคุย',         min: 0, max: 100, val: w.openNew * 100 },
      { key: 'commit',    label: 'Commit → Won',     sub: 'Stage = Commit (ตกลงแล้วรอเซ็น)',  min: 0, max: 100, val: w.commit * 100 },
      { key: 'upside',    label: 'Upside → Won',     sub: 'Stage = Upside (มีโอกาสแต่ยังไม่แน่)', min: 0, max: 100, val: w.upside * 100 },
      { key: 'salesAdj',  label: 'Sales Forecast adj', sub: 'ปรับยอด New Sell ที่กรอกไว้',       min: 50, max: 150, val: w.salesAdj * 100 },
    ];
    document.getElementById('whatIfSliders').innerHTML = sliders.map(s => `
      <div class="slider-row">
        <div class="slider-label">${s.label}<small>${s.sub}</small></div>
        <input type="range" class="slider" data-w="${s.key}" min="${s.min}" max="${s.max}" value="${s.val}">
        <div class="slider-value" data-w-val="${s.key}">${Math.round(s.val)}%</div>
      </div>
    `).join('');

    // Compute three scenarios
    const totals = computeYearTotals(monthly);
    const target = totals.totalTarget || 1;

    // Pessimistic: lower confidence
    const pess = scenarioRevenue(monthly, settings, { openRenew: 0.5, openNew: 0.2, commit: 0.7, upside: 0.2, salesAdj: 0.7 });
    // Likely: current settings
    const likely = scenarioRevenue(monthly, settings, w);
    // Optimistic: high confidence
    const opt = scenarioRevenue(monthly, settings, { openRenew: 1.0, openNew: 0.7, commit: 1.0, upside: 0.85, salesAdj: 1.2 });

    const grid = document.getElementById('scenarioGrid');
    const fmt = App.UI.fmt;
    grid.innerHTML = `
      <div class="scenario-card">
        <div class="s-label">Pessimistic</div>
        <div class="s-value">${fmt.THB(pess)}</div>
        <div class="s-pct">${fmt.pct(pess / target)}</div>
      </div>
      <div class="scenario-card likely">
        <div class="s-label">Likely</div>
        <div class="s-value">${fmt.THB(likely)}</div>
        <div class="s-pct">${fmt.pct(likely / target)}</div>
      </div>
      <div class="scenario-card">
        <div class="s-label">Optimistic</div>
        <div class="s-value">${fmt.THB(opt)}</div>
        <div class="s-pct">${fmt.pct(opt / target)}</div>
      </div>
    `;

    const gap = totals.totalTarget - likely;
    const gapEl = document.getElementById('gapAnalysis');
    if (totals.totalTarget > 0) {
      gapEl.innerHTML = `
        <strong>Gap analysis:</strong> Likely scenario ${gap >= 0 ? 'ขาด target' : 'เกิน target'} <b>${fmt.THBFull(Math.abs(gap))} (${fmt.pct(Math.abs(gap) / totals.totalTarget)})</b><br>
        <span style="color:var(--text-muted);">Open Renew ${fmt.THB(totals.openRenew)} · Open New ${fmt.THB(totals.openNew)} · Commit ${fmt.THB(totals.commitRenew + totals.commitNew)} · Upside ${fmt.THB(totals.upsideRenew + totals.upsideNew)}</span>
      `;
    } else {
      gapEl.textContent = 'ใส่ Total Target เพื่อดู gap analysis';
    }

    document.querySelectorAll('[data-w]').forEach(inp => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.w;
        const val = parseFloat(inp.value);
        document.querySelector(`[data-w-val="${key}"]`).textContent = Math.round(val) + '%';
        STATE.whatIf[key] = val / 100;
        // Re-render scenarios live without full page re-render
        const settings = App.Settings.load();
        const newPess = scenarioRevenue(monthly, settings, { openRenew: 0.5, openNew: 0.2, commit: 0.7, upside: 0.2, salesAdj: 0.7 });
        const newLikely = scenarioRevenue(monthly, settings, STATE.whatIf);
        const newOpt = scenarioRevenue(monthly, settings, { openRenew: 1.0, openNew: 0.7, commit: 1.0, upside: 0.85, salesAdj: 1.2 });
        const t = totals.totalTarget || 1;
        document.getElementById('scenarioGrid').innerHTML = `
          <div class="scenario-card"><div class="s-label">Pessimistic</div><div class="s-value">${fmt.THB(newPess)}</div><div class="s-pct">${fmt.pct(newPess / t)}</div></div>
          <div class="scenario-card likely"><div class="s-label">Likely</div><div class="s-value">${fmt.THB(newLikely)}</div><div class="s-pct">${fmt.pct(newLikely / t)}</div></div>
          <div class="scenario-card"><div class="s-label">Optimistic</div><div class="s-value">${fmt.THB(newOpt)}</div><div class="s-pct">${fmt.pct(newOpt / t)}</div></div>
        `;
        const newGap = totals.totalTarget - newLikely;
        if (totals.totalTarget > 0) {
          gapEl.innerHTML = `
            <strong>Gap analysis:</strong> Likely scenario ${newGap >= 0 ? 'ขาด target' : 'เกิน target'} <b>${fmt.THBFull(Math.abs(newGap))} (${fmt.pct(Math.abs(newGap) / totals.totalTarget)})</b><br>
            <span style="color:var(--text-muted);">Open Renew ${fmt.THB(totals.openRenew)} · Open New ${fmt.THB(totals.openNew)} · Commit ${fmt.THB(totals.commitRenew + totals.commitNew)} · Upside ${fmt.THB(totals.upsideRenew + totals.upsideNew)}</span>
          `;
        }
      });
    });
  }

  function scenarioRevenue(monthly, settings, w) {
    let total = 0;
    monthly.forEach(m => {
      total += m.actualRevenue;
      total += m.openRenew * w.openRenew + m.openNew * w.openNew;
      total += m.commitRenew * w.commit + m.commitNew * w.commit;
      total += m.upsideRenew * w.upside + m.upsideNew * w.upside;
      total += m.salesForecast * w.salesAdj;
    });
    return total;
  }

  /* ----- Forecast Detail Table (26 cols compressed) ----- */
  function renderDetailTable(monthly) {
    const fmt = App.UI.fmt;
    const accu = arr => arr.reduce((acc, v, i) => { acc.push((acc[i - 1] || 0) + v); return acc; }, []);
    const accuRT = accu(monthly.map(m => m.renewTarget));
    const accuNT = accu(monthly.map(m => m.newTarget));
    const accuTT = accu(monthly.map(m => m.totalTarget));
    const accuAR = accu(monthly.map(m => m.actualRenew));
    const accuAN = accu(monthly.map(m => m.actualNew));
    const accuRev = accu(monthly.map(m => m.actualRevenue));
    const accuFR = accu(monthly.map(m => m.forecastRevenue));
    const totals = computeYearTotals(monthly);

    const head = `<thead>
      <tr>
        <th>Month</th>
        <th class="num">Renew Tgt</th><th class="num">Accu</th>
        <th class="num col-divider">New Tgt</th><th class="num">Accu</th>
        <th class="num col-divider">Total Tgt</th><th class="num">Accu</th>
        <th class="num col-divider">Actual Renew</th><th class="num">%</th><th class="num">Accu</th>
        <th class="num col-divider">Actual New</th><th class="num">%</th><th class="num">Accu</th>
        <th class="num col-divider">Actual Total</th><th class="num">Accu</th>
        <th class="num col-divider">Renewal Est.</th><th class="num">Sales Fcst</th>
        <th class="num col-divider">Forecast Rev.</th><th class="num">Accu</th><th class="num">%</th>
        <th class="num col-divider">Achieve %</th>
        <th class="num col-divider">YoY</th><th class="num">%Change</th>
      </tr>
    </thead>`;

    const body = '<tbody>' + monthly.map((m, i) => {
      const yoy = m.actualRevenue > 0 ? m.actualRevenue - m.lastYearActual : null;
      return `<tr>
        <td><strong>${m.label} ${String(STATE.year).slice(2)}</strong></td>
        <td class="num">${fmt.comma(m.renewTarget)}</td>
        <td class="num">${fmt.comma(accuRT[i])}</td>
        <td class="num col-divider">${fmt.comma(m.newTarget)}</td>
        <td class="num">${fmt.comma(accuNT[i])}</td>
        <td class="num col-divider"><strong>${fmt.comma(m.totalTarget)}</strong></td>
        <td class="num">${fmt.comma(accuTT[i])}</td>
        <td class="num col-divider">${fmt.comma(m.actualRenew)}</td>
        <td class="num">${m.renewTarget > 0 ? fmt.pct(m.actualRenew / m.renewTarget) : '—'}</td>
        <td class="num">${fmt.comma(accuAR[i])}</td>
        <td class="num col-divider">${fmt.comma(m.actualNew)}</td>
        <td class="num">${m.newTarget > 0 ? fmt.pct(m.actualNew / m.newTarget) : '—'}</td>
        <td class="num">${fmt.comma(accuAN[i])}</td>
        <td class="num col-divider"><strong>${fmt.comma(m.actualRevenue)}</strong></td>
        <td class="num">${fmt.comma(accuRev[i])}</td>
        <td class="num col-divider">${fmt.comma(m.renewalEstimate)}</td>
        <td class="num">${fmt.comma(m.salesForecast)}</td>
        <td class="num col-divider"><strong>${fmt.comma(m.forecastRevenue)}</strong></td>
        <td class="num">${fmt.comma(accuFR[i])}</td>
        <td class="num">${m.totalTarget > 0 ? fmt.pct(m.forecastRevenue / m.totalTarget) : '—'}</td>
        <td class="num col-divider">${m.totalTarget > 0 ? fmt.pct(m.actualRevenue / m.totalTarget) : '—'}</td>
        <td class="num col-divider">${yoy !== null ? fmt.comma(yoy) : '—'}</td>
        <td class="num">${m.lastYearActual > 0 && yoy !== null ? fmt.pct(yoy / m.lastYearActual) : '—'}</td>
      </tr>`;
    }).join('') + '</tbody>';

    const foot = `<tfoot><tr class="grand-total">
      <td>Total</td>
      <td class="num">${fmt.comma(totals.renewTarget)}</td><td class="num">—</td>
      <td class="num col-divider">${fmt.comma(totals.newTarget)}</td><td class="num">—</td>
      <td class="num col-divider">${fmt.comma(totals.totalTarget)}</td><td class="num">—</td>
      <td class="num col-divider">${fmt.comma(totals.actualRenew)}</td>
      <td class="num">${totals.renewTarget > 0 ? fmt.pct(totals.actualRenew / totals.renewTarget) : '—'}</td>
      <td class="num">—</td>
      <td class="num col-divider">${fmt.comma(totals.actualNew)}</td>
      <td class="num">${totals.newTarget > 0 ? fmt.pct(totals.actualNew / totals.newTarget) : '—'}</td>
      <td class="num">—</td>
      <td class="num col-divider">${fmt.comma(totals.actualRevenue)}</td><td class="num">—</td>
      <td class="num col-divider">${fmt.comma(totals.renewalEstimate)}</td>
      <td class="num">${fmt.comma(totals.salesForecast)}</td>
      <td class="num col-divider">${fmt.comma(totals.forecastRevenue)}</td><td class="num">—</td>
      <td class="num">${totals.totalTarget > 0 ? fmt.pct(totals.forecastRevenue / totals.totalTarget) : '—'}</td>
      <td class="num col-divider">${totals.totalTarget > 0 ? fmt.pct(totals.actualRevenue / totals.totalTarget) : '—'}</td>
      <td class="num col-divider">${fmt.comma(totals.actualRevenue - totals.lastYearActual)}</td>
      <td class="num">${totals.lastYearActual > 0 ? fmt.pct((totals.actualRevenue - totals.lastYearActual) / totals.lastYearActual) : '—'}</td>
    </tr></tfoot>`;

    document.getElementById('forecastDetailTable').innerHTML = head + body + foot;
  }

  function exportCSV(monthly) {
    const totals = computeYearTotals(monthly);
    const accu = arr => arr.reduce((acc, v, i) => { acc.push((acc[i - 1] || 0) + v); return acc; }, []);
    const accuRev = accu(monthly.map(m => m.actualRevenue));
    const accuFR = accu(monthly.map(m => m.forecastRevenue));

    const rows = [['Month', 'Renew Target', 'New Target', 'Total Target',
                   'Actual Renew', 'Actual New', 'Actual Revenue', 'Accu Actual',
                   'Renewal Estimate', 'Sales Forecast', 'Forecast Revenue', 'Accu Forecast',
                   'Achieve %', 'Forecast %', 'YoY']];
    monthly.forEach((m, i) => {
      const ach = m.totalTarget > 0 ? (m.actualRevenue / m.totalTarget * 100).toFixed(1) + '%' : '';
      const fcst = m.totalTarget > 0 ? (m.forecastRevenue / m.totalTarget * 100).toFixed(1) + '%' : '';
      const yoy = m.lastYearActual > 0 ? m.actualRevenue - m.lastYearActual : '';
      rows.push([
        `${m.label} ${STATE.year}`,
        m.renewTarget, m.newTarget, m.totalTarget,
        m.actualRenew, m.actualNew, m.actualRevenue, accuRev[i],
        m.renewalEstimate, m.salesForecast, m.forecastRevenue, accuFR[i],
        ach, fcst, yoy,
      ]);
    });
    rows.push(['Total', totals.renewTarget, totals.newTarget, totals.totalTarget,
               totals.actualRenew, totals.actualNew, totals.actualRevenue, '',
               totals.renewalEstimate, totals.salesForecast, totals.forecastRevenue, '',
               totals.totalTarget > 0 ? (totals.actualRevenue / totals.totalTarget * 100).toFixed(1) + '%' : '',
               totals.totalTarget > 0 ? (totals.forecastRevenue / totals.totalTarget * 100).toFixed(1) + '%' : '',
               totals.actualRevenue - totals.lastYearActual]);

    const csv = rows.map(r => r.map(c => {
      const s = String(c == null ? '' : c);
      return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
    const today = App.UI.fmt.todayLocalISO();
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-dashboard-forecast_${STATE.year}_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    App.UI.toast(`Exported forecast for ${STATE.year}`, 'success');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.forecast = { render };
})();
