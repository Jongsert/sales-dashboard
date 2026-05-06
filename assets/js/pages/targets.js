/* ========================================================================
   Page: Targets — Set New Sell targets per user × per month
   Renew Target is auto-computed from data (Open Renew × renewTarget field).
   ======================================================================== */
(function () {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function render(container, parsed) {
    const settings = App.Settings.load();
    const users = (settings.users || []).filter(u => u.active !== false);
    const teams = settings.teams || [];

    if (users.length === 0) {
      container.innerHTML = `
        <div class="placeholder-page">
          <div class="icon">🎯</div>
          <h2>No users yet</h2>
          <p>Upload Bitrix data first, or add users in <a href="#/teams">Teams</a> tab.</p>
        </div>`;
      return;
    }

    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

    container.innerHTML = `
      <div class="section-title">
        New Sell Targets
        <span class="actions">
          <select id="yearPicker" class="select-input" style="font-weight:600;">
            ${yearOptions.map(y => `<option ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <select id="teamFilter" class="select-input">
            <option value="">All teams</option>
            ${teams.map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
            <option value="Unassigned">Unassigned</option>
          </select>
          <button class="btn btn-sm" id="copyPrevBtn">Copy from prev year</button>
          <button class="btn btn-sm" id="bulkFillBtn">Bulk fill...</button>
          <button class="btn btn-sm" id="distributeBtn">Smart distribute...</button>
          <button class="btn btn-sm" id="exportTargetsBtn">⬇️ Export CSV</button>
        </span>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title" id="targetTableTitle">Year ${currentYear} · New Sell only</div>
            <div class="card-subtitle">Click any cell to edit. Auto-saves on change. Renew Target is auto-computed from Bitrix data.</div>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="targets-tbl" id="targetsTable"></table>
        </div>
      </div>

      ${parsed ? `
        <div class="section-title">Renew Target — auto from data</div>
        <div class="card">
          <div class="card-subtitle" style="margin-bottom:8px;">รวม Renew Target จาก deal ใน Renew pipelines (Subscription Renew + Auto Renew)</div>
          <div style="overflow-x:auto;">
            <table class="targets-tbl" id="renewTable"></table>
          </div>
        </div>
      ` : ''}
    `;

    document.getElementById('yearPicker').addEventListener('change', () => render(container, parsed));
    document.getElementById('teamFilter').addEventListener('change', () => renderTable());
    document.getElementById('copyPrevBtn').addEventListener('click', copyFromPrev);
    document.getElementById('bulkFillBtn').addEventListener('click', bulkFill);
    document.getElementById('distributeBtn').addEventListener('click', smartDistribute);
    document.getElementById('exportTargetsBtn').addEventListener('click', exportCSV);

    function selectedYear() { return parseInt(document.getElementById('yearPicker').value); }
    function selectedTeam() { return document.getElementById('teamFilter').value; }

    function renderTable() {
      const year = selectedYear();
      const teamFlt = selectedTeam();
      const visibleUsers = users.filter(u => !teamFlt || u.team === teamFlt);

      // Group by team for visual grouping
      const grouped = {};
      visibleUsers.forEach(u => {
        const t = u.team || 'Unassigned';
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(u);
      });
      const teamOrder = teams.sort((a, b) => (a.order||0) - (b.order||0)).map(t => t.name);
      const orderedTeams = [
        ...teamOrder.filter(t => grouped[t]),
        ...Object.keys(grouped).filter(t => !teamOrder.includes(t)),
      ];

      const monthTotals = new Array(12).fill(0);
      const teamTotals = {};
      let grandTotal = 0;

      let bodyHtml = '';
      orderedTeams.forEach(teamName => {
        const teamUsers = grouped[teamName];
        const teamColor = (teams.find(t => t.name === teamName)?.color) || '#94a3b8';
        const teamMonthTotals = new Array(12).fill(0);
        teamTotals[teamName] = 0;

        bodyHtml += `<tr class="team-row">
          <td colspan="14" style="background: var(--surface-2); padding:6px 12px;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${teamColor}; margin-right:8px;"></span>
            <strong>${teamName}</strong>
            <span style="color: var(--text-muted); font-size:11px; margin-left:8px;">${teamUsers.length} users</span>
          </td>
        </tr>`;

        teamUsers.forEach(u => {
          let userTotal = 0;
          let cells = '';
          for (let m = 0; m < 12; m++) {
            const val = App.Settings.getNewSellTarget(year, u.name, m + 1);
            userTotal += val;
            teamMonthTotals[m] += val;
            monthTotals[m] += val;
            cells += `<td class="num"><input type="number" class="target-cell" data-user="${u.name}" data-month="${m + 1}" value="${val || ''}" placeholder="0" min="0"></td>`;
          }
          teamTotals[teamName] += userTotal;
          grandTotal += userTotal;
          bodyHtml += `<tr>
            <td>${u.name}</td>
            ${cells}
            <td class="num user-total" style="font-weight:700;">${App.UI.fmt.THB(userTotal)}</td>
          </tr>`;
        });

        // Team subtotal row
        bodyHtml += `<tr class="team-total">
          <td style="font-weight:600; color: var(--text-muted);">${teamName} subtotal</td>
          ${teamMonthTotals.map(v => `<td class="num" style="font-weight:600; color:var(--text-muted);">${App.UI.fmt.THB(v)}</td>`).join('')}
          <td class="num" style="font-weight:700; background:${teamColor}20;">${App.UI.fmt.THB(teamTotals[teamName])}</td>
        </tr>`;
      });

      // Header
      const headHtml = `<thead>
        <tr>
          <th style="min-width:160px; text-align:left;">User</th>
          ${MONTHS.map(m => `<th class="num">${m}</th>`).join('')}
          <th class="num" style="min-width:90px; background: var(--primary-light);">Year Total</th>
        </tr>
      </thead>`;

      // Grand total footer
      const footHtml = `<tfoot>
        <tr class="grand-total">
          <td style="font-weight:800;">All total</td>
          ${monthTotals.map(v => `<td class="num" style="font-weight:700;">${App.UI.fmt.THB(v)}</td>`).join('')}
          <td class="num" style="font-weight:800; background: var(--primary-light); color: var(--primary-dark);">${App.UI.fmt.THBFull(grandTotal)}</td>
        </tr>
      </tfoot>`;

      document.getElementById('targetsTable').innerHTML = headHtml + '<tbody>' + bodyHtml + '</tbody>' + footHtml;
      document.getElementById('targetTableTitle').textContent = `Year ${year} · New Sell only · Total ${App.UI.fmt.THBFull(grandTotal)}`;

      // Wire up cell change handlers
      document.querySelectorAll('.target-cell').forEach(inp => {
        inp.addEventListener('change', () => {
          const u = inp.dataset.user;
          const m = parseInt(inp.dataset.month);
          const v = parseFloat(inp.value) || 0;
          App.Settings.setNewSellTarget(year, u, m, v);
          renderTable();   // re-render to update totals
        });
        inp.addEventListener('focus', () => inp.select());
      });

      // Renew Target table (read-only from data)
      if (parsed && document.getElementById('renewTable')) renderRenewTable(year);
    }

    function renderRenewTable(year) {
      const monthVal = new Array(12).fill(0);
      const userVal = {};
      parsed.deals.forEach(d => {
        if (!App.Filters.Matchers.isRenew(d)) return;
        if (!d.expectedClose) return;
        if (d.expectedClose.getFullYear() !== year) return;
        const m = d.expectedClose.getMonth();
        const rt = d.renewTarget || d.income || 0;
        monthVal[m] += rt;
        const u = d.responsible || 'Unassigned';
        if (!userVal[u]) userVal[u] = new Array(12).fill(0);
        userVal[u][m] += rt;
      });
      const sorted = Object.entries(userVal).sort((a, b) => {
        const sa = a[1].reduce((x, v) => x + v, 0);
        const sb = b[1].reduce((x, v) => x + v, 0);
        return sb - sa;
      });
      const grand = monthVal.reduce((s, v) => s + v, 0);
      const headHtml = `<thead><tr>
        <th style="min-width:160px;">User</th>
        ${MONTHS.map(m => `<th class="num">${m}</th>`).join('')}
        <th class="num">Year Total</th>
      </tr></thead>`;
      const bodyHtml = sorted.map(([u, arr]) => {
        const sum = arr.reduce((s, v) => s + v, 0);
        return `<tr>
          <td>${u}</td>
          ${arr.map(v => `<td class="num" style="color:${v ? 'var(--text)' : 'var(--text-faint)'};">${v ? App.UI.fmt.THB(v) : '—'}</td>`).join('')}
          <td class="num" style="font-weight:700;">${App.UI.fmt.THB(sum)}</td>
        </tr>`;
      }).join('');
      const footHtml = `<tfoot><tr class="grand-total">
        <td style="font-weight:800;">All total</td>
        ${monthVal.map(v => `<td class="num" style="font-weight:700;">${App.UI.fmt.THB(v)}</td>`).join('')}
        <td class="num" style="font-weight:800; background: var(--primary-light);">${App.UI.fmt.THBFull(grand)}</td>
      </tr></tfoot>`;
      document.getElementById('renewTable').innerHTML = headHtml + '<tbody>' + bodyHtml + '</tbody>' + footHtml;
    }

    function copyFromPrev() {
      const year = selectedYear();
      const prev = year - 1;
      App.UI.confirm(`Copy targets from ${prev} → ${year}? Existing values will be overwritten.`, () => {
        const settings = App.Settings.load();
        const prevData = settings.newSellTargets[prev] || {};
        if (!settings.newSellTargets[year]) settings.newSellTargets[year] = {};
        Object.entries(prevData).forEach(([userName, arr]) => {
          settings.newSellTargets[year][userName] = arr.slice();
        });
        App.Settings.save();
        renderTable();
        App.UI.toast(`Copied ${Object.keys(prevData).length} users from ${prev}`, 'success');
      });
    }

    function bulkFill() {
      const body = document.createElement('div');
      body.innerHTML = `
        <div style="display:grid; gap:12px;">
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600;">Apply to</div>
            <select id="bfScope" class="select-input" style="width:100%; padding:8px;">
              <option value="all">All users</option>
              ${(settings.teams || []).map(t => `<option value="team:${t.name}">Team: ${t.name}</option>`).join('')}
              ${users.map(u => `<option value="user:${u.name}">User: ${u.name}</option>`).join('')}
            </select>
          </label>
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600;">Months</div>
            <select id="bfMonths" class="select-input" style="width:100%; padding:8px;">
              <option value="all">All 12 months</option>
              ${MONTHS.map((m, i) => `<option value="${i+1}">${m}</option>`).join('')}
            </select>
          </label>
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600;">Value (THB)</div>
            <input id="bfValue" type="number" class="select-input" style="width:100%; padding:8px;" value="0" min="0">
          </label>
          <div style="font-size:11px; color: var(--text-muted);">⚠️ This will overwrite existing values for the selected scope and months.</div>
        </div>
      `;
      const m = App.UI.modal({ title: 'Bulk fill targets', body, footer: ' ' });
      const f = m.el.querySelector('.modal-footer');
      f.innerHTML = '';
      const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => m.close());
      const ok = document.createElement('button'); ok.className = 'btn btn-primary'; ok.textContent = 'Apply';
      ok.addEventListener('click', () => {
        const year = selectedYear();
        const scope = m.el.querySelector('#bfScope').value;
        const monthSel = m.el.querySelector('#bfMonths').value;
        const value = parseFloat(m.el.querySelector('#bfValue').value) || 0;
        const months = monthSel === 'all' ? [1,2,3,4,5,6,7,8,9,10,11,12] : [parseInt(monthSel)];

        let targetUsers = users;
        if (scope.startsWith('team:')) targetUsers = users.filter(u => u.team === scope.slice(5));
        else if (scope.startsWith('user:')) targetUsers = users.filter(u => u.name === scope.slice(5));

        targetUsers.forEach(u => months.forEach(mo => App.Settings.setNewSellTarget(year, u.name, mo, value)));
        m.close();
        renderTable();
        App.UI.toast(`Filled ${targetUsers.length} users × ${months.length} months`, 'success');
      });
      f.appendChild(cancel); f.appendChild(ok);
    }

    function smartDistribute() {
      const body = document.createElement('div');
      body.innerHTML = `
        <div style="display:grid; gap:12px;">
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600;">Apply to</div>
            <select id="sdScope" class="select-input" style="width:100%; padding:8px;">
              ${(settings.teams || []).map(t => `<option value="team:${t.name}">Team: ${t.name}</option>`).join('')}
              ${users.map(u => `<option value="user:${u.name}">User: ${u.name}</option>`).join('')}
            </select>
          </label>
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600;">Year total (THB)</div>
            <input id="sdTotal" type="number" class="select-input" style="width:100%; padding:8px;" value="0" min="0">
          </label>
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600;">Distribution</div>
            <select id="sdMode" class="select-input" style="width:100%; padding:8px;">
              <option value="even">Even (÷ 12 months)</option>
              <option value="prevYear">Same proportion as previous year</option>
              <option value="renewProp">Same proportion as Renew Target this year</option>
            </select>
          </label>
        </div>
      `;
      const m = App.UI.modal({ title: 'Smart distribute', body, footer: ' ' });
      const f = m.el.querySelector('.modal-footer');
      f.innerHTML = '';
      const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => m.close());
      const ok = document.createElement('button'); ok.className = 'btn btn-primary'; ok.textContent = 'Apply';
      ok.addEventListener('click', () => {
        const year = selectedYear();
        const scope = m.el.querySelector('#sdScope').value;
        const total = parseFloat(m.el.querySelector('#sdTotal').value) || 0;
        const mode = m.el.querySelector('#sdMode').value;

        let targetUsers = users;
        if (scope.startsWith('team:')) targetUsers = users.filter(u => u.team === scope.slice(5));
        else if (scope.startsWith('user:')) targetUsers = users.filter(u => u.name === scope.slice(5));
        if (targetUsers.length === 0) { App.UI.toast('No users in scope', 'error'); return; }

        // Distribute total across users equally first
        const perUser = total / targetUsers.length;

        // Distribute monthly within each user
        targetUsers.forEach(u => {
          let weights = new Array(12).fill(1);
          if (mode === 'prevYear') {
            const prev = App.Settings.load().newSellTargets[year - 1]?.[u.name];
            if (prev && prev.some(v => v > 0)) weights = prev;
          } else if (mode === 'renewProp' && parsed) {
            const monthly = new Array(12).fill(0);
            parsed.deals.forEach(d => {
              if (d.responsible !== u.name) return;
              if (!App.Filters.Matchers.isRenew(d)) return;
              if (!d.expectedClose || d.expectedClose.getFullYear() !== year) return;
              monthly[d.expectedClose.getMonth()] += d.renewTarget || d.income || 0;
            });
            if (monthly.some(v => v > 0)) weights = monthly;
          }
          const wSum = weights.reduce((s, v) => s + v, 0) || 12;
          for (let m = 0; m < 12; m++) {
            const v = (weights[m] / wSum) * perUser;
            App.Settings.setNewSellTarget(year, u.name, m + 1, Math.round(v));
          }
        });
        m.close();
        renderTable();
        App.UI.toast(`Distributed ${App.UI.fmt.THBFull(total)} across ${targetUsers.length} users`, 'success');
      });
      f.appendChild(cancel); f.appendChild(ok);
    }

    function exportCSV() {
      const year = selectedYear();
      const rows = [['User', 'Team', ...MONTHS, 'Year Total']];
      users.forEach(u => {
        const arr = (App.Settings.load().newSellTargets[year] || {})[u.name] || new Array(12).fill(0);
        const total = arr.reduce((s, v) => s + v, 0);
        rows.push([u.name, u.team || 'Unassigned', ...arr, total]);
      });
      const csv = rows.map(r => r.map(c => {
        const s = String(c);
        return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')).join('\n');
      const today = new Date().toISOString().slice(0, 10);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-dashboard-targets_${year}_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      App.UI.toast(`Exported targets for ${year}`, 'success');
    }

    renderTable();
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.targets = { render };
})();
