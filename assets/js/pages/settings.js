/* ========================================================================
   Page: Settings — Export/Import, status/team mapping, danger zone
   ======================================================================== */
(function () {
  function render(container, parsed) {
    const settings = App.Settings.load();
    const updatedAt = settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—';
    const exportedAt = settings.exportedAt ? new Date(settings.exportedAt).toLocaleString() : 'Never';
    const isAdmin = (window.App && App.MODE === 'admin');
    const tr = App.i18n.t;

    container.innerHTML = `
      ${!isAdmin ? `<div class="card" style="background: var(--tint-info); border-color: var(--primary-light); margin-bottom: 14px;">
        ${tr('card.viewerNote')}
      </div>` : ''}

      ${isAdmin ? `<div class="section-title">${tr('sec.backupRestore')}</div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${tr('card.exportImport')}</div>
            <div class="card-subtitle">${tr('card.exportImportSub')}</div>
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
          <button class="btn btn-primary" id="exportBtn">${tr('btn.export.settings')}</button>
          <button class="btn" id="importBtn">${tr('btn.import')}</button>
          <input type="file" id="importInput" accept=".json" style="display:none;">
          <button class="btn btn-ghost" id="copyBtn">${tr('btn.copyJson')}</button>
        </div>
        <div style="font-size:12px; color: var(--text-muted); display:grid; gap:4px;">
          <div>Last updated (local): <strong style="color:var(--text);">${updatedAt}</strong></div>
          <div>Last exported: <strong style="color:var(--text);">${exportedAt}</strong></div>
          <div>Storage size: <strong style="color:var(--text);" id="storageSize">—</strong></div>
        </div>
      </div>

      ${(() => {
        // Detect unmapped stages from the currently-loaded data, set a flag
        // for the surrounding markup to show a warning + count badge.
        const _parsed = (window.App && App.STATE && App.STATE.parsed) ? App.STATE.parsed : null;
        const _unmapped = (_parsed && App.StatusMapping && App.StatusMapping.findUnmapped)
          ? App.StatusMapping.findUnmapped(_parsed.deals, settings.statusMapping || {})
          : [];
        // expose to outer template via a closure-captured global on `window`
        // (cheap, only used by this render)
        window._settingsUnmapped = _unmapped;
        return '';
      })()}

      <div class="section-title">${tr('sec.statusMapping')}</div>
      <div class="card" style="${(window._settingsUnmapped || []).length > 0 ? 'background: var(--tint-danger); border-color: var(--lost);' : 'background: var(--surface-2);'}">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <strong>${tr('card.stageStatus')}</strong>
            ${(window._settingsUnmapped || []).length > 0 ? `
              <div style="color: var(--danger); font-size:12px; margin-top:6px; font-weight:600;">
                ⚠️ ${window._settingsUnmapped.length} new stage${window._settingsUnmapped.length > 1 ? 's' : ''} from current data not yet classified
              </div>
              <div style="color: var(--text-muted); font-size:11px; margin-top:4px;">
                ${window._settingsUnmapped.slice(0, 5).map(s => `<code style="background:var(--surface); padding:1px 6px; border-radius:3px; margin-right:4px;">${escapeAttr(s)}</code>`).join('')}${window._settingsUnmapped.length > 5 ? `<em>+${window._settingsUnmapped.length - 5} more</em>` : ''}
              </div>
            ` : `
              <div style="color: var(--text-muted); font-size:12px; margin-top:4px;">
                ${tr('card.stageStatusSub')}
              </div>
            `}
          </div>
          <button class="btn ${(window._settingsUnmapped || []).length > 0 ? 'btn-danger' : 'btn-primary'}" id="openStatusMapBtn">
            ${(window._settingsUnmapped || []).length > 0 ? `🏷️ Classify ${window._settingsUnmapped.length} stage${window._settingsUnmapped.length > 1 ? 's' : ''} →` : tr('btn.openStatusMap')}
          </button>
        </div>
      </div>

      <div class="section-title">${tr('sec.usersTeams')}</div>
      <div class="card" style="background: var(--surface-2);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div>
            <strong>${(settings.users || []).length} users · ${(settings.teams || []).length} teams</strong>
            <div style="color: var(--text-muted); font-size:12px; margin-top:4px;">
              ระบบ auto-detect user จาก Bitrix file ที่ import มา · กดเปิดเพื่อ map team
            </div>
          </div>
          <button class="btn btn-primary" id="openTeamsBtn">${tr('btn.openTeams')}</button>
        </div>
      </div>

      <div class="section-title">
        ${tr('sec.snapshotHistory')}
        <span class="actions">
          <button class="btn btn-sm btn-primary" id="takeSnapshotBtn">${tr('btn.takeSnapshot')}</button>
          ${(settings.snapshots || []).length > 0 ? `<button class="btn btn-sm btn-ghost" id="clearSnapshotsBtn">${tr('btn.clearAll')}</button>` : ''}
        </span>
      </div>
      <div class="card">
        <div class="card-subtitle" style="margin-bottom: 12px;">
          ${tr('card.snapshotSub')}
        </div>
        <div id="snapshotsList"></div>
      </div>` : ''}

      <div class="section-title">${tr('sec.uiPreferences')}</div>
      <div class="card">
        <div style="margin-bottom: 14px;">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">Appearance</div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="themePicker">
            <button class="btn btn-sm theme-opt" data-theme-opt="light">☀️ Light</button>
            <button class="btn btn-sm theme-opt" data-theme-opt="dark">🌙 Dark</button>
            <button class="btn btn-sm theme-opt" data-theme-opt="system">🖥️ Follow system</button>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
            Quick toggle also in topbar (cycles Light → Dark → System)
          </div>
        </div>
      </div>

      ${isAdmin ? `<div class="section-title">${tr('sec.accessControl')}</div>
      <div class="card">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:8px;">URL Access Token (casual barrier — not real auth)</div>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
          <input type="text" id="accessTokenInput" class="select-input" style="flex:1; min-width:240px; padding:8px 12px; font-family:monospace;" placeholder="leave empty = no token required" value="${escapeAttr(settings.accessToken || '')}">
          <button class="btn btn-primary btn-sm" id="saveAccessBtn">Save</button>
          ${settings.accessToken ? `<button class="btn btn-ghost btn-sm" id="copyAccessLinkBtn" title="Copy URL with ?token= for sharing">📋 Copy share link</button>` : ''}
        </div>
        <div style="font-size:11px; color:var(--text-muted); line-height:1.6;">
          <strong>How it works:</strong><br>
          • Set token (e.g. <code>secret123</code>) → other users need it to view dashboard<br>
          • Share URL: <code>https://...?token=secret123</code> — recipient bypasses prompt<br>
          • Clear field + Save = remove token (open access)<br>
          • <strong style="color: var(--lost);">⚠️ Not real security:</strong> token in URL is exposed if you share screen / commit URL to git.
          Anyone with the token + URL can see all data.
        </div>
      </div>

      <div class="section-title">${tr('sec.dangerZone')}</div>
      <div class="card" style="border-color: var(--danger-light); background: var(--tint-danger);">
        <div class="card-header">
          <div>
            <div class="card-title" style="color: var(--danger);">${tr('card.resetTitle')}</div>
            <div class="card-subtitle">${tr('card.resetSub')}</div>
          </div>
          <button class="btn btn-danger btn-sm" id="resetAllBtn">${tr('btn.resetAll')}</button>
        </div>
      </div>` : ''}
    `;

    if (isAdmin) {
      renderStorageSize();
      renderSnapshots();

      // Wire snapshot actions
      document.getElementById('takeSnapshotBtn').addEventListener('click', () => {
        const snap = App.Snapshot.capture();
        if (snap) {
          App.UI.toast(`Snapshot taken — Achievement ${(snap.achievement * 100).toFixed(1)}%`, 'success');
          render(container, parsed);
        }
      });
      const clearBtn = document.getElementById('clearSnapshotsBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          App.UI.confirm('Clear all snapshot history?', () => {
            App.Snapshot.clearAll();
            render(container, parsed);
            App.UI.toast('All snapshots cleared', 'success');
          });
        });
      }

      // Wire up backup/restore actions
      document.getElementById('exportBtn').addEventListener('click', () => {
        if (App.STATE && App.STATE.parsed) {
          App.Snapshot.capture('Auto on export');
        }
        const filename = App.Settings.exportToFile();
        App.UI.toast('Exported: ' + filename, 'success');
        render(container, parsed);
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
          // Re-apply user→team mapping from the imported settings to the
          // in-memory deal list and refresh the global filter, otherwise
          // the Team filter dropdown stays stale.
          if (App.applyTeamConfigChange) App.applyTeamConfigChange();
          else render(container, parsed);
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

    }

    // Theme picker
    const curTheme = localStorage.getItem('salesDashboard.theme') || 'system';
    document.querySelectorAll('.theme-opt').forEach(btn => {
      if (btn.dataset.themeOpt === curTheme) {
        btn.classList.add('btn-primary');
      }
      btn.addEventListener('click', () => {
        document.documentElement.setAttribute('data-theme', btn.dataset.themeOpt);
        localStorage.setItem('salesDashboard.theme', btn.dataset.themeOpt);
        const icon = document.getElementById('themeIcon');
        if (icon) icon.textContent = { light: '☀️', dark: '🌙', system: '🖥️' }[btn.dataset.themeOpt] || '☀️';
        document.querySelectorAll('.theme-opt').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        App.UI.toast(`Theme: ${btn.dataset.themeOpt}`, 'success');
      });
    });


    if (isAdmin) {
      // Access token
      const accessSaveBtn = document.getElementById('saveAccessBtn');
      if (accessSaveBtn) {
        accessSaveBtn.addEventListener('click', () => {
          const v = document.getElementById('accessTokenInput').value.trim();
          App.Settings.set('accessToken', v);
          if (v) {
            localStorage.setItem('salesDashboard.access', v);
            App.UI.toast('Access token saved · Share link with team', 'success');
          } else {
            localStorage.removeItem('salesDashboard.access');
            App.UI.toast('Access token cleared (open access)', 'success');
          }
          render(container, parsed);
        });
      }
      const accessCopyBtn = document.getElementById('copyAccessLinkBtn');
      if (accessCopyBtn) {
        accessCopyBtn.addEventListener('click', async () => {
          const token = (App.Settings.load().accessToken || '').trim();
          if (!token) return;
          const url = location.origin + location.pathname + '#/overview?token=' + encodeURIComponent(token);
          try {
            await navigator.clipboard.writeText(url);
            App.UI.toast('Share link copied (with token)', 'success');
          } catch (err) {
            App.UI.toast('Copy failed: ' + err.message, 'error');
          }
        });
      }

      document.getElementById('resetAllBtn').addEventListener('click', () => {
        App.UI.confirm('This will erase all targets, mappings, and preferences. Continue?', () => {
          App.Settings.reset();
          render(container, parsed);
          App.UI.toast('All settings reset', 'success');
        });
      });
    }
  }

  function renderStorageSize() {
    try {
      const size = JSON.stringify(App.Settings.load()).length;
      const display = size > 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' bytes';
      document.getElementById('storageSize').textContent = display + ' (limit ~5 MB)';
    } catch (e) {}
  }

  function renderSnapshots() {
    const list = document.getElementById('snapshotsList');
    if (!list) return;
    const snapshots = (App.Settings.load().snapshots || []).slice().sort((a, b) => b.timestamp - a.timestamp);
    if (snapshots.length === 0) {
      list.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">No snapshots yet — click "Take snapshot now" to capture current KPIs</div>';
      return;
    }

    // Trend mini-chart of achievement %
    const fmt = App.UI.fmt;
    const recent = snapshots.slice(0, 16).reverse();   // oldest → newest for chart
    const trendCanvas = `<div style="height:140px; margin-bottom:14px;"><canvas id="snapshotsTrendChart"></canvas></div>`;

    const tableHtml = `
      <div style="overflow-x:auto;">
      <table class="tbl">
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>File</th>
            <th class="num">Total Target</th>
            <th class="num">Won Total</th>
            <th class="num">Achievement</th>
            <th class="num">Open Renew</th>
            <th class="num">Commit + Upside</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${snapshots.map(sn => `
            <tr>
              <td><strong>${sn.date}</strong> ${sn.time || ''}</td>
              <td style="font-size:11px; color:var(--text-muted);">${sn.fileName ? sn.fileName.slice(0, 30) : '—'}</td>
              <td class="num">${fmt.THBFull(sn.totalTarget)}</td>
              <td class="num">${fmt.THBFull(sn.wonTotal)}</td>
              <td class="num"><strong style="color: var(--won);">${fmt.pct(sn.achievement)}</strong></td>
              <td class="num">${fmt.THB(sn.openRenew)}</td>
              <td class="num">${fmt.THB((sn.commitTotal || 0) + (sn.upsideTotal || 0))}</td>
              <td><button class="btn btn-ghost btn-sm" data-del-snap="${sn.timestamp}" title="Delete">🗑</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    `;

    list.innerHTML = trendCanvas + tableHtml;

    // Render trend chart
    const ctx = document.getElementById('snapshotsTrendChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: recent.map(s => s.date),
        datasets: [
          { label: 'Achievement %', data: recent.map(s => s.achievement * 100), borderColor: '#259b24', backgroundColor: 'rgba(37,155,36,0.15)', fill: true, tension: 0.25, pointRadius: 4, datalabels: { display: false } },
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
          y: { ticks: { callback: v => v.toFixed(0) + '%', font: { size: 10 } }, grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#f1f5f9' } },
        },
      },
    });

    // Wire delete buttons
    list.querySelectorAll('[data-del-snap]').forEach(btn => {
      btn.addEventListener('click', () => {
        App.Snapshot.delete(parseInt(btn.dataset.delSnap));
        const main = document.getElementById('main');
        App.Pages.settings.render(main, App.STATE.parsed);
      });
    });
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

  function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.settings = { render };
})();
