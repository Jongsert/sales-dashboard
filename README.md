# Sales Dashboard

Interactive sales performance dashboard for Bitrix24 deal data — used in weekly sync &amp; management meetings.

🌐 **Live**: https://Jongsert.github.io/sales-dashboard/

## Features

### Phase 1 (current)
- ✅ Multi-format import: `.xlsx` · `.xls` · `.csv` · `.json`
- ✅ Smart column matching (resilient to renamed/reordered columns)
- ✅ 5-status mapping: **Won · Commit · Upside · Open · Lost**
- ✅ Multi-select global filters (Period · Team · User · Pipeline · Deal Type · Product Type · Status)
- ✅ Team → User cascade auto-filter
- ✅ **Overview page**: 7 KPI cards, stacked-status charts, top performers, stage funnel
- ✅ **Settings page**: Export/Import JSON · Stage→Status overrides · User management
- ✅ localStorage auto-save · Export with date-stamped filename

### Phase 2 (planned)
- Targets Setup page (per-user New Sell targets, editable)
- Pipeline Detail page (transaction table + multi-search + click-to-detail)

### Phase 3 (planned)
- Forecast page (centerpiece for management meeting)
- What-if scenario sliders
- Renewal Estimate calculator (Open Renew × multiplier, per-month overrides)
- Sales Forecast manual input grid

### Phase 4 (planned)
- Drill-down pages: Renew · New Sell · Combined
- Snapshot history (week-over-week tracking)
- Diff view (compare two snapshots)
- Print / PDF export
- Multi-language (TH / EN)
- URL deep-link support

## Privacy &amp; Data Handling

- **No data is committed to this repository.** Deal data stays on your computer — uploaded into the browser, processed in-memory, never sent anywhere.
- Settings (targets, mappings, preferences) are stored in browser `localStorage`.
- To share settings between team members: use **Export Settings** (JSON file) → share via Drive/Slack/email → recipient uses **Import Settings**.

## How to use

1. Open https://Jongsert.github.io/sales-dashboard/
2. Click **Upload data** or drag a Bitrix `.xlsx` export onto the page.
3. Use the filter bar at the top to slice the data.
4. Switch between pages via the tabs.

## Local development

```bash
git clone https://github.com/Jongsert/sales-dashboard.git
cd sales-dashboard
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step required — vanilla JS, all libraries bundled in `assets/lib/`.

## License

MIT
