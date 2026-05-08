/* ========================================================================
   i18n — TH / EN translation module
   Default language: TH. Toggle via topbar button (🇹🇭/🇬🇧).

   Usage:
   - In HTML: <span data-i18n="key.path">Default text</span>
              <input data-i18n-placeholder="search.deals">
              <button data-i18n-title="action.export">⬇️</button>
   - In JS:   App.i18n.t('btn.save')
   - Apply:   App.i18n.apply()  — translates all [data-i18n*] under root

   Coverage strategy:
   - Nav tabs (always visible)
   - Topbar (Upload, theme, copy)
   - Common buttons (Save, Cancel, Export, Print)
   - Section titles in main pages
   - Period preset labels
   - Status names stay in English (technical terms)
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
      'top.upload': '📥 Upload data',
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
      'btn.export.excel': '⬇️ Export Excel',
      'btn.export.csv': '⬇️ CSV',
      'btn.print': '🖨️ Print',
      'btn.snapshot': '📸 Save snapshot',
      'btn.delete': 'Delete',
      'btn.add': 'Add',
      'btn.import': '📥 Import Settings',
      'btn.export.settings': '⬇️ Export Settings',

      // Section titles
      'sec.keyMetrics': 'Key Metrics',
      'sec.trendByMonth': 'Trend by Month',
      'sec.perUserPipeline': 'Per-User Pipeline Snapshot',
      'sec.performanceBreakdown': 'Performance Breakdown',
      'sec.topPerformers': 'Top Performers',
      'sec.stageFunnel': 'Stage Funnel',
      'sec.allDeals': 'All Deals',
      'sec.newSellTargets': 'New Sell Targets',
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

      // Period
      'period.thisMonth': 'This Month',
      'period.lastMonth': 'Last Month',
      'period.nextMonth': 'Next Month',
      'period.mtd': 'MTD',
      'period.thisQuarter': 'This Quarter',
      'period.lastQuarter': 'Last Quarter',
      'period.nextQuarter': 'Next Quarter',
      'period.qtd': 'QTD',
      'period.thisYear': 'This Year',
      'period.lastYear': 'Last Year',
      'period.nextYear': 'Next Year',
      'period.ytd': 'YTD',
      'period.all': 'All',
      'period.custom': 'Custom range',
      'period.quickPresets': 'Quick presets',

      // Filter labels
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

      // Diff view
      'diff.from': 'From',
      'diff.to': 'To',
      'diff.swap': '⇄ Swap',
      'diff.delta': 'Δ Change',
      'diff.trend': 'Trend',
    },
    th: {
      // Nav tabs
      'nav.overview': '📊 ภาพรวม',
      'nav.actions': '🎯 Action Center',
      'nav.renew': '🔄 ต่ออายุ',
      'nav.newsell': '✨ ขายใหม่',
      'nav.combined': '📈 รวม',
      'nav.forecast': '🎯 พยากรณ์',
      'nav.pipeline': '📄 ดีลทั้งหมด',
      'nav.diff': '📊 เปรียบเทียบ',
      'nav.targets': '🎯 เป้าหมาย',
      'nav.teams': '👥 ทีม',
      'nav.statusmap': '🏷️ Status Mapping',
      'nav.settings': '⚙️ ตั้งค่า',

      // Topbar
      'top.upload': '📥 อัปโหลดข้อมูล',
      'top.theme.title': 'สลับ theme (สว่าง / มืด / ระบบ)',
      'top.copyUrl.title': 'คัดลอก URL view ปัจจุบัน (รวม filter ที่ใช้)',
      'top.lang.title': 'สลับภาษา (ไทย / อังกฤษ)',

      // Common buttons
      'btn.save': 'บันทึก',
      'btn.cancel': 'ยกเลิก',
      'btn.confirm': 'ยืนยัน',
      'btn.apply': 'ใช้งาน',
      'btn.close': 'ปิด',
      'btn.reset': 'รีเซ็ต',
      'btn.copy': 'คัดลอก',
      'btn.export.excel': '⬇️ Export Excel',
      'btn.export.csv': '⬇️ CSV',
      'btn.print': '🖨️ พิมพ์',
      'btn.snapshot': '📸 บันทึก snapshot',
      'btn.delete': 'ลบ',
      'btn.add': 'เพิ่ม',
      'btn.import': '📥 นำเข้าการตั้งค่า',
      'btn.export.settings': '⬇️ Export การตั้งค่า',

      // Section titles
      'sec.keyMetrics': 'ตัวเลขสำคัญ',
      'sec.trendByMonth': 'แนวโน้มรายเดือน',
      'sec.perUserPipeline': 'Pipeline รายคน',
      'sec.performanceBreakdown': 'แยกตามผลงาน',
      'sec.topPerformers': 'ผู้ทำผลงานสูงสุด',
      'sec.stageFunnel': 'Stage Funnel',
      'sec.allDeals': 'ดีลทั้งหมด',
      'sec.newSellTargets': 'เป้า New Sell',
      'sec.forecastDetail': 'ตาราง Forecast',
      'sec.snapshotHistory': 'ประวัติ Snapshot',
      'sec.uiPreferences': 'ตั้งค่า UI',
      'sec.accessControl': 'การเข้าถึง',
      'sec.dangerZone': 'พื้นที่อันตราย',
      'sec.backupRestore': 'สำรอง / กู้คืน',
      'sec.statusMapping': 'Status Mapping',
      'sec.usersTeams': 'ผู้ใช้และทีม',
      'sec.headlineKpis': 'KPI หลัก',
      'sec.statusBreakdown': 'แยกตามสถานะ',
      'sec.weeklyComparison': 'เปรียบเทียบ — สัปดาห์ต่อสัปดาห์',

      // Period
      'period.thisMonth': 'เดือนนี้',
      'period.lastMonth': 'เดือนที่แล้ว',
      'period.nextMonth': 'เดือนหน้า',
      'period.mtd': 'MTD (ตั้งแต่ต้นเดือน)',
      'period.thisQuarter': 'ไตรมาสนี้',
      'period.lastQuarter': 'ไตรมาสที่แล้ว',
      'period.nextQuarter': 'ไตรมาสหน้า',
      'period.qtd': 'QTD',
      'period.thisYear': 'ปีนี้',
      'period.lastYear': 'ปีที่แล้ว',
      'period.nextYear': 'ปีหน้า',
      'period.ytd': 'YTD',
      'period.all': 'ทั้งหมด',
      'period.custom': 'ช่วงเวลาเอง',
      'period.quickPresets': 'เลือกด่วน',

      // Filter labels
      'filter.team': 'ทีม',
      'filter.user': 'ผู้ใช้',
      'filter.pipeline': 'Pipeline',
      'filter.dealType': 'ประเภทดีล',
      'filter.productType': 'ประเภทสินค้า',
      'filter.status': 'สถานะ',
      'filter.all': 'ทั้งหมด',
      'filter.selectAll': 'เลือกทั้งหมด',
      'filter.clear': 'ล้าง',
      'filter.search': 'ค้นหา...',

      // Diff view
      'diff.from': 'จาก',
      'diff.to': 'ถึง',
      'diff.swap': '⇄ สลับ',
      'diff.delta': 'Δ เปลี่ยนแปลง',
      'diff.trend': 'แนวโน้ม',
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
    // Trigger full re-render so dynamically-built content (page contents, charts)
    // can re-emit translated strings.
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
    return true;
  }

  function getLang() { return currentLang; }

  function apply(root) {
    const r = root || document;
    r.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
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

  // Set initial document lang
  document.documentElement.setAttribute('lang', currentLang);

  window.App = window.App || {};
  window.App.i18n = { t, setLang, getLang, apply, dict, STORAGE_KEY };
})();
