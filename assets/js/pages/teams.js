/* ========================================================================
   Page: Teams & Users — Manage who is on which team
   ======================================================================== */
(function () {
  function render(container, parsed) {
    const settings = App.Settings.load();
    const users = settings.users || [];
    const teams = settings.teams || [];

    // Compute per-user stats from deals (if loaded)
    const stats = {};
    if (parsed && parsed.deals) {
      parsed.deals.forEach(d => {
        if (!d.responsible) return;
        if (!stats[d.responsible]) stats[d.responsible] = { count: 0, won: 0, lastDate: null };
        stats[d.responsible].count++;
        if (d.status === 'Won') stats[d.responsible].won += d.income;
        if (d.expectedClose && (!stats[d.responsible].lastDate || d.expectedClose > stats[d.responsible].lastDate)) {
          stats[d.responsible].lastDate = d.expectedClose;
        }
      });
    }

    // Group users by team
    const byTeam = {};
    users.forEach(u => {
      const t = u.team || 'Unassigned';
      if (!byTeam[t]) byTeam[t] = [];
      byTeam[t].push(u);
    });

    // Make sure all known teams have a bucket (even if empty)
    teams.forEach(t => { if (!byTeam[t.name]) byTeam[t.name] = []; });

    // Sort: known teams in order, then Unassigned, then any unknown
    const knownTeamNames = teams.sort((a, b) => (a.order || 0) - (b.order || 0)).map(t => t.name);
    const teamOrder = [
      ...knownTeamNames,
      ...Object.keys(byTeam).filter(t => !knownTeamNames.includes(t) && t !== 'Unassigned'),
    ];
    if (byTeam['Unassigned']) teamOrder.push('Unassigned');

    container.innerHTML = `
      <div class="section-title">
        Teams &amp; Users
        <span class="actions">
          <button class="btn btn-sm" id="addTeamBtn">+ Add Team</button>
          <button class="btn btn-sm" id="addUserBtn">+ Add User</button>
        </span>
      </div>

      <div class="card">
        <div style="display:flex; gap:14px; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
          <input type="text" id="userSearch" placeholder="🔍 Search ${users.length} users..." class="select-input" style="flex:1; min-width:220px; padding:8px 12px;">
          <span style="font-size:12px; color:var(--text-muted);">${users.length} users · ${teams.length} teams</span>
        </div>

        <div id="teamsList"></div>
      </div>

      ${parsed ? '' : `
        <div class="card" style="margin-top:16px; background: var(--surface-2); border-style:dashed;">
          <div style="font-size:13px; color: var(--text-muted); text-align:center;">
            💡 Upload Bitrix data to see deal-count and won-value stats per user
          </div>
        </div>
      `}
    `;

    function getTeamColor(name) {
      const t = teams.find(t => t.name === name);
      return t ? t.color : '#94a3b8';
    }

    function renderTeams(filterText = '') {
      const ft = filterText.toLowerCase();
      const html = teamOrder.map(teamName => {
        const teamUsers = byTeam[teamName] || [];
        const filtered = teamUsers.filter(u => !ft || u.name.toLowerCase().includes(ft));
        if (ft && filtered.length === 0) return '';   // hide empty teams during search

        const totalDeals = teamUsers.reduce((s, u) => s + (stats[u.name]?.count || 0), 0);
        const totalWon = teamUsers.reduce((s, u) => s + (stats[u.name]?.won || 0), 0);
        const color = getTeamColor(teamName);
        const isCustom = teams.some(t => t.name === teamName);

        return `
          <div class="team-section" data-team="${teamName}" style="margin-bottom:14px; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden;">
            <div class="team-header" style="display:flex; align-items:center; gap:10px; padding:12px 16px; background: var(--surface-2); border-bottom:1px solid var(--border);">
              <span class="team-color-dot" data-team="${teamName}" style="width:14px; height:14px; border-radius:50%; background:${color}; cursor:pointer; border:2px solid white; box-shadow:0 0 0 1px var(--border-strong); flex-shrink:0;" title="Click to change color"></span>
              <strong style="font-size:14px; flex-shrink:0;">${teamName}</strong>
              <span style="color: var(--text-muted); font-size:12px;">
                ${teamUsers.length} users · ${totalDeals.toLocaleString()} deals · ${App.UI.fmt.THBFull(totalWon)} won
              </span>
              <span style="margin-left:auto;"></span>
              ${isCustom ? `
                <button class="btn btn-ghost btn-sm" data-rename-team="${teamName}">✏️ Rename</button>
                <button class="btn btn-ghost btn-sm" data-delete-team="${teamName}" style="color:var(--danger);">🗑 Delete</button>
              ` : ''}
            </div>
            ${filtered.length === 0 ? `
              <div style="padding: 14px; color:var(--text-muted); font-size:12px; text-align:center;">
                ${teamUsers.length === 0 ? 'No users in this team yet' : 'No users match search'}
              </div>
            ` : `
              <table class="tbl" style="border-radius: 0;">
                <thead>
                  <tr>
                    <th style="width:32px;"></th>
                    <th>User</th>
                    <th class="num">Deals</th>
                    <th class="num">Won</th>
                    <th>Last activity</th>
                    <th style="width:140px;">Move to</th>
                    <th style="width:100px;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.map(u => {
                    const st = stats[u.name] || { count: 0, won: 0, lastDate: null };
                    return `
                      <tr ${u.active === false ? 'style="opacity:0.5;"' : ''}>
                        <td>
                          <input type="checkbox" data-toggle-active="${u.name}" ${u.active !== false ? 'checked' : ''} title="Active">
                        </td>
                        <td>
                          <strong>${u.name}</strong>
                          ${u.active === false ? '<span style="font-size:10px; color:var(--text-faint); margin-left:6px;">inactive</span>' : ''}
                        </td>
                        <td class="num">${st.count.toLocaleString()}</td>
                        <td class="num">${st.won > 0 ? App.UI.fmt.THBFull(st.won) : '—'}</td>
                        <td style="font-size:12px; color:var(--text-muted);">${App.UI.fmt.date(st.lastDate)}</td>
                        <td>
                          <select class="select-input" data-move-user="${u.name}" style="font-size:12px; padding:4px 8px; width:100%;">
                            ${teamOrder.concat(['Unassigned']).filter((v,i,a) => a.indexOf(v)===i).map(t => `
                              <option value="${t}" ${t === u.team ? 'selected' : ''}>${t}</option>
                            `).join('')}
                            <option value="__new__">+ New team...</option>
                          </select>
                        </td>
                        <td>
                          <button class="btn btn-ghost btn-sm" data-remove-user="${u.name}" style="color:var(--danger);" title="Remove user">🗑</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        `;
      }).join('');

      document.getElementById('teamsList').innerHTML = html ||
        '<div style="text-align:center; padding:40px; color:var(--text-muted);">No users yet. Upload Bitrix data or click "+ Add User"</div>';

      attachHandlers();
    }

    function attachHandlers() {
      document.querySelectorAll('[data-move-user]').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const name = sel.dataset.moveUser;
          let target = e.target.value;
          if (target === '__new__') {
            const newName = prompt('Enter new team name:');
            if (!newName) { renderTeams(document.getElementById('userSearch').value); return; }
            App.Settings.addTeam(newName.trim(), null);
            target = newName.trim();
          }
          App.Settings.moveUserToTeam(name, target);
          render(container, parsed);
          App.UI.toast(`Moved ${name} → ${target}`, 'success');
        });
      });
      document.querySelectorAll('[data-toggle-active]').forEach(cb => {
        cb.addEventListener('change', () => {
          const settings = App.Settings.load();
          const u = settings.users.find(u => u.name === cb.dataset.toggleActive);
          if (u) { u.active = cb.checked; App.Settings.save(); render(container, parsed); }
        });
      });
      document.querySelectorAll('[data-remove-user]').forEach(btn => {
        btn.addEventListener('click', () => {
          App.UI.confirm(`Remove ${btn.dataset.removeUser} from settings? (won't affect Bitrix data)`, () => {
            const settings = App.Settings.load();
            settings.users = settings.users.filter(u => u.name !== btn.dataset.removeUser);
            App.Settings.save();
            render(container, parsed);
            App.UI.toast('User removed', 'success');
          });
        });
      });
      document.querySelectorAll('[data-rename-team]').forEach(btn => {
        btn.addEventListener('click', () => {
          const oldName = btn.dataset.renameTeam;
          const newName = prompt(`Rename team "${oldName}" to:`, oldName);
          if (!newName || newName === oldName) return;
          App.Settings.updateTeam(oldName, { name: newName.trim() });
          render(container, parsed);
          App.UI.toast(`Renamed to "${newName}"`, 'success');
        });
      });
      document.querySelectorAll('[data-delete-team]').forEach(btn => {
        btn.addEventListener('click', () => {
          App.UI.confirm(`Delete team "${btn.dataset.deleteTeam}"? Users will be moved to Unassigned.`, () => {
            App.Settings.deleteTeam(btn.dataset.deleteTeam);
            render(container, parsed);
            App.UI.toast('Team deleted', 'success');
          });
        });
      });
      document.querySelectorAll('[data-team]').forEach(el => {
        if (!el.classList.contains('team-color-dot')) return;
        el.addEventListener('click', () => {
          const teamName = el.dataset.team;
          openColorPicker(teamName);
        });
      });
    }

    function openColorPicker(teamName) {
      const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#ef4444', '#6366f1', '#14b8a6', '#a855f7'];
      const swatches = palette.map(c => `<div class="color-swatch" data-color="${c}" style="width:32px; height:32px; border-radius:50%; background:${c}; cursor:pointer; border:2px solid white; box-shadow:0 0 0 1px var(--border-strong);"></div>`).join('');
      const body = document.createElement('div');
      body.innerHTML = `
        <p style="margin-bottom:14px; font-size:13px;">Pick a color for team <strong>${teamName}</strong></p>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">${swatches}</div>
        <div style="margin-top:14px; font-size:12px; color:var(--text-muted);">Or enter custom hex:</div>
        <input type="color" id="customColor" value="#3b82f6" style="width:60px; height:36px; padding:0; margin-top:6px; cursor:pointer;">
        <input type="text" id="customColorHex" value="#3b82f6" style="margin-left:8px; padding:8px; border:1px solid var(--border); border-radius:6px; width:100px; font-family:monospace;">
      `;
      const m = App.UI.modal({ title: `Team color: ${teamName}`, body, footer: ' ' });
      const footer = m.el.querySelector('.modal-footer');
      footer.innerHTML = '';
      const cancel = document.createElement('button');
      cancel.className = 'btn'; cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => m.close());
      const ok = document.createElement('button');
      ok.className = 'btn btn-primary'; ok.textContent = 'Apply';
      ok.addEventListener('click', () => {
        const c = m.el.querySelector('#customColorHex').value;
        App.Settings.updateTeam(teamName, { color: c });
        m.close();
        render(container, parsed);
        App.UI.toast('Color updated', 'success');
      });
      footer.appendChild(cancel);
      footer.appendChild(ok);

      m.el.querySelectorAll('.color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          App.Settings.updateTeam(teamName, { color: sw.dataset.color });
          m.close();
          render(container, parsed);
          App.UI.toast('Color updated', 'success');
        });
      });
      const colorInp = m.el.querySelector('#customColor');
      const hexInp = m.el.querySelector('#customColorHex');
      colorInp.addEventListener('input', () => hexInp.value = colorInp.value);
      hexInp.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(hexInp.value)) colorInp.value = hexInp.value; });
    }

    document.getElementById('addTeamBtn').addEventListener('click', () => {
      const name = prompt('New team name:');
      if (!name) return;
      const ok = App.Settings.addTeam(name.trim(), null);
      if (!ok) { App.UI.toast('Team already exists', 'error'); return; }
      render(container, parsed);
      App.UI.toast(`Added "${name}"`, 'success');
    });
    document.getElementById('addUserBtn').addEventListener('click', () => addUserDialog(container, parsed));
    document.getElementById('userSearch').addEventListener('input', (e) => {
      renderTeams(e.target.value);
    });

    renderTeams();
  }

  function addUserDialog(container, parsed) {
    const settings = App.Settings.load();
    const teamOptions = (settings.teams || []).map(t => t.name);
    if (!teamOptions.includes('Unassigned')) teamOptions.push('Unassigned');

    const body = document.createElement('div');
    body.innerHTML = `
      <div style="display:grid; gap:12px;">
        <label>
          <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">Name</div>
          <input id="newUserName" type="text" class="select-input" style="width:100%; padding:8px;" placeholder="e.g. Sutasinee Lertpongsuk">
        </label>
        <label>
          <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">Team</div>
          <select id="newUserTeam" class="select-input" style="width:100%; padding:8px;">
            ${teamOptions.map(t => `<option>${t}</option>`).join('')}
          </select>
        </label>
      </div>
    `;
    const m = App.UI.modal({ title: 'Add user', body, footer: ' ' });
    const footer = m.el.querySelector('.modal-footer');
    footer.innerHTML = '';
    const cancel = document.createElement('button');
    cancel.className = 'btn'; cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => m.close());
    const ok = document.createElement('button');
    ok.className = 'btn btn-primary'; ok.textContent = 'Add';
    ok.addEventListener('click', () => {
      const name = m.el.querySelector('#newUserName').value.trim();
      const team = m.el.querySelector('#newUserTeam').value;
      if (!name) { App.UI.toast('Name required', 'error'); return; }
      App.Settings.addUser(name, team);
      m.close();
      const page = App.Pages.teams;
      page.render(container, parsed);
      App.UI.toast(`Added ${name} to ${team}`, 'success');
    });
    footer.appendChild(cancel);
    footer.appendChild(ok);
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.teams = { render };
})();
