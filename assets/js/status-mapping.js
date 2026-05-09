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

  // 6th status 'Unmapped' covers stages that aren't in the default map AND
  // aren't covered by the user's custom override. Surfacing this as its own
  // bucket (instead of silently lumping into 'Open') makes it obvious that
  // some deals haven't been classified yet — both in charts and in the
  // Status filter dropdown.
  const STATUS_LIST = ['Won', 'Commit', 'Upside', 'Open', 'Lost', 'Unmapped'];

  const STATUS_COLORS = {
    Won:      { fill: '#259b24', light: '#c5e1a5' },   // dark green — final positive
    Commit:   { fill: '#9ccc65', light: '#dcedc8' },   // light green — near-win
    Upside:   { fill: '#f97316', light: '#ffedd5' },   // orange — potential
    Open:     { fill: '#3b82f6', light: '#dbeafe' },   // blue — neutral / in pipeline
    Lost:     { fill: '#ef4444', light: '#fee2e2' },   // red — final negative
    Unmapped: { fill: '#94a3b8', light: '#e2e8f0' },   // slate gray — needs classification
  };

  // Resolve a stage to status. Stages without an explicit mapping (in the
  // default map OR the user's custom override) become 'Unmapped' rather than
  // silently defaulting to 'Open' — so the user notices and classifies them.
  // Substring-guess heuristic removed for the same reason: every status
  // assignment must come from an explicit entry.
  function resolve(stage, customMap) {
    if (!stage) return 'Unmapped';
    if (customMap && customMap[stage]) return customMap[stage];
    if (DEFAULT_STATUS_MAP[stage]) return DEFAULT_STATUS_MAP[stage];
    return 'Unmapped';
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
