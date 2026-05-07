/* ========================================================================
   App — Main bootstrap, hash-based router, page registry, file upload
   ======================================================================== */
(function () {
  const VERSION = '1.2.3';
  const VERSION_DATE = '2026-05-07';

  const PAGES = [
    { id: 'overview',  label: '📊 Overview',        ready: true,  needsFilter: true },
    { id: 'renew',     label: '🔄 Renew',           ready: true,  needsFilter: true },
    { id: 'newsell',   label: '✨ New Sell',         ready: true,  needsFilter: true },
    { id: 'combined',  label: '📈 Combined',        ready: true,  needsFilter: true },
    { id: 'forecast',  label: '🎯 Forecast',         ready: true,  star: true, needsFilter: true },
    { id: 'pipeline',  label: '📄 All Deals',       ready: true,  needsFilter: true },
    { id: 'targets',   label: '🎯 Targets',         ready: true,  needsFilter: false },
    { id: 'teams',     label: '👥 Teams',           ready: true,  hideFromNav: true, needsFilter: false },
    { id: 'statusmap', label: '🏷️ Status Mapping',  ready: true,  hideFromNav: true, needsFilter: false },
    { id: 'settings',  label: '⚙️ Settings',        ready: true,  needsFilter: false },
  ];

  const APP_STATE = {
    currentPage: null,
    parsed: null,         // last parse result
  };

  /* ----- Render top tabs ----- */
  function renderTabs() {
    const nav = document.getElementById('tabnav');
    nav.innerHTML = PAGES.filter(p => !p.hideFromNav).map(p => `
      <button class="tab" data-page="${p.id}">
        ${p.label}
        ${p.star ? '<span class="tab-badge">★</span>' : ''}
        ${!p.ready ? `<span class="tab-badge coming">${p.phase}</span>` : ''}
      </button>
    `).join('');
    nav.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        location.hash = '#/' + tab.dataset.page;
      });
    });
  }

  /* ----- Render current page based on hash ----- */
  function renderRoute() {
    const hash = location.hash.replace(/^#\/?/, '') || 'overview';
    const pageId = hash.split('?')[0];
    const page = PAGES.find(p => p.id === pageId) || PAGES[0];
    APP_STATE.currentPage = page.id;

    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.page === page.id);
    });

    // Show/hide global filter bar based on page
    const filterBar = document.getElementById('filterBar');
    if (page.needsFilter && APP_STATE.parsed) {
      filterBar.classList.remove('hidden');
    } else {
      filterBar.classList.add('hidden');
    }

    const main = document.getElementById('main');
    if (!page.ready) {
      main.innerHTML = `
        <div class="placeholder-page">
          <div class="icon">🚧</div>
          <h2>${page.label}</h2>
          <p>Coming soon in <strong>${page.phase}</strong>.<br>
          Phase 1 ตอนนี้ scope = SPA scaffold + ตัวอ่านข้อมูล + 5-status mapping + Overview + Settings</p>
          <div class="phase-tag">${page.phase}</div>
        </div>`;
      return;
    }

    // Page module is at App.Pages[id] — call .render(main, parsed)
    if (App.Pages && App.Pages[page.id] && typeof App.Pages[page.id].render === 'function') {
      App.Pages[page.id].render(main, APP_STATE.parsed);
    } else {
      main.innerHTML = `<div class="placeholder-page"><div class="icon">⏳</div><h2>${page.label}</h2><p>Page module not loaded yet.</p></div>`;
    }

    // Persist last page
    App.Settings.set('uiPreferences.lastPage', page.id);
  }

  /* ----- File upload handler ----- */
  async function handleFile(file) {
    if (!file) return;
    App.UI.toast('Loading ' + file.name + '...');
    document.getElementById('fileInfo').textContent = 'Parsing ' + file.name + '...';
    try {
      const settings = App.Settings.load();
      const result = await App.DataParser.parseDealFile(
        file,
        settings.statusMapping,
        settings.teamMapping,
        settings.columnRemap
      );
      if (result.kind === 'settings') {
        App.Settings.importFromObject(result.settings);
        App.UI.toast('Settings imported successfully', 'success');
        renderRoute();
        return;
      }
      if (result.missingRequired && result.missingRequired.length > 0) {
        const missing = result.missingRequired.join(', ');
        App.UI.toast('Missing required fields: ' + missing, 'error');
        // Future: open column-mapping wizard here
      }
      APP_STATE.parsed = result;
      App.Filters.STATE.parsed = result;
      App.Filters.STATE.deals = result.deals;
      App.Settings.syncUsersFromDeals(result.deals);
      document.getElementById('fileInfo').textContent =
        result.fileName + ' · ' + result.deals.length.toLocaleString() + ' deals';
      document.getElementById('filterBar').classList.remove('hidden');
      App.Filters.refreshMultiSelects(result.deals, renderRoute);
      renderRoute();
      App.UI.toast('Loaded ' + result.deals.length.toLocaleString() + ' deals', 'success');
    } catch (err) {
      console.error(err);
      App.UI.toast('Failed to parse: ' + err.message, 'error');
      document.getElementById('fileInfo').textContent = '';
    }
  }

  /* ----- Drag and drop (body-level) ----- */
  function setupDropZone() {
    document.body.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dz = document.querySelector('.dropzone');
      if (dz) dz.classList.add('drag-over');
    });
    document.body.addEventListener('dragleave', () => {
      const dz = document.querySelector('.dropzone');
      if (dz) dz.classList.remove('drag-over');
    });
    document.body.addEventListener('drop', (e) => {
      e.preventDefault();
      const dz = document.querySelector('.dropzone');
      if (dz) dz.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  /* ----- Live clock ----- */
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function updateClock() {
    const el = document.getElementById('liveClock');
    if (!el) return;
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    el.textContent = `${now.getDate()} ${MONTH_ABBR[now.getMonth()]} ${now.getFullYear()} · ${time}`;
  }

  /* ----- Bootstrap ----- */
  function init() {
    App.Settings.load();   // load from localStorage
    const v = document.getElementById('brandVersion');
    if (v) v.textContent = 'v' + VERSION;
    updateClock();
    setInterval(updateClock, 30 * 1000);
    renderTabs();

    // Wire up file upload buttons
    document.getElementById('uploadBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', (e) => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });
    document.querySelectorAll('[data-action="upload"]').forEach(b => {
      b.addEventListener('click', () => document.getElementById('fileInput').click());
    });

    // Build filter bar
    App.Filters.build(document.getElementById('filterBar'), () => {
      // Re-render current page
      if (APP_STATE.parsed) renderRoute();
    });

    setupDropZone();

    // Restore last page
    const lastPage = App.Settings.get('uiPreferences.lastPage') || 'overview';
    if (!location.hash) location.hash = '#/' + lastPage;

    window.addEventListener('hashchange', renderRoute);
    renderRoute();
  }

  window.App = window.App || {};
  window.App.Pages = window.App.Pages || {};
  window.App.bootstrap = init;
  window.App.handleFile = handleFile;
  window.App.STATE = APP_STATE;
  window.App.VERSION = VERSION;
  window.App.VERSION_DATE = VERSION_DATE;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
