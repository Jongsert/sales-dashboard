/* ========================================================================
   Page: Pipeline Detail — Sortable + searchable deal table
   Click row → detail modal with custom-column visibility (saved to settings)
   ======================================================================== */
(function () {
  const STATE = {
    sortKey: null,
    sortDir: 1,    // 1 asc, -1 desc
    page: 1,
    pageSize: 50,
    search: '',
    initialized: false,
  };

  function render(container, parsed) {
    if (!parsed || !parsed.deals.length) {
      container.innerHTML = `
        <div class="placeholder-page">
          <div class="icon">📄</div>
          <h2>Pipeline Detail</h2>
          <p>Upload Bitrix data to see all deals.</p>
        </div>`;
      return;
    }

    // Restore page size from settings on first render
    if (!STATE.initialized) {
      const saved = App.Settings.get('uiPreferences.pipelinePageSize');
      if (saved !== undefined) STATE.pageSize = saved === 'all' ? 'all' : parseInt(saved);
      STATE.initialized = true;
    }

    const settings = App.Settings.load();
    const colPrefs = settings.columnPreferences.detailModal || [];
    const visibleCols = colPrefs.filter(c => c.visible).map(c => c.field);
    if (visibleCols.length === 0) visibleCols.push('Deal Name', 'Company', 'Income', 'Stage', 'Responsible');

    container.innerHTML = `
      <div class="section-title">
        All Deals
        <span class="actions">
          <button class="btn btn-sm" id="customizeColsBtn">⚙️ Columns</button>
          <button class="btn btn-sm" id="exportPipelineBtn">⬇️ Export CSV</button>
        </span>
      </div>

      <div class="card">
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
          <input type="text" id="pipelineSearch" placeholder="🔍 Search across all columns..." class="select-input" style="flex:1; min-width:280px; padding:8px 12px;" value="${STATE.search}">
          <span style="font-size:12px; color: var(--text-muted);" id="resultCount"></span>
          <select id="pageSize" class="select-input" title="Rows per page">
            ${[25, 50, 100, 250, 500, 1000, 2000, 'all'].map(s => {
              const cur = STATE.pageSize === 'all' ? 'all' : String(STATE.pageSize);
              const v = String(s);
              const lbl = s === 'all' ? 'All (slow on large data)' : (s >= 1000 ? s.toLocaleString() : s) + ' / page';
              return `<option value="${v}" ${v === cur ? 'selected' : ''}>${lbl}</option>`;
            }).join('')}
          </select>
        </div>

        <div style="overflow:auto; max-height: 70vh; border:1px solid var(--border); border-radius: var(--radius-sm);">
          <table class="pipeline-tbl" id="pipelineTable"></table>
        </div>

        <div style="display:flex; gap:8px; align-items:center; justify-content:space-between; margin-top:12px;">
          <span id="paginationInfo" style="font-size:12px; color: var(--text-muted);"></span>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-sm" id="firstPage">⟪</button>
            <button class="btn btn-sm" id="prevPage">‹</button>
            <span id="pageIndicator" style="padding:6px 12px; font-size:12px; font-weight:600;"></span>
            <button class="btn btn-sm" id="nextPage">›</button>
            <button class="btn btn-sm" id="lastPage">⟫</button>
          </div>
        </div>
      </div>
    `;

    // Apply global filters
    function getFilteredDeals() {
      const filtered = App.Filters.apply(parsed.deals);
      if (!STATE.search) return filtered;
      const s = STATE.search.toLowerCase();
      return filtered.filter(d => {
        // Search through all fields
        if (d.dealName && String(d.dealName).toLowerCase().includes(s)) return true;
        if (d.company && String(d.company).toLowerCase().includes(s)) return true;
        if (d.responsible && String(d.responsible).toLowerCase().includes(s)) return true;
        if (d.stage && String(d.stage).toLowerCase().includes(s)) return true;
        if (d.pipeline && String(d.pipeline).toLowerCase().includes(s)) return true;
        if (d.dealType && String(d.dealType).toLowerCase().includes(s)) return true;
        if (d.productType && String(d.productType).toLowerCase().includes(s)) return true;
        if (d.id && String(d.id).includes(s)) return true;
        // Search in raw fields too
        if (d._raw) {
          for (const v of Object.values(d._raw)) {
            if (v != null && String(v).toLowerCase().includes(s)) return true;
          }
        }
        return false;
      });
    }

    function renderTable() {
      const allFiltered = getFilteredDeals();

      // Sort
      let rows = allFiltered;
      if (STATE.sortKey) {
        rows = rows.slice().sort((a, b) => {
          const va = a._raw[STATE.sortKey] ?? a[STATE.sortKey];
          const vb = b._raw[STATE.sortKey] ?? b[STATE.sortKey];
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * STATE.sortDir;
          if (va instanceof Date && vb instanceof Date) return (va - vb) * STATE.sortDir;
          return String(va).localeCompare(String(vb)) * STATE.sortDir;
        });
      }

      // Paginate
      const total = rows.length;
      let pageRows = rows;
      let totalPages = 1;
      if (STATE.pageSize !== 'all') {
        totalPages = Math.max(1, Math.ceil(total / STATE.pageSize));
        if (STATE.page > totalPages) STATE.page = totalPages;
        const start = (STATE.page - 1) * STATE.pageSize;
        pageRows = rows.slice(start, start + STATE.pageSize);
      } else {
        STATE.page = 1;
      }

      // Build header
      const headHtml = '<thead><tr>' + visibleCols.map(col => {
        const arrow = STATE.sortKey === col ? (STATE.sortDir === 1 ? ' ↑' : ' ↓') : '';
        return `<th data-sort="${col}" style="cursor:pointer;">${col}${arrow}</th>`;
      }).join('') + '</tr></thead>';

      // Build body
      const bodyHtml = '<tbody>' + pageRows.map((d, idx) => {
        const cells = visibleCols.map(col => {
          let v = d._raw ? (d._raw[col] !== undefined ? d._raw[col] : '') : '';
          // Common known columns: format
          if (col === 'Income' || col === 'Gross Profit' || col === 'Net Profit' || col === 'MRR') {
            const n = parseFloat(v);
            if (isFinite(n)) return `<td class="num">${App.UI.fmt.THBFull(n)}</td>`;
          }
          if (v instanceof Date) return `<td>${App.UI.fmt.date(v)}</td>`;
          if (col === 'Income') return `<td class="num">${App.UI.fmt.THBFull(parseFloat(v) || 0)}</td>`;
          // Default
          const txt = v == null ? '' : String(v);
          return `<td>${escapeHtml(txt)}</td>`;
        }).join('');
        return `<tr class="pipeline-row" data-deal-idx="${parsed.deals.indexOf(d)}">${cells}</tr>`;
      }).join('') + '</tbody>';

      document.getElementById('pipelineTable').innerHTML = headHtml + bodyHtml;
      document.getElementById('resultCount').textContent = `${total.toLocaleString()} of ${parsed.deals.length.toLocaleString()} deals`;
      document.getElementById('pageIndicator').textContent = `${STATE.page} / ${totalPages}`;
      document.getElementById('paginationInfo').textContent = total === 0 ? 'No results' :
        STATE.pageSize === 'all'
          ? `Showing all ${total.toLocaleString()}`
          : `Showing ${(STATE.page - 1) * STATE.pageSize + 1}–${Math.min(STATE.page * STATE.pageSize, total)} of ${total.toLocaleString()}`;

      // Attach handlers
      document.querySelectorAll('#pipelineTable th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          const k = th.dataset.sort;
          if (STATE.sortKey === k) STATE.sortDir = -STATE.sortDir;
          else { STATE.sortKey = k; STATE.sortDir = 1; }
          renderTable();
        });
      });
      document.querySelectorAll('.pipeline-row').forEach(row => {
        row.addEventListener('click', () => {
          const idx = parseInt(row.dataset.dealIdx);
          openDealDetail(parsed.deals[idx]);
        });
      });
    }

    function openDealDetail(deal) {
      const settings = App.Settings.load();
      const allColumns = parsed.headers || Object.keys(deal._raw || {});
      const comment = App.Settings.getDealComment(deal.id || deal.dealName);

      const body = document.createElement('div');
      const rowsHtml = allColumns.map(col => {
        let v = deal._raw ? deal._raw[col] : '';
        if (v instanceof Date) v = App.UI.fmt.date(v);
        else if (typeof v === 'number') v = (col.toLowerCase().includes('income') || col.toLowerCase().includes('profit')) ? App.UI.fmt.THBFull(v) : v.toLocaleString();
        else if (v == null) v = '';
        return `<tr>
          <td style="font-weight:600; color:var(--text-muted); padding:6px 12px; border-bottom:1px solid var(--border); width:200px;">${col}</td>
          <td style="padding:6px 12px; border-bottom:1px solid var(--border);">${escapeHtml(String(v))}</td>
        </tr>`;
      }).join('');

      const dealKey = deal.id || deal.dealName || ('row_' + parsed.deals.indexOf(deal));
      body.innerHTML = `
        <div style="margin-bottom:14px; padding:12px; background:var(--surface-2); border-radius:var(--radius-sm); display:flex; gap:14px; flex-wrap:wrap;">
          <div><div style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Status</div>
               <div style="font-weight:700; color:${App.StatusMapping.COLORS[deal.status]?.fill || 'inherit'}; font-size:14px;">${deal.status}</div></div>
          <div><div style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Income</div>
               <div style="font-weight:700; font-size:14px;">${App.UI.fmt.THBFull(deal.income || 0)}</div></div>
          <div><div style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Responsible</div>
               <div style="font-weight:700; font-size:14px;">${deal.responsible || '—'}</div></div>
          <div><div style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Team</div>
               <div style="font-weight:700; font-size:14px;">${deal.team || '—'}</div></div>
          <div><div style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Expected close</div>
               <div style="font-weight:700; font-size:14px;">${App.UI.fmt.date(deal.expectedClose)}</div></div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase; margin-bottom:6px;">💬 Comments (saved locally)</div>
          <textarea id="dealCommentInput" placeholder="Add notes about this deal..." style="width:100%; min-height:60px; padding:8px; border:1px solid var(--border); border-radius:var(--radius-sm); font-family:inherit; font-size:13px; resize:vertical;">${escapeHtml(comment)}</textarea>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:13px;">${rowsHtml}</table>
      `;
      const m = App.UI.modal({
        title: deal.dealName || deal.company || ('Deal #' + deal.id),
        body,
        footer: ' ',
        width: '900px',
      });
      const f = m.el.querySelector('.modal-footer');
      f.innerHTML = '';
      const close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Close';
      close.addEventListener('click', () => {
        // Save comment on close
        const txt = m.el.querySelector('#dealCommentInput').value;
        App.Settings.setDealComment(dealKey, txt);
        m.close();
        if (txt !== comment) App.UI.toast('Comment saved', 'success');
      });
      f.appendChild(close);
    }

    function customizeColumns() {
      const allHeaders = parsed.headers || [];
      const settings = App.Settings.load();
      const prefs = settings.columnPreferences.detailModal || [];
      const prefMap = {};
      prefs.forEach((p, i) => prefMap[p.field] = { ...p, originalIdx: i });
      const ordered = [...prefs];
      allHeaders.forEach(h => {
        if (!prefMap[h]) ordered.push({ field: h, visible: false });
      });

      const body = document.createElement('div');
      body.innerHTML = `
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">
          Use ↑ ↓ buttons to reorder · Toggle visibility with checkbox · Visible columns appear in Pipeline Detail table
        </div>
        <div id="colList" style="max-height:50vh; overflow-y:auto;"></div>
      `;
      const m = App.UI.modal({ title: 'Customize columns', body, footer: ' ', width: '480px' });

      function renderList() {
        const visibleCount = ordered.filter(c => c.visible).length;
        m.el.querySelector('#colList').innerHTML = `
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">${visibleCount} of ${ordered.length} columns visible</div>
          ${ordered.map((c, i) => `
            <div class="col-row" data-idx="${i}" style="display:flex; gap:8px; align-items:center; padding:6px 8px; border:1px solid var(--border); border-radius:6px; margin-bottom:4px; background:var(--surface);">
              <button class="btn btn-ghost btn-sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} style="padding:2px 6px;">↑</button>
              <button class="btn btn-ghost btn-sm" data-down="${i}" ${i === ordered.length - 1 ? 'disabled' : ''} style="padding:2px 6px;">↓</button>
              <input type="checkbox" data-field="${i}" ${c.visible ? 'checked' : ''}>
              <span style="flex:1;">${c.field}</span>
            </div>
          `).join('')}
        `;
        m.el.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => {
          const i = parseInt(b.dataset.up);
          [ordered[i - 1], ordered[i]] = [ordered[i], ordered[i - 1]];
          renderList();
        }));
        m.el.querySelectorAll('[data-down]').forEach(b => b.addEventListener('click', () => {
          const i = parseInt(b.dataset.down);
          [ordered[i + 1], ordered[i]] = [ordered[i], ordered[i + 1]];
          renderList();
        }));
        m.el.querySelectorAll('input[type="checkbox"][data-field]').forEach(cb => {
          cb.addEventListener('change', () => {
            const i = parseInt(cb.dataset.field);
            ordered[i].visible = cb.checked;
            renderList();
          });
        });
      }
      renderList();

      const f = m.el.querySelector('.modal-footer');
      f.innerHTML = '';
      const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => m.close());
      const reset = document.createElement('button'); reset.className = 'btn'; reset.textContent = 'Reset to default';
      reset.addEventListener('click', () => {
        const def = [
          { field: 'Deal Name', visible: true },
          { field: 'Company', visible: true },
          { field: 'Expected close date', visible: true },
          { field: 'Income', visible: true },
          { field: 'Deal Type', visible: true },
          { field: 'Responsible', visible: true },
          { field: 'Product Type', visible: true },
        ];
        App.Settings.set('columnPreferences.detailModal', def);
        m.close();
        render(container, parsed);
      });
      const save = document.createElement('button'); save.className = 'btn btn-primary'; save.textContent = 'Save';
      save.addEventListener('click', () => {
        App.Settings.set('columnPreferences.detailModal', ordered);
        m.close();
        render(container, parsed);
        App.UI.toast('Column preferences saved', 'success');
      });
      f.appendChild(cancel); f.appendChild(reset); f.appendChild(save);
    }

    function exportCSV() {
      const filtered = getFilteredDeals();
      const cols = visibleCols;
      const rows = [cols];
      filtered.forEach(d => {
        rows.push(cols.map(c => {
          const v = d._raw ? d._raw[c] : '';
          if (v instanceof Date) return App.UI.fmt.date(v);
          if (v == null) return '';
          return v;
        }));
      });
      const csv = rows.map(r => r.map(c => {
        const s = String(c == null ? '' : c);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')).join('\n');
      const today = App.UI.fmt.todayLocalISO();
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-dashboard-pipeline_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      App.UI.toast(`Exported ${filtered.length.toLocaleString()} deals`, 'success');
    }

    // Wire up controls
    document.getElementById('pipelineSearch').addEventListener('input', (e) => {
      STATE.search = e.target.value;
      STATE.page = 1;
      renderTable();
    });
    document.getElementById('pageSize').addEventListener('change', (e) => {
      STATE.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
      STATE.page = 1;
      App.Settings.set('uiPreferences.pipelinePageSize', STATE.pageSize);
      renderTable();
    });
    document.getElementById('firstPage').addEventListener('click', () => { STATE.page = 1; renderTable(); });
    document.getElementById('prevPage').addEventListener('click', () => { if (STATE.page > 1) { STATE.page--; renderTable(); } });
    document.getElementById('nextPage').addEventListener('click', () => { STATE.page++; renderTable(); });
    document.getElementById('lastPage').addEventListener('click', () => { STATE.page = 999999; renderTable(); });
    document.getElementById('customizeColsBtn').addEventListener('click', customizeColumns);
    document.getElementById('exportPipelineBtn').addEventListener('click', exportCSV);

    renderTable();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.pipeline = { render };
})();
