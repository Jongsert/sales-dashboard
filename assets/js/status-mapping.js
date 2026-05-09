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
    Won:    { fill: '#259b24', light: '#c5e1a5' },   // dark green — final positive
    Commit: { fill: '#9ccc65', light: '#dcedc8' },   // light green — near-win
    Upside: { fill: '#f97316', light: '#ffedd5' },   // orange — potential
    Open:   { fill: '#3b82f6', light: '#dbeafe' },   // blue — neutral / in pipeline
    Lost:   { fill: '#ef4444', light: '#fee2e2' },   // red — final negative
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

  // Return the stages found in `deals` that have no entry in DEFAULT_STATUS_MAP
  // and no override in `customMap`. Used to alert the user there are new
  // stages from a fresh data upload that need to be classified.
  function findUnmapped(deals, customMap) {
    if (!deals || !deals.length) return [];
    const stages = new Set();
    deals.forEach(d => { if (d.stage) stages.add(d.stage); });
    const out = [];
    stages.forEach(stage => {
      if (stage in DEFAULT_STATUS_MAP) return;
      if (customMap && stage in customMap) return;
      out.push(stage);
    });
    return out.sort((a, b) => String(a).localeCompare(String(b)));
  }

  window.App = window.App || {};
  window.App.StatusMapping = {
    DEFAULT: DEFAULT_STATUS_MAP,
    LIST: STATUS_LIST,
    COLORS: STATUS_COLORS,
    resolve,
    findUnmapped,
  };
})();
