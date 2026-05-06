/* ========================================================================
   Page: Targets — Set New Sell targets per user × per month
   ======================================================================== */
(function () {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const STATE = {
    year: new Date().getFullYear(),
    teamFilter: '',
  };

  function render(container, parsed) {
    const settings = App.Settings.load();
    const users = (settings.users || []).filter(u => u.active !== false);
    const teams = settings.teams || [];

    if (users.length === 0) {
      container.innerHTML = `
        <div class="placeholder-page">
          <div class="icon">🎯</div>
          <h2>No users yet</h2>
          <p>Upload Bitrix data first — users are auto-detected.<br>
          You can map them to teams in <a href="#/teams">Teams</a>.</p>
        </div>`;
      return;
    }

    const yearOptions = [STATE.year - 2, STATE.year - 1, STATE.year, STATE.year + 1, STATE.year + 2];

    // Build full team list (from settings.teams + Unassigned)
    const allTeamNames = [...new Set([
      ...teams.sort((a, b) => (a.order || 0) - (b.order || 0)).map(t => t.name),
      ...users.map(u => u.team || 'Unassigned'),
    ])];
    const orderedTeams = allTeamNames.filter(n => n !== 'Unassigned');
    if (users.some(u => !u.team || u.team === 'Unassigned')) orderedTeams.push('Unassigned');

    container.innerHTML = `
      <div class="section-title">
        New Sell Targets
        <span class="actions">
          <select id="yearPicker" class="select-input" style="font-weight:600;">
            ${yearOptions.map(y => `<option value="${y}" ${y === STATE.year ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <select id="teamFilter" class="select-input">
            <option value="">All teams</option>
            ${orderedTeams.map(t => `<option value="${t}" ${t === STATE.teamFilter ? 'selected' : ''}>${t}</option>`).join('')}
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
            <div class="card-title" id="targetTableTitle">Year ${STATE.year} · New Sell only</div>
            <div class="card-subtitle">Click any cell to edit · Auto-saves on change · Renew Target is auto-computed below</div>
          </div>
        </div>
        <div class="targets-wrap">
          <table class="targets-tbl" id="targetsTable"></table>
        </div>
      </div>

      ${parsed ? `
        <div class="section-title">Renew Target — auto from data (Subscription Renew + Auto Renew)</div>
        <div class="card">
          <div class="targets-wrap">
            <table class="targets-tbl" id="renewTable"></table>
          </div>
        </div>
      ` : ''}
    `;

    document.getElementById('yearPicker').addEventListener('change', (e) => {
      STATE.year = parseInt(e.target.value);
      document.getElementById('targetTableTitle').textContent = `Year ${STATE.year} · New Sell only`;
      renderTable();
    });
    document.getElementById('teamFilter').addEventListener('change', (e) => {
      STATE.teamFilter = e.target.value;
      renderTable();
    });
    document.getElementById('copyPrevBtn').addEventListener('click', copyFromPrev);
    document.getElementById('bulkFillBtn').addEventListener('click', bulkFill);
    document.getElementById('distributeBtn').addEventListener('click', smartDistribute);
    document.getElementById('exportTargetsBtn').addEventListener('click', exportCSV);

    function renderTable() {
      const year = STATE.year;
      const teamFlt = STATE.teamFilter;
      const visibleUsers = users.filter(u => !teamFlt || (u.team || 'Unassigned') === teamFlt);

      // Group by team
      const grouped = {};
      visibleUsers.forEach(u => {
        const t = u.team || 'Unassigned';
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(u);
      });
      const teamsHere = orderedTeams.filter(t => grouped[t] && grouped[t].length > 0);

      const monthTotals = new Array(12).fill(0);
      let grandTotal = 0;

      let bodyHtml = '';
      teamsHere.forEach(teamName => {
        const teamUsers = grouped[teamName];
        const teamObj = teams.find(t => t.name === teamName);
        const teamColor = teamObj ? teamObj.color : '#94a3b8';
        const teamMonthTotals = new Array(12).fill(0);
        let teamSum = 0;

        bodyHtml += `<tr class="team-row">
          <td colspan="14" style="background: var(--surface-2); padding:6px 12px;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${teamColor}; margin-right:8px;"></span>
            <strong>${escapeHtml(teamName)}</strong>
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
            const displayVal = val ? App.UI.fmt.comma2(val) : '';
            cells += `<td class="input-cell"><input type="text" class="target-cell" data-user="${escapeAttr(u.name)}" data-month="${m + 1}" data-raw="${val}" value="${displayVal}" placeholder="0" inputmode="decimal"></td>`;
          }
          teamSum += userTotal;
          grandTotal += userTotal;
          bodyHtml += `<tr>
            <td>${escapeHtml(u.name)}</td>
            ${cells}
            <td class="num user-total">${App.UI.fmt.comma2(userTotal)}</td>
          </tr>`;
        });

        // Subtotal row — full numbers with commas
        bodyHtml += `<tr class="team-total">
          <td>${escapeHtml(teamName)} subtotal</td>
          ${teamMonthTotals.map(v => `<td class="num">${App.UI.fmt.comma2(v)}</td>`).join('')}
          <td class="num" style="background:${teamColor}30;">${App.UI.fmt.comma2(teamSum)}</td>
        </tr>`;
      });

      // Colgroup ensures uniform column widths across thead/tbody/tfoot
      const colgroupHtml = `<colgroup>
        <col style="width:180px;">
        ${MONTHS.map(() => '<col style="width:110px;">').join('')}
        <col style="width:140px;">
      </colgroup>`;

      const headHtml = `<thead>
        <tr>
          <th>User</th>
          ${MONTHS.map(m => `<th class="num">${m}</th>`).join('')}
          <th class="num" style="background: var(--primary-light);">Year Total</th>
        </tr>
      </thead>`;

      const footHtml = `<tfoot>
        <tr class="grand-total">
          <td>All total</td>
          ${monthTotals.map(v => `<td class="num">${App.UI.fmt.comma2(v)}</td>`).join('')}
          <td class="num" style="background: var(--primary-light); color: var(--primary-dark);">${App.UI.fmt.comma2(grandTotal)}</td>
        </tr>
      </tfoot>`;

      document.getElementById('targetsTable').innerHTML = colgroupHtml + headHtml + '<tbody>' + bodyHtml + '</tbody>' + footHtml;
      document.getElementById('targetTableTitle').textContent = `Year ${year} · New Sell only · Total ${App.UI.fmt.THBFull(grandTotal)}`;

      // Wire up cell handlers
      document.querySelectorAll('.target-cell').forEach(inp => {
        inp.addEventListener('focus', () => {
          // Show raw number for editing
          inp.value = inp.dataset.raw === '0' ? '' : inp.dataset.raw;
          inp.select();
        });
        inp.addEventListener('blur', () => {
          // Format on blur
          const v = parseFloat(inp.value.replace(/,/g, '')) || 0;
          inp.dataset.raw = v;
          inp.value = v ? App.UI.fmt.comma2(v) : '';
        });
        inp.addEventListener('change', () => {
          const v = parseFloat(inp.value.replace(/,/g, '')) || 0;
          App.Settings.setNewSellTarget(year, inp.dataset.user, parseInt(inp.dataset.month), v);
          renderTable();   // re-render to update totals
        });
      });

      if (parsed && document.getElementById('renewTable')) renderRenewTable(year);
    }

    function renderRenewTable(year) {
      // Group by team like New Sell table
      const userMonthly = {};   // userName → {arr, team, total}
      parsed.deals.forEach(d => {
        if (!App.Filters.Matchers.isRenew(d)) return;
        if (!d.expectedClose || d.expectedClose.getFullYear() !== year) return;
        const name = d.responsible || 'Unassigned';
        if (!userMonthly[name]) userMonthly[name] = { arr: new Array(12).fill(0), team: d.team || 'Unassigned' };
        userMonthly[name].arr[d.expectedClose.getMonth()] += d.renewTarget || d.income || 0;
      });
      // Make sure to include all settings users too (so empty rows show)
      users.forEach(u => {
        if (!userMonthly[u.name]) userMonthly[u.name] = { arr: new Array(12).fill(0), team: u.team || 'Unassigned' };
        // Ensure team matches settings (data team might differ)
        userMonthly[u.name].team = u.team || 'Unassigned';
      });

      const teamFlt = STATE.teamFilter;
      const grouped = {};
      Object.entries(userMonthly).forEach(([name, info]) => {
        if (teamFlt && info.team !== teamFlt) return;
        if (!grouped[info.team]) grouped[info.team] = [];
        grouped[info.team].push({ name, ...info });
      });

      const teamsHere = orderedTeams.filter(t => grouped[t] && grouped[t].length > 0);
      const monthTotals = new Array(12).fill(0);
      let grandTotal = 0;

      let bodyHtml = '';
      teamsHere.forEach(teamName => {
        const teamUsers = grouped[teamName].sort((a, b) => {
          const sa = a.arr.reduce((s, v) => s + v, 0);
          const sb = b.arr.reduce((s, v) => s + v, 0);
          return sb - sa;
        });
        const teamObj = teams.find(t => t.name === teamName);
        const teamColor = teamObj ? teamObj.color : '#94a3b8';
        const teamMonthTotals = new Array(12).fill(0);
        let teamSum = 0;

        bodyHtml += `<tr class="team-row">
          <td colspan="14" style="background: var(--surface-2); padding:6px 12px;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${teamColor}; margin-right:8px;"></span>
            <strong>${escapeHtml(teamName)}</strong>
          </td>
        </tr>`;

        teamUsers.forEach(({ name, arr }) => {
          const sum = arr.reduce((s, v) => s + v, 0);
          teamSum += sum;
          grandTotal += sum;
          arr.forEach((v, i) => { teamMonthTotals[i] += v; monthTotals[i] += v; });
          bodyHtml += `<tr>
            <td>${escapeHtml(name)}</td>
            ${arr.map(v => `<td class="num" style="color:${v ? 'var(--text)' : 'var(--text-faint)'};">${v ? App.UI.fmt.comma2(v) : '—'}</td>`).join('')}
            <td class="num">${App.UI.fmt.comma2(sum)}</td>
          </tr>`;
        });

        bodyHtml += `<tr class="team-total">
          <td>${escapeHtml(teamName)} subtotal</td>
          ${teamMonthTotals.map(v => `<td class="num">${App.UI.fmt.comma2(v)}</td>`).join('')}
          <td class="num" style="background:${teamColor}30;">${App.UI.fmt.comma2(teamSum)}</td>
        </tr>`;
      });

      const colgroupHtml = `<colgroup>
        <col style="width:180px;">
        ${MONTHS.map(() => '<col style="width:110px;">').join('')}
        <col style="width:140px;">
      </colgroup>`;
      const headHtml = `<thead>
        <tr>
          <th>User</th>
          ${MONTHS.map(m => `<th class="num">${m}</th>`).join('')}
          <th class="num" style="background: var(--primary-light);">Year Total</th>
        </tr>
      </thead>`;
      const footHtml = `<tfoot>
        <tr class="grand-total">
          <td>All total</td>
          ${monthTotals.map(v => `<td class="num">${App.UI.fmt.comma2(v)}</td>`).join('')}
          <td class="num" style="background: var(--primary-light); color: var(--primary-dark);">${App.UI.fmt.comma2(grandTotal)}</td>
        </tr>
      </tfoot>`;
      document.getElementById('renewTable').innerHTML = colgroupHtml + headHtml + '<tbody>' + bodyHtml + '</tbody>' + footHtml;
    }

    function copyFromPrev() {
      const year = STATE.year;
      const prev = year - 1;
      const settings = App.Settings.load();
      const prevData = settings.newSellTargets[prev] || {};
      const prevCount = Object.values(prevData).filter(arr => arr && arr.some(v => v > 0)).length;
      if (prevCount === 0) {
        App.UI.toast(`No data found for year ${prev}`, 'error');
        return;
      }
      App.UI.confirm(
        `Copy targets from <strong>${prev}</strong> → <strong>${year}</strong>? <br><br>${prevCount} users have data in ${prev}. Existing values in ${year} will be overwritten.`,
        () => {
          if (!settings.newSellTargets[year]) settings.newSellTargets[year] = {};
          Object.entries(prevData).forEach(([userName, arr]) => {
            settings.newSellTargets[year][userName] = arr.slice();
          });
          App.Settings.save();
          renderTable();
          App.UI.toast(`Copied ${prevCount} users from ${prev}`, 'success');
        }
      );
    }

    function bulkFill() {
      const body = document.createElement('div');
      body.innerHTML = `
        <div style="display:grid; gap:12px;">
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">Apply to</div>
            <select id="bfScope" class="select-input" style="width:100%; padding:8px;">
              <option value="all">All users (${users.length})</option>
              ${orderedTeams.map(t => `<option value="team:${t}">Team: ${t}</option>`).join('')}
              ${users.map(u => `<option value="user:${escapeAttr(u.name)}">User: ${escapeHtml(u.name)}</option>`).join('')}
            </select>
          </label>
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">Months</div>
            <select id="bfMonths" class="select-input" style="width:100%; padding:8px;">
              <option value="all">All 12 months</option>
              ${MONTHS.map((m, i) => `<option value="${i+1}">${m}</option>`).join('')}
            </select>
          </label>
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">Value (THB)</div>
            <input id="bfValue" type="text" class="select-input" style="width:100%; padding:8px;" value="" placeholder="0" inputmode="decimal">
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
        const year = STATE.year;
        const scope = m.el.querySelector('#bfScope').value;
        const monthSel = m.el.querySelector('#bfMonths').value;
        const value = parseFloat(m.el.querySelector('#bfValue').value.replace(/,/g, '')) || 0;
        const months = monthSel === 'all' ? [1,2,3,4,5,6,7,8,9,10,11,12] : [parseInt(monthSel)];

        let targetUsers = users;
        if (scope.startsWith('team:')) targetUsers = users.filter(u => (u.team || 'Unassigned') === scope.slice(5));
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
            <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">Apply to</div>
            <select id="sdScope" class="select-input" style="width:100%; padding:8px;">
              ${orderedTeams.map(t => `<option value="team:${t}">Team: ${t}</option>`).join('')}
              ${users.map(u => `<option value="user:${escapeAttr(u.name)}">User: ${escapeHtml(u.name)}</option>`).join('')}
            </select>
          </label>
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">Year total (THB)</div>
            <input id="sdTotal" type="text" class="select-input" style="width:100%; padding:8px;" value="" placeholder="0" inputmode="decimal">
          </label>
          <label>
            <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">Distribution</div>
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
        const year = STATE.year;
        const scope = m.el.querySelector('#sdScope').value;
        const total = parseFloat(m.el.querySelector('#sdTotal').value.replace(/,/g, '')) || 0;
        const mode = m.el.querySelector('#sdMode').value;

        let targetUsers = users;
        if (scope.startsWith('team:')) targetUsers = users.filter(u => (u.team || 'Unassigned') === scope.slice(5));
        else if (scope.startsWith('user:')) targetUsers = users.filter(u => u.name === scope.slice(5));
        if (targetUsers.length === 0) { App.UI.toast('No users in scope', 'error'); return; }

        const perUser = total / targetUsers.length;

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
          for (let mo = 0; mo < 12; mo++) {
            const v = (weights[mo] / wSum) * perUser;
            App.Settings.setNewSellTarget(year, u.name, mo + 1, Math.round(v));
          }
        });
        m.close();
        renderTable();
        App.UI.toast(`Distributed ${App.UI.fmt.THBFull(total)} across ${targetUsers.length} users`, 'success');
      });
      f.appendChild(cancel); f.appendChild(ok);
    }

    function exportCSV() {
      const year = STATE.year;
      const rows = [['User', 'Team', ...MONTHS, 'Year Total']];
      users.forEach(u => {
        const arr = (App.Settings.load().newSellTargets[year] || {})[u.name] || new Array(12).fill(0);
        const total = arr.reduce((s, v) => s + v, 0);
        rows.push([u.name, u.team || 'Unassigned', ...arr, total]);
      });
      const csv = rows.map(r => r.map(c => {
        const s = String(c == null ? '' : c);
        return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')).join('\n');
      const today = new Date().toISOString().slice(0, 10);
      // BOM for Excel UTF-8 compatibility (Thai names)
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
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

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.targets = { render };
})();
