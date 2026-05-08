/* ========================================================================
   i18n — TH / EN translation module
   Default language: TH. Toggle via topbar button (🇹🇭/🇬🇧).

   Style guideline:
   - EN: pure English
   - TH: Thai connector words + English for technical/specific terms.
     Goal: professional, not all-Thai. Examples:
       'KPI หลัก' (not 'ตัวเลขสำคัญ')
       'Trend รายเดือน' (not 'แนวโน้มรายเดือน')
       'Pipeline ทั้งหมด'
   - Status names (Won/Commit/Upside/Open/Lost) stay English in both modes
     (they are technical category labels).

   API:
     App.i18n.t('key')                  → translated string
     App.i18n.t('key', 'Default text')  → fallback if key not found
     App.i18n.setLang('th' | 'en')      → switch + fire 'langchange'
     App.i18n.getLang()                 → current lang
     App.i18n.apply(root)               → translate [data-i18n*] under root
   ======================================================================== */
(function () {
  const STORAGE_KEY = 'salesDashboard.lang';
  const DEFAULT_LANG = 'th';

  const dict = {
    en: {
      // Nav tabs
      'nav.overview': '📊 Overview',
      'nav.actions': '🎯 Action Center',
      'nav.renew': '🔄 Renew',
      'nav.newsell': '✨ New Sell',
      'nav.combined': '📈 Combined',
      'nav.forecast': '🎯 Forecast',
      'nav.pipeline': '📄 All Deals',
      'nav.diff': '📊 Diff',
      'nav.targets': '🎯 Targets',
      'nav.teams': '👥 Teams',
      'nav.statusmap': '🏷️ Status Mapping',
      'nav.settings': '⚙️ Settings',

      // Topbar
      'top.upload': '📥 Upload Data',
      'top.theme.title': 'Toggle theme (Light / Dark / System)',
      'top.copyUrl.title': 'Copy current view URL (with all filters applied)',
      'top.lang.title': 'Toggle language (Thai / English)',

      // Common buttons
      'btn.save': 'Save',
      'btn.cancel': 'Cancel',
      'btn.confirm': 'Confirm',
      'btn.apply': 'Apply',
      'btn.close': 'Close',
      'btn.reset': 'Reset',
      'btn.copy': 'Copy',
      'btn.delete': 'Delete',
      'btn.add': 'Add',
      'btn.edit': 'Edit',
      'btn.export.excel': '⬇️ Export Excel',
      'btn.export.csv': '⬇️ CSV',
      'btn.print': '🖨️ Print',
      'btn.snapshot': '📸 Save snapshot',
      'btn.takeSnapshot': '📸 Take snapshot now',
      'btn.import': '📥 Import Settings',
      'btn.export.settings': '⬇️ Export Settings',
      'btn.upload': '📥 Upload data',
      'btn.copyJson': '📋 Copy JSON to clipboard',
      'btn.columns': '⚙️ Columns',
      'btn.copyPrev': 'Copy from prev year',
      'btn.bulkFill': 'Bulk fill...',
      'btn.distribute': 'Smart distribute...',
      'btn.openTeams': '👥 Manage Teams & Users →',
      'btn.openStatusMap': '🏷️ Manage Status Mapping →',
      'btn.clearAll': 'Clear all',
      'btn.resetAll': 'Reset all settings',
      'btn.openAllDeals': '📄 Open All Deals',

      // Section titles
      'sec.keyMetrics': 'Key Metrics',
      'sec.trendByMonth': 'Trend by Month — All deals (Won/Commit/Upside/Open/Lost)',
      'sec.perUserPipeline': 'Per-User Pipeline Snapshot',
      'sec.performanceBreakdown': 'Performance Breakdown',
      'sec.topPerformers': 'Top Performers',
      'sec.stageFunnel': 'Stage Funnel',
      'sec.allDeals': 'All Deals',
      'sec.newSellTargets': 'New Sell Targets',
      'sec.renewTargetAuto': 'Renew Target — auto from data (Subscription Renew + Auto Renew)',
      'sec.forecastDetail': 'Forecast Detail Table',
      'sec.snapshotHistory': 'Snapshot History',
      'sec.uiPreferences': 'UI Preferences',
      'sec.accessControl': 'Access Control',
      'sec.dangerZone': 'Danger Zone',
      'sec.backupRestore': 'Backup & Restore',
      'sec.statusMapping': 'Status Mapping',
      'sec.usersTeams': 'Users & Teams',
      'sec.headlineKpis': 'Headline KPIs',
      'sec.statusBreakdown': 'Status Breakdown',
      'sec.weeklyComparison': 'Diff View — Week-over-Week',
      'sec.diffTrend': 'Trend (last 12 snapshots)',
      'sec.monthlyTrajectory': 'Monthly Trajectory — Won + Pipeline Forecast vs Target',
      'sec.cumulativeTrajectory': 'Cumulative Trajectory — accumulated',
      'sec.renewalEstimate': 'Renewal Estimate Settings',
      'sec.salesForecast': 'Sales Forecast — manual input per user × month',
      'sec.whatIf': 'What-if Scenario Analysis',
      'sec.actionCenter': 'Action Center',
      'sec.renewSummary': 'Renew Summary',
      'sec.newSellSummary': 'New Sell Summary',
      'sec.combinedSummary': 'Combined Summary',

      // Card titles & subtitles
      'card.appearance': 'Appearance',
      'card.systemNote': 'Quick toggle also in topbar (cycles Light → Dark → System)',
      'card.exportImport': '💾 Export / Import all settings',
      'card.exportImportSub': 'Save all configuration as a JSON file — share between team members',
      'card.stageStatus': 'Stage → Status mapping',
      'card.stageStatusSub': 'Map each stage to Won / Commit / Upside / Open / Lost',
      'card.snapshotSub': 'Snapshot captures current KPIs — track week-over-week trend',
      'card.resetTitle': '⚠️ Reset all settings',
      'card.resetSub': 'Clears all preferences, targets, mappings (does NOT delete uploaded data)',
      'card.allDealsTitle': 'All Deals',
      'card.targetsTitle': 'Year {year} · New Sell only',
      'card.targetsSub': 'Click any cell to edit · Auto-saves on change · Renew Target auto-computed below',
      'card.diffPicker': 'Pick two snapshots to compare',
      'card.viewerNote': '👁️ Viewer mode · You are using a read-only build. Admin features (export, settings backup, status mapping, access tokens) are not available.',

      // Filter labels
      'filter.period': 'Period',
      'filter.team': 'Team',
      'filter.user': 'User',
      'filter.pipeline': 'Pipeline',
      'filter.dealType': 'Deal Type',
      'filter.productType': 'Product Type',
      'filter.status': 'Status',
      'filter.all': 'All',
      'filter.selectAll': 'Select all',
      'filter.clear': 'Clear',
      'filter.search': 'Search...',
      'filter.searchAllCols': '🔍 Search across all columns...',

      // Period
      'period.thisMonth': 'This month',
      'period.lastMonth': 'Last month',
      'period.nextMonth': 'Next month',
      'period.mtd': 'Month to date',
      'period.thisQuarter': 'This quarter',
      'period.lastQuarter': 'Last quarter',
      'period.nextQuarter': 'Next quarter',
      'period.qtd': 'Quarter to date',
      'period.thisYear': 'This year',
      'period.lastYear': 'Last year',
      'period.nextYear': 'Next year',
      'period.ytd': 'Year to date',
      'period.all': 'All time',
      'period.custom': 'Custom range',
      'period.quickPreset': 'Quick preset',
      'period.byYear': 'By year',
      'period.selectPreset': '— select preset —',
      'period.placeholder': 'Select period',

      // Diff view
      'diff.from': 'From',
      'diff.to': 'To',
      'diff.swap': '⇄ Swap',
      'diff.delta': 'Δ Change',
      'diff.title': 'Diff View — Week-over-Week',
      'diff.placeholderTitle': 'Diff View — Need at least 2 snapshots',
      'diff.placeholderText': 'This page compares two snapshots side-by-side, ideal for weekly review meetings.',
      'diff.takeFirst': '📸 Take first snapshot',
      'diff.takeAnother': '📸 Take another snapshot to compare',

      // KPI labels
      'kpi.total': 'Total',
      'kpi.renew': 'Renew',
      'kpi.new': 'New',
      'kpi.target': 'Target',
      'kpi.totalTarget': 'Total Target',
      'kpi.actualRevenue': 'Actual Revenue (YTD)',
      'kpi.forecastRevenue': 'Forecast Revenue (Year)',
      'kpi.yoy': 'YoY',
      'kpi.winRate': 'Win Rate',
      'kpi.renewCoverage': 'Renew Coverage',
      'kpi.openRenewPipeline': 'Open Renew Pipeline',
      'kpi.openNewPipeline': 'Open New Pipeline',
      'kpi.lostTotal': 'Lost Total',
      'kpi.achievement': 'Achievement (Won)',
      'kpi.wonTotal': 'Won Total',
      'kpi.commitTotal': 'Commit',
      'kpi.upsideTotal': 'Upside',
      'kpi.openRenew': 'Open Renew',
      'kpi.openNew': 'Open New',
      'kpi.dealCount': 'Deal Count',
      'kpi.wonRenew': 'Won Renew',
      'kpi.wonNew': 'Won New',
      'kpi.renewalEstimate': 'Renewal Est.',
      'kpi.salesForecast': 'Sales Forecast',
    },
    th: {
      // Nav tabs (Thai labels with emoji)
      'nav.overview': '📊 ภาพรวม',
      'nav.actions': '🎯 Action Center',
      'nav.renew': '🔄 Renew',
      'nav.newsell': '✨ New Sell',
      'nav.combined': '📈 Combined',
      'nav.forecast': '🎯 Forecast',
      'nav.pipeline': '📄 ดีลทั้งหมด',
      'nav.diff': '📊 เปรียบเทียบ',
      'nav.targets': '🎯 Targets',
      'nav.teams': '👥 Teams',
      'nav.statusmap': '🏷️ Status Mapping',
      'nav.settings': '⚙️ ตั้งค่า',

      // Topbar
      'top.upload': '📥 อัปโหลด',
      'top.theme.title': 'สลับ theme (Light / Dark / System)',
      'top.copyUrl.title': 'คัดลอก URL view ปัจจุบัน (รวม filter ที่ใช้)',
      'top.lang.title': 'สลับภาษา (ไทย / English)',

      // Common buttons
      'btn.save': 'บันทึก',
      'btn.cancel': 'ยกเลิก',
      'btn.confirm': 'ยืนยัน',
      'btn.apply': 'ใช้งาน',
      'btn.close': 'ปิด',
      'btn.reset': 'รีเซ็ต',
      'btn.copy': 'คัดลอก',
      'btn.delete': 'ลบ',
      'btn.add': 'เพิ่ม',
      'btn.edit': 'แก้ไข',
      'btn.export.excel': '⬇️ Export Excel',
      'btn.export.csv': '⬇️ CSV',
      'btn.print': '🖨️ Print',
      'btn.snapshot': '📸 Save snapshot',
      'btn.takeSnapshot': '📸 บันทึก snapshot ตอนนี้',
      'btn.import': '📥 Import Settings',
      'btn.export.settings': '⬇️ Export Settings',
      'btn.upload': '📥 Upload data',
      'btn.copyJson': '📋 Copy JSON to clipboard',
      'btn.columns': '⚙️ Columns',
      'btn.copyPrev': 'คัดลอกจากปีก่อน',
      'btn.bulkFill': 'Bulk fill...',
      'btn.distribute': 'Smart distribute...',
      'btn.openTeams': '👥 จัดการ Teams & Users →',
      'btn.openStatusMap': '🏷️ จัดการ Status Mapping →',
      'btn.clearAll': 'ล้างทั้งหมด',
      'btn.resetAll': 'Reset การตั้งค่าทั้งหมด',
      'btn.openAllDeals': '📄 ดู All Deals',

      // Section titles
      'sec.keyMetrics': 'KPI หลัก',
      'sec.trendByMonth': 'Trend รายเดือน — ทุกดีล (Won/Commit/Upside/Open/Lost)',
      'sec.perUserPipeline': 'Pipeline รายคน',
      'sec.performanceBreakdown': 'Performance Breakdown',
      'sec.topPerformers': 'Top Performers',
      'sec.stageFunnel': 'Stage Funnel',
      'sec.allDeals': 'ดีลทั้งหมด',
      'sec.newSellTargets': 'New Sell Targets',
      'sec.renewTargetAuto': 'Renew Target — อัตโนมัติจากข้อมูล (Subscription Renew + Auto Renew)',
      'sec.forecastDetail': 'Forecast Detail Table',
      'sec.snapshotHistory': 'ประวัติ Snapshot',
      'sec.uiPreferences': 'ตั้งค่า UI',
      'sec.accessControl': 'Access Control',
      'sec.dangerZone': 'Danger Zone',
      'sec.backupRestore': 'Backup & Restore',
      'sec.statusMapping': 'Status Mapping',
      'sec.usersTeams': 'Users & Teams',
      'sec.headlineKpis': 'Headline KPIs',
      'sec.statusBreakdown': 'Status Breakdown',
      'sec.weeklyComparison': 'Diff View — เปรียบเทียบรายสัปดาห์',
      'sec.diffTrend': 'Trend (12 snapshot ล่าสุด)',
      'sec.monthlyTrajectory': 'Monthly Trajectory — Won + Pipeline Forecast เทียบ Target',
      'sec.cumulativeTrajectory': 'Cumulative Trajectory — สะสมทั้งปี',
      'sec.renewalEstimate': 'Renewal Estimate Settings',
      'sec.salesForecast': 'Sales Forecast — กรอกรายคน × เดือน',
      'sec.whatIf': 'What-if Scenario Analysis',
      'sec.actionCenter': 'Action Center',
      'sec.renewSummary': 'Renew Summary',
      'sec.newSellSummary': 'New Sell Summary',
      'sec.combinedSummary': 'Combined Summary',

      // Card titles & subtitles
      'card.appearance': 'หน้าตา',
      'card.systemNote': 'สลับด่วนได้ที่ topbar (Light → Dark → System)',
      'card.exportImport': '💾 Export / Import การตั้งค่าทั้งหมด',
      'card.exportImportSub': 'บันทึกการตั้งค่าทุกอย่างเป็น JSON — แชร์ระหว่างคนในทีมได้',
      'card.stageStatus': 'Stage → Status mapping',
      'card.stageStatusSub': 'กำหนด stage แต่ละชนิดให้เข้ากลุ่ม Won / Commit / Upside / Open / Lost',
      'card.snapshotSub': 'Snapshot capture KPI ปัจจุบัน — ใช้ track trend สัปดาห์ต่อสัปดาห์',
      'card.resetTitle': '⚠️ Reset การตั้งค่าทั้งหมด',
      'card.resetSub': 'ลบ preference, target, mapping ทั้งหมด (ไม่ลบ data ที่อัปโหลด)',
      'card.allDealsTitle': 'All Deals',
      'card.targetsTitle': 'ปี {year} · New Sell เท่านั้น',
      'card.targetsSub': 'คลิก cell เพื่อแก้ไข · บันทึกอัตโนมัติ · Renew Target คำนวณอัตโนมัติด้านล่าง',
      'card.diffPicker': 'เลือก 2 snapshot เพื่อเปรียบเทียบ',
      'card.viewerNote': '👁️ Viewer mode · กำลังใช้ build แบบ read-only — Admin features (export, backup, status mapping, access token) ถูกซ่อน',

      // Filter labels
      'filter.period': 'Period',
      'filter.team': 'Team',
      'filter.user': 'User',
      'filter.pipeline': 'Pipeline',
      'filter.dealType': 'Deal Type',
      'filter.productType': 'Product Type',
      'filter.status': 'Status',
      'filter.all': 'ทั้งหมด',
      'filter.selectAll': 'เลือกทั้งหมด',
      'filter.clear': 'ล้าง',
      'filter.search': 'ค้นหา...',
      'filter.searchAllCols': '🔍 ค้นหาทุกคอลัมน์...',

      // Period
      'period.thisMonth': 'เดือนนี้',
      'period.lastMonth': 'เดือนก่อน',
      'period.nextMonth': 'เดือนหน้า',
      'period.mtd': 'Month to date',
      'period.thisQuarter': 'ไตรมาสนี้',
      'period.lastQuarter': 'ไตรมาสก่อน',
      'period.nextQuarter': 'ไตรมาสหน้า',
      'period.qtd': 'Quarter to date',
      'period.thisYear': 'ปีนี้',
      'period.lastYear': 'ปีก่อน',
      'period.nextYear': 'ปีหน้า',
      'period.ytd': 'Year to date',
      'period.all': 'ทั้งหมด',
      'period.custom': 'Custom range',
      'period.quickPreset': 'Quick preset',
      'period.byYear': 'By year',
      'period.selectPreset': '— เลือก preset —',
      'period.placeholder': 'เลือกช่วงเวลา',

      // Diff view
      'diff.from': 'จาก',
      'diff.to': 'ถึง',
      'diff.swap': '⇄ สลับ',
      'diff.delta': 'Δ การเปลี่ยนแปลง',
      'diff.title': 'Diff View — เปรียบเทียบรายสัปดาห์',
      'diff.placeholderTitle': 'Diff View — ต้องมี snapshot อย่างน้อย 2 ตัว',
      'diff.placeholderText': 'หน้านี้เปรียบเทียบ snapshot 2 ตัว เหมาะกับใช้ในประชุมสัปดาห์',
      'diff.takeFirst': '📸 ถ่าย snapshot แรก',
      'diff.takeAnother': '📸 ถ่าย snapshot อีกตัวเพื่อเปรียบเทียบ',

      // KPI labels — keep most English (technical terms)
      'kpi.total': 'Total',
      'kpi.renew': 'Renew',
      'kpi.new': 'New',
      'kpi.target': 'Target',
      'kpi.totalTarget': 'Total Target',
      'kpi.actualRevenue': 'Actual Revenue (YTD)',
      'kpi.forecastRevenue': 'Forecast Revenue (Year)',
      'kpi.yoy': 'YoY',
      'kpi.winRate': 'Win Rate',
      'kpi.renewCoverage': 'Renew Coverage',
      'kpi.openRenewPipeline': 'Open Renew Pipeline',
      'kpi.openNewPipeline': 'Open New Pipeline',
      'kpi.lostTotal': 'Lost Total',
      'kpi.achievement': 'Achievement (Won)',
      'kpi.wonTotal': 'Won Total',
      'kpi.commitTotal': 'Commit',
      'kpi.upsideTotal': 'Upside',
      'kpi.openRenew': 'Open Renew',
      'kpi.openNew': 'Open New',
      'kpi.dealCount': 'Deal Count',
      'kpi.wonRenew': 'Won Renew',
      'kpi.wonNew': 'Won New',
      'kpi.renewalEstimate': 'Renewal Est.',
      'kpi.salesForecast': 'Sales Forecast',
    },
  };

  let currentLang = (function () {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved && dict[saved]) ? saved : DEFAULT_LANG;
  })();

  function t(key, fallback) {
    if (dict[currentLang] && dict[currentLang][key] !== undefined) return dict[currentLang][key];
    if (dict.en && dict.en[key] !== undefined) return dict.en[key];
    return fallback !== undefined ? fallback : key;
  }

  function setLang(lang) {
    if (!dict[lang]) return false;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
    apply();
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
    return true;
  }

  function getLang() { return currentLang; }

  function apply(root) {
    const r = root || document;
    r.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    r.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    r.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    r.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    r.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
    });
  }

  document.documentElement.setAttribute('lang', currentLang);

  window.App = window.App || {};
  window.App.i18n = { t, setLang, getLang, apply, dict, STORAGE_KEY };
})();
