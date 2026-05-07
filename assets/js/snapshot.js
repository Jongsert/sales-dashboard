/* ========================================================================
   Snapshot — capture point-in-time KPIs for week-over-week tracking
   ======================================================================== */
(function () {
  function capture(label) {
    const parsed = App.STATE && App.STATE.parsed;
    if (!parsed || !parsed.deals) {
      App.UI && App.UI.toast('Upload data before taking a snapshot', 'error');
      return null;
    }
    const M = App.Filters.Matchers;
    const NEW = App.Filters.NEW_TYPES;
    const all = App.Filters.dashboardScope(App.Filters.apply(parsed.deals));
    const settings = App.Settings.load();

    const renewDeals = all.filter(M.isRenew);
    const newDeals = all.filter(d => NEW.has(d.dealType));
    const renewTarget = renewDeals.reduce((s, d) => s + (d.renewTarget || 0), 0);
    const newTarget = newSellTargetSum(settings);
    const totalTarget = renewTarget + newTarget;

    const wonRenew = renewDeals.filter(M.won).reduce((s, d) => s + d.income, 0);
    const wonNew = newDeals.filter(M.won).reduce((s, d) => s + d.income, 0);
    const wonTotal = wonRenew + wonNew;
    const openRenew = renewDeals.filter(d => d.status === 'Open').reduce((s, d) => s + d.income, 0);
    const openNew = newDeals.filter(d => d.status === 'Open').reduce((s, d) => s + d.income, 0);
    const commitTotal = all.filter(d => d.status === 'Commit').reduce((s, d) => s + d.income, 0);
    const upsideTotal = all.filter(d => d.status === 'Upside').reduce((s, d) => s + d.income, 0);
    const lostTotal = all.filter(d => d.status === 'Lost').reduce((s, d) => s + d.income, 0);

    const achievement = totalTarget > 0 ? wonTotal / totalTarget : 0;

    // Top 5 users
    const userBuckets = {};
    all.forEach(d => {
      const u = d.responsible || 'Unassigned';
      if (!userBuckets[u]) userBuckets[u] = 0;
      if (d.status === 'Won') userBuckets[u] += d.income;
    });
    const topUsers = Object.entries(userBuckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, won]) => ({ name, won }));

    const snapshot = {
      label: label || '',
      timestamp: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      fileName: parsed.fileName,
      dealCount: all.length,
      totalTarget,
      renewTarget,
      newTarget,
      wonTotal,
      wonRenew,
      wonNew,
      openRenew,
      openNew,
      commitTotal,
      upsideTotal,
      lostTotal,
      achievement,
      topUsers,
    };

    const s = App.Settings.load();
    s.snapshots = s.snapshots || [];
    s.snapshots.push(snapshot);
    if (s.snapshots.length > 52) s.snapshots = s.snapshots.slice(-52);
    App.Settings.save();

    return snapshot;
  }

  function deleteSnapshot(timestamp) {
    const s = App.Settings.load();
    s.snapshots = (s.snapshots || []).filter(sn => sn.timestamp !== timestamp);
    App.Settings.save();
  }

  function clearAll() {
    const s = App.Settings.load();
    s.snapshots = [];
    App.Settings.save();
  }

  function newSellTargetSum(settings) {
    const targets = settings.newSellTargets || {};
    const usersList = settings.users || [];
    const F = App.Filters.STATE;
    const from = F.period.from, to = F.period.to;
    const userTeamMap = {};
    usersList.forEach(u => userTeamMap[u.name] = u.team || 'Unassigned');
    function userPasses(name) {
      if (F.user.size && !F.user.has(name)) return false;
      if (F.team.size && !F.team.has(userTeamMap[name] || 'Unassigned')) return false;
      return true;
    }
    let total = 0;
    Object.keys(targets).forEach(yearStr => {
      const year = parseInt(yearStr);
      if (from && year < from.getFullYear()) return;
      if (to && year > to.getFullYear()) return;
      Object.entries(targets[yearStr]).forEach(([userName, arr]) => {
        if (!userPasses(userName) || !Array.isArray(arr)) return;
        arr.forEach((v, idx) => {
          const monthStart = new Date(year, idx, 1);
          const monthEnd = new Date(year, idx + 1, 0, 23, 59, 59);
          if (from && monthEnd < from) return;
          if (to && monthStart > to) return;
          total += v || 0;
        });
      });
    });
    return total;
  }

  window.App = window.App || {};
  window.App.Snapshot = { capture, delete: deleteSnapshot, clearAll };
})();
