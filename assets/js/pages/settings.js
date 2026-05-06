/* ========================================================================
   Page: Settings — Export/Import, status/team mapping, danger zone
   ======================================================================== */
(function () {
  function render(container, parsed) {
    const settings = App.Settings.load();
    const updatedAt = settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—';
    const exportedAt = settings.exportedAt ? new Date(settings.exportedAt).toLocaleString() : 'Never';

    container.innerHTML = `
      <div class="section-title">Backup &amp; Restore</div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">💾 Export / Import all settings</div>
            <div class="card-subtitle">บันทึกการตั้งค่าทุกอย่างเป็น JSON ไฟล์ — share ได้ระหว่างคนในทีม</div>
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
          <button class="btn btn-primary" id="exportBtn">⬇️ Export Settings</button>
          <button class="btn" id="importBtn">📥 Import Settings</button>
          <input type="file" id="importInput" accept=".json" style="display:none;">
          <button class="btn btn-ghost" id="copyBtn">📋 Copy JSON to clipboard</button>
        </div>
        <div style="font-size:12px; color: var(--text-muted); display:grid; gap:4px;">
          <div>Last updated (local): <strong style="color:var(--text);">${updatedAt}</strong></div>
          <div>Last exported: <strong style="color:var(--text);">${exportedAt}</strong></div>
          <div>Storage size: <strong style="color:var(--text);" id="storageSize">—</strong></div>
        </div>
      </div>

      <div class="section-title">Status Mapping</div>
      <div class="card" style="background: var(--surface-2);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div>
            <strong>Stage → Status mapping</strong>
            <div style="color: var(--text-muted); font-size:12px; margin-top:4px;">
              กำหนด stage แต่ละชนิดให้เข้ากลุ่ม Won / Commit / Upside / Open / Lost
            </div>
          </div>
          <button class="btn btn-primary" id="openStatusMapBtn">🏷️ Manage Status Mapping →</button>
        </div>
      </div>

      <div class="section-title">Users &amp; Teams</div>
      <div class="card" style="background: var(--surface-2);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div>
            <strong>${(settings.users || []).length} users · ${(settings.teams || []).length} teams</strong>
            <div style="color: var(--text-muted); font-size:12px; margin-top:4px;">
              ระบบ auto-detect user จาก Bitrix file ที่ import มา · กดเปิดเพื่อ map team
            </div>
          </div>
          <button class="btn btn-primary" id="openTeamsBtn">👥 Manage Teams &amp; Users →</button>
        </div>
      </div>

      <div class="section-title">UI Preferences</div>
      <div class="card">
        <label class="toggle" style="display:block; padding:8px 0;">
          <input type="checkbox" id="diffEnabled" ${settings.uiPreferences.diffViewEnabled ? 'checked' : ''}>
          <span>Enable Diff view (Weekly comparison)</span>
        </label>
        <label class="toggle" style="display:block; padding:8px 0;">
          <input type="checkbox" id="compactMode" ${settings.uiPreferences.compactMode ? 'checked' : ''}>
          <span>Compact mode</span>
        </label>
      </div>

      <div class="section-title">Danger Zone</div>
      <div class="card" style="border-color: var(--danger-light); background: #fff5f5;">
        <div class="card-header">
          <div>
            <div class="card-title" style="color: var(--danger);">⚠️ Reset all settings</div>
            <div class="card-subtitle">ลบทุก preference, target, mapping จะกลับเป็นค่าเริ่มต้น (ไม่ลบ data ที่อัปโหลด)</div>
          </div>
          <button class="btn btn-danger btn-sm" id="resetAllBtn">Reset all settings</button>
        </div>
      </div>
    `;

    renderStorageSize();

    // Wire up actions
    document.getElementById('exportBtn').addEventListener('click', () => {
      const filename = App.Settings.exportToFile();
      App.UI.toast('Exported: ' + filename, 'success');
    });
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importInput').click();
    });
    document.getElementById('importInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const obj = JSON.parse(text);
        App.Settings.importFromObject(obj);
        App.UI.toast('Settings imported successfully', 'success');
        render(container, parsed);
      } catch (err) {
        App.UI.toast('Import failed: ' + err.message, 'error');
      }
    });
    document.getElementById('copyBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(App.Settings.load(), null, 2));
        App.UI.toast('Copied to clipboard', 'success');
      } catch (err) {
        App.UI.toast('Copy failed: ' + err.message, 'error');
      }
    });
    document.getElementById('openTeamsBtn').addEventListener('click', () => {
      location.hash = '#/teams';
    });
    document.getElementById('openStatusMapBtn').addEventListener('click', () => {
      location.hash = '#/statusmap';
    });
    document.getElementById('diffEnabled').addEventListener('change', (e) => {
      App.Settings.set('uiPreferences.diffViewEnabled', e.target.checked);
    });
    document.getElementById('compactMode').addEventListener('change', (e) => {
      App.Settings.set('uiPreferences.compactMode', e.target.checked);
    });
    document.getElementById('resetAllBtn').addEventListener('click', () => {
      App.UI.confirm('This will erase all targets, mappings, and preferences. Continue?', () => {
        App.Settings.reset();
        render(container, parsed);
        App.UI.toast('All settings reset', 'success');
      });
    });
  }

  function renderStorageSize() {
    try {
      const size = JSON.stringify(App.Settings.load()).length;
      const display = size > 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' bytes';
      document.getElementById('storageSize').textContent = display + ' (limit ~5 MB)';
    } catch (e) {}
  }

  function renderStatusMapTable() {
    const settings = App.Settings.load();
    const map = Object.assign({}, App.StatusMapping.DEFAULT, settings.statusMapping);
    const stages = Object.keys(map).sort();
    const STATUSES = App.StatusMapping.LIST;
    const html = `
      <table class="tbl">
        <thead>
          <tr><th>Stage</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          ${stages.map(stage => `
            <tr>
              <td><strong>${stage}</strong></td>
              <td>
                <select class="select-input" data-stage="${stage}">
                  ${STATUSES.map(s => `<option value="${s}" ${map[stage] === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </td>
              <td>
                ${settings.statusMapping[stage] !== undefined
                  ? `<button class="btn btn-sm btn-ghost" data-clear="${stage}">Reset</button>`
                  : '<span style="color:var(--text-muted); font-size:11px;">default</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    document.getElementById('statusMapTable').innerHTML = html;
    document.querySelectorAll('#statusMapTable select[data-stage]').forEach(sel => {
      sel.addEventListener('change', () => {
        const settings = App.Settings.load();
        settings.statusMapping[sel.dataset.stage] = sel.value;
        App.Settings.save();
        renderStatusMapTable();
      });
    });
    document.querySelectorAll('#statusMapTable [data-clear]').forEach(btn => {
      btn.addEventListener('click', () => {
        const settings = App.Settings.load();
        delete settings.statusMapping[btn.dataset.clear];
        App.Settings.save();
        renderStatusMapTable();
      });
    });
  }

  function renderUsersTable() {
    const settings = App.Settings.load();
    const users = settings.users || [];
    if (users.length === 0) {
      document.getElementById('usersTable').innerHTML = '<p style="color:var(--text-muted); font-size:13px; padding:14px 0;">No users yet. Upload data to auto-populate, or click "Add user" above.</p>';
      return;
    }
    const html = `
      <table class="tbl">
        <thead><tr><th>Name</th><th>Team</th><th>Active</th><th></th></tr></thead>
        <tbody>
          ${users.map((u, i) => `
            <tr>
              <td><strong>${u.name}</strong></td>
              <td><input type="text" class="select-input" data-user-team="${i}" value="${u.team || ''}" style="width:160px;"></td>
              <td><input type="checkbox" data-user-active="${i}" ${u.active ? 'checked' : ''}></td>
              <td><button class="btn btn-ghost btn-sm" data-user-remove="${i}">Remove</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    document.getElementById('usersTable').innerHTML = html;
    document.querySelectorAll('[data-user-team]').forEach(inp => {
      inp.addEventListener('change', () => {
        const settings = App.Settings.load();
        settings.users[parseInt(inp.dataset.userTeam)].team = inp.value;
        App.Settings.save();
      });
    });
    document.querySelectorAll('[data-user-active]').forEach(inp => {
      inp.addEventListener('change', () => {
        const settings = App.Settings.load();
        settings.users[parseInt(inp.dataset.userActive)].active = inp.checked;
        App.Settings.save();
      });
    });
    document.querySelectorAll('[data-user-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        App.UI.confirm('Remove this user?', () => {
          const settings = App.Settings.load();
          settings.users.splice(parseInt(btn.dataset.userRemove), 1);
          App.Settings.save();
          renderUsersTable();
        });
      });
    });
  }

  function addUser(container, parsed) {
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="display:grid; gap:10px;">
        <label>
          <div style="font-size:11px; color:var(--text-muted); font-weight:600;">Name</div>
          <input type="text" id="newUserName" class="select-input" style="width:100%; padding:8px;" placeholder="e.g. Sutasinee">
        </label>
        <label>
          <div style="font-size:11px; color:var(--text-muted); font-weight:600;">Team</div>
          <input type="text" id="newUserTeam" class="select-input" style="width:100%; padding:8px;" placeholder="e.g. Inside">
        </label>
      </div>
    `;
    const m = App.UI.modal({
      title: 'Add user',
      body,
      footer: ' ',
    });
    const footer = m.el.querySelector('.modal-footer');
    footer.innerHTML = '';
    const cancel = document.createElement('button');
    cancel.className = 'btn'; cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => m.close());
    const ok = document.createElement('button');
    ok.className = 'btn btn-primary'; ok.textContent = 'Add';
    ok.addEventListener('click', () => {
      const name = document.getElementById('newUserName').value.trim();
      const team = document.getElementById('newUserTeam').value.trim();
      if (!name) { App.UI.toast('Name required', 'error'); return; }
      App.Settings.addUser(name, team || 'Unassigned');
      m.close();
      render(container, parsed);
      App.UI.toast('User added', 'success');
    });
    footer.appendChild(cancel);
    footer.appendChild(ok);
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.settings = { render };
})();
