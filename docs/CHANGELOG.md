# Changelog

Versions covering recent UX/correctness work. Earlier history (pre-1.6.0) is in git.

---

## v1.9.9 — 2026-05-08
**Toast button + 6th status**

- `.toast` z-index 500 → 2000 (above modals at 1000+); `pointer-events: none` only when hidden, `auto` on `.show`. Fix: "Map now →" toast button was unclickable.
- Added 6th status `Unmapped` (slate gray `#94a3b8`). `App.StatusMapping.resolve()` returns `'Unmapped'` for stages with no explicit mapping. Substring-guess heuristic removed — every classification must come from an explicit entry.
- Status filter dropdown uses `App.StatusMapping.LIST` instead of hardcoded 5 elements.

## v1.9.8 — 2026-05-08
**Unmapped stage alert**

- `App.StatusMapping.findUnmapped(deals, customMap)` returns sorted list of new stages.
- `App.UI.toast()` extended with `{ action: { label, onClick }, duration }`.
- On data upload: if unmapped stages exist, show toast "N new stages found — Map now →" linking to `#/statusmap`.
- Settings → Status Mapping card morphs (red border + count + "Classify now" button) when unmapped present.

## v1.9.7 — 2026-05-07
**Session-only data state**

- Settings store moved from `localStorage` → `sessionStorage`. Refreshing the tab now clears uploaded data + targets + snapshots. Persistence via export JSON only.
- Removed Deal Comments feature entirely (UI + data field). User said "ไม่ต้องสนใจ เอา feature ออกเลยก็ได้".
- Theme + language remain in `localStorage` (UI prefs, not data).

## v1.9.6 — 2026-05-06
**Filter count badges**

- `buildMultiSelect()` now accepts `{value, count}` shape. Each option renders as `Label (count)`.
- Resolves long-running confusion where Pipeline/Deal Type/Product Type appeared to have "extra" entries — they were always real, just rare. Counts make the source obvious.
- `filters.uniquesWithCount()` helper.

## v1.9.5 — 2026-05-06
**CSP + sticky deal header**

- Removed `frame-ancestors` from CSP meta (invalid there; ignored by browsers).
- Vendored `chart.umd.js.map` (~930KB) — eliminates 404 in console.
- Deal detail modal: header sticks while body scrolls (`.deal-header` position sticky).

## v1.9.4 — 2026-05-06
**Modal stack + dark mode + global team filter**

- Each modal gets its own backdrop with z-index stacking (was: shared backdrop, second modal overwrote first).
- Closing deal-detail modal returns to drillModal instead of dismissing both.
- Targets dark mode text color fixed.
- `teamOptions()` unions deal teams + `settings.teams` so newly added teams show in Global filter immediately.
- `modal()` supports `{ noTitle: true }` for floating-X close button.

## v1.9.3 — 2026-05-05
**Default English**

- `i18n.DEFAULT_LANG` 'th' → 'en'. First-time visitors see English; `localStorage` override still wins for return visitors.
- Initial flag in HTML: 🇬🇧.

## v1.9.2 — 2026-05-05
**Correctness audit (Level 3)**

Fixed in one pass:
- **What-if double-count**: `computeMonthly` mutated `m.salesForecast` in what-if branch, then `scenarioRevenue` re-added `openNew`. Preserved `m.salesForecastInput` as untouched baseline.
- **M1 (snapshot)**: snapshot uses `M.inFlight` for openRenew/openNew (broad def matches Overview).
- **M2 (skip flag)**: `Matchers` exports `inFlight`, `closed` as helpers — eliminated ad-hoc booleans.
- **M3 (hardcoded)**: Status Funnel in newsell.js reads colors from `App.StatusMapping.COLORS` instead of hex literals.
- **M4 (commit split)**: forecast what-if now has `commitRenew` + `commitNew` separately.
- **L1 (monthBounds)**: snapshot.js caches monthBounds per render.
- **L2 (daysBetween)**: `App.UI.daysBetween(a, b)` — DST-safe day diff. renew.js + newsell.js use it.
- **D1 (persist what-if)**: `loadWhatIfFromSettings()` / `saveWhatIfToSettings()` keep slider state across navigation.
- **D2/D3**: doc comments on `applyPreset()` boundary convention + Matchers narrow vs broad semantics.

