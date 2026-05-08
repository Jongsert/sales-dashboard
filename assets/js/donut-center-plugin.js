/* ========================================================================
   DonutCenterPlugin — Chart.js v4 plugin for donut center text + tooltip overlay
   Registered globally on window load. Reads opts from chart.options.plugins.donutCenter.
   ======================================================================== */
const DonutCenterPlugin = {
  id: 'donutCenter',
  afterDraw(chart) {
    try {
      const type = (chart.config && (chart.config.type || (chart.config._config && chart.config._config.type)))
                || (chart.options && chart.options.type);
      if (type !== 'doughnut' && type !== 'pie') return;

      const opts = chart.options && chart.options.plugins && chart.options.plugins.donutCenter;
      if (!opts || opts.display === false) return;

      const dataset = chart.data && chart.data.datasets && chart.data.datasets[0];
      const dataArr = dataset && Array.isArray(dataset.data) ? dataset.data : [];
      let total = 0;
      for (const v of dataArr) {
        const num = typeof v === 'number' ? v
                  : (v && typeof v.value === 'number') ? v.value
                  : Number(v);
        if (isFinite(num)) total += num;
      }
      if (total <= 0 && !opts.value) return;

      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      if (!ctx || !chartArea) return;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelText = String(opts.label || 'Total');

      function safeFormat(n) {
        const num = Number(n);
        if (!isFinite(num)) return '—';
        return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
      let valueText;
      try {
        if (opts.formatter) {
          const r = opts.formatter(total);
          valueText = (typeof r === 'string' && r.trim()) ? r : safeFormat(total);
        } else {
          valueText = safeFormat(total);
        }
      } catch (e) {
        valueText = safeFormat(total);
      }
      // Detect print mode: force readable colors (in case print CSS hasn't
      // propagated to canvas via getComputedStyle yet)
      const isPrint = !!(window._isPrinting);
      const labelColor = isPrint ? '#475569' : '#94a3b8';
      const textColor = isPrint
        ? '#0f172a'
        : (getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#0f172a');
      const haloColor = isPrint ? '#ffffff'
        : (getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff');

      // Label text ("TOTAL" small caps above)
      ctx.font = "600 10px 'Sukhumvit Set', 'Inter', sans-serif";
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = haloColor;
      ctx.strokeText(labelText.toUpperCase(), cx, cy - 14);
      ctx.fillStyle = labelColor;
      ctx.fillText(labelText.toUpperCase(), cx, cy - 14);

      // Value text (main number) — paint a halo first so text is readable
      // against any background (light/dark theme + white print paper)
      ctx.font = "800 18px 'Sukhumvit Set', 'Inter', sans-serif";
      ctx.lineWidth = 4;
      ctx.strokeStyle = haloColor;
      ctx.strokeText(valueText, cx, cy + 6);
      ctx.fillStyle = textColor;
      ctx.fillText(valueText, cx, cy + 6);
      ctx.restore();

      // HTML overlay div on the donut hole for hover tooltip showing exact value.
      // Position from chart.chartArea (real donut center, not wrapper center —
      // important when legend takes up space on the right).
      const wrap = chart.canvas && chart.canvas.parentElement;
      if (wrap) {
        const cs = getComputedStyle(wrap);
        if (cs.position === 'static') wrap.style.position = 'relative';
        let overlay = wrap.querySelector('.donut-center-tooltip');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'donut-center-tooltip';
          wrap.appendChild(overlay);
        }
        const exact = (window.App && App.UI && App.UI.fmt && App.UI.fmt.THBExact)
          ? App.UI.fmt.THBExact(total)
          : String(total);
        const tipText = `${labelText}: ${exact}`;
        overlay.setAttribute('data-tooltip', tipText);
        overlay.removeAttribute('title');

        const wrapRect = wrap.getBoundingClientRect();
        const canvasRect = chart.canvas.getBoundingClientRect();
        const offsetLeft = (canvasRect.left - wrapRect.left) + cx;
        const offsetTop = (canvasRect.top - wrapRect.top) + cy;
        overlay.style.left = offsetLeft + 'px';
        overlay.style.top = offsetTop + 'px';
      }
    } catch (e) {
      console.warn('DonutCenterPlugin error:', e);
    }
  },
};

window.addEventListener('load', () => {
  if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
    Chart.register(DonutCenterPlugin);
    Chart.defaults.font.family = "'Sukhumvit Set', 'SukhumvitSet-Text', -apple-system, 'Inter', 'Noto Sans Thai', sans-serif";
    Chart.defaults.color = '#64748b';
    Chart.defaults.plugins.datalabels = Chart.defaults.plugins.datalabels || {};
    Chart.defaults.plugins.datalabels.display = false;
  }
});
