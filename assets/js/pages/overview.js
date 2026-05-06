/* ========================================================================
   Page: Overview — Executive summary
   ======================================================================== */
(function () {
  const charts = {};
  const F = () => App.Filters;
  const fmt = () => App.UI.fmt;

  function destroyCharts() {
    Object.values(charts).forEach(c => c && c.destroy && c.destroy());
    Object.keys(charts).forEach(k => delete charts[k]);
  }

  function render(container, parsed) {
    destroyCharts();
    if (!parsed || !parsed.deals.length) {
      container.innerHTML = `
        <div class="placeholder-page">
          <div class="icon">📊</div>
          <h2>Welcome to Sales Dashboard</h2>
          <p>Upload your Bitrix deal export (.xlsx / .csv / .json) to start.<br>
          Or drop a saved settings file to restore your configuration.</p>
          <button class="btn btn-primary btn-lg" data-action="upload">📥 Upload data</button>
        </div>`;
      // Re-attach upload action
      container.querySelectorAll('[data-action="upload"]').forEach(b => {
        b.addEventListener('click', () => document.getElementById('fileInput').click());
      });
      return;
    }

    container.innerHTML = renderHTML();

    const deals = F().dashboardScope(F().apply(parsed.deals));
    renderKPIs(deals);
    renderStatusByMonth(deals);
    renderStatusByUser(deals);
    renderTopPerformers(deals);
    renderStageFunnel(deals);

    container.querySelector('#performerGroupBy').addEventListener('change', () => {
      renderTopPerformers(deals);
    });
  }

  function renderHTML() {
    return `
      <div class="section-title">Key Metrics</div>
      <div class="kpi-grid" id="kpiGrid"></div>

      <div class="section-title">Trend by Month — All deals (Won/Commit/Upside/Open/Lost)</div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Stacked by Status</div>
            <div class="card-subtitle">Expected close date · ค่าใน chart รวมทุก deal</div>
          </div>
          <div class="legend-row">
            <span class="legend-item"><span class="legend-swatch" style="background:#259b24"></span>Won</span>
            <span class="legend-item"><span class="legend-swatch" style="background:#9ccc65"></span>Commit</span>
            <span class="legend-item"><span class="legend-swatch" style="background:#f97316"></span>Upside</span>
            <span class="legend-item"><span class="legend-swatch" style="background:#3b82f6"></span>Open</span>
            <span class="legend-item"><span class="legend-swatch" style="background:#ef4444"></span>Lost</span>
          </div>
        </div>
        <div class="chart-canvas-md"><canvas id="chartStatusMonth"></canvas></div>
      </div>

      <div class="section-title">Per-User Pipeline Snapshot</div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Stacked by Status — top 10 performers</div>
            <div class="card-subtitle">เห็นภาพ Won + ที่ยังอยู่ใน pipeline ของแต่ละคน</div>
          </div>
        </div>
        <div class="chart-canvas-md"><canvas id="chartStatusUser"></canvas></div>
      </div>

      <div class="section-title">Performance Breakdown</div>
      <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:16px;">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Top Performers</div>
              <div class="card-subtitle">Sorted by Won value</div>
            </div>
            <select id="performerGroupBy" class="select-input">
              <option value="user" selected>By User</option>
              <option value="team">By Team</option>
            </select>
          </div>
          <div style="max-height:380px; overflow:auto">
            <table class="tbl" id="tblPerformers">
              <thead><tr>
                <th style="width:36px">#</th>
                <th>Name</th>
                <th class="num">Won</th>
                <th class="num">Won #</th>
                <th class="num">Open</th>
                <th class="num">Win Rate</th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Stage Funnel</div>
              <div class="card-subtitle">Open deals by stage</div>
            </div>
          </div>
          <div style="max-height:380px; overflow:auto">
            <table class="tbl" id="tblFunnel">
              <thead><tr>
                <th>Stage</th>
                <th class="num">#</th>
                <th class="num">Value</th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function aggregate(rows, predicate, valueFn) {
    let total = 0;
    for (const r of rows) if (predicate(r)) total += valueFn(r);
    return total;
  }

  /* Sum manual New Sell targets (from Targets page) for current filter (period + team + user) */
  function computeNewSellTargetSum() {
    const settings = App.Settings.load();
    const targets = settings.newSellTargets || {};
    const usersList = settings.users || [];
    const F = App.Filters.STATE;
    const from = F.period.from, to = F.period.to;

    const userTeamMap = {};
    usersList.forEach(u => userTeamMap[u.name] = u.team || 'Unassigned');

    function userPasses(userName) {
      if (F.user.size > 0 && !F.user.has(userName)) return false;
      if (F.team.size > 0 && !F.team.has(userTeamMap[userName] || 'Unassigned')) return false;
      return true;
    }

    let total = 0;
    Object.keys(targets).forEach(yearStr => {
      const year = parseInt(yearStr);
      if (from && year < from.getFullYear()) return;
      if (to && year > to.getFullYear()) return;
      Object.entries(targets[yearStr]).forEach(([userName, arr]) => {
        if (!userPasses(userName)) return;
        if (!Array.isArray(arr)) return;
        arr.forEach((v, idx) => {
          const monthStart = new Date(year, idx, 1);
          const monthEnd = new Date(year, idx + 1, 0, 23, 59, 59);
          if (from && monthEnd < from) return;
          if (to && monthStart > to) return;
          total += v || 0;
        });
      });
    });
    return total;
  }

  function renderKPIs(deals) {
    const M = F().Matchers;
    const renewTargetSum = aggregate(deals, M.isRenew, d => d.renewTarget || 0);
    const newSellTargetSum = computeNewSellTargetSum();
    const totalTargetSum = renewTargetSum + newSellTargetSum;

    const wonRenewSum = aggregate(deals, d => M.isRenew(d) && M.won(d), d => d.income);
    const wonNewSum = aggregate(deals, d => F().NEW_TYPES.has(d.dealType) && M.won(d), d => d.income);
    const wonAllSum = wonRenewSum + wonNewSum;
    const openRenewSum = aggregate(deals, d => M.isRenew(d) && M.open(d), d => d.income);
    const wonCount = deals.filter(M.won).length;
    const closedCount = deals.filter(M.closed).length;
    const winRate = closedCount > 0 ? wonCount / closedCount : 0;
    const totalAchievement = totalTargetSum > 0 ? wonAllSum / totalTargetSum : 0;
    const renewAchievement = renewTargetSum > 0 ? wonRenewSum / renewTargetSum : 0;
    const newAchievement = newSellTargetSum > 0 ? wonNewSum / newSellTargetSum : 0;
    const renewCoverage = renewTargetSum > 0 ? openRenewSum / renewTargetSum : 0;

    const renewDeals = deals.filter(M.isRenew).length;
    const newDeals = deals.filter(d => F().NEW_TYPES.has(d.dealType)).length;
    const newSellTargetSet = newSellTargetSum > 0;

    const kpis = [
      // Big picture (row 1)
      { cls: 'target', primary: true, icon: '🎯', label: 'Total Target',
        value: fmt().THBFull(totalTargetSum),
        sub: `Renew ${fmt().THB(renewTargetSum)} + New ${fmt().THB(newSellTargetSum)}` },
      { cls: 'won', primary: true, icon: '🏆', label: 'Won — Total',
        value: fmt().THBFull(wonAllSum),
        sub: `${wonCount.toLocaleString()} deals` },
      { cls: 'pct', primary: true, icon: '📈', label: 'Total Achievement %',
        value: fmt().pct(totalAchievement),
        sub: `Won ${fmt().THB(wonAllSum)} ÷ Target ${fmt().THB(totalTargetSum)}` },

      // Renew (row 2)
      { cls: 'renew', icon: '🔄', label: 'Renew Target',
        value: fmt().THBFull(renewTargetSum),
        sub: `${renewDeals.toLocaleString()} deals` },
      { cls: 'renew', icon: '🔄', label: 'Won — Renew',
        value: fmt().THBFull(wonRenewSum),
        sub: `${fmt().pct(renewAchievement)} of Renew Target` },
      { cls: 'coverage', icon: '🛡️', label: 'Renew Coverage',
        value: fmt().pct(renewCoverage),
        sub: `Open Renew ${fmt().THB(openRenewSum)}` },

      // New (row 3)
      { cls: 'new', icon: '✨', label: 'New Sell Target',
        value: fmt().THBFull(newSellTargetSum),
        sub: newSellTargetSet ? 'Manual (from Targets)' : '⚠️ Not set — open Targets page' },
      { cls: 'new', icon: '✨', label: 'Won — New',
        value: fmt().THBFull(wonNewSum),
        sub: newSellTargetSet ? `${fmt().pct(newAchievement)} of New Target` : `${newDeals.toLocaleString()} deals in scope` },
      { cls: 'rate', icon: '⚡', label: 'Win Rate',
        value: fmt().pct(winRate),
        sub: `${wonCount} won / ${closedCount} closed` },
    ];
    document.getElementById('kpiGrid').innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.cls}${k.primary ? ' kpi-primary' : ''}">
        <div class="kpi-label"><span>${k.icon}</span>${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-meta"><span>${k.sub}</span></div>
      </div>`).join('');
  }

  function renderStatusByMonth(deals) {
    const f = F().STATE.period;
    const COLORS = App.StatusMapping.COLORS;
    const STATUSES = App.StatusMapping.LIST;
    const predicates = {};
    STATUSES.forEach(s => predicates[s] = d => d.status === s);

    const agg = F().aggregateByMonthMulti(deals, predicates, d => d.income, f.from, f.to);

    const ctx = document.getElementById('chartStatusMonth').getContext('2d');
    charts.statusMonth = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: agg.labels,
        datasets: STATUSES.map(s => ({
          label: s,
          data: agg.datasets[s],
          backgroundColor: COLORS[s].fill,
          stack: 'A',
          borderRadius: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (c) => c.dataset.label + ': ' + fmt().THBFull(c.parsed.y) },
          },
          datalabels: { display: false },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { stacked: true, ticks: { callback: v => fmt().THB(v), font: { size: 11 } }, grid: { color: '#f1f5f9' } },
        },
      },
    });
  }

  function renderStatusByUser(deals) {
    const COLORS = App.StatusMapping.COLORS;
    const STATUSES = App.StatusMapping.LIST;
    const buckets = {};
    deals.forEach(d => {
      const u = d.responsible || 'Unassigned';
      if (!buckets[u]) buckets[u] = { Won: 0, Commit: 0, Upside: 0, Open: 0, Lost: 0 };
      buckets[u][d.status] = (buckets[u][d.status] || 0) + d.income;
    });
    // Top 10 by total
    const arr = Object.entries(buckets)
      .map(([name, v]) => ({ name, total: STATUSES.reduce((a, s) => a + v[s], 0), values: v }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const ctx = document.getElementById('chartStatusUser').getContext('2d');
    charts.statusUser = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: arr.map(x => x.name),
        datasets: STATUSES.map(s => ({
          label: s,
          data: arr.map(x => x.values[s]),
          backgroundColor: COLORS[s].fill,
          stack: 'A',
          borderRadius: 2,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => c.dataset.label + ': ' + fmt().THBFull(c.parsed.x) } },
          datalabels: { display: false },
        },
        scales: {
          x: { stacked: true, ticks: { callback: v => fmt().THB(v), font: { size: 11 } } },
          y: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  }

  function renderTopPerformers(deals) {
    const groupBy = document.getElementById('performerGroupBy').value;
    const buckets = {};
    deals.forEach(d => {
      const key = groupBy === 'user' ? (d.responsible || 'Unassigned') : (d.team || 'Unassigned');
      if (!buckets[key]) buckets[key] = { wonValue: 0, wonCount: 0, openValue: 0, closedCount: 0 };
      if (d.status === 'Won') { buckets[key].wonValue += d.income; buckets[key].wonCount++; }
      if (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside') buckets[key].openValue += d.income;
      if (d.status === 'Won' || d.status === 'Lost') buckets[key].closedCount++;
    });
    const arr = Object.entries(buckets)
      .map(([name, v]) => ({ name, ...v, winRate: v.closedCount ? v.wonCount / v.closedCount : 0 }))
      .filter(x => x.wonCount > 0 || x.openValue > 0)
      .sort((a, b) => b.wonValue - a.wonValue);

    const tbody = document.querySelector('#tblPerformers tbody');
    tbody.innerHTML = arr.map((x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${x.name}</td>
        <td class="num">${fmt().THBFull(x.wonValue)}</td>
        <td class="num">${fmt().int(x.wonCount)}</td>
        <td class="num">${fmt().THB(x.openValue)}</td>
        <td class="num">${fmt().pct(x.winRate)}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No data</td></tr>';
  }

  function renderStageFunnel(deals) {
    const stageBuckets = {};
    deals.forEach(d => {
      if (d.status !== 'Open' && d.status !== 'Commit' && d.status !== 'Upside') return;
      const k = d.stage || '(none)';
      if (!stageBuckets[k]) stageBuckets[k] = { count: 0, value: 0 };
      stageBuckets[k].count++;
      stageBuckets[k].value += d.income;
    });
    const arr = Object.entries(stageBuckets)
      .map(([k, v]) => ({ stage: k, ...v }))
      .sort((a, b) => b.value - a.value);
    const tbody = document.querySelector('#tblFunnel tbody');
    tbody.innerHTML = arr.map(x => `
      <tr>
        <td>${x.stage}</td>
        <td class="num">${fmt().int(x.count)}</td>
        <td class="num">${fmt().THBFull(x.value)}</td>
      </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; padding:24px; color:var(--text-muted);">No open deals</td></tr>';
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.overview = { render };
})();
