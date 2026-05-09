# Conventions

How to match the existing style.

---

## Versioning

Patch-level bumps for everything: `1.9.9 → 1.9.10 → 1.9.11`. Don't jump to `2.0.0` without explicit user approval — they pushed back hard on this once.

`VERSION` lives in `assets/js/app.js:5` (single source of truth — the page footer reads from here). Bump it on every change that ships, even tiny ones. `VERSION_DATE` is YYYY-MM-DD.

---

## Response shape (when user asks for a feature)

User's saved feedback (`feedback_workflow.md`):

> No preview panel; include terminal push prompt + QA checklist

So when finishing a ship-feature turn:

1. **Don't** call any preview tool. The user reads the diff themselves.
2. **End with two things**:
   - **Push prompt** — copy-pasteable terminal block, ready to run:
     ```
     cd ~/sales-dashboard && git add -A && \
     git commit -m "v1.9.X: <one-line summary>" && \
     git push
     ```
   - **QA checklist** — short bullet list of what to click in the browser to verify:
     ```
     QA:
     - Drop xlsx → toast "N new stages" appears, click action → lands on /statusmap
     - Refresh tab → uploaded data is gone (sessionStorage cleared)
     - Switch theme dark/light → no broken contrast
     ```

3. Body should be **terse**. No "Here's what I did:" preambles. Diff speaks for itself.

---

## Tone in user-facing text

The user code-switches TH ↔ EN freely. Your responses should too. Default to:

- **Technical terms in English**: "what-if", "modal", "filter", "snapshot", "session storage"
- **Conversational glue in Thai**: "เพิ่มแล้ว", "เรียบร้อย", "ลองทดสอบ"
- **Don't translate Bitrix/dashboard nouns** — keep them as the user said them

Example:
> เพิ่ม Unmapped status แล้ว — toast จะขึ้นถ้าเจอ stage ใหม่ที่ยังไม่ map. ลองดูครับ:

Not:
> สวัสดีครับ ฉันได้ทำการเพิ่มสถานะที่ยังไม่ได้ทำการแมปลงไปในระบบเรียบร้อยแล้ว…

---

## i18n inside the app (different from above)

The **app's** i18n is full-translation between TH and EN. Keys live in `i18n.js` dictionary:

```js
const DICT = {
  en: { 'overview.title': 'Overview', 'overview.lostTotal': 'Lost Total', ... },
  th: { 'overview.title': 'ภาพรวม', 'overview.lostTotal': 'มูลค่าที่เสียทั้งหมด', ... },
};
```

When adding UI text:
- Add a key to **both** EN and TH dicts.
- Mark the element: `<span data-i18n="myFeature.label"></span>`
- After mutating that element's children, call `App.I18n.apply(rootEl)`.

Don't hardcode user-facing strings. Don't ship EN-only text — it'll show as the key in TH mode and look broken.

Default lang since v1.9.3 is `'en'`. First-time visitor sees English; user can flip to TH from header.

---

## Code style

- Vanilla JS, ES2017+ (no transpilation). Async/await, optional chaining, spread, template literals, `Set`/`Map` are fine.
- **No semicolons-on-mistake**: file already uses semicolons. Match it.
- **2-space indent** throughout JS.
- **IIFE wrapper** at top of each file: `(function () { ... })();`. Don't introduce `import`/`export`.
- Attach exports to `window.App.<Namespace>` at the bottom of the IIFE.
- `const` by default, `let` when reassigning, never `var`.
- **No comments explaining what code does.** Names should do that. Comments only for *why* (a workaround, a non-obvious constraint, a past incident).

---

## CSS

- Single file: `assets/css/app.css` (~2.4k lines). No preprocessor.
- Variables in `:root` for colors/spacing; `[data-theme=dark]` overrides.
- BEM-ish: `.toast`, `.toast-action`, `.toast.show`. No utility classes.
- Print rules: bottom of file, gated by `@media print`.

---

## File upload contract

`App.DataParser.parseDealFile(file, settings)` returns:
```js
{
  deals: [/* normalized deal records */],
  settings: { /* embedded settings if file was a combined export, else null */ },
  warnings: [...],
  missingFields: [...],
}
```

Combined exports: a single xlsx file can contain both deals (sheet 1) and settings JSON (sheet 2). When `result.settings` is set, app prompts "Import settings from this file?" then optionally calls `App.Settings.importFromObject()`.

---

## Deal record shape

Normalized deal:
```js
{
  id, title, responsible, team, dealType, productType,
  pipeline, stage, status,           // status = resolve(stage)
  amount, currency,
  begindate, closedate, lastActivity,
  // ...other Bitrix fields preserved as-is
}
```

`status` is computed **once at parse time** in `data-parser.js`. Don't recompute per-page — read `d.status`.

If user re-maps stages in Settings, `applyTeamConfigChange()`-equivalent isn't enough — call `data-parser.normalizeDeals(rawDeals, settings)` again or just re-parse. Currently the app re-parses (cheaper than tracing all dependent state).

---

## Defensive practices

- **Always `escapeHtml()`** before innerHTML injection. Deal titles can contain `<>&` from Bitrix.
- **Always `safeColor()`** before `style.color = …`. Settings import is a trust boundary.
- **Never trust client-side mode.** `App.MODE === 'admin'` hides UI but isn't a security control. Anyone can flip the JS variable.

---

## Don't do

- ❌ Add a build step (webpack/vite/etc)
- ❌ Add a backend (the user has actively avoided this — files stay local)
- ❌ Pull a UI library (React/Vue/Svelte). Existing pages are vanilla DOM.
- ❌ Add a 7th status without updating every page that lists statuses
- ❌ Hardcode colors — use `App.StatusMapping.COLORS`
- ❌ Re-implement `d.status === 'Won'` — use `Matchers`
- ❌ Destroy `<input>` elements while user is typing — use re-render-in-place
- ❌ Silently fall back to Open for unmapped stages — use Unmapped
- ❌ Bump major version without explicit ask
- ❌ Show preview panel after ship-feature changes — push prompt + QA only
