/* ========================================================================
   Page: Action Center — actionable items that need attention
   Click any item to see details (drillModal)
   ======================================================================== */
(function () {
  function render(container, parsed) {
    if (!parsed || !parsed.deals.length) {
      container.innerHTML = `
        <div class="placeholder-page">
          <div class="icon">🎯</div>
          <h2>Action Center</h2>
          <p>Upload Bitrix data to see what needs your attention.</p>
          <button class="btn btn-primary btn-lg" data-action="upload">📥 Upload data</button>
        </div>`;
      container.querySelectorAll('[data-action="upload"]').forEach(b => b.addEventListener('click', () => document.getElementById('fileInput').click()));
      return;
    }
    const M = App.Filters.Matchers;
    const NEW = App.Filters.NEW_TYPES;
    const all = App.Filters.dashboardScope(App.Filters.apply(parsed.deals));
    const fmt = App.UI.fmt;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7 = new Date(today.getTime() + 7 * 86400000);
    const in15 = new Date(today.getTime() + 15 * 86400000);
    const ago30 = new Date(today.getTime() - 30 * 86400000);

    // Compute action buckets
    const overdueRenew = all.filter(d => M.isRenew(d)
      && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')
      && d.expectedClose && d.expectedClose < today);
    const overdueNew = all.filter(d => NEW.has(d.dealType)
      && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')
      && d.expectedClose && d.expectedClose < today);
    const dueRenew7 = all.filter(d => M.isRenew(d)
      && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')
      && d.expectedClose && d.expectedClose >= today && d.expectedClose <= in7);
    const dueNew7 = all.filter(d => NEW.has(d.dealType)
      && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')
      && d.expectedClose && d.expectedClose >= today && d.expectedClose <= in7);
    const dueRenew15 = all.filter(d => M.isRenew(d)
      && (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')
      && d.expectedClose && d.expectedClose > in7 && d.expectedClose <= in15);
    const commitDeals = all.filter(d => d.status === 'Commit');
    const upsideDeals = all.filter(d => d.status === 'Upside');
    const bigOpenDeals = all.filter(d => d.status === 'Open' && d.income >= 500000)
      .sort((a, b) => b.income - a.income).slice(0, 20);
    const stuckDeals = all.filter(d => (d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside')
      && d.stageChangeDate && d.stageChangeDate < ago30);

    function sumValue(arr) { return arr.reduce((s, d) => s + (d.income || 0), 0); }

    // Action items definition
    const items = [
      {
        icon: '🚨', accent: 'danger',
        title: `Overdue Renewals — ${overdueRenew.length} deals`,
        sub: `Total ${fmt.THBFull(sumValue(overdueRenew))} · close date passed but still Open/Commit/Upside`,
        cta: 'Review now',
        deals: overdueRenew,
        drillTitle: 'Overdue Renewals',
      },
      {
        icon: '⚠️', accent: 'danger',
        title: `Overdue New deals — ${overdueNew.length} deals`,
        sub: `Total ${fmt.THBFull(sumValue(overdueNew))} · close date passed but still open`,
        cta: 'Review',
        deals: overdueNew,
        drillTitle: 'Overdue New deals',
      },
      {
        icon: '📅', accent: 'warning',
        title: `Renewals due in 7 days — ${dueRenew7.length} deals`,
        sub: `Total ${fmt.THBFull(sumValue(dueRenew7))} · upcoming this week`,
        cta: 'Follow up',
        deals: dueRenew7,
        drillTitle: 'Renewals due in 7 days',
      },
      {
        icon: '📅', accent: 'warning',
        title: `New deals closing in 7 days — ${dueNew7.length} deals`,
        sub: `Total ${fmt.THBFull(sumValue(dueNew7))} · push to close`,
        cta: 'Follow up',
        deals: dueNew7,
        drillTitle: 'New deals due in 7 days',
      },
      {
        icon: '✅', accent: 'success',
        title: `Commit stage — ${commitDeals.length} deals`,
        sub: `Total ${fmt.THBFull(sumValue(commitDeals))} · agreed but not yet won`,
        cta: 'Review',
        deals: commitDeals,
        drillTitle: 'Deals in Commit stage',
      },
      {
        icon: '💡', accent: '',
        title: `Upside opportunities — ${upsideDeals.length} deals`,
        sub: `Total ${fmt.THBFull(sumValue(upsideDeals))} · uncertain but potential`,
        cta: 'Review',
        deals: upsideDeals,
        drillTitle: 'Upside opportunities',
      },
      {
        icon: '🎯', accent: '',
        title: `Big Open deals (≥500K) — ${bigOpenDeals.length} deals`,
        sub: `Top 20 · total ${fmt.THBFull(sumValue(bigOpenDeals))} · prioritize these`,
        cta: 'Review',
        deals: bigOpenDeals,
        drillTitle: 'Big Open deals',
      },
      {
        icon: '🐌', accent: 'warning',
        title: `Stuck deals (no movement >30d) — ${stuckDeals.length} deals`,
        sub: stuckDeals.length > 0
          ? `Total ${fmt.THBFull(sumValue(stuckDeals))} · stage hasn't changed in over 30 days`
          : 'No stage-change date in data — skip',
        cta: 'Review',
        deals: stuckDeals,
        drillTitle: 'Stuck deals (>30 days no movement)',
        skip: stuckDeals.length === 0,
      },
      {
        icon: '🔮', accent: '',
        title: `Renewals due in 8-15 days — ${dueRenew15.length} deals`,
        sub: `Total ${fmt.THBFull(sumValue(dueRenew15))} · plan ahead`,
        cta: 'Review',
        deals: dueRenew15,
        drillTitle: 'Renewals due in 8-15 days',
      },
    ].filter(it => !it.skip && it.deals.length > 0);

    container.innerHTML = `
      <div class="section-title">
        Action Center — items needing your attention
        <span class="actions">
          <span style="font-size:11px; color:var(--text-muted); font-weight:400; text-transform:none; letter-spacing:normal;">
            ${items.length} action${items.length !== 1 ? 's' : ''} in current scope
          </span>
        </span>
      </div>

      <div class="actions-grid">
        ${items.length === 0 ? `
          <div class="card" style="text-align:center; padding:40px;">
            <div style="font-size:48px; margin-bottom:14px;">✨</div>
            <div style="font-weight:700; font-size:16px; margin-bottom:4px;">All clear!</div>
            <div style="color:var(--text-muted); font-size:13px;">No urgent items in the current filter scope.</div>
          </div>
        ` : items.map((it, i) => `
          <div class="action-card ${it.accent}" data-action-idx="${i}">
            <div class="action-ico">${it.icon}</div>
            <div class="action-body">
              <div class="action-title">${it.title}</div>
              <div class="action-sub">${it.sub}</div>
            </div>
            <button class="btn btn-sm action-cta">${it.cta} →</button>
          </div>
        `).join('')}
      </div>

      ${parsed ? '' : ''}
    `;

    container.querySelectorAll('.action-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.actionIdx);
        const it = items[idx];
        if (!it) return;
        App.UI.drillModal({
          title: it.drillTitle,
          subtitle: it.sub,
          deals: it.deals,
        });
      });
    });
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.Pages.actions = { render };
})();
