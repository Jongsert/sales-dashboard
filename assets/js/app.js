/* ========================================================================
   App — Main bootstrap, hash-based router, page registry, file upload
   ======================================================================== */
(function () {
  const VERSION = '1.9.0';
  const VERSION_DATE = '2026-05-08';

  // Build mode: 'admin' = full features (export, edit settings)
  //             'viewer' = read-only (no export buttons, no admin settings)
  //
  // Detected from window.APP_MODE if set by the loading page (viewer/index.html
  // sets it to 'viewer' before this script loads). Defaults to 'admin'.
  const MODE = (typeof window.APP_MODE === 'string' && window.APP_MODE === 'viewer')
    ? 'viewer' : 'admin';

  const PAGES = [
    { id: 'overview',  label: '📊 Overview',        ready: true,  needsFilter: true },
    { id: 'actions',   label: '🎯 Action Center',   ready: true,  needsFilter: true },
    { id: 'renew',     label: '🔄 Renew',           ready: true,  needsFilter: true },
    { id: 'newsell',   label: '✨ New Sell',         ready: true,  needsFilter: true },
    { id: 'combined',  label: '📈 Combined',        ready: true,  needsFilter: true },
    { id: 'forecast',  label: '🎯 Forecast',         ready: true,  star: true, needsFilter: true },
    { id: 'pipeline',  label: '📄 All Deals',       ready: true,  needsFilter: true },
    { id: 'diff',      label: '📊 Diff',            ready: true,  needsFilter: false },
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
    const t = (window.App && App.i18n) ? App.i18n.t : null;
    nav.innerHTML = PAGES.filter(p => !p.hideFromNav).map(p => {
      const label = t ? t('nav.' + p.id, p.label) : p.label;
      return `
      <button class="tab" data-page="${p.id}">
        ${label}
        ${p.star ? '<span class="tab-badge">★</span>' : ''}
        ${!p.ready ? `<span class="tab-badge coming">${p.phase}</span>` : ''}
      </button>`;
    }).join('');
    nav.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        location.hash = '#/' + tab.dataset.page;
      });
    });
  }

  /* ----- Render current page based on hash ----- */
  function renderRoute() {
    const hash = location.hash.replace(/^#\/?/, '') || 'overview';
    const [pageId, queryString] = hash.split('?');
    const page = PAGES.find(p => p.id === pageId) || PAGES[0];
    APP_STATE.currentPage = page.id;

    // Decode filter state from URL query string (only if data is loaded)
    if (queryString && App.Filters && APP_STATE.parsed) {
      try { App.Filters.decodeFilterState(queryString); } catch (e) { console.warn('Filter URL decode failed', e); }
    }

    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.page === page.id);
    });

    // Show/hide global filter bar based on page
    const filterBar = document.getElementById('filterBar');
    if (page.needsFilter && APP_STATE.parsed) {
      filterBar.classList.remove('hidden');
      document.body.classList.add('has-filter');
    } else {
      filterBar.classList.add('hidden');
      document.body.classList.remove('has-filter');
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

    // Translate any [data-i18n] in the just-rendered content
    if (App.i18n) App.i18n.apply();

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

      // Offer to import settings after a successful deal upload (admin only)
      if (App.MODE === 'admin') {
        showPostUploadPrompt(result);
      }
    } catch (err) {
      console.error(err);
      App.UI.toast('Failed to parse: ' + err.message, 'error');
      document.getElementById('fileInfo').textContent = '';
    }
  }

  /* ----- Post-upload prompt: offer to import settings JSON ----- */
  function showPostUploadPrompt(result) {
    const settings = App.Settings.load();
    const year = new Date().getFullYear();
    const hasTargets = !!(settings.newSellTargets[year]
      && Object.values(settings.newSellTargets[year]).some(arr => arr && arr.some(v => v > 0)));
    const teamCount = (settings.teams || []).length;
    const userCount = (settings.users || []).length;
    const dealsCount = result.deals.length.toLocaleString();
    const fileName = result.fileName || 'data file';

    const body = document.createElement('div');
    body.innerHTML = `
      <div style="text-align:center; padding: 6px 4px 4px;">
        <div style="font-size:36px; margin-bottom:8px;">✅</div>
        <div style="font-size:15px; font-weight:700; color: var(--text); margin-bottom:4px;">
          Loaded ${dealsCount} deals
        </div>
        <div style="font-size:12px; color: var(--text-muted); margin-bottom:18px;">
          ${escapeHtml(fileName)}
        </div>

        <div style="text-align:left; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom:6px; font-size: 12px;">
          <div style="font-weight:700; margin-bottom:8px; color: var(--text);">
            📋 Want to import settings too?
          </div>
          <div style="color: var(--text-muted); line-height:1.55; margin-bottom:8px;">
            Settings file (JSON) contains your <strong style="color: var(--text);">targets, team mappings, status mapping, and snapshot history</strong>. Useful when sharing the dashboard with teammates so everyone sees the same numbers.
          </div>
          <div style="color: var(--text-faint); font-size: 11px;">
            Current state: ${userCount} users · ${teamCount} teams ·
            ${hasTargets
              ? `<span style="color: var(--won);">targets set for ${year}</span>`
              : `<span style="color: var(--upside);">no targets for ${year} yet</span>`}
          </div>
        </div>
      </div>
    `;

    const m = App.UI.modal({
      title: 'Data uploaded',
      body,
      footer: ' ',
      width: '480px',
    });

    const f = m.el.querySelector('.modal-footer');
    f.innerHTML = '';
    f.style.justifyContent = 'flex-end';

    const skip = document.createElement('button');
    skip.className = 'btn';
    skip.textContent = 'Skip — go to dashboard';
    skip.addEventListener('click', () => m.close());

    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-primary';
    importBtn.textContent = '📥 Import settings file';
    // Modal stays open until either: file is successfully imported (auto-close)
    // or user clicks Skip / backdrop. Cancelling the OS file picker just leaves
    // the modal open — no surprise navigation away.
    importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      input.addEventListener('change', async (e) => {
        const f2 = e.target.files && e.target.files[0];
        if (!f2) return;   // user canceled — keep modal open
        try {
          const text = await f2.text();
          const obj = JSON.parse(text);
          App.Settings.importFromObject(obj);
          App.UI.toast('Settings imported successfully', 'success');
          m.close();
          renderRoute();
        } catch (err) {
          App.UI.toast('Import failed: ' + err.message, 'error');
          // Modal stays open so user can retry
        } finally {
          input.remove();
        }
      });
      document.body.appendChild(input);
      input.click();
    });

    f.appendChild(skip);
    f.appendChild(importBtn);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  /* ----- Theme system (Light / Dark / System) ----- */
  const THEME_KEY = 'salesDashboard.theme';
  const THEME_ORDER = ['light', 'dark', 'system'];
  const THEME_ICON = { light: '☀️', dark: '🌙', system: '🖥️' };

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'system';
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = THEME_ICON[theme] || '☀️';
    // Update Chart.js global text color
    if (typeof Chart !== 'undefined') {
      const muted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#64748b';
      Chart.defaults.color = muted;
    }
    // Re-render route so charts redraw with the new CSS-variable values they
    // read at creation time (Chart.js bakes colors at chart() construction).
    if (App && App.STATE && App.STATE.parsed && typeof renderRoute === 'function') {
      // Defer a frame so CSS var changes propagate before getComputedStyle reads
      requestAnimationFrame(() => renderRoute());
    }
  }
  function cycleTheme() {
    const cur = getTheme();
    const next = THEME_ORDER[(THEME_ORDER.indexOf(cur) + 1) % THEME_ORDER.length];
    applyTheme(next);
    if (App.UI && App.UI.toast) {
      App.UI.toast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`, 'success');
    }
  }
  // Listen for OS dark/light changes when theme=system
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getTheme() === 'system') applyTheme('system');
    });
  }

  /* ----- Access token gate ----- */
  const ACCESS_KEY = 'salesDashboard.access';
  function checkAccess() {
    const settings = App.Settings.load();
    const required = (settings && settings.accessToken || '').trim();
    if (!required) return true;   // no token configured = open access

    // Check URL ?token= first (one-time grant; saves to localStorage on success)
    const hashStr = location.hash.replace(/^#\/?/, '');
    const queryStr = hashStr.split('?')[1] || '';
    const urlToken = new URLSearchParams(queryStr).get('token');
    if (urlToken && urlToken === required) {
      localStorage.setItem(ACCESS_KEY, required);
      // Strip ?token= from URL for safety (don't leave it visible)
      const cleanQ = new URLSearchParams(queryStr); cleanQ.delete('token');
      const cleanQS = cleanQ.toString();
      const pageId = hashStr.split('?')[0] || 'overview';
      history.replaceState(null, '', '#/' + pageId + (cleanQS ? '?' + cleanQS : ''));
      return true;
    }

    // Check cached
    if (localStorage.getItem(ACCESS_KEY) === required) return true;

    return false;
  }
  function showAccessGate() {
    document.body.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg);">
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 40px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
          <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
          <h2 style="margin-bottom: 8px; font-size: 20px; color: var(--text);">Access required</h2>
          <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 24px;">This dashboard requires an access token. Enter it below to continue.</p>
          <input type="password" id="accessInput" placeholder="Enter access token" autofocus
                 style="width: 100%; padding: 12px 14px; border: 1px solid var(--border-strong); border-radius: 8px; font-family: inherit; font-size: 14px; margin-bottom: 12px; box-sizing: border-box;">
          <button id="accessSubmit" style="width: 100%; padding: 11px; background: var(--primary); color: white; border: none; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;">Continue</button>
          <div id="accessError" style="color: var(--lost); font-size: 12px; margin-top: 12px; min-height: 16px;"></div>
          <div style="font-size: 11px; color: var(--text-faint); margin-top: 24px; line-height: 1.5;">
            ⚠️ This is a casual access barrier, not real authentication.<br>
            Anyone with the token can view all data.
          </div>
        </div>
      </div>
    `;
    const settings = App.Settings.load();
    const required = (settings.accessToken || '').trim();
    const input = document.getElementById('accessInput');
    const error = document.getElementById('accessError');
    function tryLogin() {
      const v = input.value.trim();
      if (v === required) {
        localStorage.setItem(ACCESS_KEY, required);
        location.reload();
      } else {
        error.textContent = 'Incorrect token';
        input.select();
      }
    }
    document.getElementById('accessSubmit').addEventListener('click', tryLogin);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
  }

  /* ----- Bootstrap ----- */
  function init() {
    App.Settings.load();   // load from localStorage

    // Access token gate — block if required token is set + not authenticated
    if (!checkAccess()) {
      applyTheme(getTheme());
      showAccessGate();
      return;
    }

    applyTheme(getTheme());
    const v = document.getElementById('brandVersion');
    if (v) v.textContent = 'v' + VERSION;
    updateClock();
    setInterval(updateClock, 30 * 1000);

    const tBtn = document.getElementById('themeBtn');
    if (tBtn) tBtn.addEventListener('click', cycleTheme);

    // Language toggle (TH ↔ EN)
    const langBtn = document.getElementById('langBtn');
    const langIcon = document.getElementById('langIcon');
    function applyLangIcon(lang) {
      if (langIcon) langIcon.textContent = lang === 'th' ? '🇹🇭' : '🇬🇧';
    }
    if (App.i18n) {
      applyLangIcon(App.i18n.getLang());
      if (langBtn) {
        langBtn.addEventListener('click', () => {
          const next = App.i18n.getLang() === 'th' ? 'en' : 'th';
          App.i18n.setLang(next);
          applyLangIcon(next);
          App.UI && App.UI.toast(next === 'th' ? 'ภาษาไทย' : 'English', 'success');
        });
      }
      // On lang change, re-render nav + current route so all dynamic text refreshes
      window.addEventListener('langchange', () => {
        renderTabs();
        renderRoute();
      });
    }

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
      // Sync filter state to URL (replace, no history clutter)
      if (APP_STATE.parsed) {
        const q = App.Filters.encodeFilterState();
        const hash = location.hash.replace(/^#\/?/, '').split('?')[0] || 'overview';
        const newHash = '#/' + hash + (q ? '?' + q : '');
        if (location.hash !== newHash) {
          history.replaceState(null, '', newHash);
        }
        renderRoute();
      }
    });

    // Copy current URL to clipboard — with both toast + inline button feedback
    const copyBtn = document.getElementById('copyUrlBtn');
    if (copyBtn) {
      const originalHTML = copyBtn.innerHTML;
      let feedbackTimer = null;
      copyBtn.addEventListener('click', async () => {
        try {
          const q = App.Filters.encodeFilterState();
          const hash = location.hash.replace(/^#\/?/, '').split('?')[0] || 'overview';
          const fullUrl = location.origin + location.pathname + '#/' + hash + (q ? '?' + q : '');
          await navigator.clipboard.writeText(fullUrl);

          // Inline button flash: ✓ Copied!
          copyBtn.innerHTML = '<span style="color: var(--won); font-weight: 700;">✓ Copied!</span>';
          copyBtn.style.background = 'var(--won-light)';
          App.UI.toast('🔗 View URL copied — share with filters applied', 'success');
          clearTimeout(feedbackTimer);
          feedbackTimer = setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.style.background = '';
          }, 1800);
        } catch (err) {
          App.UI.toast('Copy failed: ' + err.message, 'error');
        }
      });
    }

    setupDropZone();

    // Print preparation — runs BEFORE the print dialog opens
    window.addEventListener('beforeprint', () => {
      const now = new Date();
      const d = now.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' });
      document.body.dataset.printDate = d + ' (Asia/Bangkok)';

      // Wide-table routes need landscape A4. Inject an @page rule at runtime
      // because named @page rules (e.g. body{page:landscape-page}) are NOT
      // reliable across browsers — Safari ignores them entirely.
      const wideRoutes = ['/pipeline', '/targets', '/forecast'];
      const cur = location.hash.replace(/^#/, '').split('?')[0];
      const useLandscape = wideRoutes.some(r => cur.startsWith(r));
      document.body.dataset.printOrient = useLandscape ? 'landscape' : 'portrait';

      let s = document.getElementById('print-orient-style');
      if (!s) {
        s = document.createElement('style');
        s.id = 'print-orient-style';
        document.head.appendChild(s);
      }
      s.textContent = useLandscape
        ? '@page { size: A4 landscape; margin: 7mm 5mm 8mm 5mm; }'
        : '@page { size: A4 portrait; margin: 14mm 12mm 16mm 12mm; }';

      // Print mode flag — read by DonutCenterPlugin to force readable colors.
      // Safari and some Chrome variants don't fire 'afterprint' if the user
      // closes the print dialog without printing — without this safety
      // timeout, the flag would stay true forever and donut centers would
      // render in print colors on-screen.
      window._isPrinting = true;
      if (window._isPrintingTimer) clearTimeout(window._isPrintingTimer);
      window._isPrintingTimer = setTimeout(() => {
        if (window._isPrinting) {
          window._isPrinting = false;
          if (typeof Chart !== 'undefined' && Chart.getChart) {
            const muted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#64748b';
            Chart.defaults.color = muted;
            document.querySelectorAll('canvas').forEach(canvas => {
              const c = Chart.getChart(canvas);
              if (c) c.update('none');
            });
          }
        }
      }, 30000);   // 30 seconds is comfortably longer than any real print job

      // Force every Chart.js instance to redraw so canvases pick up the
      // print-overridden CSS variables (light theme regardless of on-screen).
      if (typeof Chart !== 'undefined' && Chart.getChart) {
        Chart.defaults.color = '#475569';
        document.querySelectorAll('canvas').forEach(canvas => {
          const c = Chart.getChart(canvas);
          if (c) c.update('none');
        });
      }

      // Reflow charts to print viewport size
      window.dispatchEvent(new Event('resize'));
    });
    window.addEventListener('afterprint', () => {
      delete document.body.dataset.printOrient;
      window._isPrinting = false;
      if (window._isPrintingTimer) {
        clearTimeout(window._isPrintingTimer);
        window._isPrintingTimer = null;
      }

      // Remove the dynamically-injected @page rule so on-screen state stays clean
      const s = document.getElementById('print-orient-style');
      if (s) s.remove();

      // Restore Chart.js color from current theme + redraw
      if (typeof Chart !== 'undefined' && Chart.getChart) {
        const muted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#64748b';
        Chart.defaults.color = muted;
        document.querySelectorAll('canvas').forEach(canvas => {
          const c = Chart.getChart(canvas);
          if (c) c.update('none');
        });
      }
      window.dispatchEvent(new Event('resize'));
    });

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

  // Re-apply user→team mapping from current settings to in-memory deals,
  // then refresh global filter multi-selects + re-render. Called by Teams
  // page after every team add/rename/delete or user move so the Global
  // filter Team dropdown updates without reloading the file.
  window.App.applyTeamConfigChange = function () {
    if (!APP_STATE.parsed || !APP_STATE.parsed.deals) {
      // No data loaded — nothing to re-apply, just re-render the current page
      if (App.Filters && App.Filters.STATE) App.Filters.STATE.deals = [];
      return;
    }
    const settings = App.Settings.load();
    const userTeam = {};
    (settings.users || []).forEach(u => { userTeam[u.name] = u.team || 'Unassigned'; });
    APP_STATE.parsed.deals.forEach(d => {
      if (d.responsible && userTeam[d.responsible]) {
        d.team = userTeam[d.responsible];
      }
    });
    App.Filters.STATE.deals = APP_STATE.parsed.deals;
    App.Filters.refreshMultiSelects(APP_STATE.parsed.deals, renderRoute);
    renderRoute();
  };
  window.App.VERSION = VERSION;
  window.App.VERSION_DATE = VERSION_DATE;
  window.App.MODE = MODE;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
