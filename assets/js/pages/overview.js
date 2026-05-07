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
    const printBtn = container.querySelector('#overviewPrintBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    const snapBtn = container.querySelector('#overviewSnapBtn');
    if (snapBtn) snapBtn.addEventListener('click', () => {
      const snap = App.Snapshot.capture();
      if (snap) App.UI.toast(`Snapshot saved — Achievement ${(snap.achievement * 100).toFixed(1)}%`, 'success');
    });
  }

  function renderHTML() {
    return `
      <div class="section-title">
        Key Metrics
        <span class="actions">
          <button class="btn btn-sm" id="overviewPrintBtn">🖨️ Print</button>
          <button class="btn btn-sm" id="overviewSnapBtn">📸 Save snapshot</button>
        </span>
      </div>
      <div class="hero-grid" id="kpiHero"></div>
      <div class="kpi-grid" id="kpiGrid" style="margin-top:14px;"></div>

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

    // Format period label
    const f = App.Filters.STATE.period;
    let periodLabel = '';
    if (f.from && f.to) {
      periodLabel = `${App.UI.fmt.date(f.from)} → ${App.UI.fmt.date(f.to)}`;
    } else {
      periodLabel = 'All time';
    }

    // Big 3 hero cards: Total / Renew / New
    const heroes = [
      { id: 'total', icon: '🎯', label: 'Total', accent: 'var(--primary)',
        achievement: totalAchievement,
        won: wonAllSum, target: totalTargetSum, count: wonCount },
      { id: 'renew', icon: '🔄', label: 'Renew', accent: 'var(--won)',
        achievement: renewAchievement,
        won: wonRenewSum, target: renewTargetSum, count: deals.filter(d => M.isRenew(d) && M.won(d)).length },
      { id: 'new',   icon: '✨', label: 'New',   accent: 'var(--upside)',
        achievement: newAchievement,
        won: wonNewSum, target: newSellTargetSum, count: deals.filter(d => F().NEW_TYPES.has(d.dealType) && M.won(d)).length },
    ];

    document.getElementById('kpiHero').innerHTML = heroes.map(h => {
      const pct = (h.achievement * 100);
      const barWidth = Math.min(100, Math.max(0, pct));
      const targetSet = h.target > 0;
      const wonExact = fmt().THBExact(h.won);
      const targetExact = fmt().THBExact(h.target);
      return `
        <div class="hero-card" style="--accent: ${h.accent};">
          <div class="hero-head">
            <div class="hero-title"><span class="hero-dot"></span>${h.label}</div>
            <div class="hero-achieve-label">Achievement (Won)</div>
          </div>
          <div class="hero-achieve" title="${wonExact} ÷ ${targetExact}">${targetSet ? fmt().pct(h.achievement) : '—'}</div>
          <div class="hero-line">
            <span class="hero-won" title="${wonExact}">Won ${fmt().THBFull(h.won)}</span>
            <span class="hero-divider">/</span>
            <span class="hero-target" title="${targetExact}">Target ${targetSet ? fmt().THBFull(h.target) : '— set in Targets'}</span>
          </div>
          <div class="hero-bar"><div class="hero-bar-fill" style="width:${barWidth}%;"></div></div>
          <div class="hero-meta">
            <span>${h.count.toLocaleString()} won deals</span>
            <span>${periodLabel}</span>
          </div>
        </div>`;
    }).join('');

    // Secondary metrics (smaller cards below)
    const openNewSum = deals.filter(d => F().NEW_TYPES.has(d.dealType) && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')).reduce((s,d) => s + d.income, 0);
    const lostSum = deals.filter(M.lost).reduce((s,d) => s + d.income, 0);
    const secondary = [
      { cls: 'pct', icon: '⚡', label: 'Win Rate', value: fmt().pct(winRate), tip: `${wonCount} won out of ${closedCount} closed`, sub: `${wonCount} won / ${closedCount} closed` },
      { cls: 'coverage', icon: '🛡️', label: 'Renew Coverage', value: fmt().pct(renewCoverage), tip: `Open Renew ${fmt().THBExact(openRenewSum)} ÷ Renew Target ${fmt().THBExact(renewTargetSum)}`, sub: `Open ${fmt().THB(openRenewSum)} ÷ Renew Target` },
      { cls: 'commit', icon: '🔄', label: 'Open Renew Pipeline', value: fmt().THBFull(openRenewSum), tip: fmt().THBExact(openRenewSum), sub: `${deals.filter(d => M.isRenew(d) && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')).length.toLocaleString()} deals` },
      { cls: 'upside', icon: '✨', label: 'Open New Pipeline', value: fmt().THBFull(openNewSum), tip: fmt().THBExact(openNewSum), sub: `${deals.filter(d => F().NEW_TYPES.has(d.dealType) && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')).length.toLocaleString()} deals` },
      { cls: 'lost', icon: '📉', label: 'Lost Total', value: fmt().THBFull(lostSum), tip: fmt().THBExact(lostSum), sub: `${deals.filter(M.lost).length.toLocaleString()} deals` },
    ];
    document.getElementById('kpiGrid').innerHTML = secondary.map(k => `
      <div class="kpi-card ${k.cls}">
        <div class="kpi-label"><span>${k.icon}</span>${k.label}</div>
        <div class="kpi-value" title="${k.tip || ''}">${k.value}</div>
        <div class="kpi-meta"><span>${k.sub}</span></div>
      </div>`).join('');
  }

  /* ----- Auto-generated insights strip ----- */
  function renderInsights(deals) {
    const M = F().Matchers;
    const NEW = F().NEW_TYPES;
    const insights = [];
    const fm = fmt();

    // Top performer (most won value)
    const userWon = {};
    deals.filter(M.won).forEach(d => {
      const u = d.responsible || 'Unassigned';
      userWon[u] = (userWon[u] || 0) + d.income;
    });
    const topEntries = Object.entries(userWon).sort((a, b) => b[1] - a[1]);
    if (topEntries[0]) {
      insights.push({
        icon: '🏆',
        text: `Top performer: <strong>${escapeHtml(topEntries[0][0])}</strong> with <span title="${fm.THBExact(topEntries[0][1])}">${fm.THBFull(topEntries[0][1])}</span> won`,
      });
    }

    // Renewal rate (Won / (Won+Lost) for renew deals)
    const renewDeals = deals.filter(M.isRenew);
    const renewWon = renewDeals.filter(M.won).length;
    const renewLost = renewDeals.filter(M.lost).length;
    if (renewWon + renewLost > 0) {
      const rate = renewWon / (renewWon + renewLost);
      const color = rate >= 0.8 ? 'var(--won)' : rate >= 0.6 ? 'var(--upside)' : 'var(--lost)';
      insights.push({
        icon: '♻️',
        text: `Renewal rate: <strong style="color:${color};">${fm.pct(rate)}</strong> (${renewWon} won / ${renewWon + renewLost} closed)`,
      });
    }

    // Deals due in next 7 days (open + close in next 7d)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7 = new Date(today.getTime() + 7 * 86400 * 1000);
    const dueSoon = deals.filter(d =>
      (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')
      && d.expectedClose && d.expectedClose >= today && d.expectedClose <= in7
    );
    if (dueSoon.length > 0) {
      const total = dueSoon.reduce((s, d) => s + d.income, 0);
      insights.push({
        icon: '📅',
        text: `<strong>${dueSoon.length}</strong> deal${dueSoon.length > 1 ? 's' : ''} due in next 7 days · <span title="${fm.THBExact(total)}">${fm.THBFull(total)}</span>`,
      });
    }

    // Overdue alert
    const overdue = deals.filter(d =>
      (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')
      && d.expectedClose && d.expectedClose < today
    );
    if (overdue.length > 0) {
      const total = overdue.reduce((s, d) => s + d.income, 0);
      insights.push({
        icon: '⚠️',
        accent: 'danger',
        text: `<strong>${overdue.length}</strong> overdue deal${overdue.length > 1 ? 's' : ''} · <span title="${fm.THBExact(total)}">${fm.THBFull(total)}</span> need attention`,
      });
    }

    // Top product type (Won)
    const prodWon = {};
    deals.filter(M.won).forEach(d => {
      const p = d.productType || '(none)';
      if (p === '(none)') return;
      prodWon[p] = (prodWon[p] || 0) + d.income;
    });
    const topProd = Object.entries(prodWon).sort((a, b) => b[1] - a[1])[0];
    if (topProd) {
      insights.push({
        icon: '📦',
        text: `Top product: <strong>${escapeHtml(topProd[0])}</strong> with <span title="${fm.THBExact(topProd[1])}">${fm.THBFull(topProd[1])}</span> won`,
      });
    }

    // Snapshot trend (vs last snapshot if exists)
    const snaps = (App.Settings.load().snapshots || []).slice().sort((a, b) => b.timestamp - a.timestamp);
    if (snaps.length >= 2) {
      const cur = snaps[0];
      const prev = snaps[1];
      const diff = cur.achievement - prev.achievement;
      if (Math.abs(diff) > 0.0001) {
        const arrow = diff > 0 ? '↑' : '↓';
        const color = diff > 0 ? 'var(--won)' : 'var(--lost)';
        insights.push({
          icon: '📈',
          text: `Achievement <span style="color:${color}; font-weight:700;">${arrow} ${fm.pct(Math.abs(diff))}</span> vs last snapshot (${prev.date})`,
        });
      }
    }

    const el = document.getElementById('insightsStrip');
    if (!el) return;
    if (insights.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = insights.map(ins => `
      <div class="insight ${ins.accent || ''}">
        <span class="insight-ico">${ins.icon}</span>
        <span class="insight-text">${ins.text}</span>
      </div>
    `).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderStatusByMonth(deals) {
    const f = F().STATE.period;
    const COLORS = App.StatusMapping.COLORS;
    const STATUSES = App.StatusMapping.LIST;
    const predicates = {};
    STATUSES.forEach(s => predicates[s] = d => d.status === s);

    const agg = F().aggregateByMonthMulti(deals, predicates, d => d.income, f.from, f.to);

    const ctx = document.getElementById('chartStatusMonth').getContext('2d');
    const MONTH_NAMES_LOCAL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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
        onClick: (event, elements, chart) => {
          if (!elements.length) return;
          const el = elements[0];
          const status = STATUSES[el.datasetIndex];
          const lbl = agg.labels[el.index];
          const [mon, yr] = lbl.split(' ');
          const monthIdx = MONTH_NAMES_LOCAL.indexOf(mon);
          const year = parseInt(yr);
          const matched = deals.filter(d => d.status === status && d.expectedClose
            && d.expectedClose.getMonth() === monthIdx && d.expectedClose.getFullYear() === year);
          App.UI.drillModal({
            title: `${status} deals — ${lbl}`,
            subtitle: 'Filtered by current period and other dashboard filters',
            deals: matched,
          });
        },
        onHover: (e, els) => { e.native && (e.native.target.style.cursor = els.length ? 'pointer' : 'default'); },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (c) => c.dataset.label + ': ' + fmt().THBExact(c.parsed.y) },
          },
          datalabels: { display: false },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { stacked: true, ticks: { callback: v => fmt().THB(v), font: { size: 11 } }, grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#f1f5f9' } },
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
        onClick: (event, elements) => {
          if (!elements.length) return;
          const el = elements[0];
          const status = STATUSES[el.datasetIndex];
          const userName = arr[el.index].name;
          const matched = deals.filter(d => d.status === status && (d.responsible || 'Unassigned') === userName);
          App.UI.drillModal({
            title: `${userName} — ${status} deals`,
            subtitle: 'Filtered by current period and other dashboard filters',
            deals: matched,
          });
        },
        onHover: (e, els) => { e.native && (e.native.target.style.cursor = els.length ? 'pointer' : 'default'); },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => c.dataset.label + ': ' + fmt().THBExact(c.parsed.x) } },
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