## v1.9.1 — 2026-05-04
**Risk chips + filter refresh**

- Customers at Risk + New deals at Risk: clickable chips replace separate toggle buttons. Active state = `.risk-chip-active`.
- Apply-to (Bulk fill / Smart distribute): no preselected value — user must pick.
- Settings import (all three paths: drag-drop, post-upload prompt, Settings button) now triggers `applyTeamConfigChange()` so Global filter dropdowns refresh immediately.
- Cache strategy A: `clearStaleFilterSelections()` runs after each upload — drops filter values that don't exist in new data.

## v1.9.0 — 2026-05-04
**Big UX pass**

Removals (per user request):
- Overview: Lost Total card
- Action Center: Stuck deals
- Renew: Renew Coverage, Avg Lost Deal, Lost by Deal Type

Additions:
- Customers at Risk toggle (later → chip in v1.9.1)
- New Sell mirror with same risk chip pattern
- Status Funnel (replaces Stage Funnel) on newsell.js
- Searchable single-select dropdowns for Bulk fill / Smart distribute on Targets (`buildSearchableSelect`)
- Targets placeholder when no parsed data

## v1.8.6 — 2026-05-03
**Targets data loss — real fix**

- `recalcTotalsInPlace()` for targets and forecast input grids: never destroy `<input>` elements while user is typing. Only update `<td>` total cells.
- Replaces v1.8.4/v1.8.5 attempts (debounce + focus restore — neither worked because `change` only fires on blur).
- Same pattern applied to Sales Forecast input grid.

## v1.8.5 — 2026-05-03
**Focus restore (superseded)**

- `CSS.escape()` for selectors when restoring focus after re-render. Doesn't fix the underlying issue but stops focus loss in unrelated grids.

## v1.8.4 — 2026-05-03
**Debounce attempt (superseded)**

- 250ms debounce on targets re-render. Insufficient — real fix is v1.8.6.

## v1.8.3 — 2026-05-02
**safeColor**

- `App.UI.safeColor(c, fallback)` validates hex strings before setting `style.color` / `style.backgroundColor`. Defends against settings-import injection.

## v1.8.2 — 2026-05-02
**Cleanup**

- Removed dead toggles: `diffViewEnabled`, `compactMode`. Never wired to anything.

## v1.7.6 — 2026-05-01
**Chart blank fix**

- Removed staggered fade-in animation on chart canvases. `opacity:0` + `animation-fill-mode: both` caused browsers to skip painting on first frame intermittently. Charts now render at full opacity from t=0.

## v1.7.5 — 2026-05-01
**Chart blank attempt (superseded)**

- Tried delaying chart construction. Didn't help — root cause was CSS animation, see v1.7.6.

## v1.7.4 — 2026-04-30
**Print landscape**

- Replaced named `@page` rules (Safari ignores) with dynamic `<style>` injection in `beforeprint` containing plain `@page { size: A4 landscape }`. Removed in `afterprint`.

## v1.7.3 — 2026-04-30
**Print donut center text**

- `window._isPrinting` flag forces white halo stroke on donut center text. `chart.update()` invoked in `beforeprint` so canvas re-renders with print-safe colors before browser captures.

## v1.7.2 — 2026-04-29
**i18n perf**

- `App.I18n.apply(root)` consolidated to a single `querySelectorAll` per call.

## v1.6.1 — 2026-04-28
**Removed**

- "Don't show again" checkbox on post-upload prompt.
- "Your Name" input from settings (unused).

## v1.6.0 — 2026-04-27
**Snapshot diffs**

- `App.Snapshot.create()` + `App.Snapshot.diff()`. Diff page lets user pick two snapshots and see deal-level changes.
