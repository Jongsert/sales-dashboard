# Code Factor — Helpers and Patterns

The reusable building blocks. When adding a feature, search this doc first — there's almost always an existing helper.

---

## `App.UI.*` (ui-components.js)

### `toast(msg, type, opts?)`
Bottom-right transient notification.
```js
App.UI.toast('Saved', 'success');
App.UI.toast('Bad data', 'error');

// v1.9.8: clickable action
App.UI.toast('5 new stages found', 'warning', {
  duration: 8000,
  action: { label: 'Map now →', onClick: () => location.hash = '#/statusmap' }
});
```
- Types: `'success' | 'error' | 'warning' | 'info'` (default info)
- z-index: 2000 (above modals at 1000+) — see CSS `.toast`
- Auto-dismiss after `duration` ms (default 3000)

### `modal(opts)`
Stackable modal with own backdrop per instance.
```js
const m = App.UI.modal({
  title: 'Edit deal',
  body: htmlString,        // or DOM node
  noTitle: false,          // true → floating-X close, no title bar
  buttons: [
    { label: 'Cancel', onClick: () => m.close() },
    { label: 'Save', primary: true, onClick: () => { ... ; m.close(); } },
  ],
});
m.close();                  // programmatic close
```
- Each modal has its own backdrop (v1.9.4 fix). Multiple stack cleanly.
- Closing one modal doesn't dismiss any underneath.
- `noTitle: true` is for deal-detail (uses `.deal-header` sticky inside body).

### `buildMultiSelect(container, opts)`
Searchable multi-select dropdown.
```js
App.UI.buildMultiSelect(el, {
  label: 'Pipeline',
  options: [{value:'A', count:12}, {value:'B', count:3}],  // count optional
  selected: ['A'],
  onChange: (selected) => { ... },
});
```
- v1.9.6: pass `{value, count}` to render `Label (count)` badges.

### `buildSearchableSelect(container, opts)`
Searchable single-select. No default selected (v1.9.1).
```js
App.UI.buildSearchableSelect(el, {
  label: 'Apply to',
  options: ['Team A', 'Team B'],
  placeholder: 'Pick one…',
  onChange: (value) => { ... },
});
```

### `safeColor(c, fallback?)`
Hex validator. Returns `c` if it matches `/^#[0-9a-f]{3,8}$/i`, else `fallback ?? '#94a3b8'`.
```js
el.style.color = App.UI.safeColor(userInput, '#000');
```
Use for any color that comes from settings-import or user input.

### `escapeHtml(str)`
Always escape before injecting strings into innerHTML.
```js
el.innerHTML = `<td>${App.UI.escapeHtml(deal.title)}</td>`;
```

### `daysBetween(a, b)`
DST-safe day diff. Returns integer days (b - a).
```js
const days = App.UI.daysBetween(deal.lastActivity, new Date());
if (days > 30) flagAsStale(deal);
```

### `exportToExcel(rows, filename)` / `exportToCSV(rows, filename)`
Both take `Array<Record<string, any>>` and trigger download via SheetJS / blob.

### `screenshotElement(el, filename)`
html2canvas wrapper. Returns PNG download.

### `openDealDetail(deal, parsed)`
Opens deal-detail modal with sticky `.deal-header`. Uses `noTitle: true`. Comments section was removed in v1.9.7.

---

## `App.Filters.*` (filters.js)

### `STATE`
```js
App.Filters.STATE = {
  parsed,                 // raw upload result
  deals,                  // current deals
  selected: { team:[], pipeline:[], dealType:[], productType:[], status:[], owner:[], dateField, from, to, presetKey, search }
};
```

### `apply(deals?)`
Returns filtered subset. Reads `STATE.selected`. Pure — doesn't mutate state.

### `Matchers`
Predicate set used everywhere status logic appears. **Always use these — never re-implement `d.status === 'Won'` inline.**
```js
const M = App.Filters.Matchers;
M.isRenew(d) / M.isNew(d)
M.won(d) / M.lost(d) / M.commit(d) / M.upside(d) / M.open(d)
M.closed(d)     // Won OR Lost (final states)
M.inFlight(d)   // Open OR Commit OR Upside (active pipeline)
```

