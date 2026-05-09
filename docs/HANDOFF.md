# Sales Dashboard — Handoff

**Version**: v1.9.9 (2026-05-08)
**Live**: https://Jongsert.github.io/sales-dashboard/
**Stack**: Vanilla JS + Chart.js + SheetJS + PapaParse + html2canvas. No build step. No backend.

---

## What this is

A client-side single-page dashboard that reads Bitrix24 deal exports (xlsx/csv) and renders 12 pages of analysis: Overview, Renew, New Sell, Pipeline, Combined, Targets, Forecast, Action Center, Diff, Snapshots, Teams, Settings.

Everything runs in the browser. No server, no database, no auth backend. Files are read locally — they never leave the user's machine.

---

## How to read this folder

| File | Read this when… |
| --- | --- |
| **HANDOFF.md** *(this file)* | First time reading the project — start here |
| [ARCHITECTURE.md](ARCHITECTURE.md) | You need to find where something lives, or understand storage strategy |
| [CODE-FACTOR.md](CODE-FACTOR.md) | You need to use a helper or follow an existing pattern |
| [STATUS-MODEL.md](STATUS-MODEL.md) | You're touching anything related to deal status / stage / Won/Lost logic |
| [CHANGELOG.md](CHANGELOG.md) | You want context on why something is the way it is |
| [CONVENTIONS.md](CONVENTIONS.md) | You're about to write code or commit messages |

---

## Quick start (next maintainer)

1. **Run locally** — there's no build step. Open `index.html` directly, or:
   ```bash
   cd sales-dashboard
   python3 -m http.server 8000
   # open http://localhost:8000/
   ```

2. **Try the app** — drop a Bitrix xlsx export on the page. If you don't have one, every filter/chart will be empty (no demo data shipped).

3. **Find your way around** — `assets/js/app.js` is the bootstrap, hash routes to `App.Pages.<id>.render()`. Each page lives in `assets/js/pages/`. See [ARCHITECTURE.md](ARCHITECTURE.md).

4. **Ship a change**:
   - Edit code → bump `VERSION` in `assets/js/app.js:5`
   - Test in browser, switch theme + language, refresh, drop a file
   - Push to `main` → GitHub Pages auto-deploys

---

## Two builds, one codebase

`viewer/index.html` is a thin shim that sets `window.APP_MODE = 'viewer'` before loading the same JS. Viewer mode hides admin-only UI (file upload, settings tabs, snapshot creation, what-if). Check `App.MODE === 'admin'` before rendering admin actions.

---

## Key constraints (don't violate without thinking)

- **No build step.** Don't introduce webpack/vite/etc — the project runs straight from `index.html`. Adding a build step would break the "edit a file, refresh browser" workflow that's load-bearing for this user.
- **No external dependencies at runtime.** All vendors are checked into `assets/vendor/`. Pages must work offline.
- **`sessionStorage` for data, `localStorage` for UI prefs.** Refreshing the tab clears uploaded data — that's intentional (v1.9.7). See [ARCHITECTURE.md](ARCHITECTURE.md#storage).
- **Status mapping is explicit.** Unknown stages become `Unmapped`, never silently `Open`. See [STATUS-MODEL.md](STATUS-MODEL.md).
- **No preview panel during ship-feature responses.** User reads the diff themselves. Always end ship turns with a terminal push prompt + QA checklist (see [CONVENTIONS.md](CONVENTIONS.md#response-shape)).

---

## Open follow-ups

- **v1.9.9 push pending** — code is on disk, user needs to commit + push. See push prompt at end of v1.9.9 conversation.
- **Old `localStorage` data is stranded** for users upgrading from v1.9.6 → v1.9.7. They lose users/teams/targets on first refresh after upgrade. Acceptable trade-off — fresh-start was the requested behavior.
- **Snapshots are session-only** now. Users must export-settings to persist them. README does call this out.

---

## Who to ask

The user (project owner) is the only stakeholder. There's no team, no PM, no design system. They prefer:
- Terse responses, TH+EN mix when explaining
- One decisive recommendation over "options A/B/C"
- Push prompts as copy-pasteable terminal blocks
- Bumping patch version per change (1.9.x), avoiding 2.0.0 bumps unless they specifically ask
