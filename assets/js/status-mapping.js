/* ========================================================================
   Status Mapping (5-status)
   Maps Bitrix Stage → one of: Won / Commit / Upside / Open / Lost
   Default mapping; user can override via Settings page (saved to localStorage)
   ======================================================================== */
(function () {
  const DEFAULT_STATUS_MAP = {
    // Won
    'Deal won': 'Won',
    'Pre-WON': 'Won',

    // Lost
    'Deal lost': 'Lost',
    'Pre-LOST': 'Lost',

    // Commit (high confidence, almost-closed)
    'Commit': 'Commit',

    // Upside (medium confidence)
    'Upside': 'Upside',

    // Open (everything else — explicit list for known stages)
    'Backlog': 'Open',
    'Completed': 'Open',
    'Contacted': 'Open',
    'Contacted-Not OK': 'Open',
    'Contacted-OK': 'Open',
    'Cost Estimated': 'Open',
    'Deal': 'Open',
    'Deal (By Chance Project)': 'Open',
    'Deal Proposed': 'Open',
    'Delivered': 'Open',
    'Inprogress': 'Open',
    'Negotiations Started': 'Open',
    'New Request': 'Open',
    'Not Contacted': 'Open',
    'Pre-Qualified Pipeline': 'Open',
    'Qualified Pipeline': 'Open',
    'Quotation Sent': 'Open',
    'Site Survey & Solution Design': 'Open',
  };

  const STATUS_LIST = ['Won', 'Commit', 'Upside', 'Open', 'Lost'];

  const STATUS_COLORS = {
    Won:    { fill: '#10b981', light: '#d1fae5' },
    Commit: { fill: '#4f46e5', light: '#e0e7ff' },
    Upside: { fill: '#06b6d4', light: '#cffafe' },
    Open:   { fill: '#94a3b8', light: '#f1f5f9' },
    Lost:   { fill: '#ef4444', light: '#fee2e2' },
  };

  // Resolve a stage to status, with substring fallback for unknown stages
  function resolve(stage, customMap) {
    if (!stage) return 'Open';
    const map = customMap || DEFAULT_STATUS_MAP;
    if (map[stage]) return map[stage];

    // Fallback: substring match (similar to index.html team's heuristic)
    const s = String(stage).toLowerCase();
    if (s.includes('lost') || s.includes('lose') || s.includes('cancel')) return 'Lost';
    if (s.includes('won')) return 'Won';
    if (s.includes('commit')) return 'Commit';
    if (s.includes('upside')) return 'Upside';
    return 'Open';
  }

  window.App = window.App || {};
  window.App.StatusMapping = {
    DEFAULT: DEFAULT_STATUS_MAP,
    LIST: STATUS_LIST,
    COLORS: STATUS_COLORS,
    resolve,
  };
})();
