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

    const trigger = document.createElement('button');
    trigger.className = 'ms-trigger';
    trigger.type = 'button';
    trigger.textContent = 'All';
    container.appendChild(trigger);

    const panel = document.createElement('div');
    panel.className = 'ms-panel';
    panel.innerHTML = `
      <input type="text" class="ms-search" placeholder="Search...">
      <div class="ms-options"></div>
      <div class="ms-actions">
        <button class="ms-link" type="button" data-act="all">Select all</button>
        <button class="ms-link" type="button" data-act="none">Clear</button>
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
        trigger.textContent = 'All';
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
      document.querySelectorAll('.ms-panel.open').forEach(p => { if (p !== panel) p.classList.remove('open'); });
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        search.value = '';
        renderOptions();
        search.focus();
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

  // Close any open dropdowns when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.ms-panel.open').forEach(p => p.classList.remove('open'));
  });

  /* ----- Modal ----- */
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
          <button class="modal-close" aria-label="Close">×</button>
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

    function close() {
      backdrop.classList.remove('open');
      onClose && onClose();
    }
    backdrop.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    setTimeout(() => backdrop.classList.add('open'), 10);

    return { close, el: backdrop };
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

  function fmtTHB(n) {
    if (!isFinite(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n/1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (n/1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (n/1e3).toFixed(1) + 'K';
    return n.toFixed(0);
  }
  function fmtTHBFull(n) {
    if (!isFinite(n)) return '—';
    return 'THB ' + formatter.format(Math.round(n));
  }
  function fmtComma(n) {
    if (!isFinite(n)) return '—';
    return formatter.format(Math.round(n));
  }
  function fmtComma2(n) {
    if (!isFinite(n)) return '—';
    return formatter2.format(n);
  }
  function fmtPct(n, digits = 1) {
    if (!isFinite(n)) return '—';
    return (n * 100).toFixed(digits) + '%';
  }
  function fmtInt(n) {
    return formatter.format(Math.round(n || 0));
  }
  function fmtDate(d) {
    if (!d) return '—';
    if (typeof d === 'string') d = new Date(d);
    if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 10);
  }

  /* ----- Reusable donut chart options (center text + slice labels) ----- */
  function donutOptions(opts = {}) {
    const f = { THB: fmtTHB, THBFull: fmtTHBFull };
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: opts.cutout || '62%',
      plugins: {
        legend: { position: opts.legend || 'right', labels: { font: { size: 11 }, usePointStyle: true } },
        tooltip: {
          callbacks: { label: c => `${c.label}: ${f.THBFull(c.parsed)}` },
        },
        donutCenter: {
          label: opts.centerLabel || 'Total',
          formatter: opts.centerFormatter || (v => f.THB(v)),
        },
        datalabels: {
          display: ctx => {
            const total = ctx.dataset.data.reduce((s, x) => s + (Number(x) || 0), 0);
            return total > 0 && ctx.parsed / total >= 0.04;
          },
          color: 'white',
          font: { size: 11, weight: 'bold' },
          textAlign: 'center',
          formatter: (v, ctx) => {
            const total = ctx.dataset.data.reduce((s, x) => s + (Number(x) || 0), 0);
            if (total === 0) return '';
            return `${f.THB(v)}\n${(v / total * 100).toFixed(0)}%`;
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
    fmt: { THB: fmtTHB, THBFull: fmtTHBFull, comma: fmtComma, comma2: fmtComma2, pct: fmtPct, int: fmtInt, date: fmtDate },
  };
})();
