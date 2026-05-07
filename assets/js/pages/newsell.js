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
        <div class="kpi-card pct kpi-primary"><div class="kpi-label"><span>⚡</span>Win Rate</div><div class="kpi-value">${fmt.pct(winRate)}</div><div class="kpi-meta"><span>Won ${won.length} / Closed ${closedCount}</span></div></div>
        <div class="kpi-card commit kpi-primary"><div class="kpi-label"><span>📋</span>Open Pipeline</div><div class="kpi-value" title="${fmt.THBExact(open.reduce((s, d) => s + d.income, 0))}">${fmt.THBFull(open.reduce((s, d) => s + d.income, 0))}</div><div class="kpi-meta"><span>${open.length.toLocaleString()} deals · O+C+U</span></div></div>
      </div>

      <div class="section-title">Won breakdown &amp; Stage Funnel</div>
      <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:16px;">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Won by Product Type</div><div class="card-subtitle">เห็นว่าสินค้าตัวไหนปิดได้เยอะ</div></div></div>
          <div class="chart-canvas-md"><canvas id="newProductChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Stage Funnel — open New deals</div><div class="card-subtitle">Count + value at each stage</div></div></div>
          <div style="max-height:340px; overflow:auto"><table class="tbl" id="newFunnel"><thead><tr><th>Stage</th><th class="num">#</th><th class="num">Value</th><th>Bar</th></tr></thead><tbody></tbody></table></div>
        </div>
      </div>

      <div class="section-title">Monthly New Sell — stacked by status</div>
      <div class="card">
        <div class="chart-canvas-md"><canvas id="newMonthChart"></canvas></div>
      </div>

      <div class="section-title">⚠️ New deals overdue — open + close date passed</div>
      <div class="card">
        <div id="newOverdueWrap"></div>
      </div>

      <div class="section-title">🏆 Top performers — Win Rate by Responsible (closed deals)</div>
      <div class="card">
        <div style="max-height:380px; overflow:auto">
          <table class="tbl" id="winRateTbl">
            <thead><tr><th style="width:36px">#</th><th>Responsible</th><th>Team</th><th class="num">Won</th><th class="num">Lost</th><th class="num">Win Rate</th><th class="num">Won Value</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <div class="section-title">Top New Customers Acquired</div>
      <div class="card">
        <div style="max-height:380px; overflow:auto">
          <table class="tbl" id="topNewTbl">
            <thead><tr><th style="width:36px">#</th><th class="wrap">Deal Name</th><th class="wrap-sm">Company</th><th>Responsible</th><th>Deal Type</th><th>Product Type</th><th class="num">Income</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('newPrintBtn').addEventListener('click', () => window.print());

    // Won by Product Type donut
    const prodBuckets = {};
    won.forEach(d => {
      const p = d.productType || '(none)';
      if (!prodBuckets[p]) prodBuckets[p] = 0;
      prodBuckets[p] += d.income;
    });
    const prodLabels = Object.keys(prodBuckets);
    const prodVals = prodLabels.map(k => prodBuckets[k]);
    const palette = ['#259b24', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#9ccc65'];

    const productOpts = App.UI.donutOptions({ centerLabel: 'Won New' });
    productOpts.onClick = (event, elements) => {
      if (!elements.length) return;
      const productType = prodLabels[elements[0].index];
      const matched = won.filter(d => (d.productType || '(none)') === productType);
      App.UI.drillModal({ title: `Won New · Product: ${productType}`, subtitle: 'Won New Sell deals with this product type', deals: matched });
    };
    productOpts.onHover = (e, els) => { e.native && (e.native.target.style.cursor = els.length ? 'pointer' : 'default'); };
    new Chart(document.getElementById('newProductChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: prodLabels,
        datasets: [{ data: prodVals, backgroundColor: prodLabels.map((_, i) => palette[i % palette.length]), borderWidth: 2, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || 'white' }],
      },
      options: productOpts,
    });

    // Stage funnel — with bar visualization
    const stages = {};
    open.forEach(d => {
      const s = d.stage || '(none)';
      if (!stages[s]) stages[s] = { count: 0, value: 0 };
      stages[s].count++;
      stages[s].value += d.income;
    });
    const stageRows = Object.entries(stages).sort((a, b) => b[1].value - a[1].value);
    const maxStageValue = stageRows.reduce((m, [, v]) => Math.max(m, v.value), 0);
    document.querySelector('#newFunnel tbody').innerHTML = stageRows.map(([s, v]) => {
      const pct = maxStageValue > 0 ? (v.value / maxStageValue * 100) : 0;
      return `<tr>
        <td>${escapeHtml(s)}</td>
        <td class="num">${fmt.int(v.count)}</td>
        <td class="num" title="${fmt.THBExact(v.value)}">${fmt.THBFull(v.value)}</td>
        <td><div style="height:10px; background: var(--surface-3); border-radius:4px; overflow:hidden; min-width:100px;"><div style="width:${pct}%; height:100%; background: var(--commit);"></div></div></td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--text-muted);">No open deals</td></tr>';

    // Monthly status chart
    const COLORS = App.StatusMapping.COLORS;
    const STATUSES = App.StatusMapping.LIST;
    const f = App.Filters.STATE.period;
    const preds = {};
    STATUSES.forEach(s => preds[s] = d => d.status === s);
    const monthAgg = App.Filters.aggregateByMonthMulti(newDeals, preds, d => d.income, f.from, f.to);

    const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    new Chart(document.getElementById('newMonthChart').getContext('2d'), {
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
          const matched = newDeals.filter(d => d.status === status && d.expectedClose
            && d.expectedClose.getMonth() === monthIdx && d.expectedClose.getFullYear() === year);
          App.UI.drillModal({ title: `New · ${status} · ${lbl}`, subtitle: 'New Sell deals only', deals: matched });
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

    // Overdue New deals (open + expectedClose < today)
    renderOverdue(newDeals);

    // Win rate by Responsible (top 10)
    const userStats = {};
    newDeals.forEach(d => {
      const u = d.responsible || 'Unassigned';
      if (!userStats[u]) userStats[u] = { team: d.team || '—', won: 0, lost: 0, wonValue: 0 };
      if (M.won(d)) { userStats[u].won++; userStats[u].wonValue += d.income; }
      else if (M.lost(d)) userStats[u].lost++;
    });
    const userArr = Object.entries(userStats)
      .map(([name, v]) => ({ name, ...v, closed: v.won + v.lost, winRate: (v.won + v.lost) > 0 ? v.won / (v.won + v.lost) : 0 }))
      .filter(x => x.closed > 0)
      .sort((a, b) => b.winRate - a.winRate || b.wonValue - a.wonValue)
      .slice(0, 15);
    document.querySelector('#winRateTbl tbody').innerHTML = userArr.map((x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(x.name)}</strong></td>
        <td>${escapeHtml(x.team)}</td>
        <td class="num">${x.won}</td>
        <td class="num" style="color:var(--text-muted);">${x.lost}</td>
        <td class="num" style="font-weight:700; color: var(--won);">${fmt.pct(x.winRate)}</td>
        <td class="num" title="${fmt.THBExact(x.wonValue)}">${fmt.THBFull(x.wonValue)}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No closed deals in scope</td></tr>';

    // Top new customers
    const topNew = won.slice().sort((a, b) => b.income - a.income).slice(0, 30);
    document.querySelector('#topNewTbl tbody').innerHTML = topNew.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="wrap"><strong>${escapeHtml(d.dealName || '—')}</strong></td>
        <td class="wrap-sm">${escapeHtml(d.company || '—')}</td>
        <td>${escapeHtml(d.responsible || '—')}</td>
        <td>${escapeHtml(d.dealType || '—')}</td>
        <td>${escapeHtml(d.productType || '—')}</td>
        <td class="num" title="${fmt.THBExact(d.income || 0)}">${fmt.THBFull(d.income || 0)}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No new customers in scope</td></tr>';
  }

  function renderOverdue(newDeals) {
    const fmt = App.UI.fmt;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = newDeals
      .filter(d => (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')
                && d.expectedClose && d.expectedClose < today);

    overdue.sort((a, b) => a.expectedClose - b.expectedClose);   // most overdue first

    if (overdue.length === 0) {
      document.getElementById('newOverdueWrap').innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">No overdue New deals 🎉</div>`;
      return;
    }

    const totalValue = overdue.reduce((s, d) => s + d.income, 0);

    document.getElementById('newOverdueWrap').innerHTML = `
      <div style="margin-bottom:12px; font-size:12px; padding:6px 12px; background:var(--tint-danger); border:1px solid var(--lost); border-radius:var(--radius-sm); color:var(--danger); display:inline-block; font-weight:600;">
        <span class="status-dot" style="background: var(--danger);"></span>${overdue.length} deals overdue · Total ${fmt.THBFull(totalValue)}
      </div>
      <div style="max-height:480px; overflow:auto;">
        <table class="tbl">
          <thead><tr>
            <th class="wrap">Deal Name</th><th class="wrap-sm">Company</th><th>Responsible</th><th>Stage</th>
            <th class="num">Income</th><th>Expected close</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${overdue.map(d => {
              const closeDay = new Date(d.expectedClose.getFullYear(), d.expectedClose.getMonth(), d.expectedClose.getDate());
              const days = Math.floor((today - closeDay) / 86400000);
              return `
                <tr style="background: var(--tint-danger);">
                  <td class="wrap"><strong>${escapeHtml(d.dealName || '—')}</strong></td>
                  <td class="wrap-sm">${escapeHtml(d.company || '—')}</td>
                  <td>${escapeHtml(d.responsible || '—')}</td>
                  <td>${escapeHtml(d.stage || '—')}</td>
                  <td class="num" title="${fmt.THBExact(d.income || 0)}">${fmt.THBFull(d.income || 0)}</td>
                  <td>${fmt.date(d.expectedClose)}</td>
                  <td><strong style="color: var(--danger);">Overdue<br>${days} day${days > 1 ? 's' : ''}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
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
