/* ========================================================================
   Page: Diff — Compare 2 snapshots side-by-side
   Used in weekly meetings to see week-over-week change.
   ======================================================================== */
(function () {
  const STATE = {
    fromTs: null,
    toTs: null,
    initialized: false,
  };

  function render(container, parsed) {
    const settings = App.Settings.load();
    const snapshots = (settings.snapshots || []).slice().sort((a, b) => b.timestamp - a.timestamp);

    const tr = App.i18n.t;
    if (snapshots.length < 2) {
      container.innerHTML = `
        <div class="placeholder-page">
          <div class="icon">📊</div>
          <h2>${tr('diff.placeholderTitle')}</h2>
          <p>${tr('diff.placeholderText')}<br>
          Take snapshots over time (Settings → Snapshot History or 📸 Save snapshot in Overview).<br>
          Currently: <strong>${snapshots.length}</strong> snapshot${snapshots.length === 1 ? '' : 's'} captured.</p>
          ${snapshots.length === 0
            ? `<button class="btn btn-primary btn-lg" id="diffSnapBtn">${tr('diff.takeFirst')}</button>`
            : `<button class="btn btn-primary btn-lg" id="diffSnapBtn">${tr('diff.takeAnother')}</button>`}
        </div>`;
      const b = container.querySelector('#diffSnapBtn');
      if (b) b.addEventListener('click', () => {
        const snap = App.Snapshot.capture();
        if (snap) {
          App.UI.toast('Snapshot saved · take another after the next data update to compare', 'success');
          render(container, parsed);
        }
      });
      return;
    }

    // Default: latest 2 snapshots
    if (!STATE.initialized) {
      STATE.toTs = snapshots[0].timestamp;
      STATE.fromTs = snapshots[1].timestamp;
      STATE.initialized = true;
    }

    // Validate stored timestamps still exist
    const tsSet = new Set(snapshots.map(s => s.timestamp));
    if (!tsSet.has(STATE.fromTs)) STATE.fromTs = snapshots[1].timestamp;
    if (!tsSet.has(STATE.toTs)) STATE.toTs = snapshots[0].timestamp;

    const fromSnap = snapshots.find(s => s.timestamp === STATE.fromTs);
    const toSnap = snapshots.find(s => s.timestamp === STATE.toTs);

    container.innerHTML = `
      <div class="section-title">
        ${tr('diff.title')}
        <span class="actions">
          <button class="btn btn-sm" id="diffPrintBtn">${tr('btn.print')}</button>
          <button class="btn btn-sm" id="diffShotBtn">📷 Screenshot</button>
        </span>
      </div>

      <div class="card">
        <div class="diff-picker-row">
          <div class="diff-picker">
            <div class="diff-picker-label">${tr('diff.from')}</div>
            <select id="diffFrom" class="select-input">
              ${snapshots.map(s => `<option value="${s.timestamp}" ${s.timestamp === STATE.fromTs ? 'selected' : ''}>${s.date} ${s.time || ''}${s.label ? ' · ' + s.label : ''}</option>`).join('')}
            </select>
          </div>
          <div class="diff-arrow" aria-hidden="true">→</div>
          <div class="diff-picker">
            <div class="diff-picker-label">${tr('diff.to')}</div>
            <select id="diffTo" class="select-input">
              ${snapshots.map(s => `<option value="${s.timestamp}" ${s.timestamp === STATE.toTs ? 'selected' : ''}>${s.date} ${s.time || ''}${s.label ? ' · ' + s.label : ''}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-sm" id="diffSwap" title="${tr('diff.swap')}">${tr('diff.swap')}</button>
        </div>
      </div>

      <div class="section-title">${tr('sec.headlineKpis')}</div>
      <div class="diff-kpi-grid" id="diffKpiGrid"></div>

      <div class="section-title">${tr('sec.statusBreakdown')}</div>
      <div class="card"><div id="diffStatusTable"></div></div>

      <div class="section-title">${tr('sec.topPerformers')}</div>
      <div class="card"><div id="diffPerformers"></div></div>

      <div class="section-title">${tr('sec.diffTrend')}</div>
      <div class="card">
        <div style="height: 220px;"><canvas id="diffTrendChart"></canvas></div>
      </div>
    `;

    renderKPIs(fromSnap, toSnap);
    renderStatusTable(fromSnap, toSnap);
    renderPerformers(fromSnap, toSnap);
    renderTrendChart(snapshots);

    container.querySelector('#diffFrom').addEventListener('change', e => {
      STATE.fromTs = parseInt(e.target.value);
      render(container, parsed);
    });
    container.querySelector('#diffTo').addEventListener('change', e => {
      STATE.toTs = parseInt(e.target.value);
      render(container, parsed);
    });
    container.querySelector('#diffSwap').addEventListener('click', () => {
      [STATE.fromTs, STATE.toTs] = [STATE.toTs, STATE.fromTs];
      render(container, parsed);
    });
    container.querySelector('#diffPrintBtn').addEventListener('click', () => window.print());
    const dShot = container.querySelector('#diffShotBtn');
    if (dShot) dShot.addEventListener('click', () => {
      const today = App.UI.fmt.todayLocalISO();
      App.UI.screenshotElement(document.getElementById('main'), `diff_${today}.png`);
    });
  }

  function delta(from, to) {
    const f = Number(from) || 0;
    const t = Number(to) || 0;
    const abs = t - f;
    const pct = f !== 0 ? abs / f : (t > 0 ? 1 : 0);
    return { abs, pct, hasFrom: f !== 0 };
  }

  function deltaCell(from, to, formatter) {
    const fmt = formatter || App.UI.fmt.THBFull;
    const d = delta(from, to);
    const cls = d.abs > 0 ? 'pos' : d.abs < 0 ? 'neg' : 'zero';
    const sign = d.abs > 0 ? '+' : '';
    const arrow = d.abs > 0 ? '▲' : d.abs < 0 ? '▼' : '·';
    const pctText = d.hasFrom ? ` (${sign}${(d.pct * 100).toFixed(1)}%)` : '';
    return `<span class="delta-${cls}">${arrow} ${sign}${fmt(d.abs)}${pctText}</span>`;
  }

  function renderKPIs(from, to) {
    const fmt = App.UI.fmt;
    const cards = [
      { key: 'achievement', icon: '🎯', label: 'Achievement %', f: from.achievement, t: to.achievement, format: v => fmt.pct(v) },
      { key: 'wonTotal', icon: '🏆', label: 'Won Total', f: from.wonTotal, t: to.wonTotal, format: v => fmt.THBFull(v) },
      { key: 'totalTarget', icon: '📌', label: 'Total Target', f: from.totalTarget, t: to.totalTarget, format: v => fmt.THBFull(v) },
      { key: 'wonRenew', icon: '🔄', label: 'Won Renew', f: from.wonRenew, t: to.wonRenew, format: v => fmt.THBFull(v) },
      { key: 'wonNew', icon: '✨', label: 'Won New', f: from.wonNew, t: to.wonNew, format: v => fmt.THBFull(v) },
      { key: 'openRenew', icon: '🛡️', label: 'Open Renew', f: from.openRenew, t: to.openRenew, format: v => fmt.THBFull(v) },
      { key: 'commitTotal', icon: '🟢', label: 'Commit', f: from.commitTotal, t: to.commitTotal, format: v => fmt.THBFull(v) },
      { key: 'upsideTotal', icon: '🟠', label: 'Upside', f: from.upsideTotal, t: to.upsideTotal, format: v => fmt.THBFull(v) },
      { key: 'lostTotal', icon: '📉', label: 'Lost', f: from.lostTotal, t: to.lostTotal, format: v => fmt.THBFull(v), inverse: true },
      { key: 'dealCount', icon: '#', label: 'Deal Count', f: from.dealCount, t: to.dealCount, format: v => fmt.int(v) },
    ];

    document.getElementById('diffKpiGrid').innerHTML = cards.map(c => {
      const d = delta(c.f, c.t);
      const isPos = c.inverse ? d.abs < 0 : d.abs > 0;
      const isNeg = c.inverse ? d.abs > 0 : d.abs < 0;
      const cls = isPos ? 'pos' : isNeg ? 'neg' : 'zero';
      const arrow = d.abs > 0 ? '▲' : d.abs < 0 ? '▼' : '·';
      const sign = d.abs > 0 ? '+' : '';
      const pctText = d.hasFrom ? `${sign}${(d.pct * 100).toFixed(1)}%` : '—';
      return `
        <div class="diff-card diff-${cls}">
          <div class="diff-card-label"><span>${c.icon}</span>${c.label}</div>
          <div class="diff-card-values">
            <div class="diff-card-from"><span class="diff-tag">From</span> <span title="${c.f}">${c.format(c.f)}</span></div>
            <div class="diff-card-to"><span class="diff-tag">To</span> <strong title="${c.t}">${c.format(c.t)}</strong></div>
          </div>
          <div class="diff-card-delta ${cls}">
            ${arrow} ${sign}${c.format(d.abs)} <span class="diff-card-pct">${pctText}</span>
          </div>
        </div>`;
    }).join('');
  }

  function renderStatusTable(from, to) {
    const rows = [
      { label: 'Won (all)', f: from.wonTotal, t: to.wonTotal },
      { label: '  · Won Renew', f: from.wonRenew, t: to.wonRenew, sub: true },
      { label: '  · Won New', f: from.wonNew, t: to.wonNew, sub: true },
      { label: 'Commit', f: from.commitTotal, t: to.commitTotal },
      { label: 'Upside', f: from.upsideTotal, t: to.upsideTotal },
      { label: 'Open Renew', f: from.openRenew, t: to.openRenew },
      { label: 'Open New', f: from.openNew, t: to.openNew },
      { label: 'Lost', f: from.lostTotal, t: to.lostTotal, inverse: true },
    ];
    const fmt = App.UI.fmt;
    document.getElementById('diffStatusTable').innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Status</th>
            <th class="num">From <span style="color:var(--text-faint); font-weight:400;">${from.date}</span></th>
            <th class="num">To <span style="color:var(--text-faint); font-weight:400;">${to.date}</span></th>
            <th class="num">Δ Change</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr ${r.sub ? 'style="color:var(--text-muted); font-size:12px;"' : ''}>
              <td>${escapeHtml(r.label)}</td>
              <td class="num">${fmt.THBFull(r.f)}</td>
              <td class="num"><strong>${fmt.THBFull(r.t)}</strong></td>
              <td class="num">${deltaCell(r.f, r.t, fmt.THBFull)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderPerformers(from, to) {
    const fromMap = {};
    (from.topUsers || []).forEach(u => fromMap[u.name] = u.won || 0);
    const toMap = {};
    (to.topUsers || []).forEach(u => toMap[u.name] = u.won || 0);
    const allNames = new Set([...Object.keys(fromMap), ...Object.keys(toMap)]);
    const rows = Array.from(allNames).map(name => ({
      name,
      f: fromMap[name] || 0,
      t: toMap[name] || 0,
    })).sort((a, b) => b.t - a.t);

    if (rows.length === 0) {
      document.getElementById('diffPerformers').innerHTML = '<p style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">No performer data in either snapshot</p>';
      return;
    }

    const fmt = App.UI.fmt;
    document.getElementById('diffPerformers').innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:36px">#</th>
            <th>Name</th>
            <th class="num">From</th>
            <th class="num">To</th>
            <th class="num">Δ Change</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => {
            const d = delta(r.f, r.t);
            const isNew = r.f === 0 && r.t > 0;
            const isGone = r.f > 0 && r.t === 0;
            return `<tr>
              <td>${i + 1}</td>
              <td><strong>${escapeHtml(r.name)}</strong>${isNew ? ' <span class="diff-tag pos">NEW</span>' : ''}${isGone ? ' <span class="diff-tag neg">GONE</span>' : ''}</td>
              <td class="num">${fmt.THBFull(r.f)}</td>
              <td class="num"><strong>${fmt.THBFull(r.t)}</strong></td>
              <td class="num">${deltaCell(r.f, r.t, fmt.THBFull)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  let trendChart = null;
  function renderTrendChart(snapshots) {
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    const recent = snapshots.slice(0, 12).reverse();   // oldest → newest
    const ctx = document.getElementById('diffTrendChart').getContext('2d');
    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: recent.map(s => s.date),
        datasets: [
          {
            label: 'Achievement %',
            data: recent.map(s => (s.achievement || 0) * 100),
            borderColor: '#259b24',
            backgroundColor: 'rgba(37,155,36,0.15)',
            borderWidth: 2.5,
            tension: 0.25,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#259b24',
            datalabels: { display: false },
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => 'Achievement: ' + c.parsed.y.toFixed(1) + '%' } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: {
            ticks: { callback: v => v.toFixed(0) + '%', font: { size: 10 } },
            grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#f1f5f9' },
          },
        },
      },
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.diff = { render };
})();
