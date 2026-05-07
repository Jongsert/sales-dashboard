/* ========================================================================
   Page: Combined — Renew + New Sell unified view
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
      container.innerHTML = `<div class="placeholder-page"><div class="icon">📈</div><h2>Combined</h2><p>Upload Bitrix data to see combined Renew + New view.</p><button class="btn btn-primary btn-lg" data-action="upload">📥 Upload data</button></div>`;
      container.querySelectorAll('[data-action="upload"]').forEach(b => b.addEventListener('click', () => document.getElementById('fileInput').click()));
      return;
    }
    const M = App.Filters.Matchers;
    const NEW = App.Filters.NEW_TYPES;
    const all = App.Filters.dashboardScope(App.Filters.apply(parsed.deals));
    const renewDeals = all.filter(M.isRenew);
    const newDeals = all.filter(d => NEW.has(d.dealType));
    const fmt = App.UI.fmt;

    const settings = App.Settings.load();
    const renewTarget = renewDeals.reduce((s, d) => s + (d.renewTarget || 0), 0);
    const newTarget = computeNewSellTargetSum(settings);
    const totalTarget = renewTarget + newTarget;

    const wonRenew = renewDeals.filter(M.won).reduce((s, d) => s + d.income, 0);
    const wonNew = newDeals.filter(M.won).reduce((s, d) => s + d.income, 0);
    const wonTotal = wonRenew + wonNew;
    const lastYear = computeLastYearActual(parsed.deals);
    const yoy = lastYear > 0 ? (wonTotal - lastYear) / lastYear : 0;
    const achievement = totalTarget > 0 ? wonTotal / totalTarget : 0;

    container.innerHTML = `
      <div class="section-title">
        Combined — Renew + New Sell
        <span class="actions"><button class="btn btn-sm" id="combinedPrintBtn">🖨️ Print</button></span>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card target kpi-primary"><div class="kpi-label"><span>🎯</span>Total Target</div><div class="kpi-value" title="${fmt.THBExact(totalTarget)}">${fmt.THBFull(totalTarget)}</div><div class="kpi-meta"><span>Renew ${fmt.THB(renewTarget)} + New ${fmt.THB(newTarget)}</span></div></div>
        <div class="kpi-card won kpi-primary"><div class="kpi-label"><span>🏆</span>Won Total</div><div class="kpi-value" title="${fmt.THBExact(wonTotal)}">${fmt.THBFull(wonTotal)}</div><div class="kpi-meta"><span>${fmt.pct(achievement)} of target</span></div></div>
        <div class="kpi-card pct kpi-primary"><div class="kpi-label"><span>📊</span>YoY</div><div class="kpi-value" title="${(yoy >= 0 ? '+' : '') + fmt.pct(yoy)}">${(yoy >= 0 ? '+' : '') + fmt.pct(yoy)}</div><div class="kpi-meta"><span>${fmt.THB(lastYear)} → ${fmt.THB(wonTotal)}</span></div></div>
        <div class="kpi-card commit kpi-primary"><div class="kpi-label"><span>♻️</span>Renew Mix</div><div class="kpi-value" title="${wonTotal > 0 ? fmt.pct(wonRenew / wonTotal) : '—'}">${wonTotal > 0 ? fmt.pct(wonRenew / wonTotal) : '—'}</div><div class="kpi-meta"><span>${fmt.THB(wonRenew)} of total Won</span></div></div>
        <div class="kpi-card upside kpi-primary"><div class="kpi-label"><span>✨</span>New Mix</div><div class="kpi-value" title="${wonTotal > 0 ? fmt.pct(wonNew / wonTotal) : '—'}">${wonTotal > 0 ? fmt.pct(wonNew / wonTotal) : '—'}</div><div class="kpi-meta"><span>${fmt.THB(wonNew)} of total Won</span></div></div>
      </div>

      <div class="section-title">Monthly trend — Renew vs New stacked vs Target</div>
      <div class="card">
        <div class="card-header">
          <div><div class="card-title">Stacked: Won Renew + Won New + Open Renew + Open New</div><div class="card-subtitle">Target line + last year overlay</div></div>
        </div>
        <div class="chart-canvas-tall"><canvas id="combinedMonthChart"></canvas></div>
      </div>

      <div class="section-title">Per-User contribution</div>
      <div class="card">
        <div class="chart-canvas-md"><canvas id="combinedUserChart"></canvas></div>
      </div>

      <div class="section-title">Pipeline composition</div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Renew vs New — value share</div></div></div>
          <div class="chart-canvas-md"><canvas id="renewNewShareChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Pipeline by Status</div><div class="card-subtitle">Won / Commit / Upside / Open / Lost</div></div></div>
          <div class="chart-canvas-md"><canvas id="pipelineStatusChart"></canvas></div>
        </div>
      </div>
    `;

    document.getElementById('combinedPrintBtn').addEventListener('click', () => window.print());

    // Monthly stacked: Won Renew, Won New, Open Renew, Open New + Target line + LY line
    const f = App.Filters.STATE.period;
    const preds = {
      'Won Renew': d => M.isRenew(d) && M.won(d),
      'Won New':   d => NEW.has(d.dealType) && M.won(d),
      'Open Renew': d => M.isRenew(d) && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside'),
      'Open New':   d => NEW.has(d.dealType) && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside'),
    };
    const monthAgg = App.Filters.aggregateByMonthMulti([...renewDeals, ...newDeals], preds, d => d.income, f.from, f.to);

    // Compute per-month target
    const monthlyTarget = monthAgg.labels.map(lbl => {
      const [mon, yr] = lbl.split(' ');
      const monthIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(mon);
      const year = parseInt(yr);
      let total = 0;
      // Renew target — sum from deals with that month
      [...renewDeals].forEach(d => {
        if (!d.expectedClose) return;
        if (d.expectedClose.getFullYear() === year && d.expectedClose.getMonth() === monthIdx) total += d.renewTarget || 0;
      });
      // New target — from settings
      const newT = settings.newSellTargets[year] || {};
      const usersList = settings.users || [];
      const userTeamMap = {};
      usersList.forEach(u => userTeamMap[u.name] = u.team || 'Unassigned');
      const F = App.Filters.STATE;
      Object.entries(newT).forEach(([userName, arr]) => {
        if (F.user.size && !F.user.has(userName)) return;
        if (F.team.size && !F.team.has(userTeamMap[userName] || 'Unassigned')) return;
        if (arr && arr[monthIdx]) total += arr[monthIdx];
      });
      return total;
    });

    new Chart(document.getElementById('combinedMonthChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: monthAgg.labels,
        datasets: [
          { type: 'line', label: 'Total Target', data: monthlyTarget, borderColor: '#2563eb', backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#2563eb', tension: 0.25, order: 0, datalabels: { display: false } },
          { type: 'bar', label: 'Won Renew', data: monthAgg.datasets['Won Renew'], backgroundColor: '#259b24', stack: 'A', datalabels: { display: false } },
          { type: 'bar', label: 'Won New', data: monthAgg.datasets['Won New'], backgroundColor: '#9ccc65', stack: 'A', datalabels: { display: false } },
          { type: 'bar', label: 'Open Renew', data: monthAgg.datasets['Open Renew'], backgroundColor: 'rgba(37,155,36,0.30)', borderColor: '#259b24', borderWidth: 1, borderDash: [3, 3], stack: 'A', datalabels: { display: false } },
          { type: 'bar', label: 'Open New', data: monthAgg.datasets['Open New'], backgroundColor: 'rgba(249,115,22,0.30)', borderColor: '#f97316', borderWidth: 1, borderDash: [3, 3], stack: 'A', datalabels: { display: false } },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', align: 'end', labels: { font: { size: 11 }, usePointStyle: true } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt.THBExact(c.parsed.y)}` } },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: v => fmt.THB(v) }, grid: { color: '#f1f5f9' } },
        },
      },
    });

    // Per-user contribution (stacked Renew + New)
    const userBuckets = {};
    [...renewDeals, ...newDeals].forEach(d => {
      const u = d.responsible || 'Unassigned';
      if (!userBuckets[u]) userBuckets[u] = { wonRenew: 0, wonNew: 0, openRenew: 0, openNew: 0 };
      const isR = M.isRenew(d);
      const isN = NEW.has(d.dealType);
      if (isR && M.won(d)) userBuckets[u].wonRenew += d.income;
      else if (isN && M.won(d)) userBuckets[u].wonNew += d.income;
      else if (isR && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')) userBuckets[u].openRenew += d.income;
      else if (isN && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')) userBuckets[u].openNew += d.income;
    });
    const arr = Object.entries(userBuckets)
      .map(([n, v]) => ({ name: n, ...v, total: v.wonRenew + v.wonNew + v.openRenew + v.openNew }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    new Chart(document.getElementById('combinedUserChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: arr.map(x => x.name),
        datasets: [
          { label: 'Won Renew', data: arr.map(x => x.wonRenew), backgroundColor: '#259b24', stack: 'A' },
          { label: 'Won New', data: arr.map(x => x.wonNew), backgroundColor: '#9ccc65', stack: 'A' },
          { label: 'Open Renew', data: arr.map(x => x.openRenew), backgroundColor: 'rgba(37,155,36,0.30)', borderColor: '#259b24', borderWidth: 1, borderDash: [3,3], stack: 'A' },
          { label: 'Open New', data: arr.map(x => x.openNew), backgroundColor: 'rgba(249,115,22,0.30)', borderColor: '#f97316', borderWidth: 1, borderDash: [3,3], stack: 'A' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { position: 'top', align: 'end', labels: { font: { size: 11 }, usePointStyle: true } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt.THBExact(c.parsed.x)}` } },
          datalabels: { display: false },
        },
        scales: {
          x: { stacked: true, ticks: { callback: v => fmt.THB(v) } },
          y: { stacked: true, grid: { display: false } },
        },
      },
    });

    // Renew vs New share donut (won)
    new Chart(document.getElementById('renewNewShareChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Renew', 'New Sell'],
        datasets: [{ data: [wonRenew, wonNew], backgroundColor: ['#259b24', '#9ccc65'], borderWidth: 2, borderColor: 'white' }],
      },
      options: App.UI.donutOptions({ centerLabel: 'Won Total' }),
    });

    // Pipeline status pie
    const COLORS = App.StatusMapping.COLORS;
    const STATUSES = App.StatusMapping.LIST;
    const statusBuckets = {};
    STATUSES.forEach(s => statusBuckets[s] = 0);
    [...renewDeals, ...newDeals].forEach(d => { statusBuckets[d.status] = (statusBuckets[d.status] || 0) + d.income; });

    new Chart(document.getElementById('pipelineStatusChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: STATUSES,
        datasets: [{ data: STATUSES.map(s => statusBuckets[s]), backgroundColor: STATUSES.map(s => COLORS[s].fill), borderWidth: 2, borderColor: 'white' }],
      },
      options: App.UI.donutOptions({ centerLabel: 'Pipeline' }),
    });
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

  function computeLastYearActual(allDeals) {
    const M = App.Filters.Matchers;
    const F = App.Filters.STATE;
    const from = F.period.from, to = F.period.to;
    if (!from || !to) return 0;
    // Build same period in last year
    const lyFrom = new Date(from.getFullYear() - 1, from.getMonth(), from.getDate());
    const lyTo = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate(), 23, 59, 59);
    let total = 0;
    allDeals.forEach(d => {
      if (!d.expectedClose) return;
      if (d.expectedClose < lyFrom || d.expectedClose > lyTo) return;
      if (d.endCustomer === '1-To-All (Online)') return;
      if (d.status !== 'Won') return;
      if (!M.isRenew(d) && !App.Filters.NEW_TYPES.has(d.dealType)) return;
      total += d.income;
    });
    return total;
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.combined = { render };
})();
