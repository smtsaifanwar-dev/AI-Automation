# Payment Follow-up module

Third tool in the launcher (tab "Payments" + home card). Source: `src/core.js` (pure logic), `src/payments.src.html` (UI).
Rebuild: `node build.js` (writes `payments.html` and re-embeds it into `index.html`; safe to re-run).
Tests: `npm i xlsx jsdom && node test/core.test.js && node test/ui.smoke.js`

Storage: browser localStorage only (~5 MB). No backend, login or workspaces exist in this app, so none were added.
Money is stored as integer minor units; currencies are never summed together. Nothing is ever sent.
Invoice Processing link: import the Excel/CSV it exports; only rows where *you* (Settings > business name) are the supplier become receivables.
Not built: auto-pull from the Invoices tab's live session, update-on-duplicate (duplicates are skipped), backup/restore JSON, separate follow-up queue tab.
