/* ========================================================================
   Page: Status Mapping — Stage → Won / Commit / Upside / Open / Lost
   New stages (in data but not in default + override) → highlighted red
   ======================================================================== */
(function () {
  function render(container, parsed) {
    const settings = App.Settings.load();
    const map = Object.assign({}, App.StatusMapping.DEFAULT, settings.statusMapping);
    const STATUSES = App.StatusMapping.LIST;

    // Find stages from data
    const dataStages = new Set();
    if (parsed && parsed.deals) {
      parsed.deals.forEach(d => { if (d.stage) dataStages.add(d.stage); });
    }

    // Combine: stages in mapping + stages in data
    const allStages = new Set([...Object.keys(map), ...dataStages]);
    const sorted = Array.from(allStages).sort((a, b) => a.localeCompare(b));

    // For each stage: classify
    function classify(stage) {
      const inDefault = stage in App.StatusMapping.DEFAULT;
      const inOverride = settings.statusMapping[stage] !== undefined;
      const inData = dataStages.has(stage);
      let badge = '', badgeClass = '';
      if (!inDefault && !inOverride && inData) {
        badge = '🔴 New (unmapped)';
        badgeClass = 'unmapped';
      } else if (inOverride) {
        badge = '✏️ Custom';
        badgeClass = 'custom';
      } else if (inDefault) {
        badge = '✓ Default';
        badgeClass = 'default';
      }
      return { inDefault, inOverride, inData, badge, badgeClass };
    }

    // Count unmapped
    const unmapped = sorted.filter(s => {
      const c = classify(s);
      return !c.inDefault && !c.inOverride && c.inData;
    });

    container.innerHTML = `
      <div class="section-title">
        Status Mapping
        <span class="actions">
          <button class="btn btn-sm" id="resetAllBtn">↺ Reset all to defaults</button>
          <a href="#/settings" class="btn btn-sm btn-ghost">← Back to Settings</a>
        </span>
      </div>

      ${unmapped.length > 0 ? `
        <div class="card" style="background: #fef2f2; border-color: var(--danger-light); margin-bottom: 14px;">
          <div style="display:flex; gap:12px; align-items:center;">
            <span style="font-size:24px;">⚠️</span>
            <div>
              <strong style="color: var(--danger);">${unmapped.length} new stage${unmapped.length > 1 ? 's' : ''} from data not yet mapped</strong>
              <div style="font-size:12px; color: var(--text-muted); margin-top:2px;">
                Stage ใหม่จะถูกจัดเป็น "Open" โดย default — กำหนดให้ถูกประเภทด้านล่าง
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
          <input type="text" id="stageSearch" placeholder="🔍 Search ${sorted.length} stages..." class="select-input" style="flex:1; min-width:220px; padding:8px 12px;">
          <select id="filterBadge" class="select-input">
            <option value="">All</option>
            <option value="unmapped">🔴 Unmapped only</option>
            <option value="custom">✏️ Custom</option>
            <option value="default">✓ Default</option>
          </select>
          <span style="font-size:12px; color:var(--text-muted);">${sorted.length} stages</span>
        </div>
        <div style="overflow-x:auto;">
          <table class="status-tbl" id="statusTable"></table>
        </div>
      </div>

      <div class="card" style="margin-top:14px; background:var(--surface-2);">
        <div style="font-size:12px; color: var(--text-muted);">
          <strong>About status mapping:</strong><br>
          • Status ทั้ง 5 (Won / Commit / Upside / Open / Lost) ใช้ใน Overview, Forecast, charts ทุกที่<br>
          • Stage ใน Bitrix แต่ละอันต้อง map กับ status — ถ้ายังไม่ได้ map จะถูกจัดเป็น Open<br>
          • <strong>เปลี่ยนได้ตลอด</strong> — กระทบเฉพาะ visualization (ไม่แก้ raw data)<br>
          • บันทึกใน localStorage + export JSON ได้
        </div>
      </div>
    `;

    function renderTable() {
      const ft = document.getElementById('stageSearch').value.toLowerCase();
      const badgeFlt = document.getElementById('filterBadge').value;

      const filtered = sorted.filter(s => {
        if (ft && !s.toLowerCase().includes(ft)) return false;
        if (badgeFlt) {
          const c = classify(s);
          if (badgeFlt === 'unmapped' && !(!c.inDefault && !c.inOverride && c.inData)) return false;
          if (badgeFlt === 'custom' && !c.inOverride) return false;
          if (badgeFlt === 'default' && !(c.inDefault && !c.inOverride)) return false;
        }
        return true;
      });

      const html = `<thead>
        <tr>
          <th>Stage</th>
          <th style="width:140px;">Status</th>
          <th style="width:140px;">Source</th>
          <th style="width:90px;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(stage => {
          const c = classify(stage);
          const currentStatus = map[stage] || App.StatusMapping.resolve(stage, settings.statusMapping);
          const rowStyle = c.badgeClass === 'unmapped' ? 'background: #fef2f2;' : '';
          return `<tr style="${rowStyle}">
            <td><strong>${escapeHtml(stage)}</strong></td>
            <td>
              <select class="select-input" data-stage="${escapeAttr(stage)}" style="width:100%; padding:6px;">
                ${STATUSES.map(s => `<option value="${s}" ${currentStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </td>
            <td>
              <span class="status-badge badge-${c.badgeClass}">${c.badge}</span>
            </td>
            <td>
              ${c.inOverride
                ? `<button class="btn btn-sm btn-ghost" data-clear-stage="${escapeAttr(stage)}">Reset</button>`
                : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>`;

      document.getElementById('statusTable').innerHTML = html;

      document.querySelectorAll('#statusTable select[data-stage]').forEach(sel => {
        sel.addEventListener('change', () => {
          const settings = App.Settings.load();
          settings.statusMapping[sel.dataset.stage] = sel.value;
          App.Settings.save();
          render(container, parsed);
          App.UI.toast(`${sel.dataset.stage} → ${sel.value}`, 'success');
        });
      });
      document.querySelectorAll('[data-clear-stage]').forEach(btn => {
        btn.addEventListener('click', () => {
          const settings = App.Settings.load();
          delete settings.statusMapping[btn.dataset.clearStage];
          App.Settings.save();
          render(container, parsed);
          App.UI.toast('Reset to default', 'success');
        });
      });
    }

    document.getElementById('stageSearch').addEventListener('input', renderTable);
    document.getElementById('filterBadge').addEventListener('change', renderTable);
    document.getElementById('resetAllBtn').addEventListener('click', () => {
      App.UI.confirm('Reset all custom status mappings to defaults?', () => {
        App.Settings.set('statusMapping', {});
        render(container, parsed);
        App.UI.toast('All status mappings reset', 'success');
      });
    });

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
  window.App.Pages.statusmap = { render };
})();
