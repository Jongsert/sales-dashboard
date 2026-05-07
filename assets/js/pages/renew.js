/* ========================================================================
   Page: Renew — drill-down for retention / churn / upsell metrics
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
      container.innerHTML = `<div class="placeholder-page"><div class="icon">🔄</div><h2>Renew</h2><p>Upload Bitrix data to drill into renewal metrics.</p><button class="btn btn-primary btn-lg" data-action="upload">📥 Upload data</button></div>`;
      container.querySelectorAll('[data-action="upload"]').forEach(b => b.addEventListener('click', () => document.getElementById('fileInput').click()));
      return;
    }
    const M = App.Filters.Matchers;
    const all = App.Filters.dashboardScope(App.Filters.apply(parsed.deals));
    const renewDeals = all.filter(M.isRenew);

    // KPIs
    const renewTarget = renewDeals.reduce((s, d) => s + (d.renewTarget || 0), 0);
    const wonRenew = renewDeals.filter(M.won).reduce((s, d) => s + d.income, 0);
    const lostRenew = renewDeals.filter(M.lost).reduce((s, d) => s + d.income, 0);
    const openRenew = renewDeals.filter(d => d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside').reduce((s, d) => s + d.income, 0);
    const wonCount = renewDeals.filter(M.won).length;
    const lostCount = renewDeals.filter(M.lost).length;
    const closedCount = wonCount + lostCount;
    const renewalRate = closedCount > 0 ? wonCount / closedCount : 0;
    const churnRate = closedCount > 0 ? lostCount / closedCount : 0;
    const achievement = renewTarget > 0 ? wonRenew / renewTarget : 0;
    const coverage = renewTarget > 0 ? openRenew / renewTarget : 0;

    const fmt = App.UI.fmt;

    container.innerHTML = `
      <div class="section-title">
        Renew — retention &amp; renewal performance
        <span class="actions">
          <button class="btn btn-sm" id="renewPrintBtn">🖨️ Print</button>
        </span>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card target kpi-primary">
          <div class="kpi-label"><span>🎯</span>Renew Target</div>
          <div class="kpi-value">${fmt.THBFull(renewTarget)}</div>
          <div class="kpi-meta"><span>${fmt.int(renewDeals.length)} deals in scope</span></div>
        </div>
        <div class="kpi-card won kpi-primary">
          <div class="kpi-label"><span>🏆</span>Won Renew</div>
          <div class="kpi-value">${fmt.THBFull(wonRenew)}</div>
          <div class="kpi-meta"><span>${fmt.pct(achievement)} of target · ${wonCount.toLocaleString()} won</span></div>
        </div>
        <div class="kpi-card pct kpi-primary">
          <div class="kpi-label"><span>♻️</span>Renewal Rate</div>
          <div class="kpi-value">${fmt.pct(renewalRate)}</div>
          <div class="kpi-meta"><span>Won ${wonCount} / Closed ${closedCount}</span></div>
        </div>
        <div class="kpi-card lost kpi-primary">
          <div class="kpi-label"><span>📉</span>Churn Rate</div>
          <div class="kpi-value">${fmt.pct(churnRate)}</div>
          <div class="kpi-meta"><span>Lost ${fmt.THB(lostRenew)} from ${lostCount} deals</span></div>
        </div>
        <div class="kpi-card coverage">
          <div class="kpi-label"><span>🛡️</span>Renew Coverage</div>
          <div class="kpi-value">${fmt.pct(coverage)}</div>
          <div class="kpi-meta"><span>Open ${fmt.THB(openRenew)} ÷ Target</span></div>
        </div>
      </div>

      <div class="section-title">Renewal Mix by Deal Type</div>
      <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:16px;">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Monthly stacked by Status</div><div class="card-subtitle">Won = retained · Lost = churned</div></div></div>
          <div class="chart-canvas-md"><canvas id="renewMonthChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Won Renew by Deal Type</div><div class="card-subtitle">Same vs Up sell vs Decrease vs MACD</div></div></div>
          <div class="chart-canvas-md"><canvas id="renewMixChart"></canvas></div>
        </div>
      </div>

      <div class="section-title">Top Renewing Customers</div>
      <div class="card">
        <div style="max-height:380px; overflow:auto">
          <table class="tbl" id="topRenewTbl">
            <thead><tr><th style="width:36px">#</th><th>Company</th><th>Responsible</th><th>Deal Type</th><th>Stage</th><th class="num">Renew Target</th><th class="num">Income</th><th>Expected close</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <div class="section-title">⚠️ Customers at Risk — open Renew, close date passed/near</div>
      <div class="card">
        <div style="max-height:380px; overflow:auto">
          <table class="tbl" id="atRiskTbl">
            <thead><tr><th>Company</th><th>Responsible</th><th>Stage</th><th class="num">Income</th><th>Expected close</th><th>Days overdue</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <div class="section-title">📉 Lost Renewals (churn analysis)</div>
      <div class="card">
        <div style="max-height:380px; overflow:auto">
          <table class="tbl" id="lostRenewTbl">
            <thead><tr><th>Company</th><th>Responsible</th><th>Deal Type</th><th class="num">Income</th><th>Expected close</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('renewPrintBtn').addEventListener('click', () => window.print());

    // Monthly stacked status chart
    const COLORS = App.StatusMapping.COLORS;
    const STATUSES = App.StatusMapping.LIST;
    const f = App.Filters.STATE.period;
    const preds = {};
    STATUSES.forEach(s => preds[s] = d => d.status === s);
    const monthAgg = App.Filters.aggregateByMonthMulti(renewDeals, preds, d => d.income, f.from, f.to);

    const ctx1 = document.getElementById('renewMonthChart').getContext('2d');
    charts.month = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: monthAgg.labels,
        datasets: STATUSES.map(s => ({
          label: s,
          data: monthAgg.datasets[s],
          backgroundColor: COLORS[s].fill,
          stack: 'A',
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', align: 'end', labels: { font: { size: 11 }, usePointStyle: true } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt.THBFull(c.parsed.y)}` } },
          datalabels: { display: false },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: v => fmt.THB(v) }, grid: { color: '#f1f5f9' } },
        },
      },
    });

    // Mix donut by deal type
    const mixBuckets = {};
    renewDeals.filter(M.won).forEach(d => {
      const t = d.dealType || '(none)';
      if (!mixBuckets[t]) mixBuckets[t] = 0;
      mixBuckets[t] += d.income;
    });
    const mixLabels = Object.keys(mixBuckets);
    const mixVals = mixLabels.map(k => mixBuckets[k]);
    const mixColors = ['#259b24', '#9ccc65', '#3b82f6', '#f97316', '#8b5cf6', '#ef4444'];

    const ctx2 = document.getElementById('renewMixChart').getContext('2d');
    charts.mix = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: mixLabels,
        datasets: [{
          data: mixVals,
          backgroundColor: mixLabels.map((_, i) => mixColors[i % mixColors.length]),
          borderWidth: 2, borderColor: 'white',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11 } } },
          tooltip: { callbacks: { label: c => `${c.label}: ${fmt.THBFull(c.parsed)}` } },
          datalabels: {
            display: ctx => ctx.parsed > 0,
            color: 'white', font: { size: 11, weight: 'bold' },
            formatter: (v, ctx) => {
              const total = ctx.dataset.data.reduce((s, x) => s + x, 0);
              return total > 0 ? (v / total * 100).toFixed(0) + '%' : '';
            },
          },
        },
      },
    });

    // Top renewing customers
    const topRenew = renewDeals
      .filter(d => d.status === 'Won' || d.status === 'Commit' || d.status === 'Upside')
      .sort((a, b) => (b.renewTarget || b.income || 0) - (a.renewTarget || a.income || 0))
      .slice(0, 30);
    document.querySelector('#topRenewTbl tbody').innerHTML = topRenew.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(d.company || d.dealName || '—')}</strong></td>
        <td>${escapeHtml(d.responsible || '—')}</td>
        <td>${escapeHtml(d.dealType || '—')}</td>
        <td>${escapeHtml(d.stage || '—')}</td>
        <td class="num">${fmt.THBFull(d.renewTarget || 0)}</td>
        <td class="num">${fmt.THBFull(d.income || 0)}</td>
        <td>${fmt.date(d.expectedClose)}</td>
      </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No renewing customers in scope</td></tr>';

    // At risk: open + close date passed or within 30 days
    const today = new Date();
    const in30 = new Date(today.getTime() + 30 * 86400 * 1000);
    const atRisk = renewDeals
      .filter(d => (d.status === 'Open' || d.status === 'Upside') && d.expectedClose && d.expectedClose <= in30)
      .sort((a, b) => a.expectedClose - b.expectedClose)
      .slice(0, 30);
    document.querySelector('#atRiskTbl tbody').innerHTML = atRisk.map(d => {
      const days = Math.floor((today - d.expectedClose) / (86400 * 1000));
      const overdue = days > 0 ? `<strong style="color:var(--danger);">+${days} days</strong>` : `${-days} days left`;
      return `
        <tr style="${days > 0 ? 'background: #fef2f2;' : ''}">
          <td><strong>${escapeHtml(d.company || d.dealName || '—')}</strong></td>
          <td>${escapeHtml(d.responsible || '—')}</td>
          <td>${escapeHtml(d.stage || '—')}</td>
          <td class="num">${fmt.THBFull(d.income || 0)}</td>
          <td>${fmt.date(d.expectedClose)}</td>
          <td>${overdue}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No at-risk customers in 30-day window 🎉</td></tr>';

    // Lost
    const lost = renewDeals.filter(M.lost).sort((a, b) => b.income - a.income).slice(0, 30);
    document.querySelector('#lostRenewTbl tbody').innerHTML = lost.map(d => `
      <tr>
        <td><strong>${escapeHtml(d.company || d.dealName || '—')}</strong></td>
        <td>${escapeHtml(d.responsible || '—')}</td>
        <td>${escapeHtml(d.dealType || '—')}</td>
        <td class="num" style="color: var(--lost);">${fmt.THBFull(d.income || 0)}</td>
        <td>${fmt.date(d.expectedClose)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">No lost renewals 🎉</td></tr>';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.renew = { render };
})();
