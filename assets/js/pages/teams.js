/* ========================================================================
   Page: Teams & Users — Map users (auto-detected from data) to teams
   No data uploaded → show placeholder
   No Add User button (users come from Bitrix file only)
   ======================================================================== */
(function () {
  function render(container, parsed) {
    // Require data to be loaded — users come from data only
    if (!parsed || !parsed.deals || parsed.deals.length === 0) {
      container.innerHTML = `
        <div class="placeholder-page">
          <div class="icon">👥</div>
          <h2>Teams &amp; Users</h2>
          <p>Upload Bitrix data first — users are auto-detected from the file.<br>
          You can then map them to teams here.</p>
          <button class="btn btn-primary btn-lg" data-action="upload">📥 Upload data</button>
        </div>`;
      container.querySelectorAll('[data-action="upload"]').forEach(b => {
        b.addEventListener('click', () => document.getElementById('fileInput').click());
      });
      return;
    }

    const settings = App.Settings.load();
    const users = settings.users || [];
    const teams = settings.teams || [];

    // Build the union of all team names: settings.teams + user-set teams + Unassigned
    const teamNamesFromUsers = [...new Set(users.map(u => u.team || 'Unassigned'))];
    const allTeamNames = [...new Set([
      ...teams.sort((a, b) => (a.order || 0) - (b.order || 0)).map(t => t.name),
      ...teamNamesFromUsers,
    ])];
    // teamOrder = real teams first, "Unassigned" always last.
    // ALWAYS append Unassigned (even if no user is currently in it) so every
    // user's move-team dropdown can offer "Unassigned" as a destination —
    // otherwise an assigned user can't be unassigned via the UI.
    const teamOrder = allTeamNames.filter(n => n !== 'Unassigned');
    teamOrder.push('Unassigned');

    // Group users by team
    const byTeam = {};
    teamOrder.forEach(t => byTeam[t] = []);
    users.forEach(u => {
      const t = u.team || 'Unassigned';
      if (!byTeam[t]) byTeam[t] = [];
      byTeam[t].push(u);
    });

    container.innerHTML = `
      <div class="section-title">
        Teams &amp; Users
        <span class="actions">
          <button class="btn btn-sm" id="addTeamBtn">+ Add Team</button>
          <button class="btn btn-sm" id="resetTeamsBtn">↺ Reset to data defaults</button>
          <a href="#/settings" class="btn btn-sm btn-ghost">← Back to Settings</a>
        </span>
      </div>

      <div class="card">
        <div style="display:flex; gap:14px; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
          <input type="text" id="userSearch" placeholder="🔍 Search ${users.length} users..." class="select-input" style="flex:1; min-width:220px; padding:8px 12px;">
          <span style="font-size:12px; color:var(--text-muted);">${users.length} users · ${teamOrder.length} teams</span>
        </div>
        <div id="teamsList"></div>
      </div>
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
        if (ft && filtered.length === 0) return '';

        const color = getTeamColor(teamName);
        const isUnassigned = teamName === 'Unassigned';

        return `
          <div class="team-section" data-team="${teamName}" style="margin-bottom:14px; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden;">
            <div class="team-header" style="display:flex; align-items:center; gap:10px; padding:12px 16px; background: var(--surface-2); border-bottom:1px solid var(--border); flex-wrap:wrap;">
              <span class="team-color-dot" data-team-color="${teamName}" style="width:14px; height:14px; border-radius:50%; background:${color}; cursor:${isUnassigned ? 'default' : 'pointer'}; border:2px solid white; box-shadow:0 0 0 1px var(--border-strong); flex-shrink:0;" ${isUnassigned ? '' : 'title="Click to change color"'}></span>
              <strong style="font-size:14px;">${teamName}</strong>
              <span style="color: var(--text-muted); font-size:12px;">${teamUsers.length} users</span>
              <span style="margin-left:auto;"></span>
              ${!isUnassigned ? `
                <button class="btn btn-ghost btn-sm" data-rename-team="${teamName}">✏️ Rename</button>
                <button class="btn btn-ghost btn-sm" data-delete-team="${teamName}" style="color:var(--danger);">🗑 Delete</button>
              ` : `
                <span style="font-size:11px; color:var(--text-faint); font-style:italic;">User ที่ยังไม่ได้ assign team</span>
              `}
            </div>
            ${filtered.length === 0 ? `
              <div style="padding: 14px; color:var(--text-muted); font-size:12px; text-align:center;">
                ${teamUsers.length === 0 ? 'No users in this team' : 'No users match search'}
              </div>
            ` : `
              <table class="tbl" style="border-radius: 0;">
                <thead>
                  <tr>
                    <th style="width:32px;">Active</th>
                    <th>User</th>
                    <th style="width:200px;">Move to</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.map(u => `
                    <tr ${u.active === false ? 'style="opacity:0.5;"' : ''}>
                      <td><input type="checkbox" data-toggle-active="${u.name}" ${u.active !== false ? 'checked' : ''} title="Active"></td>
                      <td>
                        <strong>${escapeHtml(u.name)}</strong>
                        ${u.active === false ? '<span style="font-size:10px; color:var(--text-faint); margin-left:6px;">inactive</span>' : ''}
                      </td>
                      <td>
                        <select class="select-input" data-move-user="${u.name}" data-current-team="${u.team || 'Unassigned'}" style="font-size:12px; padding:4px 8px; width:100%;">
                          ${teamOrder.map(t => `<option value="${t}" ${t === (u.team || 'Unassigned') ? 'selected' : ''}>${t}</option>`).join('')}
                          <option value="__new__">+ New team...</option>
                        </select>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        `;
      }).join('');

      document.getElementById('teamsList').innerHTML = html ||
        '<div style="text-align:center; padding:40px; color:var(--text-muted);">No users yet.</div>';

      attachHandlers();
    }

    function attachHandlers() {
      // Move user → confirmation popup (revert dropdown immediately, re-render on confirm)
      document.querySelectorAll('[data-move-user]').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const userName = sel.dataset.moveUser;
          const fromTeam = sel.dataset.currentTeam;
          let target = e.target.value;
          // Revert immediately — actual move only happens after confirm
          sel.value = fromTeam;
          if (target === '__new__') {
            const newName = prompt('Enter new team name:');
            if (!newName || !newName.trim()) return;
            App.Settings.addTeam(newName.trim(), null);
            target = newName.trim();
          }
          if (target === fromTeam) return;
          App.UI.confirm(
            `ยืนยันย้าย <strong>${escapeHtml(userName)}</strong> จาก team "<strong>${escapeHtml(fromTeam)}</strong>" → "<strong>${escapeHtml(target)}</strong>" ?`,
            () => {
              App.Settings.moveUserToTeam(userName, target);
              render(container, parsed);
              App.UI.toast(`Moved ${userName} → ${target}`, 'success');
            }
          );
        });
      });

      document.querySelectorAll('[data-toggle-active]').forEach(cb => {
        cb.addEventListener('change', () => {
          const settings = App.Settings.load();
          const u = settings.users.find(u => u.name === cb.dataset.toggleActive);
          if (u) { u.active = cb.checked; App.Settings.save(); render(container, parsed); }
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
          App.UI.confirm(`Delete team "<strong>${btn.dataset.deleteTeam}</strong>"? Users will be moved to Unassigned.`, () => {
            App.Settings.deleteTeam(btn.dataset.deleteTeam);
            render(container, parsed);
            App.UI.toast('Team deleted', 'success');
          });
        });
      });

      document.querySelectorAll('[data-team-color]').forEach(el => {
        el.addEventListener('click', () => {
          const teamName = el.dataset.teamColor;
          if (teamName === 'Unassigned') return;
          openColorPicker(teamName);
        });
      });
    }

    function openColorPicker(teamName) {
      const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#ef4444', '#6366f1', '#14b8a6', '#a855f7'];
      const currentColor = getTeamColor(teamName);
      const swatches = palette.map(c => `<div class="color-swatch" data-color="${c}" style="width:32px; height:32px; border-radius:50%; background:${c}; cursor:pointer; border:3px solid ${c === currentColor ? 'var(--text)' : 'white'}; box-shadow:0 0 0 1px var(--border-strong);"></div>`).join('');

      const body = document.createElement('div');
      body.innerHTML = `
        <p style="margin-bottom:14px; font-size:13px;">Pick a color for team <strong>${escapeHtml(teamName)}</strong></p>
        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:14px;">${swatches}</div>
        <div style="display:flex; gap:10px; align-items:center; padding-top:12px; border-top:1px solid var(--border);">
          <span style="font-size:12px; color:var(--text-muted);">Custom:</span>
          <input type="color" id="customColor" value="${currentColor}" style="width:48px; height:32px; padding:0; cursor:pointer; border:1px solid var(--border); border-radius:4px;">
          <input type="text" id="customColorHex" value="${currentColor}" maxlength="7" style="padding:6px 8px; border:1px solid var(--border); border-radius:6px; width:100px; font-family:monospace; font-size:13px;">
          <button class="btn btn-sm" id="applyCustomBtn">Apply</button>
        </div>
      `;
      const m = App.UI.modal({ title: `Team color: ${teamName}`, body, footer: ' ', width: '480px' });
      const f = m.el.querySelector('.modal-footer');
      f.innerHTML = '';
      const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => m.close());
      f.appendChild(cancel);

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
      hexInp.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{6}$/.test(hexInp.value)) colorInp.value = hexInp.value;
      });
      m.el.querySelector('#applyCustomBtn').addEventListener('click', () => {
        const c = hexInp.value;
        if (!/^#[0-9a-fA-F]{6}$/.test(c)) { App.UI.toast('Invalid hex color', 'error'); return; }
        App.Settings.updateTeam(teamName, { color: c });
        m.close();
        render(container, parsed);
        App.UI.toast('Color updated', 'success');
      });
    }

    document.getElementById('addTeamBtn').addEventListener('click', () => {
      const name = prompt('New team name:');
      if (!name || !name.trim()) return;
      const ok = App.Settings.addTeam(name.trim(), null);
      if (!ok) { App.UI.toast('Team already exists', 'error'); return; }
      render(container, parsed);
      App.UI.toast(`Added "${name.trim()}"`, 'success');
    });
    document.getElementById('resetTeamsBtn').addEventListener('click', () => {
      App.UI.confirm(
        'Reset user→team mapping back to original (from uploaded data)? Custom team names will be preserved.',
        () => {
          App.Settings.resetUserTeams(parsed.deals);
          render(container, parsed);
          App.UI.toast('User-team mapping reset to data defaults', 'success');
        }
      );
    });
    document.getElementById('userSearch').addEventListener('input', (e) => {
      renderTeams(e.target.value);
    });

    renderTeams();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.teams = { render };
})();