`open` is **narrow** (status === 'Open' only). `inFlight` is **broad** (Open + Commit + Upside). When picking, ask: "do I mean only the literal Open bucket, or everything not-yet-decided?" — use the right one. See [STATUS-MODEL.md](STATUS-MODEL.md).

### `refreshMultiSelects(deals, renderRoute)`
Rebuilds Global filter dropdowns. Call after any data change. v1.9.6: passes `uniquesWithCount()` so badges show.

### `decodeFilterState(queryString)` / `encodeFilterState()`
URL ↔ STATE.selected. Used for shareable links.

### `applyPreset(key)`
Key ∈ `'today' | 'thisWeek' | 'thisMonth' | 'thisQuarter' | 'thisYear' | 'last30' | 'last90'`. **Boundary convention**: from = start of period (00:00), to = end of period (23:59:59.999). Documented inline in `applyPreset`.

---

## `App.Settings.*` (settings-store.js)

### `load()`
Returns full settings object. Always returns a valid shape (defaults filled in).

### `set(path, value)`
Dot-path setter, persists to sessionStorage.
```js
App.Settings.set('uiPreferences.lastPage', 'overview');
App.Settings.set('users', [...]);
```

### `importFromObject(obj)`
Validates schema via `sanitizeImported(obj)` — drops unknown keys, type-checks fields. Then merges into state and persists. Returns `true` on success.

### `exportToObject()`
Returns plain object suitable for JSON.stringify. Includes everything in defaults. Used by Settings → Export button.

### `syncUsersFromDeals(deals)`
After upload, ensure every `responsible` in deals is in `users[]` (with team='Unassigned' if new). Doesn't remove existing users.

---

## `App.StatusMapping.*` (status-mapping.js)

See [STATUS-MODEL.md](STATUS-MODEL.md) for full details.

```js
App.StatusMapping.LIST                  // ['Won','Commit','Upside','Open','Lost','Unmapped']
App.StatusMapping.COLORS[status]        // {fill, light}
App.StatusMapping.resolve(stage, custom)
App.StatusMapping.findUnmapped(deals, custom)
```

---

## Patterns

### Re-render-in-place for editable grids
Targets and Sales Forecast use `recalcTotalsInPlace()` — never destroy `<input>` while user types. Only update `<td>` total cells. **Don't replace this with full re-renders.** v1.8.6 fix; recurring failure mode if reverted.

### What-if state preservation
`forecast.js` keeps `m.salesForecastInput` as untouched baseline. What-if mutations operate on a derived view; never write back to baseline. v1.9.2 — see CHANGELOG.

### Mode gating
```js
if (App.MODE === 'admin') {
  // render edit UI
}
```
Use this everywhere mutation is offered. Never trust client-side gating for security — viewer mode is UX, not a permission boundary.

### Filter refresh after data change
Any path that mutates users/teams/deals must call:
```js
App.Filters.refreshMultiSelects(App.Filters.STATE.deals, renderRoute);
```
Or higher-level: `App.applyTeamConfigChange()` for users/teams edits. Three import paths all wired in v1.9.1.

### Print
- Listen for `beforeprint` / `afterprint`.
- Set `window._isPrinting = true` so plugins (donut center text) can switch colors.
- Inject `<style>@page { size: A4 portrait/landscape }</style>` dynamically.
- Force `chart.update()` for each visible chart so canvases re-render with print-safe colors.
- 30s safety timeout to clear `_isPrinting` if `afterprint` doesn't fire (Safari quirks).

### Theme
`document.body.dataset.theme = 'light' | 'dark'`. CSS uses `[data-theme=dark]` selectors. Persisted in localStorage.

### i18n
- `App.I18n.t('key')` — lookup
- Mark elements with `data-i18n="key"`
- After DOM mutations: `App.I18n.apply(rootEl)` re-translates that subtree
- Default lang = 'en' since v1.9.3
