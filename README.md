# Sales Dashboard

Interactive sales performance dashboard for Bitrix24 deal data — used in weekly sync & management meetings.

🌐 **Admin** (full features): https://Jongsert.github.io/sales-dashboard/
👁️ **Viewer** (read-only build): https://Jongsert.github.io/sales-dashboard/viewer/

Current version: **v1.9.2**

---

## Features

### 📥 Data import
- Multi-format: `.xlsx` · `.xls` · `.csv` · `.json`
- Smart column matching (resilient to renamed/reordered columns)
- Auto-detection of users + teams from uploaded data
- Drag-drop or click-to-upload
- Post-upload prompt to optionally import a settings file

### 🌐 Filtering & navigation
- Multi-select global filters: **Period · Team · User · Pipeline · Deal Type · Product Type · Status**
- Period picker: Quick presets (This Month / Last Month / MTD / This Quarter / QTD / This Year / YTD / All time / etc.)
- Custom date range with **AD calendar picker** (no BE conversion)
- Team → User cascade auto-filter
- URL deep-link: shareable URLs preserve all filter state
- Stale filter selections auto-cleared on data upload
- Live cross-tab settings sync

### 📊 Pages
- **Overview** — 6 KPI cards (Total / Renew / New + Win Rate / Renew Coverage / Open Pipelines), trend by month, per-user pipeline, top performers, stage funnel
- **Action Center** — items needing attention (overdue, due in 15 days, big open deals, commit/upside)
- **Renew** — retention KPIs, churn rate, monthly trend, **Customers at Risk** (clickable filter chips for Overdue / Due in 15 days), top renewals to win, lost analysis
- **New Sell** — win rate, status funnel, monthly stacked, **New deals at Risk** (same chip toggle), top performers, top new customers
- **Combined** — renew + new unified view
- **Forecast** *(centerpiece)* — monthly trajectory chart, cumulative trajectory, **Renewal Estimate** (Open Renew × multiplier, per-month overrides + skip), **Sales Forecast** (manual grid per user × month), **What-if scenarios** with 6 probability sliders (Pessimistic / Likely / Optimistic) — state persists across sessions
- **All Deals** — sortable/searchable table with customizable columns + click-to-detail modal (21 fields, 6 sections)
- **Diff view** — compare any two snapshots side-by-side, KPI delta cards, trend chart of last 12 snapshots
- **Targets** — per-user × month New Sell targets, Bulk fill / Smart distribute (searchable scope), auto-computed Renew Target from data
- **Teams & Users** — team management, color picker, drag users between teams, Unassigned support
- **Status Mapping** — Stage → Status (Won/Commit/Upside/Open/Lost) with custom overrides
- **Settings** — backup & restore (JSON), snapshot history, access control, UI preferences

### 🎨 UI / UX
- **Light / Dark / System** theme (auto-follows OS preference)
- **i18n: TH / EN** toggle in topbar (professional Thai-English mix style)
- Responsive layout
- Custom AD calendar picker
- Rich modal stack with ESC support
- Toast notifications
- Searchable single-select dropdowns
- Status colors: Won #259b24 · Commit #9ccc65 · Upside #f97316 · Open #3b82f6 · Lost #ef4444

### 📤 Export
- **Excel / CSV** export per page (All Deals · Targets · Forecast)
- **Settings JSON** backup (full config + snapshot history)
- **Print to PDF** — auto picks A4 portrait/landscape per page; force-light theme so dark-mode users get readable hardcopy; donut center text uses halo so it's readable in any background
- **Screenshot to PNG** — captures full table including off-screen columns (Overview, Forecast, Diff)

### 🔒 Security
- Content-Security-Policy meta tag
- HTML escape on all user-controlled fields
- Hex-color validation (`safeColor`) on every inline style
- Settings JSON schema validation on import
- Optional URL access-token gate (casual barrier — not real auth)
- Two-build separation: viewer URL has no export buttons / admin features in source

### 📈 Analytics & meetings
- **Snapshot capture** — point-in-time KPI freeze for week-over-week tracking
- **Diff view** — compare 2 snapshots, see KPI deltas (Achievement % / Won / Open / Commit / Upside / Lost / Deal Count)
- **What-if scenarios** — Pessimistic / Likely / Optimistic with separate Commit Renew + Commit New sliders
- **Auto-insights** *(in code, currently dormant)*

---

## Privacy & data handling

- **No data is committed to this repository.** Deal data stays on your computer — uploaded into the browser, processed in-memory, never sent anywhere.
- Settings (targets, mappings, snapshots, preferences) are stored in browser `localStorage`.
- Settings file (JSON) carries all configuration including snapshot history — share with teammates via Drive/Slack/email so everyone sees the same numbers.
- Access token gate is a **casual barrier**, not real authentication. Anyone with the token + URL can view all data.

---

## How to use

1. Open https://Jongsert.github.io/sales-dashboard/
2. Click **Upload data** or drag a Bitrix `.xlsx` export onto the page
3. (Optional) Import a settings JSON when prompted to load shared targets/mappings
4. Use the global filter bar to slice the data
5. Switch between pages via the tabs
6. Take a snapshot before each weekly meeting → review week-over-week change in **Diff view**

---

## Admin vs Viewer build

The dashboard ships in two flavors served from the same codebase:

| URL | Mode | Has |
|---|---|---|
| `/sales-dashboard/` | Admin | Everything: edit settings, take snapshots, export Excel/CSV, manage teams, set access token |
| `/sales-dashboard/viewer/` | Viewer | Read-only: view dashboards, switch theme/lang, take screenshots, copy share URLs. **No** export buttons or settings backup |

Mechanism: `viewer/index.html` is a thin shim that sets `window.APP_MODE = 'viewer'` before loading the same `assets/` files admin uses. No build step.

---

## Local development

```bash
git clone https://github.com/Jongsert/sales-dashboard.git
cd sales-dashboard
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step — vanilla JS, all libraries (Chart.js, SheetJS, PapaParse, html2canvas) bundled in `assets/lib/`.

### Project layout
```
index.html              — admin entry
viewer/index.html       — viewer thin shim (loads ../assets/)
assets/
  css/app.css           — all styles + dark mode + print rules
  js/
    app.js              — bootstrap, router, file upload, theme, i18n wiring
    filters.js          — global filter bar + Matchers + URL state
    settings-store.js   — localStorage persistence + sanitize on import
    data-parser.js      — xlsx/csv/json parsing + 5-status classification
    ui-components.js    — modal, toast, drillModal, exportToExcel, exportToCSV, screenshotElement, buildSearchableSelect, daysBetween, safeColor, escapeHtml
    calendar-picker.js  — AD-only date picker (replaces native input)
    snapshot.js         — snapshot capture
    i18n.js             — TH / EN dictionary
    donut-center-plugin.js — Chart.js plugin
    pages/*.js          — one file per page module
  lib/                  — vendored third-party libs
```

---

## License

MIT
