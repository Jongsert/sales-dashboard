/* ========================================================================
   Page: New Sell — drill-down for new business / win-rate / conversion
   ======================================================================== */
(function () {
  const charts = {};
  function destroy() {
    Object.values(charts).forEach(c => c && c.destroy && c.destroy());
    Object.keys(charts).forEach(k => delete charts[k]);
  }

  function render(container, parsed) {
    destroy();
    if (!parsed || !parsed.deals.length) {
      container.innerHTML = `<div class="placeholder-page"><div class="icon">✨</div><h2>New Sell</h2><p>Upload Bitrix data to see new business metrics.</p><button class="btn btn-primary btn-lg" data-action="upload">📥 Upload data</button></div>`;
      container.querySelectorAll('[data-action="upload"]').forEach(b => b.addEventListener('click', () => document.getElementById('fileInput').click()));
      return;
    }
    const M = App.Filters.Matchers;
    const all = App.Filters.dashboardScope(App.Filters.apply(parsed.deals));
    const newDeals = all.filter(d => App.Filters.NEW_TYPES.has(d.dealType));

    const settings = App.Settings.load();
    const newTarget = computeNewSellTargetSum(settings);

    const won = newDeals.filter(M.won);
    const lost = newDeals.filter(M.lost);
    const open = newDeals.filter(d => d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside');
    const wonValue = won.reduce((s, d) => s + d.income, 0);
    const closedCount = won.length + lost.length;
    const winRate = closedCount > 0 ? won.length / closedCount : 0;
    const avgDealSize = won.length > 0 ? wonValue / won.length : 0;
    const achievement = newTarget > 0 ? wonValue / newTarget : 0;
    const fmt = App.UI.fmt;

    container.innerHTML = `
      <div class="section-title">
        New Sell — new business performance
        <span class="actions"><button class="btn btn-sm" id="newPrintBtn">🖨️ Print</button></span>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card target kpi-primary"><div class="kpi-label"><span>🎯</span>New Sell Target</div><div class="kpi-value" title="${fmt.THBExact(newTarget)}">${fmt.THBFull(newTarget)}</div><div class="kpi-meta"><span>Manual (from Targets page)</span></div></div>
        <div class="kpi-card won kpi-primary"><div class="kpi-label"><span>🏆</span>Won — New</div><div class="kpi-value" title="${fmt.THBExact(wonValue)}">${fmt.THBFull(wonValue)}</div><div class="kpi-meta"><span>${fmt.pct(achievement)} of target · ${won.length.toLocaleString()} won</span></div></div>
        <div class="kpi-card pct kpi-primary"><div class="kpi-label"><span>⚡</span>Win Rate</div><div class="kpi-value" title="${fmt.pct(winRate)}">${fmt.pct(winRate)}</div><div class="kpi-meta"><span>Won ${won.length} / Closed ${closedCount}</span></div></div>
        <div class="kpi-card upside kpi-primary"><div class="kpi-label"><span>📊</span>Avg Deal Size</div><div class="kpi-value" title="${fmt.THBExact(avgDealSize)}">${fmt.THBFull(avgDealSize)}</div><div class="kpi-meta"><span>across ${won.length} won deals</span></div></div>
        <div class="kpi-card commit"><div class="kpi-label"><span>📋</span>Open Pipeline</div><div class="kpi-value" title="${fmt.THBExact(open.reduce((s, d) => s + d.income, 0))}">${fmt.THBFull(open.reduce((s, d) => s + d.income, 0))}</div><div class="kpi-meta"><span>${open.length.toLocaleString()} deals</span></div></div>
      </div>

      <div class="section-title">Deal Source &amp; Stage Funnel</div>
      <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:16px;">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Won by Deal Source</div><div class="card-subtitle">เห็นช่องทางที่ปิดดีลได้</div></div></div>
          <div class="chart-canvas-md"><canvas id="newSourceChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Stage Funnel</div><div class="card-subtitle">Open New deals at each stage</div></div></div>
          <div style="max-height:340px; overflow:auto"><table class="tbl" id="newFunnel"><thead><tr><th>Stage</th><th class="num">#</th><th class="num">Value</th></tr></thead><tbody></tbody></table></div>
        </div>
      </div>

      <div class="section-title">Monthly New Sell — stacked by status</div>
      <div class="card">
        <div class="chart-canvas-md"><canvas id="newMonthChart"></canvas></div>
      </div>

      <div class="section-title">Top New Customers Acquired</div>
      <div class="card">
        <div style="max-height:380px; overflow:auto">
          <table class="tbl" id="topNewTbl">
            <thead><tr><th style="width:36px">#</th><th>Company</th><th>Deal Name</th><th>Responsible</th><th>Deal Type</th><th>Source</th><th class="num">Income</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('newPrintBtn').addEventListener('click', () => window.print());

    // Source donut
    const srcBuckets = {};
    won.forEach(d => {
      const s = d.dealSource || d.sourceChannel || '(none)';
      if (!srcBuckets[s]) srcBuckets[s] = 0;
      srcBuckets[s] += d.income;
    });
    const srcLabels = Object.keys(srcBuckets);
    const srcVals = srcLabels.map(k => srcBuckets[k]);
    const srcColors = ['#259b24', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#9ccc65'];

    new Chart(document.getElementById('newSourceChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: srcLabels,
        datasets: [{ data: srcVals, backgroundColor: srcLabels.map((_, i) => srcColors[i % srcColors.length]), borderWidth: 2, borderColor: 'white' }],
      },
      options: App.UI.donutOptions({ centerLabel: 'Won' }),
    });

    // Stage funnel
    const stages = {};
    open.forEach(d => {
      const s = d.stage || '(none)';
      if (!stages[s]) stages[s] = { count: 0, value: 0 };
      stages[s].count++;
      stages[s].value += d.income;
    });
    const stageRows = Object.entries(stages).sort((a, b) => b[1].value - a[1].value);
    document.querySelector('#newFunnel tbody').innerHTML = stageRows.map(([s, v]) => `
      <tr><td>${escapeHtml(s)}</td><td class="num">${fmt.int(v.count)}</td><td class="num">${fmt.THBFull(v.value)}</td></tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; padding:24px; color:var(--text-muted);">No open deals</td></tr>';

    // Monthly status chart
    const COLORS = App.StatusMapping.COLORS;
    const STATUSES = App.StatusMapping.LIST;
    const f = App.Filters.STATE.period;
    const preds = {};
    STATUSES.forEach(s => preds[s] = d => d.status === s);
    const monthAgg = App.Filters.aggregateByMonthMulti(newDeals, preds, d => d.income, f.from, f.to);

    new Chart(document.getElementById('newMonthChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: monthAgg.labels,
        datasets: STATUSES.map(s => ({ label: s, data: monthAgg.datasets[s], backgroundColor: COLORS[s].fill, stack: 'A' })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', align: 'end', labels: { font: { size: 11 }, usePointStyle: true } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt.THBExact(c.parsed.y)}` } },
          datalabels: { display: false },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: v => fmt.THB(v) }, grid: { color: '#f1f5f9' } },
        },
      },
    });

    // Top new customers
    const topNew = won.slice().sort((a, b) => b.income - a.income).slice(0, 30);
    document.querySelector('#topNewTbl tbody').innerHTML = topNew.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(d.company || '—')}</strong></td>
        <td>${escapeHtml(d.dealName || '—')}</td>
        <td>${escapeHtml(d.responsible || '—')}</td>
        <td>${escapeHtml(d.dealType || '—')}</td>
        <td>${escapeHtml(d.dealSource || d.sourceChannel || '—')}</td>
        <td class="num">${fmt.THBFull(d.income || 0)}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No new customers in scope</td></tr>';
  }

  function computeNewSellTargetSum(settings) {
    const targets = settings.newSellTargets || {};
    const usersList = settings.users || [];
    const F = App.Filters.STATE;
    const from = F.period.from, to = F.period.to;
    const userTeamMap = {};
    usersList.forEach(u => userTeamMap[u.name] = u.team || 'Unassigned');
    function userPasses(name) {
      if (F.user.size && !F.user.has(name)) return false;
      if (F.team.size && !F.team.has(userTeamMap[name] || 'Unassigned')) return false;
      return true;
    }
    let total = 0;
    Object.keys(targets).forEach(yearStr => {
      const year = parseInt(yearStr);
      if (from && year < from.getFullYear()) return;
      if (to && year > to.getFullYear()) return;
      Object.entries(targets[yearStr]).forEach(([userName, arr]) => {
        if (!userPasses(userName) || !Array.isArray(arr)) return;
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

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.newsell = { render };
})();
