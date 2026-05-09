# Status Model — Stages → 6 Statuses

The dashboard reduces Bitrix's many `STAGE_ID` values into a fixed 6-status taxonomy. **All status logic everywhere in the codebase keys off these 6.** Don't introduce a 7th without updating every page that lists statuses.

---

## The 6 statuses

```js
const STATUS_LIST = ['Won', 'Commit', 'Upside', 'Open', 'Lost', 'Unmapped'];
```

| Status | Meaning | Color | Lifecycle |
| --- | --- | --- | --- |
| **Won** | Final positive — money is booked | `#259b24` dark green | terminal |
| **Commit** | High confidence, almost-closed (e.g. PO received, contract pending) | `#9ccc65` light green | active pipeline |
| **Upside** | Medium confidence — could close, could slip | `#f97316` orange | active pipeline |
| **Open** | Anything else still in the funnel | `#3b82f6` blue | active pipeline |
| **Lost** | Final negative — deal is dead | `#ef4444` red | terminal |
| **Unmapped** | Stage with no explicit mapping (yet) | `#94a3b8` slate gray | needs classification |

---

## Default mapping (status-mapping.js)

```js
const DEFAULT_STATUS_MAP = {
  'Deal won': 'Won',          'Pre-WON': 'Won',
  'Deal lost': 'Lost',        'Pre-LOST': 'Lost',
  'Commit': 'Commit',
  'Upside': 'Upside',
  // 'Open' stages — explicit list:
  'Backlog', 'Completed', 'Contacted', 'Contacted-Not OK', 'Contacted-OK',
  'Cost Estimated', 'Deal', 'Deal (By Chance Project)', 'Deal Proposed',
  'Delivered', 'Inprogress', 'Negotiations Started', 'New Request',
  'Not Contacted', 'Pre-Qualified Pipeline', 'Qualified Pipeline',
  'Quotation Sent', 'Site Survey & Solution Design'
};
```

User can override per-stage via Settings → Status Mapping. Override saved in `settings.statusMapping`.

---

## Resolution rules (v1.9.9)

```js
function resolve(stage, customMap) {
  if (!stage)                     return 'Unmapped';
  if (customMap && customMap[stage]) return customMap[stage];
  if (DEFAULT_STATUS_MAP[stage])     return DEFAULT_STATUS_MAP[stage];
  return 'Unmapped';
}
```

**Three-level lookup**: empty/missing → Unmapped → custom override → default → fallback Unmapped.

**No substring guessing** — was removed in v1.9.9. Previously `stage.includes('won')` would auto-classify; now every assignment must come from an explicit dictionary entry. Reason: silent miscategorization was eroding trust in the numbers. Better to surface "this stage is unclassified" than to guess.

---

## Detecting new stages

```js
const unmapped = App.StatusMapping.findUnmapped(deals, settings.statusMapping || {});
// → ['Some New Stage', 'Another'] sorted alphabetically
```

After every upload, `app.js` calls this. If non-empty:
1. Toast appears bottom-right with action button "Map now →" (8s duration).
2. Settings page → Status Mapping card morphs (red border + count + "Classify now" button).

User can either map them in Settings, or proceed with deals showing as `Unmapped` status (still counted, just in their own bucket).

---

## Why a 6th status (vs. silent fallback to Open)

Old behavior: stages with no explicit mapping silently became `Open`.

Problems:
- New stages introduced upstream in Bitrix would silently inflate the Open bucket.
- User couldn't tell "Open = 47 deals" included misclassified items.
- Substring heuristics (`includes('lost')`) gave false matches on names like "Lost contact made".

New behavior (v1.9.9):
- `Unmapped` is its own bucket in charts, filters, and KPIs.
- Visible separately in donuts and Status filter dropdown.
- Settings card and toast both nag the user until they classify.

User explicitly endorsed this approach: *"ถ้ายังไม่ mapping ให้ขึ้น Status อื่น ไม่ใช่ default แบบนี้"*.

---

## Matchers (filters.js)

Use these instead of inline `d.status === '...'` checks.

```js
const Matchers = {
  isRenew, isNew,                   // by deal type, not status
  won, commit, upside,              // single-bucket
  open: d => d.status === 'Open',   // ← narrow: literal Open only
  lost,
  closed:   d => d.status === 'Won' || d.status === 'Lost',
  inFlight: d => d.status === 'Open' || d.status === 'Commit' || d.status === 'Upside',
};
```

### Narrow (`open`) vs broad (`inFlight`)

This is a **load-bearing distinction**. Pick deliberately:

- **`open`** — when the page literally means "the Open bucket only" (e.g. funnel stage breakdown).
- **`inFlight`** — when the page means "active pipeline, hasn't closed yet" (e.g. Overview KPIs, snapshot openRenew/openNew counts).

Got this wrong in pre-v1.9.2 snapshots — they used narrow `open` while Overview used broad `inFlight`, so snapshot vs current always disagreed by Commit+Upside. Fixed by switching snapshots to `inFlight`.

`Unmapped` is **not** in `inFlight` — it's its own thing. If you need "everything that's not Won/Lost", write `!M.closed(d) && d.status !== 'Unmapped'` explicitly. Or just iterate `STATUS_LIST` and skip what you don't want.

---

## Status colors

```js
App.StatusMapping.COLORS = {
  Won:      { fill: '#259b24', light: '#c5e1a5' },
  Commit:   { fill: '#9ccc65', light: '#dcedc8' },
  Upside:   { fill: '#f97316', light: '#ffedd5' },
  Open:     { fill: '#3b82f6', light: '#dbeafe' },
  Lost:     { fill: '#ef4444', light: '#fee2e2' },
  Unmapped: { fill: '#94a3b8', light: '#e2e8f0' },
};
```

- `fill` for chart fills, badges, accents.
- `light` for backgrounds where text overlays.

Pages that previously hardcoded these (Status Funnel etc.) were migrated in v1.9.2 to read from `App.StatusMapping.COLORS`. **Don't reintroduce hardcoded colors.** If you need a new shade, add it here.

---

## Settings → Status Mapping page

Route: `#/statusmap` (file: `pages/status-mapping.js`).

UI lists every stage seen in current deals (or in default + custom map), with a dropdown to assign to one of the 5 active statuses (Won/Commit/Upside/Open/Lost). User cannot pick `Unmapped` — that's the default sink, not a target.

Save writes to `settings.statusMapping`. Triggers `renderRoute()` so charts immediately reflect the new mapping.
