# Architecture

## File tree

```
sales-dashboard/
├── index.html                  # admin entry — loads everything
├── viewer/index.html           # viewer entry — sets APP_MODE='viewer' then loads same JS
├── assets/
│   ├── css/app.css             # ~2.4k lines — single stylesheet, no preprocessor
│   ├── js/
│   │   ├── app.js              # bootstrap: hash router, file upload, theme, i18n, version
│   │   ├── i18n.js             # TH/EN dictionary + apply()
│   │   ├── settings-store.js   # sessionStorage for data, localStorage for UI prefs
│   │   ├── status-mapping.js   # 6-status model: Won/Commit/Upside/Open/Lost/Unmapped
│   │   ├── data-parser.js      # xlsx/csv → deal[]
│   │   ├── filters.js          # filter state, multiselects, Matchers, URL encode/decode
│   │   ├── snapshot.js         # snapshot creation + diff math
│   │   ├── ui-components.js    # toast, modal, exports, screenshot, helpers
│   │   ├── donut-center-plugin.js  # Chart.js plugin: text in donut center
│   │   ├── calendar-picker.js  # custom AD calendar dropdown
│   │   └── pages/
│   │       ├── overview.js     # KPIs + donuts + Top customers + month bar
│   │       ├── renew.js        # renewal-only view + Customers at Risk
│   │       ├── newsell.js      # new-sell-only view + Status Funnel
│   │       ├── pipeline.js     # generic pipeline page (all deals)
│   │       ├── combined.js     # renew + new sell side-by-side
│   │       ├── targets.js      # editable targets grid (per-team × per-month)
│   │       ├── forecast.js     # what-if sliders + sales forecast input
│   │       ├── actions.js      # Action Center (overdue, no activity, expected close)
│   │       ├── diff.js         # snapshot vs snapshot
│   │       ├── teams.js        # users + teams editor
│   │       ├── settings.js     # all admin settings tabs
│   │       └── status-mapping.js  # Status Mapping editor page (#/statusmap)
│   └── vendor/                 # Chart.js, datalabels, xlsx, papaparse, html2canvas
├── docs/                       # ← you are here
└── README.md
```

## Namespace map (`window.App.*`)

Everything attaches to a single global. No modules, no imports.

| Namespace | Where defined | What it owns |
| --- | --- | --- |
| `App.VERSION`, `App.VERSION_DATE`, `App.MODE` | app.js | version string, `'admin'` or `'viewer'` |
| `App.Pages.<id>` | each `pages/*.js` | `.render(main, parsed)` — entry per route |
| `App.Filters` | filters.js | `STATE`, `apply()`, `refreshMultiSelects()`, `Matchers`, `decodeFilterState()` |
| `App.Settings` | settings-store.js | `load()`, `set(path, value)`, `importFromObject()`, `exportToObject()`, `syncUsersFromDeals()` |
| `App.StatusMapping` | status-mapping.js | `DEFAULT`, `LIST`, `COLORS`, `resolve(stage, custom)`, `findUnmapped(deals, custom)` |
| `App.UI` | ui-components.js | `toast()`, `modal()`, `buildMultiSelect()`, `buildSearchableSelect()`, `safeColor()`, `escapeHtml()`, `daysBetween()`, `exportToExcel()`, `exportToCSV()`, `screenshotElement()`, `openDealDetail()` |
| `App.DataParser` | data-parser.js | `parseDealFile(file, settings)` |
| `App.Snapshot` | snapshot.js | `create(deals, settings, label)`, `diff(a, b)` |
| `App.I18n` | i18n.js | `t(key)`, `setLang(code)`, `apply(root)` |
| `App.applyTeamConfigChange` | app.js | repropagate `users[].team` onto deals + refresh filters (called after Settings/Teams edits) |

## Routing

`app.js` listens for `hashchange`. Each page id maps to `App.Pages[id]`:

```
#/         → overview
#/renew    → renew
#/newsell  → newsell
#/pipeline → pipeline
#/combined → combined
#/targets  → targets
#/forecast → forecast
#/actions  → actions
#/diff     → diff
#/teams    → teams
#/settings → settings
#/statusmap → status-mapping (settings/status-mapping.js)
```

After every render, `App.Settings.set('uiPreferences.lastPage', pageId)` so reopening the tab returns to the same page.

## Storage

Two stores, **two different lifetimes**:

### `sessionStorage` — data state (cleared when tab closes)
Key: `salesDashboard.settings`
Holds: `users`, `teams`, `newSellTargets`, `salesForecast`, `renewalEstimate`, `statusMapping`, `teamMapping`, `columnRemap`, `columnPreferences`, `uiPreferences.whatIf`, `accessToken`, `snapshots`

Why session: user explicitly chose "fresh-start" (option C, v1.9.7). Refreshing must not preserve uploaded data — they were getting confused by stale filters. Persistence is via **export settings JSON**.

### `localStorage` — UI prefs only (persists across sessions)
Keys: `salesDashboard.theme`, `salesDashboard.lang`
Holds: light/dark theme, EN/TH language. These are personal preferences not tied to data.

### Filter state
URL-encoded into `?f=…` query string by `App.Filters.encodeFilterState()`. Supports linkable views. Decoded on init by `app.js`.

## Mode flag

```js
const MODE = (typeof window.APP_MODE === 'string' && window.APP_MODE === 'viewer')
  ? 'viewer'
  : 'admin';
```

Pages and Settings sub-tabs check `App.MODE === 'admin'` to hide:
- File upload area
- Snapshot creation, what-if sliders
- Settings: Backup/Restore, Status Mapping, Teams, Snapshots, Access Control, Danger Zone
- Editable targets

Viewer can read everything but cannot mutate.

## Render lifecycle

```
hashchange / DOMContentLoaded
        │
        ▼
  renderRoute()
        │
        ├─→ App.Filters.apply(deals)        → returns filtered subset
        │
        └─→ App.Pages[id].render(main, {
              deals,        // unfiltered
              filtered,     // after apply()
              settings,     // current snapshot
            })
```

Pages own their DOM under `<main>`. They don't share components beyond `App.UI.*` helpers. State lives in the page closure or in `App.Settings`.

## Vendor scripts

Pinned versions in `assets/vendor/`:
- `chart.umd.js` (+ `.map`) — Chart.js v4
- `chartjs-plugin-datalabels.min.js`
- `xlsx.full.min.js` — SheetJS
- `papaparse.min.js`
- `html2canvas.min.js`

Custom plugin `donut-center-plugin.js` registered globally for "% complete" centered text.

## CSP

`<meta http-equiv="Content-Security-Policy">` in both index.html files. No `frame-ancestors` (invalid in meta — only HTTP header). Allowed sources: `'self'` + inline styles/scripts (needed for vendor compat).
