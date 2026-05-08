/* ========================================================================
   Calendar Picker — custom date popup (AD only, no BE conversion)
   Replaces <input type="date"> with a uniform cross-browser experience.
   API: App.UI.attachDatePicker(inputEl, { placeholder })
        — converts inputEl into a click-to-open date picker
        — fires native 'change' event when value changes
        — value format: YYYY-MM-DD (same as native date input)
   ======================================================================== */
(function () {
  const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const MONTH_LABELS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let openPanel = null;

  function attachDatePicker(inputEl, opts) {
    opts = opts || {};
    inputEl.readOnly = true;
    inputEl.classList.add('cal-input');
    if (opts.placeholder) inputEl.placeholder = opts.placeholder;
    if (!inputEl.placeholder) inputEl.placeholder = 'YYYY-MM-DD';

    inputEl.addEventListener('click', (e) => {
      e.stopPropagation();
      // Toggle: if same input already open, close
      if (openPanel && openPanel.inputEl === inputEl) {
        closeOpen();
        return;
      }
      open(inputEl, opts);
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (openPanel && openPanel.inputEl === inputEl) closeOpen();
        else open(inputEl, opts);
      }
      if (e.key === 'Escape' && openPanel) closeOpen();
    });
  }

  function open(inputEl, opts) {
    closeOpen();

    const panel = document.createElement('div');
    panel.className = 'cal-panel';

    const initialDate = parseISO(inputEl.value) || new Date();
    let viewYear = initialDate.getFullYear();
    let viewMonth = initialDate.getMonth();
    let pickerMode = 'day';   // 'day' | 'month' | 'year'

    function render() {
      if (pickerMode === 'day') {
        panel.innerHTML = `
          <div class="cal-header">
            <button class="cal-nav" data-cal-prev title="Previous month">‹</button>
            <button class="cal-title" data-cal-mode="month" title="Pick month/year">
              ${MONTH_LABELS[viewMonth]} ${viewYear}
            </button>
            <button class="cal-nav" data-cal-next title="Next month">›</button>
          </div>
          <div class="cal-day-labels">
            ${DAY_LABELS.map(d => `<span>${d}</span>`).join('')}
          </div>
          <div class="cal-grid">
            ${renderDayCells(viewYear, viewMonth, inputEl.value)}
          </div>
          <div class="cal-actions">
            <button class="cal-action" data-cal-today>Today</button>
            <button class="cal-action" data-cal-clear>Clear</button>
          </div>
        `;
        panel.querySelector('[data-cal-prev]').addEventListener('click', stop(() => {
          viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
          render();
        }));
        panel.querySelector('[data-cal-next]').addEventListener('click', stop(() => {
          viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
          render();
        }));
        panel.querySelector('[data-cal-mode]').addEventListener('click', stop(() => {
          pickerMode = 'month'; render();
        }));
        panel.querySelectorAll('[data-cal-day]').forEach(b => {
          b.addEventListener('click', stop(() => commit(b.dataset.calDay)));
        });
        panel.querySelector('[data-cal-today]').addEventListener('click', stop(() => commit(todayISO())));
        panel.querySelector('[data-cal-clear]').addEventListener('click', stop(() => commit('')));
      } else if (pickerMode === 'month') {
        panel.innerHTML = `
          <div class="cal-header">
            <button class="cal-nav" data-cal-yprev title="Previous year">‹</button>
            <button class="cal-title" data-cal-mode="year" title="Pick year">${viewYear}</button>
            <button class="cal-nav" data-cal-ynext title="Next year">›</button>
          </div>
          <div class="cal-month-grid">
            ${MONTH_LABELS.map((m, i) => `
              <button class="cal-month-cell ${i === viewMonth ? 'cal-selected' : ''}" data-cal-pick-m="${i}">${m.slice(0, 3)}</button>
            `).join('')}
          </div>
          <div class="cal-actions">
            <button class="cal-action" data-cal-back>← Back to calendar</button>
          </div>
        `;
        panel.querySelector('[data-cal-yprev]').addEventListener('click', stop(() => { viewYear--; render(); }));
        panel.querySelector('[data-cal-ynext]').addEventListener('click', stop(() => { viewYear++; render(); }));
        panel.querySelector('[data-cal-mode]').addEventListener('click', stop(() => { pickerMode = 'year'; render(); }));
        panel.querySelectorAll('[data-cal-pick-m]').forEach(b => {
          b.addEventListener('click', stop(() => {
            viewMonth = parseInt(b.dataset.calPickM); pickerMode = 'day'; render();
          }));
        });
        panel.querySelector('[data-cal-back]').addEventListener('click', stop(() => { pickerMode = 'day'; render(); }));
      } else if (pickerMode === 'year') {
        const startYear = Math.floor(viewYear / 12) * 12;
        const years = [];
        for (let i = 0; i < 12; i++) years.push(startYear + i);
        panel.innerHTML = `
          <div class="cal-header">
            <button class="cal-nav" data-cal-yprev title="Previous decade">‹</button>
            <div class="cal-title-static">${startYear} – ${startYear + 11}</div>
            <button class="cal-nav" data-cal-ynext title="Next decade">›</button>
          </div>
          <div class="cal-year-grid">
            ${years.map(y => `<button class="cal-year-cell ${y === viewYear ? 'cal-selected' : ''}" data-cal-pick-y="${y}">${y}</button>`).join('')}
          </div>
          <div class="cal-actions">
            <button class="cal-action" data-cal-back>← Back to calendar</button>
          </div>
        `;
        panel.querySelector('[data-cal-yprev]').addEventListener('click', stop(() => { viewYear -= 12; render(); }));
        panel.querySelector('[data-cal-ynext]').addEventListener('click', stop(() => { viewYear += 12; render(); }));
        panel.querySelectorAll('[data-cal-pick-y]').forEach(b => {
          b.addEventListener('click', stop(() => {
            viewYear = parseInt(b.dataset.calPickY); pickerMode = 'month'; render();
          }));
        });
        panel.querySelector('[data-cal-back]').addEventListener('click', stop(() => { pickerMode = 'day'; render(); }));
      }
    }

    function commit(value) {
      inputEl.value = value;
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      closeOpen();
    }

    document.body.appendChild(panel);
    render();
    panel.addEventListener('click', e => e.stopPropagation());

    // Position below input (or above if not enough room)
    const rect = inputEl.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = (spaceBelow > panelRect.height + 8 || rect.top < panelRect.height + 8)
      ? rect.bottom + window.scrollY + 4
      : rect.top + window.scrollY - panelRect.height - 4;
    let left = rect.left + window.scrollX;
    // Clamp to viewport horizontally
    if (left + panelRect.width > window.innerWidth - 8) left = window.innerWidth - panelRect.width - 8;
    if (left < 8) left = 8;
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';

    openPanel = { panel, inputEl };
  }

  function closeOpen() {
    if (!openPanel) return;
    openPanel.panel.remove();
    openPanel = null;
  }

  function renderDayCells(year, month, selectedISO) {
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = todayISO();
    const cells = [];

    // Previous-month tail
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      cells.push({ day, dateISO: formatISO(year, month - 1, day), muted: true, dow: new Date(year, month - 1, day).getDay() });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateISO: formatISO(year, month, d), muted: false, dow: new Date(year, month, d).getDay() });
    }
    // Next-month padding to fill 6 weeks
    let nd = 1;
    while (cells.length < 42) {
      cells.push({ day: nd, dateISO: formatISO(year, month + 1, nd), muted: true, dow: new Date(year, month + 1, nd).getDay() });
      nd++;
    }

    return cells.map(c => {
      const isSelected = c.dateISO === selectedISO;
      const isToday = c.dateISO === todayStr;
      const isWeekend = c.dow === 0 || c.dow === 6;
      const cls = [
        'cal-cell',
        c.muted ? 'cal-muted' : '',
        isToday ? 'cal-today' : '',
        isSelected ? 'cal-selected' : '',
        isWeekend ? 'cal-weekend' : '',
      ].filter(Boolean).join(' ');
      return `<button class="${cls}" data-cal-day="${c.dateISO}">${c.day}</button>`;
    }).join('');
  }

  function stop(fn) { return (e) => { e.stopPropagation(); fn(e); }; }

  function todayISO() {
    const d = new Date();
    return formatISO(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function formatISO(y, m, d) {
    const date = new Date(y, m, d);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }
  function parseISO(iso) {
    if (!iso) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  }

  // Close on outside mousedown — capture phase so child stopPropagation doesn't block us
  document.addEventListener('mousedown', (e) => {
    if (!openPanel) return;
    if (openPanel.panel.contains(e.target)) return;
    if (e.target === openPanel.inputEl) return;
    closeOpen();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOpen(); });
  // Close on scroll (so popup doesn't drift away from input)
  window.addEventListener('scroll', () => closeOpen(), true);

  window.App = window.App || {};
  window.App.UI = window.App.UI || {};
  window.App.UI.attachDatePicker = attachDatePicker;
})();
