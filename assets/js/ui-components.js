/* ========================================================================
   UI Components — Multi-select dropdown, Toast, Modal, Drop-zone
   ======================================================================== */
(function () {
  /* ----- Toast ----- */
  function toast(message, type = '') {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'toast show ' + type;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast ' + type; }, 2800);
  }

  /* ----- Multi-select dropdown ----- */
  function buildMultiSelect(container, options, selectedSet, onChange) {
    container.innerHTML = '';
    container.classList.add('ms-dropdown');

    const tr = (window.App && App.i18n && App.i18n.t) ? App.i18n.t : (k, f) => f || k;
    const trigger = document.createElement('button');
    trigger.className = 'ms-trigger';
    trigger.type = 'button';
    trigger.textContent = tr('filter.all');
    container.appendChild(trigger);

    const panel = document.createElement('div');
    panel.className = 'ms-panel';
    panel.innerHTML = `
      <input type="text" class="ms-search" placeholder="${tr('filter.search')}">
      <div class="ms-options"></div>
      <div class="ms-actions">
        <button class="ms-link" type="button" data-act="all">${tr('filter.selectAll')}</button>
        <button class="ms-link" type="button" data-act="none">${tr('filter.clear')}</button>
      </div>`;
    container.appendChild(panel);

    const optsEl = panel.querySelector('.ms-options');
    const search = panel.querySelector('.ms-search');

    function renderOptions(filterText = '') {
      const ft = filterText.toLowerCase();
      optsEl.innerHTML = '';
      // Walk through options; only emit a group header if it has visible items.
      const filtered = [];
      let pendingGroup = null;
      for (const opt of options) {
        if (typeof opt === 'object' && opt && opt._group) {
          pendingGroup = opt;
        } else {
          const matches = !ft || String(opt).toLowerCase().includes(ft);
          if (matches) {
            if (pendingGroup) { filtered.push(pendingGroup); pendingGroup = null; }
            filtered.push(opt);
          }
        }
      }
      filtered.forEach(opt => {
        if (typeof opt === 'object' && opt && opt._group) {
          const hdr = document.createElement('div');
          hdr.className = 'ms-group-header';
          hdr.textContent = opt._group;
          optsEl.appendChild(hdr);
          return;
        }
        const lbl = document.createElement('label');
        lbl.className = 'ms-option';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selectedSet.has(opt);
        cb.addEventListener('change', () => {
          if (cb.checked) selectedSet.add(opt);
          else selectedSet.delete(opt);
          updateTrigger();
          onChange && onChange(selectedSet);
        });
        const span = document.createElement('span');
        span.textContent = opt;
        lbl.appendChild(cb);
        lbl.appendChild(span);
        optsEl.appendChild(lbl);
      });
    }

    function updateTrigger() {
      if (selectedSet.size === 0) {
        trigger.textContent = tr('filter.all');
        trigger.classList.remove('has-value');
      } else if (selectedSet.size === 1) {
        trigger.textContent = Array.from(selectedSet)[0];
        trigger.classList.add('has-value');
      } else {
        trigger.textContent = `${selectedSet.size} selected`;
        trigger.classList.add('has-value');
      }
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close any other dropdown panels (multi-select + period)
      document.querySelectorAll('.ms-panel.open, .period-panel.open').forEach(p => {
        if (p !== panel) p.classList.remove('open');
      });
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        search.value = '';
        renderOptions();
        search.focus();
      } else {
        trigger.blur();
      }
    });
    search.addEventListener('input', () => renderOptions(search.value));
    panel.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.act === 'all') {
          // Skip group markers when bulk-adding
          options.forEach(o => {
            if (typeof o === 'object' && o && o._group) return;
            selectedSet.add(o);
          });
        } else {
          selectedSet.clear();
        }
        renderOptions(search.value);
        updateTrigger();
        onChange && onChange(selectedSet);
      });
    });
    panel.addEventListener('click', e => e.stopPropagation());

    updateTrigger();
    return {
      rerender: () => { renderOptions(); updateTrigger(); },
      setOptions: (newOpts) => { options = newOpts; renderOptions(); updateTrigger(); },
    };
  }

  // Close any open dropdowns when clicking outside.
  // Use mousedown + capture phase so inner panels with stopPropagation don't block us.
  document.addEventListener('mousedown', (e) => {
    document.querySelectorAll('.ms-panel.open').forEach(panel => {
      const dropdown = panel.closest('.ms-dropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        panel.classList.remove('open');
      }
    });
  }, true);

  /* ----- Modal — supports ESC to close + click backdrop + close button ----- */
  // Stack of currently-open modals (innermost last). ESC closes the topmost only.
  const _openModals = [];
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _openModals.length > 0) {
      const top = _openModals[_openModals.length - 1];
      if (top && typeof top.close === 'function') top.close();
    }
  });

  function modal({ title, body, footer, onClose, width }) {
    let backdrop = document.getElementById('modalBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'modalBackdrop';
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);
    }
    backdrop.innerHTML = `
      <div class="modal" style="${width ? 'width:' + width + ';' : ''}">
        <div class="modal-header">
          <div class="modal-title">${title || ''}</div>
          <button class="modal-close" aria-label="Close" title="Close (ESC)">×</button>
        </div>
        <div class="modal-body"></div>
        ${footer ? '<div class="modal-footer"></div>' : ''}
      </div>`;
    const bodyEl = backdrop.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body instanceof Node) bodyEl.appendChild(body);

    if (footer) {
      const footerEl = backdrop.querySelector('.modal-footer');
      if (typeof footer === 'string') footerEl.innerHTML = footer;
      else if (footer instanceof Node) footerEl.appendChild(footer);
    }

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      backdrop.classList.remove('open');
      const idx = _openModals.indexOf(handle);
      if (idx >= 0) _openModals.splice(idx, 1);
      onClose && onClose();
    }
    backdrop.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    setTimeout(() => backdrop.classList.add('open'), 10);

    const handle = { close, el: backdrop };
    _openModals.push(handle);
    return handle;
  }

  /* ----- Confirm dialog (supports HTML message + cancel callback) ----- */
  function confirm(message, onConfirm, onCancel) {
    const m = modal({
      title: 'Confirm',
      body: `<div style="font-size:14px; padding: 8px 0;">${message}</div>`,
      footer: ' ',
    });
    let cancelled = false;
    const footer = m.el.querySelector('.modal-footer');
    footer.innerHTML = '';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => { cancelled = true; m.close(); onCancel && onCancel(); });
    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn-primary';
    okBtn.textContent = 'Confirm';
    okBtn.addEventListener('click', () => { m.close(); onConfirm && onConfirm(); });
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    // If user clicks backdrop or X to close — treat as cancel
    const origClose = m.close;
    m.close = () => {
      origClose();
      if (!cancelled) { cancelled = true; /* don't double-fire — don't call onCancel here unless we know it was a backdrop close */ }
    };
  }

  /* ----- Number formatting ----- */
  const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const formatter2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Defensive number coercion — Chart.js v4 sometimes passes proxy objects
  function toNum(n) {
    if (n == null) return NaN;
    if (typeof n === 'number') return n;
    if (typeof n === 'object') {
      // Try common chart.js parsed shape
      if (typeof n.y === 'number') return n.y;
      if (typeof n.x === 'number') return n.x;
      if (typeof n.value === 'number') return n.value;
    }
    const v = Number(n);
    return isFinite(v) ? v : NaN;
  }

  function fmtTHB(n) {
    const num = toNum(n);
    if (!isFinite(num)) return '—';
    const abs = Math.abs(num);
    if (abs >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
  }
  function fmtTHBFull(n) {
    const num = toNum(n);
    if (!isFinite(num)) return '—';
    return 'THB ' + formatter.format(Math.round(num));
  }
  // Exact precision (2 decimals) — used in tooltips/hover for financial detail
  function fmtTHBExact(n) {
    const num = toNum(n);
    if (!isFinite(num)) return '—';
    return 'THB ' + formatter2.format(num);
  }
  function fmtComma2Pure(n) {
    const num = toNum(n);
    if (!isFinite(num)) return '—';
    return formatter2.format(num);
  }
  function fmtComma(n) {
    const num = toNum(n);
    if (!isFinite(num)) return '—';
    return formatter.format(Math.round(num));
  }
  function fmtComma2(n) {
    const num = toNum(n);
    if (!isFinite(num)) return '—';
    return formatter2.format(num);
  }
  function fmtPct(n, digits = 1) {
    const num = toNum(n);
    if (!isFinite(num)) return '—';
    return (num * 100).toFixed(digits) + '%';
  }
  function fmtInt(n) {
    const num = toNum(n);
    return formatter.format(Math.round(isFinite(num) ? num : 0));
  }
  function fmtDate(d) {
    if (!d) return '—';
    if (typeof d === 'string') d = new Date(d);
    if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
    return localDateISO(d);
  }
  // Format a Date as YYYY-MM-DD in LOCAL timezone (avoid UTC shift)
  function localDateISO(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  // Today as YYYY-MM-DD in local timezone (used in export filenames)
  function todayLocalISO() {
    return localDateISO(new Date());
  }

  /* ----- Deal Detail Modal — full info card for one deal ----- */
  function openDealDetail(deal) {
    if (!deal) return;
    const fmt = { THB: fmtTHB, THBFull: fmtTHBFull, THBExact: fmtTHBExact, date: fmtDate };
    const raw = (col) => (deal._raw && deal._raw[col] !== undefined && deal._raw[col] !== null ? deal._raw[col] : '');
    const dRaw = (col) => {
      const v = raw(col);
      if (v instanceof Date) return fmt.date(v);
      if (v === '' || v == null) return '—';
      return escapeHtml(String(v));
    };
    const moneyVal = (n) => {
      const num = Number(n);
      return isFinite(num) ? `<span class="num-tip" title="${fmt.THBExact(num).replace(/"/g, '&quot;')}">${fmt.THBFull(num)}</span>` : '—';
    };
    function rawAny(...cols) {
      for (const c of cols) {
        const v = deal._raw ? deal._raw[c] : undefined;
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return '';
    }
    const dealKey = deal.id || deal.dealName || `row_${(deal.company || '')}_${(deal.income || 0)}`;
    const comment = (App.Settings && App.Settings.getDealComment) ? App.Settings.getDealComment(dealKey) : '';
    const statusColor = (App.StatusMapping && App.StatusMapping.COLORS && App.StatusMapping.COLORS[deal.status] || {}).fill || '#94a3b8';
    const saleOrderNo = rawAny('Sale Order No. (Dynamic365)', 'Sale Order No.', 'Dynamic365', 'SO No.');
    const zoomAccount = rawAny('Zoom Account Number', 'Zoom Account No.');
    const zoomLicense = rawAny('Detail Zoom License Activation', 'Zoom License Activation');

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="deal-header">
        <div class="deal-header-main">
          <div class="deal-name-text">${escapeHtml(deal.dealName || deal.company || ('Deal #' + deal.id))}</div>
          <div class="deal-meta-line">${escapeHtml(deal.company || '—')} · ID #${escapeHtml(String(deal.id || '—'))}</div>
        </div>
        <div class="deal-status-badge" style="background:${statusColor}20; color:${statusColor}; border:1.5px solid ${statusColor};">
          ${deal.status || '—'}
        </div>
      </div>

      <div class="deal-section">
        <div class="deal-section-title">Key Metrics</div>
        <div class="deal-metrics">
          <div class="deal-metric income">
            <div class="metric-label">Income</div>
            <div class="metric-value">${moneyVal(deal.income)}</div>
          </div>
          <div class="deal-metric gp">
            <div class="metric-label">Gross Profit</div>
            <div class="metric-value">${moneyVal(deal.grossProfit)}</div>
          </div>
          <div class="deal-metric np">
            <div class="metric-label">Net Profit</div>
            <div class="metric-value">${moneyVal(deal.netProfit)}</div>
          </div>
        </div>
      </div>

      <div class="deal-grid-2">
        <div class="deal-section">
          <div class="deal-section-title">Deal Info</div>
          <table class="deal-tbl">
            <tr><th>Pipeline</th><td>${escapeHtml(deal.pipeline || '—')}</td></tr>
            <tr><th>Stage</th><td>${escapeHtml(deal.stage || '—')}</td></tr>
            <tr><th>Deal Type</th><td>${escapeHtml(deal.dealType || '—')}</td></tr>
            <tr><th>Billing Type</th><td>${dRaw('Billing Type')}</td></tr>
            <tr><th>Product Type</th><td>${escapeHtml(deal.productType || '—')}</td></tr>
          </table>
        </div>
        <div class="deal-section">
          <div class="deal-section-title">Ownership &amp; Customer</div>
          <table class="deal-tbl">
            <tr><th>Responsible</th><td><strong>${escapeHtml(deal.responsible || '—')}</strong></td></tr>
            <tr><th>Team</th><td>${escapeHtml(deal.team || '—')}</td></tr>
            <tr><th>Company</th><td><strong>${escapeHtml(deal.company || '—')}</strong></td></tr>
            <tr><th>End Customer</th><td>${escapeHtml(deal.endCustomer || '—')}</td></tr>
          </table>
        </div>
      </div>

      <div class="deal-section">
        <div class="deal-section-title">Renewal &amp; Contract</div>
        <table class="deal-tbl deal-tbl-wide">
          <tr>
            <th>Renew Target</th><td>${moneyVal(deal.renewTarget)}</td>
            <th>Sale Order No. (Dynamic365)</th><td>${escapeHtml(String(saleOrderNo || '—'))}</td>
          </tr>
          <tr>
            <th>Contract Start Date</th><td>${fmt.date(deal.contractStartDate)}</td>
            <th>Contract End Date</th><td>${fmt.date(deal.contractEndDate)}</td>
          </tr>
          <tr>
            <th>Expected Close Date</th><td colspan="3">${fmt.date(deal.expectedClose)}</td>
          </tr>
        </table>
      </div>

      <div class="deal-section">
        <div class="deal-section-title">Zoom</div>
        <table class="deal-tbl deal-tbl-wide">
          <tr>
            <th>Account Number</th><td>${escapeHtml(String(zoomAccount || '—'))}</td>
            <th>License Activation</th><td>${escapeHtml(String(zoomLicense || '—'))}</td>
          </tr>
        </table>
      </div>

      <div class="deal-section">
        <div class="deal-section-title">💬 Comments <span style="font-weight:400; color:var(--text-faint); font-size:11px;">— saved locally on this device</span></div>
        <textarea id="dealCommentInput" placeholder="Add notes about this deal..." class="deal-comment">${escapeHtml(comment)}</textarea>
      </div>
    `;
    const m = modal({
      title: deal.dealName || deal.company || ('Deal #' + deal.id),
      body, footer: ' ', width: '900px',
    });
    const f = m.el.querySelector('.modal-footer');
    f.innerHTML = '';
    const close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Close';
    close.addEventListener('click', () => {
      const txt = m.el.querySelector('#dealCommentInput').value;
      if (App.Settings && App.Settings.setDealComment) App.Settings.setDealComment(dealKey, txt);
      m.close();
      if (txt !== comment) toast('Comment saved', 'success');
    });
    f.appendChild(close);
  }

  /* ----- Excel export helper — multi-sheet .xlsx using SheetJS ----- */
  function exportToExcel(filename, sheets) {
    if (typeof XLSX === 'undefined') {
      toast('Excel library not loaded — falling back to CSV', 'error');
      return false;
    }
    const wb = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([name, data]) => {
      if (!data || !data.length) return;
      const ws = XLSX.utils.aoa_to_sheet(data);
      const cols = data[0] || [];
      ws['!cols'] = cols.map((_, i) => {
        let maxLen = 10;
        for (let r = 0; r < Math.min(data.length, 100); r++) {
          const cell = data[r][i];
          if (cell != null) {
            const len = String(cell).length;
            if (len > maxLen) maxLen = Math.min(len, 60);
          }
        }
        return { wch: maxLen };
      });
      const safeName = String(name).slice(0, 31).replace(/[\\/?*:[\]]/g, '_');
      XLSX.utils.book_append_sheet(wb, ws, safeName);
    });
    XLSX.writeFile(wb, filename);
    return true;
  }

  /* ----- Screenshot helper — capture an element to PNG via html2canvas ----- */
  /* Captures the FULL element (including content scrolled out of view in
     overflow:auto wrappers) by temporarily relaxing ancestor overflow + max-height
     during capture, then restoring. Action buttons inside the captured element
     are hidden via the data-html2canvas-ignore attribute so they don't appear
     in the PNG. */
  function screenshotElement(element, filename, opts) {
    if (typeof html2canvas === 'undefined') {
      toast('Screenshot library not loaded', 'error');
      return;
    }
    if (!element) {
      toast('Nothing to capture', 'error');
      return;
    }
    opts = opts || {};

    // Walk up ancestors and temporarily remove overflow / max-height so the
    // full element is laid out at its natural width × height before capture.
    const restorations = [];
    let p = element.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' ||
          cs.overflowY !== 'visible' || cs.maxHeight !== 'none') {
        restorations.push({
          el: p,
          overflow: p.style.overflow,
          maxHeight: p.style.maxHeight,
        });
        p.style.overflow = 'visible';
        p.style.maxHeight = 'none';
      }
      p = p.parentElement;
    }

    // Hide .actions / .topbar-actions (button rows) inside the capture so the
    // PNG doesn't show "Print" / "Screenshot" / etc. buttons next to the data.
    const ignored = [];
    element.querySelectorAll('.actions, [data-i18n-aria-label="Toggle theme"], #copyUrlBtn, #langBtn').forEach(el => {
      ignored.push({ el, prev: el.getAttribute('data-html2canvas-ignore') });
      el.setAttribute('data-html2canvas-ignore', 'true');
    });

    function restore() {
      restorations.forEach(r => {
        r.el.style.overflow = r.overflow;
        r.el.style.maxHeight = r.maxHeight;
      });
      ignored.forEach(({ el, prev }) => {
        if (prev === null) el.removeAttribute('data-html2canvas-ignore');
        else el.setAttribute('data-html2canvas-ignore', prev);
      });
    }

    toast('Capturing screenshot…');
    const bg = opts.backgroundColor
      || getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
      || '#ffffff';

    // Force a layout pass so scrollWidth / scrollHeight are accurate after
    // we relaxed overflow on ancestors.
    void element.offsetWidth;
    const w = Math.max(element.scrollWidth, element.offsetWidth);
    const h = Math.max(element.scrollHeight, element.offsetHeight);

    html2canvas(element, {
      scale: opts.scale || 2,
      backgroundColor: bg,
      useCORS: true,
      logging: false,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
    }).then(canvas => {
      restore();
      canvas.toBlob(blob => {
        if (!blob) { toast('Screenshot failed (empty image)', 'error'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'screenshot.png';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        toast('Screenshot saved: ' + (filename || 'screenshot.png'), 'success');
      }, 'image/png');
    }).catch(err => {
      restore();
      console.error('Screenshot failed:', err);
      toast('Screenshot failed: ' + err.message, 'error');
    });
  }

  /* ----- CSV export helper — single sheet ----- */
  function exportToCSV(filename, rows) {
    const csv = (rows || []).map(r => (r || []).map(c => {
      const s = String(c == null ? '' : c);
      return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    return true;
  }

  /* ----- Drill-down modal: search + sortable columns + clickable Deal Name ----- */
  function drillModal({ title, subtitle, deals }) {
    if (!deals || deals.length === 0) {
      toast('No deals to show for this segment', '');
      return;
    }
    const totalAll = deals.reduce((s, d) => s + (d.income || 0), 0);
    const COLORS = (window.App && App.StatusMapping && App.StatusMapping.COLORS) || {};

    const STATE = { sortKey: 'income', sortDir: -1, search: '' };

    function applySearch(arr) {
      if (!STATE.search || !STATE.search.trim()) return arr;
      const s = STATE.search.toLowerCase();
      return arr.filter(d => {
        const fields = [
          d.dealName, d.company, d.responsible, d.team, d.stage, d.status,
          d.dealType, d.productType, d.endCustomer, d.id,
        ];
        if (fields.some(f => f != null && String(f).toLowerCase().includes(s))) return true;
        // Also search through raw columns for thoroughness
        if (d._raw) {
          for (const v of Object.values(d._raw)) {
            if (v != null && String(v).toLowerCase().includes(s)) return true;
          }
        }
        return false;
      });
    }
    function compare(a, b) {
      const k = STATE.sortKey;
      let va = a[k], vb = b[k];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * STATE.sortDir;
      if (va instanceof Date && vb instanceof Date) return ((va.getTime() - vb.getTime())) * STATE.sortDir;
      return String(va).localeCompare(String(vb)) * STATE.sortDir;
    }
    function sortInd(key) {
      if (STATE.sortKey !== key) return '';
      return STATE.sortDir === 1 ? ' ▲' : ' ▼';
    }
    function buildBodyHtml() {
      const filtered = applySearch(deals);
      const sorted = filtered.slice().sort(compare);
      const totalFiltered = filtered.reduce((s, d) => s + (d.income || 0), 0);
      const isSearching = !!(STATE.search && STATE.search.trim());
      return `
        ${subtitle ? `<div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${subtitle}</div>` : ''}
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
          <input type="text" id="drillSearch" class="select-input"
                 placeholder="🔍 Search across all columns (deal name, company, responsible, ...)"
                 value="${escapeHtml(STATE.search)}"
                 style="flex:1; padding:9px 12px; font-size:13px;">
          ${isSearching ? `<button class="btn btn-sm btn-ghost" id="drillClearSearch">× Clear</button>` : ''}
        </div>
        <div style="margin-bottom:10px; padding:10px 14px; background: var(--surface-2); border-radius: var(--radius-sm); display:flex; gap:18px; flex-wrap:wrap; font-size:12px; align-items:center;">
          ${isSearching
            ? `<span><strong style="font-size:16px;">${filtered.length.toLocaleString()}</strong> of ${deals.length.toLocaleString()} deals match</span>
               <span>·</span>
               <span>Filtered total: <strong style="font-size:14px;" title="${fmtTHBExact(totalFiltered)}">${fmtTHBFull(totalFiltered)}</strong></span>
               <span style="color:var(--text-faint);">/ ${fmtTHBFull(totalAll)} all</span>`
            : `<span><strong style="font-size:16px;">${deals.length.toLocaleString()}</strong> deal${deals.length>1?'s':''}</span>
               <span>·</span>
               <span>Total: <strong style="font-size:14px;" title="${fmtTHBExact(totalAll)}">${fmtTHBFull(totalAll)}</strong></span>`}
          <span style="margin-left:auto; color:var(--text-faint); font-size:11px;">Click column header to sort · Click Deal Name to view detail</span>
        </div>
        <div class="drill-scroll" style="max-height:60vh; overflow:auto; overscroll-behavior: contain; border:1px solid var(--border); border-radius: var(--radius-sm);">
          <table class="tbl">
            <thead><tr>
              <th class="wrap drill-th" data-sort="dealName">Deal Name${sortInd('dealName')}</th>
              <th class="wrap-sm drill-th" data-sort="company">Company${sortInd('company')}</th>
              <th class="drill-th" data-sort="responsible">Responsible${sortInd('responsible')}</th>
              <th class="drill-th" data-sort="stage">Stage${sortInd('stage')}</th>
              <th class="drill-th" data-sort="status">Status${sortInd('status')}</th>
              <th class="num drill-th" data-sort="income">Income${sortInd('income')}</th>
              <th class="drill-th" data-sort="expectedClose">Expected close${sortInd('expectedClose')}</th>
            </tr></thead>
            <tbody>
              ${sorted.length === 0
                ? `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">No deals match "${escapeHtml(STATE.search)}"</td></tr>`
                : sorted.map((d, i) => {
                    const sc = (COLORS[d.status] || {}).fill || 'var(--text-muted)';
                    return `<tr>
                      <td class="wrap"><a href="javascript:void(0)" class="drill-deal-link" data-i="${i}"><strong>${escapeHtml(d.dealName || '—')}</strong></a></td>
                      <td class="wrap-sm">${escapeHtml(d.company || '—')}</td>
                      <td>${escapeHtml(d.responsible || '—')}</td>
                      <td>${escapeHtml(d.stage || '—')}</td>
                      <td><span style="color:${sc}; font-weight:600;">${d.status || '—'}</span></td>
                      <td class="num" title="${fmtTHBExact(d.income||0)}">${fmtTHBFull(d.income || 0)}</td>
                      <td>${fmtDate(d.expectedClose)}</td>
                    </tr>`;
                  }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const body = document.createElement('div');
    body.innerHTML = buildBodyHtml();
    const m = modal({ title, body, footer: ' ', width: '1320px' });

    let searchDebounce = null;
    function rebind() {
      // Sort headers
      m.el.querySelectorAll('.drill-th').forEach(th => {
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        th.addEventListener('click', () => {
          const k = th.dataset.sort;
          if (STATE.sortKey === k) STATE.sortDir = -STATE.sortDir;
          else { STATE.sortKey = k; STATE.sortDir = 1; }
          m.el.querySelector('.modal-body').innerHTML = buildBodyHtml();
          rebind();
        });
      });
      // Deal name link
      m.el.querySelectorAll('.drill-deal-link').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const filtered = applySearch(deals);
          const sorted = filtered.slice().sort(compare);
          const idx = parseInt(a.dataset.i);
          const d = sorted[idx];
          if (d && App.UI.openDealDetail) App.UI.openDealDetail(d);
        });
      });
      // Search input
      const searchEl = m.el.querySelector('#drillSearch');
      if (searchEl) {
        // Auto-focus search on open
        if (!STATE.search) setTimeout(() => searchEl.focus(), 50);
        searchEl.addEventListener('input', () => {
          STATE.search = searchEl.value;
          const cursor = searchEl.selectionStart;
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(() => {
            m.el.querySelector('.modal-body').innerHTML = buildBodyHtml();
            rebind();
            const newEl = m.el.querySelector('#drillSearch');
            if (newEl) { newEl.focus(); try { newEl.setSelectionRange(cursor, cursor); } catch (_) {} }
          }, 150);
        });
      }
      const clearBtn = m.el.querySelector('#drillClearSearch');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          STATE.search = '';
          m.el.querySelector('.modal-body').innerHTML = buildBodyHtml();
          rebind();
          const newEl = m.el.querySelector('#drillSearch');
          if (newEl) newEl.focus();
        });
      }
    }
    rebind();

    const f = m.el.querySelector('.modal-footer');
    f.innerHTML = '';
    const close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Close';
    close.addEventListener('click', () => m.close());
    const goAll = document.createElement('button'); goAll.className = 'btn btn-primary'; goAll.textContent = '📄 Open All Deals';
    goAll.addEventListener('click', () => { m.close(); location.hash = '#/pipeline'; });
    f.appendChild(close);
    f.appendChild(goAll);
  }

  /* ----- Open full deal detail modal — shared by All Deals + drillModal ----- */
  function openDealDetail(deal) {
    if (!deal) return;
    const fmt = { THB: fmtTHB, THBFull: fmtTHBFull, THBExact: fmtTHBExact, date: fmtDate };
    const dRaw = (col) => {
      const v = deal._raw && deal._raw[col];
      if (v instanceof Date) return fmt.date(v);
      if (v === '' || v == null) return '—';
      return escapeHtml(String(v));
    };
    const moneyVal = (n) => {
      const num = Number(n);
      return isFinite(num) ? `<span class="num-tip" title="${fmt.THBExact(num).replace(/"/g, '&quot;')}">${fmt.THBFull(num)}</span>` : '—';
    };
    const dealKey = deal.id || deal.dealName || ('row_' + (deal._idx != null ? deal._idx : Math.random().toString(36).slice(2, 8)));
    const comment = (App.Settings && App.Settings.getDealComment) ? App.Settings.getDealComment(dealKey) : '';
    const statusColor = ((App.StatusMapping && App.StatusMapping.COLORS && App.StatusMapping.COLORS[deal.status]) || {}).fill || '#94a3b8';

    function rawAny(...cols) {
      for (const c of cols) {
        const v = deal._raw ? deal._raw[c] : undefined;
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return '';
    }
    const saleOrderNo = rawAny('Sale Order No. (Dynamic365)', 'Sale Order No.', 'Dynamic365', 'SO No.');
    const zoomAccount = rawAny('Zoom Account Number', 'Zoom Account No.');
    const zoomLicense = rawAny('Detail Zoom License Activation', 'Zoom License Activation');

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="deal-header">
        <div class="deal-header-main">
          <div class="deal-name-text">${escapeHtml(deal.dealName || deal.company || ('Deal #' + deal.id))}</div>
          <div class="deal-meta-line">${escapeHtml(deal.company || '—')} · ID #${escapeHtml(String(deal.id || '—'))}</div>
        </div>
        <div class="deal-status-badge" style="background:${statusColor}20; color:${statusColor}; border:1.5px solid ${statusColor};">
          ${deal.status || '—'}
        </div>
      </div>
      <div class="deal-section">
        <div class="deal-section-title">Key Metrics</div>
        <div class="deal-metrics">
          <div class="deal-metric income"><div class="metric-label">Income</div><div class="metric-value">${moneyVal(deal.income)}</div></div>
          <div class="deal-metric gp"><div class="metric-label">Gross Profit</div><div class="metric-value">${moneyVal(deal.grossProfit)}</div></div>
          <div class="deal-metric np"><div class="metric-label">Net Profit</div><div class="metric-value">${moneyVal(deal.netProfit)}</div></div>
        </div>
      </div>
      <div class="deal-grid-2">
        <div class="deal-section">
          <div class="deal-section-title">Deal Info</div>
          <table class="deal-tbl">
            <tr><th>Pipeline</th><td>${escapeHtml(deal.pipeline || '—')}</td></tr>
            <tr><th>Stage</th><td>${escapeHtml(deal.stage || '—')}</td></tr>
            <tr><th>Deal Type</th><td>${escapeHtml(deal.dealType || '—')}</td></tr>
            <tr><th>Billing Type</th><td>${dRaw('Billing Type')}</td></tr>
            <tr><th>Product Type</th><td>${escapeHtml(deal.productType || '—')}</td></tr>
          </table>
        </div>
        <div class="deal-section">
          <div class="deal-section-title">Ownership &amp; Customer</div>
          <table class="deal-tbl">
            <tr><th>Responsible</th><td><strong>${escapeHtml(deal.responsible || '—')}</strong></td></tr>
            <tr><th>Team</th><td>${escapeHtml(deal.team || '—')}</td></tr>
            <tr><th>Company</th><td><strong>${escapeHtml(deal.company || '—')}</strong></td></tr>
            <tr><th>End Customer</th><td>${escapeHtml(deal.endCustomer || '—')}</td></tr>
          </table>
        </div>
      </div>
      <div class="deal-section">
        <div class="deal-section-title">Renewal &amp; Contract</div>
        <table class="deal-tbl deal-tbl-wide">
          <tr><th>Renew Target</th><td>${moneyVal(deal.renewTarget)}</td><th>Sale Order No. (Dynamic365)</th><td>${escapeHtml(String(saleOrderNo || '—'))}</td></tr>
          <tr><th>Contract Start Date</th><td>${fmt.date(deal.contractStartDate)}</td><th>Contract End Date</th><td>${fmt.date(deal.contractEndDate)}</td></tr>
          <tr><th>Expected Close Date</th><td colspan="3">${fmt.date(deal.expectedClose)}</td></tr>
        </table>
      </div>
      <div class="deal-section">
        <div class="deal-section-title">Zoom</div>
        <table class="deal-tbl deal-tbl-wide">
          <tr><th>Account Number</th><td>${escapeHtml(String(zoomAccount || '—'))}</td><th>License Activation</th><td>${escapeHtml(String(zoomLicense || '—'))}</td></tr>
        </table>
      </div>
      <div class="deal-section">
        <div class="deal-section-title">💬 Comments <span style="font-weight:400; color:var(--text-faint); font-size:11px;">— saved locally on this device</span></div>
        <textarea id="dealCommentInput" placeholder="Add notes about this deal..." class="deal-comment">${escapeHtml(comment)}</textarea>
      </div>
    `;
    const m = modal({
      title: deal.dealName || deal.company || ('Deal #' + deal.id),
      body, footer: ' ', width: '900px',
    });
    const f = m.el.querySelector('.modal-footer');
    f.innerHTML = '';
    const close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Close';
    close.addEventListener('click', () => {
      const txt = m.el.querySelector('#dealCommentInput').value;
      if (App.Settings && App.Settings.setDealComment) App.Settings.setDealComment(dealKey, txt);
      m.close();
      if (txt !== comment) toast('Comment saved', 'success');
    });
    f.appendChild(close);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ----- safeColor: validate user-supplied color values before they're
     interpolated into inline style="" attributes. Without this guard a
     malicious team color like  "red; background: url(javascript:...)"
     would be written verbatim into the DOM. Allow only proper hex
     forms; anything else falls back to a neutral slate. ----- */
  function safeColor(c, fallback) {
    if (typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c.trim())) {
      return c.trim();
    }
    return fallback || '#94a3b8';
  }

  /* ----- Reusable donut chart options (center text + slice labels) ----- */
  function donutOptions(opts = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: opts.cutout || '62%',
      plugins: {
        legend: { position: opts.legend || 'right', labels: { font: { size: 11 }, usePointStyle: true } },
        tooltip: {
          callbacks: { label: c => `${c.label}: ${fmtTHBExact(c.parsed)}` },
        },
        donutCenter: {
          label: opts.centerLabel || 'Total',
          // Default = comma format with no decimals (eg. "106,683,558")
          // Override with opts.centerFormatter (eg. for abbreviated "106.68M")
          formatter: opts.centerFormatter || ((v) => fmtComma(v)),
        },
        datalabels: {
          display: (ctx) => {
            try {
              const dataArr = (ctx.dataset && ctx.dataset.data) || [];
              let total = 0;
              for (const x of dataArr) total += Number(x) || 0;
              const v = Number(ctx.parsed) || 0;
              return total > 0 && v / total >= 0.04;
            } catch (_) { return false; }
          },
          color: 'white',
          font: { size: 11, weight: 'bold' },
          textAlign: 'center',
          formatter: (v, ctx) => {
            try {
              const dataArr = (ctx.dataset && ctx.dataset.data) || [];
              let total = 0;
              for (const x of dataArr) total += Number(x) || 0;
              const num = Number(v) || 0;
              if (total === 0) return '';
              return `${fmtTHB(num)}\n${(num / total * 100).toFixed(0)}%`;
            } catch (_) { return ''; }
          },
        },
      },
    };
  }

  window.App = window.App || {};
  window.App.UI = {
    toast,
    buildMultiSelect,
    modal,
    confirm,
    donutOptions,
    drillModal,
    openDealDetail,
    exportToExcel, exportToCSV, screenshotElement,
    safeColor, escapeHtml,
    fmt: {
      THB: fmtTHB, THBFull: fmtTHBFull, THBExact: fmtTHBExact,
      comma: fmtComma, comma2: fmtComma2, pct: fmtPct, int: fmtInt, date: fmtDate,
      localDateISO, todayLocalISO,
    },
  };
})();
