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
          <div class="kpi-value" title="${fmt.THBExact(renewTarget)}">${fmt.THBFull(renewTarget)}</div>
          <div class="kpi-meta"><span>${fmt.int(renewDeals.length)} deals in scope</span></div>
        </div>
        <div class="kpi-card won kpi-primary">
          <div class="kpi-label"><span>🏆</span>Won Renew</div>
          <div class="kpi-value" title="${fmt.THBExact(wonRenew)}">${fmt.THBFull(wonRenew)}</div>
          <div class="kpi-meta"><span>${fmt.pct(achievement)} of target · ${wonCount.toLocaleString()} won</span></div>
        </div>
        <div class="kpi-card pct kpi-primary">
          <div class="kpi-label"><span>♻️</span>Renewal Rate</div>
          <div class="kpi-value">${fmt.pct(renewalRate)}</div>
          <div class="kpi-meta"><span>Won ${wonCount} / Closed ${closedCount}</span></div>
        </div>
        <div class="kpi-card lost kpi-primary">
          <div class="kpi-label"><span>📉</span>Churn Rate</div>
          <div class="kpi-value" title="${fmt.THBExact(lostRenew)}">${fmt.pct(churnRate)}</div>
          <div class="kpi-meta"><span>Lost ${fmt.THB(lostRenew)} from ${lostCount} deals</span></div>
        </div>
      </div>

      <div class="section-title">Renew Pipeline by Status &amp; Monthly trend</div>
      <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:16px;">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Monthly stacked by Status</div><div class="card-subtitle">Won / Commit / Upside / Open / Lost</div></div></div>
          <div class="chart-canvas-md"><canvas id="renewMonthChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Renew Pipeline by Status</div><div class="card-subtitle">All renew deals split by status</div></div></div>
          <div class="chart-canvas-md"><canvas id="renewStatusChart"></canvas></div>
        </div>
      </div>

      <div class="section-title">⚠️ Customers at Risk</div>
      <div class="card">
        <div id="atRiskWrap"></div>
      </div>

      <div class="section-title">Top Renewals to Win — open + commit + upside, sorted by Renew Target</div>
      <div class="card">
        <div style="max-height:420px; overflow:auto">
          <table class="tbl" id="topRenewTbl">
            <thead><tr><th style="width:36px">#</th><th class="wrap">Deal Name</th><th class="wrap-sm">Company</th><th>Responsible</th><th>Stage</th><th class="num">Renew Target</th><th class="num">Income</th><th>Expected close</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <div class="section-title">📉 Lost Renewals — churn analysis</div>
      <div id="lostAnalysis"></div>
    `;

    document.getElementById('renewPrintBtn').addEventListener('click', () => window.print());

    // ===== Monthly stacked by Status =====
    const COLORS = App.StatusMapping.COLORS;
    const STATUSES = App.StatusMapping.LIST;
    const f = App.Filters.STATE.period;
    const preds = {};
    STATUSES.forEach(s => preds[s] = d => d.status === s);
    const monthAgg = App.Filters.aggregateByMonthMulti(renewDeals, preds, d => d.income, f.from, f.to);

    const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    charts.month = new Chart(document.getElementById('renewMonthChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: monthAgg.labels,
        datasets: STATUSES.map(s => ({ label: s, data: monthAgg.datasets[s], backgroundColor: COLORS[s].fill, stack: 'A' })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (!elements.length) return;
          const el = elements[0];
          const status = STATUSES[el.datasetIndex];
          const lbl = monthAgg.labels[el.index];
          const [mon, yr] = lbl.split(' ');
          const monthIdx = MN.indexOf(mon);
          const year = parseInt(yr);
          const matched = renewDeals.filter(d => d.status === status && d.expectedClose
            && d.expectedClose.getMonth() === monthIdx && d.expectedClose.getFullYear() === year);
          App.UI.drillModal({ title: `Renew · ${status} · ${lbl}`, subtitle: 'Renew deals only', deals: matched });
        },
        onHover: (e, els) => { e.native && (e.native.target.style.cursor = els.length ? 'pointer' : 'default'); },
        plugins: {
          legend: { position: 'top', align: 'end', labels: { font: { size: 11 }, usePointStyle: true } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt.THBExact(c.parsed.y)}` } },
          datalabels: { display: false },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: v => fmt.THB(v) }, grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#f1f5f9' } },
        },
      },
    });

    // ===== Renew Pipeline by Status (donut) =====
    const statusBuckets = {};
    STATUSES.forEach(s => statusBuckets[s] = 0);
    renewDeals.forEach(d => { statusBuckets[d.status] = (statusBuckets[d.status] || 0) + d.income; });

    const renewDonutOpts = App.UI.donutOptions({ centerLabel: 'Renew Total' });
    renewDonutOpts.onClick = (event, elements) => {
      if (!elements.length) return;
      const status = STATUSES[elements[0].index];
      const matched = renewDeals.filter(d => d.status === status);
      App.UI.drillModal({ title: `Renew · ${status}`, subtitle: 'All renew deals with this status', deals: matched });
    };
    renewDonutOpts.onHover = (e, els) => { e.native && (e.native.target.style.cursor = els.length ? 'pointer' : 'default'); };
    charts.status = new Chart(document.getElementById('renewStatusChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: STATUSES,
        datasets: [{
          data: STATUSES.map(s => statusBuckets[s]),
          backgroundColor: STATUSES.map(s => COLORS[s].fill),
          borderWidth: 2, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || 'white',
        }],
      },
      options: renewDonutOpts,
    });

    // ===== Customers at Risk =====
    // Mode toggling is wired inside renderAtRisk so the click handlers stay
    // attached after each re-render. Default mode = 'all' (both buckets).
    renderAtRisk(renewDeals, 'all');

    // ===== Top Renewals to Win =====
    const topRenew = renewDeals
      .filter(d => d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')
      .sort((a, b) => (b.renewTarget || 0) - (a.renewTarget || 0))
      .slice(0, 50);
    document.querySelector('#topRenewTbl tbody').innerHTML = topRenew.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="wrap"><strong>${escapeHtml(d.dealName || '—')}</strong></td>
        <td class="wrap-sm">${escapeHtml(d.company || '—')}</td>
        <td>${escapeHtml(d.responsible || '—')}</td>
        <td>${escapeHtml(d.stage || '—')}</td>
        <td class="num" title="${fmt.THBExact(d.renewTarget || 0)}">${fmt.THBFull(d.renewTarget || 0)}</td>
        <td class="num" title="${fmt.THBExact(d.income || 0)}">${fmt.THBFull(d.income || 0)}</td>
        <td>${fmt.date(d.expectedClose)}</td>
      </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No open renewals in scope 🎉</td></tr>';

    // ===== Lost Renewals analysis =====
    renderLostAnalysis(renewDeals);
  }

  function renderAtRisk(renewDeals, mode) {
    // mode: 'overdue' | 'due' | 'all'
    const fmt = App.UI.fmt;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in15 = new Date(today.getTime() + 15 * 86400 * 1000);

    const isOpen = d => d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside';

    function statusInfo(d) {
      const closeDay = new Date(d.expectedClose.getFullYear(), d.expectedClose.getMonth(), d.expectedClose.getDate());
      const daysFromToday = Math.floor((today - closeDay) / 86400000);
      if (daysFromToday > 0) {
        return {
          html: `<strong style="color: var(--danger);">Overdue<br>${daysFromToday} day${daysFromToday > 1 ? 's' : ''}</strong>`,
          isOverdue: true, sortKey: -daysFromToday,
        };
      } else if (daysFromToday === 0) {
        return { html: `<strong style="color: var(--danger);">Overdue<br>today</strong>`, isOverdue: true, sortKey: 0 };
      } else {
        return {
          html: `<span style="color: var(--upside); font-weight:600;">Due in<br>${-daysFromToday} day${-daysFromToday > 1 ? 's' : ''}</span>`,
          isOverdue: false, sortKey: -daysFromToday,
        };
      }
    }

    // Always compute overdue + due-in-15 buckets so the toggle can switch
    // without re-filtering on every click.
    const overdue = renewDeals
      .filter(d => isOpen(d) && d.expectedClose && d.expectedClose < today)
      .map(d => ({ d, info: statusInfo(d) }));
    const dueSoon = renewDeals
      .filter(d => isOpen(d) && d.expectedClose && d.expectedClose >= today && d.expectedClose <= in15)
      .map(d => ({ d, info: statusInfo(d) }));

    let rows;
    if (mode === 'overdue') rows = overdue;
    else if (mode === 'due') rows = dueSoon;
    else rows = overdue.concat(dueSoon);
    rows.sort((a, b) => a.info.sortKey - b.info.sortKey);

    const overdueValue = overdue.reduce((s, x) => s + (x.d.income || 0), 0);
    const dueValue = dueSoon.reduce((s, x) => s + (x.d.income || 0), 0);

    // Filter chips — clickable badges that toggle the visible bucket.
    // Active chip = solid fill; inactive = subtle outline.
    const overdueActive = mode === 'overdue' || mode === 'all';
    const dueActive = mode === 'due' || mode === 'all';
    const chipsHtml = `
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; font-size:12px;">
        <button class="risk-chip ${overdueActive ? 'risk-chip-active risk-chip-danger' : 'risk-chip-dim'}"
          data-risk-toggle="overdue" type="button">
          <span class="status-dot" style="background: var(--danger);"></span>${overdue.length} overdue · ${fmt.THBFull(overdueValue)}
        </button>
        <button class="risk-chip ${dueActive ? 'risk-chip-active risk-chip-upside' : 'risk-chip-dim'}"
          data-risk-toggle="due" type="button">
          <span class="status-dot" style="background: var(--upside);"></span>${dueSoon.length} due in 15 days · ${fmt.THBFull(dueValue)}
        </button>
      </div>`;

    const rowsHtml = rows.length === 0
      ? `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">No deals in this view 🎉</div>`
      : `<div style="max-height:520px; overflow:auto;">
          <table class="tbl">
            <thead><tr>
              <th class="wrap">Deal Name</th><th class="wrap-sm">Company</th><th>Responsible</th><th>Stage</th>
              <th class="num">Income</th><th>Expected close</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${rows.map(({ d, info }) => `
                <tr style="${info.isOverdue ? 'background: var(--tint-danger);' : ''}">
                  <td class="wrap"><strong>${escapeHtml(d.dealName || '—')}</strong></td>
                  <td class="wrap-sm">${escapeHtml(d.company || '—')}</td>
                  <td>${escapeHtml(d.responsible || '—')}</td>
                  <td>${escapeHtml(d.stage || '—')}</td>
                  <td class="num" title="${fmt.THBExact(d.income || 0)}">${fmt.THBFull(d.income || 0)}</td>
                  <td>${fmt.date(d.expectedClose)}</td>
                  <td>${info.html}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;

    const wrap = document.getElementById('atRiskWrap');
    wrap.innerHTML = chipsHtml + rowsHtml;

    // Click logic: clicking a chip filters to that bucket only. Clicking the
    // currently-active chip while in single-bucket view returns to 'all'.
    wrap.querySelectorAll('[data-risk-toggle]').forEach(chip => {
      chip.addEventListener('click', () => {
        const k = chip.dataset.riskToggle;   // 'overdue' | 'due'
        let next;
        if (mode === 'all') next = k;
        else if (mode === k) next = 'all';
        else next = k;
        renderAtRisk(renewDeals, next);
      });
    });
  }

  function renderLostAnalysis(renewDeals) {
    const fmt = App.UI.fmt;
    const lost = renewDeals.filter(d => d.status === 'Lost');

    if (lost.length === 0) {
      document.getElementById('lostAnalysis').innerHTML = `<div class="card" style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">No lost renewals in scope 🎉</div>`;
      return;
    }

    const totalLost = lost.reduce((s, d) => s + d.income, 0);

    const byUser = {};
    lost.forEach(d => {
      const u = d.responsible || 'Unassigned';
      if (!byUser[u]) byUser[u] = { count: 0, value: 0 };
      byUser[u].count++;
      byUser[u].value += d.income;
    });
    const byUserRows = Object.entries(byUser)
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 10)
      .map(([u, v]) => `<tr><td>${escapeHtml(u)}</td><td class="num">${v.count}</td><td class="num" title="${fmt.THBExact(v.value)}">${fmt.THBFull(v.value)}</td></tr>`)
      .join('');

    const lostTop = lost.slice().sort((a, b) => b.income - a.income).slice(0, 30);
    const lostDetailRows = lostTop.map(d => `
      <tr>
        <td class="wrap"><strong>${escapeHtml(d.dealName || '—')}</strong></td>
        <td class="wrap-sm">${escapeHtml(d.company || '—')}</td>
        <td>${escapeHtml(d.responsible || '—')}</td>
        <td>${escapeHtml(d.dealType || '—')}</td>
        <td class="num" style="color: var(--lost);" title="${fmt.THBExact(d.income || 0)}">${fmt.THBFull(d.income || 0)}</td>
        <td>${fmt.date(d.expectedClose)}</td>
      </tr>
    `).join('');

    document.getElementById('lostAnalysis').innerHTML = `
      <div class="card">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:14px;">
          <div class="kpi-card lost"><div class="kpi-label"><span>📊</span>Total Lost Value</div><div class="kpi-value" title="${fmt.THBExact(totalLost)}">${fmt.THBFull(totalLost)}</div><div class="kpi-meta"><span>${lost.length.toLocaleString()} deals</span></div></div>
        </div>

        <div style="margin-bottom:14px;">
          <div>
            <div class="deal-section-title">Lost by Responsible (top 10)</div>
            <div style="max-height:240px; overflow:auto"><table class="tbl"><thead><tr><th>User</th><th class="num">#</th><th class="num">Value</th></tr></thead><tbody>${byUserRows}</tbody></table></div>
          </div>
        </div>

        <div class="deal-section-title">Top 30 lost deals by value</div>
        <div style="max-height:380px; overflow:auto">
          <table class="tbl">
            <thead><tr><th class="wrap">Deal Name</th><th class="wrap-sm">Company</th><th>Responsible</th><th>Deal Type</th><th class="num">Income</th><th>Expected close</th></tr></thead>
            <tbody>${lostDetailRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.renew = { render };
})();
